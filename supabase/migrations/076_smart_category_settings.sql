-- Smart categorise: global, editable settings.
--
-- Single-row table that holds the tunable knobs for the smart categorisation
-- heuristic — confidence thresholds, learning boost factors, tokenisation
-- rules and master enable/disable switches. Lives in one place so admins can
-- tune behaviour from the Settings tab without code changes.
--
-- Convention: there is always exactly one row, id = 1 (smallint). The lib
-- normalises any number of rows to a single effective settings object using
-- the most-recently updated row plus defaults.
create table if not exists public.smart_category_settings (
  id smallint primary key default 1,
  -- Scoring thresholds (0.0 – 1.0).
  min_score numeric(4,3) not null default 0.350,
  medium_threshold numeric(4,3) not null default 0.500,
  high_threshold numeric(4,3) not null default 0.750,
  -- Learning boost: each learned token contributes weight × per_weight, capped at cap.
  learning_boost_per_weight numeric(4,3) not null default 0.040,
  learning_boost_cap numeric(4,3) not null default 0.400,
  -- Tokenisation rules.
  min_token_length smallint not null default 3 check (min_token_length >= 1 and min_token_length <= 12),
  ignore_short_numeric_below smallint not null default 0 check (ignore_short_numeric_below >= 0 and ignore_short_numeric_below <= 12),
  -- A token learned in this many categories or more is flagged ambiguous in the UI.
  auto_ambiguous_threshold smallint not null default 2 check (auto_ambiguous_threshold >= 2 and auto_ambiguous_threshold <= 20),
  -- Master toggles.
  learning_enabled boolean not null default true,
  boost_enabled boolean not null default true,
  -- Audit.
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint smart_category_settings_threshold_order check (
    min_score <= medium_threshold and medium_threshold <= high_threshold
  )
);

-- Ensure exactly one row exists with sane defaults.
insert into public.smart_category_settings (id)
  values (1)
on conflict (id) do nothing;

alter table public.smart_category_settings enable row level security;

drop policy if exists "Authenticated read smart_category_settings"
  on public.smart_category_settings;
create policy "Authenticated read smart_category_settings"
  on public.smart_category_settings for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated update smart_category_settings"
  on public.smart_category_settings;
create policy "Authenticated update smart_category_settings"
  on public.smart_category_settings for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated insert smart_category_settings"
  on public.smart_category_settings;
create policy "Authenticated insert smart_category_settings"
  on public.smart_category_settings for insert
  with check (auth.role() = 'authenticated');
