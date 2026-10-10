-- Stage 12 (docs/PLAN-mode-foto.md): photos made by the user in Google Flow and uploaded to the app.
-- They live in the same assets table as the vectors, so the gallery, Adobe review and export are shared.

alter table public.assets
  add column kind text not null default 'vector' check (kind in ('vector', 'photo')),
  add column image_path text,
  add column width integer check (width > 0),
  add column height integer check (height > 0),
  add column file_bytes integer check (file_bytes >= 0),
  add column fictional_people boolean not null default false;

-- 'flow' marks a photo made by hand in Google Flow: no adapter, no API call.
alter table public.assets drop constraint assets_provider_check;
alter table public.assets
  add constraint assets_provider_check check (provider in ('kenari', 'gemini', 'recraft', 'flow'));

create index assets_user_kind_idx on public.assets (user_id, kind);

-- One photo job = one set of prompts for one theme.
alter table public.generation_jobs drop constraint generation_jobs_style_check;
alter table public.generation_jobs
  add constraint generation_jobs_style_check check (style in (
    'icon_set', 'seamless_pattern', 'flat_illustration', 'badge_label', 'abstract_background',
    'silhouette', 'line_art', 'line_icon', 'glyph_icon', 'geometric_tile', 'photo'
  ));

-- The prompts written for a photo job, so they can be copied again later (Flow is used by hand).
alter table public.generation_jobs add column photo_prompts jsonb;

-- Photos are stored as uploaded JPEG: {user_id}/photo/{asset_id}.jpg. The 20 MB per-file limit stays.
update storage.buckets
set allowed_mime_types = array['image/svg+xml', 'image/png', 'image/jpeg', 'application/zip', 'text/csv']
where id = 'assets';

-- Storage used by the signed-in user, shown in Settings. Only counts files in the user's own folder.
create or replace function public.my_storage_bytes()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
  from storage.objects o
  where o.bucket_id = 'assets'
    and (storage.foldername(o.name))[1] = (select auth.uid())::text;
$$;

revoke all on function public.my_storage_bytes() from public, anon;
grant execute on function public.my_storage_bytes() to authenticated;
