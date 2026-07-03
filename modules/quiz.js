'use strict'

const QUIZ_LIST = [
    {
        soal: '🧠 Jika 2+3=10, 3+4=21, 4+5=32, maka 5+6=?',
        pilihan: ['A. 40', 'B. 42', 'C. 45', 'D. 11'],
        jawaban: 'C',
        penjelasan: 'Polanya: a+b = (a×b) - a. Jadi 5+6 = (5×6) - 5 = 30 - 5 = 45. Banyak yang terjebak langsung menjawab 11 karena lupa pola tersembunyi di balik soal ini.'
    },
    {
        soal: '🧠 Setengah dari dua tambah dua adalah?',
        pilihan: ['A. 1', 'B. 2', 'C. 3', 'D. 4'],
        jawaban: 'C',
        penjelasan: '"Setengah dari dua" = ½×2 = 1, lalu ditambah 2 = 3. Banyak yang terjebak membaca sebagai "setengah dari (dua tambah dua)" = ½×4 = 2.'
    },
    {
        soal: '🧠 5 mesin membuat 5 kaos dalam 5 menit. Berapa menit yang dibutuhkan 100 mesin untuk membuat 100 kaos?',
        pilihan: ['A. 100 menit', 'B. 50 menit', 'C. 10 menit', 'D. 5 menit'],
        jawaban: 'D',
        penjelasan: '1 mesin membuat 1 kaos dalam 5 menit. Jika 100 mesin bekerja bersamaan, masing-masing tetap butuh 5 menit. Jadi jawabannya tetap 5 menit, bukan 100 menit.'
    },
    {
        soal: '🧠 5 ekor ayam bertelur 5 butir dalam 5 hari. Berapa butir telur yang dihasilkan 10 ayam dalam 10 hari?',
        pilihan: ['A. 100 butir', 'B. 25 butir', 'C. 50 butir', 'D. 20 butir'],
        jawaban: 'D',
        penjelasan: '1 ayam bertelur 1 butir dalam 5 hari. Dalam 10 hari, 1 ayam bertelur 2 butir. Jadi 10 ayam × 2 butir = 20 butir. Bukan 100 butir seperti yang kebanyakan orang jawab.'
    },
    {
        soal: '🧠 Berapa bulan dalam setahun yang memiliki 28 hari?',
        pilihan: ['A. 1 bulan', 'B. 2 bulan', 'C. 4 bulan', 'D. 12 bulan'],
        jawaban: 'D',
        penjelasan: 'Semua bulan memiliki minimal 28 hari! Bulan Februari memang hanya 28 hari, tapi bulan lainnya punya 28 hari juga (plus hari tambahan). Jadi jawabannya 12 bulan.'
    },
    {
        soal: '🧠 Kamu punya 3 apel lalu mengambil 2. Berapa apel yang kamu punya?',
        pilihan: ['A. 1 apel', 'B. 2 apel', 'C. 3 apel', 'D. 5 apel'],
        jawaban: 'B',
        penjelasan: 'Kamu *mengambil* 2 apel, jadi kamu punya 2 apel di tangan. Bukan 1 (sisa yang ditinggal). Soal menjebak karena otak otomatis menghitung sisa, bukan apa yang kamu ambil.'
    },
    {
        soal: '🧠 Seorang dokter punya saudara laki-laki, tapi laki-laki itu tidak punya saudara. Siapa dokter itu?',
        pilihan: ['A. Saudara kembar', 'B. Dokter perempuan', 'C. Dokter itu sendiri', 'D. Tidak ada'],
        jawaban: 'B',
        penjelasan: 'Dokternya adalah perempuan. Saudara laki-lakinya punya saudara perempuan (si dokter), tapi tidak punya saudara laki-laki. Banyak yang terjebak berasumsi dokter itu laki-laki.'
    },
    {
        soal: '🧠 Jika ada 6 apel dan kamu ambil 4, berapa apel yang kamu miliki?',
        pilihan: ['A. 2 apel', 'B. 4 apel', 'C. 6 apel', 'D. 10 apel'],
        jawaban: 'B',
        penjelasan: 'Kamu mengambil 4 apel, jadi kamu memiliki 4 apel. Yang tersisa di tempat asalnya adalah 2 apel. Otak sering terjebak menghitung sisa daripada apa yang diambil.'
    },
    {
        soal: '🧠 Sebuah pesawat jatuh tepat di perbatasan Indonesia dan Malaysia. Di mana korban dikuburkan?',
        pilihan: ['A. Indonesia', 'B. Malaysia', 'C. Keduanya', 'D. Tidak dikuburkan'],
        jawaban: 'D',
        penjelasan: 'Korban kecelakaan pesawat tidak dikuburkan di perbatasan — mereka diselamatkan atau dibawa ke rumah sakit jika masih hidup. Soal menjebak karena otak langsung fokus ke "perbatasan".'
    },
    {
        soal: '🧠 Jika kamu berlari dalam lomba dan menyalip orang di posisi ke-2, kamu sekarang di posisi berapa?',
        pilihan: ['A. Posisi 1', 'B. Posisi 2', 'C. Posisi 3', 'D. Posisi 4'],
        jawaban: 'B',
        penjelasan: 'Kamu menyalip orang di posisi ke-2, artinya kamu mengambil posisinya — yaitu posisi ke-2. Kamu tidak menjadi posisi ke-1 kecuali menyalip orang terdepan juga.'
    },
    {
        soal: '🧠 Dua orang tua dan dua orang anak pergi memancing. Mereka masing-masing mendapat 1 ikan. Total ikan hanya 3. Bagaimana bisa?',
        pilihan: ['A. Ada yang tidak dapat ikan', 'B. Ada yang dapat 2 ikan', 'C. Mereka bertiga', 'D. Soalnya salah'],
        jawaban: 'C',
        penjelasan: 'Mereka hanya bertiga: kakek, ayah, dan anak. Ayah sekaligus adalah "anak" dari kakek. Jadi "dua orang tua" = kakek + ayah, dan "dua orang anak" = ayah + anak.'
    },
    {
        soal: '🧠 Mana yang lebih berat: 1 kg besi atau 1 kg kapas?',
        pilihan: ['A. Besi lebih berat', 'B. Kapas lebih berat', 'C. Sama berat', 'D. Tergantung jenisnya'],
        jawaban: 'C',
        penjelasan: 'Keduanya sama-sama 1 kg! Otak sering terjebak karena besi terasa lebih berat dalam kehidupan sehari-hari, padahal soalnya sudah menyebutkan beratnya sama: 1 kg.'
    },
    {
        soal: '🧠 Seorang pilot terbang dari Jakarta ke Surabaya, tapi tidak punya SIM. Apakah itu legal?',
        pilihan: ['A. Tidak legal', 'B. Legal', 'C. Tergantung maskapai', 'D. Harus punya SIM'],
        jawaban: 'B',
        penjelasan: 'Legal! Pilot tidak butuh SIM (Surat Izin Mengemudi) — SIM itu untuk kendaraan darat. Pilot punya lisensi terbang (ATPL/CPL), bukan SIM. Soal menjebak dengan kata "SIM".'
    },
    {
        soal: '🧠 Ada 10 burung di dahan. Seorang pemburu menembak 1. Berapa yang tersisa?',
        pilihan: ['A. 9 burung', 'B. 8 burung', 'C. 1 burung', 'D. 0 burung'],
        jawaban: 'D',
        penjelasan: 'Tidak ada yang tersisa! Ketika tembakan berbunyi, 9 burung lainnya akan terbang ketakutan. Yang ditembak jatuh, sisanya kabur. Jadi tidak ada burung yang tersisa di dahan.'
    },
    {
        soal: '🧠 2, 6, 12, 20, ?, 42. Berapa angka yang hilang?',
        pilihan: ['A. 28', 'B. 30', 'C. 32', 'D. 36'],
        jawaban: 'B',
        penjelasan: 'Polanya n×(n+1): 1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30, 6×7=42. Jadi angka yang hilang adalah 30.'
    },
    {
        soal: '🧠 Sebuah ayam betina berdiri di atas atap. Angin bertiup ke timur. Ke mana telur jatuh?',
        pilihan: ['A. Ke timur', 'B. Ke barat', 'C. Lurus ke bawah', 'D. Tidak ada telur'],
        jawaban: 'D',
        penjelasan: 'Ayam betina tidak bertelur sambil berdiri di atap! Dan meski bertelur, ayam tidak melepaskan telur saat berdiri — mereka duduk saat bertelur. Soal menjebak dengan detail angin.'
    },
    {
        soal: '🧠 Jika ada 3 apel dan kamu ambil 1, lalu temanmu ambil 1, berapa apel yang tersisa?',
        pilihan: ['A. 0 apel', 'B. 1 apel', 'C. 2 apel', 'D. 3 apel'],
        jawaban: 'B',
        penjelasan: '3 apel dikurangi 1 (kamu) dikurangi 1 (teman) = 1 apel tersisa. Soal ini straightforward tapi sering dijawab salah karena terburu-buru.'
    },
    {
        soal: '🧠 Mana yang lebih dulu: ayam atau telur?',
        pilihan: ['A. Ayam', 'B. Telur', 'C. Keduanya bersamaan', 'D. Pertanyaan tidak bisa dijawab'],
        jawaban: 'B',
        penjelasan: 'Secara evolusi, telur reptil sudah ada jauh sebelum ayam modern berevolusi. Ayam modern (Gallus gallus domesticus) lahir dari mutasi genetik dalam telur — jadi telur lebih dulu.'
    },
    {
        soal: '🧠 Jika 1=5, 2=10, 3=15, 4=20, maka 5=?',
        pilihan: ['A. 25', 'B. 30', 'C. 1', 'D. 5'],
        jawaban: 'C',
        penjelasan: 'Perhatikan soal pertama: 1=5. Berarti 5=1! Bukan 25. Ini soal jebakan karena otak otomatis mengikuti pola ×5 tanpa memperhatikan bahwa soal pertama sudah memberi jawabannya.'
    },
    {
        soal: '🧠 Sebuah mobil menempuh 60 km dalam 1 jam pertama dan 60 km dalam 1 jam kedua. Berapa kecepatan rata-ratanya?',
        pilihan: ['A. 30 km/jam', 'B. 60 km/jam', 'C. 90 km/jam', 'D. 120 km/jam'],
        jawaban: 'B',
        penjelasan: 'Total jarak = 120 km, total waktu = 2 jam. Kecepatan rata-rata = 120÷2 = 60 km/jam. Soal ini terlihat mudah tapi banyak yang overthinking dan salah hitung.'
    }
]

function getQuizRandom() {
    return QUIZ_LIST[Math.floor(Math.random() * QUIZ_LIST.length)]
}

function checkJawaban(inputUser, jawabanBenar) {
    const input = inputUser.trim().toUpperCase().charAt(0)
    return input === jawabanBenar.toUpperCase()
}

module.exports = { getQuizRandom, checkJawaban, QUIZ_LIST }

