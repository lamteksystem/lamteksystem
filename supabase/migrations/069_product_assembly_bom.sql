-- Link sellable complete products to assemblies; label component roles for BOM / stock take.

alter table public.assemblies
  add column if not exists product_id uuid references public.products(id) on delete set null;

create unique index if not exists idx_assemblies_product_id
  on public.assemblies(product_id)
  where product_id is not null;

alter table public.assembly_lines
  add column if not exists component_role text not null default 'other'
  check (component_role in (
    'unit', 'door', 'drawer', 'hinge', 'hinge_plate', 'leg_kit', 'fittings', 'other'
  ));

create index if not exists idx_assembly_lines_component_role
  on public.assembly_lines(component_role);

-- Staff can maintain BOMs from admin catalogue.
create policy "Staff insert assemblies"
  on public.assemblies for insert
  with check (public.is_staff());

create policy "Staff update assemblies"
  on public.assemblies for update
  using (public.is_staff());

create policy "Staff delete assemblies"
  on public.assemblies for delete
  using (public.is_staff());

create policy "Staff insert assembly_lines"
  on public.assembly_lines for insert
  with check (public.is_staff());

create policy "Staff update assembly_lines"
  on public.assembly_lines for update
  using (public.is_staff());

create policy "Staff delete assembly_lines"
  on public.assembly_lines for delete
  using (public.is_staff());

-- Backfill assembly name from linked product where set.
update public.assemblies a
set name = p.name,
    description = coalesce(a.description, p.description),
    image_url = coalesce(a.image_url, p.image_url),
    updated_at = now()
from public.products p
where a.product_id = p.id
  and (a.name is distinct from p.name or a.description is null);

-- Infer component_role from product SKU / category slug.
update public.assembly_lines al
set component_role = case
  when lower(coalesce(p.sku, '')) like 'carc-%'
    or lower(coalesce(c.slug, '')) ~ '(carcass|unit|cabinet)'
    then 'unit'
  when lower(coalesce(p.name, '')) like '%drawer%'
    or lower(coalesce(c.slug, '')) like '%drawer%'
    then 'drawer'
  when lower(coalesce(p.sku, '')) like 'hf-%'
    or lower(coalesce(p.name, '')) like '%door%'
    or lower(coalesce(c.slug, '')) like '%door%'
    then 'door'
  when (lower(coalesce(p.sku, '')) like '%hinge%' or lower(coalesce(c.slug, '')) like '%hinge%')
    and (lower(coalesce(p.name, '')) like '%plate%' or lower(coalesce(p.sku, '')) like '%bp%')
    then 'hinge_plate'
  when lower(coalesce(p.sku, '')) like '%hinge%' or lower(coalesce(c.slug, '')) like '%hinge%'
    then 'hinge'
  when lower(coalesce(p.sku, '')) like '%leg%'
    or lower(coalesce(c.slug, '')) ~ '(leg|plinth)'
    then 'leg_kit'
  when lower(coalesce(p.sku, '')) like 'fit-%'
    or lower(coalesce(c.slug, '')) ~ '(fitting|accessories|wirework)'
    then 'fittings'
  else 'other'
end
from public.products p
left join public.categories c on c.id = p.category_id
where al.product_id = p.id
  and al.component_role = 'other';
