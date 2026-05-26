-- Organisation-wide defaults for the product search / order workbench table columns.
create table if not exists public.catalog_workbench_settings (
  id smallint primary key default 1,
  column_order text[] not null default array[
    'image', 'code', 'name', 'sku', 'trade_code', 'category', 'door_range',
    'description', 'dimensions', 'availability', 'stock', 'catalogue',
    'spec', 'props', 'price', 'qty', 'action'
  ]::text[],
  column_visible text[] not null default array[
    'image', 'code', 'description', 'price', 'qty', 'action'
  ]::text[],
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.catalog_workbench_settings (id)
  values (1)
on conflict (id) do nothing;

alter table public.catalog_workbench_settings enable row level security;

drop policy if exists "Authenticated read catalog_workbench_settings"
  on public.catalog_workbench_settings;
create policy "Authenticated read catalog_workbench_settings"
  on public.catalog_workbench_settings for select
  using (auth.role() = 'authenticated');

drop policy if exists "Staff update catalog_workbench_settings"
  on public.catalog_workbench_settings;
create policy "Staff update catalog_workbench_settings"
  on public.catalog_workbench_settings for update
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Staff insert catalog_workbench_settings"
  on public.catalog_workbench_settings;
create policy "Staff insert catalog_workbench_settings"
  on public.catalog_workbench_settings for insert
  with check (public.is_staff());
