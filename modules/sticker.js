'use strict'

const { downloadMediaMessage } = require('@whiskeysockets/baileys')

const MAX_FILE_SIZE = 20 * 1024 * 1024

function getFileSizeFromMsg(msg, type) {
    return msg.message?.[type]?.fileLength || msg.message?.[type]?.fileEncSha256?.length || 0
}

async function handleStickerFromQuoted(sock, from, msg, runQueuedTool, stickerQueue, imageToSticker, videoToSticker) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if (quoted?.imageMessage) {
        const fakeMsg = { message: quoted, key: { remoteJid: from } }
        const fileSize = getFileSizeFromMsg(fakeMsg, 'imageMessage')
        if (fileSize > MAX_FILE_SIZE) {
            await sock.sendMessage(from, { text: `⚠️ Gambar terlalu besar (${(fileSize/1024/1024).toFixed(1)}MB). Maksimal 20MB.` })
            return true
        }
        await sock.sendMessage(from, { text: '⏳ Membuat sticker...' })
        const imageBuffer = await downloadMediaMessage(fakeMsg, 'buffer', {})
        if (imageBuffer.length > MAX_FILE_SIZE) {
            await sock.sendMessage(from, { text: '⚠️ Gambar terlalu besar setelah diunduh. Maksimal 20MB.' })
            return true
        }
        const stickerBuffer = await runQueuedTool(sock, from, msg.key, stickerQueue, 'sticker',
            ({ registerKill }) => imageToSticker(imageBuffer, (proc) => registerKill(() => proc.kill('SIGTERM'))))
        if (stickerBuffer) await sock.sendMessage(from, { sticker: stickerBuffer })
        return true
    }
    if (quoted?.videoMessage) {
        const fakeMsg = { message: quoted, key: { remoteJid: from } }
        const fileSize = getFileSizeFromMsg(fakeMsg, 'videoMessage')
        if (fileSize > MAX_FILE_SIZE) {
            await sock.sendMessage(from, { text: `⚠️ Video terlalu besar (${(fileSize/1024/1024).toFixed(1)}MB). Maksimal 20MB.` })
            return true
        }
        await sock.sendMessage(from, { text: '⏳ Membuat sticker dari video...' })
        const videoBuffer = await downloadMediaMessage(fakeMsg, 'buffer', {})
        if (videoBuffer.length > MAX_FILE_SIZE) {
            await sock.sendMessage(from, { text: '⚠️ Video terlalu besar setelah diunduh. Maksimal 20MB.' })
            return true
        }
        const stickerBuffer = await runQueuedTool(sock, from, msg.key, stickerQueue, 'sticker',
            ({ registerKill }) => videoToSticker(videoBuffer, (proc) => registerKill(() => proc.kill('SIGTERM'))))
        if (stickerBuffer) await sock.sendMessage(from, { sticker: stickerBuffer })
        return true
    }
    return false
}

async function handleStickerMessage(sock, from, msg, runQueuedTool, stickerQueue, callAI, handleFunctionResult, hasValidKeys, setLastBotMsg, quoteOpt) {
    const isAnimated = !!msg.message.stickerMessage.isAnimated
    if (!hasValidKeys() || isAnimated) {
        await sock.sendMessage(from, { text: isAnimated ? '🙂 Sticker animasi diterima! Aku belum bisa menganalisis isi sticker animasi.' : '🙂 Sticker diterima!' }, quoteOpt)
        return
    }
    await sock.sendMessage(from, { text: '⏳ Menganalisis sticker...' })
    const mime = msg.message.stickerMessage.mimetype || 'image/webp'
    const stkBuffer = await downloadMediaMessage(msg, 'buffer', {})
    const base64 = stkBuffer.toString('base64')
    const result = await callAI(from, 'Deskripsikan isi sticker ini secara singkat dalam bahasa Indonesia', base64, mime, '', 'AI Bot')
    if (!result) { await sock.sendMessage(from, { text: '🙂 Sticker diterima!' }, quoteOpt); return }
    if (result.type === 'function') {
        if (result.name === 'react_message' && !result.args.reply) {
            try { await sock.sendMessage(from, { react: { text: result.args.emoji || '🙂', key: msg.key } }) } catch(_) {}
        } else {
            await handleFunctionResult(sock, from, msg, result, '[sticker]')
        }
    } else {
        const sentMsg = await sock.sendMessage(from, { text: result.text }, quoteOpt)
        setLastBotMsg(from, sentMsg.key)
    }
}

async function handleImageStickerCaption(sock, from, msg, runQueuedTool, stickerQueue, imageToSticker) {
    await sock.sendMessage(from, { text: '⏳ Membuat sticker...' })
    const imgBuffer = await downloadMediaMessage(msg, 'buffer', {})
    const stickerBuffer = await runQueuedTool(sock, from, msg.key, stickerQueue, 'sticker',
        ({ registerKill }) => imageToSticker(imgBuffer, (proc) => registerKill(() => proc.kill('SIGTERM'))))
    if (stickerBuffer) await sock.sendMessage(from, { sticker: stickerBuffer })
}

module.exports = {
    handleStickerFromQuoted,
    handleStickerMessage,
    handleImageStickerCaption
}
