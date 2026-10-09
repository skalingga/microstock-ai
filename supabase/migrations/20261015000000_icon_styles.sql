-- Stage 10: three more styles written by the text model: outline icons, glyph icons and geometric tiles.
alter table public.generation_jobs drop constraint generation_jobs_style_check;
alter table public.generation_jobs
  add constraint generation_jobs_style_check check (style in (
    'icon_set', 'seamless_pattern', 'flat_illustration', 'badge_label', 'abstract_background',
    'silhouette', 'line_art', 'line_icon', 'glyph_icon', 'geometric_tile'
  ));

alter table public.user_settings drop constraint user_settings_default_style_check;
alter table public.user_settings
  add constraint user_settings_default_style_check check (default_style in (
    'icon_set', 'seamless_pattern', 'flat_illustration', 'badge_label', 'abstract_background',
    'silhouette', 'line_art', 'line_icon', 'glyph_icon', 'geometric_tile'
  ));
