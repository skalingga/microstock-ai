# Rencana Tahap 10–13: gaya baru, bundle, riset multi-sumber

Disusun 8 Okt 2026 dari diskusi dengan pengguna (contoh: screenshot portofolio
kontributor lain dan halaman Adobe Insights "Recent top sellers", Vectors, 28 Sep–4 Okt).
Kerjakan satu tahap per sesi, berurutan. Setiap tahap: rencana singkat → persetujuan
pengguna bila ada pilihan desain → kode → `npm run lint`, `npx tsc --noEmit`,
`npm run build` → commit + push → perbarui PROGRESS.md.

## Temuan yang mendasari

- Top seller vektor Adobe minggu itu didominasi **set ikon besar dalam satu file**
  (ikon garis, glyph biru, ikon UI), lalu siluet orang, avatar flat beragam, dan orang isometrik.
- Halaman Insights tidak punya API dan perlu login. **Jangan scraping** (melanggar
  ketentuan kontributor, akun bisa kena sanksi). Gantinya: pengguna unggah screenshot.
- API resmi yang bisa dipakai: Adobe Stock Search API (`search_parameters[order]=nb_downloads`,
  filter vektor, jumlah hasil per keyword) dan Shutterstock API (`sort=popular|newest`).
  Keduanya perlu key dari pengguna; kuota gratis Shutterstock belum dicek.
- Data laris hanya dipakai untuk **tema, gaya, dan keyword**, tidak untuk meniru gambar.
- Set ikon dengan label tulisan bertabrakan dengan aturan "tanpa elemen teks". Tetap tanpa teks.

## Tahap 10 — Gaya baru (gratis, model teks)

Tujuan: ikon seperti contoh (eco line icons, awan/ikon 1 warna, ubin geometris hitam, ikan banyak variasi).

1. `lib/settings/schema.ts`: tambah gaya di `STYLES`:
   - `line_icon` "Ikon garis (outline)": stroke seragam, `stroke-linecap/linejoin="round"`, tanpa fill, 1 warna, latar transparan.
   - `glyph_icon` "Ikon glyph (solid)": bentuk padat 1–2 warna, latar transparan.
   - `geometric_tile` "Ubin geometris": persegi berbingkai, motif garis/bentuk hitam, simetris.
2. `lib/providers/prompts.ts`: prompt per gaya baru (lebar stroke tetap relatif viewBox, grid 24/48, padding, maks path).
   Opsional contoh SVG untuk `geometric_tile` di `lib/providers/examples.ts`.
3. Mode **"satu subjek, banyak variasi"** (ikan, awan): di `lib/generate/concept.ts` + form `/generate`,
   pilihan "Variasi satu subjek" → konsep membedakan pose/detail/pola, subjek tetap sama. Bisa digabung dengan set terpadu.
4. `lib/qc/config.ts`: aturan QC per gaya (ikon garis: cek elemen ber-`fill` selain `none` sebagai peringatan,
   batas path; ubin: tidak keluar viewBox). Ikon garis dan glyph = latar transparan seperti `icon_set`.
   Pemeriksa kemiripan: variasi satu subjek akan sering "mirip". Longgarkan ambang antar-aset **dalam batch yang sama** untuk mode ini saja, tetap ketat terhadap riwayat.
5. `components/style-preview.tsx`: contoh gambar untuk 3 gaya baru.
6. Migrasi bila `default_style`/kolom gaya dibatasi enum/check di database (cek `supabase/migrations/*image_styles*`).
7. Export: stroke tetap stroke (Adobe menerima). Pertimbangkan opsi "outline stroke" nanti, jangan sekarang.
8. Uji: 1 batch kecil per gaya baru dengan Gemini 3.5 Flash-Lite, catat Lolos/Perlu cek/Gagal di PROGRESS.md.

## Tahap 11 — Bundle (set ikon dalam satu file)

1. `/aset` (`asset-grid.tsx`, `asset-toolbar.tsx`): tombol "Buat bundle" saat memilih aset. Hanya aset `lolos`,
   gaya kompatibel (sebaiknya satu gaya + satu palet). Ukuran grid: tanyakan ke pengguna (usulan 9 / 16 / 25).
2. `lib/bundle/compose.ts` (baru): gabung SVG terpilih ke grid. Tiap ikon dalam `<g transform>`, `id` di-prefix agar
   tidak bentrok (gradien/clipPath), satu `viewBox`, jarak seragam, latar transparan, tanpa teks.
   Jalankan lagi sanitasi + SVGO. Jalan di browser.
3. Artboard: pakai `lib/export/artboard.ts` (15–65 MP, sisi terpanjang 4800 px). Grid persegi (3×3, 4×4, 5×5) atau 3:2 (mis. 4×6=24).
4. Simpan bundle sebagai aset baru: migrasi tabel `bundles` (id, user_id, title, asset_ids uuid[], created_at) + RLS,
   atau kolom `assets.bundle_of uuid[]` + `assets.kind` ('single'|'bundle'). Pilih yang paling kecil; cek PRD Model data.
5. Metadata bundle: prompt khusus ("Set of N ... line icons", keyword gabungan, maks 49), lewat adapter seperti biasa.
6. QC bundle: lewati uji kemiripan terhadap anggotanya sendiri; cek kerumitan total (batas path untuk bundle lebih longgar, di `lib/qc/config.ts`).
7. Ekspor seperti aset biasa. Di halaman ekspor beri peringatan: mengunggah bundle **dan** ikon satuan yang sama
   berisiko dianggap konten serupa. Uji dulu di Tahap 6 dengan satu tema.

## Tahap 12 — Riset dari screenshot pasar

1. `/riset`: pilihan sumber (tab/segmented): "Screenshot pasar" (baru, bawaan), "Kalender + Google Trends" (yang sekarang),
   nanti "Adobe Stock API".
2. Unggah 1–5 gambar (png/jpg/webp, kompres di browser, maks ~1 MB per gambar), isi nama sumber
   (Adobe Insights / Shutterstock / Freepik / lain) dan periode.
3. Route Handler baru `app/api/riset/screenshot/route.ts` (`maxDuration = 60`, tenggat 57 dtk): kirim gambar ke model visi lewat
   adapter (tambah method mis. `analyzeMarketImage` di `lib/providers/types.ts`; cek apakah endpoint OpenAI-compatible Gemini
   menerima `image_url` base64; Kenari model visi sebagai cadangan bila ada). Satu panggilan per gambar.
4. Output terstruktur (Zod di `lib/research/schemas.ts`): jenis aset, gaya, topik, ukuran set, lalu daftar tema baru
   (judul Inggris, gaya yang disarankan, seed keyword) yang **tidak menyebut merek/nama kontributor** (cek daftar kata terlarang).
5. Simpan: `research_runs` dengan `source = 'screenshot'` (migrasi kolom `source`, `source_label`), tema ke `themes` seperti biasa.
   Screenshot tidak disimpan permanen (atau Storage privat bila pengguna mau; tanyakan).
6. Skor: tema dari screenshot diberi sinyal permintaan "dari data pasar" (sesuaikan `provenanceOf` di `lib/research/score.ts`).
7. Tombol "Generate" per tema membawa gaya yang disarankan ke `/generate`.
8. Catat panggilan di `provider_usage`.

## Tahap 13 — Adobe Stock API (data unduhan + persaingan)

1. Pengguna membuat API key di Adobe Developer Console (Adobe Stock API). Env baru `ADOBE_STOCK_API_KEY` (server saja),
   tambahkan ke `.env.example` dan Vercel. Cek dokumentasi terbaru: header `x-api-key`, `x-product`, batas kuota.
2. `lib/research/adobe-stock.ts`: cari per keyword dengan filter vektor; ambil `nb_results` (persaingan) dan
   top N `order=nb_downloads` (judul + keyword, tanpa menyimpan gambar). Cache per keyword (tabel atau kolom JSON) agar hemat kuota.
3. Dipakai dua cara: (a) validasi tema dari Tahap 12 dan riset kalender: skor persaingan jadi data asli;
   (b) sumber riset sendiri: masukkan topik → keyword laris → tema.
4. Shutterstock API menyusul dengan pola yang sama bila pengguna mau (env `SHUTTERSTOCK_API_TOKEN`).

## Opsional (belakangan)

- Doodle hitam: varian prompt "hand-drawn doodle" untuk gaya Line art yang ada (gambar AI, Rp125).
- Doodle berwarna dengan arsiran: perlu trace multi-warna (posterize → potrace per warna) di `lib/svg/trace.ts`. Mahal dan rumit.

## Keputusan pengguna (8 Okt 2026)

1. Urutan disetujui: 10 → 11 → 12 → 13.
2. Satu bundle = **16 ikon** (grid 4×4, artboard persegi).
3. Pengguna bersedia membuat API key Adobe Stock (dan Shutterstock). Minta saat mulai Tahap 13.
4. Screenshot riset **dibuang** setelah dianalisis (tidak disimpan di Storage).
5. Tahap 10–13 sudah ditambahkan ke Roadmap CLAUDE.md.
