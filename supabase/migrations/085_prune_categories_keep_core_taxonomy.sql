-- Keep only the core Lamtek product-type categories; remove import/Tealbury/Lamtek range clutter.
-- Safe when products are empty; clears order range links and product_category rows first.

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
  v_deleted bigint := 0;
begin
  -- Detach hierarchy so deletes are not blocked by self-FK.
  update public.categories set parent_id = null where parent_id is not null;

  -- Orders may reference door_range categories we are removing.
  update public.orders
  set kitchen_range_id = null
  where kitchen_range_id is not null
    and kitchen_range_id not in (
      select c.id from public.categories c
      where lower(btrim(c.name)) = any (
        select lower(btrim(n)) from unnest(v_keep_names) as n
      )
    );

  delete from public.product_categories
  where category_id not in (
    select c.id from public.categories c
    where lower(btrim(c.name)) = any (
      select lower(btrim(n)) from unnest(v_keep_names) as n
    )
  );

  delete from public.categories c
  where lower(btrim(c.name)) <> all (
    select lower(btrim(n)) from unnest(v_keep_names) as n
  );

  get diagnostics v_deleted = row_count;
  raise notice 'Pruned categories: removed % row(s); kept % names.', v_deleted, array_length(v_keep_names, 1);
end;
$$;
