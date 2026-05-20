-- Extend wipe_product_catalogue to clear all product FK dependents.
-- Also add wipe_all_categories for Settings danger-zone "delete all categories".

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

  delete from public.assembly_lines;
  delete from public.assemblies;
  delete from public.product_categories;
  delete from public.collection_products;
  delete from public.stock_movements;
  delete from public.product_stock;
  delete from public.order_lines;
  delete from public.products;

  return jsonb_build_object(
    'wiped_products',           v_products_before,
    'wiped_assemblies',         v_assemblies_before,
    'wiped_assembly_lines',     v_lines_before,
    'wiped_product_categories', v_pc_before,
    'wiped_order_lines',        v_orderlines_before
  );
end;
$$;

create or replace function public.wipe_all_categories()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categories_before bigint := 0;
  v_products_before   bigint := 0;
  v_role           text := null;
begin
  select sp.role into v_role
  from public.staff_profiles sp
  where sp.user_id = auth.uid();

  if v_role is null or v_role <> 'admin' then
    raise exception 'Only admins may wipe categories';
  end if;

  select count(*) into v_products_before from public.products;
  if v_products_before > 0 then
    raise exception 'Delete all products first (or use wipe_product_catalogue) before wiping categories';
  end if;

  select count(*) into v_categories_before from public.categories;

  update public.categories set parent_id = null where parent_id is not null;
  delete from public.categories;

  return jsonb_build_object('wiped_categories', v_categories_before);
end;
$$;

revoke all on function public.wipe_all_categories() from public;
grant execute on function public.wipe_all_categories() to authenticated;

comment on function public.wipe_all_categories() is
  'Admin-only: deletes every category after products have been cleared. Returns count wiped.';
