-- Category taxonomy: product types vs door ranges vs cross-range universal groups.
alter table public.categories
  add column if not exists category_kind text not null default 'product_type';

alter table public.categories
  drop constraint if exists categories_category_kind_check;

alter table public.categories
  add constraint categories_category_kind_check
  check (category_kind in ('product_type', 'door_range', 'universal'));

comment on column public.categories.category_kind is
  'product_type=Doors/Units/Handles; door_range=Oakham/Dawson kitchen families; universal=Wirework/Accessories usable with any range.';

-- Heuristic backfill for common cross-range groups.
update public.categories
set category_kind = 'universal'
where category_kind = 'product_type'
  and (
    lower(name) ~ '(wirework|accessor|drawer box|drawer boxes|hinge|fitting|plinth|cornice|pelmet|worktop|internal|orgatray|cutlery|cabinet|base unit|wall unit|tall unit|carcass|unit)'
    or lower(slug) ~ '(wirework|accessor|drawer|hinge|fitting|plinth|worktop|internal|cutlery|cabinet|unit)'
  );
