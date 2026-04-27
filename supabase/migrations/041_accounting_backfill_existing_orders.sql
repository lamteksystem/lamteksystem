-- Backfill accounting transactions for existing orders so balances reflect reality.
-- Creates missing invoice/payment lines for historical rows and then recalculates balances.

insert into public.account_transactions (customer_user_id, type, order_id, amount, reference, note, created_by_staff_id)
select
  o.user_id,
  'invoice',
  o.id,
  coalesce(o.total_inc_vat, 0),
  o.invoice_number,
  'Backfill invoice transaction from historical order status',
  null
from public.orders o
where o.status in ('invoiced', 'paid')
  and not exists (
    select 1
    from public.account_transactions t
    where t.order_id = o.id and t.type = 'invoice'
  );

insert into public.account_transactions (customer_user_id, type, order_id, amount, reference, note, created_by_staff_id)
select
  o.user_id,
  'payment',
  o.id,
  -coalesce(o.total_inc_vat, 0),
  coalesce(o.payment_intent_id, o.invoice_number),
  'Backfill payment transaction from historical paid order',
  null
from public.orders o
where o.status = 'paid'
  and not exists (
    select 1
    from public.account_transactions t
    where t.order_id = o.id and t.type = 'payment'
  );

do $$
declare
  r record;
begin
  for r in
    select distinct customer_user_id
    from public.account_transactions
  loop
    perform public.recalc_customer_balance(r.customer_user_id);
  end loop;
end;
$$;

