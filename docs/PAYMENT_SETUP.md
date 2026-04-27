# Payment (Stripe) setup

The app includes a Stripe Checkout flow so customers can pay for placed or invoiced orders.

## 1. Database

Run the payment migration so orders can store payment status:

```bash
npx supabase db push
```

(or run `supabase/migrations/010_order_payment.sql` in the Supabase SQL editor). This adds `payment_intent_id` and `payment_status` to `orders`.

## 2. Stripe

1. Create a [Stripe account](https://dashboard.stripe.com) and get your **Secret key** (Dashboard → Developers → API keys).
2. In Supabase: **Project settings** → **Edge Functions** → **Secrets**. Add:
   - `STRIPE_SECRET_KEY` = your Stripe secret key (starts with `sk_`).

## 3. Deploy Edge Functions

From the project root:

```bash
npx supabase functions deploy create-checkout-session
npx supabase functions deploy verify-checkout-session
```

Supabase automatically provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Only `STRIPE_SECRET_KEY` needs to be set.

## 4. Flow

- **Customer**: On **My account** → **Order detail** for a placed or invoiced order, a **Pay now** button appears. Clicking it creates a Stripe Checkout Session (via the Edge Function) and redirects to Stripe. After payment, Stripe redirects back; the app verifies the session and marks the order as **Paid**.
- **Admin**: In **Admin** → **Orders** → order detail, you can change status (Quotation, Placed, Invoiced, Paid, Cancel). Payment status is stored on the order when the customer pays via Stripe.

## Optional: webhooks

For production you can add a Stripe webhook (e.g. `checkout.session.completed`) that calls an Edge Function to mark the order paid, so the order is updated even if the user closes the browser before the success redirect. The current flow uses the redirect + verify call, which is sufficient for most cases.
