# Admin order detail – inline customer field editing (manual QA matrix)

Primary implementation: `src/pages/admin/AdminOrderDetail.tsx` (`saveInlineCustomerField`).

## Preconditions

- Staff user with permission to edit orders (`canEditOrders` true).
- An order with an associated customer (`orders.user_id`).

## Core interaction tests

| ID | Field | Steps | Expect |
| --- | --- | --- | --- |
| A1 | Any text field | Double-click value → edit → blur | `customer_profiles` updates; `order_events` includes `customer_profile_updated` |
| A2 | Enter key | Edit → press Enter | saves like blur (per-field handlers) |
| A3 | Empty → null | Clear field → blur | stores `null` where applicable |

## Validation tests

| ID | Field | Steps | Expect |
| --- | --- | --- | --- |
| V1 | `credit_limit` | enter `-1`, `abc`, `1e999` | error message; no save |
| V2 | `credit_limit` | enter `0`, `123.45` | saves numeric |
| V3 | `website` | enter `example.com` | normalizes to URL with scheme |
| V4 | `website` | enter `not a url` | error message; no save |

## Permission / safety tests

| ID | Scenario | Steps | Expect |
| --- | --- | --- | --- |
| S1 | No permission | use a staff user without edit capability | inline edit does not persist (guarded by `canEditOrders`) |
| S2 | Archived order | open archived order (if applicable) | editing blocked for order operations (see `is_archived` guards) |

## Audit visibility

| ID | Scenario | Steps | Expect |
| --- | --- | --- | --- |
| U1 | Event emitted | save any inline field | `order_events` contains note `Updated customer field: …` |
