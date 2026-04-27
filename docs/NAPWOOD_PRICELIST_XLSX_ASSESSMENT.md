# Napwood Construction Price List – Excel assessment

Assessment of **Napwood Construction Price List From Trade Mouldings.xlsx** (multi-sheet workbook) and how to import it into the Trade Mouldings system.

---

## Workbook structure (21 sheets)

| # | Sheet name    | Rows  | Cols | Purpose |
|---|---------------|-------|------|--------|
| 1 | **--ListPicker--** | 145  | 7  | Discount list picker / config (list names, Carcase Discount %). Not product data. |
| 2 | **010626**        | 7,606 | 5  | **Master product list**: Code, Name, Product Group Desc., Standard Price, date column (01-06-25). **Primary source for import.** |
| 3 | **DiscountLists** | 60,502 | 5 | B2B discount matrix: Formula, Customer Discount Group, Product Group, Discount %. For customer-specific pricing later. |
| 4 | **sellPrice**     | 15,810 | 3 | Code, Sales Price, list+5. Alternate prices by code; can override or supplement 010626. |
| 5 | **BOST**          | 116  | 12 | Boston – vinyl wrapped super matt shaker. REF, description, TM CODE, PRICE, DISCOUNT, NETT. |
| 6 | **BER**           | 116  | 13 | Berkeley – same structure, two TM CODE columns. |
| 7 | **BAL**           | 322  | 14 | Balmoral – five piece ash vinyl shaker. |
| 8 | **BUC**           | 328  | 14 | Buckingham. |
| 9 | **RIV**           | 93   | 14 | Rivington. |
| 10 | **LAR_G**         | 99   | 14 | Larissa Gloss. |
| 11 | **LAR_M**         | 106  | 14 | Larissa Matt. |
| 12 | **VOG_W**         | 103  | 14 | Vogue White Gloss. |
| 13 | **VOG_O**         | 103  | 14 | Vogue Other Colours. |
| 14 | **FENT**          | 90   | 13 | Fenton Matt. |
| 15 | **FENT_K**        | 87   | 13 | Fenton Kala Ash. |
| 16 | **FENT_O**        | 90   | 13 | Fenton Oak Veneer. |
| 17 | **ALB_S**         | 112  | 11 | Albany Painted Timber. |
| 18 | **AHM_PRM**       | 117  | 14 | Albany/Hadfield/Malham Primed. |
| 19 | **AHM_PTO**       | 116  | 12 | Albany/Hadfield/Malham PTO. |
| 20 | **CARC**          | 245  | 9  | Carcases – TM CODE, DESCRIPTION, SALES PRICE, DISCOUNT, NETT; grouped by colour. |
| 21 | **ACCS**          | 518  | 8  | Accessories – TM CODE, DESCRIPTION, SALES PRICE; grouped by brand (e.g. EMUCA). |

---

## Sheet details

### 010626 (master product list) – **use for import**

- **Row 1:** `Code` | `Name` | `Product Group Desc.` | `Standard Price` | `01-06-25`
- **Data:** One row per product. Code = TM/SKU, Name = full description, Product Group Desc. = category (e.g. "H ACCESSORIES BUCKINGHAM NAVY BLUE ASH"), Standard Price = numeric, 01-06-25 = likely price inc VAT or effective date.
- **Use:** Build categories from "Product Group Desc." (normalise to slug); create/update products with sku=Code, name=Name, unit_price=Standard Price (or 01-06-25 if that column is the price).

### Range sheets (BOST, BAL, BUC, … CARC, ACCS)

- Header row has product description (range name), then columns: KEY/REF, REF, description, **TM CODE**, PRICE, DISCOUNT, NETT, QTY, TOTAL, discount categories.
- Same REF can appear in multiple ranges with different TM CODE (e.g. Berkeley sheet has two TM CODE columns).
- **Use:** Optional second pass to enrich products (e.g. map TM CODE to product, update name/description) or to create range-specific categories (e.g. "Doors – Boston"). For a first import, **010626 alone is enough** to get a full catalogue.

### DiscountLists

- Customer discount group × product group → discount %. Not needed for base catalogue; can support B2B pricing later.

### sellPrice

- Code → Sales Price, list+5. Can be used to override unit_price by SKU if desired (e.g. "list+5" as customer price).

### --ListPicker--

- Config only; skip for import.

---

## Import strategy

### Recommended: single-source from 010626

1. **Categories**
   - Read sheet **010626**.
   - Collect unique values of "Product Group Desc." (column index 2).
   - For each: `slug = slugify(Product Group Desc.)`, `name = Product Group Desc.` (or shortened).
   - Insert into `categories` with `ON CONFLICT (slug) DO UPDATE` (or skip if exists).

2. **Products**
   - For each data row (skip header): Code (0), Name (1), Product Group Desc. (2), Standard Price (3), optional 01-06-25 (4).
   - Resolve category_id from Product Group Desc. (slug → category id).
   - Upsert product: match by `sku = Code`; if exists update name, description, unit_price, category_id; else insert.
   - Use **Standard Price** as `unit_price` (assume ex VAT; adjust if spreadsheet is inc VAT).
   - Truncate name/description to DB limits if needed.

3. **Optional: sellPrice override**
   - After 010626 import, read **sellPrice** and update `products.unit_price` where `products.sku = Code` and Sales Price &gt; 0 (or use list+5 column).

4. **Optional: range sheets**
   - For CARC and ACCS, or for BOST/BAL/…, parse TM CODE + description + price and either:
     - Match by TM CODE and update product name/price, or
     - Create additional categories (e.g. "Carcases", "Accessories") and insert products that don’t already exist in 010626.

### What we implement

- **Phase 1:** Import from **010626** only: create categories from Product Group Desc., upsert products by Code (sku). Script: `scripts/import-napwood-pricelist-xlsx.js`.
- **Phase 2 (optional):** Use **sellPrice** to set or override prices by code.
- **Phase 3 (optional):** Parse **CARC** and **ACCS** (and optionally range sheets) to add/update products that might be missing from 010626 or to set range-specific metadata.

---

## Pricing (Napwood = your customer prices)

The prices in the Napwood spreadsheet are **your** prices as a Trade Mouldings customer (i.e. customer/sell prices in the app).

- **`unit_price`** = spreadsheet price (customer-facing sell price).
- **`cost_price`** = for this test environment only, set to **25% off** the spreadsheet price (i.e. `unit_price × 0.75`). Real Trade Mouldings cost prices are not in the file; replace with actual cost data in production.

## Column mapping (010626)

| Spreadsheet column   | Index | DB / usage |
|----------------------|-------|------------|
| Code                 | 0     | `products.sku` (unique match for upsert) |
| Name                 | 1     | `products.name`, optionally `products.description` |
| Product Group Desc.  | 2     | Derive `categories.name` / `slug`, then `products.category_id` |
| Standard Price       | 3     | `products.unit_price` (customer price) |
| 01-06-25             | 4     | Use as alternative price if numeric and Standard Price empty; else ignore or treat as date. |

---

## Running the import

- **Dry run (no DB writes):**
  ```bash
  DRY_RUN=1 node scripts/import-napwood-pricelist-xlsx.js "C:\path\to\Napwood Construction Price List From Trade Mouldings.xlsx"
  ```
- **Live import (requires DATABASE_URL in .env):**
  ```bash
  node --env-file=.env scripts/import-napwood-pricelist-xlsx.js "C:\path\to\Napwood Construction Price List From Trade Mouldings.xlsx"
  ```
- Add to `package.json`:
  ```json
  "import-napwood-xlsx": "node --env-file=.env scripts/import-napwood-pricelist-xlsx.js"
  ```
