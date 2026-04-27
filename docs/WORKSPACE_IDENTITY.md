# Per-repo identity (Lamtek vs Trade Mouldings on one machine)

This repo configures **Cursor / VS Code** to run `scripts/activate-workspace-context.ps1` in **every new integrated terminal**. That script:

1. **`gh auth switch -u <user>`** — switches the [GitHub CLI](https://cli.github.com) to the GitHub user for *this* repo (you must have logged in to both accounts once: `gh auth login` each).
2. **`$env:SUPABASE_ACCESS_TOKEN`** — reads a one-line [Supabase access token](https://supabase.com/dashboard/account/tokens) from a file under your user profile (path in `scripts/identity.config.json`).
3. **Reminds** which **Chrome user-data profile** to use for web UIs. Chrome does not let apps pick a profile for you automatically; the script can open tabs with the right profile if you set `profileDirectory` and run the script with `-LaunchChrome` (or call it manually).

`Cursor` is not Chrome: **each “identity” in Chrome = a Chrome profile**; **each repo** here = automatic terminal + config. Use the Chrome profile that matches the work you’re doing.

## One-time machine setup

### 1. Two GitHub CLI logins (same Windows user)

```powershell
gh auth login
# complete for lamteksystem (or your first account)
gh auth login
# add trademouldingsltd (or your second) — `gh` supports multiple accounts
gh auth status
```

List accounts and switch: `gh auth switch -u USERNAME`.

### 2. Supabase: two access token files (recommended)

In the [Supabase account tokens](https://supabase.com/dashboard/account/tokens) page, create a token while logged in as the **Lamtek** org/user, copy it, and save (plain text, one line):

- `%USERPROFILE%\.config\lamtek\supabase-access-token`

Do the same for the **Trade Mouldings** Supabase login:

- `%USERPROFILE%\.config\trademouldings\supabase-access-token`

Create folders if needed. **Do not** commit these files (they are outside the repo in your home directory).

`identity.config.json` in each repo already points at the matching path (edit if you move them).

### 3. Chrome: find profile directory names

1. Open the Chrome profile you want (e.g. “Lamtek work”).
2. Open `chrome://version` and note **Profile path** — the last segment is what we need, e.g. `Profile 3` or `Default`.
3. Edit this repo’s `scripts/identity.config.json` — set `chrome.profileDirectory` and a helpful `profileName` string.
4. Repeat in the **Trade Mouldings** repo for its Chrome profile and URLs.

**Optional:** from a terminal in this folder after the script is loaded:

```powershell
. ./scripts/activate-workspace-context.ps1 -LaunchChrome
```

(Uses the paths in `identity.config.json`.)

### 4. `npx supabase link` in each project root

**If the Supabase CLI is logged in as the same account that owns the project:** with the right token in the environment (new terminal in this repo), run:

```powershell
npx supabase link --project-ref jhmepthfxnpmwpjobumj
```

**If the CLI was tied to a different org** (e.g. only the Trade Mouldings org appears in `npx supabase projects list`):

1. Log out: `npx supabase logout` (confirm with `y`), then `npx supabase login` with the **Lamtek** account, **or**
2. Create `%USERPROFILE%\.config\lamtek\supabase-access-token` (one line = [access token](https://supabase.com/dashboard/account/tokens) from the **Lamtek** account), then from the repo root run:

   ```powershell
   npm run supabase:link:token
   ```

Trade Mouldings (other repo) should link to its own project ref when you use that workspace’s terminal (different token if different account).

## Open one repo per Cursor window

Use **File → Open Folder** on `Lamtek` *or* `TradeMouldings` — not both in one **multi-root** workspace, or `${workspaceFolder}` in the default terminal profile can point at the wrong root.

## Why this works

- **Isolated by folder:** `gh auth switch` is global, but the **new terminal in Lamtek** runs the Lamtek script every time, switching back to `lamteksystem` if you had switched away.
- **Trade Mouldings repo** has its own script and config so its terminals always switch to `trademouldingsltd` and load the other token.
- **Chrome** does not read Cursor’s folder. Use the **Chrome user profile** that matches the client (Lamtek vs Trade Mouldings), or use `-LaunchChrome` after you set `profileDirectory` in `identity.config.json`.

## Troubleshooting

- **`gh auth switch` fails** — run `gh auth login` for that `ghUser` once.
- **Supabase “access denied”** — wrong token for that org; create token while logged in as the correct Supabase user.
- **Terminal not running the script** — in Cursor, ensure **default profile** for this workspace is the named profile (File → Preferences → or check `.vscode/settings.json` in this folder).
