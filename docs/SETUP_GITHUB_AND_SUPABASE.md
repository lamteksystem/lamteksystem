# GitHub and Supabase setup (Lamtek)

## Current status (why automation stops)

| Service | What works | What is blocked without your action |
|--------|------------|--------------------------------------|
| **GitHub** | `git` remote = `https://github.com/lamteksystem/lamteksystem`, branch `main`, initial commit locally | The machine is logged in as `Lamtekltd`, which has **read-only** on that repo. **Push** needs a user with `push` (owner or invited collaborator with write). |
| **Supabase (API)** | The app can talk to `https://jhmepthfxnpmwpjobumj.supabase.co` with your publishable key. | The database has **no `public.products` table yet** â€” run migrations (below). The Supabase **CLI** was unlinked from the old Lamtek project; linking or `db push` to Lamtek needs your **Lamtek Supabase account** or a **Postgres `DATABASE_URL`**. |

---

## 1) GitHub â€” one-time (pick one)

### A. Invite the current computerâ€™s Git user (quickest for this machine)

1. Sign in to GitHub as **lamteksystem** (or the org admin).
2. Open **https://github.com/lamteksystem/lamteksystem/settings/access** (Collaborators and teams).
3. **Add people** â†’ invite user **`Lamtekltd`** with **Write** role.
4. Accept the invite (from the Lamtekltd account).
5. In the project folder run:

   ```powershell
   cd C:\Users\info\Desktop\Lamtek
   git add -A
   git status
   git commit -m "chore: Supabase project config, setup docs"   # if you have new files
   git push -u origin main
   ```

### B. Use the lamteksystem account in GitHub CLI (no collaborator)

1. In PowerShell: `gh auth login` and complete the flow with the **lamteksystem** user (or a PAT for that user with `repo` scope).
2. `gh auth setup-git`
3. `git push -u origin main`

### C. One-off HTTPS push with a Personal Access Token

1. Create a **classic** PAT (lamteksystem) with `repo` scope: GitHub â†’ **Settings** â†’ **Developer settings** â†’ **PATs**.
2. Run (replace `TOKEN`):

   ```powershell
   cd C:\Users\info\Desktop\Lamtek
   git push https://lamteksystem:TOKEN@github.com/lamteksystem/lamteksystem.git main
   ```

   Do not commit the token. Prefer A or B for daily use.

---

## 2) Supabase â€” migrations on project `jhmepthfxnpmwpjobumj`

Your **Vite** app already uses (in `.env`):

- `VITE_SUPABASE_URL=https://jhmepthfxnpmwpjobumj.supabase.co`
- `VITE_SUPABASE_ANON_KEY=...` (publishable)

### Option A â€” CLI: login as Lamtek, then link and push (recommended for ongoing work)

1. `npx supabase login` (browser: sign in as the account that **owns** this project).
2. From the project root:

   ```powershell
   cd C:\Users\info\Desktop\Lamtek
   npx supabase link --project-ref jhmepthfxnpmwpjobumj
   npx supabase db push
   ```

The old link to the Lamtek project has been **unlinked** (`supabase unlink`).

### Option B â€” `DATABASE_URL` (no `supabase link`)

1. In the Supabase dashboard: **Project Settings** â†’ **Database** â†’ **Connection string** â†’ **URI** and replace `[YOUR-PASSWORD]` with the **database** password.
2. Add a line to `.env` (file stays **gitignored**):

   `DATABASE_URL=postgresql://...`

3. Run:

   ```powershell
   cd C:\Users\info\Desktop\Lamtek
   node --env-file=.env scripts/push-migrations.mjs
   ```

4. Re-check the app: tables such as `products` should exist after migration `001_schema` and the rest in `supabase/migrations/`.

If the password has special characters, you may need to **percent-encode** them in the URL for the CLI (Supabaseâ€™s copy button usually gives a working string).

### Option C â€” SQL Editor

Paste and run the migration files in order in **SQL Editor** (possible but tedious for 50+ files). Prefer A or B.

---

## 3) Vercel / host env

Set the same variables as in local `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or publishable)

Never put `SERVICE_ROLE` or `DATABASE_URL` in the frontend host â€” server/scripts only.

