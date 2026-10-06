# Aturan Sinkronisasi PC ↔ Cloud (HP)

Proyek ini dikerjakan bergantian antara PC (lokal) dan cloud session yang
dilanjutkan dari HP. Cloud session HANYA bisa membaca apa yang sudah
di-push ke GitHub. Karena itu ikuti aturan di bawah ini setiap sesi.

## 1. Awal setiap sesi
- Jalankan `git pull` (atau `git fetch` + cek status) agar tidak bentrok dengan
  pekerjaan dari sesi lain.
- Baca `PROGRESS.md` di root repo untuk tahu apa yang sudah selesai dan apa
  langkah berikutnya. Jika belum ada, buat file itu.

## 2. Setelah setiap tugas selesai
Lakukan SEMUA langkah ini secara otomatis tanpa menunggu diminta:
1. Pastikan kode berjalan / test lulus (jika ada test).
2. `git add` hanya file yang relevan, lalu `git commit` dengan pesan jelas
   dalam format: `tipe: ringkasan singkat` (contoh: `feat: tambah form login`).
3. Perbarui `PROGRESS.md` (lihat format di bawah), commit bersama perubahan tadi.
4. `git push` ke branch yang sedang dipakai.
5. Konfirmasi singkat ke saya: apa yang selesai dan bahwa push berhasil.

Jangan menumpuk banyak tugas dalam satu commit besar. Satu tugas selesai =
satu commit + push.

## 3. Aturan branch
- Jangan bekerja langsung di `main`. Pakai branch kerja (contoh: `dev` atau
  `feature/nama-fitur`).
- Jangan pernah `git push --force`.
- Jika terjadi konflik saat pull/push, berhenti dan tanyakan ke saya.
  Jangan menimpa pekerjaan orang/sesi lain.

## 4. Jangan pernah di-commit
- File `.env`, API key, token, password, kredensial, atau data pribadi.
- Database lokal, file besar/binary yang tidak perlu, `node_modules`, dsb.
- Pastikan file-file ini ada di `.gitignore`. Jika proyek butuh variabel
  environment, dokumentasikan NAMA variabelnya saja di `README.md` atau
  `.env.example` (tanpa nilai asli).

## 5. Format PROGRESS.md
Selalu singkat dan terbaru. Gunakan struktur ini:

```
# Progress

## Status terakhir
(1-3 kalimat: kondisi proyek sekarang)

## Sudah selesai
- [tanggal] deskripsi singkat

## Sedang dikerjakan
- deskripsi + file terkait

## Langkah berikutnya
1. ...
2. ...

## Catatan penting
- keputusan desain, bug yang diketahui, hal yang harus diingat sesi berikutnya
```

Tujuan file ini: sesi berikutnya (PC maupun cloud) bisa langsung lanjut tanpa
riwayat percakapan, karena riwayat chat tidak ikut terbawa antar sesi.

## 6. Khusus saat berjalan di cloud session
- Ingat: yang terbaca hanya isi repo di GitHub. Jika butuh konteks yang tidak
  ada di repo, minta saya menjelaskannya lalu catat di `PROGRESS.md`.
- Tetap ikuti aturan commit + push di bagian 2, supaya hasil kerja bisa saya
  `git pull` di PC nanti.
- Di akhir sesi, pastikan `PROGRESS.md` sudah mencerminkan kondisi terbaru.

## 7. Gaya komunikasi
- Balas dalam bahasa Indonesia, ringkas dan langsung ke inti.
- Laporan akhir tiap tugas: apa yang diubah, file apa saja, dan langkah
  berikutnya.
