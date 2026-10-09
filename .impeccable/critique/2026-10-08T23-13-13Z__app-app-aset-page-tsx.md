---
target: /aset
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:D:\\DEV\\microstock-ai\\app\\(app)\\aset\\page.tsx"
target_fingerprint: "sha256:c834a3fd61d9289186d26344a78e5df056eed9a1cdd767e150b423878fca14b5"
target_path: "D:\\DEV\\microstock-ai\\app\\(app)\\aset\\page.tsx"
timestamp: 2026-10-08T23-13-13Z
slug: app-app-aset-page-tsx
---
# Kritik ulang /aset dan /aset/[id] (2026-10-09, setelah aksi massal 9ec89c6)
Method: dual-agent (A source review, B detector CLI); live overlay + desktop/375px evidence by parent session.

| # | Heuristik | Skor | Isu |
|---|---|---|---|
| 1 | Status | 3 | Simpan metadata bisa mengubah status QC tapi hanya toast "Metadata disimpan." |
| 2 | Bahasa | 3 | Bahasa pengguna; "Provider", "Jumlah bentuk" teknis |
| 3 | Kendali | 2 | "Kembali ke aset" -> ?job= (filter/halaman/Adobe hilang); pilihan hilang saat ganti halaman |
| 4 | Konsistensi | 2 | Keputusan Adobe: select "Belum diketahui" di detail vs radio "Hapus catatan" di massal; radius besar dan ikon bulat QC menyimpang dari DESIGN.md |
| 5 | Cegah error | 2 | Buat ulang metadata AI menimpa edit tanpa konfirmasi; panel Adobe massal bawaan "Diterima" |
| 6 | Kenali | 3 | Hitungan di filter, penjelasan aset yang tidak ikut ekspor |
| 7 | Efisiensi | 2 | Aksi massal hanya 24 aset per halaman; tanpa shift-select, cari, sortir, pintasan, prev/next detail |
| 8 | Estetika | 3 | Galeri tenang; detail panjang, unduh di dasar |
| 9 | Pemulihan | 3 | Error jelas dengan langkah berikutnya |
| 10 | Bantuan | 2 | Arti status QC untuk ekspor tidak dijelaskan |
| Total | | 25/40 | Cukup (naik dari 23) |

Terselesaikan: aksi massal bukan hanya hapus (Ekspor, Catat hasil Adobe, Hapus terakhir dan terpisah), filter "Diekspor, belum dicatat Adobe", tampilan kosong filter punya jalan kembali.
Klaim P1 agen A "Ekspor N tidak cocok dengan halaman ekspor" dibantah uji langsung: 2 aset yang sudah diekspor tetap terpilih dan terlihat di /ekspor?pilih= (filter belum-diekspor otomatis mati). Sisa kecil: tombol tidak menyebut berapa yang sudah pernah diekspor (P3).
Detektor: CLI 0. Overlay: sama seperti sebelumnya (sidebar/indikator dev) + "one column stretches the first viewport" di detail; di desktop 1183px detail dua kolom, kolom kanan jauh lebih panjang dan pratinjau tidak menempel (P3).

## Prioritas
- [P1] Buat ulang metadata AI menimpa judul/keyword tanpa konfirmasi; key reset membuang ketikan (asset-actions.tsx:13-36, [id]/page.tsx:160). Fix: konfirmasi inline atau hasil AI sebagai draf belum disimpan. /impeccable harden
- [P1] Konteks navigasi dan pilihan hilang ([id]/page.tsx:79, asset-grid.tsx:47). Fix: bawa query asal ke detail dan kembali, prev/next di detail, pilihan lintas halaman atau "Pilih semua N di filter ini". /impeccable layout
- [P2] Detail menimbun hasil, tumpukan kartu generik. Fix: strip header (badge, judul, Unduh / Ekspor aset ini / berikutnya), dl teknis dilipat, status QC titik jangkar persegi, radius kecil, mono untuk model, pratinjau menempel. /impeccable layout + polish
- [P2] Kontrol keputusan Adobe tidak konsisten dan berisiko (bawaan Diterima). Fix: satu komponen pil yang sama, tanpa pilihan bawaan, "Hapus catatan" jadi tautan sekunder. /impeccable clarify
- [P3] "Ekspor N" tidak menyebut yang sudah pernah diekspor; aria-pressed pada Link; tombol halaman nonaktif berupa span. /impeccable polish

## Persona
- Alex: tanpa pintasan/shift-select/cari/sortir; 68 keputusan Adobe = 3+ putaran per halaman; tanpa simpan-dan-berikutnya.
- Sam: aria-pressed tidak valid pada tautan; perubahan status QC setelah simpan tidak diumumkan; tombol halaman nonaktif tidak ditandai disabled.
- Casey: bar menempel di atas (jauh dari jempol) dan tiga baris di 375px; detail ~2990px dengan aksi di dasar.

## Minor
Toggle Adobe tampak seperti tautan, terlepas dari grup filter; dua "Lihat semua aset" bila job + Adobe aktif; toolbar QC rounded-2xl + ikon dalam kotak; nama unduhan aset-xxxxxxxx.svg; deskripsi halaman tidak ikut filter.

## Pertanyaan
Mode tinjau Adobe satu per satu dengan tombol Diterima/Ditolak dan lanjut otomatis? Edit metadata di panel samping galeri? Satu aturan isExportable bersama?
