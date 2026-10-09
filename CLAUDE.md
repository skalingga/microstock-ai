# MicroStock Vector AI

Aplikasi web untuk membuat aset vektor SVG siap upload ke Adobe Stock dari satu tema: generate variasi, QC otomatis, metadata AI, ekspor ZIP + CSV. Versi 1 dipakai sendiri oleh satu pengguna; arsitektur disiapkan agar nanti bisa dijual (multi-user, langganan).

Spesifikasi lengkap ada di `docs/PRD.md`. Baca file itu sebelum mengerjakan tahap apa pun. Bila PRD dan berkas ini berbeda, PRD yang menang; tanyakan ke pengguna bila ada yang tidak jelas.

## Bahasa

- Antarmuka aplikasi dan pesan error: Bahasa Indonesia.
- Metadata aset (judul, keyword) dan prompt ke AI: Bahasa Inggris.
- Kode, nama variabel, nama tabel, komentar singkat: Bahasa Inggris.
- Jawaban dan penjelasan kepada pengguna: Bahasa Indonesia, singkat dan jelas.

## Stack

- Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui
- Backend: Next.js Route Handlers di Vercel (paket Hobby, non-komersial)
- Login, database, file: Supabase (Auth, Postgres dengan Row Level Security, Storage)
- Olah SVG: DOMPurify (sanitasi), SVGO (optimasi), canvas di browser (render + perceptual hash)
- Ekspor: JSZip + pembuat CSV di browser
- AI: provider lewat satu antarmuka (lihat bagian Provider)

## Aturan wajib

1. **API key hanya di server.** Semua key provider dibaca dari environment variable di Route Handler. Jangan pernah mengirim key ke browser, menulisnya di kode, atau meng-commit `.env*` (kecuali `.env.example` tanpa nilai).
2. **Satu panggilan AI per aset per request.** Antrean batch berjalan di browser, satu aset sekali jalan, dengan jeda dan retry saat kena rate limit. Jangan memproses batch besar dalam satu request server.
3. **Batas durasi Vercel.** Dokumentasi resmi (dicek 7 Oktober 2026): Hobby dengan Fluid compute 300 detik default dan maksimum. Aplikasi tetap hemat: route teks `maxDuration = 60` dengan tenggat 57 detik, route SVG `maxDuration = 120` karena model gambar gaya Siluet/Line art kadang lebih dari 55 detik. Beri timeout pada panggilan provider dan pindah ke model atau provider cadangan saat timeout. Cek dokumentasi Vercel terbaru sebelum mengubah angka ini.
4. **Semua provider lewat satu antarmuka.** Kode aplikasi tidak boleh memanggil API provider langsung dari UI atau dari logika bisnis; selalu lewat adapter.
5. **Semua tabel punya `user_id` dan RLS.** Pengguna hanya bisa membaca dan menulis barisnya sendiri. Service role key hanya dipakai di server dan hanya bila benar-benar perlu.
6. **SVG dari AI tidak dipercaya.** Setiap SVG disanitasi dulu (hapus `script`, `foreignObject`, link eksternal, gambar raster tertanam) sebelum disimpan atau ditampilkan.
7. **Jangan menambah fitur di luar tahap yang sedang dikerjakan.** Lihat Roadmap.

## Provider AI

Antarmuka tunggal, mis. `lib/providers/types.ts`:

```ts
export interface SvgProvider {
  id: "kenari" | "gemini" | "recraft";
  generateConcepts(input: ConceptInput): Promise<Concept[]>;
  generateSvg(input: SvgInput): Promise<{ svg: string; model: string; costUsd?: number }>;
  generateMetadata(input: MetadataInput): Promise<AssetMetadata>;
}
```

| Provider | Peran | Catatan |
| --- | --- | --- |
| Kenari (default) | Volume besar: ikon, pola, ilustrasi flat | OpenAI-compatible, base URL `https://kenari.id/v1`, key berawalan `kn-`. Pakai model chat yang menulis kode SVG. Model `:free` tersedia; batas pemakaiannya belum dicek |
| Gemini direct (cadangan) | Pengganti otomatis saat Kenari kena limit atau model hilang | Model teks lewat Google AI Studio. Jangan pakai API gambar Gemini (raster, tanpa free tier publik). Cek apakah bisa berbagi adapter OpenAI-compatible dengan Kenari |
| Kenari gambar + konversi | Gaya Siluet dan Line art (bentuk organik yang gagal ditulis model teks) | `/images/generations`, model bawaan `gpt-image-2` (Rp125 per gambar, Oktober 2026). Hasil raster dikonversi ke SVG di server, selalu hitam. Tanpa cadangan dan tanpa coba-ulang otomatis. **Dibangun di Tahap 7** |
| Recraft (opsional) | Ilustrasi kompleks bila ada anggaran USD | Model vektor V4.1, sekitar $0.08 per SVG. Adapter sendiri. Belum dijadwalkan |

- Urutan provider dan model cadangan disimpan di pengaturan (database), bukan di kode, supaya bisa diubah tanpa deploy.
- **Anggaran Recraft maksimal $10 per bulan** (bila nanti dibangun). Hanya jalan lewat tombol eksplisit yang menampilkan estimasi biaya sebelum proses. Pengeluaran bulan berjalan dicatat di tabel `provider_usage`; saat mencapai $10 tombol terkunci sampai bulan berikutnya. Jangan pernah memanggil Recraft otomatis.
- Catat provider dan model di setiap aset (`assets.provider`, `assets.model`) dan catat setiap panggilan di `provider_usage`.
- Pilihan model ditentukan lewat uji banding di `/uji-model`. Hasil Tahap 4 (7 Oktober 2026, 5 tema × 8 model, satu percobaan per model): `gemini-3.5-flash-lite` terbaik (5/5 jadi, 4 Lolos, median 6 dtk, gratis); `deepseek-v4-flash` 5/5 jadi tapi 37 dtk dan sekitar Rp11 per SVG; model :free Kenari sering timeout (terbaik `agnes-2-0-flash:free` 4/5, 15 dtk; `hy3:free` dan `qwen3-8-27b:free` 0/5). Model default diatur lewat `KENARI_DEFAULT_MODEL`, `GEMINI_DEFAULT_MODEL`, atau pengaturan.
- **Anggaran Kenari berbayar**: model berakhiran `:free` tidak dihitung. Biaya model berbayar (teks per token, gambar per gambar dari `lib/providers/kenari-image-pricing.ts`) dicatat di `provider_usage.cost_idr` dan dibatasi per bulan (zona WIB) lewat `user_settings.kenari_monthly_budget_idr` (bawaan Rp20.000). Saat tercapai, panggilan berbayar ditolak sampai bulan berikutnya. Batas ini tidak berlaku untuk Recraft, yang punya batas USD sendiri.

## Aturan Adobe Stock yang dipaksakan aplikasi

- Ekspor hanya file SVG (tipe Vector). Pengguna wajib mencentang "Created using generative AI tools" di portal Adobe untuk setiap aset; tampilkan sebagai checklist di halaman ekspor.
- Vektor harus rapi dan mudah diedit: batasi jumlah path dan titik, tanpa elemen teks, tanpa gambar raster tertanam.
- Ikon: latar transparan. Pola: harus seamless (uji tile 2x2).
- Dilarang nama artis, orang terkenal, karakter fiksi, merek, atau IP lain di prompt, judul, dan keyword. Pakai daftar kata terlarang yang bisa diedit di pengaturan.
- Judul tidak boleh menyiratkan peristiwa berita nyata.
- Aset yang menggambarkan orang atau properti nyata ditandai "Perlu Release". Hindari orang realistis.
- Keyword maksimal 49, urut dari yang terpenting (cek ulang batas ini di dokumentasi Adobe saat implementasi).
- Ukuran artboard 15 sampai 65 MP dan maksimal 4800 px per sisi: ekspor mengatur `width`/`height` SVG (sisi terpanjang 4800 px) tanpa mengubah `viewBox`. Rasio lebar-tinggi di bawah sekitar 0,65 (mis. 16:9) tidak bisa memenuhi keduanya, jadi gaya background memakai 3:2.
- Nama file maksimal 30 karakter termasuk `.svg`, judul maksimal 70 karakter tanpa koma. Adobe tidak menerima ZIP untuk vektor: ZIP hanya kemudahan unduh.
- Aturan disimpan sebagai konfigurasi yang mudah diubah (`lib/adobe/rules.ts`, ambang QC di `lib/qc/config.ts`), karena kebijakan Adobe bisa berubah. Nomor kategori Adobe 1 sampai 21 belum dikonfirmasi resmi.

## QC otomatis

Status per aset: `lolos`, `perlu_cek`, `gagal`. Hanya `lolos` yang bisa diekspor tanpa konfirmasi manual. Pemeriksaan: validitas parse dan render, sanitasi, tanpa elemen teks, kompleksitas path, tidak kosong dan tidak keluar viewBox, latar transparan untuk ikon, uji tile untuk pola, kemiripan lewat perceptual hash terhadap batch dan riwayat, kata terlarang di metadata. Render dan hash berjalan di browser.

## Model data (semua dengan RLS)

`research_runs`, `themes`, `generation_jobs`, `assets` (termasuk `provider`, `model`, `svg_path`, `preview_path`, `path_count`, `phash`, `qc_status`, `qc_notes`, `title`, `keywords`, `category`, `needs_release`, `exported_at`), `exports`, `provider_usage`, `model_benchmarks` (uji banding Tahap 4), serta pengaturan pengguna. Detail kolom ada di PRD bagian Model data.

## Halaman

`/login`, `/riset`, `/generate`, `/uji-model`, `/aset`, `/ekspor`, `/pengaturan`.

## Roadmap (kerjakan berurutan, satu tahap per sesi)

- [x] 1. Fondasi: Next.js, Supabase Auth, skema database + RLS, deploy ke Vercel
- [x] 2. Generate + galeri dengan Kenari: adapter provider, antrean di browser, sanitasi, simpan SVG + preview, catat panggilan per provider
- [x] 3. QC + metadata + ekspor: semua pemeriksaan QC, metadata AI, ZIP + CSV, checklist upload
- [x] 3b. Peningkatan kualitas generate (sisipan): palet bawaan, set terpadu, contoh SVG untuk pola, coba-ulang otomatis saat gagal QC, model teks opsional
- [x] 4. Uji banding model gratis Kenari (5 tema x 6 model kandidat), pilih model utama dan cadangan
- [x] 5. Gemini direct sebagai cadangan otomatis
- [ ] 6. Uji ke Adobe: batch pertama 50-100 aset, catat tingkat penerimaan per provider
- [x] 7. Gambar Kenari + konversi SVG: gaya Siluet dan Line art, adapter `gpt-image-2`, konversi di server, harga per gambar (Recraft jadi opsional)
- [x] 8. Riset tema: kalender event, Google Trends, skor peluang
- [ ] 9. Lanjutan bila dijual: kuota, langganan, pindah ke Vercel Pro
- [ ] 10. Gaya baru: ikon garis, ikon glyph, ubin geometris, mode satu subjek banyak variasi (rincian: `docs/PLAN-tahap-10-13.md`)
- [ ] 11. Bundle: 16 aset Lolos jadi satu SVG grid 4x4 + metadata set

Centang tahap setelah selesai dan diverifikasi pengguna.

## Environment variable

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server saja
AUTH_SIGNUP_ENABLED=false       # tampilkan form daftar; kosong/false = tertutup (v1 satu pemilik)
KENARI_API_KEY=                 # server saja, berawalan kn-
KENARI_BASE_URL=https://kenari.id/v1
KENARI_DEFAULT_MODEL=            # model bawaan bila pengaturan kosong, mis. model :free
KENARI_IMAGE_MODEL=             # model gambar bila pengaturan kosong; kosong = gpt-image-2
GEMINI_API_KEY=                 # server saja, mulai Tahap 5
GEMINI_DEFAULT_MODEL=           # model Gemini bila pengaturan kosong; kosong = gemini-3.5-flash-lite
RECRAFT_API_KEY=                # server saja, mulai Tahap 7
RECRAFT_MONTHLY_BUDGET_USD=10
```

Simpan nilai asli di `.env.local` (tidak di-commit) dan di environment variable Vercel. Selalu perbarui `.env.example` saat menambah variabel.

## Cara bekerja

- Mulai setiap tahap dengan rencana singkat (file yang akan dibuat atau diubah) dan tunggu persetujuan pengguna bila ada pilihan desain yang berdampak.
- Jangan menebak fakta yang bisa berubah (batas Vercel, harga model, aturan Adobe, nama model Kenari). Cek dokumentasi resmi atau tanya pengguna.
- Sebelum menyatakan tahap selesai, jalankan `npm run lint`, `npx tsc --noEmit`, dan `npm run build`. Laporkan hasilnya apa adanya, termasuk yang gagal.
- Commit kecil dan sering dengan pesan commit yang jelas. Jangan commit rahasia.
- Jelaskan hasil kepada pengguna dalam Bahasa Indonesia sederhana: apa yang jadi, cara mencobanya, dan apa yang belum.
- Pengguna meminta Claude yang mengelola penulisan kode. Beri penjelasan singkat untuk konsep atau pilihan penting, tanpa jargon berlebihan.

## Aturan sinkronisasi PC ↔ cloud
@SYNC.md

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
