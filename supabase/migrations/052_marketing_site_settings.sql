-- Public marketing homepage: carousel product list + visible count (staff-configurable, public read)
create table if not exists public.marketing_site_settings (
  id text primary key default 'default' check (id = 'default'),
  carousel_limit int not null default 6 check (carousel_limit >= 1 and carousel_limit <= 24),
  carousel_product_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into public.marketing_site_settings (id, carousel_limit, carousel_product_ids)
values ('default', 6, '{}')
on conflict (id) do nothing;

alter table public.marketing_site_settings enable row level security;

create policy "marketing_site_settings_select_public"
  on public.marketing_site_settings for select
  using (true);

create policy "marketing_site_settings_update_staff"
  on public.marketing_site_settings for update
  using (exists (select 1 from public.staff_profiles sp where sp.user_id = auth.uid()))
  with check (exists (select 1 from public.staff_profiles sp where sp.user_id = auth.uid()));

create policy "marketing_site_settings_insert_staff"
  on public.marketing_site_settings for insert
  with check (exists (select 1 from public.staff_profiles sp where sp.user_id = auth.uid()));
