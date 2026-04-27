-- Tighten customer updates on draft/quotation: block writes to financial/system columns.
-- (Status + lock rules remain from 046_order_amendment_guardrails.sql.)

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

  -- Own draft/quotation: customers may not touch staff/system/financial fields directly.
  if old.status in ('draft', 'quotation') then
    if new.user_id is distinct from old.user_id then
      raise exception 'Cannot change order owner';
    end if;
    if new.invoice_number is distinct from old.invoice_number then
      raise exception 'Customers cannot set or change invoice number';
    end if;
    if new.payment_intent_id is distinct from old.payment_intent_id then
      raise exception 'Customers cannot change payment reference';
    end if;
    if new.payment_status is distinct from old.payment_status then
      raise exception 'Customers cannot change payment status';
    end if;
    if new.processed_at is distinct from old.processed_at then
      raise exception 'Customers cannot change processed date';
    end if;
    if new.created_by_staff_id is distinct from old.created_by_staff_id then
      raise exception 'Customers cannot change staff attribution';
    end if;
    if new.is_archived is distinct from old.is_archived then
      raise exception 'Customers cannot archive orders';
    end if;
  end if;

  if old.status in ('placed','invoiced','paid','cancelled') then
    raise exception 'Order is locked for customer edits in status %', old.status;
  end if;

  if old.status = 'draft' and new.status not in ('draft','quotation','placed','cancelled') then
    raise exception 'Invalid status transition from draft to %', new.status;
  end if;

  if old.status = 'quotation' and new.status not in ('draft','quotation','placed','cancelled') then
    raise exception 'Invalid status transition from quotation to %', new.status;
  end if;

  return new;
end;
$$;
