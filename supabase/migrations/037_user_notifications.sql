-- User-facing notifications (portal inbox) + staff visibility.

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  order_id uuid references public.orders(id) on delete set null,
  title text not null,
  body text,
  link text,
  channel text not null default 'portal' check (channel in ('portal','email','sms')),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_notifications_user_id_created_at
  on public.user_notifications(user_id, created_at desc);

alter table public.user_notifications enable row level security;

-- Customer can read their own notifications
drop policy if exists "Customer read own notifications" on public.user_notifications;
create policy "Customer read own notifications"
  on public.user_notifications for select
  using (auth.uid() = user_id);

-- Customer can mark notifications read
drop policy if exists "Customer update own notifications" on public.user_notifications;
create policy "Customer update own notifications"
  on public.user_notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Staff can manage notifications
drop policy if exists "Staff read notifications" on public.user_notifications;
create policy "Staff read notifications"
  on public.user_notifications for select
  using (public.is_staff());

drop policy if exists "Staff insert notifications" on public.user_notifications;
create policy "Staff insert notifications"
  on public.user_notifications for insert
  with check (public.is_staff());

drop policy if exists "Staff update notifications" on public.user_notifications;
create policy "Staff update notifications"
  on public.user_notifications for update
  using (public.is_staff());

