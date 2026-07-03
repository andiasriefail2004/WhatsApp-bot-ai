const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const readline = require('readline')
const qrcode = require('qrcode-terminal')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function question(prompt) {
    return new Promise(resolve => rl.question(prompt, resolve))
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function connectToWA(usePairingCode, phoneNumber) {
    const { state, saveCreds } = await useMultiFileAuthState('./auth')

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    })

    sock.ev.on('creds.update', saveCreds)

    // Minta pairing code setelah WS connected, beri jeda 2 detik
    if (usePairingCode && !sock.authState.creds.registered) {
        await sleep(2000)
        try {
            const number = phoneNumber.replace(/[^0-9]/g, '')
            const code = await sock.requestPairingCode(number)
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            console.log(`🔑 Pairing Code: ${code}`)
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            console.log('Langkah:')
            console.log('1. Buka WhatsApp di HP')
            console.log('2. Perangkat Tertaut > Tautkan dengan nomor telepon')
            console.log('3. Masukkan kode di atas\n')
        } catch(e) {
            console.log('❌ Gagal minta pairing code:', e.message)
            rl.close()
            process.exit(1)
        }
    }

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {

        if (!usePairingCode && qr) {
            console.log('\n📱 Scan QR Code berikut dengan WhatsApp:\n')
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode
            if (code === DisconnectReason.loggedOut) {
                console.log('❌ Logout. Hapus folder auth dan jalankan ulang.')
            } else {
                console.log('❌ Koneksi terputus. Jalankan ulang register.js')
            }
            rl.close()
            process.exit(1)
        }

        if (connection === 'open') {
            console.log('\n✅ Login berhasil! Bot siap dijalankan.')
            console.log('Jalankan: node bot.js\n')
            rl.close()
            process.exit(0)
        }
    })
}

async function main() {
    console.log('\n🤖 WhatsApp Bot — Setup Login')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('1. Scan QR Code')
    console.log('2. Pairing Code (tanpa kamera)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const pilihan = await question('Pilih metode login (1/2): ')

    if (pilihan.trim() === '1') {
        console.log('\n⏳ Memuat QR Code...')
        rl.close()
        await connectToWA(false, '')
    } else if (pilihan.trim() === '2') {
        const nomor = await question('Masukkan nomor WA (contoh: 6281234567890): ')
        if (!nomor.trim()) {
            console.log('❌ Nomor tidak boleh kosong!')
            rl.close()
            process.exit(1)
        }
        console.log('\n⏳ Menghubungkan ke WhatsApp, harap tunggu...')
        rl.close()
        await connectToWA(true, nomor.trim())
    } else {
        console.log('❌ Pilihan tidak valid!')
        rl.close()
        process.exit(1)
    }
}

main()
