-- Stage 11 (docs/PLAN-gaya-baru-dan-bundle.md, part B): a bundle is one SVG that holds a grid of assets of one set.
-- It lives in the assets table so the gallery, QC, metadata and export are shared with single assets.

alter table public.assets drop constraint assets_kind_check;
alter table public.assets
  add constraint assets_kind_check check (kind in ('vector', 'photo', 'bundle'));

-- 'local' marks an asset composed in the browser: no adapter, no API call.
alter table public.assets drop constraint assets_provider_check;
alter table public.assets
  add constraint assets_provider_check check (provider in ('kenari', 'gemini', 'recraft', 'flow', 'local'));

alter table public.assets
  -- On a bundle: the member assets, in grid order (left to right, top to bottom).
  add column bundle_of uuid[] not null default '{}',
  -- On a member: the bundle that holds it. Members are held back from export while this is set.
  -- Deleting the bundle releases its members.
  add column bundled_in uuid references public.assets (id) on delete set null;

create index assets_bundled_in_idx on public.assets (bundled_in) where bundled_in is not null;
