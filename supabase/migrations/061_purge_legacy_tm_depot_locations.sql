-- Purge leftover Trade Mouldings–era depot rows (ROC / COOK / DUB / MAIN and obvious TM copy).
-- Merges product_stock into Lamtek HQ, repoints collection/shipment FKs to HQ, sets legacy rows inactive.
do $$
declare
  hq_id uuid;
  rec record;
  kirkby_address text := 'Lamtek Ltd, Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR';
  kirkby_hours text := 'Opening: Mon–Fri 7:15–16:30. Loading: Mon–Thu 7:15–15:45, Fri 7:15–12:45.';
begin
  select l.id into hq_id from public.locations l where l.code = 'HQ' limit 1;
  if hq_id is null then
    select l.id into hq_id from public.locations l where upper(trim(coalesce(l.code, ''))) = 'ROC' limit 1;
  end if;
  if hq_id is null then
    select l.id into hq_id from public.locations l where upper(trim(coalesce(l.code, ''))) = 'MAIN' limit 1;
  end if;

  if hq_id is null then
    insert into public.locations (name, code, address, phone, opening_hours, sort_order, active)
    values ('Kirkby-in-Ashfield (Head Office)', 'HQ', kirkby_address, '01623 759 856', kirkby_hours, 0, true)
    returning id into hq_id;
  end if;

  for rec in
    select l.id as loc_id
    from public.locations l
    where l.active = true
      and l.id <> hq_id
      and coalesce(upper(trim(l.code)), '') not in ('HQ', 'LC', 'TB')
      and (
        upper(trim(coalesce(l.code, ''))) in ('ROC', 'COOK', 'DUB', 'MAIN')
        or lower(coalesce(l.name, '') || coalesce(l.address, '')) like '%trade%mould%'
      )
  loop
    insert into public.product_stock (product_id, location_id, quantity, updated_at)
    select ps.product_id, hq_id, ps.quantity, now()
    from public.product_stock ps
    where ps.location_id = rec.loc_id
    on conflict (product_id, location_id) do update set
      quantity = public.product_stock.quantity + excluded.quantity,
      updated_at = now();

    delete from public.product_stock ps where ps.location_id = rec.loc_id;

    update public.orders set collection_location_id = hq_id where collection_location_id = rec.loc_id;
    update public.shipments set location_id = hq_id where location_id = rec.loc_id;

    update public.locations
    set active = false, code = null, updated_at = now()
    where id = rec.loc_id;
  end loop;
end $$;
