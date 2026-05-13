-- Foundational warehouse execution structures: pick lists, line picks, package labels.

create table if not exists public.pick_lists (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  status text not null default 'generated' check (status in ('generated', 'picking', 'picked', 'cancelled')),
  generated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pick_lists_order on public.pick_lists(order_id, created_at desc);
create index if not exists idx_pick_lists_status on public.pick_lists(status);
create unique index if not exists uq_pick_lists_active_order
  on public.pick_lists(order_id)
  where status in ('generated', 'picking');

create table if not exists public.pick_list_items (
  id uuid primary key default gen_random_uuid(),
  pick_list_id uuid not null references public.pick_lists(id) on delete cascade,
  order_line_id uuid references public.order_lines(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  required_qty int not null check (required_qty > 0),
  picked_qty int not null default 0 check (picked_qty >= 0 and picked_qty <= required_qty),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pick_list_items_pick_list on public.pick_list_items(pick_list_id);
create index if not exists idx_pick_list_items_product on public.pick_list_items(product_id);

create table if not exists public.package_labels (
  id uuid primary key default gen_random_uuid(),
  package_code text not null unique,
  pick_list_id uuid references public.pick_lists(id) on delete set null,
  order_id uuid not null references public.orders(id) on delete cascade,
  printed boolean not null default false,
  scanned boolean not null default false,
  printed_at timestamptz,
  scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_package_labels_pick_list on public.package_labels(pick_list_id);
create index if not exists idx_package_labels_order on public.package_labels(order_id);

alter table public.pick_lists enable row level security;
alter table public.pick_list_items enable row level security;
alter table public.package_labels enable row level security;

create policy "Staff manage pick_lists"
  on public.pick_lists for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Staff manage pick_list_items"
  on public.pick_list_items for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Staff manage package_labels"
  on public.package_labels for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
