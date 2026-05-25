-- Category type ordering behaviour + Tealbury quote/order setup fields on orders.

alter table public.category_types
  add column if not exists ordering_behaviour text not null default 'standard';

alter table public.category_types
  drop constraint if exists category_types_ordering_behaviour_check;

alter table public.category_types
  add constraint category_types_ordering_behaviour_check
  check (ordering_behaviour in ('standard', 'tealbury_complete', 'component_only', 'accessory'));

comment on column public.category_types.ordering_behaviour is
  'How quotes/orders treat products in categories of this type: standard search, Tealbury Complete BOM, components-only, or accessories.';

insert into public.category_types (code, label, description, sort_order, browse_mode, ordering_behaviour, is_system) values
  (
    'tealbury_complete',
    'Tealbury Complete',
    'Sellable kitchen units made from carcass, doors, hinges, fittings, and legs (BOM on the product).',
    15,
    'product',
    'tealbury_complete',
    false
  )
on conflict (code) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  browse_mode = excluded.browse_mode,
  ordering_behaviour = excluded.ordering_behaviour;

alter table public.orders
  add column if not exists build_style text;

alter table public.orders
  add column if not exists line_style_preference text;

alter table public.orders
  drop constraint if exists orders_build_style_check;

alter table public.orders
  add constraint orders_build_style_check
  check (build_style is null or build_style in ('flat_pack', 'rigid'));

alter table public.orders
  drop constraint if exists orders_line_style_preference_check;

alter table public.orders
  add constraint orders_line_style_preference_check
  check (line_style_preference is null or line_style_preference in ('high_line', 'drawer_line', 'mixed'));

comment on column public.orders.build_style is 'Tealbury kitchen: flat_pack (unassembled) or rigid (factory built).';
comment on column public.orders.line_style_preference is 'Predominant kitchen line style for browsing: high_line, drawer_line, or mixed.';
