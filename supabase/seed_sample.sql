-- Optional: seed sample categories (run after 001_schema.sql).
-- Then add products in Supabase Table Editor or via your own inserts using the new category IDs.

insert into public.categories (name, slug, sort_order, parent_id) values
  ('Doors', 'doors', 10, null),
  ('Units', 'units', 20, null),
  ('Handles', 'handles', 30, null),
  ('Lighting', 'lighting', 40, null),
  ('Wirework', 'wirework', 50, null),
  ('Fittings', 'fittings', 60, null)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;
