# Rencana: anti-kejenuhan subjek (sisipan Tahap 6b)

Disusun 9 Okt 2026. Pemicu: 5 dari ~50 aset ditolak Adobe "similar content in our collection"
(es krim ×2, kuda, pisang, pohon). Adobe membandingkan dengan seluruh koleksinya; kita tidak punya
API atau data pesaing, jadi dua langkah murah: (1) belajar dari penolakan sendiri, (2) memaksa subjek spesifik.
Tidak butuh API, key, atau screenshot.

## Yang dibangun

### A. Subjek yang pernah ditolak "similar" dipakai kembali
1. ~~Kolom `assets.subject`~~ Dibatalkan saat pengerjaan: subjek cukup diambil dari `assets.concept` (teks sebelum ". " pertama,
   `subjectOf`), jadi tanpa migrasi dan aset lama langsung ikut.
2. **Chip alasan cepat** di `app/(app)/aset/adobe-decision.tsx`: "Similar content", "Kualitas", "Lainnya" mengisi kolom
   alasan (masih bisa diedit). Penolakan "similar" dikenali dari alasan yang memuat kata `similar`/`serupa`.
3. **`lib/subjects/saturation.ts`** (baru, murni, dengan tes): `normalizeSubject` (huruf kecil, buang kata gaya seperti
   "line art", "vector", "black and white", kata sambung, bentuk jamak), `subjectsOverlap(a, b)` (kata inti sama), 
   `matchSaturated(text, saturated[])`.
4. **`/generate`**: `page.tsx` memuat daftar subjek ditolak-similar (subjek, gaya, jumlah). Di bawah kolom Tema muncul
   peringatan yang tidak memblokir: "Mirip subjek yang ditolak Adobe (similar content): ice cream cone, 2 aset. Pilih subjek lebih spesifik."
5. **Prompt konsep** (`ConceptInput.avoid?: string[]`, maks 20 subjek; ikut di `conceptsRequestSchema`): "Do not propose these
   over-used subjects or close variants: ...".
6. **`/riset`**: tema yang mirip subjek ditolak diberi tanda. Hanya tanda, tidak mengubah skor peluang.

### B. Subjek harus spesifik (`lib/providers/prompts.ts`, `conceptsPrompt`)
7. Aturan baru: subjek tidak boleh berupa benda umum polos; tiap konsep wajib punya satu pembeda nyata (varietas/jenis, era,
   pasangan objek tak biasa, atau pose/komposisi khas); dan tidak ada dua konsep dalam satu set yang memakai objek utama sama.
   Ini juga menutup kasus "dua es krim dalam satu batch".
8. Baris lama untuk gaya trace ("Prefer generic subjects") diganti: "recognizable but specific"; tetap tanpa model produk nyata.
   Batas subjek 12 kata tetap.

## Berkas
- Baru: `lib/subjects/saturation.ts`, `tests/saturation.test.ts`, migrasi `assets.subject`.
- Ubah: `lib/generate/run-job.ts`, `lib/providers/prompts.ts`, `lib/providers/types.ts`, `lib/generate/schemas.ts`,
  `app/api/generate/concepts/route.ts` (bila perlu), `app/(app)/generate/page.tsx` + `generate-form.tsx`,
  `app/(app)/riset/*`, `app/(app)/aset/adobe-decision.tsx`, `lib/database.types.ts`, `tests/prompt-quality.test.ts`.

## Di luar rencana (sengaja ditunda)
- Pemeriksa QC subjek kembar dalam batch dan ambang `maxHamming` (poin 4 sebelumnya).
- Skor peluang `/riset` dipengaruhi penolakan.
- Pemblokiran keras subjek jenuh.

## Verifikasi
- Tes unit: normalisasi dan kecocokan subjek; prompt memuat aturan spesifik dan daftar `avoid`.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Di browser: peringatan muncul di `/generate` setelah kamu mencatat penolakan (aku tidak menulis data keputusan Adobe sendiri).
- Uji nyata: satu batch kecil tema umum ("ice cream"): subjek harus spesifik dan tidak kembar.

## Keterbatasan
Ini perkiraan dari data kita sendiri. Kita tetap tidak bisa melihat koleksi Adobe, jadi penolakan akan tetap terjadi sesekali.
Peringatan baru bekerja setelah penolakan dicatat di `/aset/tinjau` dengan alasan "similar".
