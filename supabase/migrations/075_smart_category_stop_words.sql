-- User-managed stop word list for the smart categorise heuristic.
-- Tokens here are excluded from learning + scoring (in addition to the built-in
-- list in src/lib/smartCategoryLearning.ts). Useful when a generic numeric token
-- like "18mm" gets recorded against multiple categories and starts polluting
-- suggestions — admins can add it here to tell the system "ignore this".
create table if not exists public.smart_category_stop_words (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  created_at timestamptz not null default now(),
  unique (token)
);

create index if not exists idx_smart_category_stop_words_token
  on public.smart_category_stop_words (token);

alter table public.smart_category_stop_words enable row level security;

drop policy if exists "Authenticated read smart_category_stop_words"
  on public.smart_category_stop_words;
create policy "Authenticated read smart_category_stop_words"
  on public.smart_category_stop_words for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated insert smart_category_stop_words"
  on public.smart_category_stop_words;
create policy "Authenticated insert smart_category_stop_words"
  on public.smart_category_stop_words for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated delete smart_category_stop_words"
  on public.smart_category_stop_words;
create policy "Authenticated delete smart_category_stop_words"
  on public.smart_category_stop_words for delete
  using (auth.role() = 'authenticated');
