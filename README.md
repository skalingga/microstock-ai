# MicroStock Vector AI

Aplikasi web untuk membuat aset vektor SVG siap upload ke Adobe Stock dari satu tema. Spesifikasi lengkap ada di [docs/PRD.md](docs/PRD.md), aturan kerja di [CLAUDE.md](CLAUDE.md).

Status: **Tahap 3 (QC, metadata, ekspor)**. Sudah ada login, pengaturan, generate SVG lewat Kenari, QC otomatis, metadata AI, galeri aset, dan ekspor ZIP + CSV untuk Adobe Stock. Uji banding model (Tahap 4), Gemini (Tahap 5), uji unggah ke Adobe (Tahap 6), Recraft (Tahap 7), dan riset tema (Tahap 8) belum dikerjakan.

## Menjalankan di komputer sendiri

Butuh Node.js 20 atau lebih baru dan proyek Supabase.

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya, lihat di bawah
npm run dev
```

Buka http://localhost:3000. Halaman selain `/login` hanya bisa dibuka setelah masuk.

### Isi `.env.local`

| Variabel | Dari mana |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase: Project Settings, API, Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase: Project Settings, API Keys (kunci `anon` atau `publishable`, aman terlihat di browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase: Project Settings, API Keys (`service_role`). **Rahasia**, hanya untuk server dan script uji |
| `KENARI_API_KEY` | Kunci Kenari (berawalan `kn-`). **Rahasia**, hanya dibaca server |
| `KENARI_DEFAULT_MODEL` | Model dipakai bila kolom model di Pengaturan kosong, mis. `deepseek-v4-flash` (hasil uji banding: kualitas terbaik, sekitar Rp6 per aset). Daftar model: https://kenari.id/v1/models |
| `GEMINI_API_KEY` | Kunci Google AI Studio (free tier), untuk provider cadangan Gemini. **Rahasia**, hanya dibaca server |
| `GEMINI_DEFAULT_MODEL` | Model Gemini bila kolom model di Pengaturan kosong. Kosong = `gemini-3.5-flash-lite` (free tier 15 RPM, 500 permintaan per hari) |
| `RECRAFT_API_KEY` | Belum dipakai (Tahap 7). Boleh dikosongkan |

`.env.local` sudah masuk `.gitignore`. Jangan pernah meng-commit file `.env*` selain `.env.example`.

### Pengaturan Supabase di dashboard

1. **Authentication, Sign In / Providers, Email**: matikan **Confirm email** agar akun langsung aktif setelah daftar (email bawaan Supabase dibatasi jumlahnya).
2. Setelah akunmu dibuat: **Authentication, Sign In / Providers**, matikan **Allow new signups** supaya orang lain tidak bisa mendaftar.

## Biaya model Kenari

Model berakhiran `:free` tidak dihitung. Model berbayar dicatat per panggilan di `provider_usage.cost_idr` (token dari respons dikali harga katalog Kenari), dan berhenti otomatis saat pengeluaran bulan berjalan (zona WIB) mencapai batas di **Pengaturan** (bawaan Rp20.000). Pengeluaran bulan ini tampil di halaman Generate.

Di **Pengaturan** ada isian opsional "Model Kenari untuk konsep dan metadata". Kosong berarti memakai model utama. Uji Oktober 2026: `gpt-oss-120b` dan `gpt-oss-20b` sekitar 3 kali lebih murah untuk teks, tetapi judul lebih pendek, konsep lebih tipis, dan kadang mengarang warna; `deepseek-v4-flash` tetap disarankan.

## Peningkatan kualitas generate (Tahap 3b)

- Palet bawaan per tema (Halloween, Musim gugur, Natal, dan lainnya) tampil di halaman Generate di bawah palet milikmu.
- Satu batch adalah satu set: konsep hanya boleh memakai warna dari palet yang dipilih.
- Gaya pola memakai satu contoh SVG yang menunjukkan cara menyambung tepi tile. Gaya lain tidak, karena contoh menaikkan biaya per SVG sekitar 3 kali tanpa perbaikan yang terukur.
- Aset yang Gagal QC (tile tidak menyambung, kosong, terpotong, ada teks, latar tidak transparan, terlalu rumit) dibuat ulang sekali secara otomatis dengan catatan masalahnya.

## QC otomatis dan ekspor

Setiap aset melewati pemeriksaan di browser: validitas render, teks, kerumitan, isi di dalam kanvas, tidak kosong, latar transparan (ikon), uji tile 2x2 (pola), kemiripan (perceptual hash), dan metadata (kata terlarang, judul, keyword, kategori). Hasilnya Lolos, Perlu Cek, atau Gagal. Aset yang belum punya QC atau metadata bisa diproses massal lewat tombol di halaman Aset.

Aturan Adobe dan ambang QC ada di dua file konfigurasi yang mudah diubah:

- `lib/adobe/rules.ts`: batas judul, keyword, nama file, CSV, artboard, dan 21 kategori (nomornya belum dikonfirmasi resmi, cocokkan di dialog unggah Adobe).
- `lib/qc/config.ts`: ambang QC (angka awal, disetel setelah uji unggah di Tahap 6).

Catatan ekspor: Adobe tidak menerima file ZIP untuk vektor. ZIP hanya untuk kemudahan unduh; ekstrak dulu, lalu unggah file SVG satu per satu dan impor CSV-nya. Tiap SVG diberi ukuran artboard 4800 px pada sisi terpanjang (Adobe mewajibkan 15 sampai 65 MP).

## Menerapkan migrasi database

Migrasi ada di `supabase/migrations/` dan harus dijalankan berurutan sesuai nama file:

1. `..._init_schema.sql`: tujuh tabel, indeks, RLS, dan trigger pembuat baris `user_settings`
2. `..._storage.sql`: bucket privat `assets` dan kebijakan aksesnya
3. `..._fk_indexes.sql`: indeks untuk foreign key gabungan
4. `..._asset_concept_usage_ok.sql`: kolom `assets.concept` dan `provider_usage.ok`
5. `..._kenari_cost_budget.sql`: kolom biaya Rupiah, batas bulanan Kenari, dan fungsi `provider_cost_since`
6. `..._export_files_bucket.sql`: bucket menerima ZIP dan CSV untuk riwayat ekspor
7. `..._kenari_text_model.sql`: model Kenari opsional untuk konsep dan metadata

**Cara 1, Supabase CLI** (disarankan):

```bash
npx supabase login
npx supabase link --project-ref <ref-proyek>
npx supabase db push
```

**Cara 2, tanpa CLI**: buka Supabase, SQL Editor, lalu tempel dan jalankan isi file-file itu satu per satu sesuai urutan.

Setelah mengubah skema, buat ulang tipe TypeScript di `lib/database.types.ts`:

```bash
npx supabase gen types typescript --project-id <ref-proyek> --schema public
```

## Uji RLS

Memastikan pengguna B tidak bisa membaca, mengubah, atau menghapus data pengguna A (tabel dan Storage). Script membuat dua pengguna sementara, lalu menghapusnya lagi.

```bash
npm run test:rls
```

Butuh `SUPABASE_SERVICE_ROLE_KEY` di `.env.local`. Jalankan hanya terhadap proyek milikmu sendiri.

## Pemeriksaan sebelum commit

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Bila `npx tsc --noEmit` mengeluh soal `LayoutProps`, jalankan `npx next typegen` sekali.

## Deploy ke Vercel

1. Push repo ke GitHub, lalu impor di Vercel (framework Next.js terdeteksi otomatis).
2. Isi environment variable di Vercel (Project Settings, Environment Variables) sesuai tabel di atas. `SUPABASE_SERVICE_ROLE_KEY` dan key provider hanya diisi sebagai variabel server, jangan diberi awalan `NEXT_PUBLIC_`.
3. Deploy. Paket Hobby hanya untuk pemakaian non-komersial.
