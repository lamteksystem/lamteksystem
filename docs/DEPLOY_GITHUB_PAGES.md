# Deploy with GitHub Pages + Actions

The app is a static Vite build. This repo deploys with **GitHub Actions** to **GitHub Pages** (no Vercel required).

Workflow: `.github/workflows/deploy-github-pages.yml`

## One-time GitHub settings

1. **Enable Pages with Actions**  
   Repository → **Settings** → **Pages** → **Build and deployment** → **Source**: choose **GitHub Actions** (not “Deploy from a branch”).

2. **Build secrets**  
   Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

   - `VITE_SUPABASE_URL` — same as in local `.env`
   - `VITE_SUPABASE_ANON_KEY` — same as in local `.env` (publishable key is fine; it is already exposed to the browser after build)

   Without these, the build can succeed but the app will not talk to Supabase at runtime.

3. **Supabase auth URLs**  
   In Supabase → **Authentication** → **URL configuration**, add your GitHub Pages origin, for example:

   - `https://<owner>.github.io/<repo>/`

   Use the exact **https** URL you will ship (trailing slash behaviour can matter for redirects). Add patterns Supabase allows for magic links / OAuth if you use them.

## When it runs

- On every **push** to `main`
- Manually: **Actions** → **Deploy GitHub Pages** → **Run workflow**

## Keep demo in sync with local dev

After code or migration changes:

```bash
npm run ship -- "describe your change"
```

That runs `npm run build`, `npm run db:push:remote`, commits, and pushes to `main` (which triggers this workflow).  
**Demo:** https://lamteksystem.github.io/lamteksystem/

After a successful run, open **Settings → Pages** or the workflow run summary for the public URL.

## How paths work

- **Project** sites (`https://owner.github.io/repo-name/`) use Vite `base` = `/repo-name/`. The workflow sets `VITE_PAGES_BASE` automatically from the repository name.
- **User/org** site repo named `owner.github.io` is served at the domain root; the workflow sets `base` to `/`.

The build copies `index.html` to `404.html` so client-side routes work when users refresh or open deep links (GitHub Pages has no SPA rewrite rules like Vercel).

## Local check with a subpath base

PowerShell:

```powershell
$env:VITE_PAGES_BASE = "/your-repo-name/"
npm run build
npx vite preview
```

Then open the preview URL and confirm assets and navigation work.

## Optional: custom domain

Use **Settings → Pages → Custom domain** and follow GitHub’s DNS instructions. You will need a stable `VITE_PAGES_BASE` that matches how the app is served (often `/` on a custom apex or `www` host). For a custom domain at the root, set the repository workflow step or use a `username.github.io` repo so the workflow emits `VITE_PAGES_BASE=/`.
