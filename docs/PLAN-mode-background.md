# Mode background (Tahap 15)

Dikodekan 15 Okt 2026 atas permintaan pengguna. Bukan fitur terpisah: varian dari Mode foto (Tahap 12, `docs/PLAN-mode-foto.md`).
Pengguna membuat gambarnya sendiri di Google Flow; aplikasi menulis prompt, menerima unggahan, QC, metadata, dan ekspor JPEG + CSV.

## Isi

- `/generate?jenis=foto`: pilihan **Foto | Background**. Background: rasio bawaan 16:9, mode "Desain beragam" atau "Variasi satu gaya".
- Prompt (`backgroundPromptsPrompt` di `lib/providers/prompts.ts`): tanpa subjek, orang, teks, logo, atau antarmuka; tiap prompt wajib
  teknik + dua sampai empat warna bernama + suasana, tak ada dua prompt dengan teknik dan pasangan warna sama; minimal separuh
  menyisakan area tenang untuk teks. Daftar `avoid` (subjek yang ditolak "similar") ikut dikirim.
- Metadata (`photoMetadataPrompt` varian `background`): kata kunci "background/backdrop/wallpaper", teknik, warna, kegunaan, "copy space".
- QC: batas kemiripan lebih longgar (`QC.similarity.maxHammingBackground = 3`, foto 8) karena gradien dan bokeh mudah ter-hash mirip;
  orang yang terdeteksi di background jadi Perlu cek.
- Varian disimpan di `generation_jobs.photo_prompts.variant` (tanpa migrasi). Job lama dianggap foto. Aset tetap `kind = 'photo'`.

## Batasan

- "Buat ulang metadata" di detail aset memakai prompt foto, bukan background (aset tidak menyimpan varian). Judul dan kata kunci
  bisa diedit manual, atau unggah ulang.
- Tidak ada filter galeri khusus background; aset tampil sebagai foto. Cari lewat batch (tema) atau judul.
- Aturan Adobe untuk foto berlaku penuh: 4 sampai 100 MP, JPEG, tanpa teks atau logo, centang "Created using generative AI tools".
  Unduh dari Flow dengan 2K Upscale (16:9 = 2752×1536, sekitar 4,2 MP).
- Kategori "abstract backgrounds" sangat jenuh (593 ribu hasil Adobe, 15 Okt 2026): tema harus spesifik.

## Yang belum diuji

Penerimaan Adobe untuk background AI dari Flow belum ada datanya. Catat hasilnya di data Tahap 6.
