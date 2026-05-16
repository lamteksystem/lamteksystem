-- Many-to-many product ↔ category assignments (products.category_id remains primary).

create table if not exists public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  is_primary boolean not null default false,
  primary key (product_id, category_id)
);

create index if not exists product_categories_category_id_idx
  on public.product_categories (category_id);

insert into public.product_categories (product_id, category_id, is_primary)
select p.id, p.category_id, true
from public.products p
where p.category_id is not null
on conflict (product_id, category_id) do nothing;

alter table public.product_categories enable row level security;

create policy "Authenticated read product_categories"
  on public.product_categories for select
  using (auth.role() = 'authenticated');

create policy "Staff insert product_categories"
  on public.product_categories for insert
  with check (public.is_staff());

create policy "Staff update product_categories"
  on public.product_categories for update
  using (public.is_staff());

create policy "Staff delete product_categories"
  on public.product_categories for delete
  using (public.is_staff());

create or replace function public.sync_product_category_primary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is null then
    return new;
  end if;
  insert into public.product_categories (product_id, category_id, is_primary)
  values (new.id, new.category_id, true)
  on conflict (product_id, category_id) do update set is_primary = true;
  update public.product_categories
  set is_primary = false
  where product_id = new.id and category_id <> new.category_id;
  return new;
end;
$$;

drop trigger if exists products_sync_primary_category on public.products;
create trigger products_sync_primary_category
  after insert or update of category_id on public.products
  for each row
  execute function public.sync_product_category_primary();
