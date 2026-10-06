-- Composite foreign keys (id, user_id) need composite indexes to be covered.
drop index if exists public.themes_run_id_idx;
drop index if exists public.generation_jobs_theme_id_idx;
drop index if exists public.assets_job_id_idx;

create index themes_run_fk_idx on public.themes (run_id, user_id);
create index generation_jobs_theme_fk_idx on public.generation_jobs (theme_id, user_id);
create index assets_job_fk_idx on public.assets (job_id, user_id);
