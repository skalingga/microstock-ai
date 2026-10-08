---
target: /pengaturan
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:D:\\DEV\\microstock-ai\\app\\(app)\\pengaturan\\page.tsx"
target_fingerprint: "sha256:1fd220eeeef42c79b3645876b6423786a2b5d53e88b71ab6b65544635cbd7de5"
target_path: "D:\\DEV\\microstock-ai\\app\\(app)\\pengaturan\\page.tsx"
timestamp: 2026-10-08T22-47-04Z
slug: app-app-pengaturan-page-tsx
---
# Kritik /pengaturan (2026-10-09)
Method: dual-agent (A source review, B detector CLI); browser evidence by parent session.

| # | Heuristik | Skor | Isu |
|---|---|---|---|
| 1 | Status | 2 | Anggaran tanpa pemakaian bulan ini; perubahan belum disimpan tak ditandai |
| 2 | Bahasa | 2 | Placeholder "Model bawaan" (terverifikasi) tak menyebut model nyata |
| 3 | Kendali | 2 | Tanpa reset/batal/peringatan perubahan |
| 4 | Konsistensi | 3 | Label sr-only di dua kartu; tooltip rounded-xl |
| 5 | Cegah error | 1 | ID model teks bebas; field anggaran kosong -> Rp0 diam-diam |
| 6 | Kenali | 1 | ID model harus diingat dari /uji-model |
| 7 | Efisiensi | 2 | Tanpa "pakai pemenang uji" |
| 8 | Estetika | 3 | Tenang; info biaya di tooltip |
| 9 | Pemulihan | 1 | Hanya issues[0], satu baris di bawah, tanpa field |
| 10 | Bantuan | 3 | InfoTip ringkas |
| Total | | 20/40 | Cukup |

Spesifisitas: empat kartu shadcn generik; palet berupa hex tanpa contoh warna; ID model tanpa mono (melanggar DESIGN.md).
Detektor: CLI 0; overlay nested-cards pada kartu Kata terlarang (kartu sejajar, false positive).

## Prioritas
- [P1] Anggaran tanpa pemakaian dan akibat (settings-form.tsx:187-214). Fix: kartu teratas, "Terpakai Rp X dari Rp Y", perkiraan jumlah gambar, aturan 0 terlihat, tolak kosong. /impeccable clarify + harden
- [P1] Field model teks bebas buta. Fix: placeholder dari withEnvDefaults, mono, daftar ID, tautan ke uji model. /impeccable harden
- [P2] Error jauh dari sumbernya (actions.ts:42). Fix: semua issue per field, aria-invalid, fokus, nomor baris palet. /impeccable harden
- [P2] Pengelompokan tidak sesuai kepentingan. Fix: Biaya & berbayar / Rantai provider / Bawaan generate; kata terlarang dilipat. /impeccable distill
- [P3] Palet tanpa contoh warna, header tanpa deskripsi. /impeccable colorize

## Persona
- Jordan: tak tahu arti Provider/Kenari; anggaran 0 "biar aman" lalu Siluet gagal.
- Sam: error tak terhubung field; fakta biaya hanya di tooltip.
- Riley: 600 kata ditolak tanpa penghitung; kosongkan anggaran -> Rp0; dua tab saling timpa.

## Pertanyaan
Anggaran di /generate saja? Uji model yang menerapkan pemenang? Simpan terpisah untuk risiko berbeda?
