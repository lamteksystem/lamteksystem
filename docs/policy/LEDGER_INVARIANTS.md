# Ledger invariants + balance editing policy (v1)

## Source of truth

- **Authoritative statement**: `public.account_transactions`
- **Derived display field**: `public.customer_profiles.balance_outstanding` maintained by `public.recalc_customer_balance` (see `038_accounting_auto_balance.sql`)

## Invariants

- **L1**: `balance_outstanding` must always equal \(\sum account_transactions.amount\) for that customer.
- **L2**: Core order-driven rows should not be duplicated:
  - unique partial index `uniq_account_tx_order_type` for `invoice`/`payment` per `order_id` (see `038_accounting_auto_balance.sql`).
- **L3**: Return credits are tied to `return_line_id` with uniqueness constraints (see `039_return_credit_accounting.sql`).

## Manual balance edits (anti-pattern)

Direct edits to `customer_profiles.balance_outstanding` are **not allowed** as a normal workflow because they break **L1**.

### Approved mechanisms

- **Adjustment** transactions (`type='adjustment'`) with mandatory `note`, `staff` attribution (`created_by_staff_id`), and optional `reference` (ticket id / memo id).

## Backfill / repair

If history is inconsistent, use idempotent backfill patterns like `041_accounting_backfill_existing_orders.sql`:

- insert missing `invoice`/`payment` rows from orders
- then run `recalc_customer_balance` for affected customers

## Customer UI direction

Customer-facing balance should be computed from transactions (directly or via `balance_outstanding`), and any “fix” should be visible as an **adjustment** line, not a silent profile edit.
