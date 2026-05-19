-- Stable insertion order for cart / order line lists (avoids reordering after quantity updates).
alter table public.order_lines
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_order_lines_order_id_created_at
  on public.order_lines (order_id, created_at);
