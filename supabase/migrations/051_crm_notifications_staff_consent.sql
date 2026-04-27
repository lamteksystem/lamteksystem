-- Customer consent for staff "view as customer" / portal assistance.
alter table public.customer_profiles
  add column if not exists staff_portal_access_consent_at timestamptz,
  add column if not exists staff_portal_access_consent_version text;

comment on column public.customer_profiles.staff_portal_access_consent_at is 'When the customer accepted authorised staff acting on their behalf in the portal.';
comment on column public.customer_profiles.staff_portal_access_consent_version is 'Policy text version accepted (e.g. date string).';

-- Global notification channel matrix (drives future email/portal jobs; UI-managed).
create table if not exists public.notification_rule_settings (
  event_key text primary key,
  label text not null,
  description text,
  email_customer boolean not null default true,
  portal_customer boolean not null default true,
  sms_customer boolean not null default false,
  staff_portal_alert boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_rule_settings enable row level security;

drop policy if exists "Staff select notification_rule_settings" on public.notification_rule_settings;
create policy "Staff select notification_rule_settings"
  on public.notification_rule_settings for select to authenticated
  using (public.is_staff());

drop policy if exists "Staff insert notification_rule_settings" on public.notification_rule_settings;
create policy "Staff insert notification_rule_settings"
  on public.notification_rule_settings for insert to authenticated
  with check (public.is_staff());

drop policy if exists "Staff update notification_rule_settings" on public.notification_rule_settings;
create policy "Staff update notification_rule_settings"
  on public.notification_rule_settings for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

insert into public.notification_rule_settings (event_key, label, description) values
  ('order_placed', 'Order placed', 'Customer submitted an order from the portal.'),
  ('order_status_change', 'Order status change', 'Order moved between draft, quotation, placed, invoiced, paid, cancelled.'),
  ('quotation_saved', 'Quotation saved', 'Customer saved a basket as a quotation without placing.'),
  ('abandoned_cart', 'Abandoned / stale basket', 'Draft or quotation with lines but no recent activity (follow-up).'),
  ('order_deleted', 'Order cancelled or removed', 'Customer or staff cancelled a draft/order where relevant.'),
  ('order_shipped', 'Order shipped / despatched', 'Shipment or despatch recorded for the order.'),
  ('order_invoiced', 'Order invoiced', 'Invoice raised for the order.'),
  ('order_paid', 'Payment received', 'Payment succeeded for the order.'),
  ('order_processed', 'Order processed', 'Order marked processed / in workflow milestones.'),
  ('payment_reminder', 'Payment reminder', 'Reminder for outstanding invoice.'),
  ('return_update', 'Return / credit update', 'Return or credit note status change.'),
  ('ticket_reply', 'Support ticket update', 'New message on a support ticket.')
on conflict (event_key) do nothing;
