# PRD MicroStock Vector AI

Dibuat 5 Oktober 2026 · Satriyo

## Ringkasan

MicroStock Vector AI membuat aset vektor SVG siap upload ke Adobe Stock dari satu tema, dengan target lebih dari 1.000 aset per bulan (sekitar 33 per hari) dengan biaya API serendah mungkin: jalur teks hampir gratis, jalur gambar sekitar Rp125 per aset dari saldo Kenari.

- **Masalah:** membuat vektor, menulis metadata, dan mengecek kepatuhan satu per satu memakan waktu dan rawan ditolak.
- **Solusi:** satu alur dari riset tema, generate variasi SVG, QC otomatis, metadata AI, sampai ekspor ZIP + CSV.
- **Tujuan versi 1:** dipakai sendiri. Arsitektur disiapkan agar nanti bisa dijual sebagai layanan langganan.

## Ruang lingkup

Versi 1 fokus pada satu pengguna, satu platform (Adobe Stock), dan satu jenis aset (vektor SVG).

**Masuk versi 1**

- Login
- Riset tema dan peluang per negara/musim
- Generate variasi SVG dari satu tema lewat Kenari (default), Gemini direct (cadangan), dan model gambar Kenari yang hasilnya dikonversi ke SVG (gaya Siluet dan Line art). Recraft opsional, hanya bila ada anggaran USD
- QC otomatis
- Metadata AI (judul, keyword, kategori)
- Ekspor ZIP + CSV dan riwayat aset

**Tidak masuk versi 1**

- Platform selain Adobe Stock
- Foto/raster dan upscale (gambar raster hanya bahan antara untuk dikonversi ke SVG, tidak pernah diekspor)
- Provider lain di luar Kenari, Gemini, dan Recraft
- Kuota, paket langganan, dan pembayaran
- Multi-user atau tim
- Upload otomatis ke portal Adobe; upload tetap manual memakai CSV dari aplikasi

## Aturan Adobe Stock yang dipaksakan aplikasi

Adobe Stock menerima vektor AI selama diberi label generative AI dan memenuhi standar kualitas; Shutterstock, Getty Images, dan iStock menolak kiriman AI dari kontributor ([PixTagger](https://stockpixtagger.com/blog/shutterstock-contributor-guide)). Setiap aturan di bawah punya pemeriksaan di aplikasi.

| Aturan Adobe | Penerapan di aplikasi |
| --- | --- |
| Centang "Created using generative AI tools" untuk semua aset AI ([FAQ](https://helpx.adobe.com/stock/contributor/help/generative-ai-faq.html)) | Checklist upload di halaman ekspor |
| Vektor AI hanya boleh dikirim sebagai tipe Vector ([FAQ](https://helpx.adobe.com/stock/contributor/help/generative-ai-faq.html)) | Ekspor hanya file SVG |
| Vektor AI harus dirapikan agar mudah diedit seperti vektor biasa ([panduan vektor](https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/generative-ai-vector-submission-guidelines.html)) | QC kompleksitas path dan struktur |
| Ikon berbentuk sederhana di latar transparan; pola harus bisa di-tile mulus ([panduan vektor](https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/generative-ai-vector-submission-guidelines.html)) | QC latar transparan dan uji tile 2x2 |
| Tanpa nama artis, orang terkenal, karakter fiksi, atau IP di prompt, judul, keyword ([panduan](https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/generative-ai-video-submission-guidelines.html)) | Daftar kata terlarang pada prompt dan metadata |
| Judul tidak boleh menyiratkan peristiwa berita nyata ([klarifikasi Adobe](https://community.adobe.com/questions-38/clarification-on-generative-ai-submission-guidelines-327900)) | Cek judul oleh AI + daftar kata |
| Aset yang menggambarkan orang atau properti nyata butuh release ([panduan](https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/generative-ai-content-guidelines.html)) | Hindari orang realistis; tandai "Perlu Release" |

## Fitur 1: Riset tema dan peluang

Pengguna memilih negara/region dan periode, lalu aplikasi mengembalikan daftar tema yang diurutkan berdasarkan skor peluang.

**Input:** region (US, Eropa, Asia, atau negara tertentu), rentang bulan, kategori opsional.

**Sumber data gratis**

- Kalender event dan musim per negara, disimpan sebagai data di aplikasi dan bisa diedit (Ramadan, Diwali, Thanksgiving, Imlek, musim sekolah, dan lainnya)
- Google Trends untuk minat pencarian per negara
- Jumlah hasil pencarian Adobe Stock per keyword sebagai ukuran persaingan (cara pengambilan perlu dicek terhadap ketentuan Adobe; cadangannya input manual)
- Model teks dari provider yang dipilih menyusun ide tema dan keyword dari data di atas

**Output per tema**

| Kolom | Isi |
| --- | --- |
| Tema | Nama tema dalam bahasa Inggris |
| Negara / event | Pasar dan momen yang dituju |
| Batas upload | Tanggal ideal upload, 2-3 bulan sebelum event (asumsi) |
| Skor permintaan | 0-100 dari tren |
| Skor persaingan | 0-100 dari jumlah aset sejenis |
| Peluang | Permintaan tinggi, persaingan rendah = peluang tinggi |
| Keyword awal | 5-10 keyword untuk diteruskan ke generate |

Setiap baris punya tombol "Generate dari tema ini" yang membawa tema ke Fitur 2.

## Fitur 2: Generate variasi SVG

Aplikasi memanggil satu antarmuka generate SVG dan tidak peduli provider di belakangnya. Kenari dan Gemini memakai model teks yang menulis kode SVG langsung dari tema. Untuk bentuk organik yang tidak sanggup ditulis model teks (siluet hewan, line art kendaraan), model gambar Kenari membuat gambar hitam-putih lalu server mengubahnya menjadi SVG. API gambar Gemini tidak dipakai karena tidak punya free tier publik ([aifreeapi](https://www.aifreeapi.com/en/posts/gemini-image-generation-free-tier)). Uji Oktober 2026: model teks gagal menggambar kelelawar dan mobil klasik, sedangkan `gpt-image-2` + konversi menghasilkan siluet dan line art yang rapi.

**Provider**

| Provider | Peran | Biaya |
| --- | --- | --- |
| [Kenari](https://kenari.id/en) (default) | Volume besar: ikon, pola, ilustrasi flat. Model chat OpenAI-compatible di kenari.id/v1 | Model :free Rp0; model berbayar dari saldo Rupiah |
| Gemini direct (cadangan) | Pengganti otomatis saat Kenari kena limit atau modelnya hilang | Free tier; batas tidak dipublikasikan |
| Kenari gambar + konversi SVG | Gaya Siluet dan Line art. Model bawaan `gpt-image-2`, hasil raster dikonversi ke SVG di server | Per gambar dari saldo Rupiah Kenari (`gpt-image-2` Rp125, 7 Oktober 2026), masuk batas biaya Kenari bulanan |
| [Recraft](https://www.recraft.ai/docs/api-reference/models/recraft-v4-1.md) (opsional) | Ilustrasi kompleks bila ada anggaran USD. Model vektor V4.1 | Sekitar $0.08 per SVG; batas $10 per bulan. Belum dibangun |

**Alur per tema**

1. Pengguna memasukkan tema, gaya, palet warna, dan jumlah variasi (default 10).
2. Model teks membuat daftar konsep variasi: subjek, komposisi, dan palet berbeda tiap konsep.
3. Untuk tiap konsep, provider yang dipilih menghasilkan satu file SVG.
4. SVG divalidasi dan disanitasi, lalu disimpan bersama preview PNG.
5. Aset langsung masuk ke QC (Fitur 3).

**Gaya yang didukung versi 1:** set ikon flat, pola seamless, ilustrasi flat sederhana, badge/label, dan background geometris abstrak (model teks); siluet dan line art (model gambar + konversi, selalu hitam, palet diabaikan).

**Aturan teknis**

- Satu panggilan server per aset agar tidak melewati batas durasi function Vercel.
- Antrean berjalan di browser dengan jeda dan retry otomatis saat kena rate limit.
- Semua API key provider disimpan di server (environment variable), tidak pernah dikirim ke browser.
- Prompt melewati filter kata terlarang sebelum dikirim.
- Urutan provider dan model cadangan disimpan di pengaturan; bila model utama kena limit atau hilang, aplikasi pindah ke berikutnya tanpa deploy ulang.
- Aplikasi mencatat panggilan per provider per hari, karena batas free tier Gemini hanya terlihat di AI Studio ([memetik](https://www.memetik.ai/guides/gemini-api-free-tier-limits)) dan batas model :free Kenari belum dicek.
- Recraft hanya jalan lewat tombol eksplisit dengan estimasi biaya sebelum proses. Saat pengeluaran bulan berjalan mencapai $10, tombolnya terkunci sampai bulan berikutnya.
- Tiap provider adalah adapter di balik satu antarmuka. Kenari dan Gemini berbagi adapter OpenAI-compatible; model gambar Kenari punya adapter sendiri; Recraft (bila dibangun) juga.

**Jalur gambar + konversi (gaya Siluet dan Line art)**

- Konsep dan metadata tetap dari model teks; hanya langkah SVG yang memakai model gambar. Satu panggilan AI per request; konversi berjalan di server tanpa AI (sekitar 0,2 detik).
- Prompt gambar memaksa latar putih polos, tanpa teks, tanpa logo, desain generik (bukan model atau merek nyata).
- Setelah konversi: tiap bentuk jadi path sendiri (lubang ikut bentuknya), kanvas dipotong pas ke objek lalu diberi margin dan rasio 1:1 atau 3:2 (agar artboard Adobe 15 MP tercapai), line art diberi lapisan isi putih di belakang garis.
- Tanpa cadangan otomatis (tidak ada model gambar gratis) dan tanpa coba-ulang otomatis saat Gagal QC (tiap ulang berbayar).
- Harga per gambar disimpan di konfigurasi karena katalog API Kenari tidak mencantumkannya; biaya dicatat di `provider_usage` dan masuk batas biaya Kenari bulanan.

## Fitur 3: QC otomatis

Setiap SVG mendapat status Lolos, Perlu Cek, atau Gagal; hanya status Lolos yang bisa diekspor tanpa konfirmasi manual.

| Pemeriksaan | Aturan | Jika tidak lolos |
| --- | --- | --- |
| Validitas | SVG bisa diparsing dan dirender | Gagal |
| Sanitasi | Hapus script, foreignObject, link eksternal, gambar raster tertanam | Dibersihkan otomatis |
| Teks | Tidak ada elemen text (risiko font dan teks tertanam) | Gagal |
| Kompleksitas | Jumlah path dan titik dalam batas wajar (batas disetel setelah uji coba) | Perlu Cek |
| Render | Tidak kosong, tidak keluar dari viewBox | Gagal |
| Latar | Ikon berlatar transparan | Perlu Cek |
| Pola | Uji tile 2x2: tepi kiri-kanan dan atas-bawah menyambung | Gagal untuk gaya pola |
| Kemiripan | Perceptual hash dibandingkan dengan batch dan riwayat | Perlu Cek |
| Metadata | Tidak ada kata terlarang di judul dan keyword | Perlu Cek |

Render dan hash dijalankan di browser memakai canvas, sehingga tidak membebani server.

## Fitur 4: Metadata AI dan ekspor

Model teks dari provider yang dipilih menulis metadata dalam bahasa Inggris dari tema dan deskripsi konsep (membaca preview PNG hanya bila modelnya mendukung gambar, dicek saat uji banding); pengguna bisa mengedit sebelum ekspor.

**Metadata per aset**

- Judul singkat dan deskriptif
- Keyword maksimal 49, diurutkan dari yang terpenting (batas Adobe, dicek ulang saat implementasi)
- Kategori Adobe
- Penanda "Perlu Release" bila terdeteksi orang atau properti nyata

**Ekspor**

- File ZIP berisi SVG dengan nama file dari judul (slug)
- File CSV dengan kolom Filename, Title, Keywords, Category, Releases
- Checklist upload: centang label generative AI di portal Adobe untuk setiap aset
- ZIP dan CSV dibuat di browser, lalu riwayat ekspor disimpan di database

## Arsitektur dan tech stack

Browser mengatur antrean dan pekerjaan berat (render, QC, ZIP), sedangkan server Vercel hanya memeriksa login dan meneruskan permintaan ke AI.

Diagram (di dokumen aslinya berbentuk gambar):

- **Browser (Next.js UI):** antrean batch satu per satu; QC (render, hash, uji tile); membuat ZIP + CSV ekspor.
- **Vercel (Route Handlers):** cek login setiap request; menyimpan API key provider; proxy ke AI, di bawah 60 detik.
- **Provider AI:** Kenari, Gemini, Recraft (konsep variasi + kode SVG, metadata judul dan keyword).
- **Supabase:** Auth (login), Postgres (tema, aset, ekspor), Storage (file SVG dan preview PNG). Diakses dari browser dan dari Vercel.
- **Google Trends:** minat pencarian per negara; gratis tanpa jaminan akses. Dipanggil dari Vercel.

Setiap aset diproses lewat satu panggilan pendek ke server, sehingga batas durasi function Vercel tidak tercapai.

| Lapisan | Pilihan |
| --- | --- |
| Frontend | Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js Route Handlers di Vercel (Hobby) |
| Login, database, file | Supabase Auth, Postgres, Storage (paket gratis) |
| AI | Kenari (default), Gemini lewat Google AI Studio, Recraft (premium) |
| Olah SVG | DOMPurify (sanitasi), SVGO (optimasi), canvas (render + hash) |
| Ekspor | JSZip + pembuat CSV di browser |

## Model data

Tujuh tabel di Supabase Postgres cukup untuk versi 1; file SVG dan preview disimpan di Supabase Storage.

| Tabel | Kolom utama | Fungsi |
| --- | --- | --- |
| users | dari Supabase Auth | Akun dan login |
| research_runs | id, user_id, region, period_start, period_end, created_at | Satu sesi riset |
| themes | id, run_id, title, country, event, upload_by, demand_score, competition_score, opportunity_score, seed_keywords | Hasil riset per tema |
| generation_jobs | id, user_id, theme_id, style, palette, count, status, created_at | Satu permintaan generate |
| assets | id, job_id, provider, model, svg_path, preview_path, path_count, phash, qc_status, qc_notes, title, keywords, category, needs_release, exported_at | Satu file SVG beserta QC dan metadata |
| exports | id, user_id, zip_path, csv_path, asset_count, created_at | Riwayat ekspor |
| provider_usage | id, user_id, provider, model, kind, cost_usd, created_at | Hitungan panggilan harian per provider dan pengeluaran Recraft bulanan |

Semua tabel memakai Row Level Security berdasarkan user_id agar siap multi-user saat dijual.

## Alur pengguna dan halaman

Alur utama berjalan lurus dari riset sampai upload manual ke Adobe.

1. Login.
2. **Riset:** pilih region dan periode, lihat daftar tema berdasarkan peluang.
3. **Generate:** pilih tema (dari riset atau ketik sendiri), atur gaya, palet, dan jumlah variasi.
4. Antrean berjalan; progres terlihat per aset.
5. **Galeri aset:** filter Semua, Menunggu, Lolos, Perlu Cek, Gagal; edit metadata bila perlu.
6. **Ekspor:** pilih aset Lolos, unduh ZIP + CSV.
7. Upload ke portal Adobe Stock, impor CSV, centang label generative AI.

| Halaman | Isi |
| --- | --- |
| /login | Login email atau Google |
| /riset | Form riset dan tabel tema |
| /generate | Form tema dan antrean |
| /aset | Galeri, status QC, edit metadata |
| /ekspor | Pilihan aset, checklist upload, riwayat |
| /pengaturan | Urutan provider dan model cadangan, model gambar Kenari, batas biaya Kenari, gaya default, palet, daftar kata terlarang |

## Batasan, risiko, dan mitigasi

Risiko terbesar adalah ketergantungan pada free tier Gemini, karena batasnya bisa berubah tanpa pemberitahuan.

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Kuota model :free Kenari atau free tier Gemini berkurang atau berubah | Target 33 aset per hari tidak tercapai | Retry, pencatatan panggilan per provider, pindah otomatis ke model atau provider cadangan; model berbayar Kenari dengan batas biaya bulanan |
| Adobe menolak vektor hasil konversi otomatis yang tidak rapi | Aset jalur gambar ditolak | Prompt hitam-putih polos, path dipecah per bentuk, batas jumlah titik di QC, review manual sebelum upload |
| Harga gambar Kenari berubah | Biaya tercatat salah | Harga di file konfigurasi, dicek ulang di dashboard Kenari |
| Kualitas SVG dari model teks terbatas | Banyak aset ditolak Adobe | Fokus gaya sederhana, QC ketat, review manual sebelum upload |
| Variasi terlalu mirip | Ditolak sebagai konten berulang | Perceptual hash dan batas variasi per tema |
| Google Trends tidak punya jaminan akses gratis | Riset gagal atau lambat | Cache hasil; cadangan kalender event + skor manual |
| Vercel Hobby hanya untuk non-komersial ([Vercel](https://vercel.com/docs/plans/hobby)) | Tidak boleh dipakai saat dijual | Pindah ke Vercel Pro saat mulai menjual |
| Batas durasi function Hobby 60 detik, patokan aman karena sumber berbeda-beda ([Vercel](https://vercel.com/docs/plans/hobby)) | Proses panjang terputus | Satu panggilan pendek per aset, antrean di browser |
| Free tier tidak cocok untuk data sensitif ([Wikipedia](https://en.wikipedia.org/wiki/Google_AI_Studio)) | Privasi | Hanya kirim tema dan SVG, tanpa data pribadi |
| Kebijakan Adobe berubah | Aturan QC usang | Aturan disimpan sebagai konfigurasi yang mudah diubah |
| Biaya Recraft melewati anggaran (bila dibangun) | Pengeluaran lebih dari $10 per bulan | Tombol eksplisit, estimasi biaya sebelum proses, kunci otomatis di $10 |
| Model :free Kenari berubah atau hilang tanpa kabar | Model utama berhenti bekerja | Daftar model cadangan berurutan di pengaturan; uji banding setelah kerangka jadi |

## Tahapan pengerjaan

Generate dan QC dikerjakan sebelum riset, karena tema bisa diketik manual dan kualitas SVG adalah hal yang paling perlu dibuktikan lebih dulu.

1. **Fondasi:** setup Next.js, Supabase Auth, skema database, deploy ke Vercel.
2. **Generate + galeri dengan Kenari:** adapter provider, antrean di browser, sanitasi, penyimpanan SVG dan preview, pencatatan panggilan per provider.
3. **QC + metadata + ekspor:** semua pemeriksaan QC, metadata AI, ZIP + CSV, checklist upload.
4. **Uji banding model gratis Kenari** (setelah kerangka jadi): 5 tema × 6 model kandidat, dinilai lewat QC dasar dan dilihat langsung di galeri, lalu pilih model utama dan cadangan.
5. **Gemini direct** sebagai cadangan otomatis.
6. **Uji ke Adobe:** upload batch pertama sekitar 50-100 aset, catat tingkat penerimaan per provider, setel batas QC.
7. **Gambar Kenari + konversi SVG:** gaya Siluet dan Line art, adapter model gambar (`gpt-image-2`), konversi dan pengolahan SVG di server, harga per gambar, batas biaya Kenari. (Menggantikan Recraft, yang menjadi opsional bila ada anggaran USD: adapter, tombol eksplisit, estimasi biaya, batas $10 per bulan.)
8. **Riset tema:** kalender event, Google Trends, skor peluang, tombol generate dari tema.
9. **Lanjutan (bila dijual):** kuota, langganan, pindah ke Vercel Pro.

## Metrik dan keputusan tertunda

Versi 1 dianggap berhasil bila menghasilkan lebih dari 1.000 SVG lolos QC per bulan dengan biaya API di bawah $10 per bulan.

**Metrik**

- Jumlah SVG lolos QC per bulan: lebih dari 1.000
- Tingkat penerimaan di Adobe: target ditetapkan setelah batch uji pertama
- Biaya API per bulan: di bawah batas biaya Kenari (bawaan Rp20.000, sekitar 150 aset jalur gambar); Rp0 di jalur gratis

**Keputusan tertunda**

- [ ] Batas angka QC kompleksitas (setelah uji 50-100 aset)
- [ ] Cara mengambil data persaingan Adobe: otomatis atau input manual
- [ ] Model gratis Kenari terbaik untuk SVG dan urutan cadangannya, diuji setelah kerangka jadi; kapan Recraft dipakai dalam batas $10 per bulan (sekitar $0.08 per SVG, [Recraft](https://www.recraft.ai/docs/api-reference/models/recraft-v4-1.md))
- [ ] Pindah ke Vercel Pro saat aplikasi mulai dijual
- [ ] Batas pemakaian model :free Kenari, apakah jalan dengan saldo Rp0, dan apakah ada model yang bisa membaca gambar

## Sumber

- [Adobe Stock Generative AI FAQ](https://helpx.adobe.com/stock/contributor/help/generative-ai-faq.html)
- [Adobe Stock Generative AI vector guidelines](https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/generative-ai-vector-submission-guidelines.html)
- [Adobe Stock Generative AI content guidelines](https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/generative-ai-content-guidelines.html)
- [Adobe: clarification on generative AI guidelines](https://community.adobe.com/questions-38/clarification-on-generative-ai-submission-guidelines-327900)
- [PixTagger: Shutterstock Contributor Guide 2026](https://stockpixtagger.com/blog/shutterstock-contributor-guide)
- [Gemini Image Generation Free Tier (aifreeapi)](https://www.aifreeapi.com/en/posts/gemini-image-generation-free-tier)
- [Gemini API free tier limits (memetik)](https://www.memetik.ai/guides/gemini-api-free-tier-limits)
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby)
- [Recraft V4.1 API](https://www.recraft.ai/docs/api-reference/models/recraft-v4-1.md)
- [Kenari: gateway AI](https://kenari.id/en)
- [Permintaan provider Kenari di Cline](https://github.com/cline/cline/discussions/12471)
