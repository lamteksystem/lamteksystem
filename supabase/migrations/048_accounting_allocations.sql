-- Allocation model for partial/multi-invoice settlement.

create table if not exists public.account_allocations (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  invoice_transaction_id uuid not null references public.account_transactions(id) on delete restrict,
  settlement_transaction_id uuid not null references public.account_transactions(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_allocations_invoice_ne_settlement_chk check (invoice_transaction_id <> settlement_transaction_id)
);

create unique index if not exists uniq_account_alloc_pair
  on public.account_allocations(invoice_transaction_id, settlement_transaction_id);
create index if not exists idx_account_alloc_customer on public.account_allocations(customer_user_id);
create index if not exists idx_account_alloc_invoice on public.account_allocations(invoice_transaction_id);
create index if not exists idx_account_alloc_settlement on public.account_allocations(settlement_transaction_id);

alter table public.account_allocations enable row level security;

drop policy if exists "Customers read own account_allocations" on public.account_allocations;
create policy "Customers read own account_allocations"
  on public.account_allocations for select to authenticated
  using (auth.uid() = customer_user_id);

drop policy if exists "Staff manage account_allocations" on public.account_allocations;
create policy "Staff manage account_allocations"
  on public.account_allocations for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create or replace function public.account_transaction_allocated_amount(p_transaction_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce((
    select sum(a.amount)
    from public.account_allocations a
    where a.invoice_transaction_id = p_transaction_id
       or a.settlement_transaction_id = p_transaction_id
  ), 0)::numeric(12,2)
$$;

create or replace function public.account_transaction_remaining_amount(p_transaction_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tx public.account_transactions%rowtype;
  v_allocated numeric(12,2);
begin
  select * into v_tx from public.account_transactions where id = p_transaction_id;
  if not found then
    raise exception 'Transaction not found.';
  end if;

  v_allocated := public.account_transaction_allocated_amount(p_transaction_id);

  if v_tx.type = 'invoice' then
    return greatest(v_tx.amount - v_allocated, 0)::numeric(12,2);
  end if;

  return greatest(abs(v_tx.amount) - v_allocated, 0)::numeric(12,2);
end;
$$;

create or replace function public.allocate_account_transaction(
  p_invoice_transaction_id uuid,
  p_settlement_transaction_id uuid,
  p_amount numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.account_transactions%rowtype;
  v_settlement public.account_transactions%rowtype;
  v_staff_id uuid;
  v_invoice_open numeric(12,2);
  v_settlement_open numeric(12,2);
  v_alloc_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Allocation amount must be greater than zero.';
  end if;

  select * into v_invoice
  from public.account_transactions
  where id = p_invoice_transaction_id;

  if not found then
    raise exception 'Invoice transaction not found.';
  end if;

  select * into v_settlement
  from public.account_transactions
  where id = p_settlement_transaction_id;

  if not found then
    raise exception 'Settlement transaction not found.';
  end if;

  if v_invoice.customer_user_id <> v_settlement.customer_user_id then
    raise exception 'Transactions belong to different customers.';
  end if;

  if v_invoice.type <> 'invoice' then
    raise exception 'Invoice side must be an invoice transaction.';
  end if;

  if not (v_settlement.type in ('payment', 'credit_note', 'adjustment') and v_settlement.amount < 0) then
    raise exception 'Settlement side must be a negative payment/credit/adjustment transaction.';
  end if;

  select sp.id into v_staff_id
  from public.staff_profiles sp
  where sp.user_id = auth.uid();

  if v_staff_id is null then
    raise exception 'Only staff can allocate transactions.';
  end if;

  v_invoice_open := public.account_transaction_remaining_amount(v_invoice.id);
  v_settlement_open := public.account_transaction_remaining_amount(v_settlement.id);

  if p_amount > v_invoice_open then
    raise exception 'Allocation exceeds remaining invoice amount (remaining: %).', v_invoice_open;
  end if;

  if p_amount > v_settlement_open then
    raise exception 'Allocation exceeds unapplied settlement amount (remaining: %).', v_settlement_open;
  end if;

  insert into public.account_allocations (
    customer_user_id,
    invoice_transaction_id,
    settlement_transaction_id,
    amount,
    note,
    created_by_staff_id,
    updated_at
  )
  values (
    v_invoice.customer_user_id,
    v_invoice.id,
    v_settlement.id,
    p_amount,
    nullif(btrim(coalesce(p_note, '')), ''),
    v_staff_id,
    now()
  )
  returning id into v_alloc_id;

  return v_alloc_id;
end;
$$;

grant execute on function public.allocate_account_transaction(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.account_transaction_remaining_amount(uuid) to authenticated;

create or replace view public.v_account_transaction_balances as
select
  t.id,
  t.customer_user_id,
  t.type,
  t.order_id,
  t.amount,
  t.reference,
  t.note,
  t.source,
  t.created_at,
  t.reversed_by_transaction_id,
  t.reversal_of_transaction_id,
  public.account_transaction_allocated_amount(t.id) as allocated_amount,
  public.account_transaction_remaining_amount(t.id) as remaining_amount
from public.account_transactions t;

comment on table public.account_allocations is 'Maps settlement transactions (payments/credits) to invoices for reconciliation.';
comment on view public.v_account_transaction_balances is 'Ledger rows with allocated and remaining amounts for AR workflows.';
