'use strict'

const fs = require('fs')

const OWNER_NUMBERS = ['6285333332505']

const OWNER_COMMANDS = ['broadcast', 'groupbroadcast', 'send', 'stats', 'ban', 'unban', 'status', 'dstatus', 'bio', 'pp', 'creategroup', 'joingroup', 'leavegroup', 'setbio', 'setbotname', 'block', 'unblock', 'businessinfo', 'maintenance', 'listgroups', 'leaveall', 'leaveinactive', 'addme']

let bannedUsers = fs.existsSync('./bannedUsers.json')
    ? JSON.parse(fs.readFileSync('./bannedUsers.json', 'utf-8')) : []

let knownUsers = fs.existsSync('./knownUsers.json')
    ? JSON.parse(fs.readFileSync('./knownUsers.json', 'utf-8')) : []

let knownUsersFirstSeen = fs.existsSync('./knownUsersFirstSeen.json')
    ? JSON.parse(fs.readFileSync('./knownUsersFirstSeen.json', 'utf-8')) : {}

{
    const validKnownUsers = knownUsers.filter(num => typeof num === 'string' && num.length >= 8 && /^\d+$/.test(num))
    if (validKnownUsers.length !== knownUsers.length) {
        console.log(`[owner-cleanup] membersihkan ${knownUsers.length - validKnownUsers.length} entri knownUsers yang tidak valid`)
        knownUsers = validKnownUsers
        fs.writeFileSync('./knownUsers.json', JSON.stringify(knownUsers, null, 2))
    }
}

let bannedSaveLock = false
let knownUsersSaveLock = false
let knownUsersFirstSeenSaveLock = false

let maintenanceMode = false

function isMaintenanceMode() { return maintenanceMode }

const botStats = {
    startTime: Date.now(),
    totalRequests: 0
}

const MIN_VALID_PHONE_LENGTH = 8

function normalizeNumber(jidOrNumber) {
    if (!jidOrNumber) return ''
    const digits = jidOrNumber.split('@')[0].split(':')[0].replace(/\D/g, '')
    return digits.length >= MIN_VALID_PHONE_LENGTH ? digits : ''
}

function extractSenderNumber(msgKeyOrJid) {
    if (!msgKeyOrJid) return ''
    if (typeof msgKeyOrJid === 'string') return normalizeNumber(msgKeyOrJid)

    const key = msgKeyOrJid
    
    
    const realNumberJid = key.senderPn || key.participantPn || key.participantAlt || key.remoteJidAlt
    if (realNumberJid) return normalizeNumber(realNumberJid)

    return normalizeNumber(key.participant || key.remoteJid)
}

function isOwner(senderJidOrKey) {
    const num = extractSenderNumber(senderJidOrKey)
    return num !== '' && OWNER_NUMBERS.includes(num)
}

function resolveTargetJid(msg, args) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (mentioned.length > 0) return mentioned[0]

    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant
    if (quotedParticipant) return quotedParticipant

    const num = normalizeNumber((args || '').trim())
    if (num) return `${num}@s.whatsapp.net`

    return ''
}

function isBanned(senderJidOrKey) {
    const num = extractSenderNumber(senderJidOrKey)
    return bannedUsers.includes(num)
}

async function saveBannedUsers() {
    if (bannedSaveLock) return
    bannedSaveLock = true
    try {
        fs.writeFileSync('./bannedUsers.json', JSON.stringify(bannedUsers, null, 2))
    } finally {
        bannedSaveLock = false
    }
}

async function saveKnownUsers() {
    if (knownUsersSaveLock) return
    knownUsersSaveLock = true
    try {
        fs.writeFileSync('./knownUsers.json', JSON.stringify(knownUsers, null, 2))
    } finally {
        knownUsersSaveLock = false
    }
}

async function saveKnownUsersFirstSeen() {
    if (knownUsersFirstSeenSaveLock) return
    knownUsersFirstSeenSaveLock = true
    try {
        fs.writeFileSync('./knownUsersFirstSeen.json', JSON.stringify(knownUsersFirstSeen, null, 2))
    } finally {
        knownUsersFirstSeenSaveLock = false
    }
}

async function recordFirstSeen(msgKeyOrJid) {
    const num = extractSenderNumber(msgKeyOrJid)
    if (!num || knownUsersFirstSeen[num]) return
    knownUsersFirstSeen[num] = new Date().toISOString()
    await saveKnownUsersFirstSeen()
}

function getFirstSeen(msgKeyOrJid) {
    const num = extractSenderNumber(msgKeyOrJid)
    if (!num) return null
    return knownUsersFirstSeen[num] || null
}

async function recordKnownUser(msgKeyOrJid) {
    const num = extractSenderNumber(msgKeyOrJid)
    if (!num || knownUsers.includes(num)) return
    knownUsers.push(num)
    await saveKnownUsers()
}

function incrementRequestCount() {
    botStats.totalRequests++
}

function formatUptime(ms) {
    const totalSec = Math.floor(ms / 1000)
    const days = Math.floor(totalSec / 86400)
    const hours = Math.floor((totalSec % 86400) / 3600)
    const minutes = Math.floor((totalSec % 3600) / 60)
    const seconds = totalSec % 60
    const parts = []
    if (days > 0) parts.push(`${days}h`)
    if (hours > 0) parts.push(`${hours}j`)
    if (minutes > 0) parts.push(`${minutes}m`)
    parts.push(`${seconds}d`)
    return parts.join(' ')
}

async function handleBroadcastCommand(sock, from, args, quoteOpt) {
    const pesan = args.trim()
    if (!pesan) {
        await sock.sendMessage(from, { text: '❌ Format: .broadcast [pesan]\nContoh: .broadcast Bot akan maintenance jam 22:00 nanti ya!' }, quoteOpt)
        return
    }
    if (knownUsers.length === 0) {
        await sock.sendMessage(from, { text: '📭 Belum ada user tercatat untuk broadcast. Daftar ini terisi otomatis seiring user mengirim pesan privat ke bot.' }, quoteOpt)
        return
    }
    await sock.sendMessage(from, { text: `📤 Memulai broadcast ke ${knownUsers.length} user...` }, quoteOpt)
    let success = 0, failed = 0
    for (const num of knownUsers) {
        const jid = `${num}@s.whatsapp.net`
        try {
            await sock.sendMessage(jid, { text: `📢 *Pengumuman*\n\n${pesan}` })
            success++
        } catch (e) {
            failed++
            console.log(`[owner-broadcast] gagal kirim ke ${num}:`, e?.message)
        }
        await new Promise(r => setTimeout(r, 2000))
    }
    await sock.sendMessage(from, { text: `✅ Broadcast user selesai.\nBerhasil: ${success}\nGagal: ${failed}` })
}

function parseSendArgs(args) {
    const trimmed = args.trim()
    const nMatch = trimmed.match(/n-\s*([\s\S]*?)(?=\s+t-|$)/)
    const tMatch = trimmed.match(/t-\s*([\s\S]*?)(?=\s+n-|$)/)

    const rawNumbers = nMatch ? nMatch[1].trim() : ''
    const pesan = tMatch ? tMatch[1].trim() : ''

    const numbers = rawNumbers
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(tok => {
            let digits = tok.replace(/^\+/, '').replace(/[.,-]/g, '')
            if (digits.startsWith('08')) digits = '62' + digits.slice(1)
            return digits
        })
        .filter(digits => /^[1-9]\d+$/.test(digits) && digits.length >= MIN_VALID_PHONE_LENGTH && digits.length <= 15)

    return { pesan, numbers }
}

async function handleSendCommand(sock, from, args, quoteOpt) {
    const { pesan, numbers } = parseSendArgs(args)

    if (!pesan || numbers.length === 0) {
        await sock.sendMessage(from, {
            text: '❌ Format: .send n- [nomor1] [nomor2] ... t- [pesan]\nContoh: .send n- 6281234567890 6280987654321 t- hai apa kabar\n\nn- diikuti daftar nomor (boleh dipisah spasi atau koma). Boleh 08xxx (otomatis dianggap nomor seluler Indonesia, jadi 62xxx) atau kode negara lain ditulis lengkap (mis. 1xxx, 44xxx). Nomor diawali 0 tapi bukan 08 akan ditolak.\nt- diikuti isi pesan.\nUrutan n- dan t- boleh dibalik.'
        }, quoteOpt)
        return
    }

    const uniqueNumbers = [...new Set(numbers)]
    await sock.sendMessage(from, { text: `📤 Mengirim ke ${uniqueNumbers.length} nomor...` }, quoteOpt)

    let success = 0, failed = 0
    const failedNumbers = []
    for (const num of uniqueNumbers) {
        const pnJid = `${num}@s.whatsapp.net`
        try {
            let targetJid = pnJid
            try {
                const lid = await sock.signalRepository?.lidMapping?.getLIDForPN(pnJid)
                console.log(`[owner-send] getLIDForPN result:`, lid)
                if (lid) targetJid = lid
            } catch (lidErr) {
                console.log(`[owner-send] getLIDForPN error:`, lidErr?.message)
            }
            let onWaResult = null
            try {
                const onWaRes = await sock.onWhatsApp(pnJid)
                onWaResult = onWaRes
                console.log(`[owner-send] onWhatsApp result:`, JSON.stringify(onWaRes))
            } catch (onWaErr) {
                console.log(`[owner-send] onWhatsApp error:`, onWaErr?.message)
            }
            if (onWaResult !== null && onWaResult.length === 0) {
                failed++
                failedNumbers.push(`${num} (tidak terdaftar di WhatsApp)`)
                continue
            }
            if (onWaResult?.[0]?.jid) targetJid = onWaResult[0].jid
            const sentResult = await sock.sendMessage(targetJid, { text: pesan })
            console.log(`[owner-send] sendMessage result:`, JSON.stringify(sentResult?.key))
            success++
        } catch (e) {
            failed++
            failedNumbers.push(num)
            console.log(`[owner-send] gagal kirim ke ${num}:`, e?.message, e?.stack)
        }
        await new Promise(r => setTimeout(r, 1500))
    }

    let resultText = `✅ Selesai.\nBerhasil: ${success}\nGagal: ${failed}`
    if (failedNumbers.length > 0) resultText += `\n\nGagal ke:\n${failedNumbers.join('\n')}`
    await sock.sendMessage(from, { text: resultText })
}

async function handleGroupBroadcastCommand(sock, from, args, quoteOpt) {
    const pesan = args.trim()
    if (!pesan) {
        await sock.sendMessage(from, { text: '❌ Format: .groupbroadcast [pesan]\nContoh: .groupbroadcast Bot akan maintenance jam 22:00 nanti ya!' }, quoteOpt)
        return
    }
    let groups
    try {
        groups = await sock.groupFetchAllParticipating()
    } catch (e) {
        console.error('[owner:groupbroadcast] Gagal mengambil daftar grup:', e)
        await sock.sendMessage(from, { text: '❌ Gagal mengambil daftar grup. Coba lagi beberapa saat.' }, quoteOpt)
        return
    }
    const groupIds = Object.keys(groups || {})
    if (groupIds.length === 0) {
        await sock.sendMessage(from, { text: '📭 Bot belum tergabung di grup manapun.' }, quoteOpt)
        return
    }
    await sock.sendMessage(from, { text: `📤 Memulai broadcast ke ${groupIds.length} grup...` }, quoteOpt)
    let success = 0, failed = 0
    for (const gid of groupIds) {
        try {
            await sock.sendMessage(gid, { text: `📢 *Pengumuman*\n\n${pesan}` })
            success++
        } catch (e) {
            failed++
            console.log(`[owner-broadcast] gagal kirim ke grup ${gid}:`, e?.message)
        }
        await new Promise(r => setTimeout(r, 2000))
    }
    await sock.sendMessage(from, { text: `✅ Broadcast grup selesai.\nBerhasil: ${success}\nGagal: ${failed}` })
}

async function handleStatsCommand(sock, from, quoteOpt) {
    let groupCount = 0
    try {
        const groups = await sock.groupFetchAllParticipating()
        groupCount = Object.keys(groups || {}).length
    } catch (e) {
        console.log('[owner-stats] gagal ambil jumlah grup:', e?.message)
    }
    const mem = process.memoryUsage()
    const rssMB = (mem.rss / 1024 / 1024).toFixed(1)
    const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1)
    const uptimeStr = formatUptime(Date.now() - botStats.startTime)
    const text = `📊 *Statistik Bot*

⏱️ Uptime: ${uptimeStr}
📨 Total request sejak start: ${botStats.totalRequests}
👥 Grup terhubung: ${groupCount}
🙋 User tercatat (untuk broadcast): ${knownUsers.length}
🚫 User dibanned: ${bannedUsers.length}

💾 *Memory*
RSS: ${rssMB} MB
Heap Used: ${heapMB} MB
Node: ${process.version}`
    await sock.sendMessage(from, { text }, quoteOpt)
}

async function handleBanCommand(sock, from, args, quoteOpt) {
    const target = normalizeNumber(args.trim())
    if (!target) {
        await sock.sendMessage(from, { text: '❌ Format: .ban [nomor]\nContoh: .ban 6281234567890' }, quoteOpt)
        return
    }
    if (bannedUsers.includes(target)) {
        await sock.sendMessage(from, { text: `ℹ️ ${target} sudah ada di daftar banned.` }, quoteOpt)
        return
    }
    bannedUsers.push(target)
    await saveBannedUsers()
    await sock.sendMessage(from, { text: `✅ ${target} dibanned. Bot tidak akan merespons nomor ini lagi.` }, quoteOpt)
}

async function handleUnbanCommand(sock, from, args, quoteOpt) {
    const target = normalizeNumber(args.trim())
    if (!target) {
        await sock.sendMessage(from, { text: '❌ Format: .unban [nomor]\nContoh: .unban 6281234567890' }, quoteOpt)
        return
    }
    if (!bannedUsers.includes(target)) {
        await sock.sendMessage(from, { text: `ℹ️ ${target} tidak ada di daftar banned.` }, quoteOpt)
        return
    }
    bannedUsers = bannedUsers.filter(n => n !== target)
    await saveBannedUsers()
    await sock.sendMessage(from, { text: `✅ ${target} di-unban.` }, quoteOpt)
}

async function handleBioCommand(sock, from, msg, args, quoteOpt) {
    const targetJid = resolveTargetJid(msg, args)
    if (!targetJid) {
        await sock.sendMessage(from, { text: '❌ Format: .bio [nomor] atau tag/reply orangnya.\nContoh: .bio 6281234567890' }, quoteOpt)
        return
    }
    try {
        const result = await sock.fetchStatus(targetJid)
        const targetNum = normalizeNumber(targetJid)
        if (!result || !result.status) {
            await sock.sendMessage(from, { text: `ℹ️ +${targetNum} tidak punya bio, atau bio-nya tidak terlihat (privasi).` }, quoteOpt)
            return
        }
        const setAtStr = result.setAt ? new Date(result.setAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : '-'
        await sock.sendMessage(from, { text: `📝 *Bio +${targetNum}*\n\n${result.status}\n\n🕒 Diset: ${setAtStr} WIB` }, quoteOpt)
    } catch (e) {
        console.error('[owner:bio] gagal:', e)
        await sock.sendMessage(from, { text: '❌ Gagal mengambil bio. Nomor tidak ditemukan atau bio disembunyikan dari bot.' }, quoteOpt)
    }
}

async function handlePpCommand(sock, from, msg, args, quoteOpt) {
    const targetJid = resolveTargetJid(msg, args)
    if (!targetJid) {
        await sock.sendMessage(from, { text: '❌ Format: .pp [nomor] atau tag/reply orangnya.\nContoh: .pp 6281234567890' }, quoteOpt)
        return
    }
    const targetNum = normalizeNumber(targetJid)
    try {
        const ppUrl = await sock.profilePictureUrl(targetJid, 'image')
        if (!ppUrl) {
            await sock.sendMessage(from, { text: `ℹ️ +${targetNum} tidak punya foto profil, atau foto-nya disembunyikan dari bot.` }, quoteOpt)
            return
        }
        await sock.sendMessage(from, { image: { url: ppUrl }, caption: `🖼️ Foto profil +${targetNum}` }, quoteOpt)
    } catch (e) {
        console.error('[owner:pp] gagal:', e)
        await sock.sendMessage(from, { text: `❌ Tidak bisa mengambil foto profil +${targetNum}. Kemungkinan tidak punya foto atau disembunyikan dari bot.` }, quoteOpt)
    }
}

async function handleSetBioCommand(sock, from, args, quoteOpt) {
    const teks = args.trim()
    if (!teks) {
        await sock.sendMessage(from, { text: '❌ Format: .setbio [teks]\nContoh: .setbio Bot AI siap membantu 24 jam' }, quoteOpt)
        return
    }
    try {
        await sock.updateProfileStatus(teks)
        await sock.sendMessage(from, { text: `✅ Bio bot berhasil diubah menjadi:\n"${teks}"` }, quoteOpt)
    } catch (e) {
        console.error('[owner:setbio] gagal:', e)
        await sock.sendMessage(from, { text: '❌ Gagal mengubah bio bot. Coba lagi beberapa saat.' }, quoteOpt)
    }
}

async function handleSetBotNameCommand(sock, from, args, quoteOpt) {
    const nama = args.trim()
    if (!nama) {
        await sock.sendMessage(from, { text: '❌ Format: .setbotname [nama]\nContoh: .setbotname AI Bot Asisten' }, quoteOpt)
        return
    }
    try {
        await sock.updateProfileName(nama)
        await sock.sendMessage(from, { text: `✅ Nama tampilan bot berhasil diubah menjadi *${nama}*.` }, quoteOpt)
    } catch (e) {
        console.error('[owner:setbotname] gagal:', e)
        await sock.sendMessage(from, { text: '❌ Gagal mengubah nama bot. Coba lagi beberapa saat.' }, quoteOpt)
    }
}

async function handleBlockCommand(sock, from, msg, args, quoteOpt) {
    const targetJid = resolveTargetJid(msg, args)
    if (!targetJid) {
        await sock.sendMessage(from, { text: '❌ Format: .block [nomor] atau tag/reply orangnya.\nContoh: .block 6281234567890' }, quoteOpt)
        return
    }
    const targetNum = normalizeNumber(targetJid)
    try {
        await sock.updateBlockStatus(targetJid, 'block')
        await sock.sendMessage(from, { text: `✅ +${targetNum} berhasil diblokir. Bot tidak akan menerima pesan dari nomor ini lagi.` }, quoteOpt)
    } catch (e) {
        console.error('[owner:block] gagal:', e)
        await sock.sendMessage(from, { text: `❌ Gagal blokir +${targetNum}. Coba lagi beberapa saat.` }, quoteOpt)
    }
}

async function handleUnblockCommand(sock, from, msg, args, quoteOpt) {
    const targetJid = resolveTargetJid(msg, args)
    if (!targetJid) {
        await sock.sendMessage(from, { text: '❌ Format: .unblock [nomor] atau tag/reply orangnya.\nContoh: .unblock 6281234567890' }, quoteOpt)
        return
    }
    const targetNum = normalizeNumber(targetJid)
    try {
        await sock.updateBlockStatus(targetJid, 'unblock')
        await sock.sendMessage(from, { text: `✅ +${targetNum} berhasil dibuka blokirnya.` }, quoteOpt)
    } catch (e) {
        console.error('[owner:unblock] gagal:', e)
        await sock.sendMessage(from, { text: `❌ Gagal membuka blokir +${targetNum}. Coba lagi beberapa saat.` }, quoteOpt)
    }
}

async function handleBusinessInfoCommand(sock, from, msg, args, quoteOpt) {
    const targetJid = resolveTargetJid(msg, args)
    if (!targetJid) {
        await sock.sendMessage(from, { text: '❌ Format: .businessinfo [nomor] atau tag/reply orangnya.\nContoh: .businessinfo 6281234567890' }, quoteOpt)
        return
    }
    const targetNum = normalizeNumber(targetJid)
    try {
        const profile = await sock.getBusinessProfile(targetJid)
        if (!profile) {
            await sock.sendMessage(from, { text: `ℹ️ +${targetNum} bukan akun WhatsApp Business, atau profil bisnisnya tidak bisa diakses.` }, quoteOpt)
            return
        }
        const website = Array.isArray(profile.website) && profile.website.length > 0 ? profile.website.join(', ') : '-'
        const lines = [
            `🏢 *Profil Bisnis +${targetNum}*`,
            '',
            `Kategori: ${profile.category || '-'}`,
            `Deskripsi: ${profile.description || '-'}`,
            `Email: ${profile.email || '-'}`,
            `Website: ${website}`,
            `Alamat: ${profile.address || '-'}`
        ]
        await sock.sendMessage(from, { text: lines.join('\n') }, quoteOpt)
    } catch (e) {
        console.error('[owner:businessinfo] gagal:', e)
        await sock.sendMessage(from, { text: `❌ Gagal mengambil profil bisnis +${targetNum}. Kemungkinan bukan akun Business atau nomor tidak ditemukan.` }, quoteOpt)
    }
}

function parsePhoneList(raw) {
    return (raw || '')
        .split(/[\s,]+/)
        .map(n => n.replace(/[^0-9]/g, ''))
        .filter(n => n.length >= 8 && !n.startsWith('0'))
}

async function handleCreateGroupCommand(sock, from, args, quoteOpt) {
    const raw = args.trim()
    if (!raw) {
        await sock.sendMessage(from, { text: '❌ Format: .creategroup Nama Grup | nomor1, nomor2\nContoh: .creategroup Tim Proyek | 6281234567890, 6289876543210\n\nOwner otomatis ditambahkan, nomor tambahan opsional.' }, quoteOpt)
        return
    }

    const [namaPart, ...rest] = raw.split('|')
    const groupName = namaPart.trim()
    if (!groupName) {
        await sock.sendMessage(from, { text: '❌ Nama grup tidak boleh kosong.\nFormat: .creategroup Nama Grup | nomor1, nomor2' }, quoteOpt)
        return
    }

    const extraNumbers = parsePhoneList(rest.join('|'))
    const ownerNumbers = OWNER_NUMBERS.filter(n => !extraNumbers.includes(n))
    const allNumbers = [...ownerNumbers, ...extraNumbers]
    const participantJids = allNumbers.map(n => `${n}@s.whatsapp.net`)

    await sock.sendMessage(from, { text: `⏳ Membuat grup *${groupName}*...` }, quoteOpt)
    try {
        const group = await sock.groupCreate(groupName, participantJids)
        await sock.sendMessage(group.id, { text: `🎉 Grup *${groupName}* berhasil dibuat oleh bot!` })
        await sock.sendMessage(from, { text: `✅ Grup *${groupName}* berhasil dibuat.\n👥 Anggota awal: ${participantJids.length}\n🆔 ${group.id}` }, quoteOpt)
    } catch (e) {
        console.error('[owner:creategroup] gagal:', e)
        await sock.sendMessage(from, { text: '❌ Gagal membuat grup. Coba lagi beberapa saat.' }, quoteOpt)
    }
}

function extractInviteCode(raw) {
    const trimmed = (raw || '').trim()
    const match = trimmed.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)
    if (match) return match[1]
    if (/^[A-Za-z0-9]+$/.test(trimmed)) return trimmed
    return ''
}

async function handleJoinGroupCommand(sock, from, args, quoteOpt) {
    const code = extractInviteCode(args)
    if (!code) {
        await sock.sendMessage(from, { text: '❌ Format: .joingroup [link grup]\nContoh: .joingroup https://chat.whatsapp.com/AbCdEfGhIjK' }, quoteOpt)
        return
    }
    try {
        const groupId = await sock.groupAcceptInvite(code)
        await sock.sendMessage(from, { text: `✅ Bot berhasil join ke grup.\n🆔 ${groupId}` }, quoteOpt)
    } catch (e) {
        console.error('[owner:joingroup] gagal:', e)
        await sock.sendMessage(from, { text: '❌ Gagal join grup. Link mungkin sudah tidak berlaku, kadaluarsa, atau bot sudah ada di grup tersebut.' }, quoteOpt)
    }
}

async function handleLeaveGroupCommand(sock, from, args, quoteOpt) {
    const raw = args.trim()
    const targetGroupJid = raw ? (raw.endsWith('@g.us') ? raw : `${raw}@g.us`) : from

    if (!targetGroupJid.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Command ini hanya berlaku di dalam grup, atau gunakan .leavegroup [groupJid] untuk keluar dari grup lain.' }, quoteOpt)
        return
    }

    try {
        if (targetGroupJid === from) {
            await sock.sendMessage(from, { text: '👋 Bot keluar dari grup ini. Sampai jumpa!' }, quoteOpt)
        }
        await sock.groupLeave(targetGroupJid)
        if (targetGroupJid !== from) {
            await sock.sendMessage(from, { text: `✅ Bot berhasil keluar dari grup ${targetGroupJid}.` }, quoteOpt)
        }
    } catch (e) {
        console.error('[owner:leavegroup] gagal:', e)
        await sock.sendMessage(from, { text: '❌ Gagal keluar dari grup. Kemungkinan bot adalah satu-satunya admin (promote member lain dulu sebelum leave) atau bot sudah tidak ada di grup tersebut.' }, quoteOpt)
    }
}

async function handleStatusCommand(sock, from, args, quoteOpt, postStatusFn) {
    const pesan = args.trim()
    if (!pesan) {
        await sock.sendMessage(from, { text: '❌ Format: .status [teks]\nContoh: .status Bot sedang maintenance jam 22:00 nanti ya!' }, quoteOpt)
        return
    }
    await sock.sendMessage(from, { text: '⏳ Posting status...' })
    await postStatusFn('text', pesan)
    await sock.sendMessage(from, { text: '✅ Status berhasil diposting!' }, quoteOpt)
}

async function handleDeleteStatusCommand(sock, from, quoteOpt, getLastStatusKey) {
    const key = getLastStatusKey()
    if (!key) {
        await sock.sendMessage(from, { text: '⚠️ Tidak ada status yang tercatat untuk dihapus. Status hanya bisa dihapus jika diposting lewat bot di sesi ini.' }, quoteOpt)
        return
    }
    try {
        await sock.sendMessage('status@broadcast', { delete: key })
        await sock.sendMessage(from, { text: '✅ Status berhasil dihapus.' }, quoteOpt)
    } catch (e) {
        console.error('[owner:delstatus] Gagal menghapus status:', e)
        await sock.sendMessage(from, { text: '❌ Gagal menghapus status. Coba lagi beberapa saat.' }, quoteOpt)
    }
}

async function handleMaintenanceCommand(sock, from, args, quoteOpt) {
    const mode = args.trim().toLowerCase()

    if (mode !== 'on' && mode !== 'off') {
        const status = maintenanceMode ? '🔴 ON' : '🟢 OFF'
        await sock.sendMessage(from, {
            text: `🔧 *Mode Maintenance*\n\nStatus saat ini: *${status}*\n\nGunakan:\n.maintenance on  → aktifkan\n.maintenance off → matikan`
        }, quoteOpt)
        return
    }

    maintenanceMode = (mode === 'on')

    if (maintenanceMode) {
        await sock.sendMessage(from, {
            text: '🔧 *Maintenance mode ON*\n\nBot tidak akan merespons siapapun kecuali owner.\nUser yang mencoba pakai bot akan menerima pesan:\n"🔧 Maintenance is on. Please wait..."'
        }, quoteOpt)
    } else {
        await sock.sendMessage(from, {
            text: '✅ *Maintenance mode OFF*\n\nBot sudah kembali melayani semua pengguna.'
        }, quoteOpt)
    }
}

async function handleListGroupsCommand(sock, from, quoteOpt) {
    let groups
    try {
        groups = await sock.groupFetchAllParticipating()
    } catch (e) {
        console.error('[owner:listgroups] gagal:', e)
        await sock.sendMessage(from, { text: '❌ Gagal mengambil daftar grup. Coba lagi beberapa saat.' }, quoteOpt)
        return
    }

    const entries = Object.values(groups || {})
    if (entries.length === 0) {
        await sock.sendMessage(from, { text: '📭 Bot belum tergabung di grup manapun.' }, quoteOpt)
        return
    }

    
    entries.sort((a, b) => (b.participants?.length ?? 0) - (a.participants?.length ?? 0))

    const botIdNorm = (sock.user?.id || '').split('@')[0].split(':')[0]
    const botLidNorm = (sock.user?.lid || '').split('@')[0].split(':')[0]

    
    
    
    
    
    const entriesWithAdminFlag = entries.map(g => {
        const botParticipant = (g.participants || []).find(p => {
            const pNorm = p.id.split('@')[0].split(':')[0]
            return pNorm === botIdNorm || pNorm === botLidNorm
        })
        const isAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin'
        return { ...g, _isBotAdmin: isAdmin }
    })

    const inviteResults = await Promise.all(entriesWithAdminFlag.map(async (g) => {
        if (!g._isBotAdmin) return null
        try {
            const code = await sock.groupInviteCode(g.id)
            return code ? `https://chat.whatsapp.com/${code}` : null
        } catch (e) {
            return null
        }
    }))

    const lines = entriesWithAdminFlag.map((g, i) => {
        const memberCount = g.participants?.length ?? '?'
        const adminCount = (g.participants || []).filter(p => p.admin === 'admin' || p.admin === 'superadmin').length
        const adminBadge = g._isBotAdmin ? ' 👑' : ''
        const desc = g.desc ? g.desc.trim().slice(0, 100) : null
        const createdStr = g.creation
            ? new Date(g.creation * 1000).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
            : 'Tidak diketahui'
        const inviteLink = inviteResults[i]

        let block = `${i + 1}. *${g.subject || '(tanpa nama)'}*${adminBadge}\n`
        block += `   👥 ${memberCount} member (${adminCount} admin) | ID: ${g.id}\n`
        block += `   🗓️ Dibuat: ${createdStr}\n`
        if (desc) block += `   📝 ${desc}${g.desc.length > 100 ? '...' : ''}\n`
        if (inviteLink) {
            block += `   🔗 ${inviteLink}\n`
        } else if (!g._isBotAdmin) {
            block += `   🔗 _(bot bukan admin, tidak bisa ambil link)_\n`
        }
        return block.trimEnd()
    })

    
    
    const PAGE = 10
    const totalPages = Math.ceil(lines.length / PAGE)

    for (let p = 0; p < totalPages; p++) {
        const slice = lines.slice(p * PAGE, (p + 1) * PAGE)
        const header = totalPages > 1
            ? `📋 *Daftar Grup Bot* (${entries.length} total) — Hal ${p + 1}/${totalPages}\n👑 = bot jadi admin\n\n`
            : `📋 *Daftar Grup Bot* (${entries.length} total)\n👑 = bot jadi admin\n\n`
        await sock.sendMessage(from, { text: header + slice.join('\n\n') }, quoteOpt)
        if (p < totalPages - 1) await new Promise(r => setTimeout(r, 1000))
    }
}

async function handleLeaveAllCommand(sock, from, args, quoteOpt) {
    const confirm = args.trim().toLowerCase()

    if (confirm !== 'confirm') {
        await sock.sendMessage(from, {
            text: '⚠️ *Peringatan!*\n\nPerintah ini akan membuat bot keluar dari *SEMUA grup* sekaligus dan tidak bisa dibatalkan.\n\nKetik *.leaveall confirm* kalau kamu yakin.'
        }, quoteOpt)
        return
    }

    let groups
    try {
        groups = await sock.groupFetchAllParticipating()
    } catch (e) {
        console.error('[owner:leaveall] gagal ambil grup:', e)
        await sock.sendMessage(from, { text: '❌ Gagal mengambil daftar grup. Coba lagi beberapa saat.' }, quoteOpt)
        return
    }

    const groupIds = Object.keys(groups || {})
    if (groupIds.length === 0) {
        await sock.sendMessage(from, { text: '📭 Bot tidak tergabung di grup manapun.' }, quoteOpt)
        return
    }

    await sock.sendMessage(from, { text: `⏳ Keluar dari ${groupIds.length} grup...` }, quoteOpt)

    let success = 0, failed = 0
    for (const gid of groupIds) {
        try {
            await sock.groupLeave(gid)
            success++
        } catch (e) {
            failed++
            console.error(`[owner:leaveall] gagal leave ${gid}:`, e?.message)
        }
        await new Promise(r => setTimeout(r, 800))
    }

    await sock.sendMessage(from, {
        text: `✅ Selesai.\n\nBerhasil keluar: ${success} grup\nGagal: ${failed} grup`
    }, quoteOpt)
}

async function handleLeaveInactiveCommand(sock, from, args, quoteOpt) {
    const rawArg = args.trim()

    
    const threshold = rawArg && /^\d+$/.test(rawArg) ? parseInt(rawArg, 10) : null
    const isDryRun = threshold === null

    let groups
    try {
        groups = await sock.groupFetchAllParticipating()
    } catch (e) {
        console.error('[owner:leaveinactive] gagal ambil grup:', e)
        await sock.sendMessage(from, { text: '❌ Gagal mengambil daftar grup. Coba lagi beberapa saat.' }, quoteOpt)
        return
    }

    const entries = Object.values(groups || {})
    if (entries.length === 0) {
        await sock.sendMessage(from, { text: '📭 Bot tidak tergabung di grup manapun.' }, quoteOpt)
        return
    }

    if (isDryRun) {
        
        const counts = entries.map(g => g.participants?.length ?? 0).sort((a, b) => a - b)
        const below5   = counts.filter(c => c < 5).length
        const below10  = counts.filter(c => c < 10).length
        const below20  = counts.filter(c => c < 20).length
        const below50  = counts.filter(c => c < 50).length

        const preview = entries
            .filter(g => (g.participants?.length ?? 0) < 10)
            .sort((a, b) => (a.participants?.length ?? 0) - (b.participants?.length ?? 0))
            .slice(0, 10)
            .map(g => `• *${g.subject || '(tanpa nama)'}* — ${g.participants?.length ?? '?'} member`)
            .join('\n')

        await sock.sendMessage(from, {
            text: `📊 *Analisis Grup Bot* (${entries.length} grup total)\n\n` +
                `< 5 member : ${below5} grup\n` +
                `< 10 member: ${below10} grup\n` +
                `< 20 member: ${below20} grup\n` +
                `< 50 member: ${below50} grup\n\n` +
                (preview ? `🔍 *Preview grup < 10 member:*\n${preview}\n\n` : '') +
                `Gunakan *.leaveinactive [angka]* untuk keluar.\n` +
                `Contoh: .leaveinactive 5 → keluar dari semua grup < 5 member`
        }, quoteOpt)
        return
    }

    
    const targets = entries.filter(g => (g.participants?.length ?? 0) < threshold)

    if (targets.length === 0) {
        await sock.sendMessage(from, {
            text: `ℹ️ Tidak ada grup dengan member < ${threshold}. Bot tetap di semua grup.`
        }, quoteOpt)
        return
    }

    
    const previewList = targets.slice(0, 10).map(g =>
        `• *${g.subject || '(tanpa nama)'}* — ${g.participants?.length ?? '?'} member`
    ).join('\n')
    const moreText = targets.length > 10 ? `\n...dan ${targets.length - 10} lainnya` : ''

    await sock.sendMessage(from, {
        text: `⏳ Keluar dari *${targets.length} grup* dengan member < ${threshold}...\n\n${previewList}${moreText}`
    }, quoteOpt)

    let success = 0, failed = 0
    for (const g of targets) {
        try {
            await sock.groupLeave(g.id)
            success++
        } catch (e) {
            failed++
            console.error(`[owner:leaveinactive] gagal leave ${g.id}:`, e?.message)
        }
        await new Promise(r => setTimeout(r, 800))
    }

    await sock.sendMessage(from, {
        text: `✅ Selesai.\n\nBerhasil keluar: ${success} grup\nGagal: ${failed} grup`
    }, quoteOpt)
}

function isValidGroupJid(raw) {
    return /^\d+@g\.us$/.test(raw)
}

async function handleAddMeCommand(sock, from, msg, args, quoteOpt) {
    const groupJid = args.trim()

    if (!isValidGroupJid(groupJid)) {
        await sock.sendMessage(from, { text: '❌ Format: .addme [groupJid]\nContoh: .addme 120363426437959402@g.us\n\n💡 Ambil ID grup persis dari hasil .listgroups.' }, quoteOpt)
        return
    }

    const senderNum = extractSenderNumber(msg.key)
    if (!senderNum) {
        await sock.sendMessage(from, { text: '❌ Tidak bisa mendeteksi nomormu. Coba lagi.' }, quoteOpt)
        return
    }
    const ownerJid = `${senderNum}@s.whatsapp.net`

    let metadata
    try {
        metadata = await sock.groupMetadata(groupJid)
    } catch (e) {
        console.error('[owner:addme] gagal ambil metadata grup:', e?.message)
        await sock.sendMessage(from, { text: '❌ Gagal mengambil info grup. Pastikan ID grup benar dan bot ada di grup tersebut.' }, quoteOpt)
        return
    }

    const normalizeId = (jid) => (jid || '').split('@')[0].split(':')[0]
    const botIdNorm = normalizeId(sock.user?.id)
    const botLidNorm = normalizeId(sock.user?.lid)
    const botParticipant = (metadata.participants || []).find(p => {
        const pNorm = normalizeId(p.id)
        return pNorm === botIdNorm || pNorm === botLidNorm
    })
    const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin'

    if (!botIsAdmin) {
        await sock.sendMessage(from, { text: `⚠️ Bot bukan admin di grup *${metadata.subject || groupJid}*. Bot harus jadi admin dulu supaya bisa menambahkan member.` }, quoteOpt)
        return
    }

    const alreadyMember = (metadata.participants || []).some(p => normalizeId(p.id) === senderNum)
    if (alreadyMember) {
        await sock.sendMessage(from, { text: `ℹ️ Kamu sudah ada di grup *${metadata.subject || groupJid}*.` }, quoteOpt)
        return
    }

    try {
        const result = await sock.groupParticipantsUpdate(groupJid, [ownerJid], 'add')
        console.log('[owner:addme] hasil groupParticipantsUpdate:', JSON.stringify(result))
        await sock.sendMessage(from, { text: `📨 Permintaan tambah kamu ke grup *${metadata.subject || groupJid}* sudah dikirim. Cek langsung apakah kamu sudah masuk.` }, quoteOpt)
    } catch (e) {
        console.error('[owner:addme] gagal menambahkan:', e?.message, e?.stack)
        await sock.sendMessage(from, { text: `❌ Gagal mengirim permintaan tambah ke grup *${metadata.subject || groupJid}*. Coba lagi beberapa saat.` }, quoteOpt)
    }
}

async function handleOwnerCommand(sock, from, msg, command, args, quoteOpt) {
    if (command === 'broadcast') return handleBroadcastCommand(sock, from, args, quoteOpt)
    if (command === 'send') return handleSendCommand(sock, from, args, quoteOpt)
    if (command === 'groupbroadcast') return handleGroupBroadcastCommand(sock, from, args, quoteOpt)
    if (command === 'stats') return handleStatsCommand(sock, from, quoteOpt)
    if (command === 'ban') return handleBanCommand(sock, from, args, quoteOpt)
    if (command === 'unban') return handleUnbanCommand(sock, from, args, quoteOpt)
    if (command === 'status') return handleStatusCommand(sock, from, args, quoteOpt, handleOwnerCommand._postStatus)
    if (command === 'dstatus') return handleDeleteStatusCommand(sock, from, quoteOpt, handleOwnerCommand._getLastStatusKey)
    if (command === 'bio') return handleBioCommand(sock, from, msg, args, quoteOpt)
    if (command === 'pp') return handlePpCommand(sock, from, msg, args, quoteOpt)
    if (command === 'creategroup') return handleCreateGroupCommand(sock, from, args, quoteOpt)
    if (command === 'joingroup') return handleJoinGroupCommand(sock, from, args, quoteOpt)
    if (command === 'leavegroup') return handleLeaveGroupCommand(sock, from, args, quoteOpt)
    if (command === 'setbio') return handleSetBioCommand(sock, from, args, quoteOpt)
    if (command === 'setbotname') return handleSetBotNameCommand(sock, from, args, quoteOpt)
    if (command === 'block') return handleBlockCommand(sock, from, msg, args, quoteOpt)
    if (command === 'unblock') return handleUnblockCommand(sock, from, msg, args, quoteOpt)
    if (command === 'businessinfo') return handleBusinessInfoCommand(sock, from, msg, args, quoteOpt)
    if (command === 'maintenance') return handleMaintenanceCommand(sock, from, args, quoteOpt)
    if (command === 'listgroups') return handleListGroupsCommand(sock, from, quoteOpt)
    if (command === 'leaveall') return handleLeaveAllCommand(sock, from, args, quoteOpt)
    if (command === 'leaveinactive') return handleLeaveInactiveCommand(sock, from, args, quoteOpt)
    if (command === 'addme') return handleAddMeCommand(sock, from, msg, args, quoteOpt)
}

const PUBLIC_COMMANDS = ['myinfo', 'whoami', 'report']

async function handleWhoamiCommand(sock, from, msg, quoteOpt) {
    const senderJidOrKey = msg.key
    const num = extractSenderNumber(senderJidOrKey)
    const fullJid = msg.key.participant || msg.key.remoteJid
    const firstSeenIso = getFirstSeen(senderJidOrKey)
    const firstSeenStr = firstSeenIso
        ? new Date(firstSeenIso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) + ' WIB'
        : 'Baru saja (pesan pertamamu ke bot ini)'
    const ownerLabel = isOwner(senderJidOrKey) ? '\n👑 Status: Owner bot ini' : ''
    const text = `🪪 *Info Kamu*\n\n` +
        `📱 Nomor: +${num || 'tidak terdeteksi'}\n` +
        `🆔 JID: ${fullJid}\n` +
        `🕒 Pertama kali dikenal bot: ${firstSeenStr}${ownerLabel}`
    await sock.sendMessage(from, { text }, quoteOpt)
}

function extractReportedText(msg) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if (!quoted) return ''
    return quoted.conversation
        || quoted.extendedTextMessage?.text
        || quoted.imageMessage?.caption
        || quoted.videoMessage?.caption
        || (quoted.stickerMessage ? '[sticker]' : '')
        || (quoted.audioMessage ? '[pesan suara/audio]' : '')
        || ''
}

async function handleReportCommand(sock, from, msg, args, quoteOpt) {
    const isGroup = from.endsWith('@g.us')
    const reporterNum = extractSenderNumber(msg.key)

    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const reportedText = extractReportedText(msg)

    let pelakuJid = ''
    let isiLaporan = args.trim()

    if (quotedParticipant) {
        
        pelakuJid = quotedParticipant
    } else if (mentioned.length > 0) {
        
        pelakuJid = mentioned[0]
    } else {
        
        const tokens = args.trim().split(/\s+/)
        const possibleNumber = normalizeNumber(tokens[0] || '')
        if (possibleNumber) {
            pelakuJid = `${possibleNumber}@s.whatsapp.net`
            isiLaporan = tokens.slice(1).join(' ')
        }
    }

    if (!pelakuJid && !isiLaporan) {
        await sock.sendMessage(from, {
            text: '❌ Format .report:\n\n' +
                '1️⃣ Reply pesan kasar/bermasalah lalu ketik:\n.report [alasan opsional]\n\n' +
                '2️⃣ .report @user Isi laporan\n\n' +
                '3️⃣ .report 6281234567890 Isi laporan'
        }, quoteOpt)
        return
    }

    if (OWNER_NUMBERS.length === 0) {
        await sock.sendMessage(from, { text: '⚠️ Belum ada owner terdaftar untuk menerima laporan ini.' }, quoteOpt)
        return
    }

    const pelakuNum = pelakuJid ? normalizeNumber(pelakuJid) : ''
    const waktuLaporStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })

    let asalStr = isGroup ? `Grup (${from})` : 'Chat pribadi'
    if (isGroup && typeof sock.groupMetadata === 'function') {
        try {
            const groupMeta = await sock.groupMetadata(from)
            if (groupMeta?.subject) asalStr = `Grup *${groupMeta.subject}*\n(${from})`
        } catch (e) {
            
        }
    }

    const lines = [
        '🚨 *LAPORAN BARU DARI USER*',
        '',
        `👤 Pelapor: +${reporterNum || 'tidak terdeteksi'}`,
        pelakuNum ? `🎯 Terlapor: +${pelakuNum}` : '🎯 Terlapor: (tidak disebutkan, cek isi laporan)',
        `📍 Asal: ${asalStr}`,
        `🕒 Waktu lapor: ${waktuLaporStr} WIB`,
        ''
    ]
    if (reportedText) lines.push(`💬 Isi pesan yang dilaporkan:\n"${reportedText}"`, '')
    lines.push(`📝 Catatan dari pelapor:\n${isiLaporan || '(tidak ada catatan tambahan)'}`)

    const reportText = lines.join('\n')

    let terkirim = 0
    for (const ownerNum of OWNER_NUMBERS) {
        try {
            await sock.sendMessage(`${ownerNum}@s.whatsapp.net`, { text: reportText })
            terkirim++
        } catch (e) {
            console.error('[report] gagal kirim ke owner', ownerNum, e?.message)
        }
    }

    if (terkirim === 0) {
        await sock.sendMessage(from, { text: '❌ Gagal mengirim laporan ke owner. Coba lagi beberapa saat.' }, quoteOpt)
        return
    }
    await sock.sendMessage(from, { text: '✅ Laporan kamu sudah dikirim ke owner. Terima kasih sudah melapor!' }, quoteOpt)
}

async function handlePublicCommand(sock, from, msg, command, args, quoteOpt) {
    if (command === 'myinfo' || command === 'whoami') return handleWhoamiCommand(sock, from, msg, quoteOpt)
    if (command === 'report') return handleReportCommand(sock, from, msg, args, quoteOpt)
}

module.exports = {
    OWNER_COMMANDS,
    PUBLIC_COMMANDS,
    isOwner, isBanned, isMaintenanceMode, recordKnownUser, recordFirstSeen, incrementRequestCount,
    extractSenderNumber,
    handleOwnerCommand,
    handlePublicCommand
}
