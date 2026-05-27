-- Allow catalogue rebuild scripts (service role) to run prune_imported_categories.

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
    'Mouldings',
    'Panels',
    'Plinth',
    'Posts',
    'Shelves & Interiors',
    'Wirework',
    'Accessories',
    'Cutlery Trays',
    'Lighting',
    'Misc'
  ];
  v_removed_categories bigint := 0;
  v_products_uncategorised bigint := 0;
begin
  if not (
    public.is_staff()
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  ) then
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
