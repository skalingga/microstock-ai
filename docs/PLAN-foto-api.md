# Rencana Tahap 12b: foto otomatis lewat API resmi Gemini (Nano Banana)

Disusun 10 Okt 2026 atas permintaan pengguna (tidak punya waktu mengunggah foto dari Flow satu per satu).
Pengganti agen yang login ke Flow: itu **tidak dikerjakan** (Flow tanpa API resmi, otomatisasi tampilan
berisiko ke akun Google pengguna, lihat `docs/PLAN-mode-foto.md`). Tahap ini hanya rencana; belum ada kode.

## Syarat mulai (gerbang)

Jangan dikerjakan sebelum Tahap 12 (mode manual) dicoba satu batch dan hasil Adobe-nya tercatat:
bila foto AI banyak ditolak ("similar content", kualitas), otomatisasi hanya mempercepat penolakan dan
membakar uang. Targetkan: foto Lolos QC yang diterima Adobe cukup untuk menutup biaya per foto.

## Inti

Satu tombol di tab Foto: **"Buat foto otomatis"**. Aplikasi memanggil API resmi Gemini (model gambar Nano Banana)
satu foto per panggilan dari antrean di browser, lalu memakai alur yang sudah ada: preview, hash, QC foto,
metadata vision, galeri, ekspor. Prompt tetap dari `generatePhotoPrompts`. Mode manual Flow tetap ada (gratis).

## Biaya (cek ulang sebelum membangun)

Dari blog pihak ketiga (benchlm.ai, dibaca 11 Sep 2026, mengutip halaman harga Google); angka resmi wajib dicek:

| Model | ID | 1K/2K | 4K |
| --- | --- | --- | --- |
| Nano Banana Pro | `gemini-3-pro-image-preview` | sekitar $0,134 | sekitar $0,24 |
| Nano Banana 2 | `gemini-3.1-flash-image` | sekitar $0,101 | belum diketahui |

Tidak ada kuota gratis untuk API gambar. 100 foto 2K sekitar $10–13. Nama model berubah-ubah (model preview):
jangan dikunci di kode, simpan sebagai pengaturan seperti model Kenari.

## Aturan proyek yang berubah (menunggu persetujuan pengguna saat tahap dimulai)

- CLAUDE.md, tabel Provider: "Jangan pakai API gambar Gemini" ditulis untuk SVG. Untuk foto, diganti: dipakai,
  hanya lewat tombol eksplisit dengan estimasi biaya dan batas bulanan (seperti aturan Recraft). Tidak pernah otomatis.
- Batas bulanan baru, dalam USD, bawaan **$10** (usulan, sama dengan Recraft; pengguna yang menentukan).
  Tercapai = tombol terkunci sampai bulan berikutnya (zona WIB). Berlaku terpisah dari batas Kenari.
- Env var baru `GEMINI_IMAGE_API_KEY` dan `GEMINI_IMAGE_MODEL`; perbarui `.env.example` dan Vercel.

## Keputusan desain penting

1. **Kunci terpisah.** Gemini API gambar butuh billing aktif. Billing pada satu project Google dapat mengubah
   panggilan teks gratis (Flash-Lite, rantai provider sekarang) di project itu jadi berbayar. Karena itu: buat
   project Google Cloud/AI Studio **kedua** khusus gambar, dengan kunci `GEMINI_IMAGE_API_KEY`. Kunci teks
   (`GEMINI_API_KEY`) tetap di project gratis. Verifikasi perilaku ini di dokumentasi billing Google sebelum mengaktifkan.
2. **Adapter, bukan panggilan langsung** (aturan wajib 4). Metode baru di `SvgProvider`:
   `generatePhotoImage({ prompt, aspect, size })` mengembalikan `{ path, mimeType, width, height, costUsd }`.
   Implementasi di `lib/providers/gemini-image.ts` memakai endpoint native `generateContent`
   (`responseModalities: ["IMAGE"]`, `imageConfig: { aspectRatio, imageSize: "2K" }`, huruf K besar),
   BUKAN endpoint OpenAI-compatible (belum diketahui mendukung gambar). Adapter lain melempar `not_implemented`.
3. **Batas body Vercel 4,5 MB.** Foto 2K bisa beberapa MB dan base64 menambah sepertiga. Maka server **tidak
   mengirim gambar ke browser**: Route Handler menyimpan JPEG langsung ke Supabase Storage dengan sesi
   pengguna (RLS folder `{user_id}/photo/`), lalu membalas hanya path dan ukuran. Browser mengunduh lewat
   signed URL untuk preview, hash, dan salinan vision. Cek angka batas di dokumentasi Vercel saat implementasi.
4. **Satu panggilan AI per foto per request** (aturan wajib 2), route `app/api/generate/photo-image`,
   `maxDuration = 120` (waktu per gambar belum diukur; Kenari gpt-image-2 perlu 13-57 dtk), timeout panggilan
   105 dtk, **tanpa cadangan dan tanpa coba-ulang otomatis** (setiap percobaan berbayar), seperti gaya gambar Kenari.
5. **Biaya dicatat dan dijaga.** `provider_usage.kind` ditambah `'image'`; biaya di `cost_usd`. RPC baru
   `provider_cost_usd_since(p_provider, p_since)`; `CallGuard` menolak panggilan bila pemakaian bulan ini
   plus biaya panggilan melewati `user_settings.photo_monthly_budget_usd`. Gagal membaca pemakaian = tolak
   (fail closed, seperti Kenari). Harga per model di `lib/providers/gemini-image-pricing.ts`; model tanpa
   harga ditolak (seperti `kenari-image-pricing.ts`).
6. **Tidak ada watermark terlihat** harus dipastikan dari hasil pertama (SynthID tak terlihat tidak masalah).
   Ukuran piksel 2K via API harus ≥ 4 MP; QC foto yang ada sudah menolak yang lebih kecil. Ada laporan forum
   bahwa `imageSize` kadang diabaikan; ukur hasil nyata. Bila 2K < 4 MP, opsi: 4K (sekitar 2x biaya) atau berhenti.

## Perubahan per berkas

| Berkas | Isi |
| --- | --- |
| `supabase/migrations/…_photo_api.sql` | `provider_usage.kind` + `'image'`; `user_settings.photo_monthly_budget_usd numeric default 10`, `photo_image_model text`; RPC `provider_cost_usd_since`; perbarui `lib/database.types.ts` |
| `lib/providers/types.ts`, `openai-compat.ts`, `kenari-image.ts` | metode `generatePhotoImage`; yang lain `not_implemented` |
| `lib/providers/gemini-image.ts` (baru) | adapter native, baca `inlineData`, tangani blokir keamanan (`finishReason`/`promptFeedback`) sebagai `bad_output`, tangani 429/403 billing |
| `lib/providers/gemini-image-pricing.ts` (baru) | harga USD per model dan ukuran, model bawaan |
| `lib/providers/index.ts` | `photoImageOrder()` (satu entri, tanpa cadangan), guard anggaran USD |
| `lib/api/generate-route.ts` | dukung guard USD dan simpan-ke-Storage sebagai hook route (bukan di adapter) |
| `app/api/generate/photo-image/route.ts` (baru) | satu foto per request, unggah ke Storage, balas path/ukuran/biaya |
| `lib/generate/schemas.ts` | skema permintaan (prompt, aspek, ukuran, model) |
| `lib/photo/run.ts`, `process.ts` | `uploadPhoto` menerima Blob dari signed URL; `generatePhotos` memanggil route per prompt dengan `RateGate`, `AbortSignal`, tombol Hentikan |
| `app/(app)/generate/photo-form.tsx` | tombol "Buat foto otomatis" per set prompt: estimasi biaya (jumlah × harga), sisa anggaran, konfirmasi jika > sisa, pilih model dan foto per prompt (bawaan 1, maks 3: Adobe menolak lebih dari 3 serupa) |
| `app/(app)/pengaturan/…` | batas bulanan USD, model gambar, pemakaian bulan ini |
| `tests/photo-api.test.ts` (baru) | adapter dengan `fetch` palsu (sukses, diblokir, 429, billing mati), harga, guard anggaran, skema |
| `CLAUDE.md`, `PRD.md`, `.env.example`, `PROGRESS.md` | aturan, env var, roadmap |

## Risiko

| Risiko | Mitigasi |
| --- | --- |
| Biaya membengkak | Tombol eksplisit + estimasi + batas bulanan USD + fail closed; tidak pernah otomatis |
| Panggilan gagal tapi tetap ditagih | Catat biaya konservatif bila gambar sudah dijawab tapi tak terpakai (pola `ProviderError.costUsd`); cocokkan dengan tagihan Google setelah batch pertama |
| Billing mengubah panggilan teks gratis jadi berbayar | Project dan kunci terpisah untuk gambar (keputusan 1) |
| Foto ditolak Adobe massal | Gerbang di atas; prompt spesifik, daftar `avoid`, maks 3 serupa per tema |
| Kuota/limit API gambar tidak jelas (sumber saling bertentangan, ada laporan 429 walau tier berbayar) | Baca batas di AI Studio proyek sendiri; `RateGate` membaca header/ jeda 429; antrean berhenti dengan pesan jelas |
| Model preview diganti/dihapus | Nama model di pengaturan, bukan di kode; kesalahan `model_unavailable` jelas |
| Batas body Vercel | Server simpan ke Storage, balas metadata saja |

## Urutan kerja

1. Cek fakta (di bawah) dan catat hasilnya di berkas ini.
2. Pengguna membuat project Google kedua + kunci, mengaktifkan billing, menentukan batas bulanan.
3. Migrasi + tipe + harga + adapter + tes (tanpa UI).
4. Route + guard anggaran + tes.
5. UI tombol, estimasi, pengaturan.
6. Uji nyata kecil: 3 foto, cek ukuran piksel, watermark, biaya di dashboard Google vs `provider_usage`.
7. Batch 10 foto, kirim ke Adobe, catat penerimaan.

## Fakta yang wajib dicek (jangan menebak)

1. Harga resmi per gambar dan ukuran (halaman harga Gemini API), nama model yang berlaku hari itu.
2. Bentuk permintaan/respons `generateContent` untuk gambar (dokumentasi resmi, bukan blog) dan apakah SDK
   resmi diperlukan atau cukup `fetch`.
3. Ukuran piksel nyata hasil `imageSize: "2K"` untuk tiap rasio (≥ 4 MP?).
4. Apakah billing project mengubah harga panggilan teks model gratis; apakah kunci project lain bisa dipakai terpisah.
5. Batas laju (RPM/RPD) tier berbayar di AI Studio proyek pengguna.
6. Batas body respons dan fungsi Vercel Hobby (4,5 MB?) dan waktu per gambar sebenarnya.
7. Ketentuan Google untuk output API (penggunaan komersial, watermark SynthID) dan kebijakan Adobe untuk foto AI-upscale/AI murni di data Tahap 6.

## Pertanyaan untuk pengguna

1. Batas bulanan USD: $10 (usulan) atau lain?
2. Model bawaan: Nano Banana Pro (kualitas, sekitar $0,134) atau Nano Banana 2 (sekitar $0,101)?
3. Bersedia membuat project Google kedua khusus gambar dan mengaktifkan billing?
4. Mulai setelah hasil Adobe mode manual tercatat (usulan), atau lebih awal?
