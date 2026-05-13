-- Delivery windows MVP schema.
create table if not exists public.delivery_windows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Europe/London',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_windows_time_range check (end_time > start_time)
);

create table if not exists public.delivery_service_days (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references public.delivery_windows(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  cut_off_time time not null,
  lead_time_days int not null default 0 check (lead_time_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_service_days_window_weekday_uniq unique (window_id, weekday)
);

create index if not exists idx_delivery_service_days_weekday on public.delivery_service_days(weekday);

alter table public.orders
  add column if not exists delivery_window_id uuid references public.delivery_windows(id) on delete set null,
  add column if not exists delivery_scheduled_date date;

create index if not exists idx_orders_delivery_window_id on public.orders(delivery_window_id);
create index if not exists idx_orders_delivery_scheduled_date on public.orders(delivery_scheduled_date);

alter table public.delivery_windows enable row level security;
alter table public.delivery_service_days enable row level security;

drop policy if exists "Authenticated read delivery_windows" on public.delivery_windows;
create policy "Authenticated read delivery_windows"
  on public.delivery_windows for select to authenticated
  using (true);

drop policy if exists "Staff manage delivery_windows" on public.delivery_windows;
create policy "Staff manage delivery_windows"
  on public.delivery_windows for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Authenticated read delivery_service_days" on public.delivery_service_days;
create policy "Authenticated read delivery_service_days"
  on public.delivery_service_days for select to authenticated
  using (true);

drop policy if exists "Staff manage delivery_service_days" on public.delivery_service_days;
create policy "Staff manage delivery_service_days"
  on public.delivery_service_days for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

comment on table public.delivery_windows is 'Customer-selectable delivery windows (AM/PM/etc).';
comment on table public.delivery_service_days is 'Service availability and cut-off settings per delivery window and weekday.';
comment on column public.orders.delivery_window_id is 'Chosen delivery window for order delivery.';
comment on column public.orders.delivery_scheduled_date is 'Chosen delivery date for selected delivery window.';
