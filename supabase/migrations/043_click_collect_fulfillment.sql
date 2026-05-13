-- Click & Collect MVP: fulfillment fields on orders.
alter table public.orders
  add column if not exists fulfillment_method text not null default 'delivery' check (fulfillment_method in ('delivery','collect')),
  add column if not exists collection_location_id uuid references public.locations(id) on delete set null,
  add column if not exists collection_ready_at timestamptz,
  add column if not exists collection_must_collect_by timestamptz,
  add column if not exists collection_notes text;

create index if not exists idx_orders_collection_location_id on public.orders(collection_location_id);
create index if not exists idx_orders_fulfillment_method on public.orders(fulfillment_method);

comment on column public.orders.fulfillment_method is 'Order fulfillment mode: delivery or click-and-collect.';
comment on column public.orders.collection_location_id is 'Selected collection depot when fulfillment_method is collect.';
comment on column public.orders.collection_ready_at is 'When order is ready for depot collection.';
comment on column public.orders.collection_must_collect_by is 'Collection deadline shown to customer.';
comment on column public.orders.collection_notes is 'Collection-specific notes (pickup contact, vehicle, instructions).';

-- Backfill from current data: if an order only has collection-style project metadata,
-- keep default as delivery for safety; explicit collect should be set by UI.
