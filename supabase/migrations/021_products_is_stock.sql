-- Flag products as stock (catalogue) vs made-to-measure. Used to filter guided order flow.
alter table public.products
  add column if not exists is_stock boolean not null default true;

comment on column public.products.is_stock is 'true = stocked item (shown in Stock guided flow), false = made to measure only';
