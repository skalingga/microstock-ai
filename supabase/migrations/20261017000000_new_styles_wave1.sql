-- Stage 14 wave 1 (docs/PLAN-gaya-baru-dan-bundle.md): three new vector styles written by the text model.
-- Same pattern as 20261015000000_icon_styles.sql; 'photo' stays allowed on jobs (stage 12).

alter table public.generation_jobs drop constraint generation_jobs_style_check;
alter table public.generation_jobs
  add constraint generation_jobs_style_check check (style in (
    'icon_set', 'seamless_pattern', 'flat_illustration', 'badge_label', 'abstract_background',
    'silhouette', 'line_art', 'line_icon', 'glyph_icon', 'geometric_tile',
    'sticker', 'isometric', 'frame', 'photo'
  ));

alter table public.user_settings drop constraint user_settings_default_style_check;
alter table public.user_settings
  add constraint user_settings_default_style_check check (default_style in (
    'icon_set', 'seamless_pattern', 'flat_illustration', 'badge_label', 'abstract_background',
    'silhouette', 'line_art', 'line_icon', 'glyph_icon', 'geometric_tile',
    'sticker', 'isometric', 'frame'
  ));
