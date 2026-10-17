-- Styles that produced no kept asset in 5-9 trial batches are hidden from Generate unless this is switched on
-- (Pengaturan > Gaya eksperimen). Off by default; existing assets and batches are untouched.
alter table public.user_settings
  add column if not exists show_experimental_styles boolean not null default false;
