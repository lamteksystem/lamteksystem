# Order amendments – policy by status (v1)

This policy is designed around the existing order lifecycle:

`draft → quotation → placed → invoiced → paid | cancelled`

(see `orders.status` check constraint in `001_schema.sql`)

## Roles

- **Customer**: can edit their own **draft** orders (within normal RLS rules).
- **Staff**: can amend orders according to the rules below (staff already has broad order line access).

## Allowed operations

### `draft`

- **Lines**: add/update/remove lines, change quantities, change delivery/project notes.
- **Totals**: recomputed freely.
- **Risk**: low (not billed).

### `quotation`

- **Lines**: add/update/remove lines while still a quote.
- **Transition**: move to `placed` when customer confirms.

**Rule Q1**: Treat `quotation` as “editable proposal” until accepted.

### `placed`

- **Customer-facing changes**: should be rare; prefer staff-mediated changes.
- **Staff**:
  - may correct **operational** fields (delivery contact, notes, expected dates) if business allows
  - line edits only if still pre-invoice and business policy allows

**Rule P1**: If pricing/scope changes materially after placement, create an audit trail (see extras policy).

### `invoiced`

- **Lines**: do not mutate historical invoice composition in-place (avoid accounting drift).
- **Operational**: tracking/courier/delivery expectation updates are OK if they do not change billed amounts.

**Rule I1**: Any additional goods/services after invoice should be a **new order** linked as an “extra” (see `docs/policy/ORDER_EXTRAS_LINKAGE.md`).

### `paid`

- **No line price/quantity changes** without a formal return/credit workflow.

**Rule A1**: Post-payment adjustments go through returns/credit notes (`account_transactions`).

### `cancelled`

- **Frozen**: no further fulfillment changes.

## Audit expectations (minimum)

For staff amendments on non-draft orders:

- record **who** (staff user) + **what changed** + **why** (free text)
- prefer using existing “events” mechanisms if present (`order_events` migration exists) — implementation detail for engineering
