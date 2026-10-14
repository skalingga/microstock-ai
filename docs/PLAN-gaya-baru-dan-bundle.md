# Rencana Tahap 14 (gaya baru) dan Tahap 11 (bundle)

Disusun 15 Okt 2026 atas permintaan pengguna: gaya bawaan sekarang "tidak menjual dan kurang bervariasi".
**Status: disetujui 15 Okt 2026** (lihat "Keputusan pengguna" di bawah). Gelombang 1 sudah dikodekan (`d52309c`); bundle dan gelombang 2 belum. Aturan kerja seperti tahap lain: rencana → persetujuan → kode kecil
per langkah → `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` → commit + push → perbarui PROGRESS.md.

## Latar

Gaya yang ada: set ikon flat, pola seamless, ilustrasi flat, badge, latar abstrak, ikon garis, ikon glyph, ubin
geometris, ditambah Siluet dan Line art (gambar AI lalu konversi). Hasil uji dan pembacaan panduan Adobe
menunjukkan:

- Kategori yang paling jenuh adalah latar, daun, bunga, awan ([diskusi komunitas Adobe](https://community.adobe.com/questions-38/advice-needed-315046)).
  Set ikon flat polos dan latar abstrak jatuh ke sini.
- Adobe menyebut pembeli mencari template, infografis, ikon, UI kit, dan siluet, dan yang laku adalah **set dan seri**
  dengan ruang kosong untuk teks ([panduan kontributor](https://blog.adobe.com/en/publish/2019/02/19/vector-tips-pros)).
- Tren 2026 yang disebut Adobe: organik dan tidak sempurna, collage, tekstur, nuansa hangat
  ([Adobe Express design trends](https://www.adobe.com/br/express/learn/blog/design-trends-2026)).

Catatan jujur: tidak ada data penjualan resmi di sini. Semua ini bacaan arah, bukan angka. Yang akan membuktikan
adalah data penerimaan Adobe (Tahap 6) per gaya baru.

## Prinsip

1. Semua gaya baru **ditulis model teks sebagai SVG**: biaya hampir nol, tanpa model gambar, memakai infrastruktur
   gaya Tahap 10 (spec per gaya di `lib/providers/prompts.ts`).
2. Tetap berlaku: tanpa teks dan huruf, tanpa merek, karakter fiksi, atau IP lain, tanpa orang realistis.
3. **Dua gelombang.** Setelah tiap gelombang, pengguna menguji satu batch dan memutuskan sebelum gelombang berikutnya.
   Gaya yang hasilnya jelek diperbaiki atau dibuang, bukan ditumpuk.
4. Bundle (Tahap 11) dibangun **setelah** gelombang 1, supaya bisa dicoba dengan set yang sungguh dibuat dari gaya baru.

## Bagian A: gaya baru

### Gelombang 1

| id | Label | viewBox | Isi |
|---|---|---|---|
| `sticker` | Stiker kartun (die-cut) | 512 × 512 | Satu objek, hewan, makanan, atau tanaman kartun, garis luar gelap tebal, warna flat, tepi putih tebal di sekeliling (garis potong). Latar transparan. |
| `isometric` | Isometrik (objek dan adegan) | 800 × 600 | Objek atau adegan bisnis/teknologi/logistik dalam proyeksi isometrik; tiga sisi dengan tiga tingkat terang dari satu warna. Latar transparan. |
| `frame` | Bingkai dan border dekoratif | 1000 × 1000 | Bingkai, karangan bunga, atau border dengan **tengah kosong** untuk teks atau foto pembeli. Latar transparan. |

Draf `brief` (bahasa Inggris, sesuai aturan bahasa prompt):

- **sticker**: "One cartoon sticker: a single cute simple object, animal, food or plant with a bold dark outline (constant stroke
  width 10, round joins) and flat colors. First draw ONE smooth white shape that follows the silhouette about 20 px outside
  the artwork (the die-cut border), then the artwork on top. TRANSPARENT background, no background rectangle. No text."
  Konsistensi set: lebar garis luar dan lebar tepi putih sama di seluruh set. Warna: palet + satu warna garis gelap + putih.
- **isometric**: "Isometric projection: 30 degree axes, no perspective, no outlines. Build every object from parallelograms with
  three visible faces: top lightest, left medium, right darkest, all tints of the same hue. Flat fills only. TRANSPARENT
  background. No text, no screens showing letters." Konsistensi: arah cahaya dan sudut sama di seluruh set.
- **frame**: "A decorative frame or border for stock use. All decoration sits in the outer band; the central 50 percent of the
  canvas stays completely empty and transparent so a buyer can place text or a photo. Balanced, symmetric or rhythmic. No text."

Tema contoh (masuk `THEME_POOL` Uji model): sticker "happy coffee cup", "sleepy house cat", "smiling avocado"; isometric
"warehouse with delivery boxes", "solar panel farm", "home office desk"; frame "eucalyptus wreath", "art deco corner border",
"tropical leaf border", "laurel wreath".

### Gelombang 2 (setelah hasil gelombang 1)

| id | Label | viewBox | Isi |
|---|---|---|---|
| `retro_70s` | Retro 70-an | 1000 × 1000 | Sunburst, busur pelangi, bunga daisy, garis bergelombang, palet jingga hangus, mustard, cokelat, teal, krem. |
| `boho_shapes` | Boho: bentuk organik | 512 × 512 | Busur, matahari dan bulan, daun, rumput pampas, blob; palet terakota, sage, pasir, krem. Latar transparan. |

Tidak masuk rencana ini (sengaja): ilustrasi konsep bisnis dengan figur manusia (model teks lemah menggambar manusia,
dan aturan "tanpa orang realistis" perlu keputusan sendiri), serta konversi berwarna dari model gambar (tracer kita hanya hitam).

### Pekerjaan teknis per gaya

| # | Berkas | Perubahan |
|---|---|---|
| 1 | `supabase/migrations/2026101x_new_styles.sql` | Perluas `generation_jobs_style_check` dan `user_settings_default_style_check` dengan id baru (pola sama seperti `20261015000000_icon_styles.sql`; jangan lupa `'photo'` di constraint job). Terapkan lewat MCP Supabase. |
| 2 | `lib/settings/schema.ts` | Entri `STYLES`; `COLOR_RANGES` bila warnanya terbatas. |
| 3 | `lib/providers/prompts.ts` | `STYLE_SPECS` (viewBox, brief, consistency, fills, colors) dan `METADATA_STYLE` (jangan bocorkan id gaya ke model). |
| 4 | `lib/qc/config.ts` | `STYLE_RULES`, `COMPLEXITY_OVERRIDES` (sticker: warn 60 / fail 150 / 2000 titik; isometric: 120 / 250 / 4000; titik awal, disetel dari data Adobe). |
| 5 | `lib/qc/checks.ts`, `lib/qc/measure.ts`, `lib/qc/evaluate.ts` | Pemeriksaan baru **ruang kosong** untuk `frame`: bagian tengah 50% × 50% hasil render harus ≥ 98% transparan (`QC.frame.centerEmptyMin`), selain itu `perlu_cek`. |
| 6 | `lib/metadata/postprocess.ts` | `GRAPHIC_STYLES`: tambahkan `frame`, `retro_70s`, `boho_shapes` (Adobe memasukkannya ke Graphic resources). `sticker` dan `isometric` **tidak**, supaya kategori ikut isi (Animals, Food, Business, Technology). |
| 7 | `lib/generate/benchmark-presets.ts` | `THEME_POOL` untuk gaya baru (TypeScript memaksa lengkap). |
| 8 | Pemilih gaya (Generate, Pengaturan "Gaya bawaan") | Dengan 15 gaya, kelompokkan: Ikon, Ilustrasi, Pola dan latar, Gambar AI. |
| 9 | `tests/` | Prompt tiap gaya: tanpa kebocoran id gaya, ada aturan "no text"; `STYLE_RULES` lengkap; unit test pemeriksaan ruang kosong. |

`SVG_EXAMPLES` (contoh SVG ke model) tidak dipakai kecuali hasil uji menunjukkan gaya gagal terus: contoh sebelumnya
melipatgandakan biaya tanpa menaikkan mutu (lihat komentar di `lib/providers/examples.ts`).

### Uji dan kriteria selesai (per gelombang)

1. Uji model: tiap gaya baru 2 tema × 2 konsep dengan model utama dan cadangan (biaya sekitar Rp0 sampai Rp20).
2. Pengguna menjalankan satu batch 8 aset per gaya di Generate, melihat hasilnya, dan menilai "layak dijual atau tidak".
3. Lanjut ke gelombang berikutnya hanya bila ≥ 5 dari 8 aset per gaya lolos QC **dan** menurut pengguna layak diunggah.
   Gaya di bawah itu diperbaiki spec-nya sekali, lalu dibuang bila tetap buruk.
4. Unggah batch ke Adobe dan catat keputusan di `/aset/tinjau` (data Tahap 6) sebelum menambah gaya lagi.

## Bagian B: bundle (Tahap 11)

Tujuan: 16 aset Lolos dari satu tema dan satu gaya digabung jadi **satu SVG grid** dengan satu metadata set
("Set of 16 …"). Pembeli yang menyukai satu ikon membeli seluruh set; ini yang disebut Adobe laku ("set dan seri").

### Keputusan desain (usulan)

- **Ukuran grid:** **5 × 5 (25) sebagai bawaan** (keputusan pengguna); pilihan 3 × 3, 4 × 4, dan 6 × 4 (lebar × tinggi, rasio 3:2). Jumlah anggota harus sama dengan jumlah sel; kalau aset Lolos kurang dari itu, pilih grid yang lebih kecil.
  Rasio 1:1 dan 3:2 lolos aturan artboard Adobe (15–65 MP, sisi terpanjang 4800 px).
- **Data:** perluas `assets.kind` dengan `'bundle'`, kolom baru `bundle_of uuid[]` (di aset bundle) dan `bundled_in uuid`
  (di anggota, menunjuk bundle-nya; `on delete set null`), dan `assets.provider` dengan `'local'` (disusun di browser,
  tanpa panggilan AI). Aset bundle memakai `job_id` anggota pertama. RLS tidak berubah.
- **Penggabungan di browser**, tanpa server: `lib/bundle/compose.ts`, fungsi murni yang dites.

### Pekerjaan teknis

| # | Berkas | Perubahan |
|---|---|---|
| 1 | `supabase/migrations/2026101x_bundle.sql` | `kind` memuat `'bundle'`, kolom `bundle_of uuid[] not null default '{}'`, `bundled_in uuid references assets(id) on delete set null`, `provider` memuat `'local'`. |
| 2 | `lib/bundle/compose.ts` (baru) | Tiap SVG anggota masuk satu `<g transform>` pada selnya; viewBox dinormalisasi; **semua `id` diberi awalan** supaya gradien dan `clipPath` tidak bentrok; satu viewBox akar; jarak seragam; latar transparan; jalankan sanitasi + SVGO lagi. |
| 3 | `app/(app)/aset/` (toolbar dan modal) | Tombol "Buat bundle" bila ≥ 4 aset Lolos satu gaya terpilih; modal pilih ukuran grid dan jarak, pratinjau, lalu simpan. |
| 4 | Simpan | Unggah SVG ke Storage (pola path yang sama), baris `assets` (`kind='bundle'`, `provider='local'`, `model='grid-4x4'`, `bundle_of=[...]`, `qc_status='menunggu'`). |
| 5 | Metadata | Prompt bundle ("Set of N …"): judul ≤ 70 karakter, keyword gabungan maks 49 berisi kata set/collection, lewat adapter seperti biasa. |
| 6 | `lib/qc/config.ts`, `lib/qc/batch.ts` | Batas kerumitan bundle lebih longgar; uji kemiripan melewati anggotanya sendiri. |
| 7 | `lib/export/build.ts`, halaman Ekspor (`page.tsx`) | Bundle diekspor seperti vektor (`svg_path`); nama file ≤ 30 karakter; daftar kandidat Ekspor menyaring `bundled_in is null`; peringatan hanya bila anggota dilepas. |
| 7b | `app/(app)/aset/` | Lencana "Dalam bundle", aksi "Lepas dari bundle", filter galeri. |
| 8 | `tests/` | Komposisi (posisi sel, awalan id, jumlah, viewBox), QC bundle, ekspor. |

### Aturan terhadap anggota (keputusan pengguna: ditahan otomatis)

- Begitu bundle dibuat, semua anggotanya **ditahan**: `bundled_in` diisi, mereka tidak muncul di daftar Ekspor dan tidak
  ikut "Pilih semua yang Lolos". Di galeri tampil lencana "Dalam bundle".
- Bisa dibalik: "Lepas dari bundle" di galeri (satu anggota atau semuanya). Menghapus aset bundle otomatis
  melepas semua anggotanya (`on delete set null`).
- Anggota yang **sudah diekspor** (`exported_at` terisi) tidak ikut ditahan diam-diam: modal pembuatan bundle
  memperingatkan dan meminta konfirmasi, karena satuannya mungkin sudah ada di Adobe (risiko "similar content").
- Halaman Ekspor tidak lagi perlu peringatan duplikat bundle + satuan untuk kasus normal, hanya bila pengguna melepas anggota.

## Urutan kerja dan perkiraan

| Langkah | Isi | Sesi |
|---|---|---|
| 1 | Gelombang 1 (sticker, isometric, frame): kode + uji model | 1 |
| 2 | Pengguna menguji batch dan memutuskan | – |
| 3 | Bundle (Tahap 11) | 1–2 |
| 4 | Gelombang 2 (retro_70s, boho_shapes) bila gelombang 1 layak | 1 |

## Risiko

| Risiko | Mitigasi |
|---|---|
| Model teks lemah menggambar karakter kartun | Mulai dari objek, hewan, dan makanan sederhana; ukur di uji model; buang gaya yang gagal |
| Tepi putih stiker dianggap latar tidak transparan oleh QC | Margin 48 px dan uji sebelum menyetel batas `borderOpaqueMax` |
| Isometrik kompleks → banyak path | Batas kerumitan sendiri; satu objek per aset |
| Bundle + satuan dianggap "similar" | Peringatan di Ekspor, uji satu tema dulu |
| Gaya baru tetap tidak laku | Data Adobe (Tahap 6) per gaya; berhenti menambah gaya sebelum ada data |

## Keputusan pengguna (15 Okt 2026)

1. **Gaya:** lima gaya dan dua gelombang disetujui tanpa perubahan.
2. **Ukuran grid bundle:** bawaan **25 (5 × 5)**.
3. **Palet:** tiga palet baru ditambahkan ke Pengaturan: "Retro 70-an", "Boho tanah", "Stiker cerah" (selesai, lewat SQL ke `user_settings.palettes`).
4. **Anggota bundle:** **ditahan otomatis** setelah bundle dibuat (bisa dilepas lagi; lihat "Aturan terhadap anggota").
