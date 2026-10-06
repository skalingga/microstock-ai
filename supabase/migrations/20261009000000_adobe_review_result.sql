-- Stage 6: record what Adobe Stock decided per asset, to measure the acceptance rate per provider.
-- NULL status = no decision known yet (not uploaded, or still in review).
alter table public.assets
  add column adobe_status text check (adobe_status in ('diterima', 'ditolak')),
  add column adobe_reason text check (char_length(adobe_reason) <= 500),
  add column adobe_reviewed_at timestamptz;
