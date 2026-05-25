-- Preferred hinge brand for Tealbury complete-unit BOM resolution.

alter table public.orders
  add column if not exists hinge_brand text;

alter table public.orders
  drop constraint if exists orders_hinge_brand_check;

alter table public.orders
  add constraint orders_hinge_brand_check
  check (hinge_brand is null or hinge_brand in ('blum', 'titus', 'hafele'));

comment on column public.orders.hinge_brand is 'Tealbury kitchen: Blum, Titus, or Hafele — used when exploding complete-unit BOM lines.';
