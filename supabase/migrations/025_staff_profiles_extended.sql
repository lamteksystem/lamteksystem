-- Extend staff_profiles for granular user attributes (department, phone, notes).
alter table public.staff_profiles
  add column if not exists department text,
  add column if not exists phone text,
  add column if not exists notes text;

comment on column public.staff_profiles.department is 'e.g. Sales, Accounts, Warehouse';
comment on column public.staff_profiles.phone is 'Contact phone';
comment on column public.staff_profiles.notes is 'Internal notes about this staff user';
