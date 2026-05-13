# Deploy a live URL (Vercel) for trade testers

The app is a static Vite build backed by Supabase. The usual way to get a **stable HTTPS link** (e.g. for Tom) is **Vercel** (this repo already has `vercel.json` SPA rewrites).

## Option A — Vercel dashboard (fastest)

1. Sign in at [vercel.com](https://vercel.com) with an account that can access the GitHub org/repo.
2. **Add New… → Project** → **Import** this repository (`lamteksystem/lamteksystem` or your fork).
3. Framework: **Vite** (or “Other” with **Build**: `npm run build`, **Output**: `dist`).
4. **Environment variables** (Production — required for the app to talk to Supabase):

   | Name | Value |
   |------|--------|
   | `VITE_SUPABASE_URL` | Same as in your local `.env` |
   | `VITE_SUPABASE_ANON_KEY` | Same as in your local `.env` (publishable / anon key) |

5. Click **Deploy**. When it finishes, Vercel shows the **production URL** (often `https://<project-name>.vercel.app`). That is the link to send Tom.

### Supabase Auth (so login works on the live domain)

In [Supabase Dashboard](https://supabase.com/dashboard/project/jhmepthfxnpmwpjobumj) → **Authentication** → **URL configuration**:

- Add your Vercel URL under **Site URL** (if this is the primary site) and/or **Redirect URLs** (e.g. `https://your-app.vercel.app/**` as needed for email magic links / OAuth).

## Option B — GitHub Actions (manual deploy from Actions tab)

If the Vercel project is already created and linked to the repo:

1. Vercel → **Project → Settings → General** — copy **Project ID**.
2. Vercel → **Account / Team settings** — copy **Team / User ID** (used as org id).
3. Vercel → **Account → Tokens** — create a token with deploy scope.
4. GitHub → **Repository → Settings → Secrets and variables → Actions** — add:

   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

5. Run **Actions → Deploy Vercel → Run workflow**. (Optional: edit `.github/workflows/deploy-vercel.yml` to add `on.push.branches: [main]` for deploy-on-merge.)

Workflow file: `.github/workflows/deploy-vercel.yml`.

## Local CLI (alternative)

From the repo root, after `npx vercel login` and `npx vercel link`:

```bash
npm run deploy:vercel
```

(Ensure Production env vars are set in the Vercel project first.)

## Notes

- **Do not** put `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` in Vercel env for the frontend build; they are server-only.
- If the Supabase project was **paused**, resume it in the dashboard or the live app will not load data.
- Default **local** dev port is **5175** (see `vite.config.ts`); production uses whatever domain Vercel assigns.
