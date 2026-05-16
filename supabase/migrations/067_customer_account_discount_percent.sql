-- Per-account extra discount % applied after customer_price_rules (optional).

alter table public.customer_profiles
  add column if not exists account_discount_percent numeric(5, 2);

comment on column public.customer_profiles.account_discount_percent is
  'Additional percentage off resolved unit sell price after segment rules (0–100). Null = no account-level discount.';

alter table public.customer_profiles
  drop constraint if exists customer_profiles_account_discount_percent_range;

alter table public.customer_profiles
  add constraint customer_profiles_account_discount_percent_range
  check (
    account_discount_percent is null
    or (account_discount_percent >= 0 and account_discount_percent <= 100)
  );
