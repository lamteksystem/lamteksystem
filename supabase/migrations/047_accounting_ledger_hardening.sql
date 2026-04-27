-- Ledger hardening: constraints, immutability, and safe reversal workflow.

alter table public.account_transactions
  add column if not exists source text not null default 'manual'
    check (source in ('manual','order_status','payment_gateway','return','allocation','backfill','reversal','system')),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists posted_at timestamptz not null default now(),
  add column if not exists reversal_of_transaction_id uuid references public.account_transactions(id) on delete set null,
  add column if not exists reversed_by_transaction_id uuid references public.account_transactions(id) on delete set null;

create index if not exists idx_account_tx_reversal_of on public.account_transactions(reversal_of_transaction_id);
create index if not exists idx_account_tx_reversed_by on public.account_transactions(reversed_by_transaction_id);
create unique index if not exists uniq_account_tx_reversal_of
  on public.account_transactions(reversal_of_transaction_id)
  where reversal_of_transaction_id is not null;

-- Prevent semantically invalid signs.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_tx_amount_by_type_chk'
      and conrelid = 'public.account_transactions'::regclass
  ) then
    alter table public.account_transactions
      add constraint account_tx_amount_by_type_chk
      check (
        (type = 'invoice' and amount >= 0)
        or (type in ('payment','credit_note') and amount <= 0)
        or (type = 'adjustment' and amount <> 0)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_tx_adjustment_note_chk'
      and conrelid = 'public.account_transactions'::regclass
  ) then
    alter table public.account_transactions
      add constraint account_tx_adjustment_note_chk
      check (type <> 'adjustment' or nullif(btrim(coalesce(note, '')), '') is not null);
  end if;
end $$;

create or replace function public.validate_account_transaction_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'adjustment' and new.reversal_of_transaction_id is null and new.created_by_staff_id is null then
    raise exception 'Manual adjustments require created_by_staff_id.';
  end if;

  if new.reversal_of_transaction_id is not null and new.source <> 'reversal' then
    raise exception 'Reversal entries must use source = reversal.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_account_tx_insert on public.account_transactions;
create trigger trg_validate_account_tx_insert
before insert on public.account_transactions
for each row execute function public.validate_account_transaction_insert();

create or replace function public.guard_account_transaction_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ledger rows are append-only. Reversal linking is the only mutation allowed.
  if old.customer_user_id is distinct from new.customer_user_id
    or old.type is distinct from new.type
    or old.order_id is distinct from new.order_id
    or old.amount is distinct from new.amount
    or old.created_by_staff_id is distinct from new.created_by_staff_id
    or old.created_at is distinct from new.created_at
    or old.posted_at is distinct from new.posted_at
    or old.reversal_of_transaction_id is distinct from new.reversal_of_transaction_id
    or old.source is distinct from new.source
  then
    raise exception 'Ledger rows are immutable. Post a reversal entry instead.';
  end if;

  if old.reversed_by_transaction_id is not null and old.reversed_by_transaction_id is distinct from new.reversed_by_transaction_id then
    raise exception 'Reversal link cannot be changed once set.';
  end if;

  if old.reversed_by_transaction_id is null and new.reversed_by_transaction_id is not null then
    if not exists (
      select 1
      from public.account_transactions r
      where r.id = new.reversed_by_transaction_id
        and r.reversal_of_transaction_id = old.id
    ) then
      raise exception 'Invalid reversal link.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_account_tx_updates on public.account_transactions;
create trigger trg_guard_account_tx_updates
before update on public.account_transactions
for each row execute function public.guard_account_transaction_updates();

create or replace function public.prevent_account_transaction_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Ledger rows cannot be deleted. Use reversal workflow.';
end;
$$;

drop trigger if exists trg_prevent_account_tx_delete on public.account_transactions;
create trigger trg_prevent_account_tx_delete
before delete on public.account_transactions
for each row execute function public.prevent_account_transaction_delete();

create or replace function public.reverse_account_transaction(
  p_transaction_id uuid,
  p_note text,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original public.account_transactions%rowtype;
  v_staff_id uuid;
  v_reverse_id uuid;
begin
  if p_note is null or btrim(p_note) = '' then
    raise exception 'Reversal note is required.';
  end if;

  select * into v_original
  from public.account_transactions
  where id = p_transaction_id;

  if not found then
    raise exception 'Transaction not found.';
  end if;

  if v_original.reversal_of_transaction_id is not null then
    raise exception 'Cannot reverse a reversal entry.';
  end if;

  if v_original.reversed_by_transaction_id is not null then
    raise exception 'Transaction already reversed.';
  end if;

  select sp.id into v_staff_id
  from public.staff_profiles sp
  where sp.user_id = auth.uid();

  if v_staff_id is null then
    raise exception 'Only staff can reverse transactions.';
  end if;

  insert into public.account_transactions (
    customer_user_id,
    type,
    order_id,
    amount,
    reference,
    note,
    created_by_staff_id,
    source,
    metadata,
    posted_at,
    reversal_of_transaction_id,
    updated_at
  )
  values (
    v_original.customer_user_id,
    'adjustment',
    v_original.order_id,
    -v_original.amount,
    coalesce(nullif(btrim(p_reference), ''), v_original.reference),
    'Reversal: ' || btrim(p_note),
    v_staff_id,
    'reversal',
    jsonb_build_object('reversed_transaction_id', v_original.id, 'original_type', v_original.type),
    now(),
    v_original.id,
    now()
  )
  returning id into v_reverse_id;

  update public.account_transactions
  set reversed_by_transaction_id = v_reverse_id,
      updated_at = now()
  where id = v_original.id;

  return v_reverse_id;
end;
$$;

grant execute on function public.reverse_account_transaction(uuid, text, text) to authenticated;

-- Harden paid transition: ensure invoice statement line exists before payment line.
create or replace function public.on_order_paid_create_payment_tx()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and (old.status is null or old.status <> 'paid') then
    insert into public.account_transactions (customer_user_id, type, order_id, amount, reference, note, created_by_staff_id, source)
    values (
      new.user_id,
      'invoice',
      new.id,
      coalesce(new.total_inc_vat, 0),
      new.invoice_number,
      'Invoice created during paid transition safety path',
      null,
      'order_status'
    )
    on conflict do nothing;

    insert into public.account_transactions (customer_user_id, type, order_id, amount, reference, note, created_by_staff_id, source)
    values (
      new.user_id,
      'payment',
      new.id,
      -coalesce(new.total_inc_vat, 0),
      coalesce(new.payment_intent_id, new.invoice_number),
      'Payment recorded from order status change',
      null,
      'order_status'
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

comment on column public.account_transactions.source is 'Origin of ledger row for audit/reconciliation.';
comment on column public.account_transactions.reversal_of_transaction_id is 'Points to original row when this row is a reversal.';
comment on column public.account_transactions.reversed_by_transaction_id is 'Points to reversing row when this row has been reversed.';
