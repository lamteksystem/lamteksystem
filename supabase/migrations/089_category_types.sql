-- Configurable category types (product / kitchen range / cross-range) used by categories.category_kind.

create table if not exists public.category_types (
  code text primary key,
  label text not null,
  description text,
  sort_order int not null default 0,
  browse_mode text not null default 'product'
    check (browse_mode in ('product', 'door_range', 'universal')),
  active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.category_types (code, label, description, sort_order, browse_mode, is_system) values
  (
    'product_type',
    'Product category',
    'Standard catalogue grouping (doors, handles, carcasses, etc.)',
    10,
    'product',
    true
  ),
  (
    'door_range',
    'Kitchen range',
    'Door programme / range (Oakham, Norwood, etc.) used on orders',
    20,
    'door_range',
    true
  ),
  (
    'universal',
    'Cross-range',
    'Wirework, accessories, and items usable with any kitchen range',
    30,
    'universal',
    true
  )
on conflict (code) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  browse_mode = excluded.browse_mode,
  is_system = true;

alter table public.categories
  drop constraint if exists categories_category_kind_check;

update public.categories
set category_kind = 'product_type'
where category_kind is null
   or category_kind not in (select code from public.category_types);

alter table public.categories
  drop constraint if exists categories_category_kind_fkey;

alter table public.categories
  add constraint categories_category_kind_fkey
  foreign key (category_kind) references public.category_types(code);

alter table public.category_types enable row level security;

drop policy if exists "Authenticated read category_types" on public.category_types;
create policy "Authenticated read category_types"
  on public.category_types for select
  using (auth.role() = 'authenticated');

drop policy if exists "Staff insert category_types" on public.category_types;
create policy "Staff insert category_types"
  on public.category_types for insert
  with check (public.is_staff());

drop policy if exists "Staff update category_types" on public.category_types;
create policy "Staff update category_types"
  on public.category_types for update
  using (public.is_staff());

drop policy if exists "Staff delete category_types" on public.category_types;
create policy "Staff delete category_types"
  on public.category_types for delete
  using (public.is_staff() and not is_system);
