-- Complete-unit assemblies (e.g. 600mm base unit = carcass + door + hinges + leg pack + fittings)

create table if not exists public.assemblies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  unit_type text not null default 'base_unit' check (unit_type in ('base_unit','wall_unit','tall_unit','other')),
  width_mm int,
  collection_slug text,
  sort_order int default 0,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.assembly_lines (
  id uuid primary key default gen_random_uuid(),
  assembly_id uuid references public.assemblies(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete restrict not null,
  quantity int not null default 1 check (quantity > 0),
  sort_order int default 0,
  unique(assembly_id, product_id)
);

alter table public.assemblies enable row level security;
alter table public.assembly_lines enable row level security;

create policy "Authenticated read assemblies" on public.assemblies
  for select using (auth.role() = 'authenticated');

create policy "Authenticated read assembly_lines" on public.assembly_lines
  for select using (auth.role() = 'authenticated');

create index if not exists idx_assembly_lines_assembly on public.assembly_lines(assembly_id);
create index if not exists idx_assemblies_active on public.assemblies(active) where active = true;
