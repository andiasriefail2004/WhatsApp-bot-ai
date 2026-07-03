'use strict'

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys')
const fs = require('fs')
const cron = require('node-cron')

const DEBUG = process.env.DEBUG === '1'
function dlog(...a) { if (DEBUG) console.log(...a) }

const {
    maskSensitiveData, addHistory,
    callAI, generateImage, generateVideo, getValidProviders,
    hasValidKeys, clearHistory,
    imageToSticker, videoToSticker, textToSticker
} = require('./modules/ai')

const { fetchGempaID, fetchGempaUSGS, fetchEarthquakeUSGS } = require('./modules/gempa')

const { handleDownload, cleanupDownload, activeDownloads, checkUrlSafety, REJECT_MESSAGE: URL_REJECT_MESSAGE } = require('./modules/downloader')

const { getCerpenRandom, getPantunRandom, getPuisiRandom } = require('./modules/sastra')
const { getQuizRandom, checkJawaban } = require('./modules/quiz')

const { getMotivasiRandom, getFaktaRandom, getRenunganRandom, getFilosofisRandom } = require('./modules/inspirasi')

const {
    INDONESIA_ALIAS,
    geocodeCity, reverseGeocode, fetchWeather, formatWeatherMessage,
    handleWeatherCommand, handleLocationWeather
} = require('./modules/weather')

const {
    GROUP_ADMIN_COMMANDS, DEFAULT_GROUP_SETTINGS,
    normalizeJid, getGroupSettings, setGroupSetting, saveGroupSettings,
    isGroupAdmin, isBotNumberJid,
    getFreshGroupMetadata, sendGroupGreeting,
    handleGroupAdminCommand,
    textMatchesFilter, addFilterWarn, resetFilterWarn,
    FILTER_KICK_THRESHOLD
} = require('./modules/group')

const {
    OWNER_COMMANDS, PUBLIC_COMMANDS,
    isOwner, isBanned, isMaintenanceMode, recordKnownUser, recordFirstSeen, incrementRequestCount,
    handleOwnerCommand, handlePublicCommand
} = require('./modules/owner')

const { createQueue } = require('./modules/queue')

const { sendListMessage, sendButtons, sendInteractiveMessage } = require('./modules/interactive')

const { handleStickerFromQuoted, handleStickerMessage, handleImageStickerCaption } = require('./modules/sticker')
const { detectAndBuildPayload, buildVCard, generateQR, decodeQRFromBuffer, MAX_FILE_SIZE: QR_MAX_FILE_SIZE } = require('./modules/qr')

const BOT_NAME   = 'AI Bot'

const CRON_STATIC = []

const userLastBotMsg = {}
const userLastBotMsgOrder = []
const MAX_LAST_MSG_USERS = 500

function touchLastBotMsgOrder(jid) {
    const idx = userLastBotMsgOrder.indexOf(jid)
    if (idx !== -1) userLastBotMsgOrder.splice(idx, 1)
    userLastBotMsgOrder.push(jid)
}

function evictOldestLastBotMsgIfNeeded() {
    while (userLastBotMsgOrder.length > MAX_LAST_MSG_USERS) {
        const oldest = userLastBotMsgOrder.shift()
        delete userLastBotMsg[oldest]
    }
}

function getLastBotMsg(jid) {
    return userLastBotMsg[jid] || null
}

function setLastBotMsg(jid, key) {
    if (key === null) {
        userLastBotMsg[jid] = null
        return
    }
    userLastBotMsg[jid] = key
    touchLastBotMsgOrder(jid)
    evictOldestLastBotMsgIfNeeded()
}

const stickerQueue  = createQueue()
const mediaGenQueue = createQueue()

const userActiveTask = {}
const answeredQuiz = new Set() // key: stanzaId soal, 1 soal hanya bisa dijawab 1x

function getActiveToolLabel(jid) {
    const t = userActiveTask[jid]
    if (!t) return null
    const labels = { sticker: 'sticker', download: 'download', mediaGen: 'generate gambar/video' }
    return labels[t.tool] || t.tool
}

function claimActiveTask(jid, tool, cancelFn) {
    if (userActiveTask[jid]) return false
    userActiveTask[jid] = { tool, cancel: cancelFn }
    return true
}

function releaseActiveTask(jid) {
    delete userActiveTask[jid]
}

async function runDownloadCommand(sock, from, msg, args, mode, usageText) {
    const url = args.trim()
    if (!url || !url.startsWith('http')) { await sock.sendMessage(from, { text: usageText }); await sock.sendPresenceUpdate('paused', from); return }
    if (!isOwner(msg.key) && userActiveTask[from]) { await sock.sendMessage(from, { text: `⚠️ Kamu masih punya proses *${getActiveToolLabel(from)}* aktif.\nKetik *.cp* untuk membatalkan dulu.` }); await sock.sendPresenceUpdate('paused', from); return }
    if (!isOwner(msg.key)) claimActiveTask(from, 'download', () => { cleanupDownload(from) })
    try { await handleDownload(sock, from, url, mode) } finally { if (!isOwner(msg.key)) releaseActiveTask(from) }
    await sock.sendPresenceUpdate('paused', from)
}

async function runQueuedTool(sock, from, msgKey, queue, tool, task) {
    if (isOwner(msgKey)) {

        const controller = new AbortController()
        return task({ signal: controller.signal, registerKill: () => {} })
    }

    if (userActiveTask[from]) {
        const label = getActiveToolLabel(from)
        const hint = userActiveTask[from].tool === 'download' ? '.cdl' : '.cp'
        await sock.sendMessage(from, {
            text: `⚠️ Kamu masih punya proses *${label}* yang aktif/menunggu.\n\nKetik *${hint}* untuk membatalkan dulu sebelum pakai tool lain.`
        })
        return undefined
    }

    const controller = new AbortController()
    let killFn = null
    let queueId = null
    const registerKill = (fn) => { killFn = fn }
    const cancel = () => { if (queueId !== null) queue.cancelWaiting(queueId); controller.abort(); if (killFn) killFn() }

    claimActiveTask(from, tool, cancel)

    const { id, promise } = queue.add(() => task({ signal: controller.signal, registerKill }))
    queueId = id

    let queueMsgKey = null
    let listenerCleaned = false

    const deleteQueueMsg = async () => {
        if (!queueMsgKey) return
        const key = queueMsgKey
        queueMsgKey = null
        try { await sock.sendMessage(from, { delete: key }) } catch (_) {}
    }

    let onAdvance
    const cleanupListener = () => {
        if (listenerCleaned) return
        listenerCleaned = true
        queue.offAdvance(onAdvance)
    }

    onAdvance = async () => {
        if (listenerCleaned) return
        const pos = queue.position(queueId)
        if (pos > 0) {

            if (queueMsgKey) {
                try {
                    await sock.sendMessage(from, {
                        text: `⏳ Antrian ke-${pos}, tunggu sebentar...`,
                        edit: queueMsgKey
                    })
                } catch (_) {}
            }
        } else {

            cleanupListener()
            await deleteQueueMsg()
        }
    }

    const initialPos = queue.position(queueId)
    if (initialPos > 0) {

        try {
            const sent = await sock.sendMessage(from, { text: `⏳ Antrian ke-${initialPos}, tunggu sebentar...` })
            queueMsgKey = sent?.key || null
        } catch (_) {}
        queue.onAdvance(onAdvance)
    }

    try {
        return await promise
    } catch (e) {
        if (e.message === 'CANCELLED_WHILE_WAITING' || e.name === 'AbortError') {
            cleanupListener()
            await deleteQueueMsg()
            return undefined
        }
        throw e
    } finally {
        cleanupListener()
        releaseActiveTask(from)
    }
}

async function runUnqueuedTool(task) {
    const controller = new AbortController()
    return task({ signal: controller.signal, registerKill: () => {} })
}

const userTimezones = fs.existsSync('./userTimezone.json')
    ? JSON.parse(fs.readFileSync('./userTimezone.json', 'utf-8')) : {}
let cronJobs = fs.existsSync('./cronJobs.json')
    ? JSON.parse(fs.readFileSync('./cronJobs.json', 'utf-8')) : []

let cronStarted = false
let cronSaveLock = false
const activeCronTasks = new Map()

const GROUP_CACHE_TTL_MS = 5 * 60 * 1000
const groupMetadataCache = new Map()

function getCachedGroupMetadata(groupJid) {
    const cached = groupMetadataCache.get(groupJid)
    if (!cached) return null
    if (Date.now() - cached.timestamp > GROUP_CACHE_TTL_MS) return null
    return cached.data
}

function setCachedGroupMetadata(groupJid, data) {
    groupMetadataCache.set(groupJid, { data, timestamp: Date.now() })
}

async function refreshGroupMetadataCache(sock, groupJid, reason) {
    const t0 = Date.now()
    try {
        const metadata = await sock.groupMetadata(groupJid)
        setCachedGroupMetadata(groupJid, metadata)
        console.log(`[group-cache] refreshed (${reason}) for ${groupJid} in ${Date.now() - t0}ms, participants=${metadata?.participants?.length}`)
        return metadata
    } catch (e) {
        console.log(`[group-cache] refresh FAILED (${reason}) for ${groupJid} after ${Date.now() - t0}ms:`, e?.message)
        return null
    }
}

const TIMEZONE_MAP = {
    'WIB':'Asia/Jakarta','WITA':'Asia/Makassar','WIT':'Asia/Jayapura',
    'MYT':'Asia/Kuala_Lumpur','SGT':'Asia/Singapore','PHT':'Asia/Manila',
    'BNT':'Asia/Brunei','ICT':'Asia/Bangkok','MMT':'Asia/Rangoon',
    'CST':'Asia/Shanghai','JST':'Asia/Tokyo','KST':'Asia/Seoul',
    'PYT':'Asia/Pyongyang','HKT':'Asia/Hong_Kong','TWN':'Asia/Taipei',
    'IST':'Asia/Kolkata','PKT':'Asia/Karachi','BDT':'Asia/Dhaka',
    'NPT':'Asia/Kathmandu','SLT':'Asia/Colombo','GST':'Asia/Dubai',
    'AST':'Asia/Riyadh','IRST':'Asia/Tehran','TRT':'Europe/Istanbul',
    'IDT':'Asia/Jerusalem','GMT':'Europe/London','BST':'Europe/London',
    'UTC':'UTC','CET':'Europe/Paris','CEST':'Europe/Paris',
    'EET':'Europe/Helsinki','MSK':'Europe/Moscow','AMS':'Europe/Amsterdam',
    'ROM':'Europe/Rome','MAD':'Europe/Madrid','EST':'America/New_York',
    'EDT':'America/New_York','CST_US':'America/Chicago','MST':'America/Denver',
    'PST':'America/Los_Angeles','PDT':'America/Los_Angeles','BRT':'America/Sao_Paulo',
    'ART':'America/Argentina/Buenos_Aires','CLT':'America/Santiago','COT':'America/Bogota',
    'AEST':'Australia/Sydney','AEDT':'Australia/Sydney','ACST':'Australia/Adelaide',
    'AWST':'Australia/Perth','NZST':'Pacific/Auckland','HST':'Pacific/Honolulu',
    'CAT':'Africa/Harare','EAT':'Africa/Nairobi','WAT':'Africa/Lagos','SAST':'Africa/Johannesburg'
}

const ALLOWED_IMAGE_MIME = ['image/jpeg','image/png','image/webp','image/gif']
const ALLOWED_VIDEO_MIME = ['video/mp4','video/3gpp','video/quicktime','video/x-matroska']
const ALLOWED_AUDIO_MIME = ['audio/ogg','audio/mpeg','audio/mp4','audio/aac','audio/ogg; codecs=opus']
const ALLOWED_DOC_MIME   = ['application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain']
const MAX_FILE_SIZE = 20 * 1024 * 1024

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15',

    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
]

const FALLBACK_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

function getRandomUA() {
    if (!USER_AGENTS.length) return FALLBACK_USER_AGENT
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] || FALLBACK_USER_AGENT
}

function shouldQuote(msg) { return !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage }
function extractUrls(text) { return text.match(/https?:\/\/[^\s]+/g) || [] }

function getMsgType(msg) {
    const MEDIA_MSG_TYPES = ['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage']
    const keys = Object.keys(msg.message || {})
    const found = keys.find(k => MEDIA_MSG_TYPES.includes(k))
    if (found) return found
    if (keys.includes('conversation')) return 'conversation'
    if (keys.includes('extendedTextMessage')) return 'extendedTextMessage'
    if (keys.includes('listResponseMessage')) return 'listResponseMessage'
    if (keys.includes('interactiveResponseMessage')) return 'interactiveResponseMessage'
    if (keys.includes('templateButtonReplyMessage')) return 'templateButtonReplyMessage'
    if (keys.includes('reactionMessage')) return 'reactionMessage'
    if (keys.includes('pollUpdateMessage')) return 'pollUpdateMessage'
    return keys[0] || ''
}

function validateMime(mime, allowedList) {
    if (!mime) return false
    const normalized = mime.toLowerCase().trim()
    return allowedList.some(a => normalized.startsWith(a) || normalized === a)
}

function getFileSizeFromMsg(msg, msgType) {
    try {
        const m = msg.message
        if (msgType === 'imageMessage')    return m.imageMessage?.fileLength || 0
        if (msgType === 'videoMessage')    return m.videoMessage?.fileLength || 0
        if (msgType === 'audioMessage')    return m.audioMessage?.fileLength || 0
        if (msgType === 'documentMessage') return m.documentMessage?.fileLength || 0
    } catch(e) {}
    return 0
}

async function saveCronJobs() {
    while (cronSaveLock) { await new Promise(r => setTimeout(r, 50)) }
    cronSaveLock = true
    try { fs.writeFileSync('./cronJobs.json', JSON.stringify(cronJobs, null, 2)) }
    finally { cronSaveLock = false }
}

function scheduleDynamicCron(sock, job) {
    if (job.type === 'reminder' || job.type === 'unmute') return
    const task = cron.schedule(job.schedule, async () => {
        try { await sock.sendMessage(job.jid, { text: job.message }) } catch(e) {}
    }, { timezone: job.timezone || 'Asia/Jakarta' })
    activeCronTasks.set(job, task)
}

function stopAndRemoveDynamicCron(job) {
    const task = activeCronTasks.get(job)
    if (task) { task.stop(); activeCronTasks.delete(job) }
}

function startCronJobs(sock) {
    if (cronStarted) return
    cronStarted = true
    for (const job of CRON_STATIC) {
        cron.schedule(job.schedule, async () => {
            try { await sock.sendMessage(job.target, { text: job.message }) } catch(e) {}
        }, { timezone: job.timezone || 'Asia/Jakarta' })
    }
    for (const job of cronJobs) { scheduleDynamicCron(sock, job) }
    cron.schedule('* * * * *', async () => {
        const now = new Date()
        const remaining = []
        for (const reminder of cronJobs.filter(j => j.type === 'reminder')) {
            const userTz = userTimezones[reminder.jid] || 'Asia/Jakarta'
            const userNow = new Date(now.toLocaleString('en-US', { timeZone: userTz }))
            if (userNow >= new Date(reminder.sendAt)) {
                try { await sock.sendMessage(reminder.jid, { text: `⏰ Reminder: ${reminder.message}` }) } catch(e) {}
            } else {
                remaining.push(reminder)
            }
        }
        const remainingUnmutes = []
        for (const job of cronJobs.filter(j => j.type === 'unmute')) {
            if (now.getTime() >= new Date(job.unmuteAt).getTime()) {
                try {
                    await sock.groupSettingUpdate(job.jid, 'not_announcement')
                    await sock.sendMessage(job.jid, { text: '🔊 Waktu mute habis. Grup dibuka otomatis, semua anggota bisa kirim pesan lagi.' })
                } catch(e) {}
            } else {
                remainingUnmutes.push(job)
            }
        }
        const staticCrons = cronJobs.filter(j => j.type !== 'reminder' && j.type !== 'unmute')
        cronJobs = [...staticCrons, ...remaining, ...remainingUnmutes]
        await saveCronJobs()
    })
}

async function fetchUrlContent(url) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7' },
            signal: AbortSignal.timeout(8000)
        })
        const html = await res.text()
        return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
    } catch(e) { return null }
}

async function searchDuckDuckGo(query) {
    try {
        const encoded = encodeURIComponent(query)
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
            headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8', 'Referer': 'https://duckduckgo.com/', 'Connection': 'keep-alive', 'Cache-Control': 'no-cache' },
            signal: AbortSignal.timeout(10000)
        })
        const html = await res.text()
        const results = []
        const titleMatches = [...html.matchAll(/<a class="result__a"[^>]*href="[^"]*"[^>]*>([^<]+)<\/a>/g)]
        const snippetMatches = [...html.matchAll(/<a class="result__snippet"[^>]*>([^<]+)<\/a>/g)]
        for (let i = 0; i < Math.min(titleMatches.length, 5); i++) {
            const title = titleMatches[i]?.[1]?.trim() || ''
            const snippet = snippetMatches[i]?.[1]?.trim() || ''
            if (title) results.push(`${i + 1}. ${title}\n${snippet}`)
        }
        return results.length > 0 ? results.join('\n\n') : null
    } catch(e) { return null }
}

async function searchGoogle(query) {
    try {
        const encoded = encodeURIComponent(query)
        const res = await fetch(`https://api.harzrestapi.web.id/api/v2/search/google?q=${encoded}&apikey=FREE`, {
            headers: { 'User-Agent': getRandomUA(), 'Accept': 'application/json', 'Referer': 'https://api.harzrestapi.web.id/', 'Connection': 'keep-alive' },
            signal: AbortSignal.timeout(8000)
        })
        const data = await res.json()
        if (data.success && data.result && data.result.length > 0) {
            return data.result.map(r => `${r.id}. ${r.title}\n${r.snippet}\n${r.url}`).join('\n\n')
        }
        return await searchDuckDuckGo(query)
    } catch(e) { return await searchDuckDuckGo(query) }
}



const { pollStore, executePoll, handlePollVote } = require('./modules/poll')

let lastStatusKey = null

async function postStatus(sock, type, content, backgroundColor = '#075E54') {
    const contacts = []
    let sentStatus = null
    if (type === 'text') sentStatus = await sock.sendMessage('status@broadcast', { text: content, backgroundColor, font: 2 }, { statusJidList: contacts, broadcast: true })
    else if (type === 'image') sentStatus = await sock.sendMessage('status@broadcast', { image: { url: content }, caption: '' }, { statusJidList: contacts, broadcast: true })
    else if (type === 'video') sentStatus = await sock.sendMessage('status@broadcast', { video: { url: content }, caption: '' }, { statusJidList: contacts, broadcast: true })
    if (sentStatus?.key) lastStatusKey = sentStatus.key
}

function parseLocalPoll(text) {
    const split = text.split('?')
    if (split.length >= 2) {
        const question = split[0].trim() + '?'
        const options = split[1].split(',').map(o => o.trim()).filter(o => o.length > 0)
        if (options.length >= 2) return { question, options }
    }
    const parts = text.split(',')
    if (parts.length >= 3) {
        const question = parts[0].trim()
        const options = parts.slice(1).map(o => o.trim()).filter(o => o.length > 0)
        if (options.length >= 2) return { question, options }
    }
    return null
}

function parseLocalIntent(text, msg) {
    const t = text.toLowerCase().trim()
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if ((t.includes('sticker') || t.includes('stiker')) && !!quoted?.imageMessage) return { intent: 'make_sticker' }
    if ((t.includes('sticker') || t.includes('stiker')) && !!quoted?.videoMessage) return { intent: 'make_video_sticker' }
    const tsMatch = t.match(/^(buat|bikin)\s+sticker\s+(.+)/i)
    if (tsMatch) return { intent: 'make_text_sticker', text: tsMatch[2] }
    if (t === 'menu' || t === 'help') return { intent: 'show_menu' }
    if (t.includes('poll') || t.includes('voting') || t.includes('vote')) {
        const parsed = parseLocalPoll(text)
        if (parsed) return { intent: 'send_poll', ...parsed }
    }
    if (/https?:\/\/[^\s]+/.test(text)) return { intent: 'url_content', url: extractUrls(text)[0] }
    return null
}

async function handleLocalFallback(sock, from, msg, text, msgType) {
    const quoteOpt = shouldQuote(msg) ? { quoted: msg } : {}
    if (text) {
        const local = parseLocalIntent(text, msg)
        if (local) {
            if (local.intent === 'make_sticker' || local.intent === 'make_video_sticker') {
                const done = await handleStickerFromQuoted(sock, from, msg, runQueuedTool, stickerQueue, imageToSticker, videoToSticker)
                if (!done) await sock.sendMessage(from, { text: 'Reply gambar atau video untuk membuat sticker!' })
                return
            }
            if (local.intent === 'make_text_sticker') {
                await sock.sendMessage(from, { text: '⏳ Membuat sticker teks...' })
                const stickerBuffer = await runQueuedTool(sock, from, msg.key, stickerQueue, 'sticker',
                    ({ registerKill }) => textToSticker(local.text, (proc) => registerKill(() => proc.kill('SIGTERM'))))
                if (stickerBuffer) await sock.sendMessage(from, { sticker: stickerBuffer })
                return
            }
            if (local.intent === 'show_menu') {
                const menuText = isOwner(msg.key) ? `${buildMenuText()}\n\n${buildOwnerMenuText()}` : buildMenuText()
                await sock.sendMessage(from, { text: menuText })
                return
            }
            if (local.intent === 'send_poll') {
                await executePoll(sock, from, local.question, local.options)
                return
            }
            if (local.intent === 'url_content') {
                const safety = await checkUrlSafety(local.url)
                if (!safety.safe) {
                    console.warn('[url_content] URL ditolak (SSRF guard):', safety.reason)
                    await sock.sendMessage(from, { text: URL_REJECT_MESSAGE })
                    return
                }
                await sock.sendMessage(from, { text: '⏳ Mengambil konten URL...' })
                const content = await fetchUrlContent(local.url)
                if (content) {
                    const snippet = content.slice(0, 1000)
                    await sock.sendMessage(from, { text: `📄 Konten dari URL:\n\n${snippet}${content.length > 1000 ? '\n\n_(dipotong, AI sedang tidak tersedia untuk merangkum)_' : ''}` }, quoteOpt)
                } else {
                    await sock.sendMessage(from, { text: '❌ Tidak bisa mengambil konten URL tersebut.' })
                }
                return
            }
        }
    }
    if (msgType === 'imageMessage') { await sock.sendMessage(from, { text: '⚠️ AI sedang tidak tersedia. Kirim dengan caption "sticker" untuk membuat sticker.' }, quoteOpt); return }
    if (msgType === 'audioMessage') { await sock.sendMessage(from, { text: '⚠️ AI sedang tidak tersedia. Tidak bisa transkripsi voice note saat ini.' }); return }
    await sock.sendMessage(from, {
        text: '⚠️ AI sedang tidak tersedia. Fitur yang tetap bisa dipakai:\n.sticker — buat sticker\n.ts [teks] — sticker teks\n.poll Pertanyaan? A, B, C — buat poll\n.cuaca [kota] — cek cuaca\n.gempaid [wilayah] — info gempa Indonesia\n.gempa [wilayah/negara] — info gempa dunia\n.menu — lihat menu'
    }, quoteOpt)
}

async function handleFunctionResult(sock, from, msg, result, userText = '') {
    const quoteOpt = shouldQuote(msg) ? { quoted: msg } : {}

    if (result.name === 'download_media') {
        if (!isOwner(msg.key) && userActiveTask[from]) {
            await sock.sendMessage(from, { text: `⚠️ Kamu masih punya proses *${getActiveToolLabel(from)}* aktif.\nKetik *.cp* untuk membatalkan dulu.` })
            return
        }
        if (!isOwner(msg.key)) claimActiveTask(from, 'download', () => { cleanupDownload(from) })
        try { await handleDownload(sock, from, result.args.url, result.args.type || 'video') }
        finally { if (!isOwner(msg.key)) releaseActiveTask(from) }
        return
    }
    if (result.name === 'generate_image') {
        await sock.sendMessage(from, { text: '🎨 Membuat gambar...' })
        const imgBuffer = await runQueuedTool(sock, from, msg.key, mediaGenQueue, 'mediaGen',
            ({ signal }) => generateImage(result.args.prompt, signal))
        if (!imgBuffer) { await sock.sendMessage(from, { text: '❌ Gagal generate gambar. Provider image belum dikonfigurasi atau sedang tidak tersedia.' }, quoteOpt); return }
        await sock.sendMessage(from, { image: imgBuffer, caption: `🖼️ ${result.args.prompt}` })
        return
    }
    if (result.name === 'generate_video') {
        await sock.sendMessage(from, { text: '🎬 Membuat video...' })
        const vidBuffer = await runQueuedTool(sock, from, msg.key, mediaGenQueue, 'mediaGen',
            ({ signal }) => generateVideo(result.args.prompt, signal))
        if (!vidBuffer) { await sock.sendMessage(from, { text: '❌ Gagal generate video. Provider video belum dikonfigurasi atau sedang tidak tersedia.' }, quoteOpt); return }
        await sock.sendMessage(from, { video: vidBuffer, caption: `🎬 ${result.args.prompt}` })
        return
    }
    if (result.name === 'create_qr_code') {
        const detected = detectAndBuildPayload(result.args.data || '')
        console.log(`[bot:create_qr_code] input="${result.args.data}" → type="${detected.type}" payload="${detected.payload}"`)
        await sock.sendMessage(from, { text: `⏳ Membuat QR code (${detected.type})...` })
        const qrBuffer = await runQueuedTool(sock, from, msg.key, mediaGenQueue, 'mediaGen',
            ({ signal }) => generateQR(detected.payload, signal))
        if (!qrBuffer) { await sock.sendMessage(from, { text: '❌ Gagal membuat QR code. Coba lagi.' }, quoteOpt); return }
        await sock.sendMessage(from, { image: qrBuffer, caption: `✅ QR code berhasil dibuat (${detected.type})` })
        return
    }
    if (result.name === 'scan_qr_code') {
        const quotedImg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
        let qrSourceBuffer = null
        try {
            if (msg.message?.imageMessage) {
                qrSourceBuffer = await downloadMediaMessage(msg, 'buffer', {})
            } else if (quotedImg) {
                const fakeMsg = { message: { imageMessage: quotedImg }, key: { remoteJid: from } }
                qrSourceBuffer = await downloadMediaMessage(fakeMsg, 'buffer', {})
            }
        } catch (e) {
            console.error('[bot:scan_qr_code] gagal download gambar:', e?.message)
        }
        if (!qrSourceBuffer) {
            await sock.sendMessage(from, { text: '❌ Tidak ada gambar untuk di-scan. Kirim atau reply gambar QR code dulu.' }, quoteOpt)
            return
        }
        await sock.sendMessage(from, { text: '⏳ Men-scan QR code...' })
        const decoded = await runQueuedTool(sock, from, msg.key, mediaGenQueue, 'mediaGen',
            () => decodeQRFromBuffer(qrSourceBuffer))
        if (decoded === undefined) return
        if (decoded === null) {
            await sock.sendMessage(from, { text: '❌ Tidak ditemukan QR code pada gambar tersebut. Coba gambar yang lebih jelas atau lebih besar.' }, quoteOpt)
        } else {
            await sock.sendMessage(from, { text: `✅ *Isi QR Code:*\n\n${decoded}` }, quoteOpt)
        }
        return
    }
    if (result.name === 'make_sticker') {
        const done = await handleStickerFromQuoted(sock, from, msg, runQueuedTool, stickerQueue, imageToSticker, videoToSticker)
        if (!done) await sock.sendMessage(from, { text: 'Reply gambar atau video yang ingin dijadikan sticker!' })
    } else if (result.name === 'make_text_sticker') {
        await sock.sendMessage(from, { text: '⏳ Membuat sticker teks...' })
        const stickerBuffer = await runQueuedTool(sock, from, msg.key, stickerQueue, 'sticker',
            ({ registerKill }) => textToSticker(result.args.text, (proc) => registerKill(() => proc.kill('SIGTERM'))))
        if (stickerBuffer) await sock.sendMessage(from, { sticker: stickerBuffer })
    } else if (result.name === 'send_poll') {
        await executePoll(sock, from, result.args.question, result.args.options)
    } else if (result.name === 'post_status') {
        if (!isOwner(msg.key)) { await sock.sendMessage(from, { text: '🚫 Fitur posting status hanya bisa digunakan oleh owner.' }, quoteOpt); return }
        await sock.sendMessage(from, { text: '⏳ Posting status...' })
        await postStatus(sock, result.args.type, result.args.content, result.args.backgroundColor)
        await sock.sendMessage(from, { text: '✅ Status berhasil diposting!' })
    } else if (result.name === 'forward_message') {
        await sock.sendMessage(from, { text: result.args.text })
    } else if (result.name === 'show_menu') {
        const menuText = isOwner(msg.key) ? `${buildMenuText()}\n\n${buildOwnerMenuText()}` : buildMenuText()
        await sock.sendMessage(from, { text: menuText })
    } else if (result.name === 'react_message') {
        try {
            await sock.sendMessage(from, { react: { text: result.args.emoji, key: msg.key } })
        } catch(_) {}

        if (result.args.reply) {
            const sentMsg = await sock.sendMessage(from, { text: result.args.reply }, quoteOpt)
            setLastBotMsg(from, sentMsg.key)
        }
    } else if (result.name === 'send_gif') {
        try {
            await sock.sendMessage(from, { video: { url: result.args.url }, gifPlayback: true, caption: result.args.caption || '' })
        } catch(e) { await sock.sendMessage(from, { text: result.args.caption || '🎬' }) }
    } else if (result.name === 'edit_message') {
        if (getLastBotMsg(from)) {
            await sock.sendMessage(from, { text: result.args.new_text, edit: getLastBotMsg(from) })
            addHistory(from, 'model', result.args.new_text)
        }
    } else if (result.name === 'delete_message') {
        if (getLastBotMsg(from)) {
            await sock.sendMessage(from, { delete: getLastBotMsg(from) })
            setLastBotMsg(from, null)
        }
    } else if (result.name === 'search_web') {
        await sock.sendMessage(from, { text: '🔍 Mencari...' })
        const searchResult = await searchGoogle(result.args.query)
        if (searchResult) {
            const summary = await callAI(from, `Hasil pencarian untuk "${result.args.query}":\n\n${searchResult}\n\nRangkum dan jawab pertanyaan user berdasarkan hasil ini dengan natural dalam bahasa yang sama dengan user.`, null, null, '', BOT_NAME)
            if (summary && summary.type === 'text') {
                const sentMsg = await sock.sendMessage(from, { text: summary.text }, quoteOpt)
                setLastBotMsg(from, sentMsg.key)
            } else {
                await sock.sendMessage(from, { text: `🔍 Hasil pencarian:\n\n${searchResult.slice(0, 1500)}` }, quoteOpt)
            }
        } else {
            await sock.sendMessage(from, { text: '❌ Pencarian gagal.' })
        }
    } else if (result.name === 'get_weather') {
        await sock.sendMessage(from, { text: '🌤️ Mengambil data cuaca...' })
        const cityInput = result.args.city || ''
        const resolved = INDONESIA_ALIAS[cityInput.toLowerCase()] || cityInput
        const weatherMsg = await runUnqueuedTool(async ({ signal }) => {
            const geo = await geocodeCity(resolved, signal)
            if (!geo) return { error: `❌ Maaf, saya tidak bisa menemukan data lokasi untuk *${cityInput}*.` }
            const weatherData = await fetchWeather(geo.lat, geo.lon, signal)
            if (!weatherData) return { error: `❌ Data cuaca untuk *${cityInput}* sedang tidak tersedia.` }
            return { text: formatWeatherMessage(geo, weatherData) }
        })
        if (!weatherMsg) return
        if (weatherMsg.error) { const sentMsg = await sock.sendMessage(from, { text: weatherMsg.error }, quoteOpt); setLastBotMsg(from, sentMsg.key); return }
        const sentMsg = await sock.sendMessage(from, { text: weatherMsg.text }, quoteOpt)
        setLastBotMsg(from, sentMsg.key)
        if (userText) { addHistory(from, 'user', maskSensitiveData(userText)); addHistory(from, 'model', weatherMsg.text) }
    } else if (result.name === 'delete_status') {
        await sock.sendMessage(from, { text: '🚫 Maaf, saya hanya AI — saya tidak bisa menghapus status WhatsApp yang sudah diposting.' }, quoteOpt)
    } else if (result.name === 'clear_history') {
        clearHistory(from)
        setLastBotMsg(from, null)
        await sock.sendMessage(from, { text: '🗑️ Riwayat percakapan kita sudah dihapus. Mulai dari nol lagi ya!' })
    } else if (result.name === 'get_earthquake') {
        await sock.sendMessage(from, { text: '🌋 Mengambil data gempa...' })
        const hasil = await runUnqueuedTool(
            ({ signal }) => fetchGempaID(result.args.region || null, signal))
        if (!hasil) return
        const sentMsg = await sock.sendMessage(from, { text: hasil }, quoteOpt)
        setLastBotMsg(from, sentMsg.key)
        if (userText) { addHistory(from, 'user', maskSensitiveData(userText)); addHistory(from, 'model', hasil) }
    } else if (result.name === 'get_earthquake_global') {
        await sock.sendMessage(from, { text: '🌍 Mengambil data gempa...' })
        const hasil = await runUnqueuedTool(
            ({ signal }) => fetchGempaUSGS(result.args.region || null, signal))
        if (!hasil) return
        const sentMsg = await sock.sendMessage(from, { text: hasil }, quoteOpt)
        setLastBotMsg(from, sentMsg.key)
        if (userText) { addHistory(from, 'user', maskSensitiveData(userText)); addHistory(from, 'model', hasil) }
    } else {

        await sock.sendMessage(from, { text: '🚫 Maaf, saya tidak bisa melakukan itu — fitur tersebut belum tersedia.' }, quoteOpt)
    }
}

function buildMenuText() {
    return `╔═══════════════════╗
  🤖 *${BOT_NAME}* — Halo!
╚═══════════════════╝

🤖 *AI & CHAT*
_Cukup ketik pesan biasa — tanpa command (mention bot kalau di grup)_
• .cerpen / .pantun / .puisi — Sastra acak
• .motivasi / .fakta / .renungan / .filosofis — Inspirasi acak
• .quiz — Main kuis
• .poll [pertanyaan]? [pilihan1], [pilihan2] — Buat poll
• .createimage / .ci [deskripsi] — Generate gambar AI
• .createvideo / .cv [deskripsi] — Generate video AI

🎨 *MEDIA & STICKER*
• .sticker / .s — Buat sticker dari gambar/video (reply)
• .ts / .textsticker [teks] — Sticker dari tulisan
• .setppgroup — Ganti foto profil grup (reply gambar, admin grup)

🔳 *QR CODE*
• .buatqr / .cqr [teks/url/dll] — Buat QR code
• .buatqr wa [nomor] — QR kontak WhatsApp (buka chat/add kontak)
• .buatqr call:[nomor] — QR telepon (dial otomatis)
• .buatqr wifi:ssid=NAMA;pass=PASSWORD;type=WPA — QR WiFi
• .buatqr [lat,lon] — QR lokasi/koordinat
• .buatqr (reply kontak yang dibagikan) — QR kontak vCard
• .scanqr / .sqr — Scan QR code (reply/kirim gambar, atau .scanqr [url])

📥 *DOWNLOADER*
• .dl [url] — Download otomatis (deteksi platform)
• .dytmp3 [url] — Download audio YouTube
• .dytmp4 [url] — Download video YouTube
• .dtt [url] — Download video TikTok
• .sp [url] — Download audio Spotify
• .cdl — Batalkan download aktif
• .cp — Batalkan proses aktif (download/generate/dll)

🌍 *INFO & CUACA*
• .cuaca / .weather [kota] — Info cuaca
• .gempaid [wilayah] — Gempa terkini Indonesia (BMKG)
• .gempa / .earthquake [wilayah/negara] — Gempa terkini dunia (USGS)

⏰ *PENJADWALAN*
• .settimezone [TZ] — Atur timezone kamu (contoh: WIB)
• .reminder [HH:MM] [TZ] [pesan] — Pasang reminder sekali
• .reminder list — Lihat reminder aktif
• .dreminder [nomor/all] — Hapus reminder
• .cron [HH:MM] [TZ] [pesan] — Pasang pesan otomatis harian
• .cron list — Lihat cron job aktif
• .dcron [nomor/all] — Hapus cron job

ℹ️ *UMUM*
• .myinfo / .whoami — Info & JID kamu
• .report [pesan] — Laporkan user ke owner (reply/mention/nomor)
• .menu / .help — Tampilkan menu ini

_Ketik salah satu command di atas untuk menggunakannya._`
}

function buildOwnerMenuText() {
    return `👑 *COMMAND OWNER*
━━━━━━━━━━━━━━━
• .broadcast [pesan] — Broadcast ke semua user tercatat
• .groupbroadcast [pesan] — Broadcast ke semua grup
• .send n- [nomor] t- [pesan] — Kirim pesan ke nomor tertentu
• .stats — Statistik bot
• .ban / .unban [nomor] — Ban/unban user
• .block / .unblock [nomor] — Block/unblock kontak
• .bio [nomor] — Lihat bio WhatsApp seseorang
• .pp [nomor] — Lihat foto profil seseorang
• .businessinfo [nomor] — Lihat info akun bisnis
• .setbio [teks] — Ganti bio bot
• .setbotname [nama] — Ganti nama tampilan bot
• .creategroup [nama]|[nomor] — Buat grup baru
• .joingroup [link] — Join grup lewat link invite
• .leavegroup — Keluar dari grup ini
• .listgroups — Daftar semua grup bot
• .leaveall — Keluar dari semua grup
• .leaveinactive [n] — Keluar dari grup dengan member < n
• .addme [groupJid] — Tambahkan owner ke grup tertentu
• .status [teks] — Posting status WhatsApp
• .dstatus — Hapus status terakhir yang diposting
• .maintenance on/off — Mode maintenance bot`
}

const BOT_START_TIME = Math.floor(Date.now() / 1000)

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth')
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        markOnlineOnConnect: false,

        cachedGroupMetadata: async (jid) => getCachedGroupMetadata(jid)
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode
            console.log(`[connection] CLOSED. statusCode=${code} reason=${lastDisconnect?.error?.message}`)
            if (code !== DisconnectReason.loggedOut) setTimeout(() => startBot(), 3000)
        }
        if (connection === 'open') {
            console.log(`✅ Bot aktif! Mode: ${hasValidKeys() ? '🤖 AI + Lokal' : '🔧 Lokal saja'}`)
            startCronJobs(sock)

            sock.groupFetchAllParticipating()
                .then(groups => {
                    const ids = Object.keys(groups || {})
                    ids.forEach(id => setCachedGroupMetadata(id, groups[id]))
                    console.log(`[group-cache] prefetched metadata untuk ${ids.length} grup saat connection open`)
                })
                .catch(e => console.log('[group-cache] prefetch gagal:', e?.message))
        }
    })

    sock.ev.on('groups.update', async (updates) => {
        for (const update of updates) {
            if (!update?.id) continue
            await refreshGroupMetadataCache(sock, update.id, 'groups.update')
        }
    })

    sock.ev.on('call', async (calls) => {
        for (const call of calls) {
            if (call.status !== 'offer') continue
            try {
                await sock.rejectCall(call.id, call.from)
                console.log(`[call] Panggilan dari ${call.from} ditolak otomatis.`)
            } catch (e) {
                console.log(`[call] Gagal menolak panggilan dari ${call.from}:`, e?.message)
            }
        }
    })

    sock.ev.on('group-participants.update', async ({ id: groupJid, participants, action }) => {
        const tEventReceived = Date.now()
        dlog(`[group-update] EVENT RECEIVED at ${new Date(tEventReceived).toISOString()} action: ${action} groupJid: ${groupJid}`)
        dlog('[group-update] participants raw:', JSON.stringify(participants))
        try {
            const jidListRaw = participants.map(p => typeof p === 'string' ? p : (p.phoneNumber || p.id || p.jid || '')).filter(Boolean)
            const botJidNum = sock.user?.id?.split(':')[0]
            const botWasRemoved = action === 'remove' && jidListRaw.some(j => j.includes(botJidNum))
            if (botWasRemoved) {
                dlog(`[group-update] Bot sendiri dikeluarkan/keluar dari grup ${groupJid}. Hapus dari cache.`)
                groupMetadataCache.delete(groupJid)
                return
            }
            const settings = getGroupSettings(groupJid)
            dlog('[group-update] settings:', JSON.stringify(settings))
            if (action === 'add' && !settings.welcomeEnabled) { dlog('[group-update] welcomeEnabled false, skip'); return }
            if (action === 'remove' && !settings.leaveEnabled) { dlog('[group-update] leaveEnabled false, skip'); return }
            if (action !== 'add' && action !== 'remove') { dlog('[group-update] action ignored:', action); return }
            const jidList = jidListRaw
            dlog('[group-update] jidList:', JSON.stringify(jidList))

            let groupName = groupJid
            const tMetaStart = Date.now()
            const cached = getCachedGroupMetadata(groupJid)
            if (cached) {
                groupName = cached.subject
                // Refresh nama/cache di background, tidak dipakai untuk totalMembers
                // karena totalMembers selalu diambil fresh langsung dari server di bawah.
                refreshGroupMetadataCache(sock, groupJid, 'background-after-cache-hit').catch(() => {})
            } else {
                dlog('[group-update] cache MISS, fetch nama grup dengan timeout 3000ms')
                try {
                    const metadata = await Promise.race([sock.groupMetadata(groupJid), new Promise(r => setTimeout(() => r(null), 3000))])
                    dlog(`[group-update] groupMetadata fetch took ${Date.now() - tMetaStart}ms, got data: ${!!metadata}`)
                    if (metadata) {
                        groupName = metadata.subject
                        setCachedGroupMetadata(groupJid, metadata)
                    } else {
                        dlog('[group-update] groupMetadata TIMED OUT after 3000ms, lanjut kirim pesan tanpa nama akurat')
                    }
                } catch(e) { dlog(`[group-update] metadata error after ${Date.now() - tMetaStart}ms:`, e?.message, e?.stack) }
            }
            dlog('[group-update] groupName:', groupName)

            const timestamp = new Date()
            for (const userJid of jidList) {
                const tSendStart = Date.now()
                dlog('[group-update] sending greeting to:', userJid, 'at', new Date(tSendStart).toISOString())
                const template = action === 'add' ? settings.welcomeText : settings.leaveText

                // totalMembers selalu fresh langsung dari server WhatsApp, supaya akurat
                // walau banyak orang masuk/keluar bersamaan dalam satu event.
                let totalMembers = null
                try {
                    const freshMetadata = await Promise.race([sock.groupMetadata(groupJid), new Promise(r => setTimeout(() => r(null), 3000))])
                    totalMembers = freshMetadata?.participants?.length ?? null
                } catch (e) {
                    dlog(`[group-update] fetch totalMembers gagal untuk ${userJid}:`, e?.message)
                }

                sendGroupGreeting(sock, groupJid, userJid, template, groupName, { totalMembers, timestamp })
                    .then(() => dlog(`[group-update] greeting SENT to ${userJid} in ${Date.now() - tSendStart}ms (total since event: ${Date.now() - tEventReceived}ms)`))
                    .catch(e => dlog(`[group-update] greeting FAILED to ${userJid} after ${Date.now() - tSendStart}ms:`, e?.message, e?.stack))
            }
        } catch (e) { console.log('⚠️ Gagal mengirim welcome/leave message:', e?.message, e?.stack) }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg || msg.key.fromMe) return

        if (msg.message?.protocolMessage) return

        const msgTimestamp = msg.messageTimestamp || 0
        if (msgTimestamp < BOT_START_TIME) return

        const isGroup = msg.key.remoteJid?.endsWith('@g.us')
        const senderJid = msg.key.participant || msg.key.remoteJid

        if (isBanned(msg.key)) return

        // Maintenance mode: balas non-owner dengan pesan maintenance, lalu stop
        if (isMaintenanceMode() && !isOwner(msg.key)) {
            await sock.sendMessage(from, {
                text: '🔧 *Maintenance is on.*\nBot sedang dalam perbaikan. Silakan coba beberapa saat lagi ya!'
            })
            return
        }

        incrementRequestCount()

        if (!isGroup) recordKnownUser(msg.key).catch(() => {})
        recordFirstSeen(msg.key).catch(() => {})

        const msgType = getMsgType(msg)

        if (msgType === 'pollUpdateMessage') {
            await handlePollVote(sock, msg)
            return
        }

        const from = msg.key.remoteJid
        const _interactiveText = msg.message?.interactiveResponseMessage?.body?.text || ''
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || _interactiveText || msg.message?.buttonsResponseMessage?.selectedButtonId || ''

        if (msgType === 'locationMessage') {
            await sock.readMessages([msg.key])
            await sock.sendPresenceUpdate('composing', from)
            await runUnqueuedTool(
                ({ signal }) => handleLocationWeather(sock, from, msg, signal))
            await sock.sendPresenceUpdate('paused', from)
            return
        }

        if (msgType === 'templateButtonReplyMessage') {
            const selectedId = msg.message?.templateButtonReplyMessage?.selectedId || ''
            const stanzaId = msg.message?.templateButtonReplyMessage?.contextInfo?.stanzaId || ''
            const soalText = msg.message?.templateButtonReplyMessage?.contextInfo?.quotedMessage?.interactiveMessage?.body?.text || ''
            if (selectedId.startsWith('quiz_')) {
                // Anti-spam: 1 soal hanya bisa dijawab 1x (per stanzaId soal, bukan per user)
                const quizKey = stanzaId + ':' + senderJid
                if (answeredQuiz.has(quizKey)) {
                    await sock.sendPresenceUpdate('paused', from)
                    return
                }
                answeredQuiz.add(quizKey)
                const pilihanUser = selectedId.replace('quiz_', '')
                const { QUIZ_LIST } = require('./modules/quiz')
                const soal = QUIZ_LIST.find(q => q.soal === soalText)
                if (soal) {
                    const benar = checkJawaban(pilihanUser, soal.jawaban)
                    // Mention user jika di grup
                    const mentionText = isGroup ? `@${normalizeJid(senderJid)} ` : ''
                    const mentionOpt = isGroup ? { mentions: [senderJid] } : {}
                    if (benar) {
                        await sock.sendMessage(from, { text: `${mentionText}✅ Benar! Jawabannya memang *${soal.jawaban}*.

📖 ${soal.penjelasan}`, ...mentionOpt })
                    } else {
                        await sock.sendMessage(from, { text: `${mentionText}❌ Salah! Yang benar adalah *${soal.jawaban}*.

📖 ${soal.penjelasan}`, ...mentionOpt })
                    }
                }
                await sock.sendPresenceUpdate('paused', from)
                return
            }
        }

        if (msgType === 'interactiveResponseMessage') {
            const interactiveId = (() => { try { return JSON.parse(msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || '{}')?.id || '' } catch { return '' } })()
            if (interactiveId.startsWith('quiz_')) {
                const pilihanUser = interactiveId.replace('quiz_', '')
                const soalText = msg.message?.interactiveResponseMessage?.contextInfo?.quotedMessage?.interactiveMessage?.body?.text || ''
                const { QUIZ_LIST } = require('./modules/quiz')
                const soal = QUIZ_LIST.find(q => q.soal === soalText)
                if (soal) {
                    const benar = checkJawaban(pilihanUser, soal.jawaban)
                    if (benar) {
                        await sock.sendMessage(from, { text: `✅ Benar! Jawabannya memang *${soal.jawaban}*.

📖 ${soal.penjelasan}` })
                    } else {
                        await sock.sendMessage(from, { text: `❌ Salah! Yang benar adalah *${soal.jawaban}*.

📖 ${soal.penjelasan}` })
                    }
                }
                await sock.sendPresenceUpdate('paused', from)
                return
            }
            // Bukan quiz — lanjut ke flow command normal via _interactiveText
        }

        if (msgType === 'listResponseMessage') {
            const selectedRowId = msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId || ''
            const MENU_LIST_ACTIONS = {
                menu_cerpen: () => getCerpenRandom(),
                menu_pantun: () => getPantunRandom(),
                menu_puisi: () => getPuisiRandom(),
                menu_motivasi: () => getMotivasiRandom(),
                menu_fakta: () => getFaktaRandom(),
                menu_renungan: () => getRenunganRandom(),
                menu_filosofis: () => getFilosofisRandom()
            }
            const action = MENU_LIST_ACTIONS[selectedRowId]
            if (action) {
                await sock.sendMessage(from, { text: action() })
            }
            return
        }

        if (isGroup) {
            const settings = getGroupSettings(from)
            const hasPrefixForAntilink = text.startsWith('.') || text.startsWith('#') || text.startsWith('!')
            const commandForAntilink = hasPrefixForAntilink ? text.slice(1).trim().split(' ')[0].toLowerCase() : ''
            const isDownloadCommand = ['dl', 'dytmp3', 'dytmp4', 'dtt', 'sp'].includes(commandForAntilink)

            if (settings.antilinkEnabled && text && !isDownloadCommand && /(https?:\/\/|chat\.whatsapp\.com)/i.test(text)) {
                const senderIsAdmin = await isGroupAdmin(sock, from, senderJid).catch(() => false)
                if (!senderIsAdmin) {
                    try { await sock.sendMessage(from, { delete: msg.key }) } catch (e) {}
                    await sock.sendMessage(from, { text: `⚠️ @${normalizeJid(senderJid)} link tidak diizinkan di grup ini.`, mentions: [senderJid] })
                    return
                }
            }

            if (settings.filterEnabled && text) {
                const matchedWord = textMatchesFilter(text, settings.filterWords)
                if (matchedWord) {
                    const senderIsAdmin = await isGroupAdmin(sock, from, senderJid).catch(() => false)
                    if (!senderIsAdmin) {
                        try { await sock.sendMessage(from, { delete: msg.key }) } catch (e) {}
                        if (settings.filterMode === 'kick') {
                            const warnCount = addFilterWarn(from, senderJid)
                            await saveGroupSettings().catch(() => {})
                            if (warnCount >= FILTER_KICK_THRESHOLD) {
                                resetFilterWarn(from, senderJid)
                                await saveGroupSettings().catch(() => {})
                                try {
                                    await sock.groupParticipantsUpdate(from, [senderJid], 'remove')
                                    await sock.sendMessage(from, { text: `@${normalizeJid(senderJid)} Peringatan Telah Berkata Kasar Ke - ${warnCount}, Melebihi Batas ${FILTER_KICK_THRESHOLD}x maka akan di kick secara otomatis`, mentions: [senderJid] })
                                } catch (e) {
                                    await sock.sendMessage(from, { text: `⚠️ @${normalizeJid(senderJid)} sudah melanggar ${FILTER_KICK_THRESHOLD}x tapi bot gagal kick (pastikan bot admin).`, mentions: [senderJid] })
                                }
                            } else {
                                await sock.sendMessage(from, { text: `@${normalizeJid(senderJid)} Peringatan Telah Berkata Kasar Ke - ${warnCount}`, mentions: [senderJid] })
                            }
                        } else {
                            await sock.sendMessage(from, { text: `@${normalizeJid(senderJid)} Peringatan Telah Berkata Kasar`, mentions: [senderJid] })
                        }
                        return
                    }
                }
            }
            const hasPrefix = text.startsWith('.') || text.startsWith('#') || text.startsWith('!')
            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
            const botIdNorm = normalizeJid(sock.user?.id)
            const botLidNorm = normalizeJid(sock.user?.lid)
            const isMentioned = mentionedJids.some(j => {
                const jNorm = normalizeJid(j)
                return jNorm === botIdNorm || (botLidNorm && jNorm === botLidNorm)
            })
            if (!hasPrefix && !isMentioned) return
        }

        await sock.readMessages([msg.key])
        await sock.sendPresenceUpdate('composing', from)
        const quoteOpt = shouldQuote(msg) ? { quoted: msg } : {}

        try {
            if (text) {
                const hasPrefix = text.startsWith('.') || text.startsWith('#') || text.startsWith('!')
                if (hasPrefix) {
                    const cleanText = text.slice(1).trim()
                    const command = cleanText.split(' ')[0].toLowerCase()
                    const args = cleanText.split(' ').slice(1).join(' ')

                    if (command === 'help' || command === 'menu') {
                        const menuText = isOwner(msg.key) ? `${buildMenuText()}\n\n${buildOwnerMenuText()}` : buildMenuText()
                        await sock.sendMessage(from, { text: menuText })
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'menulist') {
                        // Percobaan list message (single_select) via modules/interactive.js.
                        // Terpisah dari .menu supaya .menu teks tetap aman kalau ini gagal.
                        // Catatan: hanya command tanpa argumen tambahan yang dimasukkan ke sini,
                        // karena tap dari list tidak bisa menyertakan teks lanjutan (lokasi, link, dst).
                        try {
                            await sendListMessage(sock, from, {
                                text: 'Pilih kategori menu di bawah ini',
                                footer: BOT_NAME,
                                buttonText: 'Lihat Menu',
                                sections: [
                                    {
                                        title: 'Sastra',
                                        rows: [
                                            { id: 'menu_cerpen', title: '.cerpen' },
                                            { id: 'menu_pantun', title: '.pantun' },
                                            { id: 'menu_puisi', title: '.puisi' }
                                        ]
                                    },
                                    {
                                        title: 'Inspirasi',
                                        rows: [
                                            { id: 'menu_motivasi', title: '.motivasi' },
                                            { id: 'menu_fakta', title: '.fakta' },
                                            { id: 'menu_renungan', title: '.renungan' },
                                            { id: 'menu_filosofis', title: '.filosofis' }
                                        ]
                                    }
                                ]
                            })
                        } catch (e) {
                            console.error('[bot:menulist] gagal kirim list message:', e?.message, e?.stack)
                            await sock.sendMessage(from, { text: '⚠️ List message gagal terkirim, lihat log error untuk detail.\n\nFallback ke .menu untuk versi teks.' })
                        }
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'testquick') {
                        // Percobaan quick_reply (tombol balasan cepat).
                        try {
                            await sendButtons(sock, from, {
                                text: 'Tes quick_reply: pilih salah satu tombol di bawah.',
                                footer: BOT_NAME,
                                buttons: [
                                    { id: 'qr_yes', text: 'Ya' },
                                    { id: 'qr_no', text: 'Tidak' }
                                ]
                            })
                        } catch (e) {
                            console.error('[bot:testquick] gagal:', e?.message, e?.stack)
                            await sock.sendMessage(from, { text: '⚠️ quick_reply gagal terkirim, lihat log error.' })
                        }
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'testurl') {
                        // Percobaan cta_url (tombol buka link).
                        try {
                            await sendInteractiveMessage(sock, from, {
                                text: 'Tes cta_url: tekan tombol untuk buka link.',
                                footer: BOT_NAME,
                                interactiveButtons: [
                                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Buka Google', url: 'https://www.google.com' }) }
                                ]
                            })
                        } catch (e) {
                            console.error('[bot:testurl] gagal:', e?.message, e?.stack)
                            await sock.sendMessage(from, { text: '⚠️ cta_url gagal terkirim, lihat log error.' })
                        }
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'testcopy') {
                        // Percobaan cta_copy (tombol salin teks/kode).
                        try {
                            await sendInteractiveMessage(sock, from, {
                                text: 'Tes cta_copy: tekan tombol untuk salin kode.',
                                footer: BOT_NAME,
                                interactiveButtons: [
                                    { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Salin Kode', copy_code: 'TEST123' }) }
                                ]
                            })
                        } catch (e) {
                            console.error('[bot:testcopy] gagal:', e?.message, e?.stack)
                            await sock.sendMessage(from, { text: '⚠️ cta_copy gagal terkirim, lihat log error.' })
                        }
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'testcall') {
                        // Percobaan cta_call (tombol tap untuk telepon).
                        try {
                            await sendInteractiveMessage(sock, from, {
                                text: 'Tes cta_call: tekan tombol untuk telepon.',
                                footer: BOT_NAME,
                                interactiveButtons: [
                                    { name: 'cta_call', buttonParamsJson: JSON.stringify({ display_text: 'Telepon', phone_number: '+6281234567890' }) }
                                ]
                            })
                        } catch (e) {
                            console.error('[bot:testcall] gagal:', e?.message, e?.stack)
                            await sock.sendMessage(from, { text: '⚠️ cta_call gagal terkirim, lihat log error.' })
                        }
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (PUBLIC_COMMANDS.includes(command)) {
                        await handlePublicCommand(sock, from, msg, command, args, quoteOpt)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (OWNER_COMMANDS.includes(command)) {
                        const realNum = msg.key.senderPn || msg.key.participantPn || msg.key.participantAlt || msg.key.remoteJidAlt || '(none)'
                        console.log(`[owner-check] command=${command} senderJid=${senderJid} realNumberJid=${realNum} isOwner=${isOwner(msg.key)}`)
                        if (!isOwner(msg.key)) { await sock.sendPresenceUpdate('paused', from); return }
                        handleOwnerCommand._postStatus = (type, cnt, bg) => postStatus(sock, type, cnt, bg)
                        handleOwnerCommand._getLastStatusKey = () => lastStatusKey
                        await handleOwnerCommand(sock, from, msg, command, args, quoteOpt)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'setppgroup') {
                        const isGroupChat = from?.endsWith('@g.us')
                        if (!isGroupChat) { await sock.sendMessage(from, { text: '⚠️ Perintah ini hanya bisa digunakan di dalam grup.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                        const senderIsAdmin = await isGroupAdmin(sock, from, senderJid).catch(() => false)
                        if (!senderIsAdmin) { await sock.sendMessage(from, { text: '🚫 Khusus admin grup ini.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                        const quotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
                        if (!quotedImage) { await sock.sendMessage(from, { text: '❌ Reply ke sebuah gambar dengan caption .setppgroup untuk mengganti foto grup.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                        try {
                            const fakeMsg = { message: msg.message.extendedTextMessage.contextInfo.quotedMessage, key: { remoteJid: from } }
                            const imgBuffer = await downloadMediaMessage(fakeMsg, 'buffer', {})
                            await sock.updateProfilePicture(from, imgBuffer)
                            await sock.sendMessage(from, { text: '✅ Foto grup berhasil diubah.' }, quoteOpt)
                        } catch (e) {
                            console.error('[bot:setppgroup] gagal:', e)
                            await sock.sendMessage(from, { text: '❌ Gagal mengubah foto grup. Pastikan bot admin dan gambar valid.' }, quoteOpt)
                        }
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (GROUP_ADMIN_COMMANDS.includes(command)) {
                        await handleGroupAdminCommand(sock, from, msg, command, args, quoteOpt, { cronJobs, saveCronJobs })
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'sticker' || command === 's') {
                        const done = await handleStickerFromQuoted(sock, from, msg, runQueuedTool, stickerQueue, imageToSticker, videoToSticker)
                        if (!done) await sock.sendMessage(from, { text: 'Reply gambar atau video dengan .sticker!' })
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'ts' || command === 'textsticker') {
                        const stickerText = args || 'Hello!'
                        await sock.sendMessage(from, { text: '⏳ Membuat sticker teks...' })
                        const stickerBuffer = await runQueuedTool(sock, from, msg.key, stickerQueue, 'sticker',
                            ({ registerKill }) => textToSticker(stickerText, (proc) => registerKill(() => proc.kill('SIGTERM'))))
                        if (stickerBuffer) await sock.sendMessage(from, { sticker: stickerBuffer })
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'cuaca' || command === 'weather') {
                        await runUnqueuedTool(
                            ({ signal }) => handleWeatherCommand(sock, from, args, msg, shouldQuote, signal))
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'gempaid') {
                        await sock.sendMessage(from, { text: '🌋 Mengambil data gempa...' })
                        const hasil = await runUnqueuedTool(
                            ({ signal }) => fetchGempaID(args.trim() || null, signal))
                        if (hasil) await sock.sendMessage(from, { text: hasil }, quoteOpt)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'gempa' || command === 'earthquake') {
                        const isID = command === 'gempa'
                        await sock.sendMessage(from, { text: isID ? '🌍 Mengambil data gempa...' : '🌍 Fetching earthquake data...' })
                        const hasil = await runUnqueuedTool(
                            ({ signal }) => isID
                                ? fetchGempaUSGS(args.trim() || null, signal)
                                : fetchEarthquakeUSGS(args.trim() || null, signal))
                        if (hasil) await sock.sendMessage(from, { text: hasil }, quoteOpt)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'cerpen') {
                        await sock.sendMessage(from, { text: getCerpenRandom() }, quoteOpt)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'pantun') {
                        await sock.sendMessage(from, { text: getPantunRandom() }, quoteOpt)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'puisi') {
                        await sock.sendMessage(from, { text: getPuisiRandom() }, quoteOpt)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'motivasi') {
                        await sock.sendMessage(from, { text: getMotivasiRandom() }, quoteOpt)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'fakta') {
                        await sock.sendMessage(from, { text: getFaktaRandom() }, quoteOpt)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'renungan') {
                        await sock.sendMessage(from, { text: getRenunganRandom() }, quoteOpt)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'filosofis') {
                        await sock.sendMessage(from, { text: getFilosofisRandom() }, quoteOpt)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'quiz') {
                        const q = getQuizRandom()
                        await sendButtons(sock, from, {
                            text: q.soal,
                            footer: BOT_NAME,
                            buttons: q.pilihan.map(p => ({ id: 'quiz_' + p.charAt(0), text: p }))
                        })
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'cdl') {
                        const task = userActiveTask[from]
                        if (!task || task.tool !== 'download') {
                            await sock.sendMessage(from, { text: '⚠️ Tidak ada download yang sedang berjalan.' })
                        } else {
                            const url = activeDownloads[from]?.url
                            cleanupDownload(from)
                            releaseActiveTask(from)
                            await sock.sendMessage(from, { text: `✅ Download dibatalkan${url ? `.\n🔗 ${url}` : '.'}` })
                        }
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'cp') {
                        const task = userActiveTask[from]
                        if (!task) {
                            await sock.sendMessage(from, { text: '⚠️ Tidak ada proses yang sedang berjalan.' })
                        } else if (task.tool === 'download') {
                            const url = activeDownloads[from]?.url
                            cleanupDownload(from)
                            releaseActiveTask(from)
                            await sock.sendMessage(from, { text: `✅ Download dibatalkan${url ? `.\n🔗 ${url}` : '.'}` })
                        } else {
                            const label = getActiveToolLabel(from)
                            task.cancel()
                            await sock.sendMessage(from, { text: `✅ Proses *${label}* dibatalkan.` })
                        }
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'dl') {
                        await runDownloadCommand(sock, from, msg, args, 'auto', '❌ Format: .dl [url]'); return
                    }

                    if (command === 'dytmp3') {
                        await runDownloadCommand(sock, from, msg, args, 'audio', '❌ Format: .dytmp3 [url]'); return
                    }

                    if (command === 'dytmp4') {
                        await runDownloadCommand(sock, from, msg, args, 'video', '❌ Format: .dytmp4 [url]'); return
                    }

                    if (command === 'dtt') {
                        await runDownloadCommand(sock, from, msg, args, 'video', '❌ Format: .dtt [url]'); return
                    }

                    if (command === 'sp') {
                        await runDownloadCommand(sock, from, msg, args, 'audio', '❌ Format: .sp [url]'); return
                    }

                    if (command === 'createimage' || command === 'ci') {
                        const prompt = args.trim()
                        if (!prompt) { await sock.sendMessage(from, { text: '❌ Format: .createimage [deskripsi gambar]\nContoh: .createimage sunset di tepi pantai tropis' }); await sock.sendPresenceUpdate('paused', from); return }
                        if (getValidProviders('image') === null) { await sock.sendMessage(from, { text: '⚠️ Fitur generate gambar belum dikonfigurasi. Isi provider image di ai.js terlebih dahulu.' }); await sock.sendPresenceUpdate('paused', from); return }
                        await sock.sendMessage(from, { text: '🎨 Membuat gambar...' })
                        const imgBuffer = await runQueuedTool(sock, from, msg.key, mediaGenQueue, 'mediaGen',
                            ({ signal }) => generateImage(prompt, signal))
                        if (!imgBuffer) { await sock.sendMessage(from, { text: '❌ Gagal generate gambar. Coba lagi nanti.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                        await sock.sendMessage(from, { image: imgBuffer, caption: `🖼️ ${prompt}` })
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'createvideo' || command === 'cv') {
                        const prompt = args.trim()
                        if (!prompt) { await sock.sendMessage(from, { text: '❌ Format: .createvideo [deskripsi video]\nContoh: .createvideo ombak laut yang tenang saat senja' }); await sock.sendPresenceUpdate('paused', from); return }
                        if (getValidProviders('video') === null) { await sock.sendMessage(from, { text: '⚠️ Fitur generate video belum dikonfigurasi. Isi provider video di ai.js terlebih dahulu.' }); await sock.sendPresenceUpdate('paused', from); return }
                        await sock.sendMessage(from, { text: '🎬 Membuat video...' })
                        const vidBuffer = await runQueuedTool(sock, from, msg.key, mediaGenQueue, 'mediaGen',
                            ({ signal }) => generateVideo(prompt, signal))
                        if (!vidBuffer) { await sock.sendMessage(from, { text: '❌ Gagal generate video. Coba lagi nanti.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                        await sock.sendMessage(from, { video: vidBuffer, caption: `🎬 ${prompt}` })
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'buatqr' || command === 'cqr' || command === 'createqr') {
                        const quotedContact = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.contactMessage
                        let input = args.trim()
                        let sourceLabel = ''

                        if (!input && quotedContact) {
                            input = buildVCard(quotedContact)
                            sourceLabel = 'Kontak'
                        }

                        if (!input) {
                            await sock.sendMessage(from, { text: '❌ Format: .buatqr [teks/url/email/telepon]\nKontak WhatsApp: .buatqr wa 6281234567890\nTelepon (dial): .buatqr call:6281234567890\nWiFi: .buatqr wifi:ssid=NAMA;pass=PASSWORD;type=WPA\nLokasi: .buatqr -6.2,106.8\nAtau reply ke sebuah kontak yang dibagikan dengan .buatqr' }, quoteOpt)
                            await sock.sendPresenceUpdate('paused', from); return
                        }

                        const detected = sourceLabel ? { type: sourceLabel, payload: input } : detectAndBuildPayload(input)
                        console.log(`[bot:buatqr] input="${input}" → type="${detected.type}" payload="${detected.payload}"`)
                        await sock.sendMessage(from, { text: `⏳ Membuat QR code (${detected.type})...` })
                        const qrBuffer = await runQueuedTool(sock, from, msg.key, mediaGenQueue, 'mediaGen',
                            ({ signal }) => generateQR(detected.payload, signal))
                        if (qrBuffer) await sock.sendMessage(from, { image: qrBuffer, caption: `✅ QR code berhasil dibuat (${detected.type})` }, quoteOpt)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'scanqr' || command === 'sqr') {
                        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
                        const urlArg = args.trim()
                        let qrBuffer = null

                        try {
                            if (quoted?.imageMessage) {
                                const fakeMsg = { message: quoted, key: { remoteJid: from } }
                                qrBuffer = await downloadMediaMessage(fakeMsg, 'buffer', {})
                            } else if (urlArg.startsWith('http')) {
                                await sock.sendMessage(from, { text: '⏳ Mengambil gambar...' })
                                const res = await fetch(urlArg, { signal: AbortSignal.timeout(15000) })
                                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                                qrBuffer = Buffer.from(await res.arrayBuffer())
                            }
                        } catch (e) {
                            console.error('[bot:scanqr] gagal mengambil gambar:', e?.message)
                            await sock.sendMessage(from, { text: '❌ Tidak bisa mengambil gambar tersebut. Pastikan URL valid dan bisa diakses publik.' }, quoteOpt)
                            await sock.sendPresenceUpdate('paused', from); return
                        }

                        if (!qrBuffer) {
                            await sock.sendMessage(from, { text: '❌ Reply ke gambar berisi QR code, kirim gambar dengan caption .scanqr, atau pakai .scanqr [url gambar]' }, quoteOpt)
                            await sock.sendPresenceUpdate('paused', from); return
                        }

                        if (qrBuffer.length > MAX_FILE_SIZE) {
                            await sock.sendMessage(from, { text: '⚠️ Gambar terlalu besar. Maksimal 20MB.' }, quoteOpt)
                            await sock.sendPresenceUpdate('paused', from); return
                        }

                        await sock.sendMessage(from, { text: '⏳ Men-scan QR code...' })
                        const decoded = await runQueuedTool(sock, from, msg.key, mediaGenQueue, 'mediaGen',
                            () => decodeQRFromBuffer(qrBuffer))

                        if (decoded === undefined) { await sock.sendPresenceUpdate('paused', from); return }
                        if (decoded === null) {
                            await sock.sendMessage(from, { text: '❌ Tidak ditemukan QR code pada gambar tersebut. Coba gambar yang lebih jelas atau lebih besar.' }, quoteOpt)
                        } else {
                            await sock.sendMessage(from, { text: `✅ *Isi QR Code:*\n\n${decoded}` }, quoteOpt)
                        }
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'settimezone') {
                        const tzUpper = args.toUpperCase()
                        const tz = TIMEZONE_MAP[tzUpper]
                        if (!tz) {
                            await sock.sendMessage(from, { text: `❌ Timezone tidak dikenal.\nTersedia: ${Object.keys(TIMEZONE_MAP).join(', ')}` })
                        } else {
                            userTimezones[from] = tz
                            fs.writeFileSync('./userTimezone.json', JSON.stringify(userTimezones, null, 2))
                            await sock.sendMessage(from, { text: `✅ Timezone kamu diset ke *${tzUpper}* (${tz})` })
                        }
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'cron') {
                        const subArgs = args.trim()
                        if (!subArgs || subArgs === 'list') {
                            const dynamicList = cronJobs.filter(j => j.jid === from && j.type === 'cron')
                            let listText = '📅 *Cron Jobs Aktif*\n\n'
                            if (CRON_STATIC.length > 0) listText += '*Statis:*\n' + CRON_STATIC.map((j, i) => `${i + 1}. ${j.name} — ${j.schedule}`).join('\n') + '\n\n'
                            if (dynamicList.length > 0) listText += '*Dinamis (kamu):*\n' + dynamicList.map((j, i) => `${i + 1}. ${j.schedule} — ${j.message}`).join('\n') + '\n\n💡 Hapus: .dcron [nomor] / .dcron all / .dcron'
                            if (CRON_STATIC.length === 0 && dynamicList.length === 0) listText += 'Belum ada cron job.'
                            await sock.sendMessage(from, { text: listText })
                            await sock.sendPresenceUpdate('paused', from); return
                        }

                        const creatorJid = msg.key.participant || msg.key.remoteJid
                        const userActiveCount = cronJobs.filter(j => j.type === 'cron' && j.creator === creatorJid).length
                        if (userActiveCount >= 5) {
                            await sock.sendMessage(from, { text: `❌ Kamu sudah punya ${userActiveCount} cron job aktif (maksimal 5). Hapus salah satu dulu dengan .dcron.` })
                            await sock.sendPresenceUpdate('paused', from); return
                        }
                        const match = subArgs.match(/^(\d{2}):(\d{2})\s+([A-Z]+)\s+(.+)/i)
                        if (!match) { await sock.sendMessage(from, { text: '❌ Format salah!\nContoh: .cron 07:00 WIB Selamat pagi!' }); await sock.sendPresenceUpdate('paused', from); return }
                        const tz = TIMEZONE_MAP[match[3].toUpperCase()]
                        if (!tz) { await sock.sendMessage(from, { text: `❌ Timezone *${match[3]}* tidak dikenal.` }); await sock.sendPresenceUpdate('paused', from); return }
                        const job = { type: 'cron', jid: from, creator: creatorJid, schedule: `${match[2]} ${match[1]} * * *`, timezone: tz, message: match[4] }
                        cronJobs.push(job)
                        await saveCronJobs()
                        scheduleDynamicCron(sock, job)
                        await sock.sendMessage(from, { text: `✅ Cron disimpan!\nJam: ${match[1]}:${match[2]} ${match[3].toUpperCase()}\nPesan: ${match[4]}` })
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'reminder') {
                        const subArgs = args.trim()
                        if (subArgs.toLowerCase() === 'list') {
                            const list = cronJobs.filter(j => j.jid === from && j.type === 'reminder')
                            let listText = '⏰ *Reminder Aktif*\n\n'
                            if (list.length > 0) {
                                listText += list.map((j, i) => {
                                    const tzKey = Object.keys(TIMEZONE_MAP).find(k => TIMEZONE_MAP[k] === j.timezone) || j.timezone
                                    const sendAtLocal = new Date(j.sendAt).toLocaleString('id-ID', { timeZone: j.timezone, dateStyle: 'short', timeStyle: 'short' })
                                    return `${i + 1}. ${sendAtLocal} ${tzKey} — ${j.message}`
                                }).join('\n') + '\n\n💡 Hapus: .dreminder [nomor] / .dreminder all / .dreminder'
                            } else { listText += 'Belum ada reminder.' }
                            await sock.sendMessage(from, { text: listText })
                            await sock.sendPresenceUpdate('paused', from); return
                        }
                        const match = args.match(/^(\d{2}):(\d{2})\s+([A-Z]+)\s+(.+)/i)
                        if (!match) { await sock.sendMessage(from, { text: '❌ Format salah!\nContoh: .reminder 09:00 WIB Minum obat!' }); await sock.sendPresenceUpdate('paused', from); return }
                        const hour = parseInt(match[1]); const minute = parseInt(match[2])
                        const tz = TIMEZONE_MAP[match[3].toUpperCase()]
                        if (!tz) { await sock.sendMessage(from, { text: `❌ Timezone *${match[3]}* tidak dikenal.` }); await sock.sendPresenceUpdate('paused', from); return }
                        const now = new Date()
                        const userNow = new Date(now.toLocaleString('en-US', { timeZone: tz }))
                        const sendAt = new Date(userNow)
                        sendAt.setHours(hour, minute, 0, 0)
                        if (sendAt <= userNow) sendAt.setDate(sendAt.getDate() + 1)
                        cronJobs.push({ type: 'reminder', jid: from, sendAt: sendAt.toISOString(), timezone: tz, message: match[4] })
                        await saveCronJobs()
                        await sock.sendMessage(from, { text: `✅ Reminder disimpan!\nJam: ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} ${match[3].toUpperCase()}\nPesan: ${match[4]}` })
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'dcron') {
                        const isGroupChat = from?.endsWith('@g.us')
                        if (isGroupChat) {
                            const senderJid = msg.key.participant || msg.key.remoteJid
                            const senderIsAdmin = await isGroupAdmin(sock, from, senderJid).catch(() => false)
                            if (!senderIsAdmin) { await sock.sendMessage(from, { text: '🚫 Hanya admin grup ini yang bisa menghapus cron job grup.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                        }
                        const target = args.trim().toLowerCase()
                        const list = cronJobs.filter(j => j.jid === from && j.type === 'cron')
                        if (!target || target === 'all') {
                            if (list.length === 0) { await sock.sendMessage(from, { text: '⚠️ Tidak ada cron job dinamis untuk dihapus.' }) }
                            else { for (const j of list) stopAndRemoveDynamicCron(j); cronJobs = cronJobs.filter(j => !(j.jid === from && j.type === 'cron')); await saveCronJobs(); await sock.sendMessage(from, { text: `✅ ${list.length} cron job berhasil dihapus semua.` }) }
                            await sock.sendPresenceUpdate('paused', from); return
                        }
                        const idx = parseInt(target) - 1
                        if (isNaN(idx) || idx < 0 || idx >= list.length) { await sock.sendMessage(from, { text: '❌ Nomor tidak valid. Lihat nomor yang benar dengan .cron list' }); await sock.sendPresenceUpdate('paused', from); return }
                        const target_job = list[idx]
                        stopAndRemoveDynamicCron(target_job)
                        cronJobs = cronJobs.filter(j => j !== target_job)
                        await saveCronJobs()
                        await sock.sendMessage(from, { text: `✅ Cron job "${target_job.message}" (${target_job.schedule}) berhasil dihapus.` })
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'dreminder') {
                        const isGroupChat = from?.endsWith('@g.us')
                        if (isGroupChat) {
                            const senderJid = msg.key.participant || msg.key.remoteJid
                            const senderIsAdmin = await isGroupAdmin(sock, from, senderJid).catch(() => false)
                            if (!senderIsAdmin) { await sock.sendMessage(from, { text: '🚫 Hanya admin grup ini yang bisa menghapus reminder grup.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                        }
                        const target = args.trim().toLowerCase()
                        const list = cronJobs.filter(j => j.jid === from && j.type === 'reminder')
                        if (!target || target === 'all') {
                            if (list.length === 0) { await sock.sendMessage(from, { text: '⚠️ Tidak ada reminder untuk dihapus.' }) }
                            else { cronJobs = cronJobs.filter(j => !(j.jid === from && j.type === 'reminder')); await saveCronJobs(); await sock.sendMessage(from, { text: `✅ ${list.length} reminder berhasil dihapus semua.` }) }
                            await sock.sendPresenceUpdate('paused', from); return
                        }
                        const idx = parseInt(target) - 1
                        if (isNaN(idx) || idx < 0 || idx >= list.length) { await sock.sendMessage(from, { text: '❌ Nomor tidak valid.' }); await sock.sendPresenceUpdate('paused', from); return }
                        const target_job = list[idx]
                        cronJobs = cronJobs.filter(j => j !== target_job)
                        await saveCronJobs()
                        await sock.sendMessage(from, { text: `✅ Reminder "${target_job.message}" berhasil dihapus.` })
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (command === 'poll') {
                        if (!args) { await sock.sendMessage(from, { text: 'Format: .poll Pertanyaan? Pilihan1, Pilihan2, Pilihan3' }); await sock.sendPresenceUpdate('paused', from); return }
                        let question, options
                        if (hasValidKeys()) {
                            const result = await callAI(from, `.poll ${args}`, null, null, '', BOT_NAME)
                            if (result && result.type === 'function' && result.name === 'send_poll') { question = result.args.question; options = result.args.options }
                            else { const parsed = parseLocalPoll(args); if (parsed) { question = parsed.question; options = parsed.options } }
                        } else {
                            const parsed = parseLocalPoll(args); if (parsed) { question = parsed.question; options = parsed.options }
                        }
                        if (!question || !options || options.length < 2) { await sock.sendMessage(from, { text: 'Format: .poll Pertanyaan? Pilihan1, Pilihan2, Pilihan3' }); await sock.sendPresenceUpdate('paused', from); return }
                        await executePoll(sock, from, question, options)
                        await sock.sendPresenceUpdate('paused', from); return
                    }

                    if (hasValidKeys()) {
                        const result = await callAI(from, text, null, null, '', BOT_NAME)

                        if (result) {
                            if (result.type === 'function') await handleFunctionResult(sock, from, msg, result, text)
                            else { const sentMsg = await sock.sendMessage(from, { text: result.text }, quoteOpt); setLastBotMsg(from, sentMsg.key) }
                            await sock.sendPresenceUpdate('paused', from); return
                        }
                    }

                    await sock.sendMessage(from, { text: '⚠️ Perintah tidak dikenal. Ketik .menu untuk lihat daftar perintah.' })
                    await sock.sendPresenceUpdate('paused', from); return
                }
            }

            if (msgType === 'stickerMessage') {
                await handleStickerMessage(sock, from, msg, runQueuedTool, stickerQueue, callAI, handleFunctionResult, hasValidKeys, setLastBotMsg, quoteOpt)
                await sock.sendPresenceUpdate('paused', from); return
            }

            if (msgType === 'imageMessage') {
                const mime = msg.message.imageMessage.mimetype || ''
                const caption = msg.message.imageMessage.caption || ''
                const fileSize = getFileSizeFromMsg(msg, msgType)
                if (mime && !validateMime(mime, ALLOWED_IMAGE_MIME)) { await sock.sendMessage(from, { text: '⚠️ Format gambar tidak didukung.' }); await sock.sendPresenceUpdate('paused', from); return }
                if (fileSize > MAX_FILE_SIZE) { await sock.sendMessage(from, { text: `⚠️ Gambar terlalu besar (${(fileSize/1024/1024).toFixed(1)}MB). Maksimal 20MB.` }); await sock.sendPresenceUpdate('paused', from); return }

                const captionTrimmed = caption.trim()
                const hasCommandPrefix = captionTrimmed.startsWith('.') || captionTrimmed.startsWith('#') || captionTrimmed.startsWith('!')
                const captionCommand = hasCommandPrefix ? captionTrimmed.slice(1).split(/\s+/)[0]?.toLowerCase() : ''
                if (captionCommand === 'setppgroup') {
                    const isGroupChat = from?.endsWith('@g.us')
                    if (!isGroupChat) { await sock.sendMessage(from, { text: '⚠️ Perintah ini hanya bisa digunakan di dalam grup.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                    const senderIsAdmin = await isGroupAdmin(sock, from, senderJid).catch(() => false)
                    if (!senderIsAdmin) { await sock.sendMessage(from, { text: '🚫 Khusus admin grup ini.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                    try {
                        const imgBuffer = await downloadMediaMessage(msg, 'buffer', {})
                        await sock.updateProfilePicture(from, imgBuffer)
                        await sock.sendMessage(from, { text: '✅ Foto grup berhasil diubah.' }, quoteOpt)
                    } catch (e) {
                        console.error('[bot:setppgroup] gagal (caption langsung):', e)
                        await sock.sendMessage(from, { text: '❌ Gagal mengubah foto grup. Pastikan bot admin dan gambar valid.' }, quoteOpt)
                    }
                    await sock.sendPresenceUpdate('paused', from); return
                }
                if (captionCommand === 'scanqr' || captionCommand === 'sqr') {
                    const qrBuffer = await downloadMediaMessage(msg, 'buffer', {})
                    if (qrBuffer.length > MAX_FILE_SIZE) { await sock.sendMessage(from, { text: '⚠️ Gambar terlalu besar. Maksimal 20MB.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                    await sock.sendMessage(from, { text: '⏳ Men-scan QR code...' })
                    const decoded = await runQueuedTool(sock, from, msg.key, mediaGenQueue, 'mediaGen',
                        () => decodeQRFromBuffer(qrBuffer))
                    if (decoded === undefined) { await sock.sendPresenceUpdate('paused', from); return }
                    if (decoded === null) {
                        await sock.sendMessage(from, { text: '❌ Tidak ditemukan QR code pada gambar tersebut. Coba gambar yang lebih jelas atau lebih besar.' }, quoteOpt)
                    } else {
                        await sock.sendMessage(from, { text: `✅ *Isi QR Code:*\n\n${decoded}` }, quoteOpt)
                    }
                    await sock.sendPresenceUpdate('paused', from); return
                }
                if (caption.toLowerCase().includes('sticker') || caption.toLowerCase().includes('stiker')) {
                    await handleImageStickerCaption(sock, from, msg, runQueuedTool, stickerQueue, imageToSticker)
                    await sock.sendPresenceUpdate('paused', from); return
                }
                if (!hasValidKeys()) { await sock.sendMessage(from, { text: '⚠️ AI sedang tidak tersedia. Kirim dengan caption "sticker" untuk membuat sticker.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                await sock.sendMessage(from, { text: '⏳ Menganalisis gambar...' })
                const imgBuffer = await downloadMediaMessage(msg, 'buffer', {})
                if (imgBuffer.length > MAX_FILE_SIZE) { await sock.sendMessage(from, { text: '⚠️ Gambar terlalu besar setelah diunduh. Maksimal 20MB.' }); await sock.sendPresenceUpdate('paused', from); return }
                const base64 = imgBuffer.toString('base64')
                const result = await callAI(from, caption || 'Deskripsikan isi gambar ini secara detail dalam bahasa Indonesia', base64, mime || 'image/jpeg', '', BOT_NAME)

                if (!result) { await sock.sendMessage(from, { text: '⚠️ AI tidak tersedia. Kirim dengan caption "sticker" untuk membuat sticker.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                if (result.type === 'function') {

                    if (result.name === 'react_message' && !result.args.reply) {
                        const retry = await callAI(from, 'Deskripsikan isi gambar ini secara detail dalam bahasa Indonesia', base64, mime || 'image/jpeg', '', BOT_NAME)
                        if (retry && retry.type === 'text') {
                            const sentMsg = await sock.sendMessage(from, { text: retry.text }, quoteOpt)
                            setLastBotMsg(from, sentMsg.key)
                        }
                    } else {
                        await handleFunctionResult(sock, from, msg, result, caption || '[gambar]')
                    }
                }
                else { const sentMsg = await sock.sendMessage(from, { text: result.text }, quoteOpt); setLastBotMsg(from, sentMsg.key) }
                await sock.sendPresenceUpdate('paused', from); return
            }

            if (msgType === 'videoMessage') {
                const mime = msg.message.videoMessage.mimetype || ''
                const caption = msg.message.videoMessage.caption || ''
                const fileSize = getFileSizeFromMsg(msg, msgType)
                if (mime && !validateMime(mime, ALLOWED_VIDEO_MIME)) { await sock.sendMessage(from, { text: '⚠️ Format video tidak didukung.' }); await sock.sendPresenceUpdate('paused', from); return }
                if (fileSize > MAX_FILE_SIZE) { await sock.sendMessage(from, { text: `⚠️ Video terlalu besar (${(fileSize/1024/1024).toFixed(1)}MB). Maksimal 20MB.` }); await sock.sendPresenceUpdate('paused', from); return }
                if (!hasValidKeys()) {
                    if (caption.toLowerCase().includes('sticker')) {
                        await sock.sendMessage(from, { text: '⏳ Membuat sticker dari video...' })
                        const videoBuf = await downloadMediaMessage(msg, 'buffer', {})
                        const stickerBuffer = await runQueuedTool(sock, from, msg.key, stickerQueue, 'sticker',
                            ({ registerKill }) => videoToSticker(videoBuf, (proc) => registerKill(() => proc.kill('SIGTERM'))))
                        if (stickerBuffer) await sock.sendMessage(from, { sticker: stickerBuffer })
                    } else { await sock.sendMessage(from, { text: '⚠️ AI sedang tidak tersedia. Kirim dengan caption "sticker" untuk buat sticker dari video.' }, quoteOpt) }
                    await sock.sendPresenceUpdate('paused', from); return
                }
                await sock.sendMessage(from, { text: '⏳ Menganalisis video...' })
                const videoBuffer = await downloadMediaMessage(msg, 'buffer', {})
                if (videoBuffer.length > MAX_FILE_SIZE) { await sock.sendMessage(from, { text: '⚠️ Video terlalu besar setelah diunduh. Maksimal 20MB.' }); await sock.sendPresenceUpdate('paused', from); return }
                const base64 = videoBuffer.toString('base64')
                const result = await callAI(from, caption || 'Deskripsikan isi video ini secara detail dalam bahasa Indonesia', base64, mime || 'video/mp4', '', BOT_NAME)

                if (!result) {
                    if (caption.toLowerCase().includes('sticker')) {
                        await sock.sendMessage(from, { text: '⏳ Membuat sticker dari video...' })
                        const stickerBuffer = await runQueuedTool(sock, from, msg.key, stickerQueue, 'sticker',
                            ({ registerKill }) => videoToSticker(videoBuffer, (proc) => registerKill(() => proc.kill('SIGTERM'))))
                        if (stickerBuffer) await sock.sendMessage(from, { sticker: stickerBuffer })
                    } else { await sock.sendMessage(from, { text: '⚠️ AI tidak tersedia. Kirim dengan caption "sticker" untuk buat sticker dari video.' }, quoteOpt) }
                    await sock.sendPresenceUpdate('paused', from); return
                }
                if (result.type === 'function') {
                    if (result.name === 'react_message' && !result.args.reply) {
                        const retry = await callAI(from, 'Deskripsikan isi video ini secara detail dalam bahasa Indonesia', base64, mime || 'video/mp4', '', BOT_NAME)
                        if (retry && retry.type === 'text') {
                            const sentMsg = await sock.sendMessage(from, { text: retry.text }, quoteOpt)
                            setLastBotMsg(from, sentMsg.key)
                        }
                    } else {
                        await handleFunctionResult(sock, from, msg, result, caption || '[video]')
                    }
                }
                else { const sentMsg = await sock.sendMessage(from, { text: result.text }, quoteOpt); setLastBotMsg(from, sentMsg.key) }
                await sock.sendPresenceUpdate('paused', from); return
            }

            if (msgType === 'documentMessage') {
                const mime = msg.message.documentMessage.mimetype || ''
                const fileName = msg.message.documentMessage.fileName || 'dokumen'
                const fileSize = getFileSizeFromMsg(msg, msgType)
                if (mime && !validateMime(mime, ALLOWED_DOC_MIME)) { await sock.sendMessage(from, { text: `⚠️ Format dokumen "${fileName}" tidak didukung.` }); await sock.sendPresenceUpdate('paused', from); return }
                if (fileSize > MAX_FILE_SIZE) { await sock.sendMessage(from, { text: `⚠️ Dokumen terlalu besar (${(fileSize/1024/1024).toFixed(1)}MB). Maksimal 20MB.` }); await sock.sendPresenceUpdate('paused', from); return }
                await sock.sendMessage(from, { text: `⏳ Membaca dokumen ${fileName}...` })
                const docBuffer = await downloadMediaMessage(msg, 'buffer', {})
                const base64 = docBuffer.toString('base64')
                const result = await callAI(from, `Ini adalah dokumen "${fileName}". Analisis dan rangkum isinya secara detail dalam bahasa Indonesia.`, base64, mime || 'application/pdf', '', BOT_NAME)

                if (!result) { await sock.sendMessage(from, { text: '⚠️ AI tidak tersedia. Tidak bisa membaca dokumen saat ini.' }, quoteOpt); await sock.sendPresenceUpdate('paused', from); return }
                if (result.type === 'function') {
                    if (result.name === 'react_message' && !result.args.reply) {
                        const retry = await callAI(from, `Ini adalah dokumen "${fileName}". Analisis dan rangkum isinya secara detail dalam bahasa Indonesia.`, base64, mime || 'application/pdf', '', BOT_NAME)
                        if (retry && retry.type === 'text') {
                            const sentMsg = await sock.sendMessage(from, { text: retry.text }, quoteOpt)
                            setLastBotMsg(from, sentMsg.key)
                        }
                    } else {
                        await handleFunctionResult(sock, from, msg, result, `[dokumen: ${fileName}]`)
                    }
                } else {
                    const sentMsg = await sock.sendMessage(from, { text: result.text }, quoteOpt); setLastBotMsg(from, sentMsg.key)
                }
                await sock.sendPresenceUpdate('paused', from); return
            }

            if (msgType === 'audioMessage') {
                const mime = msg.message.audioMessage.mimetype || ''
                const fileSize = getFileSizeFromMsg(msg, msgType)
                if (mime && !validateMime(mime, ALLOWED_AUDIO_MIME)) { await sock.sendMessage(from, { text: '⚠️ Format audio tidak didukung.' }); await sock.sendPresenceUpdate('paused', from); return }
                if (fileSize > MAX_FILE_SIZE) { await sock.sendMessage(from, { text: `⚠️ Audio terlalu besar (${(fileSize/1024/1024).toFixed(1)}MB). Maksimal 20MB.` }); await sock.sendPresenceUpdate('paused', from); return }
                await sock.sendPresenceUpdate('recording', from)
                const audioBuffer = await downloadMediaMessage(msg, 'buffer', {})
                const base64 = audioBuffer.toString('base64')
                const result = await callAI(from, 'Transkripsi pesan suara ini lalu berikan respons yang sesuai dalam bahasa Indonesia', base64, mime || 'audio/ogg; codecs=opus', '', BOT_NAME)

                if (!result) { await sock.sendMessage(from, { text: '⚠️ AI tidak tersedia. Tidak bisa transkripsi voice note saat ini.' }); await sock.sendPresenceUpdate('paused', from); return }
                if (result.type === 'function') {
                    if (result.name === 'react_message' && !result.args.reply) {
                        const retry = await callAI(from, 'Transkripsi pesan suara ini lalu berikan respons yang sesuai dalam bahasa Indonesia', base64, mime || 'audio/ogg; codecs=opus', '', BOT_NAME)
                        if (retry && retry.type === 'text') {
                            const sentMsg = await sock.sendMessage(from, { text: retry.text }, quoteOpt)
                            setLastBotMsg(from, sentMsg.key)
                        }
                    } else {
                        await handleFunctionResult(sock, from, msg, result, '[audio]')
                    }
                } else {
                    const sentMsg = await sock.sendMessage(from, { text: result.text || 'Tidak dapat memproses audio' }, quoteOpt); setLastBotMsg(from, sentMsg.key)
                }
                await sock.sendPresenceUpdate('paused', from); return
            }

            if (!text) return

            if (!hasValidKeys()) { await handleLocalFallback(sock, from, msg, text, msgType); await sock.sendPresenceUpdate('paused', from); return }

            const result = await callAI(from, text, null, null, '', BOT_NAME)

            if (!result) { await handleLocalFallback(sock, from, msg, text, msgType); await sock.sendPresenceUpdate('paused', from); return }

            if (result.type === 'function') { await handleFunctionResult(sock, from, msg, result, text) }
            else { const sentMsg = await sock.sendMessage(from, { text: result.text }, quoteOpt); setLastBotMsg(from, sentMsg.key) }

            await sock.sendPresenceUpdate('paused', from)

        } catch(e) {
            console.error('[bot:message-handler] Error tak terduga:', e)
            await sock.sendMessage(from, { text: '❌ Terjadi error saat memproses pesan. Coba lagi beberapa saat.' })
            await sock.sendPresenceUpdate('paused', from)
        }
    })
}

process.on('uncaughtException', (err) => {
    console.log(`🔥 [uncaughtException] ${new Date().toISOString()}`)
    console.log('Message:', err?.message)
    console.log('Stack:', err?.stack)

    const transient = ['ECONNRESET','ETIMEDOUT','ENOTFOUND','EPIPE','forbidden']
    if (transient.some(t => err?.message?.includes(t))) {
        console.log('⚠️ Error transient/koneksi, bot tetap berjalan.')
        return
    }
    console.log('⚠️ Error tidak dikenal, tetap dipertahankan hidup (tidak exit) — pantau log di atas untuk debug lebih lanjut.')
})

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || String(reason)
    console.log(`🔥 [unhandledRejection] ${new Date().toISOString()}`)
    console.log('Reason:', msg)
    console.log('Stack:', reason?.stack)
    const transient = ['ECONNRESET','ETIMEDOUT','ENOTFOUND','EPIPE','forbidden']
    if (transient.some(t => msg.includes(t))) {
        console.log('⚠️ Rejection transient/koneksi, bot tetap berjalan.')
        return
    }
    console.log('⚠️ Rejection tidak dikenal, tetap dipertahankan hidup (tidak exit) — pantau log di atas untuk debug lebih lanjut.')
})

startBot()

