-- Main warehouse is Rochdale (Head Office). Consolidate "Main Warehouse" (MAIN) into Rochdale.
-- If ROC already exists: merge product_stock (add MAIN qty into ROC), delete MAIN rows, delete MAIN location.
-- If only MAIN exists: update MAIN to Rochdale details and set code = ROC.

do $$
declare
  main_id uuid;
  roc_id uuid;
begin
  select id into main_id from public.locations where code = 'MAIN' limit 1;
  select id into roc_id from public.locations where code = 'ROC' limit 1;

  if main_id is null then
    return; -- nothing to do
  end if;

  if roc_id is not null and roc_id != main_id then
    -- Merge product_stock: add MAIN quantities into ROC (ON CONFLICT sum), then delete MAIN rows
    insert into public.product_stock (product_id, location_id, quantity, updated_at)
    select product_id, roc_id, quantity, now()
    from public.product_stock
    where location_id = main_id
    on conflict (product_id, location_id) do update set
      quantity = public.product_stock.quantity + excluded.quantity,
      updated_at = now();
    delete from public.product_stock where location_id = main_id;
    delete from public.locations where id = main_id;
  else
    -- Update MAIN to Rochdale (Head Office) details
    update public.locations
    set
      name = 'Rochdale (Head Office)',
      code = 'ROC',
      address = 'Unit N1, Kingsway Business Park, Michael Faraday Avenue, Rochdale, Lancashire OL16 4GR',
      phone = '+44 (0)1706 753600',
      opening_hours = 'Mon–Thu: 8.30–5.00pm, Fri: 8.30–4.00pm',
      updated_at = now()
    where id = main_id;
  end if;
end $$;
