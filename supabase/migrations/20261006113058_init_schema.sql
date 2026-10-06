-- MicroStock Vector AI: tahap 1 schema.
-- Every table has user_id + RLS so the app is ready for multi-user later.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  region text not null,
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  constraint research_runs_period_check check (period_end >= period_start),
  constraint research_runs_id_user_key unique (id, user_id)
);

create table public.themes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  run_id uuid,
  title text not null,
  country text,
  event text,
  upload_by date,
  demand_score smallint check (demand_score between 0 and 100),
  competition_score smallint check (competition_score between 0 and 100),
  opportunity_score smallint check (opportunity_score between 0 and 100),
  seed_keywords text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint themes_id_user_key unique (id, user_id),
  -- run_id stays null for themes typed by hand; composite FK keeps the run in the same account.
  constraint themes_run_fk foreign key (run_id, user_id)
    references public.research_runs (id, user_id) on delete set null (run_id)
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  theme_id uuid,
  style text not null check (style in ('icon_set', 'seamless_pattern', 'flat_illustration', 'badge_label', 'abstract_background')),
  palette jsonb not null default '[]'::jsonb,
  count integer not null default 10 check (count between 1 and 100),
  status text not null default 'menunggu' check (status in ('menunggu', 'berjalan', 'selesai', 'gagal')),
  created_at timestamptz not null default now(),
  constraint generation_jobs_id_user_key unique (id, user_id),
  constraint generation_jobs_theme_fk foreign key (theme_id, user_id)
    references public.themes (id, user_id) on delete set null (theme_id)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid not null,
  provider text not null check (provider in ('kenari', 'gemini', 'recraft')),
  model text not null,
  svg_path text,
  preview_path text,
  path_count integer check (path_count >= 0),
  phash text,
  qc_status text not null default 'menunggu' check (qc_status in ('menunggu', 'lolos', 'perlu_cek', 'gagal')),
  qc_notes jsonb not null default '[]'::jsonb,
  title text,
  keywords text[] not null default '{}',
  category text,
  needs_release boolean not null default false,
  exported_at timestamptz,
  created_at timestamptz not null default now(),
  constraint assets_job_fk foreign key (job_id, user_id)
    references public.generation_jobs (id, user_id) on delete cascade
);

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  zip_path text,
  csv_path text,
  asset_count integer not null default 0 check (asset_count >= 0),
  created_at timestamptz not null default now()
);

create table public.provider_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null check (provider in ('kenari', 'gemini', 'recraft')),
  model text not null,
  kind text not null check (kind in ('concepts', 'svg', 'metadata')),
  cost_usd numeric(10, 4) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Automatic fallback order. Empty model = use the default model from the environment.
  -- Recraft is never part of this list: it only runs from an explicit button (CLAUDE.md).
  provider_order jsonb not null default '[{"provider": "kenari", "model": ""}, {"provider": "gemini", "model": ""}]'::jsonb,
  banned_words text[] not null default array[
    'disney', 'marvel', 'pixar', 'pokemon', 'nintendo', 'mario', 'star wars', 'harry potter',
    'batman', 'superman', 'spiderman', 'barbie', 'lego', 'minecraft', 'hello kitty',
    'nike', 'adidas', 'coca-cola', 'pepsi', 'starbucks', 'mcdonalds', 'apple', 'google'
  ],
  default_style text not null default 'icon_set'
    check (default_style in ('icon_set', 'seamless_pattern', 'flat_illustration', 'badge_label', 'abstract_background')),
  palettes jsonb not null default '[
    {"name": "Ceria", "colors": ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#2D3047"]},
    {"name": "Pastel", "colors": ["#FFD6E0", "#FFEFCF", "#D7F9F1", "#CDE7FF", "#E4D9FF"]},
    {"name": "Monokrom", "colors": ["#111827", "#374151", "#6B7280", "#D1D5DB", "#F9FAFB"]}
  ]'::jsonb,
  recraft_monthly_budget_usd numeric(6, 2) not null default 10
    check (recraft_monthly_budget_usd between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (foreign keys and common filters)
-- ---------------------------------------------------------------------------

create index research_runs_user_id_idx on public.research_runs (user_id);
create index themes_user_id_idx on public.themes (user_id);
create index themes_run_id_idx on public.themes (run_id);
create index generation_jobs_user_id_idx on public.generation_jobs (user_id);
create index generation_jobs_theme_id_idx on public.generation_jobs (theme_id);
create index assets_user_status_idx on public.assets (user_id, qc_status);
create index assets_job_id_idx on public.assets (job_id);
create index exports_user_id_idx on public.exports (user_id);
create index provider_usage_user_created_idx on public.provider_usage (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: a user only sees and writes their own rows
-- ---------------------------------------------------------------------------

alter table public.research_runs enable row level security;
alter table public.themes enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.assets enable row level security;
alter table public.exports enable row level security;
alter table public.provider_usage enable row level security;
alter table public.user_settings enable row level security;

create policy "own rows" on public.research_runs
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.themes
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.generation_jobs
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.assets
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.exports
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.provider_usage
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Every new account gets a settings row with the defaults above.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
