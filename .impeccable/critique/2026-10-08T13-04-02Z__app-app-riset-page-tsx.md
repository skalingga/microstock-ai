---
target: /riset
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:D:\\DEV\\microstock-ai\\app\\(app)\\riset\\page.tsx"
target_fingerprint: "sha256:e91f83c97ee41c2b790415a0ee8c5a4ad84ae226da8f4ad7a1f70334f4f46da1"
target_path: "D:\\DEV\\microstock-ai\\app\\(app)\\riset\\page.tsx"
timestamp: 2026-10-08T13-04-02Z
slug: app-app-riset-page-tsx
---
# Critique: /riset (app/(app)/riset/page.tsx), 2026-10-08
Method: dual-agent. Score 22/40 (Acceptable). H1 2, H2 3, H3 2, H4 3, H5 2, H6 2, H7 1, H8 2, H9 2, H10 3.
Running/error/first-run states reviewed from source only (no research click). Stored run: US, 10 themes.

## Design specificity
Half authored: paper/ink tokens, Bricolage title, ink buttons. Result cards generic SEO-tool pattern (traffic-light score tile, title, CTA, grey chips); no pen-tool motif, no vermilion, score uses soft color fills.
Detector: CLI 0. Browser: nested-cards x10 riset-form.tsx:268 (real). Known FPs: cream-palette, Sonner layout-transition, sidebar pill app-nav.tsx:88.

## Priority issues
- [P0] Opportunity score shows AI guesses as fact (Principle 5): 8/10 rows both inputs guessed, no marker on big number; AI demand saturates at 100; Trends and AI mixed on one scale (St Patrick's real Trends 4 ranks last). Fix: provenance mark on tile, real-data rows first, no number when both guessed, formula in InfoTip. -> clarify + distill
- [P1] Stored results drift and undated: page.tsx:28 hardcodes eventWeight 2 and reuses boosted demand_score as aiDemand; trendsMissing lost on reload; no run date/market/period header. -> harden (needs migration)
- [P1] Cost invisible, weak progress: no model/cost before/after, status without aria-live, no cancel, errors toast-only. -> harden
- [P2] Adobe count input: saves on every blur, no saved feedback, immediate re-sort moves focus, no plausibility/meaning shown. -> harden
- [P2] Dense nested cards + lossy handoff: 10 cards in Card, 10 identical primary CTAs, 5.4k px on HP, form fills first viewport; /generate?tema= drops keywords/event/deadline. -> layout + distill

## Persona red flags
Alex: no sort/filter/bulk send; re-enter period. Sam: status not announced; re-sort moves focus; 10 identical link names; score tile lacks context. Casey: form first viewport; 5.4k px; chips wrap. Owner on HP: stale undated list, past-deadline cards unfiltered, finish only a toast.

## Minor
Duplicate "irish" chip; chips look interactive; raw lowercase titles; <=17 grey = unknown look-alike; title-attr hints; ids by sorted index.
