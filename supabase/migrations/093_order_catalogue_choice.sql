-- Guided order/quote setup: Tealbury Complete vs Lamtek component catalogue.
alter table public.orders
  add column if not exists catalogue_choice text;

alter table public.orders drop constraint if exists orders_catalogue_choice_check;
alter table public.orders
  add constraint orders_catalogue_choice_check
  check (catalogue_choice is null or catalogue_choice in ('tealbury', 'lamtek'));

comment on column public.orders.catalogue_choice is
  'Kitchen setup: tealbury (Tealbury Complete guided BOM) or lamtek (component catalogue).';

-- Staff may permanently remove draft quotes and draft orders.
drop policy if exists "Staff delete draft quotation orders" on public.orders;
create policy "Staff delete draft quotation orders"
  on public.orders for delete to authenticated
  using (
    status in ('draft', 'quotation')
    and exists (
      select 1 from public.staff_profiles sp
      where sp.user_id = auth.uid()
    )
  );
