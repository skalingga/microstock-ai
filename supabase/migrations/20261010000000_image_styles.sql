-- Stage 7: two styles drawn by a Kenari image model and converted to SVG on the server.
alter table public.generation_jobs drop constraint generation_jobs_style_check;
alter table public.generation_jobs
  add constraint generation_jobs_style_check check (style in (
    'icon_set', 'seamless_pattern', 'flat_illustration', 'badge_label', 'abstract_background',
    'silhouette', 'line_art'
  ));

alter table public.user_settings drop constraint user_settings_default_style_check;
alter table public.user_settings
  add constraint user_settings_default_style_check check (default_style in (
    'icon_set', 'seamless_pattern', 'flat_illustration', 'badge_label', 'abstract_background',
    'silhouette', 'line_art'
  ));

-- Kenari image model for those styles. Empty means: KENARI_IMAGE_MODEL, then gpt-image-2.
alter table public.user_settings
  add column kenari_image_model text not null default ''
    check (char_length(kenari_image_model) <= 120);
