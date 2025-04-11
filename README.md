<h1>Berikut adalah panduan lengkap program pembasmi komen judol</h1>

Langkah 1: Instal Node.js
- Kunjungi situs resmi: https://nodejs.org/
- Unduh versi LTS (disarankan untuk sebagian besar pengguna)
- Instal seperti biasa, cukup klik Next hingga selesai
- Untuk memastikan Node.js dan npm terinstal, buka Command Prompt atau Terminal dan jalankan: node -v
- npm -v

Langkah 2: Instal Visual Studio Code
- Kunjungi situs resmi: https://code.visualstudio.com/
- Unduh dan instal VS Code sesuai sistem operasi Anda
- Setelah selesai, buka aplikasi Visual Studio Code

Langkah 3: Buat Folder Proyek
- Di VS Code, klik File → Open Folder → buat folder baru (contoh: YouTubeSpamRemover)
- Di dalam folder tersebut, buat file baru bernama index.js

Langkah 4: Aktifkan YouTube Data API dan Buat OAuth Client ID
- Kunjungi Google Cloud Console: https://console.cloud.google.com/
- Buat project baru (atau pilih project yang sudah ada)

- Aktifkan YouTube Data API v3:
  - Klik menu API & Services → Library
  - Cari “YouTube Data API v3” → klik → lalu klik tombol Enable

- Buat kredensial OAuth 2.0:
  - Masuk ke API & Services → Credentials
  - Klik Create Credentials → pilih OAuth client ID
  - Pilih "Desktop App" sebagai tipe aplikasi
  - Unduh file credentials.json dan simpan ke dalam folder proyek Anda

Langkah 5: Buka Terminal di VS Code
- Di VS Code, klik Terminal → New Terminal
- Inisialisasi project Node.js dengan menjalankan: npm init -y

Langkah 6: Instal Library yang Dibutuhkan
- Jalankan perintah berikut di terminal untuk menginstal package yang diperlukan: npm install googleapis dotenv

Langkah 7: Siapkan File
- Pastikan folder proyek Anda berisi:
- File credentials.json (dari Google Cloud Console)
- File .env, lalu isi dengan baris berikut: VIDEO_ID=id_video_youtube_anda

Langkah 8: Masukkan Kode Program
- Salin dan tempel seluruh kode JavaScript ke dalam file index.js.

Langkah 9: Jalankan Program
- Di terminal, jalankan:
  - node index.js
- Terminal akan menampilkan URL — salin dan buka di browser
- Login dengan akun YouTube Anda dan berikan izin akses
- Setelah itu, browser akan mengarahkan Anda ke localhost dengan sebuah “code” — salin kodenya
- Tempelkan kembali ke terminal
- Program akan memindai dan menghapus komentar spam secara otomatis!

Catatan:
- Saat pertama kali dijalankan, file token.json akan dibuat. Selama file ini ada dan belum kadaluarsa, Anda tidak perlu login ulang di masa depan.
- YouTube Data API v3 memiliki batas penggunaan sebanyak [10.000 API quota units per hari](https://developers.google.com/youtube/v3/determine_quota_cost), sehingga jika anda telah menjalankan program ini beberapa kali dalam sehari, Anda dapat mencapai batas API quota harian sehingga program tidak dapat menghapus komentar hingga besok.
