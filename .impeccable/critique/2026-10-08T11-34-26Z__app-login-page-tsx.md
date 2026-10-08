---
target: landing (/login)
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:D:\\DEV\\microstock-ai\\app\\login\\page.tsx"
target_fingerprint: "sha256:04d65ba3dd0b4ce806872c3c5deeb83fc8814017a90427312775231aeb719394"
target_path: "D:\\DEV\\microstock-ai\\app\\login\\page.tsx"
timestamp: 2026-10-08T11-34-26Z
slug: app-login-page-tsx
---
# Critique: /login (app/login/page.tsx), 2026-10-08
Method: dual-agent. Score 23/40 (Acceptable). H1 2, H2 3, H3 2, H4 2, H5 2, H6 3, H7 2, H8 3, H9 2, H10 2.

## Design specificity
Desktop left panel authored (pen-tool anchors as step list, bezier logo, paper/ink, Bricolage 800). Right column is a stock shadcn auth card. On mobile the authored panel is hidden (auth-shell.tsx:11), only generic card remains.
Detector: CLI clean (0) for app/login, app/reset-password, imported components. Browser: cream-palette (intentional per DESIGN.md), layout-transition (false positive, Sonner inline CSS).

## Priority issues
- [P1] Mobile loses identity and has no <h1> (auth-shell.tsx:11,14). Fix: compact PenPath strip under lg, form heading as h1. -> adapt
- [P1] Mode switch lossy: key={mode} remount drops email, focus to body; heading stays "Selamat datang" (login-form.tsx:30, page.tsx:7). Fix: shared email state, per-mode title, move focus. -> harden
- [P1] Native validation bubbles in browser language; no noValidate; errors not tied to fields; state.info lacks role=status (login-form.tsx:81). -> harden
- [P2] Session expiry: proxy.ts:48 strips path, no notice, always lands /generate. Fix: ?lanjut= + ?sesi=berakhir. -> harden
- [P2] Public "Daftar" on single-owner v1. Fix: env flag until Tahap 9. -> distill

## Persona red flags
Jordan: public signup implies public product. Sam: Lupa link interrupts tab order; focus lost; info not announced; no h1 on mobile. Casey: theme toggle top-right; password cleared after error. Owner on HP: silent redirect, wrong landing page, enableSystem={false} ignores OS dark.

## Minor
Title lacks "Masuk ·"; Base UI uncontrolled warning; "siap jual." unsourced claim (prefer "siap unggah"); reset page lacks back link; rounded-2xl vs rounded-lg.

## Questions
Should login be the most authored moment for a single user? Why is the brand moment desktop-only? Does "siap jual" persuade the only user?
