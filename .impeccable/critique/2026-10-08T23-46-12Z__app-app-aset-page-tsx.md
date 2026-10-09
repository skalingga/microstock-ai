---
target: /aset
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:D:\\DEV\\microstock-ai\\app\\(app)\\aset\\page.tsx"
target_fingerprint: "sha256:830b9d6850a2403995a819f57d7501176ebca0a8c968d5057472f2e1535a2ce5"
target_path: "D:\\DEV\\microstock-ai\\app\\(app)\\aset\\page.tsx"
timestamp: 2026-10-08T23-46-12Z
slug: app-app-aset-page-tsx
---
# Kritik ulang /aset, /aset/[id], /aset/tinjau (2026-10-09, setelah a91956c)
Method: dual-agent (A source review, B detector CLI); live overlay by parent session.

| # | Heuristik | Skor | Isu |
|---|---|---|---|
| 1 | Status | 3 | "Status QC sekarang" kemungkinan hilang karena form di-remount (key judul); jumlah dipilih tak diumumkan |
| 2 | Bahasa | 3 | Bahasa alami + kosakata Adobe |
| 3 | Kendali | 3 | J/K dan Aset berikutnya membuang editan metadata; hapus kembali ke galeri tanpa filter; hapus catatan Adobe massal tanpa konfirmasi |
| 4 | Konsistensi | 3 | Keputusan Adobe: komponen bersama di detail/massal, tombol sendiri di mode tinjau; pintasan beda per layar |
| 5 | Cegah error | 3 | Alasan tolak terbawa diam-diam ke aset berikutnya |
| 6 | Kenali | 3 | Legenda pintasan di mode tinjau; J/K detail hanya di tooltip |
| 7 | Efisiensi | 2 | 24 per halaman, tanpa cari, sortir, pilih batch, lompat halaman; pilihan per halaman |
| 8 | Estetika | 3 | Tenang; lima pita sebelum grid |
| 9 | Pemulihan | 3 | Error umum tanpa sebab |
| 10 | Bantuan | 3 | InfoTip status, legenda tinjau |
| Total | | 29/40 | Baik (naik dari 25) |

Detektor: CLI 0 (pengecualian broken-image review-queue.tsx tetap); overlay sama seperti halaman lain.

## Prioritas
- [P1] Galeri tidak skala untuk ~1.000 aset/bulan. Fix: cari judul, pilih batch/tema, lompat halaman, "Pilih semua N di filter ini". /impeccable shape lalu harden
- [P1] Editan metadata hilang saat J/K atau Aset berikutnya; konfirmasi simpan bisa hilang (key form). Fix: penanda dirty memblokir navigasi dengan Simpan/Buang; key form = id aset. /impeccable harden
- [P2] Aset Gagal: Unduh SVG jadi tombol utama tanpa alasan Ekspor hilang ([id]/page.tsx). Fix: Unduh selalu outline + alasan satu baris. /impeccable clarify
- [P2] Jalur samping Adobe: hapus catatan massal tanpa konfirmasi (muncul juga untuk aset tanpa keputusan), alasan terbawa, hapus aset ke galeri tanpa filter. /impeccable harden
- [P2] Kepala galeri tanpa langkah maju (CTA Generate), lima pita sebelum grid. Fix: CTA "Ekspor N aset Lolos", filter Adobe digabung ke baris filter. /impeccable distill

## Persona
- Alex: tanpa model keyboard di galeri, J/K tak terlihat, pilihan per halaman.
- Sam: mode tinjau tidak mengumumkan aset baru; teks nonaktif opacity 40-50%.
- Casey: form Adobe 3-4 layar di bawah; editan hilang saat geser kembali.

## Pertanyaan
Triase Lolos/Perlu cek sebagai antrean satu per satu? Kepala galeri "12 siap ekspor, 68 menunggu Adobe"? Aset Gagal boleh diunduh tanpa konfirmasi?
