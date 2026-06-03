-- =============================================================================
-- Worked example: "1000 Base Unit (Dawson)" as Complete products + Components.
-- =============================================================================
-- Demonstrates the intended product architecture end to end:
--   * Components live in the catalogue as normal products (carcass, doors,
--     drawer fronts, hinges, plates, leg kit, fittings).
--   * Complete units are products too (catalog_program = 'tealbury') that own an
--     `assemblies` row (product_id set) + `assembly_lines` (the BOM). The
--     catalogue treats a product as "complete" when such an assembly exists.
--   * HL (high-line) and DL (drawer-line) are two variations of the same size.
--
-- Idempotent: guarded by SKU / slug, safe to re-run. Prices are PLACEHOLDERS —
-- replace with the real pricelist import.
--
-- Run with: psql "$DATABASE_URL" -f scripts/seed/tealbury-example.sql
-- (or executed directly against the remote DB).
-- =============================================================================

do $$
declare
  cat_carcass uuid;
  cat_doors uuid;
  cat_drawer uuid;
  cat_hinges uuid;
  cat_dawson uuid;

  p_carcass uuid;
  p_door uuid;
  p_dfront uuid;
  p_dboxkit uuid;
  p_hinge uuid;
  p_hplate uuid;
  p_legkit uuid;
  p_fittings uuid;
  p_hl uuid;
  p_dl uuid;

  a_hl uuid;
  a_dl uuid;
begin
  -- ---- Categories -----------------------------------------------------------
  select id into cat_carcass from public.categories where slug = 'carcasses';
  select id into cat_doors   from public.categories where slug = 'doors';
  select id into cat_drawer  from public.categories where slug = 'drawer-fronts';
  select id into cat_hinges  from public.categories where slug = 'hinges-fittings';

  -- Dawson kitchen range (door_range) so complete units browse under a range.
  insert into public.categories (name, slug, category_kind)
  select 'Dawson', 'dawson', 'door_range'
  where not exists (select 1 from public.categories where slug = 'dawson');
  select id into cat_dawson from public.categories where slug = 'dawson';

  -- ---- Component products ---------------------------------------------------
  -- Helper pattern: insert only if the SKU is absent, then resolve the id.

  insert into public.products (name, description, sku, unit_price, cost_price, category_id, part_type, catalog_program, is_stock, stock_quantity, options)
  select '1000 Base Carcass — White', '1000mm wide base carcass (white), 720h × 560d. Placeholder price.', 'CARC-B1000-WHI', 78.00, 58.50, cat_carcass, 'unit', 'lamtek', true, 25, '{"lamtek_dims_mm":{"w":1000,"h":720,"d":560}}'::jsonb
  where not exists (select 1 from public.products where sku = 'CARC-B1000-WHI');
  select id into p_carcass from public.products where sku = 'CARC-B1000-WHI' limit 1;

  insert into public.products (name, description, sku, unit_price, cost_price, category_id, part_type, catalog_program, is_stock, stock_quantity, options)
  select '715 × 497 Door — Dawson', 'Dawson range door, 715h × 497w. Placeholder price.', 'DOOR-DAW-715-497', 34.00, 24.00, cat_doors, 'door', 'lamtek', true, 40, '{"tealbury_door_range":"Dawson","lamtek_dims_mm":{"h":715,"w":497}}'::jsonb
  where not exists (select 1 from public.products where sku = 'DOOR-DAW-715-497');
  select id into p_door from public.products where sku = 'DOOR-DAW-715-497' limit 1;

  insert into public.products (name, description, sku, unit_price, cost_price, category_id, part_type, catalog_program, is_stock, stock_quantity, options)
  select '180 × 497 Drawer Front — Dawson', 'Dawson range drawer front, 180h × 497w. Placeholder price.', 'DF-DAW-180-497', 22.00, 15.50, cat_drawer, 'drawer', 'lamtek', true, 40, '{"tealbury_door_range":"Dawson","lamtek_dims_mm":{"h":180,"w":497}}'::jsonb
  where not exists (select 1 from public.products where sku = 'DF-DAW-180-497');
  select id into p_dfront from public.products where sku = 'DF-DAW-180-497' limit 1;

  insert into public.products (name, description, sku, unit_price, cost_price, category_id, part_type, catalog_program, is_stock, stock_quantity, options)
  select 'Drawer Box & Runner Kit — 500mm', 'Soft-close drawer box + runner pair, 500mm. Placeholder price.', 'DBOX-RUN-500', 18.00, 12.00, cat_hinges, 'fittings', 'lamtek', true, 60, '{}'::jsonb
  where not exists (select 1 from public.products where sku = 'DBOX-RUN-500');
  select id into p_dboxkit from public.products where sku = 'DBOX-RUN-500' limit 1;

  insert into public.products (name, description, sku, unit_price, cost_price, category_id, part_type, catalog_program, is_stock, stock_quantity, options)
  select 'Blum Clip-Top Hinge 110°', 'Soft-close concealed hinge. Placeholder price.', 'HINGE-BLUM-110', 2.40, 1.55, cat_hinges, 'hinge', 'lamtek', true, 500, '{}'::jsonb
  where not exists (select 1 from public.products where sku = 'HINGE-BLUM-110');
  select id into p_hinge from public.products where sku = 'HINGE-BLUM-110' limit 1;

  insert into public.products (name, description, sku, unit_price, cost_price, category_id, part_type, catalog_program, is_stock, stock_quantity, options)
  select 'Blum Hinge Mounting Plate', 'Cabinet-side mounting plate for clip-top hinge. Placeholder price.', 'HPLATE-BLUM', 1.10, 0.70, cat_hinges, 'hinge_plate', 'lamtek', true, 500, '{}'::jsonb
  where not exists (select 1 from public.products where sku = 'HPLATE-BLUM');
  select id into p_hplate from public.products where sku = 'HPLATE-BLUM' limit 1;

  insert into public.products (name, description, sku, unit_price, cost_price, category_id, part_type, catalog_program, is_stock, stock_quantity, options)
  select 'Adjustable Leg Set (×4)', 'Set of 4 adjustable cabinet legs. Placeholder price.', 'LEG-KIT-4', 6.50, 4.10, cat_hinges, 'leg_kit', 'lamtek', true, 120, '{}'::jsonb
  where not exists (select 1 from public.products where sku = 'LEG-KIT-4');
  select id into p_legkit from public.products where sku = 'LEG-KIT-4' limit 1;

  insert into public.products (name, description, sku, unit_price, cost_price, category_id, part_type, catalog_program, is_stock, stock_quantity, options)
  select 'Cabinet Fittings Pack', 'Screws, shelf pegs, cover caps. Placeholder price.', 'FIT-PACK', 4.20, 2.60, cat_hinges, 'fittings', 'lamtek', true, 200, '{}'::jsonb
  where not exists (select 1 from public.products where sku = 'FIT-PACK');
  select id into p_fittings from public.products where sku = 'FIT-PACK' limit 1;

  -- ---- Complete products (sellable units) -----------------------------------
  insert into public.products (name, description, sku, unit_price, cost_price, category_id, part_type, catalog_program, is_stock, stock_quantity, options)
  select '1000 HL Base Unit (Dawson)',
         'Complete high-line 1000mm base unit in the Dawson range: carcass, 2 doors, hinges, legs and fittings. Placeholder price.',
         'B1000-HL-DAW', 165.00, 118.00, cat_dawson, null, 'tealbury', false, 0,
         '{"tealbury_trade_code":"B100","tealbury_door_range":"Dawson","tealbury_dims_mm":{"w":1000,"h":720,"d":560},"build_line_style":"high_line"}'::jsonb
  where not exists (select 1 from public.products where sku = 'B1000-HL-DAW');
  select id into p_hl from public.products where sku = 'B1000-HL-DAW' limit 1;

  insert into public.products (name, description, sku, unit_price, cost_price, category_id, part_type, catalog_program, is_stock, stock_quantity, options)
  select '1000 DL Base Unit (Dawson)',
         'Complete drawer-line 1000mm base unit in the Dawson range: carcass, 3 drawer fronts, drawer boxes, legs and fittings. Placeholder price.',
         'B1000-DL-DAW', 210.00, 150.00, cat_dawson, null, 'tealbury', false, 0,
         '{"tealbury_trade_code":"B100","tealbury_door_range":"Dawson","tealbury_dims_mm":{"w":1000,"h":720,"d":560},"build_line_style":"drawer_line"}'::jsonb
  where not exists (select 1 from public.products where sku = 'B1000-DL-DAW');
  select id into p_dl from public.products where sku = 'B1000-DL-DAW' limit 1;

  -- ---- Assemblies (BOM headers) ---------------------------------------------
  insert into public.assemblies (name, description, product_id, unit_type, width_mm, active)
  select '1000 HL Base Unit (Dawson)', 'BOM for the high-line 1000 base unit.', p_hl, 'base_unit', 1000, true
  where not exists (select 1 from public.assemblies where product_id = p_hl);
  select id into a_hl from public.assemblies where product_id = p_hl limit 1;

  insert into public.assemblies (name, description, product_id, unit_type, width_mm, active)
  select '1000 DL Base Unit (Dawson)', 'BOM for the drawer-line 1000 base unit.', p_dl, 'base_unit', 1000, true
  where not exists (select 1 from public.assemblies where product_id = p_dl);
  select id into a_dl from public.assemblies where product_id = p_dl limit 1;

  -- ---- BOM lines (idempotent upsert on (assembly_id, product_id)) ------------
  insert into public.assembly_lines (assembly_id, product_id, quantity, component_role, sort_order) values
    (a_hl, p_carcass,  1, 'unit',        0),
    (a_hl, p_door,     2, 'door',        1),
    (a_hl, p_hinge,    4, 'hinge',       2),
    (a_hl, p_hplate,   4, 'hinge_plate', 3),
    (a_hl, p_legkit,   1, 'leg_kit',     4),
    (a_hl, p_fittings, 1, 'fittings',    5)
  on conflict (assembly_id, product_id) do update
    set quantity = excluded.quantity,
        component_role = excluded.component_role,
        sort_order = excluded.sort_order;

  insert into public.assembly_lines (assembly_id, product_id, quantity, component_role, sort_order) values
    (a_dl, p_carcass,  1, 'unit',     0),
    (a_dl, p_dfront,   3, 'drawer',   1),
    (a_dl, p_dboxkit,  3, 'fittings', 2),
    (a_dl, p_legkit,   1, 'leg_kit',  3),
    (a_dl, p_fittings, 1, 'fittings', 4)
  on conflict (assembly_id, product_id) do update
    set quantity = excluded.quantity,
        component_role = excluded.component_role,
        sort_order = excluded.sort_order;
end $$;
