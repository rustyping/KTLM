# 🍽️ KTLM Kitchen - Sistem POS & Katalog Menu Digital

Aplikasi Point of Sale (POS) dan Katalog Menu Digital berbasis Web (HTML, CSS, Vanilla JS) yang terintegrasi langsung dengan **Google Sheets** (sebagai database utama). Sistem ini dirancang untuk memudahkan pelanggan memesan secara daring (via WhatsApp) dan memudahkan kasir memproses pesanan langsung di toko maupun pesanan daring dengan pencetakan struk termal.

## 🚀 Fitur Utama

### 📱 1. Aplikasi Pelanggan / Katalog Online (`index.html`)
Dirancang agar ramah pengguna dan responsif di perangkat seluler (HP) pelanggan.
* **Tampilan Katalog Dinamis:** Menarik daftar produk langsung dari Google Sheet (Sheet `produk`) secara *real-time*. Produk yang berstatus "Tidak Aktif" atau "Katalog = N" otomatis disembunyikan.
* **Filter & Pencarian:** Navigasi kategori makanan/minuman dan fitur pencarian berbasis teks.
* **Manajemen Varian & Subkategori:** Mendukung produk dengan banyak pilihan varian (contoh: Level pedas, pilihan paket).
* **Keranjang Belanja (Cart):** Pelanggan dapat menambah, mengurangi, dan melihat estimasi total belanja.
* **Checkout via WhatsApp:** Pesanan diformat rapi secara otomatis dan dikirimkan ke nomor WhatsApp Admin (nomor ditarik dinamis dari Sheet `Data`). Status pesanan otomatis terekam di Sheet sebagai `PENDING`.

### 🖥️ 2. Aplikasi Kasir / Web POS (`kasir.html`)
Dirancang untuk kecepatan operasional staf kasir di toko.
* **Sistem Notifikasi Pesanan Masuk:** Terdapat indikator lonceng/badge merah yang berkedip setiap kali ada pesanan daring (katalog) yang masuk (otomatis mengecek setiap 15 detik).
* **Manajemen Pesanan Online:** Kasir memiliki 2 opsi saat memproses pesanan daring:
  * **🖨️ Langsung Cetak:** Memproses pesanan secara instan, mengubah status menjadi `SELESAI` di database, dan langsung mencetak struk.
  * **📥 Edit / Ongkir:** Menarik data pesanan pelanggan kembali ke dalam keranjang kasir. Kasir dapat mengubah pesanan, menyesuaikan harga, atau menambahkan Ongkos Kirim sebelum dicetak (Sistem Overwrite/Timpa).
* **Input Ongkos Kirim Fleksibel:** Dilengkapi dengan *auto-formatting* pemisah ribuan (titik) agar kasir tidak salah memasukkan angka.
* **Pencetakan Struk Fleksibel:** 
  * **Aplikasi RawBT:** Terintegrasi dengan URI Intent `intent://...scheme=rawbt` untuk cetak bluetooth instan di Android.
  * **Browser Native:** Mendukung cetak jendela standar (Window.print) jika digunakan di laptop/PC.
* **Cetak Ulang Struk (Reprint):** Menyimpan memori transaksi terakhir secara lokal (*LocalStorage*) untuk mencegah kasus kertas struk habis/macet.

---

## 📂 Struktur File

Repositori ini terdiri dari file utama berikut:

| Nama File | Deskripsi |
| :--- | :--- |
| `index.html` | Halaman Antarmuka Katalog untuk Pelanggan. |
| `index.js` | Logika JavaScript untuk Katalog (Tarik data, keranjang, integrasi WA). |
| `index.css` | File styling khusus untuk halaman antarmuka Katalog Pelanggan. |
| `kasir.html` | Halaman Antarmuka POS untuk Kasir (Terlindungi / Internal Toko). |
| `kasir.js` | Logika JavaScript untuk POS (Manajemen checkout, parser pesanan, integrasi printer). |
| `kasir.css` | File styling khusus untuk halaman antarmuka POS Kasir. |
| `README.md` | Dokumentasi aplikasi. |

---

## 🛠️ Cara Kerja Sistem (Alur Data)

Aplikasi ini tidak memiliki *backend server* tradisional (seperti PHP/Node.js). Seluruh aliran data diatur melalui **Google Apps Script** yang tertanam di Google Sheets.

1. **Sinkronisasi Awal (`GET`):** Saat aplikasi dibuka, file JavaScript akan melakukan *fetch* ke URL Google Apps Script untuk menarik Array Data (Store Info, Produk, Varian, Customer).
2. **Kirim Pesanan (`POST`):** Saat Pelanggan/Kasir melakukan *Checkout*, aplikasi mengirim paket objek JSON (Payload) ke Apps Script.
3. **Penyimpanan (Google Sheet):** 
   * Transaksi kasir (baru) akan ditambah sebagai baris baru (`appendRow`).
   * Transaksi editan dari katalog akan menggunakan perintah `updateFullOrder` untuk menimpa sel data lama dengan data baru yang sudah divalidasi kasir.
   * Transaksi langsung cetak akan menggunakan perintah `updateStatus` untuk mengubah kolom status dari "PENDING" ke "SELESAI".

---

## ⚙️ Persiapan & Pengaturan

Bagi pengembang selanjutnya yang ingin memodifikasi sistem ini:

1. **URL API (Google Apps Script):**
   Pastikan variabel `API_URL` yang ada di bagian paling atas pada file `index.js` dan `kasir.js` mengarah ke URL *Web App Deployment* Google Script yang aktif.
   ```javascript
   const API_URL = "[https://script.google.com/macros/s/KODE_ANDA/exec](https://script.google.com/macros/s/KODE_ANDA/exec)";
