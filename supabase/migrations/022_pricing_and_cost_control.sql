-- Comprehensive customer pricing and cost price control system.
-- Segments: customer group, location, trade type, company type.
-- Rules: customer price rules (promotions, segment-based pricing), cost price rules (supplier/category/product).

-- ========== Customer segment dimensions (lookup tables) ==========
create table if not exists public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customer_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  code text,
  description text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.trade_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.company_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: staff manage all segment tables
alter table public.customer_groups enable row level security;
alter table public.customer_locations enable row level security;
alter table public.trade_types enable row level security;
alter table public.company_types enable row level security;

create policy "Staff manage customer_groups" on public.customer_groups for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff manage customer_locations" on public.customer_locations for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff manage trade_types" on public.trade_types for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff manage company_types" on public.company_types for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Authenticated read for price resolution (customer sees own effective price via app logic)
create policy "Authenticated read customer_groups" on public.customer_groups for select to authenticated using (true);
create policy "Authenticated read customer_locations" on public.customer_locations for select to authenticated using (true);
create policy "Authenticated read trade_types" on public.trade_types for select to authenticated using (true);
create policy "Authenticated read company_types" on public.company_types for select to authenticated using (true);

-- ========== Link customers to segments ==========
alter table public.customer_profiles
  add column if not exists customer_group_id uuid references public.customer_groups(id) on delete set null,
  add column if not exists customer_location_id uuid references public.customer_locations(id) on delete set null,
  add column if not exists trade_type_id uuid references public.trade_types(id) on delete set null,
  add column if not exists company_type_id uuid references public.company_types(id) on delete set null;

comment on column public.customer_profiles.customer_group_id is 'Pricing segment: e.g. Retail, Trade, VIP';
comment on column public.customer_profiles.customer_location_id is 'Pricing segment: region or area';
comment on column public.customer_profiles.trade_type_id is 'Pricing segment: e.g. Kitchen Fitter, Kitchen Retailer';
comment on column public.customer_profiles.company_type_id is 'Pricing segment: e.g. Ltd, Sole Trader';

-- ========== Collections (e.g. "XYZ Kitchen range" for promotions) ==========
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order int default 0,
  primary key (collection_id, product_id)
);

alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
create policy "Staff manage collections" on public.collections for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff manage collection_products" on public.collection_products for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Authenticated read collections" on public.collections for select to authenticated using (true);
create policy "Authenticated read collection_products" on public.collection_products for select to authenticated using (true);

-- ========== Customer price rules (promotions, segment-based pricing) ==========
-- Who: customer_group_id, customer_location_id, trade_type_id, company_type_id (null = any)
-- What: scope_type all|category|product|collection + scope_id
-- How: percentage_discount, percentage_markup, fixed_price_override
-- When: valid_from, valid_to (null = no limit), min_order_total_ex_vat
create table if not exists public.customer_price_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- Segment (all null = rule applies to everyone)
  customer_group_id uuid references public.customer_groups(id) on delete set null,
  customer_location_id uuid references public.customer_locations(id) on delete set null,
  trade_type_id uuid references public.trade_types(id) on delete set null,
  company_type_id uuid references public.company_types(id) on delete set null,
  -- Product scope: one of scope_* set
  scope_type text not null default 'all' check (scope_type in ('all','category','product','collection')),
  scope_category_id uuid references public.categories(id) on delete cascade,
  scope_product_id uuid references public.products(id) on delete cascade,
  scope_collection_id uuid references public.collections(id) on delete cascade,
  -- Rule effect
  rule_type text not null check (rule_type in ('percentage_discount','percentage_markup','fixed_price_override')),
  value numeric(12,4) not null,
  -- Promotion constraints
  min_order_total_ex_vat numeric(12,2),
  valid_from timestamptz,
  valid_to timestamptz,
  -- Order of evaluation (higher = applied first when multiple match)
  priority int not null default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint customer_price_rule_scope_check check (
    (scope_type = 'all') or
    (scope_type = 'category' and scope_category_id is not null) or
    (scope_type = 'product' and scope_product_id is not null) or
    (scope_type = 'collection' and scope_collection_id is not null)
  )
);

create index if not exists idx_customer_price_rules_active on public.customer_price_rules(active);
create index if not exists idx_customer_price_rules_valid on public.customer_price_rules(valid_from, valid_to);
alter table public.customer_price_rules enable row level security;
create policy "Staff manage customer_price_rules" on public.customer_price_rules for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Authenticated read customer_price_rules" on public.customer_price_rules for select to authenticated using (true);

-- ========== Cost price rules (supplier / category / product / time) ==========
create table if not exists public.cost_price_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  scope_type text not null default 'all' check (scope_type in ('all','category','product')),
  scope_category_id uuid references public.categories(id) on delete cascade,
  scope_product_id uuid references public.products(id) on delete cascade,
  rule_type text not null check (rule_type in ('fixed_cost','percentage_of_sell','markup_on_cost')),
  value numeric(12,4) not null,
  valid_from timestamptz,
  valid_to timestamptz,
  priority int not null default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint cost_price_rule_scope_check check (
    (scope_type = 'all') or
    (scope_type = 'category' and scope_category_id is not null) or
    (scope_type = 'product' and scope_product_id is not null)
  )
);

create index if not exists idx_cost_price_rules_active on public.cost_price_rules(active);
alter table public.cost_price_rules enable row level security;
create policy "Staff manage cost_price_rules" on public.cost_price_rules for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff read cost_price_rules" on public.cost_price_rules for select to authenticated using (public.is_staff());

-- ========== Seed default segment options ==========
insert into public.customer_groups (name, slug, sort_order) values
  ('Retail', 'retail', 10),
  ('Trade', 'trade', 20),
  ('VIP', 'vip', 30)
on conflict (slug) do nothing;

insert into public.customer_locations (name, slug, code, sort_order) values
  ('National', 'national', 'GB', 0),
  ('North West', 'north-west', 'NW', 10),
  ('North East', 'north-east', 'NE', 20),
  ('Midlands', 'midlands', 'MID', 30),
  ('South East', 'south-east', 'SE', 40),
  ('South West', 'south-west', 'SW', 50),
  ('Scotland', 'scotland', 'SCO', 60),
  ('Wales', 'wales', 'WAL', 70)
on conflict (slug) do nothing;

insert into public.trade_types (name, slug, sort_order) values
  ('Kitchen Fitter', 'kitchen-fitter', 10),
  ('Kitchen Retailer', 'kitchen-retailer', 20),
  ('Builder', 'builder', 30),
  ('Contractor', 'contractor', 40),
  ('Other', 'other', 100)
on conflict (slug) do nothing;

insert into public.company_types (name, slug, sort_order) values
  ('Ltd', 'ltd', 10),
  ('Sole Trader', 'sole-trader', 20),
  ('Partnership', 'partnership', 30),
  ('PLC', 'plc', 40),
  ('Other', 'other', 100)
on conflict (slug) do nothing;
