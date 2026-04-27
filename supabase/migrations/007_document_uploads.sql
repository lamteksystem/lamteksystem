-- Document upload slots for admin: pricelist, main brochure, door finder.
-- Enables "know where files are" and import script to read pricelist from storage.

-- Add optional role to documents (one row per role for the three admin upload slots)
alter table public.documents
  add column if not exists role text check (role in ('pricelist','main_brochure','door_finder'));

comment on column public.documents.role is 'Admin upload slot: pricelist, main_brochure, or door_finder. Null = normal download document.';

-- Staff can insert and update documents (for admin upload slots and downloads)
create policy "Staff insert documents"
on public.documents for insert to authenticated
with check (auth.uid() in (select user_id from public.staff_profiles));

create policy "Staff update documents"
on public.documents for update to authenticated
using (auth.uid() in (select user_id from public.staff_profiles));

-- Storage: allow authenticated users to upload/update in documents bucket (for admin uploads)
create policy "Authenticated insert documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'documents');

create policy "Authenticated update documents"
on storage.objects for update to authenticated
using (bucket_id = 'documents');

create policy "Authenticated delete documents"
on storage.objects for delete to authenticated
using (bucket_id = 'documents');
