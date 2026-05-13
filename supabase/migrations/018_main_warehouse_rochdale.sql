-- Consolidate default "Main Warehouse" (MAIN) into Lamtek HQ (Kirkby). Idempotent.
-- If HQ already exists: merge MAIN stock into HQ, remove MAIN row.
-- If only MAIN exists: promote MAIN to HQ with Kirkby address and phone.

do $$
declare
  main_id uuid;
  hq_id uuid;
begin
  select id into main_id from public.locations where code = 'MAIN' limit 1;
  select id into hq_id from public.locations where code = 'HQ' limit 1;

  if main_id is null then
    return;
  end if;

  if hq_id is not null and hq_id != main_id then
    insert into public.product_stock (product_id, location_id, quantity, updated_at)
    select product_id, hq_id, quantity, now()
    from public.product_stock
    where location_id = main_id
    on conflict (product_id, location_id) do update set
      quantity = public.product_stock.quantity + excluded.quantity,
      updated_at = now();
    delete from public.product_stock where location_id = main_id;
    delete from public.locations where id = main_id;
  else
    update public.locations
    set
      name = 'Kirkby-in-Ashfield (Head Office)',
      code = 'HQ',
      address = 'Lamtek Ltd, Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR',
      phone = '01623 759 856',
      opening_hours = 'Opening: Mon–Fri 7:15–16:30. Loading: Mon–Thu 7:15–15:45, Fri 7:15–12:45.',
      updated_at = now()
    where id = main_id;
  end if;
end $$;
