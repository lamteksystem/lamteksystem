-- Shared pricelist workbench draft (not live catalogue) + Accessories parent taxonomy.

create table if not exists public.catalogue_workbench_drafts (
  id text primary key default 'global',
  rows jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.catalogue_workbench_drafts is
  'Staged pricelist workbench rows (Tealbury/Lamtek/UFORM) until staff publish to products.';

alter table public.catalogue_workbench_drafts enable row level security;

drop policy if exists "Staff manage catalogue_workbench_drafts" on public.catalogue_workbench_drafts;
create policy "Staff manage catalogue_workbench_drafts"
  on public.catalogue_workbench_drafts for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Ensure Accessories parent + sub-categories (Cutlery Trays, Lighting, Misc).
do $$
declare
  v_accessories_id uuid;
  v_lighting_top uuid;
begin
  select id into v_accessories_id
  from public.categories
  where lower(btrim(name)) = 'accessories'
  limit 1;

  if v_accessories_id is null then
    insert into public.categories (name, slug, sort_order, category_kind)
    values ('Accessories', 'accessories', 45, 'product_type')
    returning id into v_accessories_id;
  end if;

  select id into v_lighting_top
  from public.categories
  where lower(btrim(name)) = 'lighting' and parent_id is null
  limit 1;

  if v_lighting_top is not null then
    update public.categories set parent_id = v_accessories_id where id = v_lighting_top;
  end if;

  insert into public.categories (name, slug, sort_order, category_kind, parent_id)
  select v.name, v.slug, v.sort_order, 'product_type', v_accessories_id
  from (
    values
      ('Cutlery Trays', 'cutlery-trays', 1),
      ('Lighting', 'lighting', 2),
      ('Misc', 'misc', 3)
  ) as v(name, slug, sort_order)
  where not exists (
    select 1 from public.categories c
    where lower(btrim(c.name)) = lower(btrim(v.name))
      and c.parent_id = v_accessories_id
  );
end;
$$;

-- Prune: keep core product types + Accessories tree (no import-generated section categories).
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
