-- Separate Lamtek (component/carcass) catalogue from Tealbury (curated packaged kitchens).
-- Allow order lines to survive Tealbury catalogue refreshes (snapshot remains; FK nulled).

alter table public.products add column if not exists catalog_program text default 'lamtek';

update public.products set catalog_program = 'lamtek' where catalog_program is null;

alter table public.products alter column catalog_program set not null;
alter table public.products alter column catalog_program set default 'lamtek';

alter table public.products drop constraint if exists products_catalog_program_check;
alter table public.products
  add constraint products_catalog_program_check check (catalog_program in ('lamtek', 'tealbury'));

comment on column public.products.catalog_program is
  'lamtek = component/carcass trade catalogue; tealbury = curated Tealbury packaged kitchen programme.';

create index if not exists idx_products_catalog_program_active
  on public.products (catalog_program, active)
  where active = true;

-- Refreshing Tealbury SKUs must not block on historical order lines.
do $fn$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.order_lines'::regclass
      and c.contype = 'f'
      and a.attname = 'product_id'
      and c.confrelid = 'public.products'::regclass
  loop
    execute format('alter table public.order_lines drop constraint %I', r.conname);
  end loop;
end $fn$;

alter table public.order_lines
  add constraint order_lines_product_id_fkey
  foreign key (product_id) references public.products (id) on delete set null;

-- Public marketing carousel: Lamtek component imagery only (not Tealbury programme rows).
create or replace function public.marketing_carousel_products(
  p_ids uuid[] default '{}'::uuid[],
  p_limit int default 6
)
returns table (
  id uuid,
  category_id uuid,
  name text,
  description text,
  sku text,
  image_url text,
  image_alt text,
  options jsonb,
  active boolean,
  sort_order int,
  created_at timestamptz,
  is_stock boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  lim int := least(24, greatest(1, coalesce(p_limit, 6)));
begin
  if p_ids is not null and coalesce(array_length(p_ids, 1), 0) > 0 then
    return query
    with selected as (
      select
        p.id,
        p.category_id,
        p.name,
        p.description,
        p.sku,
        p.image_url,
        p.image_alt,
        p.options,
        p.active,
        p.sort_order,
        p.created_at,
        p.is_stock,
        row_number() over (partition by p.category_id order by u.ord) as category_rank
      from unnest(p_ids) with ordinality as u(pid, ord)
      inner join public.products p on p.id = u.pid
      where p.active = true
        and coalesce(p.catalog_program, 'lamtek') = 'lamtek'
        and nullif(trim(coalesce(p.image_url, '')), '') is not null
    )
    select
      s.id,
      s.category_id,
      s.name,
      s.description,
      s.sku,
      s.image_url,
      s.image_alt,
      s.options,
      s.active,
      s.sort_order,
      s.created_at,
      s.is_stock
    from selected s
    order by s.category_rank, random()
    limit lim;
  else
    return query
    with pool as (
      select
        p.id,
        p.category_id,
        p.name,
        p.description,
        p.sku,
        p.image_url,
        p.image_alt,
        p.options,
        p.active,
        p.sort_order,
        p.created_at,
        p.is_stock,
        row_number() over (partition by p.category_id order by random()) as category_rank
      from public.products p
      where p.active = true
        and coalesce(p.catalog_program, 'lamtek') = 'lamtek'
        and nullif(trim(coalesce(p.image_url, '')), '') is not null
    )
    select
      pp.id,
      pp.category_id,
      pp.name,
      pp.description,
      pp.sku,
      pp.image_url,
      pp.image_alt,
      pp.options,
      pp.active,
      pp.sort_order,
      pp.created_at,
      pp.is_stock
    from pool pp
    order by pp.category_rank, random()
    limit lim;
  end if;
end;
$$;

comment on function public.marketing_carousel_products(uuid[], int) is
  'Public homepage carousel: Lamtek image-backed rows; excludes Tealbury programme catalogue.';
