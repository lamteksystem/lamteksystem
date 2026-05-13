# Lamtek Portal â€“ Feature roadmap (competitor-inspired)

Based on B2B order management, kitchen/trade supplier portals, and OMS best practices.

## âœ… Done (current)

- Order lifecycle: draft â†’ quotation â†’ placed â†’ invoiced â†’ paid | cancelled
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

1. [x] **Guided ordering acceptance criteria pack** â€“ deep links, checklist jumps, filter persistence/reset, empty/error states.
2. [x] **Customer ordering regression matrix** â€“ repeatable QA checklist for `dashboard -> ordering -> cart -> place order`.
3. [x] **Click & Collect MVP data model + flow** â€“ depots, slots/hours, cut-offs, ready-by, must-collect-by, admin controls.
4. [x] **Delivery windows MVP data model + flow** â€“ window entity, order linkage, cut-offs, customer messaging.
5. [x] **Phase 2 delivery prioritization** â€“ tag Phase 2 items as `MVP` vs `POST-MVP` with explicit scope.
6. [x] **Order amendment policy by status** â€“ allowed edits, permissions, audit expectations.
7. [x] **Extras linked-order model** â€“ linkage, pricing/tax, invoice impact, audit trail.
8. [x] **Quote/order export specification** â€“ variants (with/without pricing, internal), field rules, branding.
9. [x] **Ledger invariants + anti-manual-edit policy** â€“ safe path to remove manual balance edits.
10. [x] **Admin inline editing test matrix** â€“ validation, permissions, rollback, audit visibility.

### Next implementation backlog (#2 â€“ next 10)
Track in `docs/MASTER_TODO.md` under **Next execution queue (implementation backlog #2 â€“ next 10)**.

1. [ ] **Click & Collect â€“ DB migration + types**
2. [ ] **Click & Collect â€“ customer + admin UI**
3. [ ] **Delivery windows â€“ DB migration + types**
4. [ ] **Delivery windows â€“ selection UI + validation**
5. [ ] **Quote exports â€“ customer print routes**
6. [ ] **Quote exports â€“ admin print routes**
7. [ ] **Extras orders â€“ linkage fields + admin workflow**
8. [ ] **Amendments â€“ guardrails (RLS/triggers/constraints as needed)**
9. [ ] **Ledger â€“ remove manual balance edits + adjustments**
10. [ ] **E2E tests â€“ ordering + checkout + quote exports**

### Order management & workflow
- [x] **Invoice number** â€“ unique ref when order moves to invoiced (migration + auto-set)
- [x] **Order processing queue** â€“ view â€œPlacedâ€ orders needing processing (mark invoiced, set delivery)
- [x] **Bulk status update** â€“ select multiple orders, set status (table view: checkboxes + Mark as Invoiced / Set status)
- [x] **Status transition rules** â€“ â€œMark as invoicedâ€ sets processed_at, generates invoice number (trigger)

### Delivery & courier
- [x] **Courier options** â€“ dropdown (DPD, FedEx, Royal Mail, Yodel, Other) on order
- [x] **Delivery expected date** â€“ optional date on order; show to customer
- [x] **Tracking link helper** â€“ paste tracking number, auto-build carrier link (DPD/FedEx etc.)
- [ ] **Multiple shipments** â€“ optional: multiple tracking numbers per order (shipments table)

### Billing & invoicing
- [x] **Payment terms** â€“ on customer (e.g. Net 7, Net 30); show on order & account
- [x] **Invoice PDF** â€“ print invoice view (customer + admin); browser Print
- [x] **Statement / balance** â€“ balance + invoiced/paid orders table on customer detail
- [ ] **Credit memo / returns** â€“ optional RMA or credit note flow

### Notifications & workflow
- [ ] **Email on status change** â€“ e.g. â€œYour order is placedâ€, â€œYour order has been despatchedâ€
- [ ] **Packing slip PDF** â€“ optional download for warehouse
- [ ] **Order approval workflow** â€“ optional: quotation requires approval before placed

### Customer & account
- [ ] **Multiple delivery addresses** â€“ save addresses per customer; choose at checkout
- [x] **Payment terms display** â€“ show on order (admin), account overview (customer)
- [x] **Download invoice** â€“ customer can view/print invoice for paid/invoiced orders

### Integrations (later)
- [ ] **Accounting export** â€“ CSV/QuickBooks for orders and invoices
- [ ] **Carrier API** â€“ book shipment or get tracking from DPD/FedEx (if needed)

---

## Build order (logical)

1. **DB & types** â€“ invoice_number, courier, delivery_expected_date, payment_terms
2. **Admin order detail** â€“ courier dropdown, expected date, invoice # display/generation
3. **Order processing queue** â€“ dedicated view for â€œplacedâ€ orders
4. **Tracking link helper** â€“ UI to build carrier tracking URL from number
5. **Customer order view** â€“ show expected delivery, courier, better tracking link
6. **Payment terms** â€“ on customer profile, display on order
7. **Invoice PDF** â€“ simple PDF or â€œPrint invoiceâ€ (browser print)
8. **Email notifications** â€“ optional Supabase Edge or external

---

*Last updated: from competitor research and current codebase.*

