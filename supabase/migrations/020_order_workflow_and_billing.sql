-- Order workflow & billing: invoice number, courier, delivery expected date, payment terms
-- Competitor-inspired: OMS invoicing, delivery tracking, courier options, payment terms.

-- Invoice number: unique human-readable ref, set when order moves to 'invoiced'
alter table public.orders
  add column if not exists invoice_number text unique,
  add column if not exists courier text,
  add column if not exists delivery_expected_date date;

comment on column public.orders.invoice_number is 'Unique invoice ref (e.g. INV-2025-0001), set when status becomes invoiced';
comment on column public.orders.courier is 'Courier/carrier name: DPD, FedEx, Royal Mail, Yodel, Other';
comment on column public.orders.delivery_expected_date is 'Expected delivery date shown to customer';

-- Payment terms on customer (Net 7, Net 30, etc.) for billing display
alter table public.customer_profiles
  add column if not exists payment_terms text;

comment on column public.customer_profiles.payment_terms is 'e.g. Net 7, Net 30, Due on receipt; shown on orders and statements';

-- Generate next invoice number (call when moving order to invoiced)
create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
as $$
declare
  year_part text;
  next_seq int;
begin
  year_part := to_char(now(), 'YYYY');
  select coalesce(max(
    case
      when invoice_number ~ ('^INV-' || year_part || '-[0-9]+$')
      then nullif(regexp_replace(invoice_number, '^INV-[0-9]+-', ''), '')::int
      else null
    end
  ), 0) + 1 into next_seq
  from public.orders
  where invoice_number is not null;
  return 'INV-' || year_part || '-' || lpad(next_seq::text, 4, '0');
end;
$$;

-- When order moves to invoiced, set invoice_number if not already set
create or replace function public.set_order_invoice_number()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'invoiced' and (old.status is null or old.status <> 'invoiced') and (new.invoice_number is null or new.invoice_number = '') then
    new.invoice_number := public.next_invoice_number();
  end if;
  return new;
end;
$$;

drop trigger if exists set_order_invoice_number_trigger on public.orders;
create trigger set_order_invoice_number_trigger
  before update on public.orders
  for each row
  execute function public.set_order_invoice_number();

grant execute on function public.next_invoice_number() to authenticated;
