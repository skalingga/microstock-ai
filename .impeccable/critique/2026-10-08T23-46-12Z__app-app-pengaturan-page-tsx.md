---
target: /pengaturan
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:D:\\DEV\\microstock-ai\\app\\(app)\\pengaturan\\page.tsx"
target_fingerprint: "sha256:a95f6b320145972a249354b5191d75e5c8f96251f583cce95ce946ca4581153f"
target_path: "D:\\DEV\\microstock-ai\\app\\(app)\\pengaturan\\page.tsx"
timestamp: 2026-10-08T23-46-12Z
slug: app-app-pengaturan-page-tsx
---
# Kritik ulang /pengaturan (2026-10-09, setelah 19bcfd9)
Method: dual-agent (A source review, B detector CLI); live overlay by parent session.

| # | Heuristik | Skor | Isu |
|---|---|---|---|
| 1 | Status | 3 | Setelah simpan bar tak lagi menempel, "Tersimpan pukul" bisa di luar layar |
| 2 | Bahasa | 3 | "Rantai provider", "Bawaan server" istilah pengembang |
| 3 | Kendali | 3 | beforeunload tidak menangkap navigasi Link (tautan uji model di tengah form) |
| 4 | Konsistensi | 3 | Bar pemakaian tidak memakai ProgressLine motif |
| 5 | Cegah error | 2 | Ganti provider, ID model lama tetap (input tak terkontrol); model gambar tanpa harga tetap bisa disimpan |
| 6 | Kenali | 2 | Datalist tak terlihat dan label tak muncul di iOS; status berbayar model terpilih tak disebut |
| 7 | Efisiensi | 3 | Edit massal teks + pratinjau langsung |
| 8 | Estetika | 3 | Tenang; kolom model teks Kenari selalu tampil walau Kenari tak dipakai |
| 9 | Pemulihan | 3 | Error per kolom + fokus; teks error kecil |
| 10 | Bantuan | 3 | Petunjuk kontekstual; aturan cadangan di tooltip |
| Total | | 28/40 | Baik (naik dari 20) |

Detektor: CLI 0; overlay sama seperti halaman lain (sidebar/indikator dev).

## Prioritas
- [P1] Biaya model teks berbayar tak terlihat di rantai dan tak masuk perkiraan anggaran (deepseek-v4-flash berbayar). Fix: baris status di bawah tiap kolom model (berbayar/gratis, Rp per SVG, skor uji); hint anggaran menyebut teks + gambar. /impeccable clarify
- [P1] Ganti provider menyimpan ID model provider lain (settings-form.tsx kolom primary/backup_model defaultValue). Fix: kolom terkontrol, kosongkan atau validasi saat provider berganti, tukar otomatis bila utama = cadangan. /impeccable harden
- [P2] Perubahan hilang lewat tautan dalam aplikasi. Fix: tautan uji model tab baru atau konfirmasi saat ada perubahan. /impeccable harden
- [P2] Konfirmasi simpan bisa keluar layar. Fix: bar tetap menempel beberapa detik setelah simpan. /impeccable polish
- [P3] Bar pemakaian tanpa motif; harga model gambar tak dikenal tampil sebagai hint biasa. /impeccable polish

## Persona
- Jordan: kolom model tampak kotak kosong; istilah rantai/bawaan server.
- Sam: contoh warna hanya title tanpa teks; label datalist tak terbaca.
- Riley: provider berganti dengan model basi; 1e5 diterima; dua tab saling timpa.

## Pertanyaan
Sebut biaya per rantai ("Rantai ini: gratis")? Pilihan model tertutup + "lainnya"? Blok anggaran jadi jangkar visual halaman?
