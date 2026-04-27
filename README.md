# Lamtek – Online Ordering Portal

React + Supabase web app: customer login, ordering (components + complete units + made-to-measure), cart, account; staff admin for orders and customers.

---

## What’s already built (you don’t implement this)

All of this is **in the codebase** and works once the app is connected to Supabase:

- **Customer:** Login, Dashboard, Products, Downloads, **Create order** (component products, complete units, **Made to measure**), Cart, Account, Order history.
- **Staff:** Admin at `/admin` – dashboard, customers, orders, order detail (edit lines, delivery, status), create order for a customer, “View as customer”.

### Recent additions (admin + CRM + reporting)

- **Admin permissions**
  - `permission_rules` engine + UI (`/admin/permissions`)
  - Navigation and routes are permission-aware; if no permission rules exist yet, staff default to allow (so you can add rules gradually).
- **Order audit**
  - `order_events` table and timeline on admin order detail.
- **Fulfilment / shipments**
  - `shipments` + `stock_movements` tables.
  - Admin order detail: create a shipment and allocate stock from a location (decrements `product_stock` and logs movements).
  - Order processing: one-click “Ship + allocate stock” for invoiced orders.
- **CRM pipeline**
  - `opportunities` + `activities` tables and UI on customer detail.
  - `/admin/crm` pipeline board by stage + “activities due” (with overdue highlighting).
- **Reports**
  - `/admin/reports` sales + margin overview, top customers/products, and stock-by-location (low stock + valuation).
- **Customer UX**
  - Order detail page includes “Reorder to cart” (replaces current draft cart with the selected order’s lines).

So your job is only: **get the app talking to your Supabase project** and, if you want, add data (products, documents).

---

## What you need to do (overview)

| Done? | What | Why |
|-------|------|-----|
| ☐ | Have a Supabase project | So the app has a database and auth. |
| ☐ | Put Supabase URL + anon key in `.env` | So the app can connect. |
| ☐ | Run the database migrations | So tables (users, orders, products, etc.) exist. |
| ☐ | Run the app: `npm install` then `npm run dev` | So you can open the site at http://localhost:5173 |
| ☐ | (Optional) Create storage buckets + run storage SQL | Only if you want Downloads (PDFs) or product images. |
| ☐ | (Optional) Create a test customer or admin user | So you can log in. |
| ☐ | (Optional) Add products / run seed / import pricelist | So the ordering page has something to sell. |

---

## First-time setup (minimal: get the app running)

Do these in order.

### 1. Supabase project

- Go to [supabase.com](https://supabase.com) and sign in.
- Create a new project (or use one you already have).
- Wait until it’s ready (database and API are set up).

### 2. Copy the app’s config into `.env`

- In the project folder you have a file **`.env.example`**. Copy it and name the copy **`.env`** (same folder as `package.json`).
- In Supabase: **Project Settings** (gear) → **API**.
  - Copy **Project URL**.
  - Copy **anon public** key (the long string under “Project API keys”).
- Open your **`.env`** file and set:
  - `VITE_SUPABASE_URL` = the Project URL you copied.
  - `VITE_SUPABASE_ANON_KEY` = the anon key you copied.  
  (Your `.env.example` may already have placeholders; replace them with your real values.)

### 3. Create the database tables (migrations)

You have two ways; use one.

**Option A – Supabase dashboard (no CLI):**

- In Supabase, open **SQL Editor**.
- In your project, open the folder **`supabase/migrations`** and run the SQL files **in order by number** (001, then 002, then 003, etc.):
  - `001_schema.sql` – tables for users, products, orders, etc.
  - `002_storage_policies.sql` – if you want file storage (downloads/images).
  - `003_staff_and_delivery.sql` – staff and delivery fields.
  - `004_assemblies.sql` – complete units.
  - Any others (005, 006, …) if present.
- For each file: open it, copy all the SQL, paste into the SQL Editor, run.

**Option B – Supabase CLI:**

- In a terminal: `npm run supabase:login` (sign in), then `npm run supabase:link` (link to your project).
- Then: `npm run supabase:push` – this runs all migrations for you.

### 4. Turn on Email login (so you can sign in)

- In Supabase: **Authentication** → **Providers**.
- Enable **Email** (and optionally “Confirm email” if you want).

### 5. Run the app

In the project folder:

```bash
npm install
npm run dev
```

- Open **http://localhost:5173** in the browser.
- The site will load. You won’t be able to log in until you have a user (next section).

---

## Optional: create a user so you can log in

The app doesn’t create users for you by default. You can do either:

**A) Sign up through the app**

- Go to http://localhost:5173/login and use “Sign up” (if the app shows it) or create a user in Supabase **Authentication → Users → Add user** (email + password). Then log in with that email/password.

**B) Use the setup script (creates a test customer + storage buckets)**

- In Supabase **Project Settings → API**, copy the **service_role** key (keep it secret; don’t put it in the frontend).
- In your **`.env`** file add a line:  
  `SUPABASE_SERVICE_ROLE_KEY=paste-the-service-role-key-here`
- In the project folder run:  
  **Windows (PowerShell):** `$env:SUPABASE_SERVICE_ROLE_KEY='your-key-here'; npm run setup:supabase`  
  **Mac/Linux:** `export SUPABASE_SERVICE_ROLE_KEY='your-key-here'` then `npm run setup:supabase`
- That script can create a test customer (e.g. `customer@example.com` / a generated password) and storage buckets. Check the script output for the password.
- If the script created buckets, run **`002_storage_policies.sql`** in the SQL Editor (if you haven’t already) so the app can read from storage.

**Staff / admin user**

- To use the **staff backend** at `/admin`, you need a “staff” user:
  - Run:  
    **Windows:** `$env:SUPABASE_SERVICE_ROLE_KEY='your-key'; npm run create-admin`  
    **Mac/Linux:** `export SUPABASE_SERVICE_ROLE_KEY='your-key'; npm run create-admin`
  - Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before running (use a dedicated admin mailbox for this project).
  - Or promote an existing user: set `PROMOTE_EMAIL=that@email.com` in `.env` and run `npm run promote-to-admin`.

---

## Optional: add products (so ordering has something to sell)

Right after migrations, the **products** table is empty (or has only what’s in seed files). You can:

1. **Run the seed SQL** (adds sample categories and some products):
   - Put **`DATABASE_URL`** in `.env`. Get it from Supabase **Project Settings → Database → Connection string** (use the **URI**; “Session pooler” with port 6543 is best).
   - Run: `npm run seed`
   - That runs the SQL files in `supabase/seed_sample.sql` and `seed_components_and_assemblies.sql` (and any others listed in the seed script).

2. **Import the full pricelist from the PDF** (adds many more products):
   - Same **`DATABASE_URL`** in `.env` as above.
   - Run:  
     `npm run import-pricelist -- "C:\path\to\UK_TM_Pricelist_Jun_2025_V3.pdf"`  
     (Use the real path to your pricelist PDF.)
   - To only see what would be imported (no DB changes):  
     **Windows:** `$env:DRY_RUN='1'; npm run import-pricelist -- "path\to\pricelist.pdf"`  
     **Mac/Linux:** `DRY_RUN=1 npm run import-pricelist -- "path/to/pricelist.pdf"`

3. **Add or edit products manually** in Supabase **Table Editor** → **products** (and **categories** if needed).

---

## Optional: add PDFs as downloads

- Upload PDFs (e.g. pricelist, Door Finder, brochures) to the **documents** storage bucket in Supabase (Storage → documents → Upload).
- In **Table Editor** → **documents**, add a row per file: **title**, **description**, **file_path** (path in the bucket or full URL), **file_type** (e.g. `application/pdf`), **category** (`brochure`, `pricelist`, `technical`, or `other`). Then they show under Downloads in the app.

---

## Quick reference

- **Repository:** [github.com/lamteksystem/lamteksystem](https://github.com/lamteksystem/lamteksystem) · org: [github.com/lamteksystem](https://github.com/lamteksystem)
- **First-time GitHub + Supabase:** [docs/SETUP_GITHUB_AND_SUPABASE.md](docs/SETUP_GITHUB_AND_SUPABASE.md) (push access and DB migrations)
- **Multiple accounts on one PC (Lamtek vs Trade Mouldings):** [docs/WORKSPACE_IDENTITY.md](docs/WORKSPACE_IDENTITY.md) — this repo’s terminal auto-switches `gh` + Supabase token; set Chrome profile in `scripts/identity.config.json`
- **Supabase (Lamtek):** [Dashboard](https://supabase.com/dashboard/project/jhmepthfxnpmwpjobumj) — set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (this Vite app does **not** use `NEXT_PUBLIC_*`).
- **App URL:** http://localhost:5173 (after `npm run dev`).
- **Staff backend:** http://localhost:5173/admin (log in with a staff/admin user).
- **Port:** Frontend uses **5173**.
- **Logo:** Customer and marketing headers use `public/marketing/logo-on-light.png` and `logo-on-dark.png` (Lamtek brand), loaded via `BrandLogo` and `MarketingHeader`.

---

## Troubleshooting

- **“I can’t log in”** – Make sure Email provider is enabled in Supabase Auth, and you have a user (created in Auth → Users or via the setup script).
- **“Nothing on the ordering page”** – Add products (seed and/or pricelist import) and ensure **categories** exist (seed creates them).
- **“Import script says getaddrinfo ENOTFOUND”** – Your machine can’t reach the DB host. Put **`DATABASE_URL`** in `.env` using the **Connection pooling** URI from Supabase (port 6543), not the direct DB host.
- **“Downloads empty or broken”** – Create the **documents** bucket, run **`002_storage_policies.sql`**, upload files, and add rows in the **documents** table with the correct **file_path**.
