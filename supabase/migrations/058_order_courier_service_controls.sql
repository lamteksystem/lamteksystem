-- Add structured courier service controls to orders for realistic UK shipping operations.
alter table public.orders
  add column if not exists courier_service_code text null,
  add column if not exists courier_service_add_ons text[] not null default '{}'::text[],
  add column if not exists courier_preferred_time_slot text null,
  add column if not exists courier_preferred_date date null;
