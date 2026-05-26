-- Configurable quote/order behaviour codes (referenced by category_types.ordering_behaviour).

create table if not exists public.ordering_behaviour_definitions (
  code text primary key,
  label text not null,
  description text,
  sort_order int not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ordering_behaviour_definitions (code, label, description, sort_order, is_system) values
  (
    'standard',
    'Standard — search & add',
    'Default product search and add-to-order flow.',
    10,
    true
  ),
  (
    'tealbury_complete',
    'Tealbury Complete — guided setup + BOM units',
    'Tealbury kitchen wizard and complete units with BOM explosion.',
    20,
    true
  ),
  (
    'component_only',
    'Components only — individual parts',
    'Browse and add individual components rather than complete units.',
    30,
    true
  ),
  (
    'accessory',
    'Accessories — plinth, cornice, posts, etc.',
    'Cross-range accessories and add-on items.',
    40,
    true
  )
on conflict (code) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_system = excluded.is_system;

alter table public.category_types
  drop constraint if exists category_types_ordering_behaviour_check;

alter table public.category_types
  drop constraint if exists category_types_ordering_behaviour_fkey;

alter table public.category_types
  add constraint category_types_ordering_behaviour_fkey
  foreign key (ordering_behaviour) references public.ordering_behaviour_definitions(code)
  on update cascade;

alter table public.ordering_behaviour_definitions enable row level security;

drop policy if exists "Authenticated read ordering_behaviour_definitions"
  on public.ordering_behaviour_definitions;
create policy "Authenticated read ordering_behaviour_definitions"
  on public.ordering_behaviour_definitions for select
  using (auth.role() = 'authenticated');

drop policy if exists "Staff insert ordering_behaviour_definitions"
  on public.ordering_behaviour_definitions;
create policy "Staff insert ordering_behaviour_definitions"
  on public.ordering_behaviour_definitions for insert
  with check (public.is_staff());

drop policy if exists "Staff update ordering_behaviour_definitions"
  on public.ordering_behaviour_definitions;
create policy "Staff update ordering_behaviour_definitions"
  on public.ordering_behaviour_definitions for update
  using (public.is_staff());

drop policy if exists "Staff delete ordering_behaviour_definitions"
  on public.ordering_behaviour_definitions;
create policy "Staff delete ordering_behaviour_definitions"
  on public.ordering_behaviour_definitions for delete
  using (public.is_staff() and not is_system);
