# DESIGN.md

Arah desain MicroStock Vector AI. Arah (palet, font, motif, tema) dipilih pengguna pada 8 Oktober 2026. Nilai konkret yang ditandai *(dipilih Claude)* boleh diganti kapan saja lewat token di `app/globals.css`.

## Identitas

Studio kreatif berkarakter. Aplikasinya meja kerja ilustrator vektor: kertas, tinta, dan alat pena. Karya SVG pengguna adalah bagian paling berwarna di layar; antarmuka tetap tenang di belakangnya.

Dial: ENERGY 3 / RHYTHM 2 / MOTION 1.
- ENERGY 3 lewat tipografi tebal besar dan kontras tinta di atas kertas, bukan lewat dekorasi.
- RHYTHM 2: halaman kerja konsisten (form, galeri, tabel), dengan beberapa jeda seperti layar login dan tampilan kosong.
- MOTION 1: hanya hover dan indikator proses (spinner, progress). Tanpa animasi masuk atau loop.

## Palet: kertas dan tinta

| Peran | Terang | Gelap | Alasan |
| --- | --- | --- | --- |
| Latar | kertas krem `oklch(0.968 0.016 85)` | arang hangat `oklch(0.185 0.01 60)` | kertas sketsa; mode gelap = kertas dibalik |
| Kartu | kertas terang `oklch(0.992 0.006 85)` | `oklch(0.225 0.012 60)` | lembar di atas meja |
| Tinta (teks, tombol utama) | `oklch(0.21 0.014 60)` | `oklch(0.94 0.016 85)` | tombol utama berwarna tinta, bukan warna merek |
| Aksen vermilion *(dipilih Claude)* | `oklch(0.6 0.205 36)` | `oklch(0.7 0.17 40)` | satu-satunya aksen: titik jangkar aktif, pilihan, kepala progress, kata kunci di login |
| Status | hijau, oker, merah tua | versi terang | status QC selalu disertai teks |

Aturan: aksen vermilion tidak dipakai untuk tombol atau latar besar. Tanpa gradien, tanpa cahaya (glow), tanpa bayangan berwarna. Bayangan netral hanya untuk elemen yang benar-benar melayang (tooltip, menu HP, bar pilihan yang menempel). Semua pasangan teks lolos WCAG AA di kedua tema (dihitung, bukan ditaksir).

## Tipografi: grotesk tebal

Satu keluarga: **Bricolage Grotesque** *(dipilih Claude)*. Alasan: grotesk dengan karakter (bentuk sedikit nyeleneh di ukuran besar), sumbu optical size membuat teks kecil tetap terbaca, sehingga satu keluarga cukup untuk judul poster dan isi form.
- Judul halaman: 800, rapat (`tracking-tight`), besar.
- Isi: 400 sampai 500. Label kecil: 600, huruf biasa (bukan kapital berjarak lebar).
- Monospace (Geist Mono) hanya untuk ID model dan kode warna hex, karena keduanya dibaca per karakter.

## Motif: alat pena vektor

Titik jangkar persegi dan garis bezier, seperti saat menggambar dengan pen tool:
- Logo: kurva bezier dengan dua titik jangkar dan satu handle.
- Navigasi aktif: titik jangkar vermilion.
- Status QC: titik jangkar persegi berwarna status (bukan titik bulat).
- Aset terpilih: handle seleksi di sudut, seperti objek terpilih di Illustrator.
- Progress: garis tinta dengan titik jangkar vermilion di ujungnya.
- Login dan tampilan kosong: jalur bezier dengan titik jangkar.

## Bentuk

Sudut kecil (`--radius: 0.375rem`), selaras dengan titik jangkar persegi. Kartu datar dengan garis tepi tipis, tanpa bayangan lembut. Ikon Lucide hanya di tombol dan di tempat yang menambah arti; tidak ada ikon dalam kotak di setiap judul.

## Tema

Terang sebagai bawaan, tombol mode gelap di menu akun. Kedua mode wajib berfungsi penuh. Pratinjau aset tetap di atas papan catur terang di kedua mode, agar warna karya terlihat seperti di Adobe Stock.
