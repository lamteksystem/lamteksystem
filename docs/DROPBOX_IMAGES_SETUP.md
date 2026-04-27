# Product images from your Dropbox folder

Your images are here:  
**[Open Dropbox folder](https://www.dropbox.com/scl/fo/j4oghznkllzyqs9reojvh/h?rlkey=xjpxolai0lkd1pc53gk9n0keo&e=1&dl=0)**

The zip **product-images-download.zip** is already in your project (downloaded from that link). If it’s still locked, close the browser/download manager, then:

---

## Option A: Extract the zip, then run (recommended)

1. **Extract the zip**
   - In File Explorer go to `c:\Users\info\Desktop\TradeMouldings`.
   - Right‑click **product-images-download.zip** → **Extract All**.
   - Choose destination **product-images-from-zip** (or **product-images**) and extract.

2. **Run the assign script** (from the project folder in a terminal):
   ```bash
   npm run assign-images -- "product-images-from-zip"
   ```
   If you extracted into **product-images** instead:
   ```bash
   npm run assign-images -- "product-images"
   ```

---

## Option B: Download again and extract

1. Open the [Dropbox folder link](https://www.dropbox.com/scl/fo/j4oghznkllzyqs9reojvh/h?rlkey=xjpxolai0lkd1pc53gk9n0keo&e=1&dl=0), click **Download**.
2. Extract the downloaded zip to `c:\Users\info\Desktop\TradeMouldings\product-images` (or any folder).
3. Run:
   ```bash
   npm run assign-images -- "product-images"
   ```

## Optional: dry run first

To see which file would match which product **without** uploading:

```bash
DRY_RUN=1 npm run assign-images -- "product-images"
```

## If you prefer a different folder

If you extract the zip to e.g. `C:\Downloads\product-images`, run:

```bash
npm run assign-images -- "C:\Downloads\product-images"
```
