# Quote / order exports â€“ specification (v1)

## Current baseline (implemented)

- Invoice-style print views exist:
  - Customer: `/account/orders/:orderId/invoice` (`src/pages/InvoicePrint.tsx`) â†’ `InvoicePrintView`
  - Admin: `/admin/orders/:orderId/invoice` (`src/pages/admin/AdminInvoicePrint.tsx`) â†’ `InvoicePrintView`
- Gating: customer invoice print requires `invoice_number` and status in `invoiced|paid` (see `InvoicePrint.tsx`).

## Export variants to add (planning)

### A) Customer quotation PDF (with pricing)

- **When**: `orders.status` is `draft` or `quotation` (and optionally `placed` if you want post-acceptance quote record).
- **Includes**: line items, qty, unit price, VAT/totals, customer details, payment terms.
- **Branding**: Lamtek standard header/footer.

### B) Customer quotation PDF (without pricing)

- **Use**: sharing externally / early-stage quotes.
- **Includes**: line items + qty + descriptions; **hide** unit prices, VAT, totals.
- **Label**: clearly titled **â€œQuotation (no pricing)â€** to avoid confusion.

### C) Internal admin export (with cost + margin) (optional)

- **Includes**: sell price + cost fields (if available in DB) + margin indicators.
- **Access**: staff-only.

## Field rules

- **Always show**: product name + SKU (from `product_snapshot` where present).
- **Never show internal notes** on customer exports unless explicitly labeled and staff-approved.

## Output mechanism (v1 recommendation)

- Continue **browser print** for speed (`window.print()`), but add dedicated routes/templates per variant:
  - `/account/orders/:orderId/quote`
  - `/account/orders/:orderId/quote?mode=no-pricing`

## Acceptance checks (per variant)

- Totals match order totals for priced exports.
- No-pricing export contains **no currency symbols** in line columns and **no totals section**.

