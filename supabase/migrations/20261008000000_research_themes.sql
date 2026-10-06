-- Stage 8: theme research. Log theme-idea calls and keep the raw signals behind each score.
alter table public.provider_usage drop constraint provider_usage_kind_check;
alter table public.provider_usage
  add constraint provider_usage_kind_check check (kind in ('concepts', 'svg', 'metadata', 'themes'));

alter table public.themes
  add column trend_score smallint check (trend_score between 0 and 100),
  add column adobe_result_count integer check (adobe_result_count >= 0);
