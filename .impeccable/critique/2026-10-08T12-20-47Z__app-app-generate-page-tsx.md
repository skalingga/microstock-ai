---
target: /generate
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:D:\\DEV\\microstock-ai\\app\\(app)\\generate\\page.tsx"
target_fingerprint: "sha256:a4666deb902a787381bdabc27515d5ce16aa2f4bf6f04e35ada2b1707cde078b"
target_path: "D:\\DEV\\microstock-ai\\app\\(app)\\generate\\page.tsx"
timestamp: 2026-10-08T12-20-47Z
slug: app-app-generate-page-tsx
---
# Critique: /generate (app/(app)/generate/page.tsx), 2026-10-08
Method: dual-agent. Score 25/40 (Acceptable). H1 2, H2 3, H3 3, H4 3, H5 2, H6 2, H7 2, H8 3, H9 2, H10 3.
Running-queue states reviewed from source only (no generate click).

## Design specificity
Skin authored (ProgressLine, style previews, checker, anchor QC badges); skeleton generic SaaS (h1, 3 KPI cards, card form with 3-col select grid). KPI cards show API calls, not Lolos/remaining Rp.
Detector: CLI 0 findings. Browser: layout-transition width stat-card.tsx:26 (real, minor), nested-cards style-preview.tsx:44 (real), nested-cards + text-overflow app-nav.tsx:88 (FP/intentional), low-contrast loading placeholder dark generate-form.tsx:258 (disabled, exempt), cream-palette (intentional), layout-transition height (Sonner FP).

## Priority issues
- [P0] Running batch not monitorable from HP/other device: queue only in React state; generation_jobs 'berjalan' never read; no tab title progress; no wake lock; stale jobs never 'terputus'. -> shape + harden
- [P1] Primary button focus ring invisible app-wide: --ring == --primary (globals.css:71,94), button outline-none. Fix ring-offset-2. -> audit/polish
- [P1] Paid text model cost not shown/bounded in form (cost chip traced-only, generate-form.tsx:322). -> clarify + harden
- [P2] Model picker 2nd position, 110 options incl. TTS, no benchmark hint; swaps with Gaya below. Reorder, collapse to Lanjutan. -> distill
- [P2] Input safety: banned words only server-side after start; count field clamps per keystroke (generate-form.tsx:314); disabled start without reason. -> harden

## Persona red flags
Alex: no repeat/preset/retry; silent clamp 30. Sam: invisible focus; duplicate "Penjelasan" names; no h2; status region mounts with content; 9 tab stops. Casey: form at 575px, submit 1.5 screens down; progress not scrolled into view; truncated selects. Owner on HP: sees nothing of running batch.

## Minor
Disabled palette shows "Ceria" for Siluet; ochre cost chip always alarming; cost breakdown only in title attr; over-budget role=alert re-announces; finish lacks Lolos/Perlu cek/Gagal breakdown, batch cost, Ekspor step; fallback not named; placeholder reads as value.
