-- CRM pipeline: opportunities (stages, value) and activities (calls, emails, tasks).
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  stage text not null default 'lead',
  value_ex_vat numeric(12,2) default 0,
  expected_close_date date,
  owner_staff_id uuid references public.staff_profiles(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_opportunities_customer on public.opportunities(customer_user_id);
create index if not exists idx_opportunities_stage on public.opportunities(stage);
create index if not exists idx_opportunities_owner on public.opportunities(owner_staff_id);

alter table public.opportunities enable row level security;

create policy "Staff select opportunities" on public.opportunities for select to authenticated using (public.is_staff());
create policy "Staff insert opportunities" on public.opportunities for insert to authenticated with check (public.is_staff());
create policy "Staff update opportunities" on public.opportunities for update to authenticated using (public.is_staff());
create policy "Staff delete opportunities" on public.opportunities for delete to authenticated using (public.is_staff());

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  subject text,
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  author_user_id uuid references auth.users(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_activities_customer on public.activities(customer_user_id);
create index if not exists idx_activities_due on public.activities(due_at);
create index if not exists idx_activities_opportunity on public.activities(opportunity_id);

alter table public.activities enable row level security;

create policy "Staff select activities" on public.activities for select to authenticated using (public.is_staff());
create policy "Staff insert activities" on public.activities for insert to authenticated with check (public.is_staff());
create policy "Staff update activities" on public.activities for update to authenticated using (public.is_staff());
create policy "Staff delete activities" on public.activities for delete to authenticated using (public.is_staff());

comment on table public.opportunities is 'CRM opportunities (pipeline) per customer.';
comment on table public.activities is 'CRM activities (calls, emails, tasks) per customer.';
