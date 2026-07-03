'use strict'

// ─── MODUL SASTRA ─────────────────────────────────────────────────────────────
// Berisi koleksi 15 Cerpen, 15 Pantun, dan 15 Puisi Indonesia.
// Setiap command (.cerpen / .pantun / .puisi) akan memilih data secara random
// sehingga tiap pengguna bisa mendapatkan karya yang berbeda-beda.
// Catatan: seluruh karya cerpen dan puisi dalam modul ini adalah karya orisinal
// yang ditulis khusus untuk bot ini.
// ─────────────────────────────────────────────────────────────────────────────

// ─── CERPEN ───────────────────────────────────────────────────────────────────

const CERPEN_LIST = [
    {
        judul: 'Sepucuk Surat dari Ibu',
        isi: `Sudah tiga tahun Rama tidak pulang ke kampung. Kesibukannya di kota membuatnya lupa betapa rindunya sang ibu.

Suatu malam, sebuah amplop lusuh tiba di mejanya. Di dalamnya hanya selembar kertas bertuliskan tangan gemetar:

"Nak, kapan pulang? Pohon mangga di halaman sudah berbuah lagi. Ibu masakkan sayur asem kesukaanmu."

Rama menghela napas panjang. Tangannya langsung meraih ponsel dan memesan tiket pulang untuk besok pagi.

Beberapa hal di dunia ini tidak bisa menunggu. Dan kasih ibu adalah salah satunya.`
    },
    {
        judul: 'Hujan di Bulan Juni',
        isi: `Dinda berdiri di depan jendela kafe, memandangi rintik hujan yang menari di atas aspal.

Di sudut meja yang sama, empat tahun lalu, ia pertama kali mengenal Adit. Mereka berdua kehujanan dan berlari masuk ke kafe ini bersama-sama, tertawa terbahak karena sepatu mereka basah kuyup.

Kini Adit sudah menikah dengan orang lain. Dinda masih di sini, dengan secangkir kopi yang sama, dan hujan yang masih setia turun di bulan Juni.

Ia tersenyum kecil. Beberapa kenangan memang lebih indah ketika dibiarkan tetap sebagai kenangan.`
    },
    {
        judul: 'Kucing Tua di Gang Sempit',
        isi: `Pak Hamid sudah dua puluh tahun berjualan nasi uduk di gang sempit itu. Satu-satunya teman setianya adalah seekor kucing kuning tua yang ia beri nama Gembul.

Suatu pagi, Gembul tidak datang. Pak Hamid menunggu sambil sesekali menoleh ke sudut gang tempat biasanya Gembul tidur.

Sore hari, seorang anak kecil datang sambil menggendong Gembul. "Pak, kucingnya tertabrak motor tadi pagi, tapi sudah saya bawa ke dokter hewan. Ini uang kembaliannya," kata anak itu sambil menyerahkan amplop.

Pak Hamid terdiam. Ternyata selama ini, bukan hanya ia yang menyayangi Gembul.`
    },
    {
        judul: 'Satu Kursi Kosong',
        isi: `Setiap makan malam, Nenek selalu menyiapkan enam piring — padahal yang makan hanya lima orang.

Kami tidak pernah bertanya. Sampai suatu malam, adik bungsu memberanikan diri.

"Nek, itu punya siapa?"

Nenek tersenyum lembut, lalu mengelap sudut matanya dengan ujung kerudung.

"Kakekmu. Biar dia tidak merasa kesepian kalau sesekali mampir ke sini."

Malam itu, kami berlima makan dengan diam. Tapi entah mengapa, meja makan kami terasa lebih penuh dari biasanya.`
    },
    {
        judul: 'Buku Usang di Perpustakaan',
        isi: `Sari tidak sengaja menemukan buku itu di rak paling pojok — sampulnya sudah menguning dan bau kertasnya seperti hujan lama.

Di halaman pertama, ada tulisan tangan: "Untuk siapa pun yang menemukan ini: hidupmu lebih berharga dari yang kamu kira. — R, 1987."

Sari membaca seluruh buku itu dalam sekali duduk. Di halaman terakhir ada catatan lain: "Jika kamu sedang berjuang, ingat — kamu berhasil menemukan buku ini. Itu artinya kamu masih mencari. Dan orang yang masih mencari, belum pernah benar-benar menyerah."

Sari menutup buku itu, lalu menaruhnya kembali. Supaya ada orang lain yang juga menemukannya suatu hari nanti.`
    },
    {
        judul: 'Warung Kopi di Ujung Jalan',
        isi: `Warung kopi Pak Yusuf tidak pernah sepi, meski lokasinya di ujung jalan yang jarang dilalui orang.

Rahasianya bukan pada kopi yang ia seduh, melainkan pada cara ia mendengarkan. Setiap pelanggan yang datang, Pak Yusuf selalu bertanya, "Ada apa hari ini?"

Dan ia benar-benar mendengarkan jawabannya.

Orang-orang datang bukan karena kopinya. Mereka datang karena di warung Pak Yusuf, mereka merasa ada yang peduli.

Itulah yang paling langka di kota besar: telinga yang sungguh-sungguh mendengar.`
    },
    {
        judul: 'Layangan Putus',
        isi: `Bimo berlari mengejar layangan yang talinya putus tertiup angin sore.

Ia berlari melewati sawah, melewati jembatan bambu, sampai kakinya tersandung dan ia jatuh di pinggir sungai.

Layangan itu sudah lenyap di balik bukit.

Bimo duduk di sana sendirian, napasnya tersengal. Kemudian ia tertawa — tertawa sampai matanya berair.

Karena baru ia sadari, selama mengejar layangan tadi, ia melewati pohon jambu terbesar yang pernah ia lihat, sungai yang airnya bening seperti kaca, dan matahari yang sedang terbenam dengan sempurna.

Kadang yang hilang mengajari kita untuk melihat.`
    },
    {
        judul: 'Telepon Tengah Malam',
        isi: `Pukul dua dini hari, ponsel Nisa bergetar. Nomor tak dikenal.

"Halo?" suaranya serak mengantuk.

"Maaf ganggu. Ini... ini nomor lama kamu kan? Kamu dulu pernah bilang kalau aku butuh bicara sama seseorang, aku boleh hubungi kamu."

Nisa terdiam. Suara itu adalah suara teman SMA-nya — yang sudah tujuh tahun tidak berkabar.

"Iya," jawab Nisa pelan. "Aku di sini. Cerita saja."

Dan mereka pun bicara sampai subuh. Kadang pertemanan yang paling kuat bukan yang paling sering bertemu, tapi yang paling siap hadir saat dibutuhkan.`
    },
    {
        judul: 'Cermin Retak',
        isi: `Maya berdiri di depan cermin yang sudah retak di pojok kiri atas — cermin peninggalan neneknya.

Setiap pagi, ia melihat dirinya terpecah menjadi dua: bagian yang sudah sembuh, dan bagian yang masih dalam proses.

Orang-orang bilang ia harus mengganti cermin itu. Tapi Maya tidak mau.

Karena cermin retak itu jujur. Ia tidak menyembunyikan bahwa sesuatu pernah pecah. Ia hanya membuktikan bahwa meski retak, ia masih bisa memantulkan cahaya.

Dan itu sudah lebih dari cukup.`
    },
    {
        judul: 'Petani dan Bintang',
        isi: `Setiap malam setelah seharian di sawah, Pak Darmo duduk di teras dan menatap bintang.

Cucunya bertanya, "Kakek sedang apa?"

"Ngobrol sama bintang," jawab Pak Darmo sambil tersenyum.

"Bintang bisa ngomong?"

Pak Darmo mengangguk pelan. "Kalau kamu mau mendengarkan. Mereka bilang, tidak peduli seberapa lelah hari ini, cahaya tetap ada. Bahkan di malam paling gelap sekalipun."

Cucu kecil itu menatap langit dengan serius, seolah benar-benar ingin mendengar.`
    },
    {
        judul: 'Kado Ulang Tahun',
        isi: `Rudi bangun di hari ulang tahunnya dengan harapan setidaknya ada satu pesan di ponselnya.

Tidak ada.

Ia pergi bekerja dengan diam. Saat pulang, pintu rumahnya terkunci dari dalam — padahal ia tinggal sendiri.

Ia mengetuk. Lalu lampu-lampu menyala dan pintu terbuka.

Di dalam, semua teman lamanya berdiri sambil memegang kue. Mereka tidak lupa. Mereka hanya sengaja membuat Rudi menunggu, supaya kejutannya lebih terasa.

Ada hal-hal dalam hidup yang memang perlu waktu — tapi bukan karena dilupakan, melainkan karena sedang disiapkan dengan sungguh-sungguh.`
    },
    {
        judul: 'Guru yang Tidak Pernah Mengajar di Kelas',
        isi: `Bu Lastri adalah penjaga kantin sekolah. Bukan guru, bukan staf pengajar. Tapi murid-murid lebih banyak bercerita kepadanya daripada kepada siapa pun.

Di depan nasi bungkusnya yang murah, banyak anak yang mengaku takut tidak naik kelas, takut dimarahi orang tua, takut tidak punya teman.

Bu Lastri selalu mendengarkan, lalu berkata, "Makan dulu. Masalah apapun terasa lebih ringan kalau perutnya kenyang."

Bertahun kemudian, banyak alumni datang kembali — bukan untuk mengunjungi guru mereka, tapi untuk makan siang di kantin Bu Lastri dan sekadar duduk di sana sejenak.`
    },
    {
        judul: 'Sepeda Tua',
        isi: `Ayah tidak pernah bisa beli motor. Tapi sepedanya selalu bersih dan terawat.

Setiap pagi, ia mengayuh sepeda itu menempuh delapan kilometer ke pasar. Pulang sore hari, membawa senyum dan belanjaan untuk kami.

Dulu aku malu diantar sepeda ke sekolah. Sekarang aku malu karena dulu pernah merasa malu.

Karena tidak ada yang lebih gagah dari seorang ayah yang mendayung lelahnya sendiri, demi memastikan anaknya tidak pernah kekurangan apapun.`
    },
    {
        judul: 'Hujan Pertama',
        isi: `Layla belum pernah melihat hujan. Ia lahir dan besar di kota gurun yang panas dan kering.

Suatu hari, saat ia berusia dua puluh tiga tahun, ia sedang di bandara transit ketika hujan pertamanya turun.

Ia berdiri di luar terminal — membiarkan dirinya basah kuyup — sementara orang-orang berlari mencari atap.

Petugas bandara datang dengan payung. Layla menggeleng dan tertawa.

"Maaf," katanya, "Ini pertama kalinya saya hujan-hujanan."

Petugas itu diam sejenak, lalu ikut berdiri di bawah hujan bersamanya.`
    },
    {
        judul: 'Pesan Terakhir',
        isi: `Sebelum Grandpa pergi, ia memanggil semua cucunya satu per satu.

Ketika tiba giliran Aldi, Grandpa menggenggam tangannya erat.

"Grandpa mau kasih tahu rahasia panjang umur," bisiknya lemah.

Aldi mendekatkan telinganya.

"Selalu minta maaf lebih dulu. Jangan tunggu orang lain. Dan jangan pernah tidur sambil marah sama siapapun."

Grandpa tersenyum, lalu memejamkan mata untuk tidur.

Aldi tidak tahu kalau itu tidur yang terakhir. Tapi ia selalu ingat pesannya — dan ia jadikan itu cara hidupnya.`
    }
]

// ─── PANTUN ───────────────────────────────────────────────────────────────────
// Pantun adalah warisan budaya lisan Melayu yang bersifat kolektif/tradisional.
// Tidak memiliki penulis tunggal yang dapat diidentifikasi.

const PANTUN_LIST = [
    {
        bait: `Buah nangka di pinggir kali,
Jatuh satu dimakan tupai.
Hati siapa yang tidak terali,
Melihat senyummu yang indah sekali.`
    },
    {
        bait: `Pergi ke pasar membeli kangkung,
Jangan lupa beli cabai merah.
Hidup ini jangan terlalu bingung,
Jalani saja dengan hati cerah.`
    },
    {
        bait: `Pohon rambutan tumbuh di ladang,
Buahnya merah manis sekali.
Kalau kamu sedang meradang,
Tarik napas, hitung sampai sepuluh kali.`
    },
    {
        bait: `Ada ikan di dalam kolam,
Berenang kesana kemari.
Meski hidup penuh dengan alam,
Jangan lupa bersyukur setiap hari.`
    },
    {
        bait: `Hujan turun dari langit biru,
Membasahi tanah yang kering.
Ilmu dicari hingga tua pun itu,
Karena ilmu takkan pernah berkering.`
    },
    {
        bait: `Burung pipit terbang ke utara,
Hinggap sebentar di pohon tinggi.
Rajin belajar sejak remaja,
Supaya masa depan cerah berseri.`
    },
    {
        bait: `Perahu layar di tengah lautan,
Membawa barang dari jauh.
Cinta yang tulus tanpa kebohongan,
Itulah cinta yang benar-benar tumbuh.`
    },
    {
        bait: `Anak kijang berlari di padang,
Kakinya ringan bak angin pagi.
Janganlah hati terlalu padang,
Kesabaran itu kunci rezeki.`
    },
    {
        bait: `Petik melati di pagi buta,
Harum semerbak sampai ke taman.
Indahnya persahabatan yang nyata,
Adalah yang hadir di saat ujian.`
    },
    {
        bait: `Ada mentimun di kebun belakang,
Dipetik ibu saat pagi hari.
Janganlah suka menaruh dendam,
Maafkan orang agar hati berseri.`
    },
    {
        bait: `Layang-layang terbang ke awang,
Benangnya panjang putih bersih.
Kalau rindu jangan meradang,
Tuliskan saja di selembar kasih.`
    },
    {
        bait: `Kelapa muda di tepi pantai,
Airnya segar menyejukkan hati.
Siapa yang bersungguh-sungguh meraih,
Pasti sampai ke tujuannya nanti.`
    },
    {
        bait: `Beli kain di kedai seberang,
Kainnya halus berwarna biru.
Jangan suka membuang waktu dengan sayang,
Waktu berlalu tak bisa kembali lagi.`
    },
    {
        bait: `Lebah terbang mencari bunga,
Hinggap di taman penuh warna.
Orang berilmu hidupnya mulia,
Di dunia dan akhirat bercahaya.`
    },
    {
        bait: `Bunga mawar di taman indah,
Mekar merekah di pagi cerah.
Hidup ini penuh berkah,
Asal kita selalu bersyukur dan pasrah.`
    }
]

// ─── PUISI ────────────────────────────────────────────────────────────────────

const PUISI_LIST = [
    {
        judul: 'Sisa Hujan',
        bait: `Setelah hujan pergi
masih ada genangan kecil
yang memantulkan langit
seperti ingin bilang:
yang indah tidak selalu harus bertahan lama
untuk meninggalkan bekas.`
    },
    {
        judul: 'Ibu',
        bait: `Tanganmu yang keriput
adalah peta perjalanan panjang
yang tidak pernah kamu ceritakan

tapi aku membacanya
setiap kali kamu mengusap rambutku
dan berkata: sudah, tidur saja.`
    },
    {
        judul: 'Kota Malam',
        bait: `Di antara lampu-lampu jalan
yang berkedip separuh mati
aku berjalan pulang

membawa lelah yang tidak perlu
aku ceritakan kepada siapa pun —
karena beberapa hal
lebih baik diselesaikan
dengan tidur yang cukup.`
    },
    {
        judul: 'Tentang Bertumbuh',
        bait: `Pohon tidak tumbuh dengan tergesa
ia hanya diam
dan mengumpulkan hujan
sedikit demi sedikit

kamu juga begitu —
tidak harus terlihat maju setiap hari
asal akarmu terus dalam
dan kamu tidak berhenti minum cahaya.`
    },
    {
        judul: 'Percakapan dengan Laut',
        bait: `Laut bilang kepadaku:
aku tidak lelah bergelombang
itu bukan kemarahan
itu cara hidupku

lalu ia mundur pelan-pelan
meninggalkan pasir yang bersih
dan aku mengerti —
ada hal-hal yang memang harus berulang
supaya sesuatu menjadi jernih.`
    },
    {
        judul: 'Pesan untuk Diri Sendiri',
        bait: `Tidak apa-apa
belum sampai ke sana

tidak apa-apa
masih meraba jalan di kegelapan

tidak apa-apa
hatimu lebih kuat dari yang kamu kira —

kamu sudah bertahan
jauh lebih lama dari yang pernah kamu bayangkan
dan itu bukan hal kecil.`
    },
    {
        judul: 'Satu Kursi di Tepi Jendela',
        bait: `Di kafe ini aku duduk sendiri
dengan secangkir kopi yang sudah dingin
dan buku yang belum kubuka

bukan karena tidak ada yang ingin kukerjakan
tapi karena ada saat-saat
ketika diam adalah pekerjaan paling penting
yang bisa dilakukan seseorang.`
    },
    {
        judul: 'Musim Gugur Pertama',
        bait: `Daun-daun jatuh
bukan karena kalah
tapi karena memang sudah waktunya
memberi jalan pada yang baru

ada pelajaran dalam setiap kepergian —
bahwa melepaskan
tidak selalu berarti menyerah.`
    },
    {
        judul: 'Untuk Kamu yang Sedang Berjuang',
        bait: `Kamu tidak harus kuat setiap hari
ada hari-hari
di mana cukup bangun dari kasur
sudah merupakan kemenangan

dan kemenangan tidak harus besar
untuk layak dirayakan —
bahkan satu langkah ke depan
di hari yang paling berat
adalah keberanian.`
    },
    {
        judul: 'Bintang di Siang Hari',
        bait: `Bintang tidak hilang saat siang tiba
ia hanya tidak terlihat
tapi tetap ada di sana
bersinar dengan setia

kamu juga begitu —
meski tidak selalu terlihat
tidak berarti kamu tidak ada
tidak berarti cahayamu padam.`
    },
    {
        judul: 'Perihal Waktu',
        bait: `Waktu tidak pernah menunggu
tapi ia juga tidak pernah berteriak
ia hanya berjalan pelan
sambil mengangkat bahu —

yang kamu lakukan atau tidak lakukan
tetap akan menjadi kenangan
bedanya hanya satu:
apakah kamu yang memilih, atau dipilihkan.`
    },
    {
        judul: 'Rumah',
        bait: `Rumah bukan hanya tembok dan atap
kadang rumah adalah sebuah pelukan
yang tidak perlu berkata apa-apa

atau secangkir teh di pagi hari
yang disiapkan seseorang
sebelum kamu bangun —

itulah rumah yang sesungguhnya:
tempat di mana seseorang tahu
kamu membutuhkan apa.`
    },
    {
        judul: 'Belajar dari Semut',
        bait: `Semut tidak pernah bertanya
apakah bebannya terlalu berat

ia hanya berjalan
dan kalau tersandung
ia bangkit lagi

mungkin itulah satu-satunya
filosofi hidup yang kita butuhkan:
terus berjalan
dan tidak lupa berdiri lagi
setiap kali jatuh.`
    },
    {
        judul: 'Malam Terakhir Sebelum Hujan',
        bait: `Udara berbau tanah malam ini
pertanda hujan akan datang

aku duduk di luar
membiarkan angin menyentuh wajahku
dan berpikir betapa sederhana
caranya bahagia:

cukup hadir
di tempat ini
di saat ini
dengan hati yang tidak terburu-buru.`
    },
    {
        judul: 'Surat yang Tidak Terkirim',
        bait: `Ada kata-kata yang tidak pernah aku ucapkan
bukan karena aku tidak mau
tapi karena ada hal-hal
yang lebih kuat dari kata-kata

seperti diam di sampingmu
saat kamu menangis
tanpa bertanya kenapa —

karena kadang kehadiran
adalah bahasa paling fasih
yang dimiliki seseorang.`
    }
]

// ─── FUNGSI UTAMA ─────────────────────────────────────────────────────────────

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

function getCerpenRandom() {
    const cerpen = getRandom(CERPEN_LIST)
    return (
        `📖 *CERPEN* — _${cerpen.judul}_\n` +
        `${'─'.repeat(30)}\n\n` +
        `${cerpen.isi}\n\n` +
        `${'─'.repeat(30)}\n` +
        `_Ketik .cerpen untuk cerpen lainnya_ 🎲`
    )
}

function getPantunRandom() {
    const pantun = getRandom(PANTUN_LIST)
    return (
        `🎵 *PANTUN*\n` +
        `${'─'.repeat(30)}\n\n` +
        `_${pantun.bait}_\n\n` +
        `${'─'.repeat(30)}\n` +
        `_Ketik .pantun untuk pantun lainnya_ 🎲`
    )
}

function getPuisiRandom() {
    const puisi = getRandom(PUISI_LIST)
    return (
        `🌸 *PUISI* — _${puisi.judul}_\n` +
        `${'─'.repeat(30)}\n\n` +
        `${puisi.bait}\n\n` +
        `${'─'.repeat(30)}\n` +
        `_Ketik .puisi untuk puisi lainnya_ 🎲`
    )
}

module.exports = {
    getCerpenRandom,
    getPantunRandom,
    getPuisiRandom
}
