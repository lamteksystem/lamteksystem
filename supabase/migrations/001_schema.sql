-- Trade Mouldings schema (run in Supabase SQL editor)

-- Customer profiles (extends auth.users)
create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  company_name text not null,
  contact_name text,
  balance_outstanding numeric(12,2) default 0,
  updated_at timestamptz default now()
);

-- Categories (e.g. Doors, Units, Handles, Lighting)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int default 0,
  parent_id uuid references public.categories(id)
);

-- Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) not null,
  name text not null,
  description text,
  sku text,
  unit_price numeric(12,2) not null,
  image_url text,
  image_alt text,
  options jsonb default '{}',
  active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Documents (brochures, technical, pricelists)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_path text not null,
  file_type text not null,
  category text not null check (category in ('brochure','technical','pricelist','other')),
  created_at timestamptz default now()
);

-- Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete restrict not null,
  status text not null default 'draft' check (status in ('draft','quotation','placed','invoiced','paid','cancelled')),
  total_ex_vat numeric(12,2) default 0,
  total_inc_vat numeric(12,2) default 0,
  reference text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Order lines
create table if not exists public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id),
  product_snapshot jsonb not null,
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null,
  options jsonb default '{}'
);

-- RLS
alter table public.customer_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.documents enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;

-- Customers see only their profile
create policy "Users read own profile" on public.customer_profiles
  for select using (auth.uid() = user_id);

-- Categories and products: all authenticated users can read
create policy "Authenticated read categories" on public.categories
  for select using (auth.role() = 'authenticated');

create policy "Authenticated read products" on public.products
  for select using (auth.role() = 'authenticated');

-- Documents: all authenticated can read
create policy "Authenticated read documents" on public.documents
  for select using (auth.role() = 'authenticated');

-- Orders: user sees own orders
create policy "Users read own orders" on public.orders
  for select using (auth.uid() = user_id);
create policy "Users insert own orders" on public.orders
  for insert with check (auth.uid() = user_id);
create policy "Users update own orders" on public.orders
  for update using (auth.uid() = user_id);

-- Order lines: via order ownership
create policy "Users read own order lines" on public.order_lines
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );
create policy "Users insert own order lines" on public.order_lines
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );
create policy "Users update own order lines" on public.order_lines
  for update using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );
create policy "Users delete own order lines" on public.order_lines
  for delete using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- Trigger to create profile on signup (optional; or create via app)
-- Storage bucket for documents and product images: create in Supabase dashboard
-- e.g. buckets: documents, product-images (public read for product images)
