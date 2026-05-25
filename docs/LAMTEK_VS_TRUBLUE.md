# Lamtek vs TruBlue KBB (positioning)

This note is for **Lamtek-only** product decisions — not a plan to become a mass-market SaaS or replicate TruBlue’s full supplier marketplace.

## What Lamtek already does well

- **Tealbury + Lamtek programs** — trade ordering, MTO flows, customer portal, staff impersonation
- **Catalogue operations** — live categories, smart categorise, component import, variant builder, pricing rules
- **Fulfillment** — stock take, locations, pick lists, package labels, delivery windows
- **Finance** — ledger, Stripe, invoicing, separate Finance nav (accounting, pricing, reports)
- **Permissions** — granular staff capabilities

## TruBlue-style gaps we closed (admin)

| Area | Lamtek feature |
|------|----------------|
| Sales visibility | **CRM sales board** — quotes/orders by status (`/admin/crm/sales-board`) |
| Follow-up | **Activity week calendar** (`/admin/crm/calendar`) + overdue KPI on Today |
| Quote presentation | **Quote document options** — hide SKU/prices/VAT, combination groups |
| Product economics | **Pricing breakdown** on product modal (sell, cost, margin) |
| Logistics | **Delivery schedule** week view (`/admin/delivery-schedule`) |
| Warehouse | **Warehouse scan** on pick lists (camera + manual code) |
| Quote structure | **Line combinations** — `combination_label` on order lines, grouped on print |

## What we are not building

- 550-supplier marketplace / generic KBB SaaS tenancy
- Microsoft 365 / full purchasing (PO) module
- TruBlue-scale dashboard widget builder
- Full TruBlue mobile scanner app clone

## Demo paths (staff)

1. **Today** — KPIs, workflow shortcuts, overdue tasks
2. **CRM → Sales board** — pipeline by order status
3. **Orders → quote print** — document display toggles
4. **Catalogue → product** — pricing breakdown panel
5. **Orders → Delivery schedule** — week of deliveries
6. **Pick lists → Warehouse scan** — label confirmation

**Live demo:** https://lamteksystem.github.io/lamteksystem/
