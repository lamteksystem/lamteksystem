-- Permissions: reusable rules that can be assigned by role or user for granular control.
-- Scopes: admin.catalogue, admin.stock, admin.pricing, admin.customers, admin.orders, etc.
-- Actions: view, edit, create, delete (or custom). Conditions (jsonb) for future "if this then that".

create table if not exists public.permission_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  scope text not null,
  action text not null,
  role text check (role in ('admin', 'staff')),
  user_id uuid references auth.users(id) on delete cascade,
  conditions jsonb default '{}',
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint permission_rule_target check (role is not null or user_id is not null)
);

create index if not exists idx_permission_rules_scope on public.permission_rules(scope);
create index if not exists idx_permission_rules_active on public.permission_rules(active);

alter table public.permission_rules enable row level security;

create policy "Staff read permission_rules"
  on public.permission_rules for select to authenticated using (public.is_staff());

create policy "Admin manage permission_rules"
  on public.permission_rules for all to authenticated
  using (
    exists (select 1 from public.staff_profiles where user_id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.staff_profiles where user_id = auth.uid() and role = 'admin')
  );

comment on table public.permission_rules is 'Granular permission rules by scope/action; assigned to role or user.';
