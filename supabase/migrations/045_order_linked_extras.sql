-- Linked orders for extras/replacements/samples.
alter table public.orders
  add column if not exists parent_order_id uuid references public.orders(id) on delete set null,
  add column if not exists link_reason text check (link_reason in ('extras','replacement','samples','goodwill','other'));

create index if not exists idx_orders_parent_order_id on public.orders(parent_order_id);

comment on column public.orders.parent_order_id is 'Links this order to an originating parent order (e.g. extras).';
comment on column public.orders.link_reason is 'Reason for linked order relationship.';
