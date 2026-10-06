-- Export history keeps the ZIP and CSV so they can be downloaded again.
-- Layout: {user_id}/exports/{export_id}.zip and {export_id}.csv
update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['image/svg+xml', 'image/png', 'application/zip', 'text/csv']
where id = 'assets';
