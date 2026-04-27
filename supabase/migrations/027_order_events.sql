-- Order events: audit log for status changes and key actions (who, when, what).
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_order_events_order on public.order_events(order_id);
create index if not exists idx_order_events_created on public.order_events(created_at desc);

alter table public.order_events enable row level security;

create policy "Staff select order_events"
  on public.order_events for select to authenticated using (public.is_staff());

create policy "Staff insert order_events"
  on public.order_events for insert to authenticated with check (public.is_staff());

comment on table public.order_events is 'Audit log for order status changes and key actions.';
