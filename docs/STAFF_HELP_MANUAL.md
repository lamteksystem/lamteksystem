# Lamtek ordering portal — staff & partner manual (extended)

This manual is for **Lamtek staff** and trusted partners (for example **Tom**) who need to **use the portal**, **onboard customers**, **answer first-line questions**, and **coordinate with IT** without reading source code.  
**Plain English first:** internal database names and JSON keys appear only in **[§25 Appendix](#25-appendix--technical-reference-for-it-and-authors)**.

---

### How to use this document

| If you need… | Start at… |
|--------------|-----------|
| **Orientation** — what the app is | [§1](#1-what-this-system-is-for) |
| **Vocabulary** for consistent messaging | [§4](#4-words-we-use-expanded-glossary) |
| **Customer training** — “where do I click?” | [§5](#5-customer-area--full-tour-of-the-sidebar) · [§6](#6-orders-baskets-cart-and-checkout-deep-dive) |
| **“What does this order status mean?”** | [§7](#7-order-statuses-what-each-stage-means-for-staff-and-customers) |
| **Delivery vs collection, slots** | [§8](#8-delivery-collection-and-delivery-windows) |
| **Support / returns** | [§9](#9-support-tickets-customer-view) |
| **Admin day-to-day** | [§11](#11-admin-sign-in-and-the-today-page) onward |
| **Trainers / ordering modes / session plans** | [§23](#23-deep-dives-ordering-modes-catalogue-behaviour-training) |
| **Catalogue / Tealbury Excel** | [§14](#14-admin-catalogue--operations-playbook) |
| **First-line scripts** | [§21](#21-phone-and-email-scripts-extended) |
| **When something breaks** | [§20](#20-troubleshooting-wide) |
| **Spreadsheet / SQL names** | [§25](#25-appendix--technical-reference-for-it-and-authors) |

Customer-facing short tips also appear under **Help** and **Support** in the app.

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
| **Warehouse / ops** | §6–§8, §12, §15, pick lists / labels in §12 |
| **Catalogue owner** | §14, Tealbury Excel behaviour, §20 import rows |
| **Finance** | §7, §12, §16, accounting permission |
| **Trainers** | §5–§6, §23 |
| **IT / implementer** | §25 Appendix, repository files in §24 |

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
| `/admin/orders` | Order list |
| `/admin/orders/processing` | Processing queue |
| `/admin/create-order` | Place order on behalf of customer |
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
| **Segment / pricing rule** | Admin-controlled rules that can change **sell price** for a logged-in customer (e.g. trade vs retail, promotions). |
| **Fulfillment** | **Delivery** to an address vs **collection** from a depot — chosen at checkout where enabled. |
| **Delivery window** | A named slot pattern (weekday, cut-off, lead time) configured by staff for customer selection. |
| **Snapshot** (order line) | Copy of product name/SKU/price **frozen** on the line when ordered — so old orders stay readable if the catalogue changes later. |
| **VAT** | UK tax — totals on screen typically show **ex-VAT** and **inc-VAT** where the app displays both. |
| **Impersonation** | Staff viewing the portal **as** a specific customer user id (for diagnosis). |
| **Preference** (ordering) | Small settings like **which draft is active** — stored in the **database** per user (not only in the browser). |

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

When the cart loads, the app may **re-apply customer pricing rules** (segments, promotions). If a customer compares the portal to a static PDF:

- Explain **account-specific pricing** (if you use rules).
- Explain **VAT** shown ex vs inc.
- For **Tealbury**, explain **range-specific SKUs** if their spreadsheet used a single code column for all ranges.

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

### 10.1 Downloads

Customers expect **current** brochures. If a file 404s, the storage path or document row in Admin **Brochure & files** is wrong — re-upload or fix visibility.

### 10.2 Depots

Static or database-driven content — use for **opening hours**, **phone**, **what to bring for collection**. Keep in sync with real-world changes.

### 10.3 Global search (if enabled)

Typically searches **products** and possibly **orders** — exact scope depends on your build. Teach customers one **keyword** strategy (SKU first).

### 10.4 My account

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
- **Assemblies** — where you use **complete unit** bundles.
- **Revenue (paid / invoiced)** — sum of totals for those statuses — **finance sanity check only** until you agree it matches your ledger.

**Recent orders** table — quick drill into latest activity.

**Workflow shortcuts** — grouped links (Orders, CRM, Catalogue, Stock, Uploads, Reports) match the sidebar; use this page to train “where do I click tomorrow morning?”.

---

## 12. Admin — orders and fulfilment

### 12.1 All orders

Search and filter; open an order to see **lines**, **status history**, **notes**, **customer**, **totals**, and **print** actions (**quote**, **invoice**, **packing slip**) where implemented.

### 12.2 Process orders

Operational queue — “what needs doing next”. Train warehouse to start here each morning.

### 12.3 Reminders

Follow-ups (e.g. quotes aging) — use your internal SOP for when to nudge customers.

### 12.4 Create order

Staff builds an order **for** a customer account — useful for phone orders. Ensure the correct **customer** is selected; lines still respect **pricing rules** when repriced for that user.

### 12.5 Pick lists and package labels

Where enabled: generated from fulfilment workflow — print-friendly views for the **warehouse floor**. If a line shows “wrong product”, trace back to **catalogue SKU** and **snapshot** on the order line.

### 12.6 Printing

Use browser **Print → Save as PDF** for email attachments if you do not have direct email integration.

---

## 13. Admin — customers and CRM

### 13.1 Customers list

Search by company/contact/email; open **customer detail** for:

- Profile fields (segments for **pricing**, delivery region flags, CRM notes if present).
- **Orders** for that account.
- **Consent** flags where shown (e.g. staff portal access for impersonation).

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

---

## 15. Admin — stock, locations, delivery windows

### 15.1 Stock take

Per-product, per-location quantities where your schema supports it — used for **inventory accuracy** and sometimes **allocation**. Train staff to **count first**, adjust in portal second, note reason in internal comms.

### 15.2 Locations

Depots, main warehouse, third-party hubs — affect **collection** options and **stock** rows. Renaming a location does not rename customer-facing marketing text on **Depots** unless that content is wired to the same data — verify.

### 15.3 Delivery windows

Owned by **ops + sales** — wrong cut-off = angry customers. After edits, place a **test order** in a non-production environment or with a test account before peak season.

---

## 16. Admin — files, pricing, reports, accounting

### 16.1 Brochure & files

Upload, title, and categorise documents surfaced on **Downloads**. Use consistent naming (“Pricelist March 2026 PDF”) so customers find them in search.

### 16.2 Pricing & margin

**Segments** (trade type, region, group) and **rules** (discount %, fixed price, date ranges) change what a logged-in customer **pays**. Document who may edit rules — mistakes here are **high impact**.

### 16.3 Reports

Operational / sales summaries — agree which report is **source of truth** vs finance system.

### 16.4 Accounting

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

---

## 23. Deep dives (ordering modes, catalogue behaviour, training)

### 23.1 Create order — the three cards on `/ordering/start`

| Card | Where it goes | When to recommend it |
|------|----------------|----------------------|
| **Tealbury kitchens** | Tealbury-only shop | Packaged kitchen **programme** lines from the Tealbury price book — **not** for ad-hoc Lamtek components. |
| **Manual order** | Full Lamtek browse | “I know what I need — filters, search, full catalogue.” |
| **Guided order** | Wizard then catalogue | “I want prompts for **type**, **range**, **stock vs complete**, then the picker.” |

Customers can still change filters later; this screen is only the **starting lane**.

### 23.2 Components vs bundled “complete” units

Some Lamtek flows talk about **complete units** (kitchen runs sold as a configured bundle) versus **components** (door, carcass, hinge line by line). In Admin you may maintain **assemblies** that bundle components. If a customer cannot find “one SKU for the whole base unit”, either **no assembly row** exists yet, or they must order **parts** — check **Browse** for an assembly-style product name or advise them to use **guided** mode if your team configured it there.

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
| `docs/DEPLOY_VERCEL.md` | Live site, env vars. |
| `docs/DROPBOX_IMAGES_SETUP.md` | Image URLs. |
| `scripts/clear-all-products.mjs` | **Destructive** — removes **all** products; staff must never run on production without written approval. |

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
| Row security | Supabase **RLS** on tables — service role bypasses (scripts only). |

**Lamtek CSV/XLSX column keys** (standard export):  
`category_slug`, `category_name`, `name`, `description`, `sku`, `unit_price`, `active`, `image_url`, `image_alt`, `is_stock`

---

*Extended manual (§1–§25): customer nav, orders/baskets/cart, statuses, fulfilment, support, Admin modules, playbooks, deep dives, troubleshooting, scripts, and appendix. Update when product behaviour or navigation changes.*
