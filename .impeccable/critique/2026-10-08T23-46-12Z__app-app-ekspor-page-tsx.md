---
target: /ekspor
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:D:\\DEV\\microstock-ai\\app\\(app)\\ekspor\\page.tsx"
target_fingerprint: "sha256:7c2f06ac304be828a7c4586ed373dd2ce7e17165f1fa7211747b62954076e3f6"
target_path: "D:\\DEV\\microstock-ai\\app\\(app)\\ekspor\\page.tsx"
timestamp: 2026-10-08T23-46-12Z
slug: app-app-ekspor-page-tsx
---
# Kritik ulang /ekspor (2026-10-09, putaran 3, setelah 76e72be/9ec89c6)
Method: dual-agent (A source review, B detector CLI); live overlay by parent session.

| # | Heuristik | Skor | Isu |
|---|---|---|---|
| 1 | Status | 3 | Progres checklist per browser tanpa keterangan |
| 2 | Bahasa | 3 | artboard, MP, release, Perlu cek tanpa definisi |
| 3 | Kendali | 3 | Kartu hasil tak bisa ditutup; "Batalkan" dua arti |
| 4 | Konsistensi | 3 | Statistik pertama bukan tautan; ZIP/CSV riwayat tautan vs tombol di hasil |
| 5 | Cegah error | 3 | Aset butuh release ikut terpilih tanpa peringatan sebelum ekspor; gagal tandai diekspor diabaikan (build.ts) |
| 6 | Kenali | 2 | Riwayat anonim (tanggal + jumlah); checklist riwayat kehilangan judul release |
| 7 | Efisiensi | 3 | Centang per batch, ?pilih=, dua ketuk untuk ekspor |
| 8 | Estetika | 3 | Fokus; bar menempel bisa tinggi dengan nama Perlu cek |
| 9 | Pemulihan | 3 | Alasan + tautan perbaikan; URL bertanda tangan riwayat kedaluwarsa 1 jam tanpa penjelasan |
| 10 | Bantuan | 3 | Teks menjanjikan lanjut di PC, tapi centang hanya di localStorage |
| Total | | 29/40 | Baik (26 -> 27 -> 29) |

Detektor: CLI 0; overlay sama seperti halaman lain.
Diverifikasi di kode: saveExport (lib/export/build.ts) mengabaikan error update exported_at lalu tetap mengembalikan ID ekspor.

## Prioritas
- [P1] Centang checklist tidak ikut pindah perangkat padahal teks menjanjikannya (page.tsx kosong, InfoTip, upload-checklist localStorage). Fix: simpan centang di baris exports (kolom baru), localStorage hanya cache; sampai itu, ubah teks. /impeccable harden
- [P2] Peringatan release baru muncul setelah file jadi, hilang di Riwayat. Fix: baris "N butuh release" di bar sebelum ekspor + simpan judul release di ekspor. /impeccable clarify
- [P2] Riwayat anonim. Fix: label batch/tema + strip thumbnail + nama file + "Lihat lebih lama". /impeccable layout
- [P2] Ekspor tercatat walau aset gagal ditandai (build.ts). Fix: cek error, status khusus + coba tandai lagi. /impeccable harden
- [P3] Bar menempel tinggi di HP; petunjuk CSV disembunyikan di HP. /impeccable adapt

## Persona
- Alex: tanpa filter gaya/tema, kartu hasil tak bisa ditutup.
- Jordan: istilah tanpa definisi; CSV bisa terlewat di HP.
- Casey: ekspor di HP lalu centang hilang di PC; tautan riwayat kedaluwarsa.

## Pertanyaan
"Diekspor" = ZIP diunduh atau sudah diunggah? Ekspor di HP jadi serah-terima ke PC? Riwayat jadi antrean unggah yang menggabungkan checklist dan hasil Adobe?
