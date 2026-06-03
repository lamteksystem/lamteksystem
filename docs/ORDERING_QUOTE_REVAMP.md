# Ordering & quoting revamp (plan)

The pricelist workbench now models products, finishes, ranges, and BOMs well. Customer and staff ordering must catch up: **one kitchen context** (range + finish + line style) should surface **units and matching accessories** without manual hunting.

## Principles

- **Kitchen context first** — Setup wizard choices drive what appears in search (not the other way around).
- **Sold-as vs shown** — Panels/posts/cornice are **accessories** in data; they still appear when quoting a Dawson kitchen.
- **Heavy lifting in code** — Fuzzy finish/range matching, category-aware filters, correct prices from finish matrices.
- **Simple surface** — Few clear steps: setup → browse by intent (units / accessories / all) → add lines → review.

## Phase 1 — Contextual catalogue (in progress)

- [x] Fix Tealbury `item_kind` inference (accessories/panels not `complete`).
- [x] Smarter finish matching (`Dawson — DWSN` ↔ kitchen range).
- [x] Accessory/trim products match by **door range** on the row, not only exact finish keys.
- [x] Default product browse to **All** for this kitchen (not units-only).
- [x] Quick chips: **All · Units · Accessories & trim**.
- [x] Re-run workbench metadata on draft (panels → accessory).
- [ ] Publish draft when ready so live catalogue picks up changes.

## Phase 2 — Unified quote builder UX

- [x] Single **“Build quote”** shell for customer + staff (shared `CatalogProductWorkbench`).
- [x] Sticky **kitchen summary bar** (range, finish, carcass, hinges) with edit setup.
- [x] **Suggested sections** row: Base units · Wall units · Panels · Plinth · Cornice · Posts · Handles (counts).
- [x] Empty states that explain *why* nothing shows (e.g. publish catalogue, finish mismatch).

## Phase 3 — Staff/admin parity

- Admin quote/order build same wizard + workbench (already shared components; polish layout).
- Customer picker on quote: same flow as `AdminOrderBuildPage`.
- Order detail: inline add-from-catalogue with kitchen context preserved.

## Phase 4 — Intelligence (later)

- “Add typical extras for this range” checklist from order templates.
- Optional BOM expand when adding a complete unit (already partially implemented).
- Cross-sell hints (plinth length, panel sizes) from unit dimensions.

## Data conventions (reminder)

| Field | Meaning |
|-------|---------|
| `door_range` / `tealbury_door_range` | Tealbury sheet family (Dawson, Oakham, …) |
| `tealbury_finish_prices_gbp` | Price keys from that sheet (often `Range — CODE`) |
| Category **Panels** | Where panels live in navigation |
| `item_kind` **accessory** | Sold-as; does not mean “hidden from kitchen quotes” |
