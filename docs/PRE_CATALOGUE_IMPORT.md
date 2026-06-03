# Before you publish — workbench checklist & speed-ups

Use this with the pricelist workbench. Goal: **correct data in draft**, then one **Publish** to the live catalogue.

## Recommended order (repeatable)

1. **Import** Lamtek + Tealbury (+ UFORM JSON when ready).
2. **Title Case all names** (section 0) — or `npm run catalogue:workbench-setup` (includes Title Case + infer + BOM).
3. **Infer part types on all rows** — panels → accessory, units → complete.
4. **Smart categorise / bulk rules** — assign Panels, Plinth, Carcasses, door-range categories.
5. **Compute BOM for all completes** — preview make-up; fix missing UFORM/Lamtek gaps.
6. **Spot-check** one Dawson base unit + one plain end panel (modal: category, sold-as, finish matrix).
7. **Publish** (section 3) — only when satisfied.

## Already in the product

| Tool | What it fixes |
|------|----------------|
| Title Case (button + import/publish) | Readable names: `Plain End Panel (Dawson)` |
| Infer part types | Sold-as: accessory vs complete |
| Auto-map / smart categorise | Category assignments |
| Draft BOM | “What’s included” before live assemblies |
| Finish matrix on row | One SKU per size/range, not per paint colour |
| Import section vs category | Section = spreadsheet heading only |

## High-value improvements (next builds)

1. ~~**Pre-publish validation report**~~ — **Done:** Admin workbench → **Pre-publish validation** (readiness %, issues, BOM gap groups).
2. ~~**Bulk “assign Panels category”** rule~~ — **Done:** **Bulk assign Panels** in section 0.
3. **Door-range category auto-link** — When `door_range` = Dawson, auto-assign Dawson door-range category (already partially there; strengthen on import).
4. ~~**Clone UFORM sizes across door ranges**~~ — **Done:** Smart controls → *Clone UFORM door sizes to missing ranges* (same 715×497 leaves as Dawson; range name/SKU only). Also runs in `npm run catalogue:workbench-setup`.
5. **Merge duplicate trade codes** — Optional mode: one SKU per `trade_code` with merged `tealbury_finish_prices_gbp` across sheets (fewer rows, closer to “one product, many finishes”).
6. **UFORM coverage report** — List Tealbury completes whose BOM failed for missing door size (e.g. 715×397 for 400 HL).
7. ~~**Workbench “readiness %”**~~ — **Done:** shown in draft stats + validation modal.
8. **Sample publish** — Publish only Dawson + 10 units + panels to a staging flag for quote testing without full catalogue.

## Ordering / quoting (Phase 2 shipped)

- Sticky **kitchen context bar** (range, finish, carcass, hinges).
- **Section shortcuts** with counts: Base units, Wall units, Panels, Plinth, etc.
- **All / Units / Accessories & trim** filters default to **All** for the kitchen.
- Clear **empty states** when catalogue unpublished or filters too tight.

## What “Dawson White” means in practice

There is usually **no** separate “White” SKU under Dawson. The customer picks **range + finish** at order setup (e.g. Dawson — DWSN). Panels and units for that sheet share the **Dawson** range; price comes from the finish matrix on each row.
