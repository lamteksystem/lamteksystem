-- Accounting automation: keep customer_profiles.balance_outstanding in sync
-- and auto-create invoice/payment statement lines from order status changes.

-- Prevent duplicates per order/type for core lines.
create unique index if not exists uniq_account_tx_order_type
  on public.account_transactions(order_id, type)
  where order_id is not null and type in ('invoice','payment');

create or replace function public.recalc_customer_balance(p_customer_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.customer_profiles
  set balance_outstanding = coalesce((
    select sum(amount)::numeric(12,2)
    from public.account_transactions
    where customer_user_id = p_customer_user_id
  ), 0),
  updated_at = now()
  where user_id = p_customer_user_id;
end;
$$;

-- Recalc on statement line changes
create or replace function public.on_account_tx_changed_recalc_balance()
returns trigger
language plpgsql
security definer
as $$
declare
  uid uuid;
begin
  uid := coalesce(new.customer_user_id, old.customer_user_id);
  if uid is not null then
    perform public.recalc_customer_balance(uid);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_account_tx_recalc_balance on public.account_transactions;
create trigger trg_account_tx_recalc_balance
after insert or update or delete on public.account_transactions
for each row execute function public.on_account_tx_changed_recalc_balance();

-- Auto-create invoice transaction when order becomes invoiced.
create or replace function public.on_order_invoiced_create_invoice_tx()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'invoiced' and (old.status is null or old.status <> 'invoiced') then
    insert into public.account_transactions (customer_user_id, type, order_id, amount, reference, note, created_by_staff_id)
    values (
      new.user_id,
      'invoice',
      new.id,
      coalesce(new.total_inc_vat, 0),
      new.invoice_number,
      'Invoice created from order status change',
      null
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_invoiced_create_invoice_tx on public.orders;
create trigger trg_order_invoiced_create_invoice_tx
after update on public.orders
for each row execute function public.on_order_invoiced_create_invoice_tx();

-- Auto-create payment transaction when order becomes paid.
create or replace function public.on_order_paid_create_payment_tx()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'paid' and (old.status is null or old.status <> 'paid') then
    insert into public.account_transactions (customer_user_id, type, order_id, amount, reference, note, created_by_staff_id)
    values (
      new.user_id,
      'payment',
      new.id,
      -coalesce(new.total_inc_vat, 0),
      coalesce(new.payment_intent_id, new.invoice_number),
      'Payment recorded from order status change',
      null
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_paid_create_payment_tx on public.orders;
create trigger trg_order_paid_create_payment_tx
after update on public.orders
for each row execute function public.on_order_paid_create_payment_tx();

