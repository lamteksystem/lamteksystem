-- Atomic multi-category save (security definer — avoids RLS delete/insert edge cases).

create or replace function public.save_product_categories(
  p_product_id uuid,
  p_category_ids uuid[],
  p_primary_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Not authorized';
  end if;

  if p_primary_category_id is null or coalesce(array_length(p_category_ids, 1), 0) < 1 then
    raise exception 'At least one category is required';
  end if;

  if not (p_primary_category_id = any (p_category_ids)) then
    raise exception 'Primary category must be included in the selection';
  end if;

  delete from public.product_categories where product_id = p_product_id;

  insert into public.product_categories (product_id, category_id, is_primary)
  select p_product_id, cid, (cid = p_primary_category_id)
  from unnest(p_category_ids) as cid;

  update public.products
  set category_id = p_primary_category_id
  where id = p_product_id;
end;
$$;

revoke all on function public.save_product_categories(uuid, uuid[], uuid) from public;
grant execute on function public.save_product_categories(uuid, uuid[], uuid) to authenticated;
