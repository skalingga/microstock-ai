-- Upload checklist ticks per export, so the Adobe steps started on a phone can be finished on a PC.
-- Values are step ids from app/(app)/ekspor/upload-checklist.tsx (zip, upload, ai, csv, check, release).
-- The existing "own rows" policy on exports already limits reads and updates to the owner.
alter table public.exports
  add column checklist_done text[] not null default '{}';
