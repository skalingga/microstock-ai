-- Kenari bills in Rupiah, so its cost gets its own column (cost_usd stays for Recraft).
alter table public.provider_usage
  add column cost_idr numeric(14, 2) not null default 0 check (cost_idr >= 0);

-- Monthly spending cap for paid Kenari models. Models ending in ":free" cost nothing and are never blocked.
alter table public.user_settings
  add column kenari_monthly_budget_idr integer not null default 20000
    check (kenari_monthly_budget_idr between 0 and 1000000);

-- Month-to-date spend for the signed-in user (security invoker: RLS still applies).
create function public.provider_cost_since(p_provider text, p_since timestamptz)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(cost_idr), 0)
  from public.provider_usage
  where provider = p_provider and created_at >= p_since
$$;

revoke all on function public.provider_cost_since(text, timestamptz) from public, anon;
grant execute on function public.provider_cost_since(text, timestamptz) to authenticated;
