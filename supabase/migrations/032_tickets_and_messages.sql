-- Customer support: tickets and threaded messages (returns/issues/questions).

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid references auth.users(id) on delete cascade not null,
  order_id uuid references public.orders(id) on delete set null,
  type text not null check (type in ('returns','issue','question')),
  subject text not null,
  body text not null,
  status text not null default 'open' check (status in ('open','in_progress','waiting_customer','resolved')),
  priority int not null default 2 check (priority >= 1 and priority <= 5),
  assigned_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tickets_customer on public.tickets(customer_user_id);
create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_tickets_assigned on public.tickets(assigned_staff_id);
create index if not exists idx_tickets_created on public.tickets(created_at desc);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete cascade not null,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_ticket_messages_ticket on public.ticket_messages(ticket_id);
create index if not exists idx_ticket_messages_created on public.ticket_messages(created_at desc);

alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

-- Customers can read their tickets
drop policy if exists "Customers read own tickets" on public.tickets;
create policy "Customers read own tickets"
  on public.tickets for select to authenticated
  using (auth.uid() = customer_user_id);

-- Customers can create tickets for themselves
drop policy if exists "Customers create own tickets" on public.tickets;
create policy "Customers create own tickets"
  on public.tickets for insert to authenticated
  with check (auth.uid() = customer_user_id);

-- Customers can update their tickets only to add basic info (status not enforced here; app controls it)
drop policy if exists "Customers update own tickets" on public.tickets;
create policy "Customers update own tickets"
  on public.tickets for update to authenticated
  using (auth.uid() = customer_user_id);

-- Staff can manage tickets
drop policy if exists "Staff manage tickets" on public.tickets;
create policy "Staff manage tickets"
  on public.tickets for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Messages: customers can read messages on their tickets (excluding internal)
drop policy if exists "Customers read ticket messages" on public.ticket_messages;
create policy "Customers read ticket messages"
  on public.ticket_messages for select to authenticated
  using (
    exists (select 1 from public.tickets t where t.id = ticket_id and t.customer_user_id = auth.uid())
    and is_internal = false
  );

-- Messages: customers can insert messages on their tickets (must be non-internal)
drop policy if exists "Customers insert ticket messages" on public.ticket_messages;
create policy "Customers insert ticket messages"
  on public.ticket_messages for insert to authenticated
  with check (
    exists (select 1 from public.tickets t where t.id = ticket_id and t.customer_user_id = auth.uid())
    and is_internal = false
    and (author_user_id is null or author_user_id = auth.uid())
  );

-- Staff can read all messages
drop policy if exists "Staff read ticket messages" on public.ticket_messages;
create policy "Staff read ticket messages"
  on public.ticket_messages for select to authenticated
  using (public.is_staff());

-- Staff can insert/update/delete all messages (including internal notes)
drop policy if exists "Staff manage ticket messages" on public.ticket_messages;
create policy "Staff manage ticket messages"
  on public.ticket_messages for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

comment on table public.tickets is 'Customer support tickets (returns/issues/questions).';
comment on table public.ticket_messages is 'Threaded messages on support tickets; staff can add internal notes.';

