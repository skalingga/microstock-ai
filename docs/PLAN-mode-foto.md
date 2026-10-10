# Rencana Tahap 12: Mode foto (Google Flow, setengah manual)

Disusun 10 Okt 2026 dari masukan pengguna (screenshot Google Flow: Nano Banana Pro, 0 kredit AI
dengan langganan pengguna; contoh foto orang fiktif di ruang terapi dan rumah kaca). Disetujui
pengguna 10 Okt 2026. Nomor 12 dipakai ulang: Tahap 12 lama (riset dari screenshot) sudah dihapus 9 Okt.
Kerjakan seperti tahap lain: rencana → persetujuan pilihan desain → kode → `npm run lint`,
`npx tsc --noEmit`, `npm test`, `npm run build` → commit + push → perbarui PROGRESS.md.

## Inti

Aplikasi **tidak membuat foto**. Foto dibuat pengguna sendiri di Google Flow. Aplikasi mengurus
bagian sebelum dan sesudahnya:

1. **Prompt**: dari tema (Riset atau ketik), AI menulis N prompt foto stok (Inggris), sudah
   menghindari merek, nama orang, teks, dan subjek yang ditolak "similar". Pengguna menyalinnya ke Flow.
2. **Generate di Flow**: manual, memakai kredit langganan pengguna (Rp0 bagi aplikasi).
3. **Unggah**: file hasil Flow diunggah ke aplikasi, langsung dari browser ke Supabase Storage.
4. **QC + metadata**: pemeriksaan teknis di browser, lalu satu panggilan AI vision per foto
   (judul, keyword, kategori, plus tanda masalah: teks/logo/watermark terlihat, wajah/tangan cacat).
5. **Ekspor**: JPEG + CSV seperti vektor, dengan checklist tambahan untuk foto.

## Kenapa tidak otomatis

- Flow tidak punya API resmi. Pembungkus tidak resmi (mis. useapi.net) mengendalikan akun Flow
  pengguna: melanggar semangat aturan wajib 4 (provider lewat adapter yang sah), rawan rusak, dan
  berisiko akun Google pengguna diblokir. **Jangan diotomatisasi, jangan scraping.**
- Kredit Flow tidak berlaku di API. API resmi gambar Gemini/Vertex berbayar dan sudah dilarang
  di CLAUDE.md (bagian Provider).

## Di luar lingkup tahap ini

- Video (Veo). Aturan Adobe untuk video berbeda dan kreditnya mahal. Bisa jadi tahap terpisah nanti.
- Upscale. Bila ternyata ukuran unduhan Flow di bawah minimum Adobe, berhenti dan tanya pengguna
  (lihat Pertanyaan terbuka 1).
- Edit foto (crop, retouch) di aplikasi.
- Riset tema khusus foto. Pakai `/riset` yang ada; bobot tema untuk foto bisa disetel nanti.

## Perubahan aturan proyek

- CLAUDE.md dan PRD: "ekspor hanya SVG" dan "hindari orang realistis" berlaku untuk **vektor**.
  Untuk foto, orang fiktif boleh, dengan aturan di bawah. Sudah dicatat di kedua berkas.
- Adobe ([panduan generative AI](https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/generative-ai-content-guidelines.html),
  dicek 10 Okt 2026): selain "Created using generative AI tools", foto yang menampilkan orang atau
  properti fiktif wajib dicentang "People and Property are fictional". Orang nyata butuh model release:
  prompt tidak boleh menyebut orang sungguhan atau memakai foto orang sungguhan.
- Aturan 3 iterasi serupa per tema berlaku juga untuk foto. Contoh screenshot (banyak adegan terapi
  dua orang di sofa) sudah berisiko "similar".

## Temuan 10 Okt 2026

- **Flow (screenshot pengguna):** unduhan "1K Original size" = 768p (Nano Banana Pro, 16:9) atau
  896p (Nano Banana 2.1), sekitar 1 MP. "2K Upscale" tersedia di akun pengguna; "4K" butuh paket
  Google AI berbayar. Contoh unduhan 2K yang diterima di chat: 16:9 = 2576×1438 (3,7 MP),
  4:3 = 2400×1792 (4,3 MP); ukuran asli di HP belum dipastikan (chat bisa mengecilkan gambar).
  Tidak ada watermark terlihat di contoh.
- **Adobe foto** ([syarat teknis](https://helpx.adobe.com/stock/contributor/submit-your-content/submit-photos/technical-legal-requirements-photo-submission.html),
  dicek 10 Okt 2026): 4–100 MP, maks 45 MB, JPEG sRGB, tanpa watermark, timestamp, branding,
  bingkai, atau teks tempelan.
- **Akibatnya:** 1K selalu ditolak (QC Gagal dengan pesan "Unduh ulang dari Flow dengan 2K").
  2K berada tipis di sekitar batas 4 MP, terutama 16:9; QC menghitung MP persis dari file.
  Upscale 2K dari Flow adalah upscale; Adobe tidak punya aturan resmi soal itu (hanya saran komunitas
  agar tidak upsample), jadi catat tingkat penerimaan foto 2K di data Tahap 6.
- **Dari contoh foto:** punggung buku berisi tulisan acak dan kotak tisu dengan bulatan mirip logo.
  Prompt foto harus melarang tulisan, label, dan kemasan bermerek; vision menandai "teks acak/logo".

## Fakta yang wajib dicek saat implementasi (jangan menebak)

1. Syarat teknis foto Adobe: sudah dicek (lihat Temuan). Saat implementasi cek ulang dan simpan di
   `lib/adobe/rules.ts` dengan tautan sumber.
2. Batas nama file dan judul untuk foto (sama dengan vektor: 30 karakter dan 70 karakter?).
3. Apakah CSV Adobe punya kolom untuk "fictional" atau tetap dicentang manual di portal.
4. Ketentuan Google: penggunaan komersial hasil Flow untuk akun tanpa paket Google AI berbayar, dan watermark
   terlihat (SynthID tidak terlihat tidak masalah; logo terlihat harus tidak ada).
5. Gemini 3.5 Flash-Lite lewat endpoint OpenAI-compatible menerima gambar (`image_url` data URL),
   berapa batas ukurannya, dan apakah masih masuk free tier. Model Kenari mana yang menerima gambar.
6. Batas Supabase: ukuran file per upload dan total Storage di paket yang dipakai (lihat Risiko).

## Model data (satu migrasi, `photo_assets`)

Tetap satu tabel `assets` agar galeri, tinjau Adobe, statistik penerimaan, dan ekspor dipakai ulang.

- `assets.kind text not null default 'vector' check (kind in ('vector','photo'))`
- `assets.image_path text` (JPEG asli di Storage), `assets.width int`, `assets.height int`,
  `assets.file_bytes int`, `assets.fictional_people boolean not null default false`
- `assets.provider` check ditambah `'flow'` (sumber manual, tanpa adapter); `assets.model` diisi
  label pilihan pengguna, mis. `nano-banana-pro` (daftar label di config, bukan dikunci di kode).
  Prompt yang dipakai disimpan di `assets.concept` seperti konsep vektor.
- `generation_jobs.style` check ditambah `'photo'`. Satu job = satu set prompt untuk satu tema.
- `user_settings.photo_model_label text` (bawaan `nano-banana-pro`), opsional.
- Bucket `assets`: tambah mime `image/jpeg` dan naikkan `file_size_limit` sesuai batas Adobe
  (cek fakta 1 dan 6). Jalur: `{user_id}/photo/{asset_id}.jpg`, preview tetap
  `{user_id}/preview/{asset_id}.png` (atau webp). RLS storage yang ada sudah membatasi per folder user.
- `provider_usage.kind` dipakai ulang: prompt foto = `concepts`, metadata vision = `metadata`.
- Semua kolom baru ikut RLS tabel yang sudah ada. Perbarui `lib/database.types.ts`.

## Provider (adapter, aturan wajib 4)

`lib/providers/types.ts`, dua metode baru di antarmuka yang sama:

- `generatePhotoPrompts({ theme, count, aspect, avoid, variations })` →
  `{ prompts: { subject, prompt, aspect }[] }`. Prompt di `lib/providers/prompts.ts`:
  foto stok realistis, cahaya alami, candid, orang fiktif beragam, tanpa teks/papan nama/logo/merek,
  tanpa nama orang atau karakter, tanpa peristiwa berita, subjek spesifik dan berbeda tiap prompt,
  daftar `avoid` dari `lib/subjects/saturation.ts`. Kata terlarang dicek sebelum ditampilkan.
- `generatePhotoMetadata({ theme, prompt, imageDataUrl })` → metadata seperti vektor + `flags`
  (`visible_text`, `logo_or_watermark`, `deformed_people`, `real_person_or_brand`) dan `hasPeople`.
  Satu panggilan per foto (aturan wajib 2). Gambar dikecilkan di browser (sisi terpanjang ±1024 px,
  JPEG) agar jauh di bawah batas body Vercel 4,5 MB.
- Hanya provider/model yang mendukung gambar yang ikut rantai untuk metadata foto (`supportsVision`).
  Bila tak ada, metadata foto bisa diisi manual.
- Route baru `app/api/generate/photo-prompts` dan `app/api/generate/photo-metadata`,
  `maxDuration = 60`, tenggat 57 dtk, lewat `lib/api/generate-route.ts`.

## Alur di browser

1. `/generate`: pilihan jenis **Vektor | Foto (Flow)** di atas form. Mode Foto: Tema, jumlah prompt
   (maks 20), rasio (16:9, 4:3, 1:1, 3:4, 9:16 sesuai pilihan Flow), Variasi satu subjek.
   Hasil: daftar prompt dengan tombol Salin dan Salin semua, tanda "sudah dipakai", tautan buka Flow.
2. Kotak unggah di kartu job yang sama (dan di `/aset`): pilih atau seret banyak file
   (PNG/JPEG/WebP). Pengguna boleh mencocokkan file ke prompt, atau biarkan tanpa pasangan.
3. Untuk tiap file, satu per satu (`lib/generate/queue.ts`):
   baca dimensi → tolak bila di bawah minimum → ubah ke JPEG bila perlu (canvas, kualitas tinggi)
   → buat preview dan perceptual hash (kode QC yang ada) → unggah langsung ke Storage → simpan baris
   `assets` → panggil metadata vision → QC → status.

## QC foto (`lib/qc/photo.ts`, ambang di `lib/qc/config.ts`)

- Gagal: format tak didukung, resolusi atau ukuran file di luar batas Adobe, gagal dibaca.
- Perlu cek: tanda dari vision (teks/logo/watermark terlihat, orang cacat, mirip orang terkenal/merek),
  kemiripan hash dengan batch atau riwayat foto, kata terlarang di metadata, judul berkoma.
- Lolos: semua di atas bersih.
- Orang terdeteksi → `fictional_people = true` (bisa diubah di detail aset).
- Pemeriksaan vektor (path, viewBox, tile, transparan) dilewati untuk `kind = 'photo'`.

## Galeri, detail, ekspor

- `/aset`: filter Jenis (Semua, Vektor, Foto), badge "Foto", detail menampilkan dimensi, ukuran file,
  prompt, dan sakelar "Orang/properti fiktif". Mode tinjau Adobe dan statistik penerimaan dipisah per jenis.
- `/ekspor`: foto masuk ZIP sebagai `.jpg` (nama file pendek dari judul, aturan panjang dari fakta 2),
  CSV dengan header yang sama. Langkah artboard dilewati untuk foto. Checklist menambah langkah
  "Centang People and Property are fictional" untuk aset bertanda, dengan daftar nama filenya.
- Laporan penerimaan di `/ekspor` menampilkan baris per jenis (vektor vs foto).

## Risiko

| Risiko | Mitigasi |
| --- | --- |
| Storage penuh: foto beberapa MB per file, sedangkan SVG beberapa KB | Tampilkan pemakaian Storage; tombol "Hapus file asli foto yang sudah diterima Adobe" (preview dan metadata tetap). Cek batas paket Supabase (fakta 6) |
| Ukuran unduhan Flow di bawah minimum Adobe | Cek di langkah pertama; bila kurang, berhenti dan tanya pengguna (upscale di luar lingkup) |
| Ketentuan Google berubah atau melarang penggunaan komersial | Cek fakta 4 sebelum unggah batch pertama |
| Foto orang AI sangat jenuh di Adobe | Prompt spesifik dan beragam, daftar `avoid`, batas 3 iterasi serupa per tema |
| Vision model menilai salah (tangan cacat lolos) | Tanda hanya memberi Perlu cek; checklist mengingatkan cek manual wajah, tangan, teks |

## Urutan kerja (satu commit per langkah)

1. Cek fakta 1-6 dan catat hasilnya di bagian Keputusan dan di `lib/adobe/rules.ts`.
2. Migrasi `photo_assets` + tipe database + bucket.
3. Adapter: `generatePhotoPrompts`, `generatePhotoMetadata` (Gemini dulu), route, tes prompt dan
   postprocess.
4. `/generate` mode Foto: form + daftar prompt + salin.
5. Unggah + olah di browser + QC foto + antrean metadata.
6. Galeri dan detail foto, filter Jenis.
7. Ekspor JPEG + checklist fiktif + laporan per jenis.
8. Uji ujung ke ujung: 1 tema, 10 prompt, unggah hasil Flow, ekspor, unggah ke Adobe, catat hasil.

## Pertanyaan terbuka (tanya pengguna sebelum langkah terkait)

1. Sebagian terjawab (lihat Temuan): 2K Upscale wajib. Tersisa: ukuran px asli file 2K di HP
   (16:9) dan formatnya (JPEG atau PNG).
2. Urutan: kerjakan sebelum atau sesudah Tahap 11 (bundle)? Tahap 6 tetap butuh data keputusan Adobe.
3. Simpan file asli foto selamanya, atau hapus otomatis setelah ditandai diterima Adobe?

## Keputusan pengguna

1. 10 Okt 2026: setuju Mode foto setengah manual lewat Google Flow; aplikasi tidak memanggil Flow.
   Video (Veo) ditunda.
