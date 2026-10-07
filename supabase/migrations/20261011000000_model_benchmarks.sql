-- Stage 4: model benchmark runs. Each run draws the same concepts with several SVG models, so the models can be
-- compared on equal input. The assets themselves live in public.assets; this row keeps the setup and one result per
-- (concept, model) cell, written by the browser queue as it goes.
create table public.model_benchmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'berjalan' check (status in ('berjalan', 'selesai', 'dihentikan', 'gagal')),
  -- { themes: [{ theme, style, jobId }], models: [{ provider, model }], variations }
  setup jsonb not null,
  -- [{ theme, style, concept, provider, model, status, assetId, qc, durationMs, costIdr, shapes, errorCode, error }]
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index model_benchmarks_user_created_idx on public.model_benchmarks (user_id, created_at desc);

alter table public.model_benchmarks enable row level security;

create policy "own rows" on public.model_benchmarks
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
