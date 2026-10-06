# MicroStock Vector AI

Aplikasi web untuk membuat aset vektor SVG siap upload ke Adobe Stock dari satu tema. Spesifikasi lengkap ada di [docs/PRD.md](docs/PRD.md), aturan kerja di [CLAUDE.md](CLAUDE.md).

Status: **Tahap 2 (Generate + galeri dengan Kenari)**. Sudah ada login, pengaturan, generate SVG lewat Kenari (antrean di browser, sanitasi, preview PNG), dan galeri aset. Pemeriksaan QC, metadata AI, dan ekspor belum dikerjakan.

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
| `GEMINI_API_KEY`, `RECRAFT_API_KEY` | Belum dipakai. Boleh dikosongkan |

`.env.local` sudah masuk `.gitignore`. Jangan pernah meng-commit file `.env*` selain `.env.example`.

### Pengaturan Supabase di dashboard

1. **Authentication, Sign In / Providers, Email**: matikan **Confirm email** agar akun langsung aktif setelah daftar (email bawaan Supabase dibatasi jumlahnya).
2. Setelah akunmu dibuat: **Authentication, Sign In / Providers**, matikan **Allow new signups** supaya orang lain tidak bisa mendaftar.

## Biaya model Kenari

Model berakhiran `:free` tidak dihitung. Model berbayar dicatat per panggilan di `provider_usage.cost_idr` (token dari respons dikali harga katalog Kenari), dan berhenti otomatis saat pengeluaran bulan berjalan (zona WIB) mencapai batas di **Pengaturan** (bawaan Rp20.000). Pengeluaran bulan ini tampil di halaman Generate.

## Menerapkan migrasi database

Migrasi ada di `supabase/migrations/` dan harus dijalankan berurutan sesuai nama file:

1. `..._init_schema.sql`: tujuh tabel, indeks, RLS, dan trigger pembuat baris `user_settings`
2. `..._storage.sql`: bucket privat `assets` dan kebijakan aksesnya
3. `..._fk_indexes.sql`: indeks untuk foreign key gabungan
4. `..._asset_concept_usage_ok.sql`: kolom `assets.concept` dan `provider_usage.ok`
5. `..._kenari_cost_budget.sql`: kolom biaya Rupiah, batas bulanan Kenari, dan fungsi `provider_cost_since`

**Cara 1, Supabase CLI** (disarankan):

```bash
npx supabase login
npx supabase link --project-ref <ref-proyek>
npx supabase db push
```

**Cara 2, tanpa CLI**: buka Supabase, SQL Editor, lalu tempel dan jalankan isi ketiga file itu satu per satu sesuai urutan.

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
