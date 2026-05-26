-- Default visible columns: image, product name, SKU, description, price, qty (+ action).
update public.catalog_workbench_settings
set
  column_visible = array[
    'image', 'name', 'sku', 'description', 'price', 'qty', 'action'
  ]::text[],
  updated_at = now()
where id = 1;

alter table public.catalog_workbench_settings
  alter column column_visible set default array[
    'image', 'name', 'sku', 'description', 'price', 'qty', 'action'
  ]::text[];
