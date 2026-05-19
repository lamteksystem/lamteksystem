-- Smart categorisation learning store.
-- When an admin corrects a suggested category in the Smart Categorise modal, we tokenise the
-- product name + description and upsert (token, category_id) here with an incremented weight.
-- Future suggestions then look up matching tokens and boost the user-confirmed category, so the
-- heuristic gets better the more it is used.
create table if not exists public.smart_category_learning (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  weight integer not null default 1,
  last_learned_at timestamptz not null default now(),
  unique (token, category_id)
);

create index if not exists idx_smart_category_learning_token
  on public.smart_category_learning (token);

create index if not exists idx_smart_category_learning_category_id
  on public.smart_category_learning (category_id);

alter table public.smart_category_learning enable row level security;

drop policy if exists "Authenticated read smart_category_learning" on public.smart_category_learning;
create policy "Authenticated read smart_category_learning"
  on public.smart_category_learning for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated upsert smart_category_learning" on public.smart_category_learning;
create policy "Authenticated upsert smart_category_learning"
  on public.smart_category_learning for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated update smart_category_learning" on public.smart_category_learning;
create policy "Authenticated update smart_category_learning"
  on public.smart_category_learning for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated delete smart_category_learning" on public.smart_category_learning;
create policy "Authenticated delete smart_category_learning"
  on public.smart_category_learning for delete
  using (auth.role() = 'authenticated');
