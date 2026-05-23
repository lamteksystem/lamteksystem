-- Products may exist without a primary category; remove import-generated categories and keep core taxonomy only.

alter table public.products
  alter column category_id drop not null;

comment on column public.products.category_id is
  'Primary category (optional). Use product_categories for additional assignments; NULL = uncategorised.';

-- Clear primary category on products whose category will be removed, then prune categories.
create or replace function public.prune_imported_categories()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep_names text[] := array[
    'Carcasses',
    'Cornice & Pelmet',
    'Doors',
    'Fittings',
    'Handles',
    'Hinges & Fittings',
    'Lighting',
    'Mouldings',
    'Panels',
    'Plinth',
    'Posts',
    'Shelves & Interiors',
    'Wirework'
  ];
  v_removed_categories bigint := 0;
  v_products_uncategorised bigint := 0;
begin
  if not public.is_staff() then
    raise exception 'Not authorized';
  end if;

  update public.categories set parent_id = null where parent_id is not null;

  update public.orders
  set kitchen_range_id = null
  where kitchen_range_id is not null
    and kitchen_range_id not in (
      select c.id from public.categories c
      where lower(btrim(c.name)) = any (
        select lower(btrim(n)) from unnest(v_keep_names) as n
      )
    );

  with doomed as (
    select c.id
    from public.categories c
    where lower(btrim(c.name)) <> all (
      select lower(btrim(n)) from unnest(v_keep_names) as n
    )
  )
  update public.products p
  set category_id = null
  from doomed d
  where p.category_id = d.id;

  get diagnostics v_products_uncategorised = row_count;

  delete from public.product_categories pc
  using public.categories c
  where pc.category_id = c.id
    and lower(btrim(c.name)) <> all (
      select lower(btrim(n)) from unnest(v_keep_names) as n
    );

  delete from public.categories c
  where lower(btrim(c.name)) <> all (
    select lower(btrim(n)) from unnest(v_keep_names) as n
  );

  get diagnostics v_removed_categories = row_count;

  return jsonb_build_object(
    'removed_categories', v_removed_categories,
    'products_uncategorised', v_products_uncategorised
  );
end;
$$;

revoke all on function public.prune_imported_categories() from public;
grant execute on function public.prune_imported_categories() to authenticated;

-- Allow clearing all categories on a product (uncategorised).
create or replace function public.save_product_categories(
  p_product_id uuid,
  p_category_ids uuid[],
  p_primary_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Not authorized';
  end if;

  if coalesce(array_length(p_category_ids, 1), 0) < 1 then
    delete from public.product_categories where product_id = p_product_id;
    update public.products set category_id = null where id = p_product_id;
    return;
  end if;

  if p_primary_category_id is null or not (p_primary_category_id = any (p_category_ids)) then
    raise exception 'Primary category must be included in the selection';
  end if;

  delete from public.product_categories where product_id = p_product_id;

  insert into public.product_categories (product_id, category_id, is_primary)
  select p_product_id, cid, (cid = p_primary_category_id)
  from unnest(p_category_ids) as cid;

  update public.products
  set category_id = p_primary_category_id
  where id = p_product_id;
end;
$$;
