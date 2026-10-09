---
target: /ekspor
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:D:\\DEV\\microstock-ai\\app\\(app)\\ekspor\\page.tsx"
target_fingerprint: "sha256:63fbc0c71d6cd61cf2534204df145cb5e9826d36e7fdaf9e0e14a01c7042e430"
target_path: "D:\\DEV\\microstock-ai\\app\\(app)\\ekspor\\page.tsx"
timestamp: 2026-10-08T22-47-04Z
slug: app-app-ekspor-page-tsx
---
# Kritik /ekspor (2026-10-09)
Method: dual-agent (A source review, B detector CLI); browser evidence by parent session.

| # | Heuristik | Skor | Isu |
|---|---|---|---|
| 1 | Status | 3 | Progress hanya di tombol, tanpa aria-live; hasil muncul tanpa fokus |
| 2 | Bahasa | 3 | "Per jumlah bentuk", "Tingkat", "Kelompok" singkat |
| 3 | Kendali | 3 | Simpan sukses diam-diam mengosongkan pilihan |
| 4 | Konsistensi | 2 | Tanpa SelectionHandles/ProgressLine; Gagal QC tanpa tautan |
| 5 | Cegah error | 3 | Gerbang Perlu cek baik; pilihan tersembunyi filter hilang diam-diam |
| 6 | Kenali | 2 | Checklist statis jauh dari hasil |
| 7 | Efisiensi | 2 | Tanpa cari/filter batch; 3 klik untuk file |
| 8 | Estetika | 2 | 5 kartu bobot sama + 3 stat |
| 9 | Pemulihan | 3 | Alasan per aset dilewati; error muat tanpa coba lagi |
| 10 | Bantuan | 3 | Checklist ada tapi tanpa tautan portal |
| Total | | 26/40 | Cukup |

Spesifisitas: isi khas Adobe, tampilan generik; motif pena hampir tak ada (checkbox bawaan, spinner tombol, kosong tanpa PenPath).
Detektor: CLI 0; overlay sama dengan halaman lain (false positive).
Bukti browser: tombol "Ekspor 40 aset" di y=2023 (desktop), y=5644 dari 6664 di 375px.

## Prioritas
- [P1] Tombol utama tertimbun di bawah daftar. Fix: bar pilihan menempel bawah, daftar dikelompokkan per batch. /impeccable layout + adapt
- [P1] Checklist unggah jauh dari saat dibutuhkan (page.tsx:156-170). Fix: di bawah kartu hasil, bisa dicentang, label AI ditonjolkan, tautan portal. /impeccable clarify
- [P2] Laporan penerimaan bersaing dengan ekspor (page.tsx:150-154). Fix: turunkan/lipat, "belum dicatat" jadi tautan. /impeccable distill
- [P2] Puncak lemah: 2 klik unduh tambahan, fokus tidak pindah, tanpa ringkasan. /impeccable harden + delight
- [P2] Bahasa visual di luar sistem: checkbox bawaan, bobot kartu sama. /impeccable polish + typeset

## Persona
- Alex: tanpa filter batch/shift-select, 3 klik, hasil Adobe per aset.
- Jordan: Perlu cek tanpa tautan, "viewBox" jargon, checklist di bawah analitik.
- Casey: tombol di gulir ke-7, unduh ZIP di HP tanpa petunjuk "unggah dari PC".

## Minor
"Siap diekspor" tidak ikut pilihan; tabel tanpa scope/caption/tabular-nums; kosong tanpa tautan ke /aset atau /generate; error di luar kartu; label InfoTip "Penjelasan" generik.

## Pertanyaan
Buka dengan "40 aset siap -> Ekspor", tutup dengan "unggah 1-2-3"? Catat hasil Adobe dari baris riwayat? HP sebagai "siapkan lalu lanjut di PC"?
