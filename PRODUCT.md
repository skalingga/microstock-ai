# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Versi 1: satu pengguna, pemilik aplikasi, kontributor Adobe Stock dari Indonesia. Ia memakai aplikasi seimbang di PC/laptop dan HP: menjalankan antrean generate, memeriksa galeri dan status QC, mengedit metadata, lalu mengekspor dan mengunggah manual ke portal Adobe Stock.

Bila dijual nanti: kontributor microstock Indonesia, dari pemula sampai menengah, dengan antarmuka Bahasa Indonesia dan harga dalam Rupiah. Belum ada pengguna lain.

## Product Purpose

Membuat aset vektor SVG siap unggah ke Adobe Stock dari satu tema: riset tema, generate variasi, QC otomatis, metadata AI, ekspor ZIP + CSV. Masalah yang diselesaikan: membuat vektor, menulis metadata, dan mengecek kepatuhan satu per satu memakan waktu dan rawan ditolak.

Sukses versi 1: lebih dari 1.000 SVG lolos QC per bulan (sekitar 33 per hari) dengan biaya API di bawah batas bulanan Kenari (bawaan Rp20.000); jalur teks Rp0. Target tingkat penerimaan Adobe ditetapkan setelah batch uji pertama.

## Positioning

Tiga hal sekaligus, yang tidak didapat dari sekadar meminta AI menggambar:
- **Patuh aturan Adobe Stock sebelum upload.** QC dan metadata memaksakan aturan Adobe (tanpa teks, latar transparan untuk ikon, pola seamless, kata terlarang, batas keyword, ukuran artboard) agar aset tidak ditolak.
- **Biaya hampir nol.** Jalur utama memakai model gratis; model berbayar dibatasi anggaran bulanan dan ditolak saat batas tercapai.
- **Satu alur utuh.** Dari riset tema sampai ZIP + CSV dalam satu tempat.

## Operating Context

- Alur: login, Riset (region dan periode, tema diurutkan menurut peluang), Generate (tema, gaya, palet, jumlah variasi), antrean berjalan di browser satu aset sekali jalan, Galeri aset (filter Semua, Menunggu, Lolos, Perlu Cek, Gagal; edit metadata), Ekspor (pilih aset Lolos, unduh ZIP + CSV, checklist upload), lalu unggah manual ke Adobe Stock Contributor Portal dan centang label generative AI.
- Antrean hidup di tab browser: tab harus tetap terbuka selama generate. Satu aset bisa butuh 5 sampai 60 detik.
- Hasil review Adobe dicatat manual per aset untuk menyetel ambang QC (Tahap 6).
- Halaman: `/login`, `/riset`, `/generate`, `/uji-model`, `/aset`, `/ekspor`, `/pengaturan`.

## Capabilities and Constraints

- Output hanya SVG (tipe Vector Adobe). Raster hanya bahan antara untuk gaya Siluet dan Line art, tidak pernah diekspor.
- Gaya: set ikon, pola seamless, ilustrasi flat, lencana/label, latar abstrak, siluet, line art.
- Status QC: `lolos`, `perlu_cek`, `gagal`. Hanya `lolos` yang bisa diekspor tanpa konfirmasi manual.
- Provider AI: Kenari (OpenAI-compatible), Gemini direct (cadangan otomatis), Kenari gambar (`gpt-image-2`, berbayar per gambar). Recraft opsional, belum dibangun.
- Stack: Next.js (App Router) + TypeScript, Tailwind, shadcn/ui, Supabase (Auth, Postgres + RLS, Storage), Vercel Hobby (non-komersial; pindah ke Pro saat dijual).
- SVG dari AI tidak dipercaya: selalu disanitasi dan ditampilkan lewat `<img>`, tidak pernah inline.
- Bahasa: antarmuka dan pesan error Bahasa Indonesia; metadata aset (judul, keyword) Bahasa Inggris.
- Keputusan terbuka: ambang QC (setelah 50-100 aset diuji ke Adobe), cara mengambil data persaingan Adobe (otomatis atau manual), kuota dan langganan saat dijual.

## Brand Commitments

- Nama: MicroStock Vector AI.
- Sapaan ke pengguna: "kamu", singkat dan langsung.
- Arah visual sudah dipilih pengguna dan dicatat di `DESIGN.md` (8 Oktober 2026); pertahankan.

## Evidence on Hand

- Hasil uji banding model (7 Oktober 2026, 5 tema × 8 model) di `PROGRESS.md` dan tabel `model_benchmarks`.
- Sekitar 128 aset di galeri akun pemilik; 12 file sudah dikirim ke Adobe, keputusan Adobe belum dicatat.
- Belum ada: data tingkat penerimaan Adobe, pengguna lain, testimoni, harga jual, atau angka pemakaian publik. Jangan dikarang.

## Product Principles

1. Lebih baik tidak diekspor daripada ditolak Adobe: aturan kepatuhan menang atas kecepatan.
2. Biaya terlihat dan dibatasi: setiap panggilan berbayar dicatat dan berhenti di batas bulanan.
3. Satu alur lurus: setiap halaman membawa ke langkah berikutnya, dari tema sampai file siap unggah.
4. Kerja batch harus bisa dipantau dari PC maupun HP.
5. Jangan menampilkan klaim atau angka tanpa sumber nyata.

## Accessibility & Inclusion

- WCAG AA untuk teks (4,5:1) dan 3:1 untuk batas komponen dan indikator fokus, di mode terang dan gelap.
- Target sentuh minimal 44 px di HP dan layar sentuh; semua kontrol bisa dipakai dengan keyboard.
- Status tidak boleh hanya mengandalkan warna.
