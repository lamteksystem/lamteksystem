-- Fix documents RLS: use is_staff() (security definer) so staff check works reliably.
-- Run this if you get "new row violates row-level security policy" when uploading in Admin → Brochure & Pricelist.

drop policy if exists "Staff insert documents" on public.documents;
drop policy if exists "Staff update documents" on public.documents;

create policy "Staff insert documents"
on public.documents for insert to authenticated
with check (public.is_staff());

create policy "Staff update documents"
on public.documents for update to authenticated
using (public.is_staff());
