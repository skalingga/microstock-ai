# Progress

## Status terakhir
Tahap 1, 2, 3, 3b, dan 8 selesai dan terverifikasi. Tahap 6 (uji ke Adobe): alat pencatatan dan laporan sudah di produksi, tetapi batch ujinya belum jalan. Semua kode sudah di `main` (produksi) dan `dev`; tidak ada pekerjaan yang menggantung. Kerja di branch `dev`, bukan `main`.

## Sudah selesai
- [2026-10-06] Tahap 1: fondasi (Next.js, Supabase Auth, skema + RLS, deploy Vercel)
- [2026-10-06] Tahap 2: generate + galeri dengan Kenari, antrean di browser, biaya dan batas bulanan Kenari
- [2026-10-06] Tahap 3: QC otomatis, metadata AI, ekspor ZIP + CSV Adobe, checklist upload; metadata tidak lagi menyebut clipart sebagai "icon"
- [2026-10-07] Tahap 3b: palet bawaan, set terpadu (warna dipaksa dari palet), contoh SVG hanya untuk pola, coba-ulang otomatis sekali saat Gagal QC, isian model Kenari untuk konsep dan metadata (migrasi `20261007000000_kenari_text_model.sql`)

- [2026-10-07] Verifikasi 3b: batch pola `autumn leaves` (palet Musim gugur, 5 aset) = 4 Lolos, 1 Gagal (gagal sambung tile), turun dari 2 gagal per 5; coba-ulang otomatis berjalan
- [2026-10-07] Tahap 8 riset tema (kalender, Google Trends, skor peluang; migrasi `20261008000000`), alat Tahap 6 (migrasi `20261009000000`), pilihan model SVG di `/generate`, perbaikan riset pasar Dunia (jatah token). Semua sudah di `main`
- [2026-10-07] Login: tombol intip password, lupa password (email -> /auth/callback -> /reset-password). Perlu Redirect URLs di Supabase, lihat catatan

## Sedang dikerjakan
- Tidak ada kode yang menggantung. Tahap 6 menunggu data dari pengguna: unggah batch 50-100 aset lintas banyak tema (maks 3 iterasi serupa per tema), isi keputusan Adobe di `/aset/[id]`, lihat kartu "Tingkat penerimaan Adobe" di `/ekspor`, lalu setel `lib/qc/config.ts` dari datanya. Belum dicentang.

## Langkah berikutnya
1. Bandingkan model: buat batch kecil (5 aset) dengan tema, gaya, dan palet sama memakai model berbeda lewat dropdown di `/generate`, bandingkan di galeri dan biaya. Satu-satunya model yang sudah teruji: `deepseek-v4-flash`.
2. Isi hasil review Adobe untuk 12 file yang sudah dikirim (data untuk Tahap 6).
3. Pilih tahap berikutnya: 5 (Gemini cadangan, bisa sekaligus dipakai membandingkan kualitas), 4 (uji banding model), atau 7 (Recraft, SVG vektor native).

## Catatan penting
- Pilih model per generate: `/generate` punya dropdown model (daftar dari katalog Kenari lewat `/api/models`, gratis dan berbayar dengan perkiraan harga). Berlaku hanya untuk panggilan SVG; model terpilih jalan sendirian tanpa fallback; konsep dan metadata tetap dari Pengaturan. Model berbayar tetap kena batas biaya Kenari bulanan. Bila katalog gagal dimuat, kolom jadi teks bebas.
- Tahap 8: permintaan memakai Google Trends tidak resmi (`google-trends-api`, dibandingkan dengan kata jangkar "wallpaper", cache 6 jam di memori). Bisa gagal sesekali atau diblokir kapan saja; bila gagal skor jatuh ke perkiraan AI + bobot event. Persaingan: input manual jumlah hasil Adobe per tema. Pengambilan otomatis dari Adobe BELUM dibuat: ketentuan dan robots.txt Adobe belum bisa dicek dari sandbox, jadi perlu dicek dulu. Tanggal event bergerak (Ramadan, Diwali, Imlek, Paskah) di `lib/research/calendar.ts` hanya perkiraan sampai 2029; cek lagi.
- QC pola belum menangkap motif tunggal besar (mis. wreath di tengah tile) atau pola yang terlalu sederhana (pita bergelombang); keduanya Lolos tapi meragukan untuk Adobe. Bahan penyetelan ambang di Tahap 6. Alasan persis Gagal (`qc_notes`) belum dicek di database.
- Lupa password butuh pengaturan Supabase (Authentication, URL Configuration, Redirect URLs): `https://microstock-ai-ruddy.vercel.app/auth/callback` dan `http://localhost:3000/auth/callback`. Tautan harus dibuka di browser yang sama dengan yang meminta reset (PKCE). Email bawaan Supabase dibatasi per jam.
- Aturan Adobe: maksimal 3 iterasi aset AI serupa per tema. Jangan terus membuat tema yang sama (pemeriksa kemiripan sudah menandainya).
- Uji banding Oktober 2026: contoh SVG di prompt menaikkan biaya SVG dari Rp4,3 ke Rp12,4 tanpa perbaikan di ikon/background, jadi hanya dipakai untuk pola. `deepseek-v4-flash` tetap disarankan untuk teks; `gpt-oss-*` murah tapi konsep dan metadatanya tipis.
- Aset lama (15 di akun `adminproject.code@gmail.com`) masih bermetadata dengan kata "icon"; 5 sudah terunggah ke Adobe. Edit manual di portal atau "Buat ulang metadata (AI)". Nama file ekspor bergantung pada judul, jadi ekspor ulang mengubah nama file.
- Catatan untuk Tahap 6 dan seterusnya: nama file ekspor yang stabil, keputusan soal gaya `icon_set` (mode ikon sungguhan vs ganti nama), verifikasi nomor kategori Adobe selain 8, penyetelan ambang QC dari data penerimaan nyata.
- Setiap push ke `main` otomatis deploy ke produksi di Vercel; branch `dev` hanya membuat preview.
- Jangan commit `.env*`. Jalankan `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` sebelum menyatakan tugas selesai.
