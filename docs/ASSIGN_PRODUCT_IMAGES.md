# Assigning product images from a folder (e.g. Dropbox)

Use the script to match image files in a local folder to products in the catalogue, then upload them to Supabase and set each productâ€™s image.

## 1. Put your images in a folder

- **Dropbox:** Sync your Dropbox so the images are on disk (e.g. `C:\Users\You\Dropbox\Lamtek\product-images`).
- Or copy all product images into any folder (e.g. `./product-photos`).

## 2. Name files so they can be matched

The script matches by **filename** (without extension). Best results when filenames reflect:

- **SKU** â€“ e.g. `L-1234.jpg` or `Boston_L-1234.jpg` â†’ matches product with that SKU.
- **Product name** â€“ e.g. `Door 715 x 395mm.jpg` or `Door_715x395.jpg` â†’ matches product with that name.
- **Range/category** â€“ e.g. `Boston_715x395.jpg` â†’ matches a product in category â€œBostonâ€ with â€œ715â€/â€œ395â€ in the name.

You can use spaces, underscores, or hyphens; the script normalizes them.

## 3. Run the script

From the project root, with `.env` containing `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`:

```bash
# Use your Dropbox folder (or any folder path)
npm run assign-images -- "C:\Users\You\Dropbox\Lamtek\product-images"

# Or a folder inside the project
npm run assign-images -- "./product-photos"
```

**Dry run (see matches only, no uploads):**

```bash
DRY_RUN=1 npm run assign-images -- "C:\path\to\images"
```

## 4. Matching order

For each image file the script:

1. Tries **exact SKU** â€“ filename (no extension) equals product SKU (case-insensitive).
2. Tries **SKU in filename** â€“ product SKU appears in the filename.
3. Tries **product name** â€“ product name (normalized) contained in filename or the other way around.
4. Tries **category/range** â€“ category name (e.g. Boston, Balmoral) in filename plus word overlap with product name.
5. **Parent folder hint** â€“ if the image lives in a folder like `Accessories Handles` or `Emuca Wine Racks`, products in matching categories (Handles, Wine Racks, etc.) get a score boost so filenames that are vague (e.g. a code) can still match the right category.
6. Falls back to **word overlap**, **compound codes** (e.g. `FF13420BL_FF13460BL` â†’ try each part), and **relaxed thresholds** over several passes.

The **best scoring** product above the threshold gets the image. Each product is only assigned once per run (one image per product; if multiple files match the same product, the last one processed wins with `upsert: true`).

## 5. Result

- Images are uploaded to the **product-images** storage bucket.
- Each matched productâ€™s **image_url** and **image_alt** are updated in the database.
- The script prints a short report: which file was assigned to which product, and which files were skipped (no match or error).

## 6. Supported image types

`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`. The script scans the given folder recursively.

