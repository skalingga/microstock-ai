-- concept: the idea behind each SVG, reused for AI metadata in stage 3.
alter table public.assets add column concept text;

-- ok: failed calls still use provider quota, so they are logged too.
alter table public.provider_usage add column ok boolean not null default true;
