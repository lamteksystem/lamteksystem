-- CRM: extra fields on customer_profiles for company/contact and billing.
alter table public.customer_profiles
  add column if not exists phone text,
  add column if not exists email_override text,
  add column if not exists website text,
  add column if not exists billing_address text,
  add column if not exists billing_city text,
  add column if not exists billing_postcode text,
  add column if not exists delivery_address text,
  add column if not exists delivery_city text,
  add column if not exists delivery_postcode text,
  add column if not exists credit_limit numeric(12,2),
  add column if not exists company_notes text,
  add column if not exists employee_count int;

comment on column public.customer_profiles.email_override is 'Billing/contact email if different from login email.';
comment on column public.customer_profiles.credit_limit is 'Credit limit for this customer (e.g. for statements).';
comment on column public.customer_profiles.company_notes is 'Internal CRM notes about the company (separate from customer_notes timeline).';
