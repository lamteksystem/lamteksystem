-- Atomic stock allocation for shipments: perform decrement + audit in one transaction.

create or replace function public.allocate_stock_for_order_shipment(
  p_order_id uuid,
  p_location_id uuid,
  p_reason text default 'shipment'
)
returns void
language plpgsql
security definer
as $$
declare
  r record;
  current_qty int;
  next_qty int;
begin
  -- Ensure caller is staff
  if not public.is_staff() then
    raise exception 'not_staff';
  end if;

  for r in
    select ol.product_id, ol.quantity
    from public.order_lines ol
    where ol.order_id = p_order_id
  loop
    if coalesce(r.quantity, 0) <= 0 then
      continue;
    end if;

    select ps.quantity into current_qty
    from public.product_stock ps
    where ps.product_id = r.product_id and ps.location_id = p_location_id
    for update;

    current_qty := coalesce(current_qty, 0);
    next_qty := greatest(0, current_qty - r.quantity);

    insert into public.product_stock (product_id, location_id, quantity, updated_at)
    values (r.product_id, p_location_id, next_qty, now())
    on conflict (product_id, location_id)
    do update set quantity = excluded.quantity, updated_at = now();

    insert into public.stock_movements (product_id, location_id, order_id, quantity_delta, reason)
    values (r.product_id, p_location_id, p_order_id, -abs(r.quantity), p_reason);
  end loop;
end;
$$;

grant execute on function public.allocate_stock_for_order_shipment(uuid, uuid, text) to authenticated;

