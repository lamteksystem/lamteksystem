-- Accounting ops tooling: idempotent backfill/rebuild helpers.

create or replace function public.run_accounting_backfill(p_customer_user_id uuid default null)
returns table (
  inserted_invoices int,
  inserted_payments int,
  recalced_customers int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted_invoices int := 0;
  v_inserted_payments int := 0;
  v_recalced_customers int := 0;
  r record;
begin
  if not public.is_staff() then
    raise exception 'Only staff can run accounting backfill.';
  end if;

  insert into public.account_transactions (
    customer_user_id,
    type,
    order_id,
    amount,
    reference,
    note,
    created_by_staff_id,
    source
  )
  select
    o.user_id,
    'invoice',
    o.id,
    coalesce(o.total_inc_vat, 0),
    o.invoice_number,
    'Ops backfill invoice transaction from order status',
    null,
    'backfill'
  from public.orders o
  where o.status in ('invoiced', 'paid')
    and (p_customer_user_id is null or o.user_id = p_customer_user_id)
    and not exists (
      select 1
      from public.account_transactions t
      where t.order_id = o.id and t.type = 'invoice'
    );
  get diagnostics v_inserted_invoices = row_count;

  insert into public.account_transactions (
    customer_user_id,
    type,
    order_id,
    amount,
    reference,
    note,
    created_by_staff_id,
    source
  )
  select
    o.user_id,
    'payment',
    o.id,
    -coalesce(o.total_inc_vat, 0),
    coalesce(o.payment_intent_id, o.invoice_number),
    'Ops backfill payment transaction from paid order status',
    null,
    'backfill'
  from public.orders o
  where o.status = 'paid'
    and (p_customer_user_id is null or o.user_id = p_customer_user_id)
    and not exists (
      select 1
      from public.account_transactions t
      where t.order_id = o.id and t.type = 'payment'
    );
  get diagnostics v_inserted_payments = row_count;

  for r in
    select distinct t.customer_user_id
    from public.account_transactions t
    where p_customer_user_id is null or t.customer_user_id = p_customer_user_id
  loop
    perform public.recalc_customer_balance(r.customer_user_id);
    v_recalced_customers := v_recalced_customers + 1;
  end loop;

  return query
  select v_inserted_invoices, v_inserted_payments, v_recalced_customers;
end;
$$;

grant execute on function public.run_accounting_backfill(uuid) to authenticated;

comment on function public.run_accounting_backfill(uuid)
is 'Staff-only idempotent backfill and balance recalc for one customer or all customers.';
