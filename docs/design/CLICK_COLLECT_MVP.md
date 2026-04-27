# Click & Collect (MVP) – proposed data model + UX flow

## Goals (MVP)

- Let a customer choose **collection from a depot** instead of delivery.
- Capture **which depot** (`locations`) and **when it will be ready** (minimum: a date/time or date-only).
- Show clear customer messaging: **ready-by** + **must collect by** (even if “must collect by” is initially derived, not stored).

## What already exists

- `public.locations` includes `address`, `phone`, `opening_hours`, `active` (see `016_location_contact_fields.sql`).
- Customers can read active locations (RLS policy exists).
- `public.shipments` exists for courier shipments (see `029_shipments_and_stock_movements.sql`).

## Proposed fulfillment model

### Recommended: explicit columns on `orders`

Add to `public.orders`:

- `fulfillment_method text not null default 'delivery' check (fulfillment_method in ('delivery','collect'))`
- `collection_location_id uuid references public.locations(id) on delete set null`
- `collection_ready_at timestamptz null` (admin/system sets when picking is complete; customer sees “ready from”)
- `collection_must_collect_by timestamptz null` (optional in MVP; can be derived as `collection_ready_at + interval '7 days'` until policy is formal)
- `collection_notes text null` (customer notes: vehicle reg, pickup person, etc.)

Why not only `shipments`?

- Collection is not a courier shipment; keeping first-class fields avoids overloading `shipments.courier/tracking` with sentinel values.
- `shipments` can still be used later for “picked/packed” audit, but MVP should not require it.

### Optional later: `order_collection_events` (audit)

If you need pack/pick timestamps and staff attribution, add a small event table (post-MVP).

## UX flow (customer)

1. Checkout: choose **Delivery** vs **Collect**.
2. If **Collect**:
   - select depot (from `locations` where `active=true`)
   - show opening hours + address + phone
   - choose a **collection appointment** (MVP: date-only) OR accept “as soon as ready” with an estimated date
3. Order confirmation shows:
   - chosen depot
   - ready-by / must-collect-by rules (even if computed)

## UX flow (admin)

- Order detail shows fulfillment method.
- Staff can set/adjust `collection_ready_at` when stock is picked.
- If not ready by promised date, staff updates timestamps + optional customer comms (email later).

## RLS notes (high level)

- Customers: can read their own orders (existing policies) and need safe updates only for draft/quotation fields (if customer edits are allowed).
- Staff: manage fulfillment fields.

## MVP non-goals

- Complex slot optimization, multi-depot routing, carrier booking.
- Automatic stock allocation rules per depot (can reuse existing stock tables later).
