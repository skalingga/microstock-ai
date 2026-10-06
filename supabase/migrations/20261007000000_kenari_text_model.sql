-- Optional cheaper Kenari model for the text-only calls (concepts and metadata).
-- Empty means: use the same model as the SVG calls.
alter table public.user_settings
  add column kenari_text_model text not null default ''
    check (char_length(kenari_text_model) <= 120);
