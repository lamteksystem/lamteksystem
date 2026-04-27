-- Extended catalogue: hundreds of products and extra categories (pricelist-style).
-- Run after seed_sample.sql and seed_components_and_assemblies.sql.

-- ========== NEW CATEGORIES ==========
insert into public.categories (name, slug, sort_order, parent_id) values
  ('Worktops', 'worktops', 28, null),
  ('End Panels & Fillers', 'end-panels-fillers', 29, null),
  ('Drawer Boxes', 'drawer-boxes', 30, null),
  ('Trims & Beading', 'trims-beading', 31, null),
  ('Sinks & Taps', 'sinks-taps', 32, null),
  ('Appliances', 'appliances', 33, null)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ========== DOOR MATRIX: Hadfield Painted 715mm height (base doors) – widths 196 to 996 ==========
do $$
declare
  w int;
  widths int[] := array[196, 246, 296, 346, 396, 446, 496, 546, 596, 646, 696, 796, 896, 996];
  cat_id uuid;
  base_price numeric := 28.00;
  sort_val int := 100;
begin
  select id into cat_id from public.categories where slug = 'doors' limit 1;
  foreach w in array widths loop
    insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
    select cat_id, 'Hadfield Painted 715 x ' || w, 'Door 715mm h x ' || w || 'mm w', 'HF-715-' || w,
      base_price + (w - 196) * 0.12, sort_val, '{"finish":"Painted","style":"Shaker"}'::jsonb
    where not exists (select 1 from public.products where sku = 'HF-715-' || w);
    sort_val := sort_val + 1;
  end loop;
end $$;

-- ========== DOOR MATRIX: Hadfield Painted 455mm (wall) – same widths ==========
do $$
declare
  w int;
  widths int[] := array[196, 246, 296, 346, 396, 446, 496, 546, 596, 646, 696, 796, 896, 996];
  cat_id uuid;
  base_price numeric := 24.00;
  sort_val int := 200;
begin
  select id into cat_id from public.categories where slug = 'doors' limit 1;
  foreach w in array widths loop
    insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
    select cat_id, 'Hadfield Painted 455 x ' || w, 'Wall door 455mm h x ' || w || 'mm w', 'HF-455-' || w,
      base_price + (w - 196) * 0.10, sort_val, '{"finish":"Painted","style":"Shaker"}'::jsonb
    where not exists (select 1 from public.products where sku = 'HF-455-' || w);
    sort_val := sort_val + 1;
  end loop;
end $$;

-- ========== DOOR MATRIX: Hadfield Drawer fronts 143mm – widths ==========
do $$
declare
  w int;
  widths int[] := array[296, 346, 396, 446, 496, 546, 596, 646, 696];
  cat_id uuid;
  base_price numeric := 22.00;
  sort_val int := 300;
begin
  select id into cat_id from public.categories where slug = 'doors' limit 1;
  foreach w in array widths loop
    insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
    select cat_id, 'Hadfield Painted Drawer 143 x ' || w, 'Drawer front 143mm h x ' || w || 'mm w', 'HF-DF-143-' || w,
      base_price + (w - 296) * 0.08, sort_val, '{"finish":"Painted","style":"Shaker"}'::jsonb
    where not exists (select 1 from public.products where sku = 'HF-DF-143-' || w);
    sort_val := sort_val + 1;
  end loop;
end $$;

-- ========== DOOR MATRIX: Oak Veneer 715mm and 455mm – same widths ==========
do $$
declare
  w int;
  widths int[] := array[196, 246, 296, 346, 396, 446, 496, 546, 596, 646, 696, 796, 896, 996];
  cat_id uuid;
  base_715 numeric := 38.00;
  base_455 numeric := 32.00;
  sort_715 int := 400;
  sort_455 int := 500;
begin
  select id into cat_id from public.categories where slug = 'doors' limit 1;
  foreach w in array widths loop
    insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
    select cat_id, 'Oak Veneer Shaker 715 x ' || w, 'Oak door 715mm h x ' || w || 'mm w', 'OAK-715-' || w,
      base_715 + (w - 196) * 0.14, sort_715, '{"finish":"Oak Veneer","style":"Shaker"}'::jsonb
    where not exists (select 1 from public.products where sku = 'OAK-715-' || w);
    insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
    select cat_id, 'Oak Veneer Shaker 455 x ' || w, 'Oak wall door 455mm h x ' || w || 'mm w', 'OAK-455-' || w,
      base_455 + (w - 196) * 0.11, sort_455, '{"finish":"Oak Veneer","style":"Shaker"}'::jsonb
    where not exists (select 1 from public.products where sku = 'OAK-455-' || w);
    sort_715 := sort_715 + 1;
    sort_455 := sort_455 + 1;
  end loop;
end $$;

-- ========== Painted Colour panels (110h, 175h) – multiple widths ==========
do $$
declare
  h int;
  ws int[];
  w int;
  cat_id uuid;
  sort_val int := 600;
begin
  select id into cat_id from public.categories where slug = 'doors' limit 1;
  for h in select unnest(array[110, 175]) loop
    ws := array[296, 346, 396, 446, 496, 546, 596, 646, 696, 796, 996];
    foreach w in array ws loop
      insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
      select cat_id, 'Painted Colour ' || h || ' x ' || w, 'Panel ' || h || 'mm h x ' || w || 'mm w', 'PC-' || h || '-' || w,
        16.00 + (h/100.0) + (w/100.0), sort_val, '{"finish":"Painted","style":"Shaker"}'::jsonb
      where not exists (select 1 from public.products where sku = 'PC-' || h || '-' || w);
      sort_val := sort_val + 1;
    end loop;
  end loop;
end $$;

-- ========== CARCASSES: extra widths (350, 450, 550, 700, 900) base, wall, tall ==========
do $$
declare
  w int;
  widths int[] := array[350, 450, 550, 700, 900];
  cat_id uuid;
  base_base numeric := 30.00;
  base_wall numeric := 25.00;
  base_tall numeric := 90.00;
  sort_b int := 50;
  sort_w int := 60;
  sort_t int := 70;
begin
  select id into cat_id from public.categories where slug = 'carcasses' limit 1;
  foreach w in array widths loop
    insert into public.products (category_id, name, description, sku, unit_price, sort_order)
    select cat_id, 'Base Unit Carcass ' || w || 'mm', 'Base unit ' || w || 'mm wide', 'CARC-BASE-' || w, base_base + (w - 300) * 0.08, sort_b
    where not exists (select 1 from public.products where sku = 'CARC-BASE-' || w);
    insert into public.products (category_id, name, description, sku, unit_price, sort_order)
    select cat_id, 'Wall Unit Carcass ' || w || 'mm', 'Wall unit ' || w || 'mm wide', 'CARC-WALL-' || w, base_wall + (w - 300) * 0.06, sort_w
    where not exists (select 1 from public.products where sku = 'CARC-WALL-' || w);
    insert into public.products (category_id, name, description, sku, unit_price, sort_order)
    select cat_id, 'Tall Unit Carcass ' || w || 'mm', 'Tall unit ' || w || 'mm wide', 'CARC-TALL-' || w, base_tall + (w - 300) * 0.25, sort_t
    where not exists (select 1 from public.products where sku = 'CARC-TALL-' || w);
    sort_b := sort_b + 1; sort_w := sort_w + 1; sort_t := sort_t + 1;
  end loop;
end $$;

-- ========== SHELVES: extra widths 350, 450, 550, 700, 900 ==========
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Adjustable Shelf 350mm', 'Adjustable shelf 350mm wide', 'SHELF-350', 4.75, 7 from public.categories c where c.slug = 'shelves-interiors' and not exists (select 1 from public.products where sku = 'SHELF-350') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Adjustable Shelf 450mm', 'Adjustable shelf 450mm wide', 'SHELF-450', 5.25, 8 from public.categories c where c.slug = 'shelves-interiors' and not exists (select 1 from public.products where sku = 'SHELF-450') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Adjustable Shelf 550mm', 'Adjustable shelf 550mm wide', 'SHELF-550', 5.75, 9 from public.categories c where c.slug = 'shelves-interiors' and not exists (select 1 from public.products where sku = 'SHELF-550') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Adjustable Shelf 700mm', 'Adjustable shelf 700mm wide', 'SHELF-700', 6.50, 10 from public.categories c where c.slug = 'shelves-interiors' and not exists (select 1 from public.products where sku = 'SHELF-700') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Adjustable Shelf 900mm', 'Adjustable shelf 900mm wide', 'SHELF-900', 8.00, 11 from public.categories c where c.slug = 'shelves-interiors' and not exists (select 1 from public.products where sku = 'SHELF-900') limit 1;

-- ========== HANDLES: extended matrix (length x finish) ==========
do $$
declare
  len int;
  lengths int[] := array[96, 128, 160, 192, 224, 256, 288, 320];
  finishes text[] := array['CH', 'MB', 'BB', 'SS'];
  fin_name text[] := array['Chrome', 'Matt Black', 'Brushed Brass', 'Stainless'];
  cat_id uuid;
  i int; j int;
  v_sku text; v_nm text; v_pr numeric;
begin
  select id into cat_id from public.categories where slug = 'handles' limit 1;
  for i in 1..array_length(lengths, 1) loop
    len := lengths[i];
    for j in 1..array_length(finishes, 1) loop
      v_sku := 'HND-' || len || '-' || finishes[j];
      v_nm := 'Handle Bar ' || len || 'mm ' || fin_name[j];
      v_pr := 2.20 + (len/100.0) * 1.5 + (j-1)*0.3;
      insert into public.products (category_id, name, description, sku, unit_price, sort_order)
      select cat_id, v_nm, v_nm, v_sku, v_pr, (i-1)*10 + j
      where not exists (select 1 from public.products p where p.sku = v_sku);
    end loop;
  end loop;
end $$;

-- ========== WORKTOPS (laminate by length x width) ==========
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Worktop Laminate 1500 x 600mm', 'Laminate worktop 1.5m x 600mm', 'WTOP-LAM-1500-600', 45.00, 1 from public.categories c where c.slug = 'worktops' and not exists (select 1 from public.products where sku = 'WTOP-LAM-1500-600') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Worktop Laminate 2000 x 600mm', 'Laminate worktop 2m x 600mm', 'WTOP-LAM-2000-600', 58.00, 2 from public.categories c where c.slug = 'worktops' and not exists (select 1 from public.products where sku = 'WTOP-LAM-2000-600') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Worktop Laminate 2500 x 600mm', 'Laminate worktop 2.5m x 600mm', 'WTOP-LAM-2500-600', 72.00, 3 from public.categories c where c.slug = 'worktops' and not exists (select 1 from public.products where sku = 'WTOP-LAM-2500-600') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Worktop Laminate 3000 x 600mm', 'Laminate worktop 3m x 600mm', 'WTOP-LAM-3000-600', 85.00, 4 from public.categories c where c.slug = 'worktops' and not exists (select 1 from public.products where sku = 'WTOP-LAM-3000-600') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Worktop Laminate 1500 x 650mm', 'Laminate worktop 1.5m x 650mm', 'WTOP-LAM-1500-650', 48.00, 5 from public.categories c where c.slug = 'worktops' and not exists (select 1 from public.products where sku = 'WTOP-LAM-1500-650') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Worktop Laminate 2000 x 650mm', 'Laminate worktop 2m x 650mm', 'WTOP-LAM-2000-650', 62.00, 6 from public.categories c where c.slug = 'worktops' and not exists (select 1 from public.products where sku = 'WTOP-LAM-2000-650') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Worktop Oak Effect 2000 x 600mm', 'Oak effect worktop 2m x 600mm', 'WTOP-OAK-2000-600', 95.00, 10 from public.categories c where c.slug = 'worktops' and not exists (select 1 from public.products where sku = 'WTOP-OAK-2000-600') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Worktop Oak Effect 3000 x 600mm', 'Oak effect worktop 3m x 600mm', 'WTOP-OAK-3000-600', 138.00, 11 from public.categories c where c.slug = 'worktops' and not exists (select 1 from public.products where sku = 'WTOP-OAK-3000-600') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Worktop Upstand 3000mm White', 'Upstand 3m white', 'WTOP-UP-3000-W', 22.00, 20 from public.categories c where c.slug = 'worktops' and not exists (select 1 from public.products where sku = 'WTOP-UP-3000-W') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Worktop Upstand 3000mm Black', 'Upstand 3m black', 'WTOP-UP-3000-B', 22.00, 21 from public.categories c where c.slug = 'worktops' and not exists (select 1 from public.products where sku = 'WTOP-UP-3000-B') limit 1;

-- ========== END PANELS & FILLERS ==========
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'End Panel 720 x 300mm', 'End panel 720mm h x 300mm w', 'EP-720-300', 18.00, 1 from public.categories c where c.slug = 'end-panels-fillers' and not exists (select 1 from public.products where sku = 'EP-720-300') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'End Panel 720 x 400mm', 'End panel 720mm h x 400mm w', 'EP-720-400', 22.00, 2 from public.categories c where c.slug = 'end-panels-fillers' and not exists (select 1 from public.products where sku = 'EP-720-400') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'End Panel 720 x 500mm', 'End panel 720mm h x 500mm w', 'EP-720-500', 26.00, 3 from public.categories c where c.slug = 'end-panels-fillers' and not exists (select 1 from public.products where sku = 'EP-720-500') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'End Panel 720 x 600mm', 'End panel 720mm h x 600mm w', 'EP-720-600', 30.00, 4 from public.categories c where c.slug = 'end-panels-fillers' and not exists (select 1 from public.products where sku = 'EP-720-600') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Filler Strip 20mm White', 'Filler strip 20mm white', 'FILL-20-W', 3.50, 10 from public.categories c where c.slug = 'end-panels-fillers' and not exists (select 1 from public.products where sku = 'FILL-20-W') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Filler Strip 50mm White', 'Filler strip 50mm white', 'FILL-50-W', 4.50, 11 from public.categories c where c.slug = 'end-panels-fillers' and not exists (select 1 from public.products where sku = 'FILL-50-W') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Filler Strip 20mm Black', 'Filler strip 20mm black', 'FILL-20-B', 3.50, 12 from public.categories c where c.slug = 'end-panels-fillers' and not exists (select 1 from public.products where sku = 'FILL-20-B') limit 1;

-- ========== DRAWER BOXES ==========
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Drawer Box 300mm', 'Drawer box 300mm', 'DBOX-300', 12.00, 1 from public.categories c where c.slug = 'drawer-boxes' and not exists (select 1 from public.products where sku = 'DBOX-300') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Drawer Box 400mm', 'Drawer box 400mm', 'DBOX-400', 14.00, 2 from public.categories c where c.slug = 'drawer-boxes' and not exists (select 1 from public.products where sku = 'DBOX-400') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Drawer Box 500mm', 'Drawer box 500mm', 'DBOX-500', 16.00, 3 from public.categories c where c.slug = 'drawer-boxes' and not exists (select 1 from public.products where sku = 'DBOX-500') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Drawer Box 600mm', 'Drawer box 600mm', 'DBOX-600', 18.00, 4 from public.categories c where c.slug = 'drawer-boxes' and not exists (select 1 from public.products where sku = 'DBOX-600') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Drawer Box Soft-Close 300mm', 'Drawer box 300mm soft-close', 'DBOX-SC-300', 18.00, 10 from public.categories c where c.slug = 'drawer-boxes' and not exists (select 1 from public.products where sku = 'DBOX-SC-300') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Drawer Box Soft-Close 400mm', 'Drawer box 400mm soft-close', 'DBOX-SC-400', 21.00, 11 from public.categories c where c.slug = 'drawer-boxes' and not exists (select 1 from public.products where sku = 'DBOX-SC-400') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Drawer Box Soft-Close 500mm', 'Drawer box 500mm soft-close', 'DBOX-SC-500', 24.00, 12 from public.categories c where c.slug = 'drawer-boxes' and not exists (select 1 from public.products where sku = 'DBOX-SC-500') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Drawer Box Soft-Close 600mm', 'Drawer box 600mm soft-close', 'DBOX-SC-600', 28.00, 13 from public.categories c where c.slug = 'drawer-boxes' and not exists (select 1 from public.products where sku = 'DBOX-SC-600') limit 1;

-- ========== TRIMS & BEADING ==========
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Quadrant Bead 2.4m White', 'Quadrant bead 2.4m white', 'TRIM-QB-24-W', 4.00, 1 from public.categories c where c.slug = 'trims-beading' and not exists (select 1 from public.products where sku = 'TRIM-QB-24-W') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Quadrant Bead 2.4m Black', 'Quadrant bead 2.4m black', 'TRIM-QB-24-B', 4.00, 2 from public.categories c where c.slug = 'trims-beading' and not exists (select 1 from public.products where sku = 'TRIM-QB-24-B') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Worktop Joint Strip 2.4m', 'Joint strip 2.4m', 'TRIM-JS-24', 8.50, 10 from public.categories c where c.slug = 'trims-beading' and not exists (select 1 from public.products where sku = 'TRIM-JS-24') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'End Cap White', 'End cap white', 'TRIM-EC-W', 1.20, 20 from public.categories c where c.slug = 'trims-beading' and not exists (select 1 from public.products where sku = 'TRIM-EC-W') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'End Cap Chrome', 'End cap chrome', 'TRIM-EC-CH', 1.50, 21 from public.categories c where c.slug = 'trims-beading' and not exists (select 1 from public.products where sku = 'TRIM-EC-CH') limit 1;

-- ========== SINKS & TAPS ==========
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, '1.5 Bowl Sink Stainless', '1.5 bowl sink stainless steel', 'SINK-15-SS', 85.00, 1 from public.categories c where c.slug = 'sinks-taps' and not exists (select 1 from public.products where sku = 'SINK-15-SS') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Single Bowl Sink Stainless', 'Single bowl sink stainless', 'SINK-1-SS', 65.00, 2 from public.categories c where c.slug = 'sinks-taps' and not exists (select 1 from public.products where sku = 'SINK-1-SS') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Double Bowl Sink Stainless', 'Double bowl sink stainless', 'SINK-2-SS', 120.00, 3 from public.categories c where c.slug = 'sinks-taps' and not exists (select 1 from public.products where sku = 'SINK-2-SS') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Mixer Tap Chrome', 'Kitchen mixer tap chrome', 'TAP-MIX-CH', 45.00, 10 from public.categories c where c.slug = 'sinks-taps' and not exists (select 1 from public.products where sku = 'TAP-MIX-CH') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Mixer Tap Matt Black', 'Kitchen mixer tap matt black', 'TAP-MIX-MB', 55.00, 11 from public.categories c where c.slug = 'sinks-taps' and not exists (select 1 from public.products where sku = 'TAP-MIX-MB') limit 1;

-- ========== PLINTH: more lengths and colours ==========
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Plinth 2.4m White', 'Plinth strip 2.4m white', 'PLINTH-24-W', 14.00, 4 from public.categories c where c.slug = 'legs-plinth' and not exists (select 1 from public.products where sku = 'PLINTH-24-W') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Plinth 2.4m Black', 'Plinth strip 2.4m black', 'PLINTH-24-B', 14.00, 5 from public.categories c where c.slug = 'legs-plinth' and not exists (select 1 from public.products where sku = 'PLINTH-24-B') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Plinth 4m White', 'Plinth strip 4m white', 'PLINTH-4M-W', 24.00, 6 from public.categories c where c.slug = 'legs-plinth' and not exists (select 1 from public.products where sku = 'PLINTH-4M-W') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Plinth 4m Black', 'Plinth strip 4m black', 'PLINTH-4M-B', 24.00, 7 from public.categories c where c.slug = 'legs-plinth' and not exists (select 1 from public.products where sku = 'PLINTH-4M-B') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Plinth 3m Grey', 'Plinth strip 3m grey', 'PLINTH-3M-G', 18.00, 8 from public.categories c where c.slug = 'legs-plinth' and not exists (select 1 from public.products where sku = 'PLINTH-3M-G') limit 1;

-- ========== HINGES: more types ==========
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hinge 120° Soft Close', 'Hinge 120 degree soft close', 'HINGE-120-SC', 1.25, 5 from public.categories c where c.slug = 'hinges-fittings' and not exists (select 1 from public.products where sku = 'HINGE-120-SC') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hinge 155° Soft Close', 'Hinge 155 degree soft close', 'HINGE-155-SC', 1.38, 6 from public.categories c where c.slug = 'hinges-fittings' and not exists (select 1 from public.products where sku = 'HINGE-155-SC') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hinge Backplate 0mm', 'Backplate 0mm', 'HINGE-BP-0', 0.25, 7 from public.categories c where c.slug = 'hinges-fittings' and not exists (select 1 from public.products where sku = 'HINGE-BP-0') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Fittings Pack Large', 'Fittings pack large unit', 'FIT-PACK-L', 3.50, 10 from public.categories c where c.slug = 'hinges-fittings' and not exists (select 1 from public.products where sku = 'FIT-PACK-L') limit 1;

-- ========== WIREWORK: more sizes ==========
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wire Basket 300mm', 'Wire basket pull-out 300mm', 'WIRE-BASKET-300', 14.00, 5 from public.categories c where c.slug = 'wirework' and not exists (select 1 from public.products where sku = 'WIRE-BASKET-300') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wire Basket 600mm', 'Wire basket pull-out 600mm', 'WIRE-BASKET-600', 25.00, 6 from public.categories c where c.slug = 'wirework' and not exists (select 1 from public.products where sku = 'WIRE-BASKET-600') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wire Shelf 400mm', 'Wire pull-out shelf 400mm', 'WIRE-SHELF-400', 14.00, 7 from public.categories c where c.slug = 'wirework' and not exists (select 1 from public.products where sku = 'WIRE-SHELF-400') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wire Shelf 800mm', 'Wire pull-out shelf 800mm', 'WIRE-SHELF-800', 24.00, 8 from public.categories c where c.slug = 'wirework' and not exists (select 1 from public.products where sku = 'WIRE-SHELF-800') limit 1;

-- ========== LIGHTING: more ==========
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'LED Strip 500mm', 'LED strip 500mm', 'LED-STRIP-500', 8.00, 5 from public.categories c where c.slug = 'lighting' and not exists (select 1 from public.products where sku = 'LED-STRIP-500') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'LED Strip 2m', 'LED strip 2m', 'LED-STRIP-2M', 22.00, 6 from public.categories c where c.slug = 'lighting' and not exists (select 1 from public.products where sku = 'LED-STRIP-2M') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Under-Cabinet LED 400mm', 'Under-cabinet LED 400mm', 'LED-UNDER-400', 15.00, 7 from public.categories c where c.slug = 'lighting' and not exists (select 1 from public.products where sku = 'LED-UNDER-400') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Under-Cabinet LED 1000mm', 'Under-cabinet LED 1000mm', 'LED-UNDER-1000', 32.00, 8 from public.categories c where c.slug = 'lighting' and not exists (select 1 from public.products where sku = 'LED-UNDER-1000') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Puck Light Set (6)', 'Set of 6 LED puck lights', 'LED-PUCK-6', 52.00, 9 from public.categories c where c.slug = 'lighting' and not exists (select 1 from public.products where sku = 'LED-PUCK-6') limit 1;