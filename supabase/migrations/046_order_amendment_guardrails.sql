-- Guardrails: prevent dangerous customer mutations on locked orders.

create or replace function public.guard_customer_order_updates()
returns trigger
language plpgsql
security invoker
as $$
begin
  if public.is_staff() then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if old.user_id is distinct from auth.uid() then
    return new;
  end if;

  -- Locked once placed/invoiced/paid/cancelled for customer-side edits.
  if old.status in ('placed','invoiced','paid','cancelled') then
    raise exception 'Order is locked for customer edits in status %', old.status;
  end if;

  -- Draft/quotation may only transition through customer-safe statuses.
  if old.status = 'draft' and new.status not in ('draft','quotation','placed','cancelled') then
    raise exception 'Invalid status transition from draft to %', new.status;
  end if;

  if old.status = 'quotation' and new.status not in ('draft','quotation','placed','cancelled') then
    raise exception 'Invalid status transition from quotation to %', new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_customer_order_updates on public.orders;
create trigger trg_guard_customer_order_updates
before update on public.orders
for each row execute function public.guard_customer_order_updates();

create or replace function public.guard_customer_order_line_mutations()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_order_id uuid;
  v_order_user uuid;
  v_order_status text;
begin
  if public.is_staff() then
    return coalesce(new, old);
  end if;

  v_order_id := coalesce(new.order_id, old.order_id);

  select o.user_id, o.status
  into v_order_user, v_order_status
  from public.orders o
  where o.id = v_order_id;

  if not found then
    return coalesce(new, old);
  end if;

  if auth.uid() is null or auth.uid() is distinct from v_order_user then
    return coalesce(new, old);
  end if;

  if v_order_status not in ('draft','quotation') then
    raise exception 'Order lines are locked for customer edits in status %', v_order_status;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_guard_customer_order_line_mutations on public.order_lines;
create trigger trg_guard_customer_order_line_mutations
before insert or update or delete on public.order_lines
for each row execute function public.guard_customer_order_line_mutations();
