---
target: /ekspor
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:D:\\DEV\\microstock-ai\\app\\(app)\\ekspor\\page.tsx"
target_fingerprint: "sha256:835d7516cab8fba899e4c417092ab20022353e6e822f7eeeff113cf4f44a02a5"
target_path: "D:\\DEV\\microstock-ai\\app\\(app)\\ekspor\\page.tsx"
timestamp: 2026-10-08T22-59-09Z
slug: app-app-ekspor-page-tsx
---
# Kritik ulang /ekspor (2026-10-09, setelah perbaikan bb71b7d)
Method: dual-agent (A source review, B detector CLI); live overlay + 375px evidence by parent session.

| # | Heuristik | Skor | Isu |
|---|---|---|---|
| 1 | Status | 3 | Progress berhenti di N/N saat menyimpan ZIP/CSV ke Riwayat, tanpa status "menyimpan" |
| 2 | Bahasa | 3 | Tombol "Ekspor N aset" berikon Download tapi tidak mengunduh |
| 3 | Kendali | 2 | Tanpa batal saat membangun; Kosongkan tanpa undo; aset ditandai diekspor sebelum file diunduh; kartu hasil hilang saat muat ulang |
| 4 | Konsistensi | 3 | "Perlu Cek" vs "Perlu cek"; Upload vs unggah |
| 5 | Cegah error | 3 | confirmCek tidak di-reset saat pilihan berubah |
| 6 | Kenali | 2 | Grup terlipat, strip thumbnail tersembunyi di HP; checklist tak bisa dibuka lagi |
| 7 | Efisiensi | 2 | Tanpa buka-semua/filter; "Pilih semua yang Lolos" mengganti pilihan |
| 8 | Estetika | 3 | Hierarki jelas; "ZIP berisi SVG dan CSV" ganda |
| 9 | Pemulihan | 3 | Aset dilewati bertautan; error "di atas" menunjuk arah salah |
| 10 | Bantuan | 3 | Checklist + panduan terlipat; janji "centang diingat" tanpa jalan kembali |
| Total | | 27/40 | Cukup (naik dari 26) |

Terselesaikan dari kritik sebelumnya: tombol utama tertimbun (kini terlihat di layar pertama HP), checklist jauh dari hasil, laporan penerimaan bersaing dengan ekspor, motif pena tidak dipakai, empty state tanpa jalan.
Detektor: CLI 0 temuan; overlay sama seperti sebelumnya (sidebar/indikator dev), tidak ada temuan baru di isi halaman.

## Prioritas
- [P1] Ekspor menandai aset diekspor sebelum file di tangan; tombol berikon Download tidak mengunduh (export-panel.tsx:361-364, build.ts:118-121). Fix: unduh ZIP otomatis setelah selesai atau ganti label "Buat ZIP + CSV"; nyatakan "N aset ditandai diekspor, ada di Riwayat". /impeccable clarify + harden
- [P2] Checklist tak bisa dibuka lagi (upload-checklist.tsx, hanya dari state result). Fix: checklist per baris Riwayat dengan progres dan nama file. /impeccable harden
- [P2] Konfirmasi Perlu Cek tidak mengikuti pilihan (export-panel.tsx:46). Fix: reset saat set Perlu Cek berubah dan setelah ekspor; sebut judulnya. /impeccable harden
- [P2] Pilihan tak terlihat sekilas di HP (strip thumbnail hidden <sm, grup terlipat). Fix: strip 3-4 thumbnail di HP, "Buka semua", buka otomatis grup ber-Perlu Cek. /impeccable adapt
- [P3] Fase simpan tanpa status, tanpa batal. /impeccable polish

## Persona
- Alex: 3 klik (Ekspor, ZIP, CSV); pilih semua mengganti pilihan; tanpa buka-semua.
- Jordan: aset "hilang" dari daftar setelah ekspor tanpa penjelasan; langkah release tanpa daftar aset yang butuh release.
- Casey: tanpa thumbnail di HP; bar menempel tinggi saat ada Perlu Cek; checklist tak bisa dilanjutkan di PC.

## Minor
Nama file hasil tidak ditampilkan; tautan ZIP/CSV Riwayat tanpa nama aksesibel; legenda asterisk selalu tampil; "Lolos belum diekspor" ganda dengan hitungan tombol.

## Pertanyaan
"Ekspor" = file di tangan, bukan ditandai server? Riwayat membawa checklist dan hasil Adobe? "Kirim ke PC" untuk HP?
