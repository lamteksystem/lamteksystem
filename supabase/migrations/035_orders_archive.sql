-- Order archive support: hide archived orders from default workflows,
-- while allowing staff to reopen/duplicate when required.

alter table public.orders
  add column if not exists is_archived boolean not null default false;

comment on column public.orders.is_archived is 'When true, order is archived in admin and excluded from active workflows by default.';

create index if not exists idx_orders_is_archived on public.orders(is_archived);
