-- Replace legacy Trade Mouldings / Rochdale / ROI-only depot rows with Lamtek HQ (Kirkby) + Lamtek Complete (LC).
-- Does not DELETE locations (preserves stock_movements FK). Merges product_stock into HQ; deactivates extras.

do $$
declare
  hq_id uuid;
  lc_id uuid;
  tb_id uuid;
  rec record;
  kirkby_address text := 'Lamtek Ltd, Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR';
  kirkby_hours text := 'Opening: Mon–Fri 7:15–16:30. Loading: Mon–Thu 7:15–15:45, Fri 7:15–12:45.';
  lc_address text := 'Laminating Technology Ltd, Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR';
  lc_hours text := 'Trade kitchens & doors: phone 01543 466454. Loading by arrangement — see lamtekcomplete.co.uk.';
begin
  select l.id into hq_id from public.locations l where l.code = 'HQ' limit 1;
  if hq_id is null then
    select l.id into hq_id from public.locations l where l.code = 'ROC' limit 1;
  end if;
  if hq_id is null then
    select l.id into hq_id from public.locations l where l.code = 'MAIN' limit 1;
  end if;

  if hq_id is null then
    insert into public.locations (name, code, address, phone, opening_hours, sort_order, active)
    values (
      'Kirkby-in-Ashfield (Head Office)',
      'HQ',
      kirkby_address,
      '01623 759 856',
      kirkby_hours,
      0,
      true
    )
    returning id into hq_id;
  else
    update public.locations
    set
      name = 'Kirkby-in-Ashfield (Head Office)',
      code = 'HQ',
      address = kirkby_address,
      phone = '01623 759 856',
      opening_hours = kirkby_hours,
      sort_order = 0,
      active = true,
      updated_at = now()
    where id = hq_id;
  end if;

  select l.id into lc_id from public.locations l where l.code = 'LC' limit 1;
  if lc_id is null then
    insert into public.locations (name, code, address, phone, opening_hours, sort_order, active)
    values (
      'Lamtek Complete (trade kitchens)',
      'LC',
      lc_address,
      '01543 466454',
      lc_hours,
      1,
      true
    )
    returning id into lc_id;
  else
    update public.locations
    set
      name = 'Lamtek Complete (trade kitchens)',
      code = 'LC',
      address = lc_address,
      phone = '01543 466454',
      opening_hours = lc_hours,
      sort_order = 1,
      active = true,
      updated_at = now()
    where id = lc_id;
  end if;

  select l.id into tb_id from public.locations l where l.code = 'TB' limit 1;

  for rec in
    select l.id as loc_id
    from public.locations l
    where l.active = true
      and l.id <> hq_id
      and l.id <> lc_id
      and (tb_id is null or l.id <> tb_id)
  loop
    insert into public.product_stock (product_id, location_id, quantity, updated_at)
    select ps.product_id, hq_id, ps.quantity, now()
    from public.product_stock ps
    where ps.location_id = rec.loc_id
    on conflict (product_id, location_id) do update set
      quantity = public.product_stock.quantity + excluded.quantity,
      updated_at = now();

    delete from public.product_stock ps where ps.location_id = rec.loc_id;

    update public.orders
    set collection_location_id = hq_id
    where collection_location_id = rec.loc_id;

    update public.shipments
    set location_id = hq_id
    where location_id = rec.loc_id;

    update public.locations
    set
      active = false,
      code = null,
      updated_at = now()
    where id = rec.loc_id;
  end loop;
end $$;
