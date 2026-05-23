-- One-time: remove import-generated categories; keep core taxonomy (same list as 085/086).

do $$
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
  raise notice 'Pruned % categories; % products uncategorised.', v_removed_categories, v_products_uncategorised;
end;
$$;
