# Panduan Pemasangan Waktu

Total waktu: sekitar 20–30 menit, cukup sekali. Semua layanan yang dipakai **gratis** dan **tidak meminta kartu kredit**.

Yang dibutuhkan:
- Akun Google (untuk Firebase: login dan database)
- Akun GitHub (untuk hosting aplikasinya). Daftar gratis di https://github.com/signup

---

## Bagian A — Firebase (database & login)

### 1. Buat proyek
1. Buka https://console.firebase.google.com dan login dengan akun Google.
2. Klik **Create a project** (atau **Add project**).
3. Nama proyek: misalnya `waktu-pribadi`. Klik **Continue**.
4. **Google Analytics**: matikan (tidak diperlukan). Klik **Create project**, tunggu, lalu **Continue**.

### 2. Daftarkan aplikasi web
1. Di halaman utama proyek, klik ikon **`</>`** (Web).
2. App nickname: `Waktu`. **Jangan** centang "Firebase Hosting". Klik **Register app**.
3. Akan muncul kode berisi `const firebaseConfig = { ... }`. Biarkan halaman ini terbuka untuk langkah 3.

### 3. Tempel konfigurasi ke aplikasi
1. Buka file `firebase-config.js` dengan Notepad / TextEdit.
2. Ganti baris `export const CONFIG = null;` menjadi isi dari Firebase, contohnya:

   ```js
   export const CONFIG = {
     apiKey: "AIzaSy...",
     authDomain: "waktu-pribadi.firebaseapp.com",
     projectId: "waktu-pribadi",
     appId: "1:123456789:web:abc123"
   };
   ```
   (Baris lain seperti `storageBucket` atau `messagingSenderId` boleh ikut ditempel, tidak masalah.)

   ⚠️ **Jangan** ikut menempel baris `import { initializeApp } ...`, `const app = initializeApp(...)`, atau `const firebaseConfig`. Yang ditempel hanya isi di dalam kurung kurawal `{ ... }`, dan baris harus diawali `export const CONFIG =` **tanpa** `//` di depannya.
3. Simpan file.

> Konfigurasi ini **bukan rahasia**. Yang melindungi data Anda adalah login + aturan keamanan di langkah 5.

### 4. Aktifkan login email & password
1. Menu kiri: **Build → Authentication** → **Get started**.
2. Tab **Sign-in method** → pilih **Email/Password** → aktifkan sakelar pertama (**Enable**) → **Save**.

### 5. Buat database
1. Menu kiri: **Build → Firestore Database** → **Create database**.
2. Location: pilih **asia-southeast2 (Jakarta)** (paling dekat). Lokasi tidak bisa diubah nanti.
3. Pilih **Start in production mode** → **Create**.
4. Setelah jadi, buka tab **Rules**. Hapus isinya, ganti dengan isi file `firestore.rules`:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
5. Klik **Publish**.

> Jangan pernah klik **Upgrade** / **Blaze plan**. Tetap di paket **Spark** (gratis). Kalau suatu hari kuota habis, aplikasi hanya berhenti sinkron sampai besok — tidak ada tagihan.

---

## Bagian B — GitHub Pages (hosting gratis)

### 6. Unggah aplikasi
1. Login ke https://github.com → klik **+** (kanan atas) → **New repository**.
2. Repository name: `waktu`. Pilih **Public** (hosting gratis butuh Public; data Anda tetap aman di Firebase, yang terlihat publik hanya kode aplikasinya). Klik **Create repository**.
3. Di halaman repository baru, klik link **uploading an existing file**.
4. Seret **semua isi folder aplikasi** (index.html, app.js, data.js, style.css, firebase-config.js, sw.js, manifest.webmanifest, folder `icons`, dll.) ke kotak upload. Pastikan `firebase-config.js` yang sudah Anda isi di langkah 3.
5. Klik **Commit changes**.

### 7. Nyalakan GitHub Pages
1. Di repository: **Settings** → menu kiri **Pages**.
2. Source: **Deploy from a branch**. Branch: **main**, folder **/ (root)** → **Save**.
3. Tunggu 1–2 menit, muat ulang halaman. Akan muncul alamat seperti:
   `https://NAMA-ANDA.github.io/waktu/`
   Itulah alamat aplikasi Anda.

### 8. Izinkan alamat itu di Firebase
1. Firebase Console → **Authentication** → tab **Settings** → **Authorized domains** → **Add domain**.
2. Isi `NAMA-ANDA.github.io` (tanpa `https://` dan tanpa `/waktu`) → **Add**.

---

## Bagian C — Mulai memakai

### 9. Buat akun (sekali saja)
1. Buka alamat aplikasi di laptop.
2. **Settings** → isi email & password (min. 6 karakter) → **Sign up**.
3. Selesai — status akan berubah menjadi "Synced".

**Disarankan (supaya orang lain tidak bisa membuat akun di aplikasi Anda):**
Firebase Console → **Authentication** → **Settings** → **User actions** → hilangkan centang **Enable create (sign-up)** → **Save**.
Akun Anda tetap bisa masuk seperti biasa.

### 10. Pasang di setiap perangkat
Buka alamat aplikasi, lalu:

| Perangkat | Cara memasang |
|---|---|
| **Android** (Chrome) | Menu ⋮ → **Instal aplikasi** / **Tambahkan ke layar utama** |
| **iPhone / iPad** (Safari) | Tombol **Bagikan** (kotak dengan panah) → **Tambah ke Layar Utama** |
| **Laptop** (Chrome / Edge) | Ikon **Instal** di ujung kanan kolom alamat |

Setelah terpasang, buka dari ikonnya → **Settings** → **Sign in** dengan email & password yang **sama**. Di iPhone, login harus dilakukan dari aplikasi yang sudah dipasang (bukan dari Safari), karena keduanya terpisah.

---

## Pemakaian sehari-hari

- **Ketuk ubin** = mulai / ganti / berhenti. Timer < 1 menit otomatis dibuang (dianggap salah ketuk).
- **Tahan ubin** = ubah nama, ikon, warna. **Tahan lalu geser** = pindah posisi.
- Sinkron berjalan otomatis. Tombol 🔄 di kanan atas hanya untuk berjaga-jaga.
- Tanpa internet tetap bisa dipakai; data dikirim otomatis saat online.

### Backup (sebulan sekali)
**Settings → Backup (JSON)**, lalu simpan file-nya ke Google Drive. Untuk memulihkan: **Settings → Restore from backup**.

---

## Memperbarui aplikasi nanti
1. Ganti file yang berubah di repository GitHub (**Add file → Upload files**, unggah file baru dengan nama yang sama).
2. Di `sw.js`, naikkan nomor versi pada baris `const V = 'waktu-1.0.0';` (misalnya `waktu-1.0.1`) dan unggah juga.
3. Perangkat akan memakai versi baru setelah aplikasi dibuka ulang (kadang perlu ditutup–buka dua kali).

---

## Jika ada masalah

| Gejala | Penyebab & solusi |
|---|---|
| Settings menulis "Not set up" | `firebase-config.js` di GitHub masih `null`. Unggah ulang file yang sudah diisi (langkah 3 & 6). |
| "Email/password sign-in is not enabled" | Ulangi langkah 4. |
| "Access denied. Check the Firestore security rules" | Aturan di langkah 5 belum di-**Publish** atau salah tempel. |
| "New sign-ups are disabled" | Anda sudah mematikan sign-up (langkah 9). Pakai **Sign in**, bukan **Sign up**. |
| Lupa password | Settings → isi email → **Forgot password?** → cek email. |
| Tombol 🔄 merah | Sedang offline atau ada error. Ketuk tombolnya untuk mencoba lagi; pesan penyebabnya akan muncul. Data tetap aman di perangkat dan dikirim nanti. |
| Halaman GitHub 404 | Tunggu 2–3 menit setelah langkah 7; pastikan `index.html` ada di folder paling atas repository, bukan di dalam subfolder. |

---

## Batas gratis (untuk pemakaian pribadi jauh di bawah batas)

| | Batas gratis per hari | Perkiraan pemakaian Anda |
|---|---|---|
| Baca data | 50.000 | ± 100–300 |
| Tulis data | 20.000 | ± 40–80 |
| Penyimpanan | 1 GB total | ± 15 MB setelah 10 tahun |

Teruji dengan data 10 tahun (43.800 catatan): perangkat baru mengunduh semuanya dengan ±3.650 pembacaan (7% kuota harian), dan membuka ulang aplikasi hanya membaca ±2 dokumen.
