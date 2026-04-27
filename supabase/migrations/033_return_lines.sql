-- Returns: structured return line items linked to tickets and order lines.

create table if not exists public.return_lines (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete cascade not null,
  order_line_id uuid references public.order_lines(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  quantity int not null default 1 check (quantity > 0),
  reason text,
  resolution text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_return_lines_ticket on public.return_lines(ticket_id);
create index if not exists idx_return_lines_order_line on public.return_lines(order_line_id);

alter table public.return_lines enable row level security;

-- Customers can read return lines for their own tickets
drop policy if exists "Customers read own return_lines" on public.return_lines;
create policy "Customers read own return_lines"
  on public.return_lines for select to authenticated
  using (
    exists (select 1 from public.tickets t where t.id = ticket_id and t.customer_user_id = auth.uid())
  );

-- Customers can insert return lines for their own tickets
drop policy if exists "Customers insert own return_lines" on public.return_lines;
create policy "Customers insert own return_lines"
  on public.return_lines for insert to authenticated
  with check (
    exists (select 1 from public.tickets t where t.id = ticket_id and t.customer_user_id = auth.uid())
  );

-- Staff can manage return lines
drop policy if exists "Staff manage return_lines" on public.return_lines;
create policy "Staff manage return_lines"
  on public.return_lines for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

comment on table public.return_lines is 'Return line items linked to a support ticket (type=returns).';

