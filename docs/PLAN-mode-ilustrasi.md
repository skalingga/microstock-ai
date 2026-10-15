# Rencana Tahap 16: Mode ilustrasi raster (Google Flow atau Gemini, setengah manual)

Disusun 15 Okt 2026 atas permintaan pengguna. Disetujui 15 Okt 2026 ("kita kerjakan"), gaya pertama stiker kartun die-cut.
Status: **kode selesai (langkah 2-5) di branch `dev`, menunggu uji pengguna (langkah 6)**. Langkah 1 (cek portal Adobe) menunggu unggahan pertama.
Penyimpangan dari rencana: tidak ada `maxHammingIllustration` baru (batas foto 8 + `maxRelative` sudah cukup; setel dari data bila perlu);
migrasi `20261020000000_photo_variant_illustration.sql` diperlukan karena `photo_variant` punya check constraint (sudah diterapkan ke Supabase).
Varian ketiga dari Mode foto (Tahap 12, `docs/PLAN-mode-foto.md`), sejajar dengan Mode background (Tahap 15,
`docs/PLAN-mode-background.md`). Kerjakan seperti tahap lain: rencana → persetujuan → kode → `npm run lint`,
`npx tsc --noEmit`, `npm test`, `npm run build` → commit + push → perbarui `PROGRESS.md`.

## Latar belakang

Perbandingan pengguna (15 Okt 2026): prompt yang sama ("Retro motorcycle cartoon sticker illustration") menghasilkan
SVG kasar di aplikasi (27 path, model teks `gemini-3.5-flash-lite` menulis kode SVG) dan gambar berdetail di aplikasi
Gemini (model gambar melukis piksel). Model teks tidak akan menyamai model gambar untuk ilustrasi berdetail; ini batas
jalurnya, bukan bug. Mode ilustrasi memakai model gambar lewat alur yang sama dengan Mode foto: aplikasi menulis prompt,
pengguna membuat gambar, aplikasi mengurus QC, metadata, dan ekspor JPEG + CSV.

Gaya vektor tetap dipertahankan untuk ikon, pola, dan ilustrasi datar sederhana. Mode ilustrasi untuk gaya yang
butuh detail dan tekstur (stiker kartun berdetail, cat air, ilustrasi buku anak, isometrik detail).

## Inti

1. **Prompt**: dari tema, AI menulis N prompt ilustrasi (Inggris), satu gaya terpilih, tanpa teks, merek, karakter, atau
   subjek yang ditolak "similar". Pengguna menyalinnya ke Flow atau Gemini.
2. **Generate**: manual oleh pengguna. Aplikasi tidak memanggil Flow atau API gambar (alasan sama dengan Tahap 12).
3. **Unggah**: file hasil diunggah ke aplikasi (jalur unggah foto yang ada).
4. **QC + metadata**: resolusi dan ukuran, kemiripan hash, lalu satu panggilan AI vision per gambar (judul, keyword,
   kategori, tanda masalah).
5. **Ekspor**: JPEG + CSV, checklist "Created using generative AI tools" seperti foto.

## Fakta Adobe (dicek 15 Okt 2026 lewat pencarian; halaman helpx memberi 403 dari sandbox, jadi cek ulang di portal)

- Ilustrasi raster: JPEG, sRGB, 4 sampai 100 MP, maksimal 45 MB. Sama dengan foto, jadi `ADOBE_PHOTO` dipakai ulang.
  Sumber: [syarat ilustrasi Adobe](https://helpx.adobe.com/stock/contributor/submit-your-content/submit-illustrations/technical-legal-requirements-illustration-submission.html).
- Panduan [ilustrasi generative AI](https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/generative-ai-illustrations-submission-guidelines.html):
  tandai sebagai generative AI saat unggah; hindari teks tertanam, tanda tangan, watermark, dan cacat model; dilarang meniru
  gaya seniman lain atau memakai prompt yang terkait IP nyata.
- Postingan komunitas 2023 menyebut AI diterima sebagai JPEG (atau PNG transparan), bukan vektor. Bagian ini lama:
  verifikasi saat unggahan pertama.
- Jangan membesarkan (enlarge) file; kompresi minimal; tanpa bingkai, vinyet, atau teks.

## Keputusan desain

- **Aset tetap `kind = 'photo'`**, varian baru `illustration` di `PHOTO_VARIANTS` (`lib/photo/config.ts`), disimpan di
  `generation_jobs.photo_prompts.variant` dan `assets.photo_variant`. Satu migrasi kecil bila ada check constraint pada
  `photo_variant`; bila kolomnya bebas teks, tanpa migrasi. Galeri, tinjau Adobe, ekspor, dan statistik penerimaan dipakai ulang.
- **Latar**: JPEG tidak transparan. Stiker dibuat die-cut di atas latar putih polos atau warna rata, bukan "transparent
  background". Prompt harus bilang `isolated on a plain pure white background`. Transparan (PNG + penghapus latar) di
  luar lingkup.
- **Pilihan gaya** (`lib/photo/config.ts`, daftar di config agar mudah diubah): stiker kartun die-cut, ilustrasi datar
  berwarna, cat air, ilustrasi buku anak, isometrik, kartun garis tebal retro. Satu job = satu gaya.
- **Orang**: bawaan tanpa orang realistis; karakter kartun generik boleh. Bila vision mendeteksi orang, aturan yang sama
  dengan foto (kotak "People and Property are fictional" di checklist ekspor).
- **Resolusi**: gambar dari aplikasi Gemini biasa kemungkinan di bawah 4 MP dan akan ditolak QC (pesan sudah ada).
  Jalur yang dijamin lolos: Flow dengan 2K Upscale (16:9 = 2752×1536, 4,2 MP). Pesan penolakan diubah agar menyebut
  Gemini juga.
- **Kata "vector"**: jangan masuk keyword atau judul untuk JPEG. Menyesatkan pembeli dan berisiko ditolak. Pakai
  "illustration", "cartoon", "sticker", "clipart" sesuai gaya.
- **Jenuh**: stiker kartun dan ilustrasi lucu sangat ramai di Adobe. Prompt wajib punya pembeda konkret (subjek spesifik,
  palet bernama, periode atau tema), dan daftar `avoid` dari `lib/subjects/saturation.ts` ikut dikirim.

## Perubahan kode

| Berkas | Perubahan |
| --- | --- |
| `lib/photo/config.ts` | `PHOTO_VARIANTS` + `"illustration"`, daftar `ILLUSTRATION_STYLES`, rasio bawaan 1:1 |
| `lib/providers/prompts.ts` | `ILLUSTRATION_RULES` + `illustrationPromptsPrompt` (dipanggil dari `photoPromptsPrompt`); `photoMetadataPrompt` varian `illustration` (keyword gaya, bahan, kegunaan, "isolated", tanpa "vector") |
| `lib/providers/types.ts`, `lib/generate/schemas.ts` | tipe dan skema menerima `variant: "illustration"` dan `style` ilustrasi |
| `lib/qc/photo.ts`, `lib/qc/config.ts` | batas kemiripan sendiri (`maxHammingIllustration`, mulai dari nilai foto, setel dari data); catatan isi untuk ilustrasi (periksa tepi die-cut, teks acak, bentuk meleleh) |
| `app/(app)/generate/photo-form.tsx` | pilihan **Foto \| Background \| Ilustrasi**, pilihan gaya, rasio bawaan 1:1, tautan buka Flow |
| `app/(app)/aset/*`, `filters.ts` | filter Jenis **Ilustrasi**, kartu bertanda, detail "Ilustrasi (Flow/Gemini)" |
| `lib/photo/run.ts` | meneruskan `variant` dan `style` ilustrasi ke prompt dan metadata |
| `supabase/migrations/…` | hanya bila perlu (lihat Keputusan desain) |
| `tests/photo.test.ts` (atau `tests/illustration.test.ts`) | prompt, skema, parse job lama, QC, filter galeri |

Tidak ada route atau tabel baru. Satu panggilan AI per aset per request tetap berlaku (aturan wajib 2).

## Risiko

| Risiko | Mitigasi |
| --- | --- |
| Adobe menolak ilustrasi AI raster atau menandai "similar" | Batch uji kecil (10 gambar, satu gaya) sebelum skala; catat hasil di data Tahap 6 per varian |
| Ukuran dari aplikasi Gemini di bawah 4 MP | Pakai Flow 2K Upscale; QC menolak dengan pesan jelas; jangan upscale di aplikasi |
| Ketentuan komersial Google untuk Flow/Gemini | Sama dengan Tahap 12 (fakta 4): pengguna membaca ketentuan sebelum unggah batch pertama |
| Gaya meniru seniman atau IP | Aturan prompt melarang nama seniman, karakter, dan merek; kata terlarang dicek sebelum tampil |
| Storage penuh (sekitar 1 MB per gambar) | Sudah ada tampilan pemakaian di `/pengaturan` |

## Di luar lingkup

- Konversi gambar ke SVG berwarna (jalur B). Bahan sudah ada (`lib/svg/trace.ts`, Tahap 7); layak diuji terpisah untuk
  gaya datar setelah data penerimaan Mode ilustrasi masuk.
- Latar transparan (PNG), penghapus latar, dan upscale di aplikasi.
- Otomatisasi Flow atau API gambar berbayar (lihat `docs/PLAN-foto-api.md`).

## Urutan kerja (satu commit per langkah)

1. Cek fakta di portal Adobe: tipe aset "Illustrations" untuk JPEG AI, kolom CSV, batas resolusi; catat di `lib/adobe/rules.ts`.
2. Config + skema + tipe (`variant: "illustration"`, daftar gaya) dan tes.
3. Prompt ilustrasi dan metadata, tes isi prompt.
4. Form `/generate`: pilihan varian dan gaya.
5. QC ilustrasi dan pesan penolakan; galeri dan filter Jenis.
6. Uji ujung ke ujung: satu gaya (stiker kartun), 10 prompt, generate di Flow 2K, unggah, ekspor, unggah ke Adobe, catat hasil.

## Pertanyaan terbuka (tanya pengguna sebelum langkah terkait)

1. Terjawab 15 Okt 2026: gaya pertama stiker kartun die-cut.
2. Terjawab 15 Okt 2026: sumber gambar Google Flow (2K Upscale).
3. Terjawab 15 Okt 2026 sebagian: pengguna **menginginkan latar transparan** (untuk bundle dan agar lebih mudah diterima Adobe),
   tetapi memilih **tetap JPEG dulu**. Halaman syarat ilustrasi Adobe hanya menyebut JPEG; PNG transparan untuk AI hanya
   disebut postingan komunitas 2023. Sebelum membangun alur PNG (hapus latar di browser, simpan PNG, ekspor PNG, CSV `.png`),
   pengguna mengunggah satu PNG transparan ke portal Adobe sebagai ilustrasi dan mencatat apakah diterima. Rencana teknis
   bila diterima: stiker dibuat di atas latar warna kunci polos (bukan putih, supaya tepi die-cut putih tetap ada),
   dihapus di browser lewat flood-fill dari tepi + despill, tanpa dependensi model ML.

## Tambahan 15 Okt 2026: gaya set ikon 3D (permintaan pengguna)

Pemicu: contoh orang lain (bulk prompt di Flow, 15 tema "3D business icons", 6 ikon per frame, latar putih). Gaya
`icon_set_3d` di `ILLUSTRATION_STYLES`, kode selesai di `dev`, menunggu uji pengguna.

- **Satu lembar = satu aset.** Lembar Flow 2K (16:9, 4,2 MP) diunggah utuh. Jangan dipotong jadi ikon: satu ikon hasil
  potongan sekitar 0,9 MP, di bawah minimal Adobe 4 MP.
- **Prompt satu baris**: `3D <sub-tema> icons, 6 icons in one frame: <6 ikon>, <tampilan + palet>, clean white
  background, no grid lines, no dividers, no panels, no cards, no frames.` Mode "Subjek berbeda" = tiap prompt sub-tema berbeda; "Variasi satu subjek" = satu
  topik, kelompok 6 ikon berbeda per lembar. Ikon yang biasanya bertulisan (badge ID, sertifikat, kontrak, stempel,
  papan, label harga, sampul buku, kalender, jam berangka) dilarang di prompt; contoh pengguna memuat "LOAN AGREEMENT",
  "ALEX JOHNSON", "RELAX", "APPROVED", yang akan jadi `visible_text`.
- **Metadata**: prompt yang memuat "icons in one frame" (`isIconSetPrompt`) membuat metadata menyebut sub-tema dan ikon
  utama, memakai "3D icons", "icon set", "icon collection" (kata "icon" aman untuk raster 3D; larangan kata itu hanya
  untuk ilustrasi vektor), tetap tanpa kata "vector".
- **Form**: memilih gaya ini mengganti rasio ke 16:9 (kembali ke 1:1 saat gaya lain dipilih). Tombol "Salin per baris
  (bulk)" sempat ditambahkan lalu dihapus atas permintaan pengguna (15 Okt 2026); "Salin semua" dan "Salin" per prompt tetap.
- **Temuan uji Flow pertama** (5 lembar): model gambar menggambar garis pemisah sel dan kartu panel karena kata "grid",
  dan kompas berhuruf N E S W. Akhiran prompt kini "two even rows of three, one seamless pure white background, no grid
  lines, no dividers, no panels, no cards, no frames, no text" dan jam, kompas, penggaris, paspor, uang dilarang.
- **Belum diketahui**: apakah Adobe menerima lembar multi-ikon JPEG sebagai ilustrasi AI dan tidak menandainya
  "similar". Unggah 1 sampai 3 lembar dulu sebelum satu batch penuh; catat di data Tahap 6.

## Uji batch pertama

Tema "machine learning" (permintaan pengguna 15 Okt 2026). Tema abstrak: prompt harus memakai subjek konkret (robot,
otak, rangkaian, tanaman bertumbuh) tanpa teks, rumus, atau diagram berlabel.
