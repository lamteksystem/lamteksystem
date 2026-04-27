-- Public marketing carousel: anon cannot SELECT products (RLS requires authenticated).
-- Expose a narrow RPC so the homepage can load images/names without leaking cost, stock, or pricing.

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
      p.is_stock
    from unnest(p_ids) with ordinality as u(pid, ord)
    inner join public.products p on p.id = u.pid
    where p.active = true
    order by u.ord
    limit lim;
  else
    return query
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
      p.is_stock
    from public.products p
    where p.active = true
    order by p.sort_order, p.name
    limit lim;
  end if;
end;
$$;

comment on function public.marketing_carousel_products(uuid[], int) is
  'Public homepage carousel: safe product fields only; callable by anon.';

grant execute on function public.marketing_carousel_products(uuid[], int) to anon, authenticated;
