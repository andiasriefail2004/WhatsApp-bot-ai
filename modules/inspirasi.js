'use strict'

// ─── MODUL INSPIRASI ──────────────────────────────────────────────────────────
// Berisi koleksi 15 Motivasi, 15 Fakta Unik, 15 Renungan, dan 15 Filosofis.
// Setiap command dipilih secara random sehingga tiap pengguna mendapat yang berbeda.
// Seluruh konten adalah karya orisinal yang ditulis khusus untuk bot ini.
// ─────────────────────────────────────────────────────────────────────────────

// ─── MOTIVASI ─────────────────────────────────────────────────────────────────

const MOTIVASI_LIST = [
    `Kamu tidak harus melihat seluruh tangga. Cukup ambil satu langkah pertama — sisanya akan terlihat saat kamu sudah mulai bergerak.`,
    `Orang yang berhasil bukan yang tidak pernah gagal. Mereka adalah orang yang setiap kali jatuh, selalu memilih untuk bangun satu kali lebih banyak.`,
    `Jangan bandingkan perjalananmu dengan orang lain. Kamu sedang berlari di jalurmu sendiri, dengan beban dan jarak yang berbeda.`,
    `Hal terbaik yang bisa kamu lakukan hari ini adalah memulai — meski belum siap, meski belum sempurna, meski masih takut.`,
    `Kesuksesan bukan tentang seberapa cepat kamu sampai. Tapi tentang apakah kamu masih berjalan ketika orang lain sudah menyerah.`,
    `Lelah itu wajar. Berhenti sejenak itu boleh. Yang tidak boleh adalah menyerah dan tidak pernah kembali lagi.`,
    `Setiap hari adalah kesempatan baru untuk menjadi versi dirimu yang lebih baik dari kemarin. Tidak perlu besar — cukup satu langkah ke depan.`,
    `Kamu lebih kuat dari yang kamu kira. Buktinya: semua hari terberat yang pernah kamu alami — kamu berhasil melewatinya.`,
    `Mimpi yang besar butuh keberanian yang besar. Tapi keberanian tidak datang sebelum tindakan — ia datang bersamaan dengan tindakan itu sendiri.`,
    `Jangan tunggu motivasi datang dulu baru bergerak. Bergeraklah dulu — motivasi akan menyusul di tengah jalan.`,
    `Perubahan tidak terjadi dalam zona nyaman. Tapi zona nyaman juga tidak pernah menghasilkan cerita yang layak untuk diceritakan.`,
    `Tidak ada usaha yang sia-sia. Yang terlihat seperti kegagalan hari ini, seringkali adalah pondasi yang sedang dibangun untuk masa depan.`,
    `Berhenti membandingkan babak pertamamu dengan babak ketiga orang lain. Setiap orang punya jadwal dan prosesnya masing-masing.`,
    `Satu kebiasaan kecil yang dilakukan setiap hari lebih kuat dari satu tekad besar yang hanya ada di pikiran.`,
    `Hidupmu tidak ditentukan oleh apa yang terjadi padamu, tapi oleh bagaimana kamu memilih untuk meresponsnya.`
]

// ─── FAKTA ────────────────────────────────────────────────────────────────────

const FAKTA_LIST = [
    `🧠 Otakmu menggunakan sekitar 20% dari total energi tubuhmu — padahal beratnya hanya sekitar 2% dari berat badanmu. Otak adalah organ paling boros energi yang kamu miliki.`,
    `🐙 Gurita memiliki tiga jantung dan darah berwarna biru. Dua jantung memompa darah ke insang, satu memompa ke seluruh tubuh. Ketika gurita berenang, jantung utamanya berhenti berdetak — makanya mereka lebih suka merangkak.`,
    `🌊 Lebih dari 80% lautan di bumi belum pernah dieksplorasi manusia. Kita sebenarnya lebih banyak tahu tentang permukaan bulan daripada tentang dasar laut kita sendiri.`,
    `🍯 Madu tidak pernah basi. Arkeolog menemukan madu berusia 3.000 tahun di makam Mesir kuno — dan masih bisa dimakan. Kandungan gula tinggi dan pH rendahnya membuat bakteri tidak bisa hidup di dalamnya.`,
    `🌳 Pohon-pohon di hutan berkomunikasi satu sama lain melalui jaringan jamur bawah tanah. Para ilmuwan menyebutnya "Wood Wide Web" — pohon tua bahkan bisa mengirim nutrisi ke pohon muda yang kekurangan cahaya.`,
    `⚡ Petir menyambar bumi sekitar 100 kali setiap detiknya. Dalam waktu kamu membaca fakta ini, ribuan petir sudah jatuh di berbagai penjuru dunia.`,
    `🐘 Gajah adalah satu-satunya hewan selain manusia yang diketahui melakukan ritual untuk menghormati anggota kawanannya yang mati. Mereka bisa diam berjam-jam di sisi jasad temannya.`,
    `🌙 Bulan menjauh dari bumi sekitar 3,8 sentimeter setiap tahunnya. Miliaran tahun lalu, bulan jauh lebih dekat dan membuat bumi berputar lebih cepat — satu hari hanya berlangsung sekitar 6 jam.`,
    `🧬 Jika semua DNA dalam tubuhmu direntangkan, panjangnya bisa mencapai sekitar 200 miliar kilometer — cukup untuk pergi-pulang ke Pluto lebih dari 13 kali.`,
    `🐝 Lebah madu harus mengunjungi sekitar 2 juta bunga dan terbang sejauh 90.000 kilometer hanya untuk menghasilkan satu toples madu berukuran 500 gram. Seluruh hidup seekor lebah pekerja hanya menghasilkan sekitar satu sendok teh madu.`,
    `🌡️ Suhu di permukaan matahari sekitar 5.500 derajat Celsius. Tapi anehnya, atmosfer luar matahari (korona) bisa mencapai 2 juta derajat Celsius — ilmuwan sampai sekarang masih belum sepenuhnya memahami mengapa.`,
    `🐟 Ikan tidak pernah benar-benar tidur seperti manusia — mereka tidak memiliki kelopak mata. Tapi mereka memiliki periode istirahat di mana aktivitas otak mereka melambat secara signifikan.`,
    `🎵 Musik secara ilmiah terbukti bisa mengurangi rasa sakit. Saat mendengarkan musik yang kamu sukai, otakmu melepaskan dopamin — zat kimia yang sama yang dilepaskan saat kamu makan makanan enak atau jatuh cinta.`,
    `🪸 Terumbu karang yang terlihat seperti batu sebenarnya adalah makhluk hidup. Satu terumbu karang besar bisa menjadi rumah bagi lebih dari 25% seluruh spesies laut di dunia, meski hanya menutupi kurang dari 1% dasar lautan.`,
    `🧲 Jika kamu bisa menghilangkan semua ruang kosong di antara atom-atom dalam tubuh manusia, seluruh populasi manusia di bumi bisa muat dalam sebuah gula batu. Tubuhmu sebagian besar adalah... ruang kosong.`
]

// ─── RENUNGAN ─────────────────────────────────────────────────────────────────

const RENUNGAN_LIST = [
    `Kita sering menghabiskan waktu mengejar hal-hal yang kita pikir akan membuat kita bahagia — tanpa menyadari bahwa banyak hal yang kita cari sudah ada di tangan kita sejak lama.`,
    `Ada perbedaan besar antara sibuk dan produktif. Sibuk adalah bergerak tanpa arah. Produktif adalah bergerak menuju sesuatu yang benar-benar penting.`,
    `Setiap orang yang kamu temui sedang berjuang dengan sesuatu yang tidak kamu ketahui. Sedikit kebaikan, meski kecil, bisa berarti lebih dari yang kamu bayangkan bagi seseorang.`,
    `Kita tidak bisa mengendalikan apa yang terjadi pada kita. Tapi kita selalu punya kendali atas satu hal: bagaimana kita memilih untuk meresponsnya. Dan pilihan itu, sering kali, menentukan segalanya.`,
    `Waktu adalah satu-satunya sumber daya yang tidak bisa diisi ulang. Uang bisa dicari kembali. Tenaga bisa dipulihkan. Tapi detik yang sudah lewat tidak pernah kembali.`,
    `Kita terlalu sering menunggu — menunggu waktu yang tepat, kondisi yang sempurna, rasa siap yang tidak pernah datang. Padahal hidup tidak menunggu kita siap.`,
    `Kebahagiaan bukan tujuan akhir yang perlu dicapai. Ia adalah cara perjalanan — sesuatu yang dipilih dan dilatih setiap hari, bukan sesuatu yang ditemukan di ujung jalan.`,
    `Yang paling melelahkan dalam hidup bukan pekerjaan yang berat, tapi hubungan yang menguras, keputusan yang terus ditunda, dan kata-kata yang tidak pernah diucapkan.`,
    `Sering kali kita lebih keras kepada diri sendiri daripada kepada orang lain. Padahal nasihat terbaik yang bisa kamu berikan kepada sahabatmu — kamu juga layak menerimanya.`,
    `Hidup yang bermakna tidak selalu hidup yang besar dan terkenal. Kadang yang paling berarti adalah hadir sepenuhnya untuk orang-orang di sekitarmu, hari demi hari.`,
    `Kita mengkhawatirkan begitu banyak hal yang tidak pernah terjadi. Sebagian besar ketakutan kita adalah cerita yang kita tulis sendiri di kepala — bukan kenyataan.`,
    `Ada yang lebih penting dari menjadi benar: menjadi jujur. Dan ada yang lebih penting dari menjadi sukses: menjadi baik. Keduanya tidak selalu datang bersamaan.`,
    `Masa lalu tidak bisa diubah. Tapi cara kamu memandang masa lalu — itu bisa berubah. Dan seringkali, itulah yang mengubah segalanya.`,
    `Kita tidak selalu butuh solusi. Kadang yang paling dibutuhkan seseorang hanyalah didengarkan — benar-benar didengarkan, tanpa penilaian, tanpa saran yang tidak diminta.`,
    `Di akhir hidup, sangat sedikit orang yang menyesal karena terlalu banyak beristirahat, terlalu sering tertawa, atau terlalu lama memeluk orang yang mereka cintai.`
]

// ─── FILOSOFIS ────────────────────────────────────────────────────────────────

const FILOSOFIS_LIST = [
    `Kita tidak takut pada kegelapan karena kegelapan itu berbahaya. Kita takut karena kita tidak bisa melihat apa yang ada di dalamnya. Banyak ketakutan dalam hidup bekerja dengan cara yang sama — bukan ancaman nyata, tapi ketidakpastian yang kita bayangkan.`,
    `Sebuah kapal di pelabuhan memang aman. Tapi kapal tidak dibangun untuk selamanya berada di pelabuhan. Ada hal-hal dalam hidup yang hanya bisa kamu temukan kalau kamu berani berlayar.`,
    `Manusia adalah satu-satunya makhluk yang bisa membayangkan masa depan — dan justru karena itu, satu-satunya makhluk yang bisa khawatir tentang sesuatu yang belum tentu terjadi.`,
    `Kita sering mengira bahwa memiliki lebih banyak pilihan akan membuat kita lebih bahagia. Tapi terlalu banyak pilihan justru membuat kita lebih gelisah — karena semakin banyak pilihan, semakin besar rasa takut memilih yang salah.`,
    `Identitasmu bukan tentang siapa kamu kemarin. Ia adalah tentang pilihan-pilihan kecil yang kamu buat setiap hari — dan siapa yang perlahan-lahan kamu bentuk dari pilihan-pilihan itu.`,
    `Ada paradoks menarik dalam hidup: semakin kamu berusaha mengontrol segalanya, semakin banyak hal yang terasa lepas kendali. Tapi saat kamu belajar melepaskan apa yang tidak bisa dikontrol, justru saat itulah kamu mulai merasa bebas.`,
    `Kita adalah satu-satunya spesies yang menciptakan makna — pada benda, peristiwa, dan hubungan. Sebuah cincin logam biasa bisa menjadi lambang cinta seumur hidup. Bukan karena cincinnya istimewa, tapi karena kita memutuskan ia istimewa.`,
    `Waktu terasa lambat saat kita bosan dan cepat saat kita bahagia — padahal detiknya sama persis. Yang berubah bukan waktu, tapi perhatian kita. Ini mengajarkan sesuatu: kualitas hidup sangat ditentukan oleh ke mana kita mengarahkan perhatian.`,
    `Kebenaran yang tidak nyaman lebih berharga dari kebohongan yang menyenangkan. Tapi manusia secara alami lebih mudah menerima yang kedua — dan inilah mengapa kejujuran selalu butuh keberanian.`,
    `Kita belajar berjalan dengan cara jatuh. Kita belajar berbicara dengan cara salah mengucapkan kata. Hampir semua kemampuan manusia lahir dari kegagalan yang berulang — tapi entah mengapa, kita dewasa justru sering lupa bahwa gagal adalah bagian dari belajar.`,
    `Ada perbedaan antara kesepian dan kesendirian. Kesepian adalah merasa tidak terhubung meski dikelilingi orang. Kesendirian adalah memilih hadir bersama dirimu sendiri. Yang pertama menyakitkan. Yang kedua, kalau dilatih, bisa menjadi salah satu bentuk kebebasan terdalam.`,
    `Kita cenderung menilai diri sendiri dari niat, tapi menilai orang lain dari tindakan. Saat kita berbuat salah, kita berkata "aku tidak bermaksud begitu." Tapi saat orang lain berbuat salah, kita jarang bertanya apakah mereka punya alasan yang tidak kita ketahui.`,
    `Sesuatu yang berulang setiap hari terasa biasa — sampai suatu hari ia tidak ada lagi. Banyak hal yang kita anggap remeh baru terasa berharganya ketika sudah hilang. Mungkin itulah mengapa rasa syukur perlu dilatih, bukan ditunggu.`,
    `Perubahan yang paling lambat seringkali yang paling permanen. Kebiasaan kecil yang dilakukan bertahun-tahun membentuk karakter. Batu yang ditetesi air perlahan akan berlubang — bukan karena kekuatan air, tapi karena ketekunannya.`,
    `Manusia bisa bertahan menghadapi penderitaan yang luar biasa, selama ia tahu alasannya mengapa. Yang paling melemahkan bukanlah beratnya beban, tapi ketidaktahuan mengapa beban itu harus dipikul.`
]

// ─── FUNGSI UTAMA ─────────────────────────────────────────────────────────────

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

function getMotivasiRandom() {
    const item = getRandom(MOTIVASI_LIST)
    return (
        `💪 *MOTIVASI*\n` +
        `${'─'.repeat(30)}\n\n` +
        `${item}\n\n` +
        `${'─'.repeat(30)}\n` +
        `_Ketik .motivasi untuk motivasi lainnya_ 🎲`
    )
}

function getFaktaRandom() {
    const item = getRandom(FAKTA_LIST)
    return (
        `🔍 *FAKTA UNIK*\n` +
        `${'─'.repeat(30)}\n\n` +
        `${item}\n\n` +
        `${'─'.repeat(30)}\n` +
        `_Ketik .fakta untuk fakta lainnya_ 🎲`
    )
}

function getRenunganRandom() {
    const item = getRandom(RENUNGAN_LIST)
    return (
        `🌿 *RENUNGAN*\n` +
        `${'─'.repeat(30)}\n\n` +
        `${item}\n\n` +
        `${'─'.repeat(30)}\n` +
        `_Ketik .renungan untuk renungan lainnya_ 🎲`
    )
}

function getFilosofisRandom() {
    const item = getRandom(FILOSOFIS_LIST)
    return (
        `🧩 *FILOSOFIS*\n` +
        `${'─'.repeat(30)}\n\n` +
        `${item}\n\n` +
        `${'─'.repeat(30)}\n` +
        `_Ketik .filosofis untuk pemikiran lainnya_ 🎲`
    )
}

module.exports = {
    getMotivasiRandom,
    getFaktaRandom,
    getRenunganRandom,
    getFilosofisRandom
}
