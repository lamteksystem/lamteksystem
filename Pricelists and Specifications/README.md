# Pricelists and specifications (source files)

Place supplier files here for catalogue build tooling. **These files are not deployed to GitHub Pages** — keep large PDFs local or in private storage; commit only when appropriate.

## Expected files

| File | Purpose |
|------|---------|
| `Lamtek Trade Kitchen Pricelist*.xlsx` | Lamtek components: carcasses, hinges, drawer boxes, trays, etc. |
| `Tealbury*.xlsx` | Tealbury **complete** sellable units (7 door ranges via Pricelist hub). |
| `uform/specs/*.pdf` | UFORM tech specs per door range (sizes, finishes, plinth, cornice, panels). |
| `uform/Uform*.pdf` | Optional full UFORM brochure for reference. |

## Seven Tealbury door ranges (UFORM)

- Oakham Soft Matte
- Oakham Gloss
- Dawson
- Knightsbridge Std
- Knightsbridge Prm
- Norwood
- Papplewick

## One-shot local rebuild (agent / developer)

Imports go to the **Pricelist workbench draft** only — not the live catalogue until you click **Publish** in Admin.

```bash
npm run catalogue:rebuild-workbench -- --yes
```

Or step by step: `catalogue:clear-products`, prune categories on **Categories** page, `catalogue:import-pricelists`, `catalogue:parse-uform-specs`, `catalogue:import-uform-specs`.

## Admin workflow

1. **Admin → Catalogue tools → Pricelist workbench**
2. Upload Lamtek + Tealbury Excel workbooks (visual review).
3. Run **Bootstrap Tealbury categories** (creates door-range categories if missing).
4. Run `npm run catalogue:parse-uform-specs` locally (reads PDFs in `uform/specs/`) → import the generated JSON in the workbench.
5. Assign categories / part types, **Publish** components and complete units (prices can stay at 0).
6. **Apply standard BOMs** on selected Tealbury complete rows to link carcass, doors, hinges, etc.

Add new range spec PDFs under `uform/specs/` when UFORM sends them; re-run the parse script and import the updated JSON.
