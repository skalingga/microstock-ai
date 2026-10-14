-- Stage 15: backgrounds are photos made in Google Flow without a subject. They stay kind = 'photo' (same upload,
-- QC and export path); this column only tells them apart so the gallery can filter them.
alter table public.assets
  add column if not exists photo_variant text
  check (photo_variant is null or photo_variant in ('photo', 'background'));

-- Every existing photo is a plain photo, unless its job was written as a background job.
update public.assets a
set photo_variant = coalesce(
  (select case when j.photo_prompts ->> 'variant' = 'background' then 'background' else 'photo' end
   from public.generation_jobs j where j.id = a.job_id),
  'photo'
)
where a.kind = 'photo' and a.photo_variant is null;
