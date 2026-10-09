-- What an export contained, so Riwayat can show it by name and not only by date and count.
-- label: the themes in the export ("Autumn leaves, Coffee cups +2"); empty for exports made before this column.
-- asset_ids: the exported assets, for the thumbnails (assets deleted later simply drop out).
-- filenames: the SVG file names inside the ZIP.
-- release_titles: assets that need a model/property release, kept so the release step in the checklist can name them later.
-- The existing "own rows" policy on exports already limits reads to the owner.
alter table public.exports
  add column label text not null default '',
  add column asset_ids uuid[] not null default '{}',
  add column filenames text[] not null default '{}',
  add column release_titles text[] not null default '{}';
