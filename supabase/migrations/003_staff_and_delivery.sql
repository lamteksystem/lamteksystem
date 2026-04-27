-- Staff backend: staff profiles, order delivery/processing fields, RLS for staff

-- Staff profiles (Trade Mouldings staff who can use the admin backend)
create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  role text not null default 'staff' check (role in ('admin','staff')),
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.staff_profiles enable row level security;

-- Only staff can read staff_profiles (so we use a secure function for RLS elsewhere)
create policy "Staff read staff_profiles" on public.staff_profiles
  for select using (auth.uid() = user_id);

-- Helper: true if current user is staff (used in RLS)
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from public.staff_profiles where user_id = auth.uid());
$$;

-- Delivery and processing fields on orders
alter table public.orders
  add column if not exists delivery_address text,
  add column if not exists delivery_postcode text,
  add column if not exists delivery_notes text,
  add column if not exists processed_at timestamptz,
  add column if not exists delivery_tracking text,
  add column if not exists created_by_staff_id uuid references public.staff_profiles(id);

-- Staff: can select/insert/update all orders (e.g. create order for customer, amend, process)
create policy "Staff read all orders" on public.orders
  for select using (public.is_staff());

create policy "Staff insert orders" on public.orders
  for insert with check (public.is_staff());

create policy "Staff update orders" on public.orders
  for update using (public.is_staff());

-- Staff: can select/insert/update/delete all order_lines (amend orders)
create policy "Staff read all order lines" on public.order_lines
  for select using (public.is_staff());

create policy "Staff insert order lines" on public.order_lines
  for insert with check (public.is_staff());

create policy "Staff update order lines" on public.order_lines
  for update using (public.is_staff());

create policy "Staff delete order lines" on public.order_lines
  for delete using (public.is_staff());

-- Staff: can read and update customer_profiles (e.g. balance, company name)
create policy "Staff read customer_profiles" on public.customer_profiles
  for select using (public.is_staff());

create policy "Staff update customer_profiles" on public.customer_profiles
  for update using (public.is_staff());

-- Staff can create customer_profiles for new users (e.g. when onboarding)
create policy "Staff insert customer_profiles" on public.customer_profiles
  for insert with check (public.is_staff());

-- Staff: read categories and products (same as authenticated)
-- Already covered by authenticated read; staff are authenticated.

-- Optional: staff read documents
-- Already covered by authenticated read.
