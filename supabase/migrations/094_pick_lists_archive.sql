-- Archive pick lists (hide from default warehouse queue without deleting history).

alter table public.pick_lists
  add column if not exists is_archived boolean not null default false;

comment on column public.pick_lists.is_archived is
  'When true, hidden from default pick-list queues; restore to show again.';

create index if not exists idx_pick_lists_is_archived on public.pick_lists(is_archived);

-- Only one active (non-archived) open pick list per order.
drop index if exists public.uq_pick_lists_active_order;
create unique index uq_pick_lists_active_order
  on public.pick_lists(order_id)
  where status in ('generated', 'picking') and is_archived = false;
