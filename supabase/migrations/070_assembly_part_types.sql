-- Configurable BOM part types (complete-unit component roles) + assembly BOM columns.

create table if not exists public.assembly_part_types (
  code text primary key,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.assembly_part_types (code, label, sort_order, is_system) values
  ('unit', 'Unit / carcass / cabinet', 10, true),
  ('door', 'Door', 20, true),
  ('drawer', 'Drawer', 30, true),
  ('hinge', 'Hinge', 40, true),
  ('hinge_plate', 'Hinge plate', 50, true),
  ('leg_kit', 'Leg kit', 60, true),
  ('fittings', 'Fittings bag', 70, true),
  ('other', 'Other', 999, true)
on conflict (code) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_system = true;

alter table public.assemblies
  add column if not exists product_id uuid references public.products(id) on delete set null;

create unique index if not exists idx_assemblies_product_id
  on public.assemblies(product_id)
  where product_id is not null;

alter table public.assembly_lines
  add column if not exists component_role text not null default 'other';

update public.assembly_lines
set component_role = 'other'
where component_role is null
   or component_role not in (select code from public.assembly_part_types);

alter table public.assembly_lines
  drop constraint if exists assembly_lines_component_role_check;

alter table public.assembly_lines
  drop constraint if exists assembly_lines_component_role_fkey;

alter table public.assembly_lines
  add constraint assembly_lines_component_role_fkey
  foreign key (component_role) references public.assembly_part_types(code);

create index if not exists idx_assembly_lines_component_role
  on public.assembly_lines(component_role);

alter table public.assembly_part_types enable row level security;

drop policy if exists "Authenticated read assembly_part_types" on public.assembly_part_types;
create policy "Authenticated read assembly_part_types"
  on public.assembly_part_types for select
  using (auth.role() = 'authenticated');

drop policy if exists "Staff insert assembly_part_types" on public.assembly_part_types;
create policy "Staff insert assembly_part_types"
  on public.assembly_part_types for insert
  with check (public.is_staff());

drop policy if exists "Staff update assembly_part_types" on public.assembly_part_types;
create policy "Staff update assembly_part_types"
  on public.assembly_part_types for update
  using (public.is_staff());

drop policy if exists "Staff delete assembly_part_types" on public.assembly_part_types;
create policy "Staff delete assembly_part_types"
  on public.assembly_part_types for delete
  using (public.is_staff() and not is_system);

-- Staff maintain assemblies / lines from admin catalogue.
drop policy if exists "Staff insert assemblies" on public.assemblies;
create policy "Staff insert assemblies"
  on public.assemblies for insert
  with check (public.is_staff());

drop policy if exists "Staff update assemblies" on public.assemblies;
create policy "Staff update assemblies"
  on public.assemblies for update
  using (public.is_staff());

drop policy if exists "Staff delete assemblies" on public.assemblies;
create policy "Staff delete assemblies"
  on public.assemblies for delete
  using (public.is_staff());

drop policy if exists "Staff insert assembly_lines" on public.assembly_lines;
create policy "Staff insert assembly_lines"
  on public.assembly_lines for insert
  with check (public.is_staff());

drop policy if exists "Staff update assembly_lines" on public.assembly_lines;
create policy "Staff update assembly_lines"
  on public.assembly_lines for update
  using (public.is_staff());

drop policy if exists "Staff delete assembly_lines" on public.assembly_lines;
create policy "Staff delete assembly_lines"
  on public.assembly_lines for delete
  using (public.is_staff());
