-- 082_wipe_products.sql
--
-- Atomic, admin-only catalogue wipe used by the AdminCatalogueWipe page.
-- Keeps `categories` and `assembly_part_types` intact so the user can rebuild
-- products from scratch without losing their taxonomy.

create or replace function public.wipe_product_catalogue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_products_before     bigint := 0;
  v_assemblies_before   bigint := 0;
  v_lines_before        bigint := 0;
  v_pc_before           bigint := 0;
  v_orderlines_before   bigint := 0;
  v_role             text := null;
begin
  -- Authorise: admins only. Staff can edit catalogue but only admins may wipe it.
  select sp.role into v_role
  from public.staff_profiles sp
  where sp.user_id = auth.uid();

  if v_role is null or v_role <> 'admin' then
    raise exception 'Only admins may wipe the product catalogue';
  end if;

  select count(*) into v_products_before   from public.products;
  select count(*) into v_assemblies_before from public.assemblies;
  select count(*) into v_lines_before      from public.assembly_lines;
  select count(*) into v_pc_before         from public.product_categories;
  select count(*) into v_orderlines_before from public.order_lines;

  -- Order matters: clear dependents first (WHERE required by Supabase/pg_safeupdate).
  delete from public.assembly_lines where id is not null;
  delete from public.assemblies where id is not null;
  delete from public.product_categories where product_id is not null;

  -- product_stock + order_lines reference products. We clear order_lines so any
  -- historical/test orders don't end up with broken FK references; the orders
  -- themselves are kept (they'll show as zero-line orders rather than vanishing).
  delete from public.product_stock where product_id is not null;
  delete from public.order_lines where id is not null;

  delete from public.products where id is not null;

  return jsonb_build_object(
    'wiped_products',           v_products_before,
    'wiped_assemblies',         v_assemblies_before,
    'wiped_assembly_lines',     v_lines_before,
    'wiped_product_categories', v_pc_before,
    'wiped_order_lines',        v_orderlines_before
  );
end;
$$;

revoke all on function public.wipe_product_catalogue() from public;
grant execute on function public.wipe_product_catalogue() to authenticated;

comment on function public.wipe_product_catalogue() is
  'Admin-only catalogue reset: clears products, assemblies, assembly_lines, product_categories, product_stock and order_lines. Keeps categories and assembly_part_types. Returns counts of what was wiped.';
