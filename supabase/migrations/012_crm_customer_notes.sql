-- CRM: notes on customers (staff-only)
create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid references auth.users(id) on delete cascade not null,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists idx_customer_notes_customer on public.customer_notes(customer_user_id);
create index if not exists idx_customer_notes_created on public.customer_notes(created_at desc);

alter table public.customer_notes enable row level security;

-- Staff can do everything; no customer access (drop first so migration is idempotent)
drop policy if exists "Staff select customer_notes" on public.customer_notes;
drop policy if exists "Staff insert customer_notes" on public.customer_notes;
drop policy if exists "Staff update customer_notes" on public.customer_notes;
drop policy if exists "Staff delete customer_notes" on public.customer_notes;

create policy "Staff select customer_notes"
  on public.customer_notes for select to authenticated
  using (public.is_staff());

create policy "Staff insert customer_notes"
  on public.customer_notes for insert to authenticated
  with check (public.is_staff());

create policy "Staff update customer_notes"
  on public.customer_notes for update to authenticated
  using (public.is_staff());

create policy "Staff delete customer_notes"
  on public.customer_notes for delete to authenticated
  using (public.is_staff());

comment on table public.customer_notes is 'CRM notes on customers; staff only.';
