-- Staff may delete any category; products become uncategorised or keep another assignment.

create or replace function public.delete_category_admin(p_category_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_products_uncategorised bigint := 0;
  v_products_repointed bigint := 0;
  v_subcategories_promoted bigint := 0;
begin
  if not public.is_staff() then
    raise exception 'Not authorized';
  end if;

  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'Category not found';
  end if;

  -- Repoint primary when the product has other category assignments.
  with remaining as (
    select
      pc.product_id,
      pc.category_id,
      row_number() over (
        partition by pc.product_id
        order by pc.is_primary desc, pc.category_id
      ) as rn
    from public.product_categories pc
    where pc.category_id <> p_category_id
      and pc.product_id in (
        select product_id
        from public.product_categories
        where category_id = p_category_id
      )
  )
  update public.products p
  set category_id = r.category_id
  from remaining r
  where p.id = r.product_id
    and r.rn = 1
    and p.category_id = p_category_id;

  get diagnostics v_products_repointed = row_count;

  update public.products
  set category_id = null
  where category_id = p_category_id;

  get diagnostics v_products_uncategorised = row_count;

  delete from public.product_categories
  where category_id = p_category_id;

  update public.categories
  set parent_id = null
  where parent_id = p_category_id;

  get diagnostics v_subcategories_promoted = row_count;

  update public.orders
  set kitchen_range_id = null
  where kitchen_range_id = p_category_id;

  delete from public.categories
  where id = p_category_id;

  return jsonb_build_object(
    'products_uncategorised', v_products_uncategorised,
    'products_repointed', v_products_repointed,
    'subcategories_promoted', v_subcategories_promoted
  );
end;
$$;

revoke all on function public.delete_category_admin(uuid) from public;
grant execute on function public.delete_category_admin(uuid) to authenticated;

comment on function public.delete_category_admin(uuid) is
  'Delete a category. Uncategorises products or keeps another assignment; sub-categories become top-level.';
