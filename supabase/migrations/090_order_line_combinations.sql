-- Optional quote grouping labels (e.g. Kitchen main, Island) on order lines.

alter table public.order_lines
  add column if not exists combination_label text;

comment on column public.order_lines.combination_label is
  'Optional quote/order grouping label for multi-combination quotes (TruBlue-style furniture combinations).';

create index if not exists order_lines_order_combination_idx
  on public.order_lines (order_id, combination_label);
