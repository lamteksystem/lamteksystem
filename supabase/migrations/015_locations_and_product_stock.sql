-- Multi-location: depots/warehouses. Staff-managed.
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  address text,
  active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_locations_active on public.locations(active);
alter table public.locations enable row level security;

create policy "Staff manage locations"
  on public.locations for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Stock per product per location (source of truth for multi-location)
create table if not exists public.product_stock (
  product_id uuid not null references public.products(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  updated_at timestamptz default now(),
  primary key (product_id, location_id)
);

create index if not exists idx_product_stock_location on public.product_stock(location_id);
alter table public.product_stock enable row level security;

create policy "Staff manage product_stock"
  on public.product_stock for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Keep products.stock_quantity in sync as total across all locations (for legacy/reporting)
create or replace function public.sync_product_stock_total()
returns trigger as $$
begin
  update public.products
  set stock_quantity = (
    select coalesce(sum(ps.quantity), 0)
    from public.product_stock ps
    where ps.product_id = coalesce(NEW.product_id, OLD.product_id)
  )
  where id = coalesce(NEW.product_id, OLD.product_id);
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

drop trigger if exists sync_product_stock_total_trigger on public.product_stock;
create trigger sync_product_stock_total_trigger
  after insert or update or delete on public.product_stock
  for each row execute function public.sync_product_stock_total();

-- Backfill: create default location; trigger will create product_stock rows (0) for all products
insert into public.locations (id, name, code, sort_order)
select gen_random_uuid(), 'Main Warehouse', 'MAIN', 0
where not exists (select 1 from public.locations limit 1);

-- Ensure every product has a row for the default location (idempotent)
insert into public.product_stock (product_id, location_id, quantity, updated_at)
select p.id, l.id, coalesce(p.stock_quantity, 0), now()
from public.products p
cross join (select id from public.locations order by sort_order, created_at limit 1) l
where not exists (select 1 from public.product_stock ps where ps.product_id = p.id and ps.location_id = l.id);

-- Sync quantity from products into default location (backfill)
update public.product_stock ps
set quantity = p.stock_quantity, updated_at = now()
from public.products p
where ps.product_id = p.id
  and ps.location_id = (select id from public.locations order by sort_order, created_at limit 1);

-- Realtime: allow clients to subscribe to product_stock changes
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_stock'
  ) then
    alter publication supabase_realtime add table public.product_stock;
  end if;
end $$;

-- When a new product is created, create product_stock rows (0 qty) for all locations
create or replace function public.product_stock_new_product()
returns trigger as $$
begin
  insert into public.product_stock (product_id, location_id, quantity)
  select NEW.id, id, 0 from public.locations where active = true;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists product_stock_new_product_trigger on public.products;
create trigger product_stock_new_product_trigger
  after insert on public.products
  for each row execute function public.product_stock_new_product();

-- When a new location is created, create product_stock rows (0 qty) for all products
create or replace function public.product_stock_new_location()
returns trigger as $$
begin
  insert into public.product_stock (product_id, location_id, quantity)
  select id, NEW.id, 0 from public.products;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists product_stock_new_location_trigger on public.locations;
create trigger product_stock_new_location_trigger
  after insert on public.locations
  for each row execute function public.product_stock_new_location();

comment on table public.locations is 'Depots/warehouses for multi-location stock.';
comment on table public.product_stock is 'Stock quantity per product per location; products.stock_quantity is synced as total.';
