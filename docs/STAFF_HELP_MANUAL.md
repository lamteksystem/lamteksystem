# Lamtek ordering portal — staff & partner manual (extended)

**Last updated:** May 2026 (covers quotes workflow, customer pricing, **complete-unit component breakdown (BOM)**, multi-category catalogue, stock take by component, and pricing & margin guidance).

This manual is for **Lamtek staff** and trusted partners (for example **Tom**) who need to **use the portal**, **onboard customers**, **answer first-line questions**, and **coordinate with IT** without reading source code.  
**Plain English first:** internal database names and JSON keys appear only in **[§25 Appendix](#25-appendix--technical-reference-for-it-and-authors)**.

---

### How to use this document

| If you need… | Start at… |
|--------------|-----------|
| **Orientation** — what the app is | [§1](#1-what-this-system-is-for) |
| **What changed recently** | [§2a](#2a-whats-new-may-2026) |
| **Vocabulary** for consistent messaging | [§4](#4-words-we-use-expanded-glossary) |
| **Customer training** — “where do I click?” | [§5](#5-customer-area--full-tour-of-the-sidebar) · [§6](#6-orders-baskets-cart-and-checkout-deep-dive) |
| **“What does this order status mean?”** | [§7](#7-order-statuses-what-each-stage-means-for-staff-and-customers) |
| **Delivery vs collection, slots** | [§8](#8-delivery-collection-and-delivery-windows) |
| **Support / returns** | [§9](#9-support-tickets-customer-view) |
| **Admin day-to-day** | [§11](#11-admin-sign-in-and-the-today-page) onward |
| **Quotes vs orders** | [§12](#12-admin--orders-quotes-and-fulfilment) |
| **Customer pricing (segments + account %)** | [§13](#13-admin--customers-and-crm) · [§16](#16-admin--files-pricing-reports-accounting) |
| **Trainers / ordering modes / session plans** | [§23](#23-deep-dives-ordering-modes-catalogue-behaviour-training) |
| **Catalogue / Tealbury Excel** | [§14](#14-admin-catalogue--operations-playbook) |
| **Complete unit make-up (BOM)** | [§14.6](#146-complete-unit-make-up-tealbury-and-bundles) · [§23.2](#232-components-vs-complete-units-and-bom) |
| **Stock take — count parts not packages** | [§15.1](#151-stock-take) |
| **First-line scripts** | [§21](#21-phone-and-email-scripts-extended) |
| **When something breaks** | [§20](#20-troubleshooting-wide) |
| **Spreadsheet / SQL names** | [§25](#25-appendix--technical-reference-for-it-and-authors) |

Customer-facing short tips also appear under **Help** (`/account/help`) and **Support** in the app.

---

## 1. What this system is for

The portal supports **trade customers** who already have a relationship with Lamtek. They can:

- Browse and order **Lamtek component catalogue** lines (doors, units, accessories, and related trade items).
- Browse and order **Tealbury kitchen programme** lines where you offer that programme — usually maintained from the Tealbury customer **Excel** workbook.
- Keep **draft orders** (sometimes shown as **baskets**), turn them into **quotes**, and progress to **placed** and later **invoiced / paid** stages (exact wording on screen matches your configuration).
- See **account** information (balance and activity where enabled), open **brochures and files**, find **depot** information, and raise **support tickets** (questions, issues, returns).

**Staff** use **Admin** (separate sign-in, staff accounts only) to work customers, orders, catalogue, stock, pricing, CRM, accounting views, tickets, and internal users.

The same website serves **public marketing-style pages**, the **signed-in customer area**, and **Admin** — the URL path and account type determine which experience loads.

---

## 2. Who should read which parts

| Role | Focus |
|------|--------|
| **Sales / account managers** | §5–§10, §13, §21–§22 |
| **Customer service** | §6–§10, §9, §12, §17, §20–§21 |
| **Warehouse / ops** | §6–§8, §12, §15 (component stock take + BOM), pick lists / labels in §12 |
| **Catalogue owner** | §14, Tealbury Excel behaviour, §20 import rows |
| **Finance** | §7, §12, §16, accounting permission |
| **Trainers** | §5–§6, §23 |
| **IT / implementer** | §25 Appendix, repository files in §24 |

---

## 2a. What’s new (May 2026)

Use this section if you trained on an older build. Behaviour below is live in the current portal.

| Area | What changed |
|------|----------------|
| **Orders & quotes** | Sidebar and lists say **Orders & quotes**. Staff can **Create quote**, print/send quotes, then **Convert to order** on the order detail screen when the customer confirms. |
| **Quick actions** | Red **+** button (bottom-right in Admin) opens **Create quote** or **Create order** from most admin pages. Hidden on create pages and print views. |
| **Customer pricing** | On each **customer profile**: visible **Pricing segment** (group, region, trade type, company type), **Payment terms**, and optional **Account discount (%)** — extra % off after segment rules. |
| **Pricing & margin** | Clearer intro text and tab tooltips. **Preview** tab tests sell/cost/margin for one customer + SKU. |
| **Staff order pricing** | On **order detail**, choose how new lines are priced: catalogue list price vs **customer pricing**; button **Apply customer pricing to all lines**. Default in **Settings → Advanced**. |
| **Catalogue** | **◀ ▶** scroll buttons beside the column-settings cog; wide table scrolls horizontally without hunting for the scrollbar. Click a row to open a **product modal** (read/edit). Stock qty visible; double-click to edit inline. |
| **Stock take** | Category and product-group filters match **imported** categories (e.g. Lamtek sheet names), not only legacy seed names like “Units”. Clear message when filters match nothing. |
| **Customer Help** | `/account/help` updated for baskets, Tealbury path, and pricing FAQs. |
| **Support manual in Admin** | **Support manual** link below **Settings** in the sidebar (`/admin/support-manual`) — reads `docs/STAFF_HELP_MANUAL.md`. |
| **Multiple categories** | Catalogue products can be assigned **more than one category**; set **primary** for pricing/export. |
| **Complete unit make-up (BOM)** | Tealbury **complete** sellable lines can list their **parts**: carcass/cabinet, door/drawer, hinges, hinge plates, leg kit, fittings bag. Defined in **Catalogue → product modal → Complete unit make-up**; shown to customers on the product detail view when configured. |
| **Stock take — components first** | Default view counts **component SKUs** only (carcass, door, hinges, etc.). **Complete package** lines are hidden unless you change **Stock count** to *Complete packages only* or *All*; use **Show parts** to see per-component quantities for a package. |
| **Demo / training URL** | Public GitHub Pages build: **https://lamteksystem.github.io/lamteksystem/** (local dev: **http://localhost:5173/**). Add the Pages origin to Supabase Auth if login fails on the demo site. |

---

## 3. Where things live (paths)

Paths are the part **after** your site address (e.g. `https://orders.example.com` + path).

### Customer (trade user signed in)

| Path | Purpose |
|------|---------|
| `/` | Dashboard / home within the customer shell |
| `/products` | Product browser (Lamtek component catalogue for ordering flows) |
| `/ordering/start` | **Create order** — choose Tealbury vs manual vs guided |
| `/ordering` | **Manual order** — browse catalogue with filters |
| `/ordering?flow=guided` | **Guided order** — step-by-step path then catalogue |
| `/ordering/tealbury` | **Tealbury kitchens** — programme-only list |
| `/ordering/baskets` | **Order baskets** — manage multiple **draft** orders |
| `/ordering/cart` | **Cart** — lines and checkout for the **active** draft |
| `/downloads` | Brochures, pricelists, technical files (per your uploads) |
| `/depots` | Depot / branch information for customers |
| `/account` | Profile, statement-style summary, order history links |
| `/account/support` | **Support** — list and create tickets |
| `/account/help` | In-app **Help** |

### Staff

| Path | Purpose |
|------|---------|
| `/admin/login` | Staff sign-in |
| `/admin` | **Today** — dashboard |
| `/admin/catalogue` | Catalogue — tabs: Browse, Import & export, Audit, Images |
| `/admin/catalogue?tab=import` | Opens catalogue on **Import & export** |
| `/admin/orders` | **Orders & quotes** list (quotations and placed orders together) |
| `/admin/orders/processing` | Processing queue |
| `/admin/create-order` | Place **order** on behalf of customer |
| `/admin/create-quote` | Place **quote** (quotation) on behalf of customer |
| `/admin/pricing` | **Pricing & margin** — segments, sell rules, cost rules, preview |
| `/admin/stock` | **Stock take** by depot |
| `/admin/settings` | Staff UI preferences (includes default **order line pricing** mode) |
| `/admin/support-manual` | **Support manual** (this document in the app) |
| Other `/admin/…` | See §11–§17 |

**Production auth:** if email links fail on the live domain, the Supabase project’s **Authentication → URL configuration** must list that exact **https** origin (and redirects). This is a common post-deploy fix.

---

## 4. Words we use (expanded glossary)

| Term | Meaning |
|------|---------|
| **Lamtek component catalogue** | Main trade product list used from **Products** and **Ordering** (manual / guided). Items are tagged internally as belonging to the **Lamtek** programme. |
| **Tealbury programme** | Separate kitchen offer; items come from the Tealbury workbook import. Shown on **Tealbury kitchens**. |
| **SKU** | The primary product code in the portal — used for imports, image filenames, and searching. |
| **Trade code** (Tealbury) | The short **CODE** from Excel; the portal may **combine** it with the door range for the stored SKU so ranges do not overwrite each other. |
| **Door range** | Usually one **sheet** in the workbook (a finish family). |
| **Draft** | An order with status **draft** — work in progress; lines and totals can change freely in most setups. |
| **Basket** | Same underlying thing as a **draft order**; the UI may speak in “baskets” when customers manage **multiple** drafts. |
| **Active basket** | Which draft the **Cart** page is using — chosen on **Order baskets** or implied from “last used”. |
| **Quotation** | Priced proposal stage — customer or staff may still adjust depending on policy. |
| **Placed** | Firm customer commitment in many workflows — triggers operational handling. |
| **Invoiced / Paid** | Billing stages — meanings depend on your finance process. |
| **Cancelled** | Order will not proceed; may be excluded from some dashboards. |
| **Archived** | Older orders hidden from default lists but not deleted — staff can still open by archive filters where provided. |
| **Staff** | User allowed into **Admin** after sign-in at `/admin/login`. |
| **Customer** | Trade user with a **company profile**; uses customer nav, never Admin. |
| **View as customer** | Staff opens the **customer** portal as that user (support). Consent rules may apply. |
| **Ticket** | A **Support** thread: question, issue, or return request. |
| **Segment / pricing rule** | Admin-controlled rules that can change **sell price** when a customer’s **group, location, trade type, and company type** match (see **Pricing & margin → Sell price rules**). |
| **Account discount (%)** | Optional extra percentage off **after** segment rules, set on the **customer profile** (not on every product). |
| **Pricing segment** | The four dropdowns on a customer profile: **customer group**, **location (pricing region)**, **trade type**, **company type**. |
| **Quotation** (record) | An order row with status **quotation** — same underlying table as orders; staff can convert it to **placed** when accepted. |
| **Customer pricing** (staff orders) | Resolving line prices using segment rules + account discount (same engine as the customer cart). |
| **Fulfillment** | **Delivery** to an address vs **collection** from a depot — chosen at checkout where enabled. |
| **Delivery window** | A named slot pattern (weekday, cut-off, lead time) configured by staff for customer selection. |
| **Snapshot** (order line) | Copy of product name/SKU/price **frozen** on the line when ordered — so old orders stay readable if the catalogue changes later. |
| **VAT** | UK tax — totals on screen typically show **ex-VAT** and **inc-VAT** where the app displays both. |
| **Impersonation** | Staff viewing the portal **as** a specific customer user id (for diagnosis). |
| **Preference** (ordering) | Small settings like **which draft is active** — stored in the **database** per user (not only in the browser). |
| **Complete unit** | A sellable **package** line (often Tealbury) that is built from several **component** SKUs in the warehouse — e.g. “600mm base unit — Hadfield”. |
| **Component** (inventory) | A part you **count in stock**: carcass, door front, drawer front, hinge, hinge plate, leg kit, fittings bag, etc. |
| **Make-up / BOM** | **Bill of materials** — which components and quantities make one complete unit. Maintained in Admin on the complete product. |
| **Part type** (BOM) | Role of each line: **Unit / carcass**, **Door**, **Drawer**, **Hinge**, **Hinge plate**, **Leg kit**, **Fittings bag**, or **Other**. |
| **Primary category** | When a product has several categories, the **primary** drives category-scoped pricing rules and spreadsheet export. |

---

## 5. Customer area — full tour of the sidebar

When a trade customer is signed in, the **sidebar** (or mobile menu) is the main map.

| Item | What the customer does there |
|------|-------------------------------|
| **Dashboard** (`/`) | Landing: shortcuts and overview (exact tiles depend on your build). |
| **Products** (`/products`) | Browse/search the **Lamtek component catalogue** (not the Tealbury-only list). |
| **Create order** (`/ordering/start`) | **Choose path:** Tealbury kitchens · Manual order · Guided order. Can switch later; this is the intentional entry point. |
| **Tealbury kitchens** (`/ordering/tealbury`) | Shop **only** Tealbury programme lines — use when selling that programme. |
| **Order baskets** (`/ordering/baskets`) | Manage **several draft orders** (e.g. “Kitchen job A”, “Small extras B”), pick which is **active**, rename or duplicate if the app offers it. |
| **Cart** (`/ordering/cart`) | The **active** draft’s lines, delivery/collection choices, delivery window (if any), contact fields, **Save** vs **Place order**, and totals. |
| **Downloads** (`/downloads`) | PDFs and files your team published for customers. |
| **Depots** (`/depots`) | Where to collect or who to contact — content from your data. |
| **Global search** (if in header) | Quick jump to products/orders/pages — depends on your nav layout. |
| **My profile** / **My account** (`/account`) | Company details, balance/summary, order list, preferences. |
| **Support** (`/account/support`) | Tickets — new and existing. |
| **Help** (`/account/help`) | Shorter in-app topics. |

**Staff** who are also customers may see **Staff backend** — that jumps to Admin; it is not shown to pure trade users.

---

## 6. Orders, baskets, cart, and checkout (deep dive)

### 6.1 Drafts live on the server

Draft orders are **real order records** with status **draft**, tied to the customer’s account. They are **not** “only in the browser tab” — switching device works as long as they sign in again.  
The portal remembers **which draft is active** using a **saved preference** in the database (so two browsers for the same user converge on the same active basket when refreshed).

### 6.2 Why “Order baskets” exists

Traders often run **parallel jobs** (main kitchen, add-on order, sample request). **Order baskets** lists their **draft** orders so they can:

- Switch the **active** basket before opening **Cart**.
- Avoid mixing two jobs in one draft by mistake.

If a customer says “my cart cleared”, check whether they **switched active basket** or created a **new** draft.

### 6.3 Adding lines

From **Products** or **Ordering**, adding to cart creates or updates **order lines** on the active draft. Each line stores:

- Quantity and **unit price** (often **re-priced** for that customer when they open the cart — see pricing in Admin).
- A **snapshot** of product title / SKU / image for display and for historical orders later.

### 6.4 Cart page — what customers fill in

Typical sections (wording may vary slightly):

- **Lines** — change quantities, remove lines, see line totals.
- **Project / reference** — optional internal job name or customer reference where shown.
- **Billing vs delivery** — tick “same as billing” or enter a **delivery address**; may pick from **saved addresses** if they saved any.
- **Delivery contact** — name, phone, email for the driver or depot.
- **Fulfillment method** — **Delivery** vs **Click & collect** (or similar) when your project enables both.
- **Collection location** — if collecting, which **depot / location**.
- **Delivery window** — if your team configured **windows**, the customer picks a slot / date according to the rules (cut-off time, lead days).
- **Notes** — access, parking, gate codes — free text for ops.

Validation errors on submit are usually explicit (“choose a window”, “postcode required”) — read them aloud to the customer if they phone in stuck.

### 6.5 Save vs place

- **Save** (or equivalent) keeps the draft and returns to shopping.
- **Place order** (wording may be “Submit”) moves the order out of **draft** into the next stage (**quotation** or **placed** — depends on configuration and customer type).

### 6.6 After placing

The order appears under **My account → order history** (or your equivalent). They should note the **reference** or **order id** when calling support.

### 6.7 Pricing on the line

When the cart loads, the app may **re-apply customer pricing rules** (segments, promotions) and any **account discount %** set on their profile (shown on **My account** when active). If a customer compares the portal to a static PDF:

- Explain **account-specific pricing** (segment rules plus optional extra account %).
- Explain **VAT** shown ex vs inc.
- For **Tealbury**, explain **range-specific SKUs** if their spreadsheet used a single code column for all ranges.
- **Browse vs cart:** product lists may show catalogue list prices until the cart reprices — trust the **Cart** totals before submit.

---

## 7. Order statuses — what each stage means (for staff and customers)

The portal uses a **lifecycle** on each order. Labels on Admin **Today** and order lists use these statuses (colours help staff scan):

| Status | Plain-English meaning | Typical customer-facing explanation |
|--------|------------------------|-------------------------------------|
| **Draft** | Work in progress; still in **baskets/cart**; not submitted for fulfilment. | “It’s saved as a basket — nothing has been sent to the factory yet.” |
| **Quotation** | Priced proposal; may be awaiting customer **acceptance** or internal **review** depending on process. | “That’s your official quote — please confirm or ask us to revise.” |
| **Placed** | Accepted order — usually enters **operations** (picking, scheduling, manufacturing). | “We’ve taken the order forward for processing.” |
| **Invoiced** | Billing has been raised (or marked) — align with finance’s definition. | “An invoice has been issued — check your statement.” |
| **Paid** | Money received / allocated in your process. | “Thank you — this order shows as paid.” |
| **Cancelled** | Will not proceed — excluded from many **active** counts. | “This order was cancelled — if that’s wrong, contact us on Support.” |

**Archived** is a separate flag in many lists: old jobs hidden from the default queue but still searchable for audits.

Staff should **not invent** legal meanings — if finance uses “invoiced” differently from ops, document your **local** definition in an internal one-pager and link staff to it.

---

## 8. Delivery, collection, and delivery windows

### 8.1 Delivery

Customer provides **address** and **contact**. Your team configures which **locations** stock which lines and how **shipments** are recorded. First-line support: verify **postcode**, **contact phone**, and any **notes** before promising a date.

### 8.2 Click & collect

Customer picks a **collection location** from the list your team maintains (**Locations** in Admin). Explain cut-off times and ID requirements **using your depot SOP** — the portal only stores what they typed.

### 8.3 Delivery windows (when enabled)

**Windows** are staff-defined rules: which weekdays, **cut-off** time (e.g. order before 14:00 for next-day), and **lead time** in days. The cart validates the combination; if the customer cannot select a date, either no window applies, the cut-off passed, or data is incomplete — **Admin → Delivery windows** is the fix path for staff.

---

## 9. Support tickets (customer view)

Path: **Support** (`/account/support`).

### 9.1 Types

| Type | When to use |
|------|----------------|
| **Question** | General “how do I…?” — training, catalogue, account. |
| **Issue** | Something wrong with product, delivery, or portal behaviour. |
| **Returns** | Wants to send goods back — usually needs **order** and **lines**. |

The form can be **deep-linked** with query parameters (e.g. open as a return with a template subject) from other pages — if a customer lands with odd pre-filled text, it may be intentional.

### 9.2 Filters

Customers can filter **open vs resolved** and by **type**, and search **subject/body**. Resolved tickets remain visible for their audit trail.

### 9.3 Attachments

Files are normally attached in **replies** on the ticket thread (not always on first create) — tell customers to use **Reply** after the ticket exists if they cannot attach on step one.

### 9.4 What staff do next

See **§17** — staff use **Admin → Tickets** to respond, change status, and link to orders.

---

## 10. Downloads, depots, search, profile

### 10.1 Products — detail and make-up

From **Products**, opening a line shows specification, measurements, and — when configured — **Complete unit make-up** (the parts that make up a Tealbury **complete** package). If that section is empty, staff have not linked the BOM yet (§14.6).

### 10.2 Downloads

Customers expect **current** brochures. If a file 404s, the storage path or document row in Admin **Brochure & files** is wrong — re-upload or fix visibility.

### 10.3 Depots

Static or database-driven content — use for **opening hours**, **phone**, **what to bring for collection**. Keep in sync with real-world changes.

### 10.4 Global search (if enabled)

Typically searches **products** and possibly **orders** — exact scope depends on your build. Teach customers one **keyword** strategy (SKU first).

### 10.5 My account

Usually includes:

- **Company / contact** details (some fields may be read-only if locked by policy).
- **Statement balance** and recent **transactions** where accounting is wired.
- **Order history** with links to detail.

Password / email changes follow **Supabase Auth** — if “change email” fails, it is often a **confirmation link** or **URL allow-list** issue for IT.

---

## 11. Admin — sign-in and the Today page

### 11.1 Staff login

- URL: **`/admin/login`**.
- If the message says **this account is not a staff account**, that email is only a **customer** — IT must attach a **staff profile** (and permissions) or the user must use a different email.

### 11.2 Today (`/admin`)

The dashboard shows **headline numbers** (exact cards depend on version), typically including:

- **Orders** count (non-cancelled, non-archived).
- **Placed** orders count — jobs in **placed** status.
- **Orders today** — created since midnight (server date).
- **Customers** — profile rows.
- **Active products** — products marked active.
- **Assemblies** — count of **assembly** records (complete-unit bundles); sellable products with a **make-up** also show under **Catalogue** with a **Complete unit** badge.
- **Revenue (paid / invoiced)** — sum of totals for those statuses — **finance sanity check only** until you agree it matches your ledger.

**Recent orders** table — quick drill into latest activity.

**Workflow shortcuts** — grouped links (**Orders & quotes**, CRM, Catalogue, Stock, Uploads, Reports) match the sidebar; use this page to train “where do I click tomorrow morning?”.

### 11.3 Quick actions (+ button)

On most Admin pages, a red **+** floating button (bottom-right) opens:

- **Create quote** — starts a quotation for a customer (same flow as sidebar **Create quote**).
- **Create order** — starts a placed-order path for a customer.

The button is **hidden** while you are already on create-order/create-quote pages or on **print** views (invoice, quote PDF, packing slip) so it does not get in the way.

---

## 12. Admin — orders, quotes, and fulfilment

Quotes and orders share the same system: a **quotation** is an order with status **quotation**. Customers see pricing on quotes; staff convert to **placed** when the job is confirmed.

### 12.1 All orders & quotes

Path: **`/admin/orders`** (labelled **Orders & quotes**).

Search and filter by status (including **quotation**). Open a record to see **lines**, **status history**, **customer**, **totals**, and print actions.

| Status filter | Typical use |
|---------------|-------------|
| **Quotation** | Open proposals — edit lines, reprint quote, convert when accepted. |
| **Placed** | Jobs in operations. |
| **Draft** | Rare in Admin lists — customers usually keep drafts in **baskets**. |

**Archived orders** — separate filter/link where provided.

### 12.2 Process orders

Operational queue — “what needs doing next”. Train warehouse to start here each morning.

### 12.3 Reminders

Follow-ups (e.g. quotes aging) — use your internal SOP for when to nudge customers.

### 12.4 Create order and create quote

| Action | Path | Result |
|--------|------|--------|
| **Create order** | `/admin/create-order` or **+ → Create order** | New record for customer; usually progresses to **placed** after lines and delivery details. |
| **Create quote** | `/admin/create-quote` or **+ → Create quote** | New record with status **quotation**; add lines on order detail; print quote for customer. |

Always pick the correct **customer account** first. Wrong customer = wrong pricing segment and delivery defaults.

### 12.5 Quotation detail — convert to order

On an order in **quotation** status, the detail page shows a **Quotation** banner with **Convert to order**. That sets status to **placed** and keeps lines, pricing, and delivery data. Use after written/email confirmation per your sales SOP.

Print links on detail (where enabled): **Quote** (with or without pricing), **Invoice**, **Packing slip** — only when status and permissions allow.

### 12.6 Order detail — how new lines are priced (staff)

When adding catalogue lines on **order detail**, use the controls above **Add line**:

| Option | Behaviour |
|--------|-----------|
| **Use my default** | Follows **Settings → Advanced → Default: new lines use…** |
| **Catalogue list price** | Each new line uses the catalogue **unit price** (staff can still edit a line manually). |
| **Customer pricing** | After adding, prices are recalculated using **sell price rules + account discount %** for that order’s customer (same as customer cart repricing). |

**Apply customer pricing to all lines** — recalculates **every** catalogue line on the order (use after changing customer, segment, or account discount).

**Note:** Manual **Edit price** on a line always remains available. Customer portal carts reprice automatically on save; staff orders only reprice when you choose customer pricing or press **Apply customer pricing to all lines**.

### 12.7 Pick lists and package labels

Where enabled: generated from fulfilment workflow — print-friendly views for the **warehouse floor**. If a line shows “wrong product”, trace back to **catalogue SKU** and **snapshot** on the order line.

### 12.8 Printing

Use browser **Print → Save as PDF** for email attachments if you do not have direct email integration.

---

## 13. Admin — customers and CRM

### 13.1 Customers list

Search by company/contact/email; open **customer detail** for:

- **Profile** — company, contact, **payment terms**, and **Pricing segment** (always visible on the profile card — not hidden under “advanced”).
- **Account discount (%)** — optional; applies **after** segment-based sell rules on quotes, orders, and customer cart repricing.
- **Advanced profile** — billing/delivery addresses, credit limit, internal notes (expand **Show advanced profile fields**).
- **Account & billing** — statement summary, quick payments/credits where accounting is enabled.
- **Orders** for that account (links to **Orders & quotes**).
- **Consent** for **View as customer** (staff portal access) where shown.

**Where to set pricing (cheat sheet):**

| What you want | Where to click |
|---------------|----------------|
| Lists for dropdowns (groups, trade types, …) | **Pricing & margin → Segments** |
| “10% off carcasses for NW retailers in March” | **Pricing & margin → Sell price rules** |
| “This account always gets an extra 5% off everything” | **Customer profile → Account discount (%)** |
| “Net 30 on invoices” | **Customer profile → Payment terms** (text on prints) |
| Test one SKU for one customer | **Pricing & margin → Preview** |

When creating users: **Team users → Create user** can set segment fields for new customers; refine later on the profile.

### 13.2 CRM sub-areas

| Area | Typical use |
|------|-------------|
| **Open orders** | Pipeline view of jobs not finished. |
| **Activity** | Who did what, when — discipline on notes helps handovers. |
| **Pipeline** | Sales stages — keep stages aligned with how Lamtek actually sells. |
| **Directory** | Searchable list of accounts for outbound calling. |

---

## 14. Admin — catalogue (operations playbook)

Staff with catalogue access: **`/admin/catalogue`**.

### 14.1 Browse tab — daily hygiene

- Filter **Catalogue** to **Lamtek** or **Tealbury** when working one programme to avoid editing the wrong line.
- Use **Active only** before customer demos so you do not show half-retired stock.
- **Duplicate SKUs** — fix urgently; they break imports and image uploads.
- **Table view** — use **◀ ▶** beside the **column settings** cog to scroll wide tables left/right; resize columns by dragging headers; **double-click** many cells to edit inline.
- **Click a product row** — opens the **product modal** (view details; edit mode if you have catalogue edit permission). Technical JSON options are hidden in view mode.
- **Complete unit** badge on the name column when a **component breakdown** is linked to that sellable SKU.
- **Multiple categories** — in the product modal (or double-click the category column in table view), tick every category that applies and choose which is **primary** (used for category-scoped pricing rules and exports). Use **Manage categories** in the modal to add categories on the fly. Stock take lists the product under each assigned category.
- **Stock column** — shows stocked vs MTM toggle and quantity; double-click quantity to edit when permitted.
- **Grid / list / compact** views — same filters; table is best for bulk edits.

### 14.2 Import & export tab — Lamtek file discipline

1. **Export** a dated backup (`catalogue-YYYY-MM-DD.xlsx`).
2. Edit in Excel / Sheets — **never** change `sku` on an existing row unless you intend to **retire** the old code and create a new product.
3. **Import** the same column layout.
4. Spot-check three SKUs in **Browse** after import.

### 14.3 Tealbury workbook — rehearsal checklist

1. Open Excel, press **Ctrl+Alt+F9** (full recalc) if needed, then **Save** — ensures formula results are current.
2. Confirm **each door-range sheet** still has a proper **CODE / PRICE** table (not only the Pricelist hub).
3. In the portal, **Import & export** → choose file → read **Parser notices**.
4. Preview row count vs expectation (rough order of magnitude per sheet).
5. Run **Replace Tealbury programme** only after agreement — it **deletes all Tealbury programme products** first.
6. Ask one trade user to verify **Tealbury kitchens** page.

### 14.4 Audit tab — monthly control

Run against your **master** spreadsheet:

- **Missing** — add via import.
- **Extra** — decide retire vs data error.
- **Duplicates** — merge in Browse.

### 14.5 Images tab — brand consistency

- **Mapping CSV** for bulk work from Dropbox folders.
- **Upload by SKU** for ad-hoc shots — filename = **portal** SKU (remember Tealbury **middle dot** SKUs).

### 14.6 Complete unit make-up (Tealbury and bundles)

A **complete** Tealbury unit is not one physical box in the warehouse — it is sold as one line but **built from parts** your team stocks and picks:

| Part type | Typical examples |
|-----------|------------------|
| **Unit / carcass / cabinet** | White, oak, grey carcass SKU for that width |
| **Door** or **Drawer** | Front for **High line** (door) vs **Drawer line** (door + drawer) |
| **Hinge** + **Hinge plate** | Brand variants (Blum, Hafele, Titan, Hettich, etc.) |
| **Leg kit** | Fitted by installer under the carcass |
| **Fittings bag** | Caps, screws, dampers, small hardware |

**Where to define it (staff):**

1. **Catalogue → Browse** → open the **complete** sellable product (the package SKU customers order).
2. Section **Complete unit make-up** (view and edit modes).
3. If empty: click **Define component breakdown**, then **Add component line** for each part:
   - Search by **SKU or name** (datalist).
   - Set **Part type** and **Qty per complete unit** (e.g. 2 hinges, 1 carcass).
4. Save is immediate per line; remove mistaken lines with **Remove**.

**What customers see:** On **Products** (and similar product detail views), section **Complete unit make-up** lists the same parts when a breakdown exists — useful for installers and account managers explaining what is in the price.

**Ordering note:** Customers may still add the **complete** line to the cart as one SKU; warehouse and stock take must track **components** separately (see §15.1).

**Lamtek guided / assembly ordering:** Legacy **assemblies** in the Lamtek ordering wizard are separate rows in the database; linking a sellable **product** to an assembly (via **product_id** on the assembly) is how Admin ties a catalogue SKU to a BOM. If “complete” lines have no make-up, ops cannot infer pick quantities from stock.

---

## 15. Admin — stock, locations, delivery windows

### 15.1 Stock take

Path: **`/admin/stock`**.

Per-product, per-**location** (depot) quantities — used for **inventory accuracy** and allocation. Workflow:

1. Choose **location** at the top (stock is per depot, not one global number).
2. Work in **sections** (by category) or **flat** list.
3. Use **Category** and **Product group** filters — imported Lamtek/Tealbury categories (e.g. “Lamtek — Wall units”) now match when you pick legacy names like **Units** or **Doors**; if nothing shows, clear filters or check the message **“No products match the current filters”**.
4. **Save section** after counts; realtime sync if two staff count the same depot.

Train staff to **count first**, adjust in portal second, note reason in internal comms.

### 15.2 Locations

Depots, main warehouse, third-party hubs — affect **collection** options and **stock** rows. Renaming a location does not rename customer-facing marketing text on **Depots** unless that content is wired to the same data — verify.

### 15.3 Delivery windows

Owned by **ops + sales** — wrong cut-off = angry customers. After edits, place a **test order** in a non-production environment or with a test account before peak season.

---

## 16. Admin — files, pricing, reports, accounting

### 16.1 Brochure & files

Upload, title, and categorise documents surfaced on **Downloads**. Use consistent naming (“Pricelist March 2026 PDF”) so customers find them in search.

### 16.2 Pricing & margin

Path: **`/admin/pricing`**.

| Tab | Purpose |
|-----|---------|
| **Segments** | Maintain dropdown lists: customer **groups**, **locations (pricing region)**, **trade types**, **company types**. |
| **Sell price rules** | Discounts, mark-ups, fixed prices — match customers when segment fields on the rule equal the customer profile (blank on rule = “any”). Scope: all products, category, SKU, or collection. Optional dates and minimum order value for promos. |
| **Cost rules** | Landed cost for **margin** reporting (does not change customer price unless you also add a sell rule). |
| **Collections** | Named product ranges for promotions. |
| **Preview** | Pick customer + product + optional order total — see list price, resolved sell, cost, unit margin. |

**Two layers of customer discount:**

1. **Sell price rules** — apply when segment (and scope/dates) match.
2. **Account discount (%)** on the **customer profile** — applies to the result for that account only.

Customer **cart** and **Apply customer pricing** on staff orders use the same engine. Document who may edit rules — mistakes are **high impact**.

### 16.3 Staff settings affecting orders

**Settings → Advanced → Default: new lines use…**

- **Catalogue list price** — traditional staff order entry.
- **Customer pricing (rules + account discount)** — auto-reprice when adding lines on order detail (if that order’s mode is set to customer pricing).

Per-order override on **order detail** does not change this global default.

### 16.4 Reports

Operational / sales summaries — agree which report is **source of truth** vs finance system.

### 16.5 Accounting

Restricted permission on many installs — ledger views and exports. Staff without access should **not** be given the finance password; route requests to the controller.

---

## 17. Admin — tickets, users, permissions

### 17.1 Tickets

List → open ticket → **reply** to customer → set **status** (e.g. resolved). Internal notes (if present) are for staff only — never paste sensitive supplier pricing into customer-visible replies by mistake.

### 17.2 Team users

Invite staff, deactivate leavers promptly.

### 17.3 Permissions (conceptual)

Permissions map **areas of Admin** (orders, customers, catalogue, stock, uploads, pricing, reports, accounting, tickets, users) to **roles**. If someone can open Admin but a page says **no access**, extend their role — do **not** share a single superuser login; audit trails become useless.

---

## 18. Staff conduct, consent, and data handling

- **View as customer** — use for diagnosis; obtain **consent** where the profile requires it; stop impersonation when finished (sign out or clear impersonation).
- **Tickets** — treat as **business records**; no abusive language; no promising refunds your policy does not allow.
- **Exports** — customer spreadsheets are **personal data**; store under your retention policy; do not email unencrypted highly sensitive lists to personal inboxes.

---

## 19. Operational playbooks

### 19.1 Before go-live (checklist)

- [ ] All staff accounts created + permissions smoke-tested.
- [ ] Production URL on Supabase Auth allow-list.
- [ ] Lamtek catalogue import smoke test (3 SKUs).
- [ ] Tealbury import smoke test + customer verification on **Tealbury kitchens**.
- [ ] For key **complete** Tealbury SKUs: **Complete unit make-up** defined (carcass, door/drawer, hinges, plates, legs, fittings).
- [ ] Stock take smoke test on **Components only** at one depot.
- [ ] One **delivery** and one **collection** test order.
- [ ] Downloads folder has current PDFs.

### 19.2 Monthly

- Catalogue **Audit** vs master file.
- Review **open tickets** older than X days.
- Reconcile **placed** vs warehouse WIP (process dependent).

### 19.3 Incident — “nothing loads”

1. Check Supabase dashboard (project paused?).
2. Check status page / hosting.
3. Try incognito window (rules out bad extension).
4. Escalate to IT with **timestamp**, **user email**, **screenshot of browser console** if possible.

---

## 20. Troubleshooting (wide)

| Symptom | Likely causes | Steps |
|---------|----------------|-------|
| Spinner forever | DB paused; ad blocker; VPN | Resume project; disable blocker for your domain; try another network. |
| Login email never arrives | Spam; wrong email; Auth SMTP | Check junk; verify address; IT checks Supabase Auth logs / SMTP. |
| “Not staff” at admin login | Wrong account | Correct staff email or create staff profile. |
| Cart empty | Wrong **active** basket | **Order baskets** → select correct draft. |
| Cannot submit cart | Missing delivery window / address | Read on-screen error; fill required fields. |
| Price “wrong” vs PDF | **Pricing rules**; VAT | Check customer segment in Admin; quote inc-VAT figure. |
| Tealbury import 0 rows | Bad headers / merged cells | Fix sheet; Parser notices. |
| Wrong Tealbury price | Hub-only file | Ensure **per-range** sheets exist and saved. |
| Image not mapping | SKU typo | Copy SKU from **Browse** tab. |
| Duplicate SKUs after import | File changed SKU column | Align file with portal; delete duplicate rows in Browse. |
| Stock take empty for “Units” / “Doors” | Category filter vs imported slugs | Clear filters; products may be under **Lamtek — …** categories; try **All** categories. |
| Customer price wrong on staff order only | Lines added at list price | Order detail → **Customer pricing** or **Apply customer pricing to all lines**. |
| Account discount not applying | Set to 0 or blank | Customer profile → **Account discount (%)**; save; reprice order/cart. |
| Cannot find pricing on customer | Looking under advanced only | **Pricing segment** is on main profile card; rules live under **Pricing & margin**. |
| Wide catalogue table clipped | Horizontal scroll | Use **◀ ▶** next to column settings cog. |

---

## 21. Phone and email scripts (extended)

**Basket vs submitted**  
“You still have that saved as a **basket** — it hasn’t been submitted as an order yet. Open **Order baskets**, pick the right basket, then **Cart**, and press **Place order**.”

**Tealbury vs Lamtek**  
“**Tealbury kitchens** is a separate list from the main **Products** area. If you’re pricing a Tealbury job, start from **Create order → Tealbury kitchens**.”

**Quote vs placed**  
“Right now that’s showing as a **quotation** — we’ll move it to **placed** once you confirm in writing / pay per our terms.”

**Return started**  
“I see the return ticket — please leave the lines as selected and upload photos on the **reply**. Our team will confirm if it’s within policy.”

**Escalation**  
“I’m going to escalate this to **[role]** and note ticket **[subject]** — you’ll get an email when there’s an update.”

---

## 22. FAQ (extended)

**Q: Can two people edit the same basket?**  
A: They share the same account if they share login — not recommended. Separate logins per person for auditability.

**Q: Why does my draft disappear?**  
A: Rare: someone deleted lines or switched active basket — check **Order baskets** and **order history** for accidental submit.

**Q: Do we support Safari on iPad?**  
A: Generally yes for modern versions — if layout breaks, try Chrome and report to IT with iOS version.

**Q: Where is VAT documented?**  
A: On-screen totals; statutory invoice wording may still come from your **accounts package** — align messaging with finance.

**Q: Why is yesterday’s price on my old order different from the website today?**  
A: Lines store **what was valid when you ordered** (name, SKU, unit price snapshot). The live catalogue can move — that does not rewrite history.

**Q: Can I email you my basket instead of using the portal?**  
A: Business policy call — operationally, a **placed** or **quoted** order in the system reduces transcription errors; encourage portal submit then email the **reference**.

**Q: What is the difference between a quote and an order in Admin?**  
A: Same record type — **quotation** status is a quote. Staff use **Create quote** or convert a quotation to **placed** when the customer confirms.

**Q: We gave the customer 5% account discount — why is one line still list price?**  
A: Staff-added lines may have been entered with **catalogue list price** — use **Apply customer pricing to all lines** on order detail, or set **When adding catalogue lines** to **Customer pricing**.

**Q: Where do I set trade type / pricing group?**  
A: **Customers** → open account → **Pricing segment** on the profile (not only at user creation). Maintain dropdown options under **Pricing & margin → Segments**.

**Q: Should we count complete Tealbury units or the parts in stock take?**  
A: Count **components** (carcass, door, hinges, etc.) with **Stock count → Components only**. Complete package lines are for sales reference unless you expand **Show parts** to audit the BOM.

**Q: Customer asks what is inside a complete unit price — where do I look?**  
A: **Catalogue** product modal → **Complete unit make-up**, or the customer’s product detail **Complete unit make-up** section if configured.

**Q: We imported Tealbury but stock take looks empty.**  
A: Check **Stock count** is not stuck on **Complete packages only** with no BOMs defined; switch to **Components only** and clear category/product-group filters.

---

## 23. Deep dives (ordering modes, catalogue behaviour, training)

### 23.1 Create order — the three cards on `/ordering/start`

| Card | Where it goes | When to recommend it |
|------|----------------|----------------------|
| **Tealbury kitchens** | Tealbury-only shop | Packaged kitchen **programme** lines from the Tealbury price book — **not** for ad-hoc Lamtek components. |
| **Manual order** | Full Lamtek browse | “I know what I need — filters, search, full catalogue.” |
| **Guided order** | Wizard then catalogue | “I want prompts for **type**, **range**, **stock vs complete**, then the picker.” |

Customers can still change filters later; this screen is only the **starting lane**.

### 23.2 Components vs complete units and BOM

| Concept | Who orders it | What you stock |
|---------|---------------|----------------|
| **Component** | Trade customer ordering parts, or implied inside a complete | Physical SKU on the shelf — **count in stock take** |
| **Complete unit** | Customer adds **one line** (e.g. “600mm base — Hadfield”) | **No** single box — pick list is the **BOM** parts |

**Tealbury complete** lines should have a **make-up** in Admin (§14.6): unit/carcass colour, door or drawer front, hinges + plates (brand), leg kit, fittings bag. **High line** vs **Drawer line** changes whether a **drawer** row appears in the BOM.

**Lamtek ordering:** The **guided** flow may still use legacy **assembly** records (pre-defined bundles in the ordering wizard). Admin can link a sellable **product** to an assembly so the same BOM appears on the catalogue product — look for the **Complete unit** badge in **Browse**.

**Support scripts:**

- “You ordered the **complete** SKU — we pick carcass, door, hinges, legs, and fittings as separate stock lines.”
- “If the website does not list what is included, we have not finished the **make-up** on that product — I will ask catalogue to link the parts.”

**Do not** tell warehouse to increment stock on the **package** SKU when components are tracked — use **Components only** in stock take (§15.1).

### 23.3 Stock catalogue vs made-to-measure

The **Stock items only** filter (Admin) and parts of **guided** ordering respect a **stock vs MTM** flag on products. Customer script: “If the wizard hides something you know we stock, try **manual order** or call us — the flag might be wrong on that line.”

### 23.4 My account — what is usually on the page

| Block | Notes |
|-------|--------|
| **Company / contact** | Drives defaults for new orders — typos propagate to delivery labels. |
| **Balance / statement lines** | High-emotion area — if it disagrees with Sage / Xero, **finance** leads; portal shows what the integration loaded. |
| **Order history** | Submitted jobs; **drafts** still live under **Order baskets** until promoted. |

### 23.5 Reading an old order (customer)

Opened from **history** — each line shows **description and price as captured then**. Do **not** promise “we will re-price old orders to today’s promotion” unless policy explicitly allows it.

### 23.6 Global search (header bar)

If your build exposes it: prefer **SKU** for products and **reference** for orders. Partial matches depend on implementation — if “nothing found”, try **Browse** or **All orders** in Admin.

### 23.7 Half-day training outline (new trade customer)

1. **Login & security** (15 min) — password reset, sign-out on shared PCs, bookmark the correct URL.  
2. **Sidebar map** (15 min) — §5 table on a projector.  
3. **Create order → Manual** (25 min) — add three lines, change qty, remove one line.  
4. **Order baskets + active basket** (20 min) — create second draft, switch active, show cart changes.  
5. **Submit** as far as your demo environment allows (15 min) — **draft → quotation** vs **placed** per your policy.  
6. **Support + Help** (15 min) — raise a **question** ticket; resolve it as staff in Admin if training together.  
7. **Q&A** (15 min).

### 23.8 Full-day add-ons (Tealbury + staff)

- **Tealbury kitchens** — import story in plain English (door ranges, SKUs with range in the name); place a **tiny** Tealbury basket in **training data** only.  
- **Staff shadow** — open **Admin → Customers**, find the trainee’s test account, discuss what **must not** be edited without approval.

### 23.9 Peak-week checklist (condensed)

- [ ] **Delivery windows** reviewed vs advertised cut-offs.  
- [ ] **Downloads** pricelist PDF date bumped.  
- [ ] **Tealbury** workbook re-import scheduled **after** hours + smoke test.  
- [ ] **Tickets** — extra shift or “expected delay” template reply agreed.

---

## 24. Related repository files

| File | Contents |
|------|-----------|
| `docs/DEPLOY_GITHUB_PAGES.md` | GitHub Actions → Pages deploy; Supabase URL allow-list. |
| `docs/DEPLOY_VERCEL.md` | Alternative live site (Vercel), env vars. |
| `docs/DROPBOX_IMAGES_SETUP.md` | Image URLs. |
| `scripts/clear-all-products.mjs` | **Destructive** — removes **all** products; staff must never run on production without written approval. |

**Public demo (GitHub Pages):** https://lamteksystem.github.io/lamteksystem/  
**Repository:** https://github.com/lamteksystem/lamteksystem

---

## 25. Appendix — technical reference (for IT and authors)

Use this section in tickets to developers — **not** for reading to trade customers.

| Friendly concept | Implementation hint |
|------------------|---------------------|
| Lamtek vs Tealbury on a product | Programme field on `products` row (two allowed values in application code). |
| Tealbury extra fields | JSON `options` on product — trade code, door range, sheet names, finish price maps, etc. |
| Draft / basket | `orders` with `status = draft`; active id in `user_preferences` key `active_draft_order_id`. |
| Order line frozen text | `order_lines.product_snapshot` JSON. |
| Ticket types | `question`, `issue`, `returns` (note plural on returns). |
| Staff access | `staff_profiles` + permission checks per Admin route family. |
| Account discount % | `customer_profiles.account_discount_percent` (0–100, optional). |
| Staff order line pricing default | `user_preferences` JSON key `admin_ui_prefs` → `adminOrderLinePricingDefault`. |
| Row security | Supabase **RLS** on tables — service role bypasses (scripts only). |

**Lamtek CSV/XLSX column keys** (standard export):  
`category_slug`, `category_name`, `name`, `description`, `sku`, `unit_price`, `active`, `image_url`, `image_alt`, `is_stock`

---

*Extended manual (§1–§25): customer nav, orders/baskets/cart, quotes, pricing segments & account discount, **complete-unit BOM & component stock take**, multi-category catalogue, fulfilment, support, Admin modules, catalogue/stock UX, playbooks, deep dives, troubleshooting, scripts, and appendix. **Revision:** May 2026 (BOM / stock-count update).*
