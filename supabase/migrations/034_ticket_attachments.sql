-- Ticket attachments: customer/staff can upload files related to a ticket.
-- Stored in the existing `documents` storage bucket; metadata is kept in this table.

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete cascade not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  file_path text not null,
  file_name text,
  file_type text,
  is_internal boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_ticket_attachments_ticket on public.ticket_attachments(ticket_id);
create index if not exists idx_ticket_attachments_created on public.ticket_attachments(created_at desc);

alter table public.ticket_attachments enable row level security;

-- Customers can read attachments on their own tickets
drop policy if exists "Customers read ticket attachments" on public.ticket_attachments;
create policy "Customers read ticket attachments"
  on public.ticket_attachments for select to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.customer_user_id = auth.uid()
    )
  );

-- Customers can insert attachments to their own tickets, but attachments are always external
drop policy if exists "Customers insert ticket attachments" on public.ticket_attachments;
create policy "Customers insert ticket attachments"
  on public.ticket_attachments for insert to authenticated
  with check (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.customer_user_id = auth.uid()
    )
    and created_by_user_id = auth.uid()
    and is_internal = false
  );

-- Staff can manage attachments on any ticket
drop policy if exists "Staff manage ticket attachments" on public.ticket_attachments;
create policy "Staff manage ticket attachments"
  on public.ticket_attachments for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

comment on table public.ticket_attachments is 'Attachments for support tickets (returns/issues/questions).';

