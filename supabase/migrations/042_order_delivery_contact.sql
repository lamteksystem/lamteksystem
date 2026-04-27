-- Add delivery contact fields to orders (separate from billing/customer profile).

alter table public.orders
  add column if not exists delivery_contact_name text,
  add column if not exists delivery_contact_phone text,
  add column if not exists delivery_contact_email text,
  add column if not exists delivery_contact_notes text,
  add column if not exists delivery_same_as_billing boolean not null default true;

comment on column public.orders.delivery_contact_name is 'Delivery contact name (may differ from billing/contact).';
comment on column public.orders.delivery_contact_phone is 'Delivery contact phone.';
comment on column public.orders.delivery_contact_email is 'Delivery contact email.';
comment on column public.orders.delivery_contact_notes is 'Extra delivery contact notes (e.g. access, call-before).';
comment on column public.orders.delivery_same_as_billing is 'If true, delivery details should default to billing/customer profile details.';

