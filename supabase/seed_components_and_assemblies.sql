-- Component products and Complete-unit assemblies (brochure/pricelist structure).
-- Run after 001_schema, 004_assemblies. Depends on categories from seed_sample (doors, units, handles, etc.).

-- 1) Extra categories if not present
insert into public.categories (name, slug, sort_order, parent_id) values
  ('Carcasses', 'carcasses', 15, null),
  ('Hinges & Fittings', 'hinges-fittings', 25, null),
  ('Legs & Plinth', 'legs-plinth', 26, null)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- 2) Component products (Doors, Carcasses, Hinges, Legs, Fittings - representative from brochure/pricelist)
-- Doors (Hadfield Painted / Painted Colour)
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hadfield Painted 715 x 395', 'Door 715mm h x 395mm w', 'HF-715-395', 48.69, 1 from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-715-395') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hadfield Painted 715 x 495', 'Door 715mm h x 495mm w', 'HF-715-495', 53.63, 2 from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-715-495') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hadfield Painted 715 x 595', 'Door 715mm h x 595mm w', 'HF-715-595', 62.66, 3 from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-715-595') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Painted Colour 110 x 595', 'Panel 110mm h x 595mm w', 'PC-110-595', 20.86, 10 from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'PC-110-595') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Painted Colour 175 x 495', 'Panel 175mm h x 495mm w', 'PC-175-495', 21.80, 11 from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'PC-175-495') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hadfield Painted 715 x 596', 'Door 715mm h x 596mm w (for 600mm unit)', 'HF-715-596', 62.66, 4 from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-715-596') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hadfield Painted 715 x 496', 'Door 715mm h x 496mm w (for 500mm unit)', 'HF-715-496', 53.63, 5 from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-715-496') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hadfield Painted 715 x 396', 'Door 715mm h x 396mm w (for 400mm unit)', 'HF-715-396', 48.69, 6 from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-715-396') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hadfield Painted 715 x 296', 'Door 715mm h x 296mm w (for 300mm unit)', 'HF-715-296', 35.09, 7 from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-715-296') limit 1;

-- Carcasses (base units by width)
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Base Unit Carcass 300mm', 'Base unit 300mm wide', 'CARC-BASE-300', 28.50, 1 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-BASE-300') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Base Unit Carcass 400mm', 'Base unit 400mm wide', 'CARC-BASE-400', 32.00, 2 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-BASE-400') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Base Unit Carcass 500mm', 'Base unit 500mm wide', 'CARC-BASE-500', 36.00, 3 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-BASE-500') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Base Unit Carcass 600mm', 'Base unit 600mm wide', 'CARC-BASE-600', 42.00, 4 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-BASE-600') limit 1;

-- Hinges & Fittings
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hinge 90° Soft Close', 'Hinge 90 degree soft close', 'HINGE-90-SC', 1.18, 1 from public.categories c where c.slug = 'hinges-fittings' and not exists (select 1 from public.products where sku = 'HINGE-90-SC') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hinge Backplate Cam Adj Screw Fix (18)', 'Backplate for hinge', 'HINGE-BP-01', 0.29, 2 from public.categories c where c.slug = 'hinges-fittings' and not exists (select 1 from public.products where sku = 'HINGE-BP-01') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Fittings Pack (screws, dowels)', 'Standard fittings pack per unit', 'FIT-PACK-1', 2.50, 3 from public.categories c where c.slug = 'hinges-fittings' and not exists (select 1 from public.products where sku = 'FIT-PACK-1') limit 1;

-- Legs & Plinth
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Leg Pack (4 legs)', 'Leg pack for base unit', 'LEG-PACK-1', 4.99, 1 from public.categories c where c.slug = 'legs-plinth' and not exists (select 1 from public.products where sku = 'LEG-PACK-1') limit 1;

-- 3) Assemblies (Complete units): 300/400/500/600 base unit with Hadfield Painted door + hinges + leg pack + fittings
insert into public.assemblies (name, description, unit_type, width_mm, collection_slug, sort_order)
values
  ('300mm Base Unit – Hadfield Painted', 'Complete: carcass, door 715×296, hinges, leg pack, fittings', 'base_unit', 300, 'hadfield_painted', 10),
  ('400mm Base Unit – Hadfield Painted', 'Complete: carcass, door 715×396, hinges, leg pack, fittings', 'base_unit', 400, 'hadfield_painted', 20),
  ('500mm Base Unit – Hadfield Painted', 'Complete: carcass, door 715×496, hinges, leg pack, fittings', 'base_unit', 500, 'hadfield_painted', 30),
  ('600mm Base Unit – Hadfield Painted', 'Complete: carcass, door 715×596, hinges, leg pack, fittings', 'base_unit', 600, 'hadfield_painted', 40);

-- 4) Assembly lines: link assemblies to products (by sku). Requires products to exist with these skus.
-- 300mm base
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '300mm Base Unit – Hadfield Painted' and p.sku = 'CARC-BASE-300'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '300mm Base Unit – Hadfield Painted' and p.sku = 'HF-715-296'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '300mm Base Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '300mm Base Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '300mm Base Unit – Hadfield Painted' and p.sku = 'LEG-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 6 from public.assemblies a, public.products p where a.name = '300mm Base Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '400mm Base Unit – Hadfield Painted' and p.sku = 'CARC-BASE-400'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '400mm Base Unit – Hadfield Painted' and p.sku = 'HF-715-396'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '400mm Base Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '400mm Base Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '400mm Base Unit – Hadfield Painted' and p.sku = 'LEG-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 6 from public.assemblies a, public.products p where a.name = '400mm Base Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '500mm Base Unit – Hadfield Painted' and p.sku = 'CARC-BASE-500'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '500mm Base Unit – Hadfield Painted' and p.sku = 'HF-715-496'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '500mm Base Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '500mm Base Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '500mm Base Unit – Hadfield Painted' and p.sku = 'LEG-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 6 from public.assemblies a, public.products p where a.name = '500mm Base Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '600mm Base Unit – Hadfield Painted' and p.sku = 'CARC-BASE-600'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '600mm Base Unit – Hadfield Painted' and p.sku = 'HF-715-596'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '600mm Base Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '600mm Base Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '600mm Base Unit – Hadfield Painted' and p.sku = 'LEG-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 6 from public.assemblies a, public.products p where a.name = '600mm Base Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

-- 5) Wall unit carcasses
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wall Unit Carcass 300mm', 'Wall unit 300mm wide', 'CARC-WALL-300', 24.00, 10 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-WALL-300') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wall Unit Carcass 400mm', 'Wall unit 400mm wide', 'CARC-WALL-400', 27.00, 11 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-WALL-400') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wall Unit Carcass 500mm', 'Wall unit 500mm wide', 'CARC-WALL-500', 30.00, 12 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-WALL-500') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wall Unit Carcass 600mm', 'Wall unit 600mm wide', 'CARC-WALL-600', 34.00, 13 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-WALL-600') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wall Unit Carcass 800mm', 'Wall unit 800mm wide', 'CARC-WALL-800', 42.00, 14 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-WALL-800') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wall Unit Carcass 1000mm', 'Wall unit 1000mm wide', 'CARC-WALL-1000', 50.00, 15 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-WALL-1000') limit 1;

-- 6) Tall unit carcass
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Tall Unit Carcass 300mm', 'Tall unit 300mm wide', 'CARC-TALL-300', 85.00, 20 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-TALL-300') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Tall Unit Carcass 400mm', 'Tall unit 400mm wide', 'CARC-TALL-400', 95.00, 21 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-TALL-400') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Tall Unit Carcass 500mm', 'Tall unit 500mm wide', 'CARC-TALL-500', 108.00, 22 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-TALL-500') limit 1;

-- 7) Wall unit doors (455mm height – typical wall unit)
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Hadfield Painted 455 x 296', 'Wall door 455mm h x 296mm w', 'HF-455-296', 32.00, 20, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-455-296') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Hadfield Painted 455 x 396', 'Wall door 455mm h x 396mm w', 'HF-455-396', 36.50, 21, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-455-396') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Hadfield Painted 455 x 496', 'Wall door 455mm h x 496mm w', 'HF-455-496', 42.00, 22, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-455-496') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Hadfield Painted 455 x 596', 'Wall door 455mm h x 596mm w', 'HF-455-596', 48.00, 23, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-455-596') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Hadfield Painted 455 x 796', 'Wall door 455mm h x 796mm w', 'HF-455-796', 58.00, 24, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-455-796') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Hadfield Painted 455 x 996', 'Wall door 455mm h x 996mm w', 'HF-455-996', 72.00, 25, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-455-996') limit 1;

-- 8) Drawer front
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Hadfield Painted Drawer Front 143 x 396', 'Drawer front 143mm h x 396mm w', 'HF-DF-143-396', 28.00, 30, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-DF-143-396') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Hadfield Painted Drawer Front 143 x 496', 'Drawer front 143mm h x 496mm w', 'HF-DF-143-496', 32.00, 31, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-DF-143-496') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Hadfield Painted Drawer Front 143 x 596', 'Drawer front 143mm h x 596mm w', 'HF-DF-143-596', 36.00, 32, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-DF-143-596') limit 1;

-- 9) Handles (handles category from seed_sample)
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Handle Bar 128mm Chrome', 'Handle bar 128mm chrome', 'HND-128-CH', 3.50, 1 from public.categories c where c.slug = 'handles' and not exists (select 1 from public.products where sku = 'HND-128-CH') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Handle Bar 128mm Matt Black', 'Handle bar 128mm matt black', 'HND-128-MB', 3.50, 2 from public.categories c where c.slug = 'handles' and not exists (select 1 from public.products where sku = 'HND-128-MB') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Handle Bar 256mm Chrome', 'Handle bar 256mm chrome', 'HND-256-CH', 5.25, 3 from public.categories c where c.slug = 'handles' and not exists (select 1 from public.products where sku = 'HND-256-CH') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Handle Knob Chrome', 'Handle knob chrome', 'HND-KNOB-CH', 2.20, 4 from public.categories c where c.slug = 'handles' and not exists (select 1 from public.products where sku = 'HND-KNOB-CH') limit 1;

-- 10) Plinth (lengths)
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Plinth 3m White', 'Plinth strip 3m white', 'PLINTH-3M-W', 18.00, 2 from public.categories c where c.slug = 'legs-plinth' and not exists (select 1 from public.products where sku = 'PLINTH-3M-W') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Plinth 3m Black', 'Plinth strip 3m black', 'PLINTH-3M-B', 18.00, 3 from public.categories c where c.slug = 'legs-plinth' and not exists (select 1 from public.products where sku = 'PLINTH-3M-B') limit 1;

-- 11) Options on existing Hadfield doors (finish/style for filters)
update public.products set options = '{"finish":"Painted","style":"Shaker"}'::jsonb where sku like 'HF-%' and (options is null or options = '{}'::jsonb);
update public.products set options = '{"finish":"Painted","style":"Shaker"}'::jsonb where sku like 'PC-%' and (options is null or options = '{}'::jsonb);

-- 12) Wall unit assemblies (300–600mm wall with 455h door)
insert into public.assemblies (name, description, unit_type, width_mm, collection_slug, sort_order)
values
  ('300mm Wall Unit – Hadfield Painted', 'Complete: wall carcass, door 455×296, hinges, fittings', 'wall_unit', 300, 'hadfield_painted', 50),
  ('400mm Wall Unit – Hadfield Painted', 'Complete: wall carcass, door 455×396, hinges, fittings', 'wall_unit', 400, 'hadfield_painted', 51),
  ('500mm Wall Unit – Hadfield Painted', 'Complete: wall carcass, door 455×496, hinges, fittings', 'wall_unit', 500, 'hadfield_painted', 52),
  ('600mm Wall Unit – Hadfield Painted', 'Complete: wall carcass, door 455×596, hinges, fittings', 'wall_unit', 600, 'hadfield_painted', 53);

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '300mm Wall Unit – Hadfield Painted' and p.sku = 'CARC-WALL-300'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '300mm Wall Unit – Hadfield Painted' and p.sku = 'HF-455-296'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '300mm Wall Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '300mm Wall Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '300mm Wall Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '400mm Wall Unit – Hadfield Painted' and p.sku = 'CARC-WALL-400'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '400mm Wall Unit – Hadfield Painted' and p.sku = 'HF-455-396'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '400mm Wall Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '400mm Wall Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '400mm Wall Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '500mm Wall Unit – Hadfield Painted' and p.sku = 'CARC-WALL-500'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '500mm Wall Unit – Hadfield Painted' and p.sku = 'HF-455-496'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '500mm Wall Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '500mm Wall Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '500mm Wall Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '600mm Wall Unit – Hadfield Painted' and p.sku = 'CARC-WALL-600'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '600mm Wall Unit – Hadfield Painted' and p.sku = 'HF-455-596'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '600mm Wall Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '600mm Wall Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '600mm Wall Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

-- ========== EXTENDED CATALOGUE ==========

-- 13) Extra categories
insert into public.categories (name, slug, sort_order, parent_id) values
  ('Shelves & Interiors', 'shelves-interiors', 27, null)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- 14) Base carcass 800mm, 1000mm
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Base Unit Carcass 800mm', 'Base unit 800mm wide', 'CARC-BASE-800', 52.00, 5 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-BASE-800') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Base Unit Carcass 1000mm', 'Base unit 1000mm wide', 'CARC-BASE-1000', 62.00, 6 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-BASE-1000') limit 1;

-- 15) Base doors for 800/1000mm units
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Hadfield Painted 715 x 796', 'Door 715mm h x 796mm w (for 800mm unit)', 'HF-715-796', 72.00, 8, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-715-796') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Hadfield Painted 715 x 996', 'Door 715mm h x 996mm w (for 1000mm unit)', 'HF-715-996', 88.00, 9, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'HF-715-996') limit 1;

-- 16) Tall unit carcass 600mm
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Tall Unit Carcass 600mm', 'Tall unit 600mm wide', 'CARC-TALL-600', 120.00, 23 from public.categories c where c.slug = 'carcasses' and not exists (select 1 from public.products where sku = 'CARC-TALL-600') limit 1;

-- 17) Shelves & interiors (adjustable shelves by width)
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Adjustable Shelf 300mm', 'Adjustable shelf 300mm wide', 'SHELF-300', 4.50, 1 from public.categories c where c.slug = 'shelves-interiors' and not exists (select 1 from public.products where sku = 'SHELF-300') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Adjustable Shelf 400mm', 'Adjustable shelf 400mm wide', 'SHELF-400', 5.00, 2 from public.categories c where c.slug = 'shelves-interiors' and not exists (select 1 from public.products where sku = 'SHELF-400') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Adjustable Shelf 500mm', 'Adjustable shelf 500mm wide', 'SHELF-500', 5.50, 3 from public.categories c where c.slug = 'shelves-interiors' and not exists (select 1 from public.products where sku = 'SHELF-500') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Adjustable Shelf 600mm', 'Adjustable shelf 600mm wide', 'SHELF-600', 6.00, 4 from public.categories c where c.slug = 'shelves-interiors' and not exists (select 1 from public.products where sku = 'SHELF-600') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Adjustable Shelf 800mm', 'Adjustable shelf 800mm wide', 'SHELF-800', 7.50, 5 from public.categories c where c.slug = 'shelves-interiors' and not exists (select 1 from public.products where sku = 'SHELF-800') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Adjustable Shelf 1000mm', 'Adjustable shelf 1000mm wide', 'SHELF-1000', 9.00, 6 from public.categories c where c.slug = 'shelves-interiors' and not exists (select 1 from public.products where sku = 'SHELF-1000') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Drawer Runner Set (1 pair)', 'Soft-close drawer runner set', 'RUNNER-SET-1', 8.50, 10 from public.categories c where c.slug = 'shelves-interiors' and not exists (select 1 from public.products where sku = 'RUNNER-SET-1') limit 1;

-- 18) Wirework
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wire Basket 500mm', 'Wire basket pull-out 500mm', 'WIRE-BASKET-500', 22.00, 1 from public.categories c where c.slug = 'wirework' and not exists (select 1 from public.products where sku = 'WIRE-BASKET-500') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wire Basket 400mm', 'Wire basket pull-out 400mm', 'WIRE-BASKET-400', 18.00, 2 from public.categories c where c.slug = 'wirework' and not exists (select 1 from public.products where sku = 'WIRE-BASKET-400') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wire Shelf 500mm', 'Wire pull-out shelf 500mm', 'WIRE-SHELF-500', 16.00, 3 from public.categories c where c.slug = 'wirework' and not exists (select 1 from public.products where sku = 'WIRE-SHELF-500') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Wire Shelf 600mm', 'Wire pull-out shelf 600mm', 'WIRE-SHELF-600', 19.00, 4 from public.categories c where c.slug = 'wirework' and not exists (select 1 from public.products where sku = 'WIRE-SHELF-600') limit 1;

-- 19) Lighting
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'LED Strip 1m', 'LED strip light 1 metre', 'LED-STRIP-1M', 12.00, 1 from public.categories c where c.slug = 'lighting' and not exists (select 1 from public.products where sku = 'LED-STRIP-1M') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Under-Cabinet LED 500mm', 'Under-cabinet LED 500mm', 'LED-UNDER-500', 18.00, 2 from public.categories c where c.slug = 'lighting' and not exists (select 1 from public.products where sku = 'LED-UNDER-500') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Under-Cabinet LED 700mm', 'Under-cabinet LED 700mm', 'LED-UNDER-700', 24.00, 3 from public.categories c where c.slug = 'lighting' and not exists (select 1 from public.products where sku = 'LED-UNDER-700') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Puck Light Set (3)', 'Set of 3 LED puck lights', 'LED-PUCK-3', 28.00, 4 from public.categories c where c.slug = 'lighting' and not exists (select 1 from public.products where sku = 'LED-PUCK-3') limit 1;

-- 20) More handles
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Handle Bar 160mm Chrome', 'Handle bar 160mm chrome', 'HND-160-CH', 4.00, 5 from public.categories c where c.slug = 'handles' and not exists (select 1 from public.products where sku = 'HND-160-CH') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Handle Bar 192mm Matt Black', 'Handle bar 192mm matt black', 'HND-192-MB', 4.50, 6 from public.categories c where c.slug = 'handles' and not exists (select 1 from public.products where sku = 'HND-192-MB') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Cup Pull Chrome', 'Cup pull chrome', 'HND-CUP-CH', 3.80, 7 from public.categories c where c.slug = 'handles' and not exists (select 1 from public.products where sku = 'HND-CUP-CH') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Handle Bar 256mm Matt Black', 'Handle bar 256mm matt black', 'HND-256-MB', 5.25, 8 from public.categories c where c.slug = 'handles' and not exists (select 1 from public.products where sku = 'HND-256-MB') limit 1;

-- 21) Oak Veneer door range (second collection)
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Oak Veneer Shaker 715 x 296', 'Oak veneer door 715×296mm', 'OAK-715-296', 42.00, 40, '{"finish":"Oak Veneer","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'OAK-715-296') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Oak Veneer Shaker 715 x 396', 'Oak veneer door 715×396mm', 'OAK-715-396', 48.00, 41, '{"finish":"Oak Veneer","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'OAK-715-396') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Oak Veneer Shaker 715 x 496', 'Oak veneer door 715×496mm', 'OAK-715-496', 55.00, 42, '{"finish":"Oak Veneer","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'OAK-715-496') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Oak Veneer Shaker 715 x 596', 'Oak veneer door 715×596mm', 'OAK-715-596', 65.00, 43, '{"finish":"Oak Veneer","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'OAK-715-596') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Oak Veneer Shaker 455 x 296', 'Oak veneer wall door 455×296mm', 'OAK-455-296', 35.00, 44, '{"finish":"Oak Veneer","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'OAK-455-296') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Oak Veneer Shaker 455 x 396', 'Oak veneer wall door 455×396mm', 'OAK-455-396', 40.00, 45, '{"finish":"Oak Veneer","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'OAK-455-396') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Oak Veneer Shaker 455 x 496', 'Oak veneer wall door 455×496mm', 'OAK-455-496', 46.00, 46, '{"finish":"Oak Veneer","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'OAK-455-496') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Oak Veneer Shaker 455 x 596', 'Oak veneer wall door 455×596mm', 'OAK-455-596', 52.00, 47, '{"finish":"Oak Veneer","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'OAK-455-596') limit 1;

-- 22) More Painted Colour panels (plinth/end panels)
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Painted Colour 110 x 396', 'Panel 110mm h x 396mm w', 'PC-110-396', 18.50, 12, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'PC-110-396') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Painted Colour 110 x 496', 'Panel 110mm h x 496mm w', 'PC-110-496', 19.50, 13, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'PC-110-496') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Painted Colour 175 x 396', 'Panel 175mm h x 396mm w', 'PC-175-396', 19.20, 14, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'PC-175-396') limit 1;
insert into public.products (category_id, name, description, sku, unit_price, sort_order, options)
select c.id, 'Painted Colour 175 x 596', 'Panel 175mm h x 596mm w', 'PC-175-596', 23.50, 15, '{"finish":"Painted","style":"Shaker"}'::jsonb from public.categories c where c.slug = 'doors' and not exists (select 1 from public.products where sku = 'PC-175-596') limit 1;

-- 23) Hinges: 170° for tall / full overlay
insert into public.products (category_id, name, description, sku, unit_price, sort_order)
select c.id, 'Hinge 170° Soft Close', 'Hinge 170 degree soft close', 'HINGE-170-SC', 1.45, 4 from public.categories c where c.slug = 'hinges-fittings' and not exists (select 1 from public.products where sku = 'HINGE-170-SC') limit 1;

-- 24) Base unit assemblies 800mm, 1000mm (Hadfield Painted)
insert into public.assemblies (name, description, unit_type, width_mm, collection_slug, sort_order)
values
  ('800mm Base Unit – Hadfield Painted', 'Complete: carcass, door 715×796, hinges, leg pack, fittings', 'base_unit', 800, 'hadfield_painted', 45),
  ('1000mm Base Unit – Hadfield Painted', 'Complete: carcass, door 715×996, hinges, leg pack, fittings', 'base_unit', 1000, 'hadfield_painted', 46);

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '800mm Base Unit – Hadfield Painted' and p.sku = 'CARC-BASE-800'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '800mm Base Unit – Hadfield Painted' and p.sku = 'HF-715-796'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '800mm Base Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '800mm Base Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '800mm Base Unit – Hadfield Painted' and p.sku = 'LEG-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 6 from public.assemblies a, public.products p where a.name = '800mm Base Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '1000mm Base Unit – Hadfield Painted' and p.sku = 'CARC-BASE-1000'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '1000mm Base Unit – Hadfield Painted' and p.sku = 'HF-715-996'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '1000mm Base Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '1000mm Base Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '1000mm Base Unit – Hadfield Painted' and p.sku = 'LEG-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 6 from public.assemblies a, public.products p where a.name = '1000mm Base Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

-- 25) Wall unit assemblies 800mm, 1000mm (Hadfield Painted)
insert into public.assemblies (name, description, unit_type, width_mm, collection_slug, sort_order)
values
  ('800mm Wall Unit – Hadfield Painted', 'Complete: wall carcass, door 455×796, hinges, fittings', 'wall_unit', 800, 'hadfield_painted', 54),
  ('1000mm Wall Unit – Hadfield Painted', 'Complete: wall carcass, door 455×996, hinges, fittings', 'wall_unit', 1000, 'hadfield_painted', 55);

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '800mm Wall Unit – Hadfield Painted' and p.sku = 'CARC-WALL-800'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '800mm Wall Unit – Hadfield Painted' and p.sku = 'HF-455-796'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '800mm Wall Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '800mm Wall Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '800mm Wall Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '1000mm Wall Unit – Hadfield Painted' and p.sku = 'CARC-WALL-1000'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '1000mm Wall Unit – Hadfield Painted' and p.sku = 'HF-455-996'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '1000mm Wall Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '1000mm Wall Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '1000mm Wall Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

-- 26) Tall unit assemblies (Hadfield Painted) – 2 doors + 4 hinges + 4 backplates + fittings + 2 shelves
insert into public.assemblies (name, description, unit_type, width_mm, collection_slug, sort_order)
values
  ('300mm Tall Unit – Hadfield Painted', 'Complete: tall carcass, 2× door 715×296, hinges, fittings, 2 shelves', 'tall_unit', 300, 'hadfield_painted', 60),
  ('400mm Tall Unit – Hadfield Painted', 'Complete: tall carcass, 2× door 715×396, hinges, fittings, 2 shelves', 'tall_unit', 400, 'hadfield_painted', 61),
  ('500mm Tall Unit – Hadfield Painted', 'Complete: tall carcass, 2× door 715×496, hinges, fittings, 2 shelves', 'tall_unit', 500, 'hadfield_painted', 62),
  ('600mm Tall Unit – Hadfield Painted', 'Complete: tall carcass, 2× door 715×596, hinges, fittings, 2 shelves', 'tall_unit', 600, 'hadfield_painted', 63);

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '300mm Tall Unit – Hadfield Painted' and p.sku = 'CARC-TALL-300'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 2 from public.assemblies a, public.products p where a.name = '300mm Tall Unit – Hadfield Painted' and p.sku = 'HF-715-296'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 4, 3 from public.assemblies a, public.products p where a.name = '300mm Tall Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 4, 4 from public.assemblies a, public.products p where a.name = '300mm Tall Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '300mm Tall Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 6 from public.assemblies a, public.products p where a.name = '300mm Tall Unit – Hadfield Painted' and p.sku = 'SHELF-300'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '400mm Tall Unit – Hadfield Painted' and p.sku = 'CARC-TALL-400'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 2 from public.assemblies a, public.products p where a.name = '400mm Tall Unit – Hadfield Painted' and p.sku = 'HF-715-396'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 4, 3 from public.assemblies a, public.products p where a.name = '400mm Tall Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 4, 4 from public.assemblies a, public.products p where a.name = '400mm Tall Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '400mm Tall Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 6 from public.assemblies a, public.products p where a.name = '400mm Tall Unit – Hadfield Painted' and p.sku = 'SHELF-400'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '500mm Tall Unit – Hadfield Painted' and p.sku = 'CARC-TALL-500'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 2 from public.assemblies a, public.products p where a.name = '500mm Tall Unit – Hadfield Painted' and p.sku = 'HF-715-496'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 4, 3 from public.assemblies a, public.products p where a.name = '500mm Tall Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 4, 4 from public.assemblies a, public.products p where a.name = '500mm Tall Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '500mm Tall Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 6 from public.assemblies a, public.products p where a.name = '500mm Tall Unit – Hadfield Painted' and p.sku = 'SHELF-500'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '600mm Tall Unit – Hadfield Painted' and p.sku = 'CARC-TALL-600'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 2 from public.assemblies a, public.products p where a.name = '600mm Tall Unit – Hadfield Painted' and p.sku = 'HF-715-596'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 4, 3 from public.assemblies a, public.products p where a.name = '600mm Tall Unit – Hadfield Painted' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 4, 4 from public.assemblies a, public.products p where a.name = '600mm Tall Unit – Hadfield Painted' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '600mm Tall Unit – Hadfield Painted' and p.sku = 'FIT-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 6 from public.assemblies a, public.products p where a.name = '600mm Tall Unit – Hadfield Painted' and p.sku = 'SHELF-600'
on conflict do nothing;

-- 27) Oak Veneer base unit assemblies (300–600mm)
insert into public.assemblies (name, description, unit_type, width_mm, collection_slug, sort_order)
values
  ('300mm Base Unit – Oak Veneer', 'Complete: carcass, oak door 715×296, hinges, leg pack, fittings', 'base_unit', 300, 'oak_veneer', 70),
  ('400mm Base Unit – Oak Veneer', 'Complete: carcass, oak door 715×396, hinges, leg pack, fittings', 'base_unit', 400, 'oak_veneer', 71),
  ('500mm Base Unit – Oak Veneer', 'Complete: carcass, oak door 715×496, hinges, leg pack, fittings', 'base_unit', 500, 'oak_veneer', 72),
  ('600mm Base Unit – Oak Veneer', 'Complete: carcass, oak door 715×596, hinges, leg pack, fittings', 'base_unit', 600, 'oak_veneer', 73);

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '300mm Base Unit – Oak Veneer' and p.sku = 'CARC-BASE-300'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '300mm Base Unit – Oak Veneer' and p.sku = 'OAK-715-296'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '300mm Base Unit – Oak Veneer' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '300mm Base Unit – Oak Veneer' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '300mm Base Unit – Oak Veneer' and p.sku = 'LEG-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 6 from public.assemblies a, public.products p where a.name = '300mm Base Unit – Oak Veneer' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '400mm Base Unit – Oak Veneer' and p.sku = 'CARC-BASE-400'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '400mm Base Unit – Oak Veneer' and p.sku = 'OAK-715-396'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '400mm Base Unit – Oak Veneer' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '400mm Base Unit – Oak Veneer' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '400mm Base Unit – Oak Veneer' and p.sku = 'LEG-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 6 from public.assemblies a, public.products p where a.name = '400mm Base Unit – Oak Veneer' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '500mm Base Unit – Oak Veneer' and p.sku = 'CARC-BASE-500'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '500mm Base Unit – Oak Veneer' and p.sku = 'OAK-715-496'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '500mm Base Unit – Oak Veneer' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '500mm Base Unit – Oak Veneer' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '500mm Base Unit – Oak Veneer' and p.sku = 'LEG-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 6 from public.assemblies a, public.products p where a.name = '500mm Base Unit – Oak Veneer' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '600mm Base Unit – Oak Veneer' and p.sku = 'CARC-BASE-600'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '600mm Base Unit – Oak Veneer' and p.sku = 'OAK-715-596'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '600mm Base Unit – Oak Veneer' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '600mm Base Unit – Oak Veneer' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '600mm Base Unit – Oak Veneer' and p.sku = 'LEG-PACK-1'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 6 from public.assemblies a, public.products p where a.name = '600mm Base Unit – Oak Veneer' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

-- 28) Oak Veneer wall unit assemblies (300–600mm)
insert into public.assemblies (name, description, unit_type, width_mm, collection_slug, sort_order)
values
  ('300mm Wall Unit – Oak Veneer', 'Complete: wall carcass, oak door 455×296, hinges, fittings', 'wall_unit', 300, 'oak_veneer', 74),
  ('400mm Wall Unit – Oak Veneer', 'Complete: wall carcass, oak door 455×396, hinges, fittings', 'wall_unit', 400, 'oak_veneer', 75),
  ('500mm Wall Unit – Oak Veneer', 'Complete: wall carcass, oak door 455×496, hinges, fittings', 'wall_unit', 500, 'oak_veneer', 76),
  ('600mm Wall Unit – Oak Veneer', 'Complete: wall carcass, oak door 455×596, hinges, fittings', 'wall_unit', 600, 'oak_veneer', 77);

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '300mm Wall Unit – Oak Veneer' and p.sku = 'CARC-WALL-300'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '300mm Wall Unit – Oak Veneer' and p.sku = 'OAK-455-296'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '300mm Wall Unit – Oak Veneer' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '300mm Wall Unit – Oak Veneer' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '300mm Wall Unit – Oak Veneer' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '400mm Wall Unit – Oak Veneer' and p.sku = 'CARC-WALL-400'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '400mm Wall Unit – Oak Veneer' and p.sku = 'OAK-455-396'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '400mm Wall Unit – Oak Veneer' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '400mm Wall Unit – Oak Veneer' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '400mm Wall Unit – Oak Veneer' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '500mm Wall Unit – Oak Veneer' and p.sku = 'CARC-WALL-500'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '500mm Wall Unit – Oak Veneer' and p.sku = 'OAK-455-496'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '500mm Wall Unit – Oak Veneer' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '500mm Wall Unit – Oak Veneer' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '500mm Wall Unit – Oak Veneer' and p.sku = 'FIT-PACK-1'
on conflict do nothing;

insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 1 from public.assemblies a, public.products p where a.name = '600mm Wall Unit – Oak Veneer' and p.sku = 'CARC-WALL-600'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 2 from public.assemblies a, public.products p where a.name = '600mm Wall Unit – Oak Veneer' and p.sku = 'OAK-455-596'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 3 from public.assemblies a, public.products p where a.name = '600mm Wall Unit – Oak Veneer' and p.sku = 'HINGE-90-SC'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 2, 4 from public.assemblies a, public.products p where a.name = '600mm Wall Unit – Oak Veneer' and p.sku = 'HINGE-BP-01'
on conflict do nothing;
insert into public.assembly_lines (assembly_id, product_id, quantity, sort_order)
select a.id, p.id, 1, 5 from public.assemblies a, public.products p where a.name = '600mm Wall Unit – Oak Veneer' and p.sku = 'FIT-PACK-1'
on conflict do nothing;
