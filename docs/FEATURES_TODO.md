# Trade Mouldings Portal – Feature roadmap (competitor-inspired)

Based on B2B order management, kitchen/trade supplier portals, and OMS best practices.

## ✅ Done (current)

- Order lifecycle: draft → quotation → placed → invoiced → paid | cancelled
- Delivery fields: address, postcode, notes, tracking (free text)
- Stripe payment (Pay now on order)
- Admin: create order for customer, edit lines, set status, delivery details
- Kanban orders view, table/grid/cards
- Pricelist import, product images, catalogue import/export
- CRM (customers + notes), locations, stock take
- Customer: dashboard, products, ordering, cart, account, order history, depots

---

## In progress / next

### Actionable systematic backlog (next 10 build items)
Completed: see `docs/MASTER_TODO.md` + linked docs under `docs/`.

1. [x] **Guided ordering acceptance criteria pack** – deep links, checklist jumps, filter persistence/reset, empty/error states.
2. [x] **Customer ordering regression matrix** – repeatable QA checklist for `dashboard -> ordering -> cart -> place order`.
3. [x] **Click & Collect MVP data model + flow** – depots, slots/hours, cut-offs, ready-by, must-collect-by, admin controls.
4. [x] **Delivery windows MVP data model + flow** – window entity, order linkage, cut-offs, customer messaging.
5. [x] **Phase 2 delivery prioritization** – tag Phase 2 items as `MVP` vs `POST-MVP` with explicit scope.
6. [x] **Order amendment policy by status** – allowed edits, permissions, audit expectations.
7. [x] **Extras linked-order model** – linkage, pricing/tax, invoice impact, audit trail.
8. [x] **Quote/order export specification** – variants (with/without pricing, internal), field rules, branding.
9. [x] **Ledger invariants + anti-manual-edit policy** – safe path to remove manual balance edits.
10. [x] **Admin inline editing test matrix** – validation, permissions, rollback, audit visibility.

### Next implementation backlog (#2 – next 10)
Track in `docs/MASTER_TODO.md` under **Next execution queue (implementation backlog #2 – next 10)**.

1. [ ] **Click & Collect – DB migration + types**
2. [ ] **Click & Collect – customer + admin UI**
3. [ ] **Delivery windows – DB migration + types**
4. [ ] **Delivery windows – selection UI + validation**
5. [ ] **Quote exports – customer print routes**
6. [ ] **Quote exports – admin print routes**
7. [ ] **Extras orders – linkage fields + admin workflow**
8. [ ] **Amendments – guardrails (RLS/triggers/constraints as needed)**
9. [ ] **Ledger – remove manual balance edits + adjustments**
10. [ ] **E2E tests – ordering + checkout + quote exports**

### Order management & workflow
- [x] **Invoice number** – unique ref when order moves to invoiced (migration + auto-set)
- [x] **Order processing queue** – view “Placed” orders needing processing (mark invoiced, set delivery)
- [x] **Bulk status update** – select multiple orders, set status (table view: checkboxes + Mark as Invoiced / Set status)
- [x] **Status transition rules** – “Mark as invoiced” sets processed_at, generates invoice number (trigger)

### Delivery & courier
- [x] **Courier options** – dropdown (DPD, FedEx, Royal Mail, Yodel, Other) on order
- [x] **Delivery expected date** – optional date on order; show to customer
- [x] **Tracking link helper** – paste tracking number, auto-build carrier link (DPD/FedEx etc.)
- [ ] **Multiple shipments** – optional: multiple tracking numbers per order (shipments table)

### Billing & invoicing
- [x] **Payment terms** – on customer (e.g. Net 7, Net 30); show on order & account
- [x] **Invoice PDF** – print invoice view (customer + admin); browser Print
- [x] **Statement / balance** – balance + invoiced/paid orders table on customer detail
- [ ] **Credit memo / returns** – optional RMA or credit note flow

### Notifications & workflow
- [ ] **Email on status change** – e.g. “Your order is placed”, “Your order has been despatched”
- [ ] **Packing slip PDF** – optional download for warehouse
- [ ] **Order approval workflow** – optional: quotation requires approval before placed

### Customer & account
- [ ] **Multiple delivery addresses** – save addresses per customer; choose at checkout
- [x] **Payment terms display** – show on order (admin), account overview (customer)
- [x] **Download invoice** – customer can view/print invoice for paid/invoiced orders

### Integrations (later)
- [ ] **Accounting export** – CSV/QuickBooks for orders and invoices
- [ ] **Carrier API** – book shipment or get tracking from DPD/FedEx (if needed)

---

## Build order (logical)

1. **DB & types** – invoice_number, courier, delivery_expected_date, payment_terms
2. **Admin order detail** – courier dropdown, expected date, invoice # display/generation
3. **Order processing queue** – dedicated view for “placed” orders
4. **Tracking link helper** – UI to build carrier tracking URL from number
5. **Customer order view** – show expected delivery, courier, better tracking link
6. **Payment terms** – on customer profile, display on order
7. **Invoice PDF** – simple PDF or “Print invoice” (browser print)
8. **Email notifications** – optional Supabase Edge or external

---

*Last updated: from competitor research and current codebase.*
