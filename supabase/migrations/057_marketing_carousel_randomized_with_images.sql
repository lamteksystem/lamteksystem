-- Ensure marketing carousel products are image-backed and varied across ranges.
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
  'Public homepage carousel: image-backed and varied rows across categories; callable by anon.';

grant execute on function public.marketing_carousel_products(uuid[], int) to anon, authenticated;
