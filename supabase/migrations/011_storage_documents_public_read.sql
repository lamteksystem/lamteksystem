-- Allow public read on the documents bucket so View/Download links work for
-- brochures, pricelist, and door finder. The bucket must be created as public
-- (run: npm run setup:supabase) or set to public in Dashboard → Storage → documents.
create policy "Public read documents"
on storage.objects for select
to public
using (bucket_id = 'documents');
