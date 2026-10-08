-- Riset: keep the raw inputs of every score so a stored run re-scores exactly as it was made,
-- and remember how the run was made (model, Trends availability) so the page can say so after a reload.
alter table public.themes
  add column event_weight smallint not null default 2 check (event_weight between 1 and 3),
  add column ai_demand smallint check (ai_demand between 0 and 100),
  add column ai_competition smallint check (ai_competition between 0 and 100);

alter table public.research_runs
  add column trends_missing boolean not null default false,
  add column provider text check (char_length(provider) <= 40),
  add column model text check (char_length(model) <= 120),
  add column cost_idr numeric not null default 0 check (cost_idr >= 0);
