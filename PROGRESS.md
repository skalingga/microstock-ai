# Progress

## Status terakhir
Tahap 1, 2, dan 3 selesai dan terverifikasi (12 aset sudah dikirim ke Adobe Stock, status In review). Tahap 3b (peningkatan kualitas generate) selesai dan terverifikasi lewat batch pola. Dari sekarang kerja di branch `dev`, bukan `main`.

## Sudah selesai
- [2026-10-06] Tahap 1: fondasi (Next.js, Supabase Auth, skema + RLS, deploy Vercel)
- [2026-10-06] Tahap 2: generate + galeri dengan Kenari, antrean di browser, biaya dan batas bulanan Kenari
- [2026-10-06] Tahap 3: QC otomatis, metadata AI, ekspor ZIP + CSV Adobe, checklist upload; metadata tidak lagi menyebut clipart sebagai "icon"
- [2026-10-07] Tahap 3b: palet bawaan, set terpadu (warna dipaksa dari palet), contoh SVG hanya untuk pola, coba-ulang otomatis sekali saat Gagal QC, isian model Kenari untuk konsep dan metadata (migrasi `20261007000000_kenari_text_model.sql`)

- [2026-10-07] Verifikasi 3b: batch pola `autumn leaves` (palet Musim gugur, 5 aset) = 4 Lolos, 1 Gagal (gagal sambung tile), turun dari 2 gagal per 5; coba-ulang otomatis berjalan
- [2026-10-07] Login: tombol intip password, lupa password (email -> /auth/callback -> /reset-password). Perlu Redirect URLs di Supabase, lihat catatan

## Sedang dikerjakan
- Tahap 8 (riset tema) sudah dikode di branch `dev`; migrasi sudah diterapkan ke Supabase (2026-10-07). Uji di preview: alur jalan, tapi Google Trends tidak tersedia dari Vercel (semua permintaan berlabel perkiraan). Perbaikan setelah uji: peluang diturunkan bila batas upload sudah lewat, judul tema tanpa kata gaya. Belum dicentang di `CLAUDE.md`. File: `lib/research/*` (kalender, skor, Trends), `app/api/research/{themes,trends}`, `app/(app)/riset/*`.

## Langkah berikutnya
1. Verifikasi ulang `/riset` di preview `dev` (badge batas upload, judul tema), putuskan soal Google Trends (lihat catatan), lalu centang Tahap 8 di `CLAUDE.md`.
2. Tunggu hasil review Adobe untuk 12 file; catat diterima/ditolak dan alasannya (data untuk Tahap 6).
3. Tahap berikutnya: 5 (Gemini cadangan) atau 6 (uji unggah Adobe dan penyetelan ambang QC).

## Catatan penting
- Tahap 8: permintaan memakai Google Trends tidak resmi (`google-trends-api`, dibandingkan dengan kata jangkar "wallpaper", cache 6 jam di memori). Bisa diblokir kapan saja; bila gagal skor jatuh ke perkiraan AI + bobot event. Persaingan: input manual jumlah hasil Adobe per tema. Pengambilan otomatis dari Adobe BELUM dibuat: ketentuan dan robots.txt Adobe belum bisa dicek dari sandbox, jadi perlu dicek dulu. Tanggal event bergerak (Ramadan, Diwali, Imlek, Paskah) di `lib/research/calendar.ts` hanya perkiraan sampai 2029; cek lagi.
- QC pola belum menangkap motif tunggal besar (mis. wreath di tengah tile) atau pola yang terlalu sederhana (pita bergelombang); keduanya Lolos tapi meragukan untuk Adobe. Bahan penyetelan ambang di Tahap 6. Alasan persis Gagal (`qc_notes`) belum dicek di database.
- Lupa password butuh pengaturan Supabase (Authentication, URL Configuration, Redirect URLs): `https://microstock-ai-ruddy.vercel.app/auth/callback` dan `http://localhost:3000/auth/callback`. Tautan harus dibuka di browser yang sama dengan yang meminta reset (PKCE). Email bawaan Supabase dibatasi per jam.
- Aturan Adobe: maksimal 3 iterasi aset AI serupa per tema. Jangan terus membuat tema yang sama (pemeriksa kemiripan sudah menandainya).
- Uji banding Oktober 2026: contoh SVG di prompt menaikkan biaya SVG dari Rp4,3 ke Rp12,4 tanpa perbaikan di ikon/background, jadi hanya dipakai untuk pola. `deepseek-v4-flash` tetap disarankan untuk teks; `gpt-oss-*` murah tapi konsep dan metadatanya tipis.
- Aset lama (15 di akun `adminproject.code@gmail.com`) masih bermetadata dengan kata "icon"; 5 sudah terunggah ke Adobe. Edit manual di portal atau "Buat ulang metadata (AI)". Nama file ekspor bergantung pada judul, jadi ekspor ulang mengubah nama file.
- Catatan untuk Tahap 6 dan seterusnya: nama file ekspor yang stabil, keputusan soal gaya `icon_set` (mode ikon sungguhan vs ganti nama), verifikasi nomor kategori Adobe selain 8, penyetelan ambang QC dari data penerimaan nyata.
- Setiap push ke `main` otomatis deploy ke produksi di Vercel; branch `dev` hanya membuat preview.
- Jangan commit `.env*`. Jalankan `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` sebelum menyatakan tugas selesai.
