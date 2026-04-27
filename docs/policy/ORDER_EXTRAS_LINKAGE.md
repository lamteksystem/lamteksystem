# “Extras” orders linked to an original order (v1 proposal)

## Problem

Sometimes customers add items after an order is already **invoiced** or otherwise locked. Mutating the original order lines breaks accounting traceability.

## Proposed approach

Create a **new order** representing incremental scope (“extras”), linked back to the original.

### Schema proposal (orders)

Add nullable fields to `public.orders`:

- `parent_order_id uuid null references public.orders(id) on delete set null`
- `link_reason text null check (link_reason in ('extras','replacement','samples','goodwill','other'))`

**Rule X1**: If `parent_order_id` is set, `link_reason` must be set.

### Pricing + invoices

- Each extras order has its own `order_lines` and normal lifecycle.
- When extras order becomes `invoiced`, the existing invoice automation creates a new `account_transactions` invoice row (see `038_accounting_auto_balance.sql`).

### Audit

Minimum viable:

- store `parent_order_id` for traceability
- staff note on the extras order explaining the link (“Extras for INV-xxxx / Order …”)

## UX expectations

- Admin order detail shows **Linked orders** section:
  - parent → children
  - child → parent
- Customer sees linked extras orders in history (read-only), depending on RLS/policy.
