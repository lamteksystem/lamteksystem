-- Payment fields for orders (Stripe)

alter table public.orders
  add column if not exists payment_intent_id text,
  add column if not exists payment_status text check (payment_status is null or payment_status in ('pending','succeeded','failed','refunded'));

comment on column public.orders.payment_intent_id is 'Stripe PaymentIntent or Checkout Session ID for tracking payment';
comment on column public.orders.payment_status is 'Stripe payment outcome: pending, succeeded, failed, refunded';
