-- Customer human reference number (short, unique)
-- Adds customer_profiles.customer_ref like "CUST-000123"

alter table public.customer_profiles
  add column if not exists customer_ref text;

create unique index if not exists uniq_customer_profiles_customer_ref
  on public.customer_profiles(customer_ref)
  where customer_ref is not null;

create sequence if not exists public.customer_ref_seq;

create or replace function public.next_customer_ref()
returns text
language plpgsql
security definer
as $$
declare
  n bigint;
begin
  n := nextval('public.customer_ref_seq');
  return 'CUST-' || lpad(n::text, 6, '0');
end;
$$;

create or replace function public.set_customer_ref()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.customer_ref is null or new.customer_ref = '' then
    new.customer_ref := public.next_customer_ref();
  end if;
  return new;
end;
$$;

drop trigger if exists set_customer_ref_trigger on public.customer_profiles;
create trigger set_customer_ref_trigger
  before insert on public.customer_profiles
  for each row
  execute function public.set_customer_ref();

-- Backfill existing customers without a ref.
do $$
declare
  r record;
begin
  for r in
    select id from public.customer_profiles
    where customer_ref is null or customer_ref = ''
    order by id
  loop
    update public.customer_profiles
    set customer_ref = public.next_customer_ref()
    where id = r.id;
  end loop;
end $$;

