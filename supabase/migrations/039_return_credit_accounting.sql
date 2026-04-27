-- Link approved returns to accounting: automatic credit_note lines per return line.

alter table public.account_transactions
  add column if not exists return_line_id uuid references public.return_lines(id) on delete set null;

comment on column public.account_transactions.return_line_id is 'When set, this credit_note was generated from an approved return line.';

create unique index if not exists uniq_account_tx_return_line_credit
  on public.account_transactions(return_line_id)
  where return_line_id is not null;

create index if not exists idx_account_tx_return_line on public.account_transactions(return_line_id);

-- VAT matches app: total_inc_vat = sum(qty * unit_price) * 1.2 (see src/lib/tax.ts)
create or replace function public.compute_return_line_credit(p public.return_lines)
returns table (credit_amount numeric(12,2), order_id uuid, customer_user_id uuid)
language plpgsql
stable
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
  v_ol public.order_lines%rowtype;
  v_qty numeric(12,4);
  v_have_line boolean := false;
begin
  select * into v_ticket from public.tickets where id = p.ticket_id;
  if not found or v_ticket.type <> 'returns' then
    return;
  end if;

  if p.order_line_id is not null then
    select * into v_ol from public.order_lines where id = p.order_line_id;
    v_have_line := found;
  end if;
  if not v_have_line and v_ticket.order_id is not null and p.product_id is not null then
    select * into v_ol
    from public.order_lines
    where order_id = v_ticket.order_id and product_id = p.product_id
    order by created_at asc
    limit 1;
    v_have_line := found;
  end if;

  if not v_have_line then
    return;
  end if;

  v_qty := least(p.quantity::numeric, coalesce(v_ol.quantity, 0)::numeric);
  if v_qty <= 0 then
    return;
  end if;

  return query
  select
    (-(v_qty * coalesce(v_ol.unit_price, 0) * 1.2))::numeric(12,2),
    v_ol.order_id,
    v_ticket.customer_user_id;
end;
$$;

create or replace function public.sync_return_line_credit_tx()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cred record;
begin
  if tg_op = 'UPDATE' and old.resolution = 'approved' and new.resolution is distinct from 'approved' then
    delete from public.account_transactions
    where return_line_id = new.id and type = 'credit_note';
    return new;
  end if;

  if new.resolution <> 'approved' then
    return new;
  end if;

  select * into v_cred from public.compute_return_line_credit(new);
  if not found then
    return new;
  end if;

  delete from public.account_transactions
  where return_line_id = new.id and type = 'credit_note';

  insert into public.account_transactions (
    customer_user_id,
    type,
    order_id,
    amount,
    reference,
    note,
    return_line_id,
    created_by_staff_id
  )
  values (
    v_cred.customer_user_id,
    'credit_note',
    v_cred.order_id,
    v_cred.credit_amount,
    'RET-' || left(replace(new.id::text, '-', ''), 12),
    'Return credit (approved)' || case when new.reason is not null and length(trim(new.reason)) > 0
      then ': ' || left(trim(new.reason), 200) else '' end,
    new.id,
    null
  );

  return new;
end;
$$;

drop trigger if exists trg_return_line_sync_credit on public.return_lines;
create trigger trg_return_line_sync_credit
after insert or update of resolution, quantity, order_line_id, product_id, ticket_id
on public.return_lines
for each row execute function public.sync_return_line_credit_tx();

create or replace function public.on_return_line_deleted_remove_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.account_transactions where return_line_id = old.id and type = 'credit_note';
  return old;
end;
$$;

drop trigger if exists trg_return_line_deleted_credit on public.return_lines;
create trigger trg_return_line_deleted_credit
before delete on public.return_lines
for each row execute function public.on_return_line_deleted_remove_credit();

grant execute on function public.compute_return_line_credit(public.return_lines) to authenticated;
