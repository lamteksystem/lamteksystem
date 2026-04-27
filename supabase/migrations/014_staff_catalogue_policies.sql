-- Allow staff to insert/update categories and products (for admin catalogue import).

create policy "Staff insert categories"
  on public.categories for insert
  with check (public.is_staff());

create policy "Staff update categories"
  on public.categories for update
  using (public.is_staff());

create policy "Staff insert products"
  on public.products for insert
  with check (public.is_staff());

create policy "Staff update products"
  on public.products for update
  using (public.is_staff());
