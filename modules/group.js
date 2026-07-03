'use strict'

const fs = require('fs')

const DEBUG = process.env.DEBUG === '1'
function dlog(...a) { if (DEBUG) console.log(...a) }

const DEFAULT_GROUP_SETTINGS = {
    welcomeEnabled: true,
    welcomeText: 'Selamat datang @user di grup *@group*! 🎉\nSemoga betah ya~\n\n👥 Total anggota: *@total*\n📅 Masuk: @tanggal, @jam',
    leaveEnabled: true,
    leaveText: '👋 @user telah meninggalkan grup *@group*.\n\n👥 Sisa anggota: *@total*\n📅 Keluar: @tanggal, @jam',
    antilinkEnabled: false,
    filterEnabled: false,
    filterMode: 'warn',
    filterWords: [],
    filterWarnCounts: {}
}

const MAX_FILTER_WORDS = 100

const FILTER_KICK_THRESHOLD = 3

let groupSettings = fs.existsSync('./groupSettings.json')
    ? JSON.parse(fs.readFileSync('./groupSettings.json', 'utf-8')) : {}

let groupSettingsSaveLock = false

function normalizeJid(jid) {
    if (!jid) return jid
    return jid.split('@')[0].split(':')[0]
}

function getGroupSettings(groupJid) {
    if (!groupSettings[groupJid]) {
        groupSettings[groupJid] = { ...DEFAULT_GROUP_SETTINGS }
    }
    return { ...DEFAULT_GROUP_SETTINGS, ...groupSettings[groupJid] }
}

async function saveGroupSettings() {
    if (groupSettingsSaveLock) return
    groupSettingsSaveLock = true
    try {
        fs.writeFileSync('./groupSettings.json', JSON.stringify(groupSettings, null, 2))
    } finally {
        groupSettingsSaveLock = false
    }
}

function setGroupSetting(groupJid, partial) {
    const current = getGroupSettings(groupJid)
    groupSettings[groupJid] = { ...current, ...partial }
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function textMatchesFilter(text, filterWords) {
    if (!text || !filterWords || filterWords.length === 0) return null
    for (const word of filterWords) {
        const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i')
        if (pattern.test(text)) return word
    }
    return null
}

function addFilterWords(groupJid, words) {
    const settings = getGroupSettings(groupJid)
    const current = new Set(settings.filterWords.map(w => w.toLowerCase()))
    const added = []
    const skipped = []
    for (const raw of words) {
        const w = raw.trim().toLowerCase()
        if (!w) continue
        if (current.has(w)) { skipped.push(w); continue }
        if (current.size + added.length >= MAX_FILTER_WORDS) { skipped.push(w); continue }
        current.add(w)
        added.push(w)
    }
    setGroupSetting(groupJid, { filterWords: Array.from(current) })
    return { added, skipped }
}

function delFilterWords(groupJid, words) {
    const settings = getGroupSettings(groupJid)
    const current = new Set(settings.filterWords.map(w => w.toLowerCase()))
    const removed = []
    const notFound = []
    for (const raw of words) {
        const w = raw.trim().toLowerCase()
        if (!w) continue
        if (current.has(w)) { current.delete(w); removed.push(w) }
        else notFound.push(w)
    }
    setGroupSetting(groupJid, { filterWords: Array.from(current) })
    return { removed, notFound }
}

function addFilterWarn(groupJid, userJid) {
    const settings = getGroupSettings(groupJid)
    const key = normalizeJid(userJid)
    const counts = { ...settings.filterWarnCounts }
    counts[key] = (counts[key] || 0) + 1
    setGroupSetting(groupJid, { filterWarnCounts: counts })
    return counts[key]
}

function resetFilterWarn(groupJid, userJid) {
    const settings = getGroupSettings(groupJid)
    const key = normalizeJid(userJid)
    const counts = { ...settings.filterWarnCounts }
    delete counts[key]
    setGroupSetting(groupJid, { filterWarnCounts: counts })
}

async function getFreshGroupMetadata(sock, groupJid) {
    const t0 = Date.now()
    try {
        const metadata = await sock.groupMetadata(groupJid)
        dlog(`[group-debug] groupMetadata OK for ${groupJid} in ${Date.now() - t0}ms, participants=${metadata?.participants?.length}`)
        return metadata
    } catch (e) {
        dlog(`[group-debug] groupMetadata FAILED for ${groupJid} after ${Date.now() - t0}ms:`, e?.message, e?.stack)
        throw e
    }
}

async function isGroupAdmin(sock, groupJid, userJid) {
    const metadata = await getFreshGroupMetadata(sock, groupJid)
    const targetId = normalizeJid(userJid)
    const participant = metadata.participants.find(p => normalizeJid(p.id) === targetId)
    dlog(`[group-debug] isGroupAdmin check targetId=${targetId} found=${!!participant} admin=${participant?.admin}`)
    if (!participant) return false
    return participant.admin === 'admin' || participant.admin === 'superadmin'
}

function isBotNumberJid(sock, jid) {
    const botId = normalizeJid(sock.user?.id)
    return normalizeJid(jid) === botId
}

async function validateAdminAction(sock, groupJid, senderJid, { requireBotAdmin = true } = {}) {
    const tStart = Date.now()
    if (!groupJid?.endsWith('@g.us')) {
        return { ok: false, reason: '⚠️ Perintah ini hanya bisa digunakan di dalam grup.' }
    }
    dlog(`[group-debug] validateAdminAction start groupJid=${groupJid} senderJid=${senderJid} sock.user.id=${sock.user?.id} sock.user.lid=${sock.user?.lid}`)
    const metadata = await getFreshGroupMetadata(sock, groupJid)
    dlog('[group-debug] all participant ids:', JSON.stringify(metadata.participants.map(p => ({ id: p.id, jid: p.jid, lid: p.lid, admin: p.admin }))))

    const senderId = normalizeJid(senderJid)
    const senderParticipant = metadata.participants.find(p => normalizeJid(p.id) === senderId)
    const senderIsAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin'
    dlog(`[group-debug] sender match: senderId=${senderId} found=${!!senderParticipant} admin=${senderParticipant?.admin} senderIsAdmin=${senderIsAdmin}`)

    if (!senderIsAdmin) {
        dlog(`[group-debug] REJECT: sender not admin. Total time ${Date.now() - tStart}ms`)
        return { ok: false, reason: '🚫 Khusus admin grup ini. Status admin kamu di grup lain tidak berlaku di sini.', metadata }
    }

    if (requireBotAdmin) {
        const botId = normalizeJid(sock.user?.id)
        const botLid = normalizeJid(sock.user?.lid)
        const botParticipant = metadata.participants.find(p => normalizeJid(p.id) === botId || normalizeJid(p.id) === botLid || normalizeJid(p.phoneNumber) === botId)
        const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin'
        dlog(`[group-debug] bot match: botId=${botId} botLid=${botLid} found=${!!botParticipant} matchedEntry=${JSON.stringify(botParticipant)} botIsAdmin=${botIsAdmin}`)
        if (!botIsAdmin) {
            dlog(`[group-debug] REJECT: bot not admin. Total time ${Date.now() - tStart}ms`)
            return { ok: false, reason: '⚠️ Bot harus dijadikan admin grup dulu untuk menjalankan perintah ini.', metadata }
        }
    }

    dlog(`[group-debug] validateAdminAction OK. Total time ${Date.now() - tStart}ms`)
    return { ok: true, metadata }
}

function getMentionedOrQuotedJid(msg) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (mentioned.length > 0) return mentioned
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant
    if (quotedParticipant) return [quotedParticipant]
    return []
}

function renderGroupTemplate(template, { userJid, groupName, totalMembers, timestamp }) {
    const userTag = '@' + normalizeJid(userJid)
    const ts = timestamp || new Date()
    const tanggal = ts.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    const jam = ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
    return template
        .replace(/@user/g, userTag)
        .replace(/@group/g, groupName || 'grup ini')
        .replace(/@total/g, totalMembers != null ? String(totalMembers) : '-')
        .replace(/@tanggal/g, tanggal)
        .replace(/@jam/g, jam)
}

async function fetchProfilePicSafe(sock, jid) {
    const t0 = Date.now()
    try {
        const ppUrl = await Promise.race([
            sock.profilePictureUrl(jid, 'image'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('profilePictureUrl timeout 4000ms')), 4000))
        ])
        dlog(`[group-debug] profilePictureUrl OK for ${jid} in ${Date.now() - t0}ms`)
        return ppUrl
    } catch (e) {
        dlog(`[group-debug] profilePictureUrl FAILED/timeout for ${jid} after ${Date.now() - t0}ms:`, e?.message)
        return null
    }
}

async function sendGroupGreeting(sock, groupJid, userJid, template, groupName, extra = {}) {
    const t0 = Date.now()
    const caption = renderGroupTemplate(template, { userJid, groupName, totalMembers: extra.totalMembers, timestamp: extra.timestamp })
    console.log(`[greeting] render selesai untuk ${userJid} di ${groupJid}, caption length=${caption.length}`)
    const ppUrl = await fetchProfilePicSafe(sock, userJid)
    console.log(`[greeting] fetchProfilePicSafe selesai (${Date.now() - t0}ms total), ppUrl=${ppUrl ? 'ADA' : 'TIDAK ADA'}`)
    const mentions = [userJid]
    if (ppUrl) {
        try {
            const tSend = Date.now()
            await sock.sendMessage(groupJid, { image: { url: ppUrl }, caption, mentions })
            console.log(`[greeting] sendMessage (dengan foto) sukses dalam ${Date.now() - tSend}ms, total ${Date.now() - t0}ms`)
            return
        } catch (e) {
            console.log(`[greeting] sendMessage dengan foto GAGAL: ${e?.message}, fallback ke teks saja`)
        }
    }
    const tSend = Date.now()
    await sock.sendMessage(groupJid, { text: caption, mentions })
    console.log(`[greeting] sendMessage (teks saja) sukses dalam ${Date.now() - tSend}ms, total ${Date.now() - t0}ms`)
}

const GROUP_ADMIN_COMMANDS = [
    'groupstats',
    'kick', 'remove', 'add', 'promote', 'demote', 'mute', 'close', 'unmute', 'open',
    'lock', 'unlock', 'tagall', 'everyone', 'groupinfo', 'infogrup',
    'antilink', 'welcome', 'setwelcome', 'setleave', 'resetwelcome', 'leave',
    'filter', 'addfilter', 'delfilter', 'listfilter', 'clearfilter', 'resetwarn',
    'setname', 'setdesc', 'setppgroup', 'addmode', 'ephemeral',
    'getlink', 'resetlink', 'joinrequest', 'approve', 'reject',
    'communitycreate', 'communitylink', 'communityunlink', 'joinmode'
]

async function handleGroupAdminCommand(sock, from, msg, command, args, quoteOpt, { cronJobs, saveCronJobs } = {}) {
    const senderJid = msg.key.participant || msg.key.remoteJid

    const NO_BOT_ADMIN_NEEDED = [
        'groupstats', 'antilink', 'setwelcome', 'setleave', 'welcome', 'leave', 'resetwelcome', 'tagall', 'everyone', 'groupinfo', 'infogrup',
        'filter', 'addfilter', 'delfilter', 'listfilter', 'clearfilter', 'resetwarn',
        'communitycreate'
    ]
    // ─── GROUPSTATS ─────────────────────────────────────────────────────────
    // .groupstats boleh dipakai SEMUA member, tidak perlu admin & tidak perlu
    // bot jadi admin. Langsung dispatch ke modul groupStats, skip validasi.
    if (command === 'groupstats') {
        const { handleGroupStatsCommand } = require('./groupStats')
        await handleGroupStatsCommand(sock, from, msg, quoteOpt)
        return
    }

    const requireBotAdmin = !NO_BOT_ADMIN_NEEDED.includes(command)

    const validation = await validateAdminAction(sock, from, senderJid, { requireBotAdmin })
    if (!validation.ok) {
        await sock.sendMessage(from, { text: validation.reason }, quoteOpt)
        return
    }
    const metadata = validation.metadata
    const groupName = metadata.subject

    if (command === 'kick' || command === 'remove') {
        const targets = getMentionedOrQuotedJid(msg)
        if (targets.length === 0) {
            await sock.sendMessage(from, { text: '❌ Tag atau reply pesan orang yang mau dikeluarkan.\nContoh: .kick @user' }, quoteOpt)
            return
        }
        const filtered = targets.filter(t => !isBotNumberJid(sock, t))
        if (filtered.length === 0) {
            await sock.sendMessage(from, { text: '⚠️ Bot tidak bisa mengeluarkan dirinya sendiri.' }, quoteOpt)
            return
        }
        await sock.groupParticipantsUpdate(from, filtered, 'remove')
        await sock.sendMessage(from, { text: `✅ ${filtered.length} anggota berhasil dikeluarkan dari grup.` }, quoteOpt)
        return
    }

    if (command === 'add') {
        const raw = args.trim()
        if (!raw) {
            await sock.sendMessage(from, { text: '❌ Format: .add 62xxxxxxxxxx\nBisa lebih dari satu, pisahkan dengan spasi atau koma.\nContoh: .add 6281220104010 6281234567890' }, quoteOpt)
            return
        }
        const numbers = raw.split(/[\s,]+/).map(n => n.replace(/[^0-9]/g, '')).filter(Boolean)
        if (numbers.length === 0) {
            await sock.sendMessage(from, { text: '❌ Nomor tidak valid. Gunakan format 62xxxxxxxxxx.' }, quoteOpt)
            return
        }
        const invalid = numbers.filter(n => n.length < 8 || n.startsWith('0'))
        if (invalid.length > 0) {
            await sock.sendMessage(from, { text: `❌ Nomor harus diawali kode negara (contoh: 62 untuk Indonesia), bukan 0.\nTidak valid: ${invalid.join(', ')}` }, quoteOpt)
            return
        }
        const jids = numbers.map(n => n + '@s.whatsapp.net')

        let validJids = jids
        try {
            const checks = await sock.onWhatsApp(...jids)
            const existingSet = new Set((checks || []).filter(c => c.exists).map(c => c.jid))
            const notRegistered = jids.filter(j => !existingSet.has(j))
            validJids = jids.filter(j => existingSet.has(j))
            if (notRegistered.length > 0) {
                const notRegNums = notRegistered.map(j => normalizeJid(j)).join(', ')
                await sock.sendMessage(from, { text: `⚠️ Nomor tidak terdaftar di WhatsApp, dilewati: ${notRegNums}` }, quoteOpt)
            }
            if (validJids.length === 0) return
        } catch (e) {
            console.error('[group:add] onWhatsApp check gagal, lanjut tanpa validasi:', e?.message)
        }

        try {
            const result = await sock.groupParticipantsUpdate(from, validJids, 'add')
            const lines = (result || []).map(r => {
                const num = normalizeJid(r.jid)
                if (r.status === '200') return `✅ +${num} berhasil ditambahkan.`
                if (r.status === '403') return `⚠️ +${num} tidak bisa ditambahkan langsung (privasi), undangan dikirim lewat link jika tersedia.`
                if (r.status === '408') return `⚠️ +${num} sudah ada di grup atau tidak merespon.`
                return `❌ +${num} gagal ditambahkan (status ${r.status}).`
            })
            await sock.sendMessage(from, { text: lines.length ? lines.join('\n') : '⚠️ Tidak ada respons dari WhatsApp untuk permintaan ini.' }, quoteOpt)
        } catch (e) {
            console.error('[group:add] groupParticipantsUpdate gagal:', e)
            await sock.sendMessage(from, { text: '❌ Gagal menambahkan anggota. Coba lagi beberapa saat.' }, quoteOpt)
        }
        return
    }

    if (command === 'promote') {
        const targets = getMentionedOrQuotedJid(msg)
        if (targets.length === 0) {
            await sock.sendMessage(from, { text: '❌ Tag atau reply pesan orang yang mau dijadikan admin.\nContoh: .promote @user' }, quoteOpt)
            return
        }
        await sock.groupParticipantsUpdate(from, targets, 'promote')
        await sock.sendMessage(from, { text: `✅ ${targets.length} anggota berhasil dijadikan admin.` }, quoteOpt)
        return
    }

    if (command === 'demote') {
        const targets = getMentionedOrQuotedJid(msg)
        if (targets.length === 0) {
            await sock.sendMessage(from, { text: '❌ Tag atau reply pesan admin yang mau diturunkan.\nContoh: .demote @user' }, quoteOpt)
            return
        }
        await sock.groupParticipantsUpdate(from, targets, 'demote')
        await sock.sendMessage(from, { text: `✅ ${targets.length} admin berhasil diturunkan jadi member.` }, quoteOpt)
        return
    }

    if (command === 'mute' || command === 'close') {
        await sock.groupSettingUpdate(from, 'announcement')
        const hoursArg = parseFloat(args.trim())
        if (cronJobs) {
            const filtered = cronJobs.filter(j => !(j.type === 'unmute' && j.jid === from))
            cronJobs.length = 0; filtered.forEach(j => cronJobs.push(j))
        }
        if (!args.trim() || isNaN(hoursArg) || hoursArg <= 0) {
            if (saveCronJobs) await saveCronJobs()
            await sock.sendMessage(from, { text: '🔇 Grup dikunci. Hanya admin yang bisa kirim pesan.\n\n💡 Tips: .mute [jam] untuk auto-unmute, contoh: .mute 3' }, quoteOpt)
            return
        }
        const unmuteAt = new Date(Date.now() + hoursArg * 60 * 60 * 1000)
        if (cronJobs) cronJobs.push({ type: 'unmute', jid: from, unmuteAt: unmuteAt.toISOString() })
        if (saveCronJobs) await saveCronJobs()
        const jamText = hoursArg === 1 ? '1 jam' : `${hoursArg} jam`
        await sock.sendMessage(from, { text: `🔇 Grup dikunci selama *${jamText}*. Hanya admin yang bisa kirim pesan.\nAkan terbuka otomatis sekitar ${unmuteAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })} WIB.` }, quoteOpt)
        return
    }

    if (command === 'unmute' || command === 'open') {
        await sock.groupSettingUpdate(from, 'not_announcement')
        if (cronJobs) {
            const hadScheduled = cronJobs.some(j => j.type === 'unmute' && j.jid === from)
            const filtered = cronJobs.filter(j => !(j.type === 'unmute' && j.jid === from))
            cronJobs.length = 0; filtered.forEach(j => cronJobs.push(j))
            if (hadScheduled && saveCronJobs) await saveCronJobs()
        }
        await sock.sendMessage(from, { text: '🔊 Grup dibuka. Semua anggota bisa kirim pesan.' }, quoteOpt)
        return
    }

    if (command === 'lock') {
        await sock.groupSettingUpdate(from, 'locked')
        await sock.sendMessage(from, { text: '🔒 Pengaturan grup dikunci. Hanya admin yang bisa ubah info grup.' }, quoteOpt)
        return
    }

    if (command === 'unlock') {
        await sock.groupSettingUpdate(from, 'unlocked')
        await sock.sendMessage(from, { text: '🔓 Pengaturan grup dibuka. Semua anggota bisa ubah info grup.' }, quoteOpt)
        return
    }

    if (command === 'tagall' || command === 'everyone') {
        const allJids = metadata.participants.map(p => p.id)
        const listText = metadata.participants.map(p => `• @${normalizeJid(p.id)}`).join('\n')
        const caption = (args ? `📢 ${args}\n\n` : '📢 *Tag semua anggota grup*\n\n') + listText
        await sock.sendMessage(from, { text: caption, mentions: allJids }, quoteOpt)
        return
    }

    if (command === 'groupinfo' || command === 'infogrup') {
        const adminCount = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').length
        const info = `📋 *Info Grup*\n\n` +
            `Nama: ${metadata.subject}\n` +
            `Jumlah anggota: ${metadata.participants.length}\n` +
            `Jumlah admin: ${adminCount}\n` +
            `Mode kirim: ${metadata.announce ? 'Hanya admin (terkunci)' : 'Semua anggota'}\n` +
            `Pengaturan grup: ${metadata.restrict ? 'Hanya admin yang bisa ubah' : 'Semua anggota bisa ubah'}`
        await sock.sendMessage(from, { text: info }, quoteOpt)
        return
    }

    if (command === 'antilink') {
        const mode = args.trim().toLowerCase()
        if (mode !== 'on' && mode !== 'off') {
            const settings = getGroupSettings(from)
            await sock.sendMessage(from, { text: `🔗 Antilink saat ini: *${settings.antilinkEnabled ? 'ON' : 'OFF'}*\nGunakan: .antilink on atau .antilink off` }, quoteOpt)
            return
        }
        setGroupSetting(from, { antilinkEnabled: mode === 'on' })
        await saveGroupSettings()
        await sock.sendMessage(from, { text: `✅ Antilink diset ke *${mode.toUpperCase()}*.` }, quoteOpt)
        return
    }

    if (command === 'welcome') {
        const mode = args.trim().toLowerCase()
        if (mode !== 'on' && mode !== 'off') {
            const settings = getGroupSettings(from)
            await sock.sendMessage(from, { text: `👋 Welcome message saat ini: *${settings.welcomeEnabled ? 'ON' : 'OFF'}*\nGunakan: .welcome on atau .welcome off` }, quoteOpt)
            return
        }
        setGroupSetting(from, { welcomeEnabled: mode === 'on' })
        await saveGroupSettings()
        await sock.sendMessage(from, { text: `✅ Welcome message diset ke *${mode.toUpperCase()}*.` }, quoteOpt)
        return
    }

    if (command === 'leave') {
        const mode = args.trim().toLowerCase()
        if (mode !== 'on' && mode !== 'off') {
            const settings = getGroupSettings(from)
            await sock.sendMessage(from, { text: `👋 Leave message saat ini: *${settings.leaveEnabled ? 'ON' : 'OFF'}*\nGunakan: .leave on atau .leave off` }, quoteOpt)
            return
        }
        setGroupSetting(from, { leaveEnabled: mode === 'on' })
        await saveGroupSettings()
        await sock.sendMessage(from, { text: `✅ Leave message diset ke *${mode.toUpperCase()}*.` }, quoteOpt)
        return
    }

    if (command === 'setwelcome') {
        if (!args.trim()) {
            await sock.sendMessage(from, { text: '❌ Format: .setwelcome [teks]\nPlaceholder: @user (mention member), @group (nama grup), @total (jumlah anggota), @tanggal, @jam\nContoh: .setwelcome Halo @user, selamat datang di @group! Total member: @total' }, quoteOpt)
            return
        }
        setGroupSetting(from, { welcomeText: args, welcomeEnabled: true })
        await saveGroupSettings()
        const metadata = await getFreshGroupMetadata(sock, from)
        const totalMembers = metadata?.participants?.length
        await sock.sendMessage(from, { text: '✅ Teks welcome berhasil disimpan dan welcome diaktifkan.\n\nPreview:\n' + renderGroupTemplate(args, { userJid: senderJid, groupName, totalMembers }) }, quoteOpt)
        return
    }

    if (command === 'setleave') {
        if (!args.trim()) {
            await sock.sendMessage(from, { text: '❌ Format: .setleave [teks]\nPlaceholder: @user, @group, @total (jumlah anggota), @tanggal, @jam\nContoh: .setleave @user telah pergi dari @group. Sisa member: @total' }, quoteOpt)
            return
        }
        setGroupSetting(from, { leaveText: args, leaveEnabled: true })
        await saveGroupSettings()
        const metadata = await getFreshGroupMetadata(sock, from)
        const totalMembers = metadata?.participants?.length
        await sock.sendMessage(from, { text: '✅ Teks leave berhasil disimpan dan leave message diaktifkan.\n\nPreview:\n' + renderGroupTemplate(args, { userJid: senderJid, groupName, totalMembers }) }, quoteOpt)
        return
    }

    if (command === 'resetwelcome') {
        setGroupSetting(from, { welcomeText: DEFAULT_GROUP_SETTINGS.welcomeText, leaveText: DEFAULT_GROUP_SETTINGS.leaveText })
        await saveGroupSettings()
        await sock.sendMessage(from, { text: '✅ Teks welcome & leave dikembalikan ke default.' }, quoteOpt)
        return
    }

    if (command === 'filter') {
        const sub = args.trim().toLowerCase()
        const settings = getGroupSettings(from)
        if (sub === 'on' || sub === 'off') {
            setGroupSetting(from, { filterEnabled: sub === 'on' })
            await saveGroupSettings()
            await sock.sendMessage(from, { text: `✅ Filter kata kunci diset ke *${sub.toUpperCase()}*.` }, quoteOpt)
            return
        }
        if (sub.startsWith('mode')) {
            const mode = sub.replace('mode', '').trim()
            if (mode !== 'warn' && mode !== 'kick') {
                await sock.sendMessage(from, { text: '❌ Mode harus *warn* atau *kick*.\nContoh: .filter mode kick' }, quoteOpt)
                return
            }
            setGroupSetting(from, { filterMode: mode })
            await saveGroupSettings()
            const modeDesc = mode === 'kick' ? `hapus pesan + warning, auto-kick di pelanggaran ke-${FILTER_KICK_THRESHOLD}` : 'hapus pesan + warning saja (tanpa kick)'
            await sock.sendMessage(from, { text: `✅ Mode filter diset ke *${mode.toUpperCase()}* (${modeDesc}).` }, quoteOpt)
            return
        }
        await sock.sendMessage(from, {
            text: `🔍 Filter kata kunci saat ini: *${settings.filterEnabled ? 'ON' : 'OFF'}*\nMode: *${settings.filterMode.toUpperCase()}*\nJumlah kata: ${settings.filterWords.length}/${MAX_FILTER_WORDS}\n\nGunakan:\n.filter on / .filter off\n.filter mode warn / .filter mode kick`
        }, quoteOpt)
        return
    }

    if (command === 'addfilter') {
        if (!args.trim()) {
            await sock.sendMessage(from, { text: '❌ Format: .addfilter kata1, kata2, kata3' }, quoteOpt)
            return
        }
        const words = args.split(',').map(w => w.trim()).filter(Boolean)
        const { added, skipped } = addFilterWords(from, words)
        await saveGroupSettings()
        let text = ''
        if (added.length) text += `✅ Ditambahkan: ${added.join(', ')}\n`
        if (skipped.length) text += `⚠️ Dilewati (sudah ada / batas ${MAX_FILTER_WORDS} kata tercapai): ${skipped.join(', ')}`
        await sock.sendMessage(from, { text: text.trim() || '⚠️ Tidak ada kata yang ditambahkan.' }, quoteOpt)
        return
    }

    if (command === 'delfilter') {
        if (!args.trim()) {
            await sock.sendMessage(from, { text: '❌ Format: .delfilter kata1, kata2' }, quoteOpt)
            return
        }
        const words = args.split(',').map(w => w.trim()).filter(Boolean)
        const { removed, notFound } = delFilterWords(from, words)
        await saveGroupSettings()
        let text = ''
        if (removed.length) text += `✅ Dihapus: ${removed.join(', ')}\n`
        if (notFound.length) text += `⚠️ Tidak ditemukan di daftar: ${notFound.join(', ')}`
        await sock.sendMessage(from, { text: text.trim() || '⚠️ Tidak ada kata yang dihapus.' }, quoteOpt)
        return
    }

    if (command === 'listfilter') {
        const settings = getGroupSettings(from)
        if (settings.filterWords.length === 0) {
            await sock.sendMessage(from, { text: '📋 Daftar filter kosong. Tambah dengan .addfilter kata1, kata2' }, quoteOpt)
            return
        }
        const list = settings.filterWords.map((w, i) => `${i + 1}. ${w}`).join('\n')
        await sock.sendMessage(from, { text: `📋 *Daftar kata filter* (${settings.filterWords.length}/${MAX_FILTER_WORDS}):\n${list}` }, quoteOpt)
        return
    }

    if (command === 'clearfilter') {
        setGroupSetting(from, { filterWords: [] })
        await saveGroupSettings()
        await sock.sendMessage(from, { text: '✅ Semua kata filter telah dihapus.' }, quoteOpt)
        return
    }

    if (command === 'resetwarn') {
        const targets = getMentionedOrQuotedJid(msg)
        if (targets.length === 0) {
            await sock.sendMessage(from, { text: '❌ Tag atau reply pesan orang yang mau direset warning-nya.\nContoh: .resetwarn @user' }, quoteOpt)
            return
        }
        targets.forEach(t => resetFilterWarn(from, t))
        await saveGroupSettings()
        await sock.sendMessage(from, { text: `✅ Warning filter untuk ${targets.length} orang telah direset.` }, quoteOpt)
        return
    }

    if (command === 'setname') {
        if (!args.trim()) {
            await sock.sendMessage(from, { text: '❌ Format: .setname [nama baru grup]' }, quoteOpt)
            return
        }
        try {
            await sock.groupUpdateSubject(from, args.trim())
            await sock.sendMessage(from, { text: `✅ Nama grup diubah menjadi *${args.trim()}*.` }, quoteOpt)
        } catch (e) {
            console.error('[group:setname] gagal:', e)
            await sock.sendMessage(from, { text: '❌ Gagal mengubah nama grup. Coba lagi beberapa saat.' }, quoteOpt)
        }
        return
    }

    if (command === 'setdesc') {
        if (!args.trim()) {
            await sock.sendMessage(from, { text: '❌ Format: .setdesc [deskripsi baru grup]' }, quoteOpt)
            return
        }
        try {
            await sock.groupUpdateDescription(from, args.trim())
            await sock.sendMessage(from, { text: '✅ Deskripsi grup berhasil diubah.' }, quoteOpt)
        } catch (e) {
            console.error('[group:setdesc] gagal:', e)
            await sock.sendMessage(from, { text: '❌ Gagal mengubah deskripsi grup. Coba lagi beberapa saat.' }, quoteOpt)
        }
        return
    }

    if (command === 'setppgroup') {

        await sock.sendMessage(from, { text: '⚠️ Terjadi kesalahan internal saat memproses gambar.' }, quoteOpt)
        return
    }

    if (command === 'addmode') {
        const mode = args.trim().toLowerCase()
        if (mode !== 'admin' && mode !== 'all') {
            await sock.sendMessage(from, { text: '❌ Format: .addmode admin atau .addmode all\n\nadmin = hanya admin yang bisa nambah anggota\nall = semua anggota bisa nambah anggota' }, quoteOpt)
            return
        }
        try {
            await sock.groupMemberAddMode(from, mode === 'admin' ? 'admin_add' : 'all_member_add')
            await sock.sendMessage(from, { text: `✅ Mode tambah anggota diset ke *${mode === 'admin' ? 'hanya admin' : 'semua anggota'}*.` }, quoteOpt)
        } catch (e) {
            console.error('[group:addmode] gagal:', e)
            await sock.sendMessage(from, { text: '❌ Gagal mengubah mode tambah anggota. Coba lagi beberapa saat.' }, quoteOpt)
        }
        return
    }

    if (command === 'ephemeral') {
        const mode = args.trim().toLowerCase()
        const map = { '24h': 86400, '7d': 604800, '90d': 7776000, 'off': 0 }
        if (!(mode in map)) {
            await sock.sendMessage(from, { text: '❌ Format: .ephemeral 24h / 7d / 90d / off' }, quoteOpt)
            return
        }
        try {
            await sock.groupToggleEphemeral(from, map[mode])
            await sock.sendMessage(from, { text: mode === 'off' ? '✅ Disappearing messages dimatikan.' : `✅ Disappearing messages diset ke *${mode}*.` }, quoteOpt)
        } catch (e) {
            console.error('[group:ephemeral] gagal:', e)
            await sock.sendMessage(from, { text: '❌ Gagal mengubah disappearing messages. Coba lagi beberapa saat.' }, quoteOpt)
        }
        return
    }

    if (command === 'getlink') {
        try {
            const code = await sock.groupInviteCode(from)
            await sock.sendMessage(from, { text: `🔗 Link grup:\nhttps://chat.whatsapp.com/${code}` }, quoteOpt)
        } catch (e) {
            console.error('[group:getlink] gagal:', e)
            await sock.sendMessage(from, { text: '❌ Gagal mengambil link grup. Coba lagi beberapa saat.' }, quoteOpt)
        }
        return
    }

    if (command === 'resetlink') {
        try {
            const code = await sock.groupRevokeInvite(from)
            await sock.sendMessage(from, { text: `✅ Link lama tidak berlaku lagi.\n\n🔗 Link baru:\nhttps://chat.whatsapp.com/${code}` }, quoteOpt)
        } catch (e) {
            console.error('[group:resetlink] gagal:', e)
            await sock.sendMessage(from, { text: '❌ Gagal reset link grup. Coba lagi beberapa saat.' }, quoteOpt)
        }
        return
    }

    if (command === 'joinrequest') {
        try {
            const list = await sock.groupRequestParticipantsList(from)
            if (!list || list.length === 0) {
                await sock.sendMessage(from, { text: '📋 Tidak ada permintaan bergabung yang menunggu saat ini.' }, quoteOpt)
                return
            }
            const lines = list.map((r, i) => `${i + 1}. @${normalizeJid(r.jid)}`).join('\n')
            await sock.sendMessage(from, {
                text: `📋 *Permintaan bergabung* (${list.length}):\n${lines}\n\nGunakan .approve @user atau .reject @user, atau .approve all / .reject all`,
                mentions: list.map(r => r.jid)
            }, quoteOpt)
        } catch (e) {
            console.error('[group:joinrequest] gagal:', e)
            await sock.sendMessage(from, { text: '❌ Gagal mengambil daftar permintaan bergabung. Coba lagi beberapa saat.' }, quoteOpt)
        }
        return
    }

    if (command === 'approve' || command === 'reject') {
        const action = command === 'approve' ? 'approve' : 'reject'
        const actionLabel = action === 'approve' ? 'disetujui' : 'ditolak'
        try {
            let targets
            if (args.trim().toLowerCase() === 'all') {
                const list = await sock.groupRequestParticipantsList(from)
                targets = (list || []).map(r => r.jid)
                if (targets.length === 0) {
                    await sock.sendMessage(from, { text: '📋 Tidak ada permintaan bergabung yang menunggu saat ini.' }, quoteOpt)
                    return
                }
            } else {
                targets = getMentionedOrQuotedJid(msg)
                if (targets.length === 0) {
                    await sock.sendMessage(from, { text: `❌ Tag orang yang mau di-${actionLabel}, atau pakai .${command} all untuk semua.\nContoh: .${command} @user` }, quoteOpt)
                    return
                }
            }
            await sock.groupRequestParticipantsUpdate(from, targets, action)
            await sock.sendMessage(from, { text: `✅ ${targets.length} permintaan bergabung berhasil ${actionLabel}.` }, quoteOpt)
        } catch (e) {
            console.error(`[group:${command}] gagal:`, e)
            await sock.sendMessage(from, { text: `❌ Gagal memproses permintaan bergabung. Coba lagi beberapa saat.` }, quoteOpt)
        }
        return
    }

    // ─── COMMUNITYCREATE ────────────────────────────────────────────────────
    // Membuat komunitas BARU. Tidak terikat ke grup tempat command ini
    // diketik — grup ini hanya dipakai sebagai "tempat ngetik command", isi
    // komunitasnya kosong (belum ada grup yang ter-link) sampai .communitylink
    // dipakai dari grup yang mau dimasukkan. API: communityCreate(subject, body)
    // — body adalah deskripsi komunitas, kita kosongkan saja secara default.
    if (command === 'communitycreate') {
        const nama = args.trim()
        if (!nama) {
            await sock.sendMessage(from, { text: '❌ Format: .communitycreate [nama]\nContoh: .communitycreate Komunitas Pecinta Kopi' }, quoteOpt)
            return
        }
        try {
            const community = await sock.communityCreate(nama, '')
            if (!community || !community.id) {
                await sock.sendMessage(from, { text: '❌ Gagal membuat komunitas. Coba lagi beberapa saat.' }, quoteOpt)
                return
            }
            await sock.sendMessage(from, { text: `🎉 Komunitas *${nama}* berhasil dibuat.\n🆔 ${community.id}\n\nGunakan .communitylink ${community.id} di grup yang mau dimasukkan ke komunitas ini.` }, quoteOpt)
        } catch (e) {
            console.error('[group:communitycreate] gagal:', e)
            await sock.sendMessage(from, { text: '❌ Gagal membuat komunitas. Coba lagi beberapa saat.' }, quoteOpt)
        }
        return
    }

    // ─── COMMUNITYLINK ──────────────────────────────────────────────────────
    // Link GRUP INI (from) ke komunitas yang JID-nya diberikan di argumen.
    // API: communityLinkGroup(groupJid, parentCommunityJid)
    if (command === 'communitylink') {
        const raw = args.trim()
        if (!raw) {
            await sock.sendMessage(from, { text: '❌ Format: .communitylink [community_id]\nContoh: .communitylink 120363012345678901@g.us\n\n💡 community_id didapat dari hasil .communitycreate.' }, quoteOpt)
            return
        }
        const communityJid = raw.includes('@') ? raw : `${raw}@g.us`
        try {
            await sock.communityLinkGroup(from, communityJid)
            await sock.sendMessage(from, { text: `✅ Grup ini berhasil di-link ke komunitas.\n🆔 ${communityJid}` }, quoteOpt)
        } catch (e) {
            console.error('[group:communitylink] gagal:', e)
            await sock.sendMessage(from, { text: '❌ Gagal link grup ke komunitas. Pastikan community_id benar dan bot adalah admin di komunitas tersebut.' }, quoteOpt)
        }
        return
    }

    // ─── COMMUNITYUNLINK ────────────────────────────────────────────────────
    // Unlink GRUP INI dari komunitas yang sedang menaunginya. metadata.linkedParent
    // berisi JID komunitas yang sedang menaungi grup ini (kosong/undefined
    // kalau grup ini tidak tergabung di komunitas manapun).
    // API: communityUnlinkGroup(groupJid, parentCommunityJid)
    if (command === 'communityunlink') {
        const communityJid = metadata.linkedParent
        if (!communityJid) {
            await sock.sendMessage(from, { text: 'ℹ️ Grup ini tidak sedang tergabung di komunitas manapun.' }, quoteOpt)
            return
        }
        try {
            await sock.communityUnlinkGroup(from, communityJid)
            await sock.sendMessage(from, { text: `✅ Grup ini berhasil di-unlink dari komunitas.\n🆔 ${communityJid}` }, quoteOpt)
        } catch (e) {
            console.error('[group:communityunlink] gagal:', e)
            await sock.sendMessage(from, { text: '❌ Gagal unlink grup dari komunitas. Coba lagi beberapa saat.' }, quoteOpt)
        }
        return
    }

    // ─── JOINMODE ───────────────────────────────────────────────────────────
    // Toggle approval wajib buat join grup ini. API: groupJoinApprovalMode(jid, mode)
    if (command === 'joinmode') {
        const mode = args.trim().toLowerCase()
        if (mode !== 'on' && mode !== 'off') {
            const currentlyOn = !!metadata.joinApprovalMode
            await sock.sendMessage(from, { text: `🔐 Mode approval join saat ini: *${currentlyOn ? 'ON' : 'OFF'}*\nGunakan: .joinmode on atau .joinmode off` }, quoteOpt)
            return
        }
        try {
            await sock.groupJoinApprovalMode(from, mode)
            await sock.sendMessage(from, { text: mode === 'on'
                ? '✅ Approval wajib untuk join grup diaktifkan. Permintaan join baru perlu di-approve admin (lihat .joinrequest).'
                : '✅ Approval wajib untuk join grup dimatikan. Orang bisa join langsung lewat link tanpa approval.' }, quoteOpt)
        } catch (e) {
            console.error('[group:joinmode] gagal:', e)
            await sock.sendMessage(from, { text: '❌ Gagal mengubah mode approval join. Coba lagi beberapa saat.' }, quoteOpt)
        }
        return
    }
}


module.exports = {
    GROUP_ADMIN_COMMANDS,
    DEFAULT_GROUP_SETTINGS,
    MAX_FILTER_WORDS,
    FILTER_KICK_THRESHOLD,
    normalizeJid,
    getGroupSettings,
    setGroupSetting,
    saveGroupSettings,
    getFreshGroupMetadata,
    isGroupAdmin,
    isBotNumberJid,
    validateAdminAction,
    getMentionedOrQuotedJid,
    renderGroupTemplate,
    sendGroupGreeting,
    textMatchesFilter,
    addFilterWarn,
    resetFilterWarn,
    handleGroupAdminCommand
}
