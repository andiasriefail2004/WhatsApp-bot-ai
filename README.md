# 🤖 WhatsApp AI Bot INDONESIA 

Bot WhatsApp yang powerful dan kaya fitur, dibangun dengan **Baileys** dan dukungan multi-provider AI. Mendukung manajemen grup, download media, info gempa/cuaca, chat AI, generate gambar, dan masih banyak lagi, Tersedia Versi Bahasa Inggris Di : 

---

## ✨ Fitur

| Kategori | Fitur |
|---|---|
| 🤖 **AI & Chat** | Chat AI multi-provider, generate gambar, generate video, transkripsi voice note |
| 🎨 **Media** | Pembuat sticker (gambar/video/teks), generate & scan QR code |
| 📥 **Downloader** | YouTube, TikTok, Instagram, Spotify, 1000+ platform via yt-dlp |
| 🌍 **Info** | Cuaca real-time, data gempa Indonesia & dunia (BMKG + USGS) |
| ⏰ **Penjadwalan** | Cron job, reminder dengan dukungan timezone |
| 🎮 **Game** | Poll, Kuis |
| 📚 **Sastra** | Cerpen, pantun, puisi acak |
| ✨ **Inspirasi** | Motivasi, fakta menarik, renungan, pemikiran filosofis |
| 👥 **Admin Grup** | 30+ command manajemen grup |
| 👑 **Owner** | Broadcast, ban, statistik, kontrol grup, dan lainnya |

---

## 🤖 Provider AI yang Didukung

Atur satu atau lebih provider di `modules/ai.js` — kamu hanya perlu **satu** key yang aktif. Bot akan mencoba tiap provider yang dikonfigurasi secara berurutan dan otomatis pindah ke provider berikutnya kalau gagal.

**Teks / Chat:** Anthropic, Google, xAI, Groq, Mistral, Cerebras, OpenRouter, SambaNova, Cloudflare AI  
**Generate Gambar:** Hugging Face, Cloudflare AI  
**Transkripsi Audio:** Hugging Face

---

## 📋 Kebutuhan Sistem

- **Node.js** v20 atau lebih baru
- **Python** 3.x
- **Termux** (Android) atau environment Linux apa saja

---

## 💡 Rekomendasi

Beberapa hal ini bukan wajib, tapi sangat disarankan supaya bot berjalan lebih stabil dan bisa dipahami lebih dalam sebelum kamu mulai setup.

### Gunakan nomor WhatsApp Business

Disarankan pakai nomor yang terdaftar di aplikasi **WhatsApp Business**, bukan WhatsApp biasa, untuk dijadikan nomor bot. WhatsApp Business dirancang untuk penggunaan otomatis/semi-otomatis seperti ini, dan secara umum punya batas rate limit yang sedikit lebih longgar dibanding akun personal biasa — cocok untuk bot yang membalas banyak pesan dan menjalankan berbagai command. Nomor bot dan nomor pribadi kamu sebaiknya juga dipisah, supaya kalau ada masalah di sisi WhatsApp (limit, banned sementara, dll), akun pribadi kamu tidak ikut terdampak.

### Versi Baileys yang sudah diuji

Project ini sudah diuji dan berjalan stabil menggunakan **`@whiskeysockets/baileys` versi `7.0.0-rc13`**. Karena Baileys adalah library reverse-engineered (tidak resmi dari WhatsApp) yang terus berubah mengikuti update protokol WhatsApp, versi terbaru yang paling baru dirilis tidak selalu otomatis lebih stabil untuk setup ini — kadang butuh penyesuaian tambahan setelah ada rilis baru. Kalau kamu ingin hasil yang paling sesuai dengan dokumentasi ini (termasuk bagian troubleshooting Error 401 di bawah, yang beberapa patch-nya spesifik untuk baris kode versi ini), kunci ke versi ini dulu:

```bash
npm install @whiskeysockets/baileys@7.0.0-rc13
```

Kalau kamu tetap mau mencoba versi lebih baru, tidak masalah — cukup pahami bahwa sebagian patch di bagian troubleshooting mungkin perlu disesuaikan nomor barisnya (soalnya patch tersebut memakai `sed` yang mengincar baris kode spesifik).

### Sistem antrian per-user — kenapa ini penting

Bot ini sudah punya sistem antrian bawaan (`modules/queue.js`) yang membatasi **satu user hanya boleh punya satu proses berat berjalan di satu waktu** — baik itu bikin sticker, download, atau generate gambar/video/QR. Kalau kamu coba jalankan proses baru padahal proses sebelumnya belum selesai, bot akan menolak dengan pesan minta kamu `.cp` (atau `.cdl` khusus download) dulu sebelum mulai yang baru.

Ini bukan sekadar pembatasan sepele — tanpa mekanisme ini, banyak user yang memicu banyak proses `ffmpeg` (untuk sticker), download, atau generate gambar secara bersamaan bisa membuat penggunaan RAM bot melonjak drastis dan berpotensi crash, khususnya kalau bot dijalankan di device dengan resource terbatas seperti HP lewat Termux. Dengan antrian ini, proses-proses berat dijalankan lebih terkontrol satu-satu per user, sehingga penggunaan RAM bot tetap jauh lebih stabil.

Owner dikecualikan dari pembatasan ini (command owner selalu langsung jalan tanpa antre), jadi kalau kamu owner dan ingin testing beberapa proses sekaligus, itu tetap bisa dilakukan.

---

## 🚀 Instalasi

### Langkah 1 — Install paket sistem

```bash
# Update paket
pkg update && pkg upgrade -y

# Install paket yang dibutuhkan
pkg install rust nodejs ffmpeg imagemagick python git -y
```

| Paket | Digunakan untuk |
|---|---|
| `rust` | Compile `libsignal`, dependency native dari `@whiskeysockets/baileys` (diinstall di Langkah 4) — bot tidak bisa jalan tanpa ini |
| `nodejs` | Menjalankan bot itu sendiri |
| `ffmpeg` | `.sticker` — mengubah gambar/video jadi sticker `.webp` |
| `imagemagick` | `.textsticker` / `.ts` — membuat sticker dari teks (pakai command `convert`) |
| `python` | Menjalankan `yt-dlp` dan `spotdl` (diinstall di Langkah 2) |
| `git` | Clone repository (lewati kalau kamu copy file secara manual) |

### Langkah 2 — Install tools Python

```bash
pip install yt-dlp spotdl
```

| Paket | Digunakan untuk |
|---|---|
| `yt-dlp` | `.dl`, `.dytmp3`, `.dytmp4`, `.dtt` — download video/audio dari YouTube, TikTok, dan 1000+ situs lainnya |
| `spotdl` | `.sp` — download audio dari link Spotify |

### Langkah 3 — Clone atau copy project

```bash
# Kalau clone dari GitHub
git clone https://github.com/andiasriefail2004/WhatsApp-bot-ai.git
cd nama-repo-bot

# Atau buat folder secara manual
mkdir ~/bot && cd ~/bot
```

### Langkah 4 — Install paket Node.js

```bash
npm install @whiskeysockets/baileys node-cron qrcode-terminal qrcode jsqr jimp
```

Setiap paket di bawah ini wajib ada — bot akan melempar error `Cannot find module` saat start kalau ada yang hilang.

| Paket | Digunakan untuk |
|---|---|
| `@whiskeysockets/baileys` | Library koneksi WhatsApp itu sendiri — wajib ada supaya bot bisa berfungsi sama sekali |
| `node-cron` | `.cron`, `.reminder` — pesan terjadwal dan reminder |
| `qrcode-terminal` | Menampilkan QR code login langsung di terminal saat menjalankan `register-wa.js` |
| `qrcode` | `.buatqr` / `.cqr` — generate gambar QR code |
| `jsqr` | `.scanqr` / `.sqr` — decode/membaca QR code dari gambar |
| `jimp` | Membaca data pixel gambar untuk `.scanqr`, **dan** dibutuhkan Baileys sendiri untuk generate thumbnail gambar (termasuk untuk `.buatqr` dan sticker) — lihat [bagian troubleshooting image processing](#️-perbaikan-gambar--qr-code-gagal-terkirim-atau-di-scan-no-image-processing-library) kalau kamu mengalami error thumbnail |

> `sharp` adalah alternatif dari `jimp` untuk kebutuhan thumbnail Baileys, dan Baileys akan lebih memilih `sharp` kalau keduanya terinstall. `sharp` **tidak dimasukkan di atas** karena butuh binary native `libvips` yang tidak punya versi prebuilt untuk Android/Termux — instalasi di sana biasanya gagal dimuat saat runtime. `jimp` murni JavaScript dan jalan di mana saja, termasuk Termux, jadi ini pilihan default yang lebih aman untuk setup ini. Kalau kamu menjalankan bot di server Linux biasa (bukan Termux), kamu bisa tambahan install `sharp` untuk performa sedikit lebih baik: `npm install sharp`.

### Langkah 5 — Konfigurasi bot

Ada **dua file** yang wajib kamu edit sebelum menjalankan bot. Setiap value yang perlu diganti ditulis sebagai placeholder yang diawali `ISI_` atau `ENTER_`/`YOUR_` — cari string tersebut kalau kamu mau memastikan tidak ada yang terlewat.

#### 5a. `modules/owner.js` — wajib

```js
const OWNER_NUMBERS = ['62xxxxxxxxxx']   // Nomor WhatsApp kamu, hanya digit, tanpa tanda +
```

| Placeholder | Diisi dengan |
|---|---|
| `OWNER_NUMBERS` | Nomor WhatsApp kamu sendiri (bisa lebih dari satu), kode negara di depan, tanpa `+`, tanpa spasi (contoh: `6281234567890`). Ini menentukan siapa yang bisa pakai command khusus owner dan lihat menu owner yang tersembunyi. |

> Nama tampilan bot (`BOT_NAME`) sudah didefinisikan langsung di `bot.js` (defaultnya `'AI Bot'`) — edit langsung di sana kalau kamu mau menggantinya.

#### 5b. `modules/ai.js` — opsional tapi disarankan

File ini berisi beberapa provider AI. Kamu tidak perlu mengisi semuanya — **satu key yang aktif sudah cukup**. Bot akan mencoba tiap provider yang dikonfigurasi secara berurutan dan otomatis pindah ke provider berikutnya kalau salah satu gagal atau kena rate limit.

Setiap entri provider bentuknya seperti ini:

```js
{
    model: '...',
    keys: ['ISI_..._KEY_1']   // ← ganti placeholder ini dengan API key kamu
}
```

Cari baris `keys: ['ISI_...']` untuk provider mana pun yang kamu punya key-nya, lalu ganti string placeholder-nya dengan key asli kamu. Biarkan yang lain apa adanya — provider dengan key placeholder akan otomatis dilewati.

> Kalau kamu skip file ini sepenuhnya, bot tetap jalan — cuma chat AI dan generate gambar/video jadi tidak tersedia. Semua command lain tetap berfungsi normal.

#### 5c. Cuaca — tidak perlu konfigurasi

`modules/weather.js` memakai [Open-Meteo](https://open-meteo.com), API publik gratis yang **tidak butuh API key atau pendaftaran**. Tidak ada yang perlu diedit di file ini.

### Copy / update file

Kalau kamu download file satu-satu alih-alih clone seluruh repo (misalnya untuk update bot setelah ada perbaikan, atau setup baru di HP lewat Termux), copy tiap file ke lokasi yang benar. `bot.js` dan `register-wa.js` ditaruh di **root project** — sisanya masuk ke folder **`modules/`**.

```bash
# File di root
cp /sdcard/Download/bot.js ~/bot.js
cp /sdcard/Download/register-wa.js ~/register-wa.js

# File modules/
cp /sdcard/Download/ai.js ~/modules/ai.js
cp /sdcard/Download/downloader.js ~/modules/downloader.js
cp /sdcard/Download/gempa.js ~/modules/gempa.js
cp /sdcard/Download/group.js ~/modules/group.js
cp /sdcard/Download/groupStats.js ~/modules/groupStats.js
cp /sdcard/Download/inspirasi.js ~/modules/inspirasi.js
cp /sdcard/Download/interactive.js ~/modules/interactive.js
cp /sdcard/Download/sastra.js ~/modules/sastra.js
cp /sdcard/Download/owner.js ~/modules/owner.js
cp /sdcard/Download/poll.js ~/modules/poll.js
cp /sdcard/Download/qr.js ~/modules/qr.js
cp /sdcard/Download/queue.js ~/modules/queue.js
cp /sdcard/Download/quiz.js ~/modules/quiz.js
cp /sdcard/Download/sticker.js ~/modules/sticker.js
cp /sdcard/Download/weather.js ~/modules/weather.js
```

> Sesuaikan `/sdcard/Download/` dengan lokasi file hasil download kamu yang sebenarnya — ini folder Download default di Android/Termux. Kalau kamu cuma update satu-dua file (misal setelah bug fix), jalankan baris yang relevan saja, tidak perlu semuanya.

> **Catatan:** menjalankan `node bot.js` setelah copy file di atas hanya berlaku kalau kamu **update bot yang sudah login** — restart bot-nya setelah copy file baru. Kalau ini **instalasi baru**, lewati dulu dan lanjut ke Langkah 6 di bawah; kamu perlu login dulu sebelum `bot.js` bisa jalan.

### Langkah 6 — Login ke WhatsApp

```bash
node register-wa.js
```

Pilih metode login kamu:
- **Opsi 1:** QR Code (scan pakai WhatsApp)
- **Opsi 2:** Pairing Code (masukkan di WhatsApp → Perangkat Tertaut)

Setelah login berhasil, folder `./auth/` akan otomatis dibuat berisi file session kamu (~800+ file, ini normal).

### Langkah 7 — Jalankan bot

```bash
node bot.js
```

Saat start, bot akan mengecek apakah bisa generate thumbnail gambar dengan benar (dibutuhkan untuk sticker, QR code, dan gambar apa pun yang dikirim). Kalau ada yang bermasalah, bot akan menampilkan warning dengan solusi yang tepat — lihat [Perbaikan: Gambar / QR code gagal terkirim atau di-scan](#️-perbaikan-gambar--qr-code-gagal-terkirim-atau-di-scan-no-image-processing-library) di bawah.

---

## ⚠️ Perbaikan Error 401 (Connection Failure)

Kalau kamu lihat error ini:
```
statusCode=401 reason=Connection Failure
lidDbMigrated: false
```

Ini adalah bug yang sudah dikenal di Baileys. Terapkan patch berikut:

```bash
# Patch 1: Perbaiki passive connection
sed -i 's/passive: true,/passive: false,/g' \
  ~/node_modules/@whiskeysockets/baileys/lib/Utils/validate-connection.js

# Patch 2: Hapus lidDbMigrated
sed -i '/lidDbMigrated: false/d' \
  ~/node_modules/@whiskeysockets/baileys/lib/Utils/validate-connection.js

# Patch 3: Perbaiki noise init
sed -i 's/await noise\.finishInit();/noise.finishInit();/g' \
  ~/node_modules/@whiskeysockets/baileys/lib/Socket/socket.js
```

Lalu hapus session auth kamu dan login ulang:

```bash
rm -rf ~/auth
node register-wa.js
```

---

## ⚠️ Perbaikan Error 401 (Stream Errored — conflict / device_removed)

```
statusCode=401 reason=Stream Errored (conflict)
type: device_removed
```

Ini artinya WhatsApp mendeteksi dua session berjalan bersamaan (misalnya kamu buka WhatsApp di HP sementara bot sedang jalan, atau menjalankan bot dua kali). Cukup restart bot-nya:

```bash
node bot.js
```

---

## ⚠️ Perbaikan: Gambar / QR code gagal terkirim atau di-scan ("No image processing library")

Kalau bot mengirim gambar (sticker, QR code dari `.buatqr`, dll) dan gambarnya tidak bisa di-scan dengan benar atau terlihat rusak, cek log terminal kamu untuk pesan ini:

```
Error: No image processing library available
    at extractImageThumb (.../node_modules/@whiskeysockets/baileys/lib/Utils/messages-media.js:...)
```

**Bot mendeteksi ini secara otomatis** dan menampilkan warning dengan solusi tepat saat start. Kalau kamu lihat warning tersebut, ikuti petunjuknya — atau terapkan perbaikan manual di bawah ini.

### Kenapa ini terjadi

Baileys butuh `sharp` atau `jimp` terinstall untuk generate thumbnail setiap gambar yang dikirim. Dua masalah terpisah biasanya menyebabkan ini gagal, terutama di Android/Termux:

1. **`sharp` gagal dimuat.** Butuh binary native `libvips`, dan tidak ada versi prebuilt untuk arsitektur `arm64` Android. Instalasinya (`npm install sharp`) sering berhasil, tapi *memuatnya* saat runtime melempar error seperti `Could not load the "sharp" module using the android-arm64 runtime`.
2. **`jimp` terinstall dengan benar, tapi Baileys tetap tidak bisa mendeteksinya.** Beberapa versi Baileys (rc13 dan sebelumnya) punya bug: mereka mengecek `typeof Jimp === 'object'` untuk memastikan jimp tersedia, tapi `Jimp` selalu di-export sebagai class — `typeof` sebuah class adalah `'function'`, bukan pernah `'object'`. Pengecekan ini diam-diam selalu gagal, walaupun jimp sebenarnya berfungsi sempurna.

Baileys tidak crash saat ini terjadi — pesannya tetap terkirim — tapi tanpa thumbnail yang valid, beberapa client (termasuk scanner QR bawaan WhatsApp) akan gagal membaca gambarnya dengan benar.

### Solusi

```bash
npm install jimp
```

Lalu cek apakah Baileys yang terinstall punya bug ini:

```bash
sed -n '116p' node_modules/@whiskeysockets/baileys/lib/Utils/messages-media.js
```

Kalau baris tersebut **tidak** persis berbunyi:
```js
    else if ('jimp' in lib && typeof lib.jimp?.Jimp === 'function') {
```

...patch dengan:

```bash
sed -i "116s/.*/    else if ('jimp' in lib \&\& typeof lib.jimp?.Jimp === 'function') {/" \
  node_modules/@whiskeysockets/baileys/lib/Utils/messages-media.js
```

Restart bot setelahnya. Patch ini aman dijalankan walaupun kamu tidak yakin apakah dibutuhkan — kalau barisnya sudah cocok, command ini tidak mengubah apa pun.

> **Solusi jangka panjang:** rilis Baileys yang lebih baru mungkin sudah memperbaiki bug ini. Menjalankan `npm update @whiskeysockets/baileys` sesekali cukup berguna — kalau bug-nya sudah hilang di upstream, patch `sed` di atas jadi no-op dan tetap aman dijalankan.

### Cek juga quiet zone QR code

Kalau gambar terkirim dengan normal (tidak ada error thumbnail) tapi **QR code hasil generate** tetap tidak bisa di-scan, ini masalah lain yang tidak berhubungan: quiet zone QR (border putih di sekitarnya) mungkin terlalu tipis. Ini sudah ditangani di `modules/qr.js` (`margin: 4`, sesuai minimum standar ISO/IEC 18004) — tapi kalau kamu sudah memodifikasi file itu, jangan set `margin` di bawah `4` atau scanner WhatsApp (dan beberapa scanner lain) akan menolak kode tersebut walaupun tampilannya normal.

---

## 📁 Struktur Project

```
bot/
├── bot.js                  # File utama bot
├── register-wa.js          # Login / setup session
├── auth/                   # File session (auto-generated, JANGAN DIHAPUS)
├── package.json
└── modules/
    ├── ai.js               # Provider AI & generate gambar/video
    ├── downloader.js       # Wrapper yt-dlp / spotdl
    ├── gempa.js            # Data gempa BMKG & USGS
    ├── group.js            # Command admin grup
    ├── groupStats.js       # Statistik grup
    ├── inspirasi.js        # Motivasi, fakta menarik, dll
    ├── interactive.js      # Pesan interaktif (tombol, list)
    ├── sastra.js           # Cerpen, pantun, puisi
    ├── owner.js            # Command owner
    ├── poll.js             # Pembuatan & tracking poll
    ├── qr.js               # Generate & scan QR code
    ├── queue.js            # Manajer antrian download
    ├── quiz.js             # Soal kuis
    ├── sticker.js          # Pembuat sticker (ffmpeg + imagemagick)
    └── weather.js          # Integrasi Open-Meteo (tanpa API key)
```

---

## 📖 Daftar Command

### 🤖 AI & Chat

Tidak butuh command khusus — cukup chat biasa (mention bot di grup, atau langsung di chat pribadi). AI otomatis mendeteksi maksud kamu untuk generate gambar, buat sticker, kirim poll, tampilkan menu, hapus riwayat chat, dan lainnya lewat percakapan natural.

| Command | Deskripsi |
|---|---|
| `.createimage [deskripsi]` / `.ci [deskripsi]` | Generate gambar lewat AI |
| `.createvideo [deskripsi]` / `.cv [deskripsi]` | Generate video lewat AI |

> Minta AI untuk "hapus percakapan" atau "lupakan chat ini" akan menghapus riwayat memori AI kamu — tidak ada command terpisah untuk ini, cukup minta lewat chat biasa.

### 🎨 Media & Sticker

| Command | Deskripsi |
|---|---|
| `.sticker` / `.s` | Ubah gambar/video jadi sticker (reply ke media, atau kirim media dengan caption ini) |
| `.textsticker [teks]` / `.ts [teks]` | Buat sticker dari teks |

### 🔳 QR Code

| Command | Deskripsi |
|---|---|
| `.buatqr [teks/url/dll]` / `.cqr` / `.createqr` | Buat QR code — otomatis deteksi jenis dari isinya |
| `.buatqr wa [nomor]` | QR kontak WhatsApp (saat discan langsung buka chat/tambah kontak, **bukan** dial telepon) |
| `.buatqr call:[nomor]` | QR telepon (saat discan langsung dial nomor) |
| `.buatqr wifi:ssid=NAMA;pass=PASSWORD;type=WPA` | QR untuk konek WiFi otomatis |
| `.buatqr [lat,lon]` | QR lokasi/koordinat GPS |
| `.buatqr` (reply ke kontak yang dibagikan) | QR kontak vCard dari kontak tersebut |
| `.scanqr` / `.sqr` | Scan/baca QR code (reply ke gambar, kirim gambar dengan caption ini, atau `.scanqr [url gambar]`) |

### 📥 Downloader

| Command | Deskripsi |
|---|---|
| `.dl [url]` | Download otomatis — bot mendeteksi platform dan jenis medianya sendiri |
| `.dytmp3 [url]` | Download audio dari YouTube |
| `.dytmp4 [url]` | Download video dari YouTube |
| `.dtt [url]` | Download video dari TikTok |
| `.sp [url]` | Download audio dari link Spotify |
| `.cdl` | Batalkan download yang sedang berjalan |

### 🌍 Info & Cuaca

| Command | Deskripsi |
|---|---|
| `.cuaca [kota]` / `.weather [kota]` | Cek cuaca kota tertentu |
| `.gempaid [wilayah]` | Data gempa terkini di Indonesia (sumber: BMKG) |
| `.gempa [wilayah/negara]` / `.earthquake [wilayah/negara]` | Data gempa terkini dunia (sumber: USGS) |

### 📚 Sastra & ✨ Inspirasi

Semua acak, tanpa argumen tambahan.

| Command | Deskripsi |
|---|---|
| `.cerpen` | Cerpen acak |
| `.pantun` | Pantun acak |
| `.puisi` | Puisi acak |
| `.motivasi` | Kata-kata motivasi acak |
| `.fakta` | Fakta menarik acak |
| `.renungan` | Renungan acak |
| `.filosofis` | Pemikiran filosofis acak |

### 🎮 Game

| Command | Deskripsi |
|---|---|
| `.poll [pertanyaan]? [pilihan1], [pilihan2], ...` | Buat poll di chat/grup |
| `.quiz` | Mulai kuis — bot mengirim soal dengan pilihan jawaban berupa tombol |

### ⏰ Penjadwalan

| Command | Deskripsi |
|---|---|
| `.settimezone [TZ]` | Atur timezone kamu (contoh: WIB, WITA, WIT) |
| `.reminder [HH:MM] [TZ] [pesan]` | Pasang reminder sekali jalan |
| `.reminder list` | Lihat semua reminder aktif kamu |
| `.dreminder [nomor/all]` | Hapus reminder tertentu atau semuanya |
| `.cron [HH:MM] [TZ] [pesan]` | Pasang pesan otomatis berulang tiap hari |
| `.cron list` | Lihat semua cron job aktif kamu |
| `.dcron [nomor/all]` | Hapus cron job tertentu atau semuanya |

### ℹ️ Umum

| Command | Deskripsi |
|---|---|
| `.menu` / `.help` | Tampilkan menu command (otomatis tambah menu owner kalau kamu owner) |
| `.myinfo` / `.whoami` | Lihat info & JID WhatsApp kamu |
| `.report [pesan]` | Laporkan user ke owner (reply/mention/sertakan nomor) |
| `.cp` | Batalkan proses apa pun yang sedang berjalan (download, generate gambar/video, scan QR, dll) |

### 👥 Command Admin Grup

Semua command di bawah ini hanya bisa dipakai **admin grup**. Sebagian besar juga butuh **bot dijadikan admin grup** dulu supaya bisa berjalan (ditandai dengan 🔐 di kolom deskripsi); sisanya (statistik, pengaturan yang tersimpan di bot seperti antilink/filter/welcome, dan `.communitycreate`) tetap jalan walau bot bukan admin.

**Manajemen anggota**

| Command | Deskripsi |
|---|---|
| `.kick @user` / `.remove @user` | 🔐 Keluarkan anggota dari grup (bisa tag atau reply) |
| `.add 62xxx 62xxx` | 🔐 Tambah anggota lewat nomor (bisa lebih dari satu, pisah spasi/koma) |
| `.promote @user` | 🔐 Jadikan anggota sebagai admin |
| `.demote @user` | 🔐 Turunkan admin jadi anggota biasa |
| `.tagall [pesan]` / `.everyone [pesan]` | Tag semua anggota grup |

**Kontrol grup**

| Command | Deskripsi |
|---|---|
| `.mute [jam]` / `.close [jam]` | 🔐 Kunci grup (hanya admin bisa chat); jam bersifat opsional untuk auto-unmute |
| `.unmute` / `.open` | 🔐 Buka kunci grup |
| `.lock` | 🔐 Kunci pengaturan grup (hanya admin bisa ubah info grup) |
| `.unlock` | 🔐 Buka kunci pengaturan grup |
| `.setname [nama]` | 🔐 Ganti nama grup |
| `.setdesc [deskripsi]` | 🔐 Ganti deskripsi grup |
| `.setppgroup` | 🔐 Ganti foto profil grup (reply ke gambar) |
| `.addmode admin` / `.addmode all` | 🔐 Atur siapa yang boleh menambah anggota baru |
| `.ephemeral 24h` / `7d` / `90d` / `off` | 🔐 Atur disappearing messages |
| `.groupinfo` / `.infogrup` | Lihat info grup (jumlah anggota, admin, status kunci) |
| `.groupstats` | Statistik grup — bisa dipakai anggota biasa, tidak perlu admin |

**Welcome, leave & filter kata**

| Command | Deskripsi |
|---|---|
| `.welcome on` / `off` | Aktif/nonaktifkan pesan selamat datang |
| `.setwelcome [teks]` | Atur teks welcome custom (placeholder: `@user`, `@group`, `@total`, `@tanggal`, `@jam`) |
| `.leave on` / `off` | Aktif/nonaktifkan pesan saat anggota keluar |
| `.setleave [teks]` | Atur teks leave custom (placeholder sama seperti welcome) |
| `.resetwelcome` | Kembalikan teks welcome & leave ke default |
| `.antilink on` / `off` | Aktif/nonaktifkan penghapusan otomatis pesan berisi link |
| `.filter on` / `off` | Aktif/nonaktifkan filter kata kunci |
| `.filter mode warn` / `.filter mode kick` | Atur mode filter — hanya warning, atau auto-kick di pelanggaran ke-3 |
| `.addfilter kata1, kata2` | Tambah kata ke daftar filter (maks. 100 kata) |
| `.delfilter kata1, kata2` | Hapus kata dari daftar filter |
| `.listfilter` | Lihat semua kata yang difilter |
| `.clearfilter` | Hapus semua kata filter sekaligus |
| `.resetwarn @user` | Reset hitungan warning filter seseorang |

**Link, komunitas & approval join**

| Command | Deskripsi |
|---|---|
| `.getlink` | 🔐 Ambil link invite grup |
| `.resetlink` | 🔐 Reset link invite grup (link lama jadi tidak berlaku) |
| `.joinmode on` / `off` | 🔐 Wajibkan approval admin untuk orang yang mau join grup |
| `.joinrequest` | 🔐 Lihat daftar permintaan join yang menunggu |
| `.approve @user` / `.approve all` | 🔐 Setujui permintaan join |
| `.reject @user` / `.reject all` | 🔐 Tolak permintaan join |
| `.communitycreate [nama]` | Buat komunitas WhatsApp baru |
| `.communitylink [community_id]` | 🔐 Hubungkan grup ini ke komunitas |
| `.communityunlink` | 🔐 Lepaskan grup ini dari komunitas yang menaunginya |

### 👑 Command Owner

Hanya bisa dipakai nomor yang terdaftar di `OWNER_NUMBERS` (`modules/owner.js`). Command ini menu-nya otomatis muncul tambahan di bawah `.menu` kalau kamu owner.

| Command | Deskripsi |
|---|---|
| `.broadcast [pesan]` | Broadcast pesan ke semua user yang tercatat bot |
| `.groupbroadcast [pesan]` | Broadcast pesan ke semua grup tempat bot berada |
| `.send n- [nomor1] [nomor2] t- [pesan]` | Kirim pesan ke nomor tertentu (bisa lebih dari satu nomor sekaligus; urutan `n-`/`t-` boleh dibalik) |
| `.stats` | Lihat statistik bot |
| `.ban [nomor]` / `.unban [nomor]` | Ban/unban user dari memakai bot |
| `.block [nomor]` / `.unblock [nomor]` | Block/unblock kontak (bisa juga tag/reply orangnya) |
| `.bio [nomor]` | Lihat bio WhatsApp seseorang (bisa juga tag/reply) |
| `.pp [nomor]` | Lihat foto profil seseorang (bisa juga tag/reply) |
| `.businessinfo [nomor]` | Lihat info akun bisnis WhatsApp seseorang (bisa juga tag/reply) |
| `.setbio [teks]` | Ganti bio WhatsApp bot |
| `.setbotname [nama]` | Ganti nama tampilan bot |
| `.creategroup` | Buat grup baru. Format: `nama grup` diikuti tanda garis vertikal lalu daftar nomor — contoh: `.creategroup Tim Proyek | 6281234567890, 6289876543210`. Owner otomatis masuk, nomor tambahan opsional |
| `.joingroup [link grup]` | Join ke grup lewat link invite |
| `.leavegroup` | Keluarkan bot dari grup ini |
| `.listgroups` | Lihat daftar semua grup tempat bot berada, lengkap dengan ID grupnya |
| `.leaveall` | Keluarkan bot dari **semua** grup |
| `.leaveinactive [n]` | Tanpa argumen = preview grup dengan anggota < n (dry run, belum keluar beneran). Dengan angka = benar-benar keluar dari grup di bawah ambang tersebut |
| `.addme [groupJid]` | Tambahkan owner ke grup tertentu (ambil ID grup dari `.listgroups`) |
| `.status [teks]` | Posting status WhatsApp |
| `.dstatus` | Hapus status terakhir yang diposting bot |
| `.maintenance on` / `off` | Aktif/nonaktifkan mode maintenance — saat ON, bot hanya merespons owner |

---

## 🤝 Kontribusi

Pull request dan issue report sangat diterima. Untuk perubahan besar, buka issue dulu untuk diskusi supaya tidak ada kerja yang sia-sia.

## 📄 Lisensi

Tambahkan informasi lisensi kamu di sini.

