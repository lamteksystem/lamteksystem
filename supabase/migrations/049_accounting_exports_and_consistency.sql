-- Accounting operational read models: aging, statements, and consistency checks.

create or replace view public.v_account_open_invoices as
select
  t.customer_user_id,
  t.id as invoice_transaction_id,
  t.order_id,
  t.reference,
  t.created_at,
  t.amount as invoice_amount,
  public.account_transaction_allocated_amount(t.id) as allocated_amount,
  public.account_transaction_remaining_amount(t.id) as remaining_amount,
  greatest(extract(day from now() - t.created_at)::int, 0) as age_days
from public.account_transactions t
where t.type = 'invoice'
  and t.reversal_of_transaction_id is null
  and t.reversed_by_transaction_id is null
  and public.account_transaction_remaining_amount(t.id) > 0;

create or replace view public.v_account_unapplied_settlements as
select
  t.customer_user_id,
  t.id as settlement_transaction_id,
  t.type,
  t.order_id,
  t.reference,
  t.created_at,
  abs(t.amount) as settlement_amount,
  public.account_transaction_allocated_amount(t.id) as allocated_amount,
  public.account_transaction_remaining_amount(t.id) as remaining_amount
from public.account_transactions t
where t.type in ('payment','credit_note','adjustment')
  and t.amount < 0
  and t.reversal_of_transaction_id is null
  and t.reversed_by_transaction_id is null
  and public.account_transaction_remaining_amount(t.id) > 0;

create or replace function public.account_customer_aging_buckets(p_customer_user_id uuid)
returns table (
  current_amount numeric,
  d30_amount numeric,
  d60_amount numeric,
  d90_amount numeric
)
language sql
stable
set search_path = public
as $$
  with rows as (
    select age_days, remaining_amount
    from public.v_account_open_invoices
    where customer_user_id = p_customer_user_id
  )
  select
    coalesce(sum(case when age_days <= 30 then remaining_amount else 0 end), 0)::numeric(12,2) as current_amount,
    coalesce(sum(case when age_days between 31 and 60 then remaining_amount else 0 end), 0)::numeric(12,2) as d30_amount,
    coalesce(sum(case when age_days between 61 and 90 then remaining_amount else 0 end), 0)::numeric(12,2) as d60_amount,
    coalesce(sum(case when age_days > 90 then remaining_amount else 0 end), 0)::numeric(12,2) as d90_amount
  from rows;
$$;

grant execute on function public.account_customer_aging_buckets(uuid) to authenticated;

create or replace function public.accounting_consistency_report()
returns table (
  customer_user_id uuid,
  profile_balance numeric,
  ledger_balance numeric,
  delta numeric
)
language sql
security definer
set search_path = public
as $$
  select
    cp.user_id as customer_user_id,
    coalesce(cp.balance_outstanding, 0)::numeric(12,2) as profile_balance,
    coalesce(sum(t.amount), 0)::numeric(12,2) as ledger_balance,
    (coalesce(cp.balance_outstanding, 0) - coalesce(sum(t.amount), 0))::numeric(12,2) as delta
  from public.customer_profiles cp
  left join public.account_transactions t
    on t.customer_user_id = cp.user_id
  group by cp.user_id, cp.balance_outstanding
  having abs(coalesce(cp.balance_outstanding, 0) - coalesce(sum(t.amount), 0)) > 0.01
  order by abs(coalesce(cp.balance_outstanding, 0) - coalesce(sum(t.amount), 0)) desc;
$$;

grant execute on function public.accounting_consistency_report() to authenticated;

comment on function public.accounting_consistency_report() is 'Operational check for profile balance vs ledger total mismatches.';
