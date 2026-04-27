-- Allow staff to upload, update, and delete product images (product-images bucket).
-- Public read is already in 002_storage_policies.sql.

create policy "Authenticated insert product-images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images');

create policy "Authenticated update product-images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images');

create policy "Authenticated delete product-images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images');
