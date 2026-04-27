-- Run this in the Supabase SQL Editor after running scripts/setup-supabase.js (so buckets exist).
-- Allows authenticated users to read from "documents"; allows public read for "product-images" if bucket is public.

-- Documents bucket: authenticated users can read (download)
create policy "Authenticated read documents"
on storage.objects for select
to authenticated
using (bucket_id = 'documents');

-- Optional: allow service role / admin to upload (e.g. via dashboard or backend)
-- create policy "Service role full access documents"
-- on storage.objects for all to service_role using (bucket_id = 'documents');

-- Product-images: public read (so product images load without auth)
create policy "Public read product-images"
on storage.objects for select
to public
using (bucket_id = 'product-images');
