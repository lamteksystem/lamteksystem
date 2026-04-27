-- Shipments and stock movements: tie orders to fulfilment and inventory.

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  courier text,
  tracking text,
  shipped_at timestamptz default now(),
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_shipments_order on public.shipments(order_id);
create index if not exists idx_shipments_location on public.shipments(location_id);

alter table public.shipments enable row level security;

create policy "Staff manage shipments"
  on public.shipments for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

comment on table public.shipments is 'Physical shipments for orders (per location, with tracking).';

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  quantity_delta int not null,
  reason text not null,
  created_at timestamptz default now()
);

create index if not exists idx_stock_movements_product_loc on public.stock_movements(product_id, location_id);
create index if not exists idx_stock_movements_order on public.stock_movements(order_id);

alter table public.stock_movements enable row level security;

create policy "Staff manage stock_movements"
  on public.stock_movements for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

comment on table public.stock_movements is 'Audit of stock changes per product/location; negative for allocations/shipments, positive for adjustments.';

