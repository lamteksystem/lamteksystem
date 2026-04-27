# Lamtek — GitHub, Supabase, and terminal in Cursor

This repo’s **Cursor / VS Code** settings run `scripts/activate-workspace-context.ps1` in **each new integrated terminal** (see `.vscode/settings.json`). The script:

1. **`gh auth switch -u lamteksystem`** — keeps the [GitHub CLI](https://cli.github.com) on the Lamtek account (run `gh auth login` once if you are not logged in).
2. **`$env:SUPABASE_ACCESS_TOKEN`** — optional: loads a [Supabase access token](https://supabase.com/dashboard/account/tokens) from the file path in `scripts/identity.config.json` (for CLI tools that need it).
3. **Prints a Chrome profile hint** for the Lamtek web UIs. Set `profileDirectory` from `chrome://version` in that profile. Optional: `. ./scripts/activate-workspace-context.ps1 -LaunchChrome`

## One-time setup (this machine)

### 1. GitHub CLI (Lamtek only)

```powershell
gh auth login
# complete for account that can push to https://github.com/lamteksystem/lamteksystem
gh auth status
```

If you use other GitHub accounts on this PC, a new terminal **in this folder** will run `gh auth switch` back to `lamteksystem` for you.

### 2. Supabase token file (optional, for CLI + script)

Create (plain text, one line = token from [Access tokens](https://supabase.com/dashboard/account/tokens) for the **Lamtek** project owner):

- `%USERPROFILE%\.config\lamtek\supabase-access-token`

Path is listed in `scripts/identity.config.json` → `supabaseTokenFile`. **Do not** commit that file (it lives under your user profile, not in the repo).

### 3. Link the Supabase project

**Option A** — same account as in the browser for `jhmepthfxnpmwpjobumj`:

```powershell
npx supabase link --project-ref jhmepthfxnpmwpjobumj
```

**Option B** — use a token file only (no `supabase login`):

```powershell
npm run supabase:link:token
```

(Requires the token file from step 2.)

### 4. Chrome

Edit `scripts/identity.config.json` → `chrome.profileDirectory` to match your **Lamtek** Chrome profile (see `chrome://version`).

## One Cursor window = this repo

Use **File → Open Folder** on this `Lamtek` project so `${workspaceFolder}` in the default terminal is correct (avoid multi-root workspaces for this app).

## Troubleshooting

- **`gh auth switch` fails** — `gh auth login` as `lamteksystem` (or the `ghUser` in `identity.config.json`).
- **Supabase “access denied”** — create the token while logged into Supabase as the user that owns project `jhmepthfxnpmwpjobumj`, or use `npm run supabase:link:token`.
- **Script does not run in new terminals** — check that the default profile is **Lamtek (gh + Supabase)** in this workspace (`.vscode/settings.json`).
