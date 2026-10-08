---
target: /aset
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:D:\\DEV\\microstock-ai\\app\\(app)\\aset\\page.tsx"
target_fingerprint: "sha256:48beb966dec689be12c4fd2bc9e6f0a8806fb8b81e1272adb2dc59cdcd117f33"
target_path: "D:\\DEV\\microstock-ai\\app\\(app)\\aset\\page.tsx"
timestamp: 2026-10-08T22-47-04Z
slug: app-app-aset-page-tsx
---
# Kritik /aset dan /aset/[id] (2026-10-09)
Method: dual-agent (A source review, B detector CLI); browser evidence (overlay, 375px) by parent session after A/B.

| # | Heuristik | Skor | Isu |
|---|---|---|---|
| 1 | Status | 3 | Simpan metadata menjalankan QC ulang tapi status baru tidak diberitahukan |
| 2 | Bahasa | 3 | Kosakata pengguna; "Jumlah bentuk"/Provider agak teknis |
| 3 | Kendali | 2 | "Kembali ke aset" -> /aset?job=... (terverifikasi), filter/halaman hilang; tanpa prev/next |
| 4 | Konsistensi | 2 | Error inline vs toast; hapus tunggal tanpa peringatan data Adobe |
| 5 | Cegah error | 2 | "Buat ulang metadata (AI)" menimpa edit manual tanpa konfirmasi |
| 6 | Kenali | 2 | Catatan QC tak diurut; alasan Perlu cek tak tampil di kartu |
| 7 | Efisiensi | 1 | Tanpa pintasan, prev/next, cari, sortir; aksi massal hanya hapus |
| 8 | Estetika | 3 | Tenang; bar "Pilih aset untuk dihapus" selalu tampil |
| 9 | Pemulihan | 2 | "QC gagal dijalankan." tanpa sebab |
| 10 | Bantuan | 3 | Petunjuk inline baik; arti tiap pemeriksaan QC tidak dijelaskan |
| Total | | 23/40 | Cukup |

Spesifisitas: motif alat pena hidup (handle seleksi, titik jangkar QC, PenPath kosong, papan catur, tile 2x2). Detail = tumpukan kartu generik; ikon dalam kotak di asset-toolbar.tsx:48-50 melanggar DESIGN.md.
Detektor: CLI 0 temuan. Overlay: text-overflow (email sidebar, disengaja), nested-cards (kotak akun sidebar), transition:height (tak ditemukan elemen; kemungkinan indikator dev Next) -> semua false positive.

## Prioritas
- [P1] Detail tanpa langkah berikutnya, kehilangan posisi galeri ([id]/page.tsx:79); halaman berakhir di Unduh/Hapus (HP y=2922). Fix: bawa query galeri, prev/next + J/K, aksi utama sesuai status. /impeccable layout + clarify
- [P1] Buat ulang metadata AI menimpa edit manual (asset-actions.tsx:67, key di [id]/page.tsx:160). Fix: konfirmasi atau usulan "Pakai/Batal", pindah ke seksi Metadata. /impeccable harden
- [P2] Simpan tidak memberi tahu status QC baru (actions.ts:114, metadata-form.tsx:47); catatan QC tak diurut; koma/kata terlarang tak ditandai. /impeccable clarify
- [P2] Aksi massal hanya hapus (asset-grid.tsx:71). Fix: "Pilih aset", aksi Ekspor/Hasil Adobe, Hapus terakhir; filter Adobe/Diekspor. /impeccable distill + shape
- [P3] Umpan balik dan pengaman tidak konsisten (toast vs inline, hapus tunggal tanpa peringatan, "Belum" menghapus alasan). /impeccable polish

## Persona
- Alex: tanpa J/K, 3 tombol simpan, 12 kali bolak-balik untuk hasil Adobe, judul kartu bukan tautan.
- Sam: tautan kartu hanya membungkus gambar, badge di luar; toast mungkin tak diumumkan.
- Casey: aksi di dasar halaman panjang; bar konfirmasi hapus massal bisa menutup sepertiga layar.

## Minor
Nama unduhan aset-xxxxxxxx.svg tak ikut aturan 30 karakter; filter kosong tanpa jalan kembali; banner job tak menyebut tema; ID model tanpa mono; URL bertanda tangan 1 jam.

## Pertanyaan
Antrean triase (Perlu cek dulu) vs grid kronologis? Kenapa hapus satu-satunya kata kerja dengan bar menempel? Hasil Adobe lewat alur massal?
