-- Accounting: customer account transactions, running statement, and staff-only management.

create table if not exists public.account_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('invoice','payment','credit_note','adjustment')),
  order_id uuid references public.orders(id) on delete set null,
  amount numeric(12,2) not null,
  reference text,
  note text,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_account_tx_customer on public.account_transactions(customer_user_id);
create index if not exists idx_account_tx_order on public.account_transactions(order_id);
create index if not exists idx_account_tx_created on public.account_transactions(created_at desc);

alter table public.account_transactions enable row level security;

-- Customers: read only their own transactions
drop policy if exists "Customers read own account_transactions" on public.account_transactions;
create policy "Customers read own account_transactions"
  on public.account_transactions for select to authenticated
  using (auth.uid() = customer_user_id);

-- Staff: manage all
drop policy if exists "Staff manage account_transactions" on public.account_transactions;
create policy "Staff manage account_transactions"
  on public.account_transactions for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

comment on table public.account_transactions is 'Accounting statement lines: invoices, payments, credit notes, and adjustments.';

