---
target: /uji-model
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:D:\\DEV\\microstock-ai\\app\\(app)\\uji-model\\page.tsx"
target_fingerprint: "sha256:e877599173cac10a9f65cfa58318779f588553562da5f397e54789b111878e5e"
target_path: "D:\\DEV\\microstock-ai\\app\\(app)\\uji-model\\page.tsx"
timestamp: 2026-10-08T23-46-12Z
slug: app-app-uji-model-page-tsx
---
# Kritik ulang /uji-model (2026-10-09, setelah 128a823)
Method: dual-agent (A source review, B detector CLI); live overlay by parent session.

| # | Heuristik | Skor | Isu |
|---|---|---|---|
| 1 | Status | 3 | Saran tampil di uji yang belum lengkap tanpa tanda "belum lengkap" |
| 2 | Bahasa | 3 | Rumus skor bergaya matematika; "konsep per tema" tidak menyebut efek ke jumlah SVG dan biaya |
| 3 | Kendali | 2 | Jadikan utama/cadangan langsung mengubah pengaturan tanpa konfirmasi atau urungkan; bisa menghapus cadangan |
| 4 | Konsistensi | 2 | suggest() memilih cadangan per kuota (boleh sesama Kenari), pengaturan wajib beda provider |
| 5 | Cegah error | 2 | Saran bisa ditolak saat diterapkan; peringatan lewat anggaran tidak menahan Mulai |
| 6 | Kenali | 3 | Penanda utama/cadangan sekarang, pemenang di chip, isi ulang setup |
| 7 | Efisiensi | 3 | Lanjutkan/ulangi/setup ulang; tanpa "pakai pasangan saran" sekali klik |
| 8 | Estetika | 2 | Kesimpulan + tabel 9 kolom + 12+ tombol Jadikan + grid; dua tombol utama bersaing |
| 9 | Pemulihan | 3 | Ulangi gagal; error mentah berbahasa Inggris, tooltip title tak terbuka di sentuh |
| 10 | Bantuan | 3 | InfoTip jujur; tidak menyebut kapan hasil bisa dipercaya |
| Total | | 26/40 | Cukup (naik dari 24) |

Detektor: CLI 0. Overlay: 40x nested-cards (thumbnail berbingkai di dalam bingkai tabel grid, nyata tapi kecil), cards flush against scroller edge (grid, kecil), 2x text occluded (elemen tersembunyi berukuran nol, alarm palsu), sisanya sama seperti halaman lain.

## Prioritas
- [P1] Saran cadangan bisa mustahil diterapkan (benchmark.ts suggest/quotaGroup vs actions.ts + schema.ts). Fix: suggest() pilih cadangan dari provider lain. /impeccable harden
- [P1] Jadikan utama/cadangan tanpa konfirmasi/urungkan. Fix: satu aksi "Pakai saran ini" dengan diff sebelum-sesudah + Urungkan, hasil di dekat kesimpulan + tautan Pengaturan. /impeccable harden
- [P1] Kesimpulan terlalu yakin pada uji parsial/kecil. Fix: tanda "Belum lengkap N/M", jumlah percobaan dulu, catatan sampel kecil. /impeccable clarify
- [P2] Bagian hasil terlalu padat, dua tombol utama. Fix: aksi terapkan hanya di kesimpulan, tabel dipangkas, kolom pemenang ditandai di grid. /impeccable distill
- [P2] Tombol diam saat uji berjalan; fokus radio 1/2/3 tak terlihat. /impeccable polish

## Persona
- Alex: dua klik untuk pasangan saran, klik kedua bisa gagal.
- Sam: fokus radio tak terlihat; judul live diumumkan tiap sel; "Uji baru" bukan heading.
- Casey: Mulai uji di dasar form panjang; tombol Jadikan berdampingan rawan salah ketuk.

## Pertanyaan
Halaman lab boleh mengubah pengaturan produksi? Grid dulu dengan pilihan pengguna, baru kesimpulan? Kapan satu uji cukup?
