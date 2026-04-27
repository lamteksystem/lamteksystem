-- Suppliers (for ordering, contacts). Staff-managed.
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_suppliers_user_id on public.suppliers(user_id);
alter table public.suppliers enable row level security;

create policy "Staff manage suppliers"
  on public.suppliers for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Cost price and stock on products (for staff ordering, stock takes)
alter table public.products
  add column if not exists cost_price numeric(12,2),
  add column if not exists stock_quantity int default 0;

comment on column public.products.cost_price is 'Cost price (staff only).';
comment on column public.products.stock_quantity is 'Current stock level for stock takes.';
