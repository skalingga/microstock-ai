-- Stage 16: raster illustrations (sticker, watercolor...) made in Google Flow. Like backgrounds they stay
-- kind = 'photo'; photo_variant tells them apart so the gallery can filter them.
alter table public.assets drop constraint if exists assets_photo_variant_check;
alter table public.assets
  add constraint assets_photo_variant_check
  check (photo_variant is null or photo_variant in ('photo', 'background', 'illustration'));
