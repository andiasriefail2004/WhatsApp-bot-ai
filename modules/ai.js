'use strict'

const AI_PROVIDERS = {
    text: [
        {
            model: 'claude-sonnet-4-6',
            keys: [
                'ISI_CLAUDE_KEY_1',
            ]
        },
        {
            model: 'gemini-2.5-flash',
            keys: [
                'ISI_GEMINI_KEY_1',
                'ISI_GEMINI_KEY_2',
            ]
        },
        {
            model: 'grok-4.3-latest',
            keys: [
                'ISI_GROK_KEY_1',
            ]
        },
        {
            model: 'gpt-oss-120b',
            keys: [
                'ISI_CEREBRAS_KEY_1',
            ]
        },
        {
            model: 'meta-llama/llama-4-maverick:free',
            keys: [
                'ISI_OPENROUTER_KEY_1',
            ]
        },
        {
            model: 'Meta-Llama-3.3-70B-Instruct',
            keys: [
                'ISI_SAMBANOVA_KEY_1',
            ]
        },
        {

            model: '@cf/meta/llama-4-scout-17b-16e-instruct',
            keys: [
                'ISI_CF_ACCOUNT_ID:ISI_CF_API_TOKEN',
            ]
        },
        {
            model: 'llama-3.3-70b-versatile',
            keys: [
                'ISI_GROQ_KEY_1',
            ]
        },
        {
            model: 'mistral-small-latest',
            keys: [
                'ISI_MISTRAL_KEY_1',
            ]
        },

    ],
    image: [
        {
            model: 'black-forest-labs/FLUX.1-schnell',
            keys: [
                'ISI_HF_KEY_1',
            ]
        },
        {

            model: '@cf/black-forest-labs/flux-1-schnell',
            keys: [
                'ISI_CF_ACCOUNT_ID:ISI_CF_API_TOKEN',
            ]
        },

    ],
    video: [

    ],
    audio: [
        {
            model: 'openai/whisper-large-v3',
            keys: [
                'ISI_HF_KEY_1',
            ]
        },
    ],
}

const TOOL_DEFINITIONS_BASE = [
    { name: 'make_sticker',        desc: 'Buat sticker dari gambar yang di-reply atau dikirim user',                    params: {} },
    { name: 'make_text_sticker',   desc: 'Buat sticker dengan tulisan teks',                                            params: { text: { type: 'string', desc: 'Teks yang akan dijadikan sticker' } }, required: ['text'] },
    { name: 'show_menu',           desc: 'Tampilkan menu dan daftar fitur bot',                                         params: {} },
    { name: 'send_poll',           desc: 'Buat dan kirim poll',                                                         params: { question: { type: 'string', desc: 'Pertanyaan poll' }, options: { type: 'array', desc: 'Pilihan jawaban, minimal 2 maksimal 12' } }, required: ['question', 'options'] },
    { name: 'forward_message',     desc: 'Forward pesan ke user',                                                       params: { text: { type: 'string', desc: 'Teks yang akan diforward' } }, required: ['text'] },
    { name: 'react_message',       desc: 'Berikan emoji reaction pada pesan user',                                      params: { emoji: { type: 'string', desc: 'Emoji reaction' }, reply: { type: 'string', desc: 'Teks balasan opsional' } }, required: ['emoji'] },
    { name: 'edit_message',        desc: 'Edit pesan bot sebelumnya',                                                   params: { new_text: { type: 'string', desc: 'Teks baru pengganti' } }, required: ['new_text'] },
    { name: 'delete_message',      desc: 'Hapus pesan bot sebelumnya',                                                  params: {} },
    { name: 'send_gif',            desc: 'Kirim GIF animasi via URL mp4 publik',                                        params: { url: { type: 'string', desc: 'URL mp4 GIF' }, caption: { type: 'string', desc: 'Keterangan GIF' } }, required: ['url', 'caption'] },
    { name: 'search_web',          desc: 'Cari informasi terkini di internet',                                          params: { query: { type: 'string', desc: 'Kata kunci pencarian' } }, required: ['query'] },
    { name: 'get_weather',         desc: 'Ambil data cuaca real-time untuk suatu kota atau lokasi',                     params: { city: { type: 'string', desc: 'Nama kota atau lokasi' } }, required: ['city'] },
    { name: 'download_media',      desc: 'Download video atau audio dari URL platform seperti YouTube, TikTok, dll',   params: { url: { type: 'string', desc: 'URL media' }, type: { type: 'string', desc: 'Tipe: video atau audio' } }, required: ['url'] },
    { name: 'get_earthquake',      desc: 'Ambil data gempa terkini dari BMKG Indonesia. Bisa filter berdasarkan wilayah/provinsi tertentu, atau tampilkan 10 gempa terkini nasional jika tidak ada wilayah.', params: { region: { type: 'string', desc: 'Nama wilayah atau provinsi yang ingin dicek. JANGAN isi dengan kata seperti "terkini", "terbaru", "sekarang" — itu bukan nama wilayah, kosongkan saja parameter ini untuk request semacam itu.' } } },
    { name: 'get_earthquake_global', desc: 'Ambil data gempa terkini dari USGS (sumber internasional, mencakup seluruh dunia termasuk negara selain Indonesia). Gunakan ini, BUKAN get_earthquake, jika user bertanya gempa di negara lain (misal Jepang, China, Filipina, Amerika) atau gempa dunia secara umum. Bisa filter berdasarkan nama negara/kota/wilayah, atau tampilkan gempa terbaru dunia jika tidak ada wilayah.', params: { region: { type: 'string', desc: 'Nama negara, kota, atau wilayah yang ingin dicek (contoh: "jepang", "california"). JANGAN isi dengan kata seperti "terkini", "terbaru", "sekarang" — kosongkan saja parameter ini untuk request semacam itu.' } } },
    { name: 'clear_history',       desc: 'Hapus riwayat percakapan/chat antara user dan bot ini (memori AI). Gunakan saat user minta "hapus percakapan", "hapus chat", "hapus riwayat", "lupakan percakapan", atau sejenisnya.', params: {} },
    { name: 'create_qr_code',      desc: 'Generate gambar QR code untuk user dari teks, URL, alamat email, nomor telepon, jaringan WiFi, kontak WhatsApp, atau koordinat GPS. Gunakan saat user minta "buatkan QR code", "bikin QR", "generate QR untuk...", atau sejenisnya.', params: { data: { type: 'string', desc: 'Konten mentah yang ingin di-encode. Untuk WiFi pakai format: wifi:ssid=NAMA;pass=PASSWORD;type=WPA (type default WPA, pass opsional untuk jaringan terbuka). Untuk lokasi pakai: latitude,longitude. Untuk QR kontak WhatsApp (agar saat discan langsung membuka chat/add contact WA, BUKAN dial telepon biasa) pakai format: wa NOMOR, contoh: wa 6281234567890. Selain itu kirim URL, email, nomor telepon, atau teks biasa apa adanya — jangan tambahkan prefix URI apapun sendiri.' } }, required: ['data'] },
    { name: 'scan_qr_code',        desc: 'Scan dan decode QR code dari gambar yang baru dikirim atau di-reply user pada pesan ini. Gunakan saat user minta "scan QR ini", "baca QR code ini", "QR ini isinya apa", atau sejenisnya, DAN ada gambar terlampir di pesan saat ini. JANGAN gunakan ini jika tidak ada gambar di pesan saat ini — minta user kirim atau reply gambar QR terlebih dahulu.', params: {} },
    { name: 'delete_status',       desc: 'Dipanggil ketika user (bukan owner) minta menghapus status WhatsApp yang baru diposting. Fitur ini TIDAK didukung — function ini hanya untuk memicu pesan penolakan yang jelas ke user.', params: {} },
]

const TOOL_DEFINITION_GENERATE_IMAGE = {
    name: 'generate_image',
    desc: 'Generate/buat gambar dari deskripsi teks (text-to-image AI)',
    params: { prompt: { type: 'string', desc: 'Deskripsi gambar yang ingin dibuat dalam bahasa Inggris' } },
    required: ['prompt'],
}

const TOOL_DEFINITION_GENERATE_VIDEO = {
    name: 'generate_video',
    desc: 'Generate/buat video dari deskripsi teks (text-to-video AI)',
    params: { prompt: { type: 'string', desc: 'Deskripsi video yang ingin dibuat dalam bahasa Inggris' } },
    required: ['prompt'],
}

function buildActiveToolDefinitions() {
    const tools = [...TOOL_DEFINITIONS_BASE]
    if (getValidProviders('image') !== null) tools.push(TOOL_DEFINITION_GENERATE_IMAGE)
    if (getValidProviders('video') !== null) tools.push(TOOL_DEFINITION_GENERATE_VIDEO)
    return tools
}

function buildSystemPrompt(botName, extraContext = '') {
    const hasImage = getValidProviders('image') !== null
    const hasVideo = getValidProviders('video') !== null

    const imageCapability = hasImage
        ? '- Generate gambar dari deskripsi teks via generate_image'
        : ''
    const videoCapability = hasVideo
        ? '- Generate video dari deskripsi teks via generate_video'
        : ''
    const imageRule = hasImage
        ? `
Aturan generate_image:
- Gunakan generate_image jika user meminta buat gambar, ilustrasi, atau foto dari deskripsi
- Terjemahkan prompt ke bahasa Inggris yang deskriptif sebelum dikirim ke tool
- Jangan gunakan untuk mencari gambar dari internet`
        : ''
    const videoRule = hasVideo
        ? `
Aturan generate_video:
- Gunakan generate_video jika user meminta buat video dari deskripsi
- Terjemahkan prompt ke bahasa Inggris yang deskriptif sebelum dikirim ke tool`
        : ''

    return `Kamu adalah ${botName}, asisten WhatsApp yang cerdas dan serbaguna.
Jawab dalam bahasa yang sama dengan user (Indonesia atau Inggris).

Kemampuanmu:
- Chat AI cerdas dan kontekstual
- Analisis gambar, video, dokumen
- Buat sticker dari gambar atau teks
- Buat poll
- Transkripsi voice note
- Rangkum konten dari URL yang dikirim user
- Cari informasi terkini di internet via search_web
- Cek cuaca real-time via get_weather
- Cek gempa terkini Indonesia via get_earthquake, dan gempa dunia/internasional via get_earthquake_global
- Download video/audio dari 1000+ platform via download_media
- Generate QR code via create_qr_code
- Scan QR code dari gambar via scan_qr_code
- React ke pesan sesuai suasana
- Edit atau hapus pesanmu sendiri${imageCapability ? '\n- ' + imageCapability.trim() : ''}${videoCapability ? '\n- ' + videoCapability.trim() : ''}

Aturan clear_history:
- "Hapus percakapan" / "hapus chat" / "hapus riwayat" / "lupakan semua" → maksud user adalah menghapus MEMORI/RIWAYAT obrolan supaya kamu tidak ingat topik sebelumnya. Gunakan clear_history untuk ini.
- clear_history TIDAK menghapus pesan WhatsApp itu sendiri (kamu tidak bisa menghapus pesan WhatsApp orang lain, hanya pesan balasanmu sendiri lewat delete_message).
- Setelah memanggil clear_history, JANGAN membahas atau mengingat topik apapun dari sebelum penghapusan, walaupun user bertanya lagi tentang itu setelahnya.

Aturan create_qr_code:
- Kirim data persis seperti yang diberikan user (URL, email, teks biasa) — jangan tambahkan mailto: atau prefix URI lain sendiri, tool sudah menanganinya otomatis.
- Untuk nomor telepon: secara default, nomor polos (misal 6281234567890) akan membuat QR yang men-dial nomor tersebut saat discan (fungsi telepon biasa). Kalau user maunya QR untuk buka WhatsApp/nambah kontak/mulai chat WA (misal "buatkan QR WhatsApp aku", "QR biar orang bisa chat WA aku", "QR kontak WA"), WAJIB pakai prefix "wa " (ada spasi) di depan nomornya, contoh: wa 6281234567890 — JANGAN kirim nomor polos untuk kasus ini karena hasilnya jadi QR telepon, bukan QR WhatsApp.
- Untuk permintaan WiFi, susun parameter data sebagai: wifi:ssid=NAMA;pass=PASSWORD;type=WPA — tanyakan dulu SSID dan passwordnya ke user kalau belum disebutkan.
- Untuk permintaan lokasi/koordinat, susun parameter data sebagai: latitude,longitude
- Tool ini TIDAK bisa scan/decode QR code yang sudah ada dari gambar — pakai scan_qr_code untuk itu.

Aturan scan_qr_code:
- Hanya gunakan ini jika pesan saat ini ada gambar terlampir (user kirim foto atau reply ke foto). Kalau tidak ada gambar di pesan ini, JANGAN panggil tool ini — minta user kirim atau reply ke gambar QR-nya dulu.
- Tool ini hanya decode — tidak bisa generate QR code. Pakai create_qr_code untuk permintaan pembuatan QR.

Aturan download_media:
- Gunakan download_media jika user meminta download, unduh, simpan, atau kirimkan file media
- Jika user menyebut "musiknya", "audionya", "lagunya" → type: "audio"
- Jika user menyebut "videonya", "reelsnya", "tiktoknya" → type: "video"
- Jika tidak jelas → type: "video" sebagai default
- Spotify SELALU type: "audio"
- Jangan gunakan download_media jika user hanya ingin rangkum atau analisis konten URL
- JANGAN panggil download_media jika URL yang diminta adalah alamat IP (mis. 192.168.x.x, 10.x.x.x, 127.0.0.1) atau hostname seperti "localhost"/"local". Untuk kasus ini, cukup balas singkat bahwa URL tersebut tidak bisa didownload karena mengarah ke alamat lokal/internal — JANGAN panggil tool-nya sama sekali.
- Aturan di atas HANYA berlaku untuk download_media. Kalau user sedang membahas/menunjukkan IP atau localhost dalam konteks LAIN (debugging, ngoding, testing server, preview aplikasi, troubleshooting, dll — bukan minta download file), itu bukan permintaan download dan boleh dibantu seperti biasa, tidak ada pembatasan apapun.

Aturan cuaca:
- Gunakan get_weather HANYA jika user bertanya cuaca suatu tempat secara spesifik
- Jika user bertanya cuaca di sini tanpa data lokasi, minta user bagikan lokasi

Aturan gempa:
- get_earthquake (BMKG) untuk gempa di Indonesia atau wilayah/provinsi Indonesia
- get_earthquake_global (USGS) untuk gempa di negara lain (Jepang, China, Filipina, Amerika, dll) atau gempa dunia secara umum
- Kalau user tidak menyebut lokasi sama sekali dan konteksnya tidak jelas, asumsikan Indonesia → pakai get_earthquake
${imageRule}${videoRule}
Aturan react_message:
- Gunakan react_message HANYA sebagai respons tambahan/pelengkap, BUKAN sebagai respons utama
- JANGAN gunakan react_message saat menerima gambar, video, audio, atau dokumen — selalu balas dengan teks deskripsi/analisis
- react_message boleh dipakai hanya untuk pesan teks singkat yang memang hanya butuh reaksi emosi (misal user bilang "makasih")

Aturan umum:
- Jangan tampilkan menu kecuali diminta
- Hormati data yang di-mask
- Gunakan search_web untuk berita terkini, harga, atau info real-time

${extraContext ? 'Konteks tambahan:\n' + extraContext : ''}`
}

function detectProvider(model) {
    if (!model) return 'unknown'
    const m = model.toLowerCase()
    if (m.startsWith('claude'))                                         return 'claude'
    if (m.startsWith('gemini'))                                         return 'gemini'
    if (m.startsWith('grok'))                                           return 'grok'
    if (m.startsWith('@cf/'))                                           return 'cloudflare'
    if (m.startsWith('gpt-oss'))                                        return 'cerebras'
    if (m.startsWith('meta-llama-') && /^meta-llama-\d/.test(m))        return 'sambanova'
    if (m.includes('/') && m.endsWith(':free'))                         return 'openrouter'
    if (m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return 'openai'
    if (m.startsWith('deepseek'))                                          return 'deepseek'
    if (m.startsWith('llama') || m.startsWith('mixtral') || m.startsWith('meta-llama') || m.startsWith('qwen') || m.startsWith('gemma')) return 'groq'
    if (m.startsWith('mistral') || m.startsWith('codestral') || m.startsWith('magistral') || m.startsWith('devstral') || m.startsWith('pixtral')) return 'mistral'
    if (m.startsWith('cerebras'))                                          return 'cerebras'
    if (m.includes('/') && !m.startsWith('black-forest') && !m.startsWith('openai/')) return 'openrouter'
    if (m.includes('/'))                                                return 'huggingface'
    return 'openai'
}

function getEndpoint(provider, model) {
    switch (provider) {
        case 'claude':      return 'https://api.anthropic.com/v1/messages'
        case 'gemini':      return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
        case 'grok':        return 'https://api.x.ai/v1/chat/completions'
        case 'groq':        return 'https://api.groq.com/openai/v1/chat/completions'
        case 'mistral':     return 'https://api.mistral.ai/v1/chat/completions'
        case 'deepseek':    return 'https://api.deepseek.com/v1/chat/completions'
        case 'cerebras':    return 'https://api.cerebras.ai/v1/chat/completions'
        case 'openrouter':  return 'https://openrouter.ai/api/v1/chat/completions'
        case 'sambanova':   return 'https://api.sambanova.ai/v1/chat/completions'
        case 'cloudflare':  return null
        case 'openai':      return 'https://api.openai.com/v1/chat/completions'
        case 'huggingface': return `https://api-inference.huggingface.co/models/${model}`
        default:            return 'https://api.openai.com/v1/chat/completions'
    }
}

function buildGeminiTools() {
    const activeTools = buildActiveToolDefinitions()
    return [{
        functionDeclarations: activeTools.map(t => {
            const props = {}
            for (const [k, v] of Object.entries(t.params || {})) {
                props[k] = {
                    type: v.type === 'array' ? 'ARRAY' : 'STRING',
                    description: v.desc,
                    ...(v.type === 'array' ? { items: { type: 'STRING' } } : {})
                }
            }
            return {
                name: t.name,
                description: t.desc,
                parameters: { type: 'OBJECT', properties: props, required: t.required || [] }
            }
        })
    }]
}

function buildClaudeTools() {
    const activeTools = buildActiveToolDefinitions()
    return activeTools.map(t => {
        const props = {}
        for (const [k, v] of Object.entries(t.params || {})) {
            props[k] = {
                type: v.type === 'array' ? 'array' : 'string',
                description: v.desc,
                ...(v.type === 'array' ? { items: { type: 'string' } } : {})
            }
        }
        return {
            name: t.name,
            description: t.desc,
            input_schema: { type: 'object', properties: props, required: t.required || [] }
        }
    })
}

function buildOpenAITools() {
    const activeTools = buildActiveToolDefinitions()
    return activeTools.map(t => {
        const props = {}
        for (const [k, v] of Object.entries(t.params || {})) {
            props[k] = {
                type: v.type === 'array' ? 'array' : 'string',
                description: v.desc,
                ...(v.type === 'array' ? { items: { type: 'string' } } : {})
            }
        }
        return {
            type: 'function',
            function: {
                name: t.name,
                description: t.desc,
                parameters: { type: 'object', properties: props, required: t.required || [] }
            }
        }
    })
}

function convertHistoryForProvider(history, provider) {
    if (provider === 'gemini') return history

    return history.map(h => ({
        role: h.role === 'model' ? 'assistant' : h.role,
        content: Array.isArray(h.parts) ? (h.parts[0]?.text || '') : (h.content || '')
    }))
}

const userHistory = {}
const userHistoryOrder = []
const MAX_HISTORY_USERS = 500

function touchHistoryOrder(jid) {
    const idx = userHistoryOrder.indexOf(jid)
    if (idx !== -1) userHistoryOrder.splice(idx, 1)
    userHistoryOrder.push(jid)
}

function evictOldestHistoryIfNeeded() {
    while (userHistoryOrder.length > MAX_HISTORY_USERS) {
        const oldest = userHistoryOrder.shift()
        delete userHistory[oldest]
    }
}

function getHistory(jid) {
    if (!userHistory[jid]) userHistory[jid] = []
    touchHistoryOrder(jid)
    return userHistory[jid]
}

function addHistory(jid, role, text) {
    if (!userHistory[jid]) userHistory[jid] = []

    userHistory[jid].push({ role, parts: [{ text }] })
    if (userHistory[jid].length > 20) {
        userHistory[jid] = userHistory[jid].slice(-20)
    }
    touchHistoryOrder(jid)
    evictOldestHistoryIfNeeded()
}

function clearHistory(jid) {
    userHistory[jid] = []
    touchHistoryOrder(jid)
}

function maskSensitiveData(text) {
    if (!text) return text

    text = text.replace(/(\+?62|0)[\s-]?8[0-9]{8,11}/g, m => {
        const d = m.replace(/[\s-]/g, '')
        return d.slice(0,4) + d.slice(4,-1).replace(/[0-9]/g,'x') + d.slice(-1)
    })

    text = text.replace(/[a-zA-Z0-9._%+\-]+@(?:[a-zA-Z0-9.\-]+\.)+[a-zA-Z]{2,}/g, m => {
        const [local, domain] = m.split('@')
        return local.slice(0,2) + local.slice(2).replace(/[a-zA-Z0-9]/g,'x') + '@' + domain
    })

    text = text.replace(/-?\d{1,3}\.\d{4,},\s*-?\d{1,3}\.\d{4,}/g, '[LOKASI_DISEMBUNYIKAN]')
    text = text.replace(/https?:\/\/(maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s]*/g, '[LINK_MAPS_DISEMBUNYIKAN]')

    text = text.replace(/\b([0-9]{6})[0-9]{6}([0-9]{4})\b/g, '$1xxxxxx$2')

    text = text.replace(/\b([0-9]{3})[0-9]{5,10}([0-9]{2})\b/g, m => {
        if (m.length < 10 || m.length > 16) return m
        return m.slice(0,3) + 'x'.repeat(m.length-5) + m.slice(-2)
    })

    text = text.replace(/\b([0-9]{4})[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?([0-9]{4})\b/g, '$1-xxxx-xxxx-$2')

    text = text.replace(/(password|sandi|pin|passwd|secret)\s*[:=]\s*\S+/gi, '$1: [DISEMBUNYIKAN]')
    text = text.replace(/(kode|otp|token|verifikasi|verification)\s*[:=]?\s*([0-9]{4,8})\b/gi, '$1: [KODE_DISEMBUNYIKAN]')
    return text
}

function buildGeminiRequest(key, model, history, text, mediaBase64, mediaMime, botName, extraContext) {
    const parts = []
    if (mediaBase64 && mediaMime) parts.push({ inline_data: { mime_type: mediaMime, data: mediaBase64 } })
    if (text) parts.push({ text: maskSensitiveData(text) })

    return {
        url: `${getEndpoint('gemini', model)}?key=${key}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [...history, { role: 'user', parts }],
            tools: buildGeminiTools(),
            systemInstruction: { parts: [{ text: buildSystemPrompt(botName, extraContext) }] }
        })
    }
}

function buildClaudeRequest(key, model, history, text, mediaBase64, mediaMime, botName, extraContext) {

    const convertedHistory = history.map(h => ({
        role: h.role === 'model' ? 'assistant' : h.role,
        content: Array.isArray(h.parts) ? (h.parts[0]?.text || '') : (h.content || '')
    }))

    const userContent = []
    if (mediaBase64 && mediaMime && mediaMime.startsWith('image/')) {
        userContent.push({ type: 'image', source: { type: 'base64', media_type: mediaMime, data: mediaBase64 } })
    }
    if (text) userContent.push({ type: 'text', text: maskSensitiveData(text) })

    const messages = [
        ...convertedHistory,
        { role: 'user', content: userContent.length === 1 && userContent[0].type === 'text' ? userContent[0].text : userContent }
    ]

    return {
        url: getEndpoint('claude', model),
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model,
            max_tokens: 1024,
            system: buildSystemPrompt(botName, extraContext),
            messages,
            tools: buildClaudeTools(),
        })
    }
}

function buildOpenAICompatRequest(key, model, provider, history, text, mediaBase64, mediaMime, botName, extraContext) {
    const convertedHistory = convertHistoryForProvider(history, provider)
    const userContent = []

    if (mediaBase64 && mediaMime && mediaMime.startsWith('image/')) {
        userContent.push({ type: 'image_url', image_url: { url: `data:${mediaMime};base64,${mediaBase64}` } })
    }
    if (text) userContent.push({ type: 'text', text: maskSensitiveData(text) })

    const messages = [
        { role: 'system', content: buildSystemPrompt(botName, extraContext) },
        ...convertedHistory,
        { role: 'user', content: userContent.length === 1 && userContent[0].type === 'text' ? userContent[0].text : userContent }
    ]

    return {
        url: getEndpoint(provider, model),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            model,
            messages,
            tools: buildOpenAITools(),
            tool_choice: 'auto',
            max_tokens: 1024,
            temperature: 0.7
        })
    }
}

function buildCloudflareRequest(key, model, history, text, mediaBase64, mediaMime, botName, extraContext) {
    const sep = key.indexOf(':')
    const accountId = sep === -1 ? '' : key.slice(0, sep)
    const apiToken = sep === -1 ? key : key.slice(sep + 1)

    const reqData = buildOpenAICompatRequest(apiToken, model, 'cloudflare', history, text, mediaBase64, mediaMime, botName, extraContext)
    reqData.url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`
    return reqData
}

function parseGeminiResponse(data) {
    if (data.error) return { error: true, code: data.error.code, message: data.error.message }
    if (!data.candidates || !data.candidates.length) return { error: true, message: 'No candidates' }
    const candidate = data.candidates[0]
    if (!candidate.content?.parts) return { error: true, message: 'No content parts' }

    const parts = candidate.content.parts
    const funcCall = parts.find(p => p.functionCall)
    if (funcCall) {
        return { type: 'function', name: funcCall.functionCall.name, args: funcCall.functionCall.args || {} }
    }
    const textPart = parts.find(p => p.text)
    return { type: 'text', text: textPart?.text || 'Tidak ada respons' }
}

function parseClaudeResponse(data) {
    if (data.error) return { error: true, code: data.error.type, message: data.error.message }
    if (!data.content || !data.content.length) return { error: true, message: 'No content in response' }

    const toolUse = data.content.find(b => b.type === 'tool_use')
    if (toolUse) {
        return { type: 'function', name: toolUse.name, args: toolUse.input || {} }
    }
    const textBlock = data.content.find(b => b.type === 'text')
    let content = textBlock?.text || 'Tidak ada respons'

    content = content.replace(/<\/?function[^>]*>/gi, '').replace(/<\/?tool_call[^>]*>/gi, '').trim()
    if (!content) content = 'Tidak ada respons'
    return { type: 'text', text: content }
}

function parseOpenAICompatResponse(data) {
    if (data.error) return { error: true, code: data.error.code || data.error.type, message: data.error.message }
    const choice = data.choices?.[0]
    if (!choice) return { error: true, message: 'No choices in response' }

    const msg = choice.message
    if (msg.tool_calls?.length) {
        const tc = msg.tool_calls[0]
        let args = {}
        try { args = JSON.parse(tc.function.arguments || '{}') } catch(e) {}
        return { type: 'function', name: tc.function.name, args }
    }

    let content = msg.content || 'Tidak ada respons'
    content = content.replace(/<\/?function[^>]*>/gi, '').replace(/<\/?tool_call[^>]*>/gi, '').trim()
    if (!content) content = 'Tidak ada respons'
    return { type: 'text', text: content }
}

const PLACEHOLDER_MODELS   = ['Ketikkan Model ID']
const PLACEHOLDER_KEYS     = ['Ketikkan API Key']
const PLACEHOLDER_PREFIXES = ['ISI_']

function isPlaceholderModel(model) {
    if (!model || !model.trim()) return true
    return PLACEHOLDER_MODELS.includes(model.trim())
}

function isPlaceholderKey(key) {
    if (!key || key.length <= 10) return true
    if (PLACEHOLDER_KEYS.includes(key.trim())) return true
    if (PLACEHOLDER_PREFIXES.some(p => key.startsWith(p))) return true
    return false
}

const _providerCache = {}
function getValidProviders(category) {
    if (category in _providerCache) return _providerCache[category]
    const list = AI_PROVIDERS[category] || []
    const valid = list.filter(p =>
        !isPlaceholderModel(p.model) &&
        p.keys && p.keys.some(k => !isPlaceholderKey(k))
    )
    const result = valid.length > 0 ? valid : null
    _providerCache[category] = result
    if (result === null) {
        console.log(`⚠️  [AI:${category}] Model/key masih placeholder atau kosong → fitur dinonaktifkan`)
    } else {
        console.log(`✅ [AI:${category}] ${result.length} provider valid ditemukan`)
    }
    return result
}

function hasValidKeys() { return getValidProviders('text') !== null }

function log(level, provider, model, msg, extra = '') {
    const ts = new Date().toISOString().slice(11,19)
    const tag = `[${ts}][AI:${provider}/${model}]`
    if (level === 'info')  console.log(`ℹ️  ${tag} ${msg}${extra ? ' | ' + extra : ''}`)
    if (level === 'ok')    console.log(`✅ ${tag} ${msg}${extra ? ' | ' + extra : ''}`)
    if (level === 'warn')  console.warn(`⚠️  ${tag} ${msg}${extra ? ' | ' + extra : ''}`)
    if (level === 'error') console.error(`❌ ${tag} ${msg}${extra ? ' | ' + extra : ''}`)
    if (level === 'skip')  console.log(`⏭️  ${tag} ${msg}${extra ? ' | ' + extra : ''}`)
}

async function callAI(jid, text, mediaBase64 = null, mediaMime = null, extraContext = '', botName = 'AI Bot') {
    const validProviders = getValidProviders('text')

    if (validProviders === null) {
        return null
    }

    const history = getHistory(jid)

    for (const provider of validProviders) {
        const { model, keys } = provider
        const providerName = detectProvider(model)

        for (const key of keys) {
            if (!key || key.length <= 10 || key.startsWith('ISI_') || key === 'Ketikkan API Key') {
                log('skip', providerName, model, `Key tidak valid, skip`)
                continue
            }

            log('info', providerName, model, `Mencoba request...`, `jid=${jid.split('@')[0]}`)

            try {
                let reqData
                if (providerName === 'gemini') {
                    reqData = buildGeminiRequest(key, model, history, text, mediaBase64, mediaMime, botName, extraContext)
                } else if (providerName === 'claude') {
                    reqData = buildClaudeRequest(key, model, history, text, mediaBase64, mediaMime, botName, extraContext)
                } else if (providerName === 'cloudflare') {
                    reqData = buildCloudflareRequest(key, model, history, text, mediaBase64, mediaMime, botName, extraContext)
                } else {
                    reqData = buildOpenAICompatRequest(key, model, providerName, history, text, mediaBase64, mediaMime, botName, extraContext)
                }

                const res = await fetch(reqData.url, {
                    method: 'POST',
                    headers: reqData.headers,
                    body: reqData.body,
                    signal: AbortSignal.timeout(providerName === 'gemini' ? 10000 : 8000)
                })

                const data = await res.json()

                const parsed = providerName === 'gemini'
                    ? parseGeminiResponse(data)
                    : providerName === 'claude'
                        ? parseClaudeResponse(data)
                        : parseOpenAICompatResponse(data)

                if (parsed.error) {
                    const code = parsed.code

                    if (code === 429 || code === 503 || code === 'rate_limit_exceeded' || code === 'server_error' || code === 'rate_limit_error' || code === 'overloaded_error' || code === 'api_error') {
                        log('warn', providerName, model, `Rate limit / server error, coba berikutnya`, `code=${code} httpStatus=${res.status}`)
                        continue
                    }

                    log('error', providerName, model, `Error dari API`, `code=${code} msg=${parsed.message} httpStatus=${res.status}`)
                    continue
                }

                log('ok', providerName, model, `Respons diterima`, `type=${parsed.type}${parsed.name ? ' fn=' + parsed.name : ''}`)

                if (parsed.type === 'text') {
                    addHistory(jid, 'user', maskSensitiveData(text) || '[media]')
                    addHistory(jid, 'model', parsed.text)
                }

                return parsed

            } catch (e) {
                if (e.name === 'TimeoutError' || e.name === 'AbortError') {
                    log('warn', providerName, model, `Timeout (15s), coba berikutnya`)
                } else if (e.message?.includes('fetch')) {
                    log('warn', providerName, model, `Network error, coba berikutnya`, e.message)
                } else {
                    log('error', providerName, model, `Exception tidak terduga`, e.message)
                }
                continue
            }
        }

        log('skip', providerName, model, `Semua key gagal, pindah provider berikutnya`)
    }

    console.error('❌ [AI] Semua provider text gagal. Bot lokal sebagai fallback.')
    return null
}

async function generateImage(prompt, externalSignal = null) {
    const validProviders = getValidProviders('image')

    if (validProviders === null) {
        console.warn('⚠️  [AI:image] Tidak ada provider image dikonfigurasi. Fitur generate gambar nonaktif.')
        return null
    }

    for (const provider of validProviders) {
        const { model, keys } = provider
        const isCloudflare = model.startsWith('@cf/')
        const providerLabel = isCloudflare ? 'cloudflare' : 'huggingface'

        for (const key of keys) {
            if (!key || key.length <= 10 || key.startsWith('ISI_') || key === 'Ketikkan API Key') {
                log('skip', providerLabel, model, `Key tidak valid, skip`)
                continue
            }

            log('info', providerLabel, model, `Generate image...`, `prompt="${prompt.slice(0,40)}..."`)

            try {

                const timeoutSignal = AbortSignal.timeout(30000)
                const signal = externalSignal ? AbortSignal.any([timeoutSignal, externalSignal]) : timeoutSignal

                if (isCloudflare) {

                    const sep = key.indexOf(':')
                    const accountId = sep === -1 ? '' : key.slice(0, sep)
                    const apiToken = sep === -1 ? key : key.slice(sep + 1)

                    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ prompt }),
                        signal
                    })

                    if (!res.ok) {
                        const errText = await res.text()
                        log('warn', providerLabel, model, `HTTP ${res.status}, coba berikutnya`, errText.slice(0,100))
                        continue
                    }

                    const data = await res.json()
                    if (!data.success || !data.result?.image) {
                        log('warn', providerLabel, model, `Response tidak valid, coba berikutnya`, JSON.stringify(data.errors || data).slice(0,150))
                        continue
                    }

                    const buffer = Buffer.from(data.result.image, 'base64')
                    log('ok', providerLabel, model, `Image berhasil di-generate`, `size=${(buffer.length/1024).toFixed(1)}KB`)
                    return buffer
                }

                const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ inputs: prompt }),
                    signal
                })

                if (!res.ok) {
                    const errText = await res.text()
                    log('warn', providerLabel, model, `HTTP ${res.status}, coba berikutnya`, errText.slice(0,100))
                    continue
                }

                const buffer = Buffer.from(await res.arrayBuffer())
                log('ok', providerLabel, model, `Image berhasil di-generate`, `size=${(buffer.length/1024).toFixed(1)}KB`)
                return buffer

            } catch (e) {
                if (e.name === 'TimeoutError' || e.name === 'AbortError') {
                    log('warn', providerLabel, model, `Timeout (30s), coba berikutnya`)
                } else {
                    log('error', providerLabel, model, `Exception`, e.message)
                }
                continue
            }
        }
    }

    console.error('❌ [AI:image] Semua provider image gagal.')
    return null
}

async function generateVideo(prompt, externalSignal = null) {
    const validProviders = getValidProviders('video')

    if (validProviders === null) {
        console.warn('⚠️  [AI:video] Tidak ada provider video dikonfigurasi. Fitur generate video nonaktif.')
        return null
    }

    for (const provider of validProviders) {
        const { model, keys } = provider

        for (const key of keys) {
            if (!key || key.length <= 10 || key.startsWith('ISI_') || key === 'Ketikkan API Key') {
                log('skip', 'huggingface', model, `Key tidak valid, skip`)
                continue
            }

            log('info', 'huggingface', model, `Generate video...`, `prompt="${prompt.slice(0,40)}..."`)

            try {
                const timeoutSignal = AbortSignal.timeout(60000)
                const signal = externalSignal ? AbortSignal.any([timeoutSignal, externalSignal]) : timeoutSignal

                const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ inputs: prompt }),
                    signal
                })

                if (!res.ok) {
                    const errText = await res.text()
                    log('warn', 'huggingface', model, `HTTP ${res.status}, coba berikutnya`, errText.slice(0,100))
                    continue
                }

                const buffer = Buffer.from(await res.arrayBuffer())
                log('ok', 'huggingface', model, `Video berhasil di-generate`, `size=${(buffer.length/1024).toFixed(1)}KB`)
                return buffer

            } catch (e) {
                if (e.name === 'TimeoutError' || e.name === 'AbortError') {
                    log('warn', 'huggingface', model, `Timeout (60s), coba berikutnya`)
                } else {
                    log('error', 'huggingface', model, `Exception`, e.message)
                }
                continue
            }
        }
    }

    console.error('❌ [AI:video] Semua provider video gagal.')
    return null
}

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

function spawnPromise(cmd, args, onSpawn = null) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args)
        if (onSpawn) onSpawn(proc)
        let stderr = ''
        proc.stderr.on('data', d => { stderr += d.toString() })
        proc.on('close', code => {
            if (code !== 0) reject(new Error(`${cmd} exit ${code}: ${stderr}`))
            else resolve()
        })
        proc.on('error', reject)
    })
}

async function imageToSticker(buffer, onSpawn = null) {
    const tmpIn  = path.join(os.tmpdir(), `sticker_in_${Date.now()}.jpg`)
    const tmpOut = path.join(os.tmpdir(), `sticker_out_${Date.now()}.webp`)
    fs.writeFileSync(tmpIn, buffer)
    try {
        await spawnPromise('ffmpeg', ['-i', tmpIn, '-vf', 'scale=512:512:force_original_aspect_ratio=decrease', '-y', tmpOut], onSpawn)
        return fs.readFileSync(tmpOut)
    } finally {
        try { fs.unlinkSync(tmpIn) } catch(e) {}
        try { fs.unlinkSync(tmpOut) } catch(e) {}
    }
}

async function videoToSticker(buffer, onSpawn = null) {
    const tmpIn  = path.join(os.tmpdir(), `sticker_vin_${Date.now()}.mp4`)
    const tmpOut = path.join(os.tmpdir(), `sticker_vout_${Date.now()}.webp`)
    fs.writeFileSync(tmpIn, buffer)
    try {
        await spawnPromise('ffmpeg', [
            '-i', tmpIn,
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15',
            '-vcodec', 'libwebp', '-lossless', '0', '-compression_level', '6',
            '-q:v', '50', '-loop', '0', '-preset', 'picture', '-an', '-t', '5', '-y', tmpOut
        ], onSpawn)
        return fs.readFileSync(tmpOut)
    } finally {
        try { fs.unlinkSync(tmpIn) } catch(e) {}
        try { fs.unlinkSync(tmpOut) } catch(e) {}
    }
}

async function textToSticker(text, onSpawn = null) {
    const tmpOut = path.join(os.tmpdir(), `sticker_text_${Date.now()}.webp`)
    const safeText = text.replace(/[^\w\s\u00C0-\u024F\u0400-\u04FF.,!?:;\-]/g, '').slice(0, 100).trim() || 'Hello!'
    try {
        await spawnPromise('convert', [
            '-size', '512x512', 'xc:white',
            '-font', 'DejaVu-Sans-Bold', '-fill', 'black', '-gravity', 'Center',
            '-size', '480x480', `caption:${safeText}`,
            '-gravity', 'Center', '-composite', tmpOut
        ], onSpawn)
        return fs.readFileSync(tmpOut)
    } finally {
        try { fs.unlinkSync(tmpOut) } catch(e) {}
    }
}

module.exports = {
    callAI,
    generateImage,
    generateVideo,
    getValidProviders,
    getHistory,
    addHistory,
    clearHistory,
    maskSensitiveData,
    hasValidKeys,
    imageToSticker,
    videoToSticker,
    textToSticker,
}
