-- Customer saved delivery addresses for checkout selection.

create table if not exists public.customer_delivery_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  address text not null,
  postcode text,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_delivery_addresses_customer
  on public.customer_delivery_addresses(customer_user_id);

alter table public.customer_delivery_addresses enable row level security;

drop policy if exists "Users read own delivery addresses" on public.customer_delivery_addresses;
create policy "Users read own delivery addresses"
  on public.customer_delivery_addresses for select to authenticated
  using (auth.uid() = customer_user_id);

drop policy if exists "Users insert own delivery addresses" on public.customer_delivery_addresses;
create policy "Users insert own delivery addresses"
  on public.customer_delivery_addresses for insert to authenticated
  with check (auth.uid() = customer_user_id);

drop policy if exists "Users update own delivery addresses" on public.customer_delivery_addresses;
create policy "Users update own delivery addresses"
  on public.customer_delivery_addresses for update to authenticated
  using (auth.uid() = customer_user_id)
  with check (auth.uid() = customer_user_id);

drop policy if exists "Users delete own delivery addresses" on public.customer_delivery_addresses;
create policy "Users delete own delivery addresses"
  on public.customer_delivery_addresses for delete to authenticated
  using (auth.uid() = customer_user_id);

drop policy if exists "Staff manage delivery addresses" on public.customer_delivery_addresses;
create policy "Staff manage delivery addresses"
  on public.customer_delivery_addresses for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create or replace function public.normalize_customer_delivery_default()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.is_default then
    update public.customer_delivery_addresses
    set is_default = false,
        updated_at = now()
    where customer_user_id = new.customer_user_id
      and id <> new.id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_customer_delivery_default on public.customer_delivery_addresses;
create trigger trg_customer_delivery_default
before insert or update on public.customer_delivery_addresses
for each row execute function public.normalize_customer_delivery_default();

comment on table public.customer_delivery_addresses is 'Saved delivery addresses per customer for checkout convenience.';
