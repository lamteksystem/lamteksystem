# Trade Mouldings – Master TODO (authoritative)

Single source of truth for the full build plan. Mark **DONE** only when **DB + RLS + UI + tests/QA** match the definition (as applicable).

Legend: **DONE** / **IN PROGRESS** / **TODO**

---

## Execution waves (ship in order; parallelize only where no dependency)

### Wave A – Schema & types parity
| ID | Status | Deliverable |
|----|--------|-------------|
| A1 | **DONE** | `OrderRow` + related TS types include `delivery_window_id`, `delivery_scheduled_date`, `parent_order_id`, `link_reason`; `DeliveryWindowRow`, `DeliveryServiceDayRow` in `src/types/database.ts`. |
| A2 | **DONE** | `src/lib/deliveryWindows.ts` – load windows + rules, label helper, MVP slot validation (weekday + same-day cut-off in Europe/London). |
| A3 | **DONE** | Admin **Delivery windows** at `/admin/delivery-windows` (CRUD windows + weekday cut-off / lead rules). |

### Wave B – Customer checkout & fulfilment
| ID | Status | Deliverable |
|----|--------|-------------|
| B1 | **DONE** (prior) | Click & collect on cart: depot + notes; persisted on `orders`. |
| B2 | **DONE** | Delivery **window + date** on `OrderCart` when `fulfillment_method === 'delivery'` and windows exist in DB. |
| B3 | **DONE** | Customer `OrderDetail` shows chosen window + scheduled date; link to **quote** print. |
| B4 | **DONE** | Admin `AdminOrderDetail` saves `delivery_window_id`, `delivery_scheduled_date`, `parent_order_id`, `link_reason`. |

### Wave C – Quote / order exports
| ID | Status | Deliverable |
|----|--------|-------------|
| C1 | **DONE** | Customer `/account/orders/:orderId/quote` + `?mode=no-pricing` (`QuotePrint` + shared `InvoicePrintView` variant). |
| C2 | **DONE** | Admin `/admin/orders/:orderId/quote` + `?mode=no-pricing`. |
| C3 | **DONE** | Admin quote supports `?mode=internal` with sell/cost/margin line and totals output (staff-only route). |

### Wave D – Amendments & extras (enforcement)
| ID | Status | Deliverable |
|----|--------|-------------|
| D1 | **DONE** | UI for linked orders (parent id + reason) on admin order detail (+ customer order shows link). |
| D2 | **DONE** | DB triggers: `046` locks customer updates when `placed+`; `055` blocks customer writes to invoice/payment/processed/staff/archive fields on `draft`/`quotation`. |
| D3 | **DONE** | **Create extras order** header action → `/admin/create-order?customer=&parentOrder=&linkReason=extras` with parent delivery copy + linkage on insert. |

### Wave E – Ledger & accounting
| ID | Status | Deliverable |
|----|--------|-------------|
| E1 | **DONE** (prior) | Profile save does not write `balance_outstanding`; balance derived from ledger. |
| E2 | **DONE** | Staff-only `staff_recalc_customer_balance` RPC (`054` migration) + button on customer account summary. |
| E3 | **TODO** | Credit memo / returns UX completion (`Phase 3`). |

### Wave F – Notifications
| ID | Status | Deliverable |
|----|--------|-------------|
| F1 | **DONE** | Status changes now apply `notification_rule_settings` and call `notify-order-status` with configured channels (fallback prompt on send failure). |
| F2 | **DONE** | Customer inbox polish: unread/all filter + mark-all-read + inline read marking from links. |
| F3 | **DONE** | Admin packing slip print route at `/admin/orders/:orderId/packing-slip` with order lines + fulfilment/contact details. |

### Wave G – Account & addresses
| ID | Status | Deliverable |
|----|--------|-------------|
| G1 | **DONE** | Saved delivery addresses (`customer_delivery_addresses`) + account management UI + checkout picker on cart delivery section. |
| G2 | **DONE** | Account statement: running balance table (parity with admin), CSV export, profile balance in overview, `data-testid` for e2e. |

### Wave H – Product discovery & guided ordering
| ID | Status | Deliverable |
|----|--------|-------------|
| H1 | **IN PROGRESS** | Guided wizard completion vs `docs/acceptance/GUIDED_ORDERING.md`. |
| H2 | **IN PROGRESS** | Stock / lead-time badges added on ordering cards + product modal + admin catalogue table/card + admin product modal; remaining rollout to other listing surfaces. |
| H3 | **TODO** | Compare basket (2–4 SKU). |
| H4 | **TODO** | Samples + refundable fees. |

### Wave I – Payments
| ID | Status | Deliverable |
|----|--------|-------------|
| I1 | **TODO** | Bank transfer instructions + awaiting payment UX. |
| I2 | **TODO** | Split / multi-payment where supported. |

### Wave J – Warehouse & scale
| ID | Status | Deliverable |
|----|--------|-------------|
| J1 | **TODO** | Warehouse pick/pack mode. |
| J2 | **TODO** | Multiple shipments per order (extend `shipments`). |
| J3 | **TODO** | Bulk print / notify / status / allocate. |

### Wave K – Integrations
| ID | Status | Deliverable |
|----|--------|-------------|
| K1 | **TODO** | Accounting CSV export. |
| K2 | **TODO** | CSV → basket import. |
| K3 | **TODO** | “Send us your quote” intake. |
| K4 | **TODO** | Carrier APIs (optional). |
| K5 | **TODO** | EDI v1 endpoint + review queue. |

### Wave L – Quality
| ID | Status | Deliverable |
|----|--------|-------------|
| L1 | **DONE** | Playwright: smoke (login pages) + optional `E2E_CUSTOMER_*` flow (ordering, cart, account statement); `webServer` in config. |
| L2 | **TODO** | Tooltip + empty-state pass. |
| L3 | **TODO** | Query performance / indexes. |

---

## Phase 0 – Baseline audit & acceptance criteria
- **IN PROGRESS**: Map flows and Definition of Done per area (see `docs/acceptance/`, `docs/qa/`).

## Historical backlog (docs-only “next 10”) – archived reference
Items 1–10 (guided ordering docs, click & collect **design**, delivery windows **design**, amendments **policy**, exports **spec**, ledger **policy**, admin matrix) are **DONE** as documentation. Implementation is tracked in **Execution waves** above.

## Phase 1 – Customer ordering overhaul
- **IN PROGRESS**: Guided wizard + baskets (see Wave H).
- **IN PROGRESS**: Quote exports (Wave C).

## Phase 2 – Checkout, delivery, Click & Collect
- **MVP**: Click & collect (shipped in app + DB); delivery windows (Wave B).
- **POST-MVP**: Delivery pricing, partial fulfilment, POD.

## Phase 3 – Returns / refunds / accounting
- See Wave E + MASTER bullets in prior versions (`returns`, `credit limits`, allocations, exports).

## Phase 4 – Warehouse / ops
- See Wave J.

## Phase 5 – Integrations
- See Wave K.

## Cross-cutting quality
- See Wave L.

---

*Mobile / remote editing: open this repository in the Cursor mobile app from the same account or remote host (GitHub, SSH, or synced folder). The agent cannot remotely unlock or pair your phone—use Cursor’s documented mobile workflow.*
