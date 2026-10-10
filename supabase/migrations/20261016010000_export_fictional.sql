-- Stage 12: file names in an export that show fictional people or property, so the upload checklist (also from
-- the history on another device) reminds the user to tick "People and Property are fictional" for them.
alter table public.exports add column fictional_files text[] not null default '{}';
