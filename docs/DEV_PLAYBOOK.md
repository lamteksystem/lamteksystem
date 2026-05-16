# Developer playbook — Lamtek portal toolchain

Keep **local dev**, **GitHub `main`**, **GitHub Pages demo**, and **remote Supabase** aligned.

## URLs

| Environment | URL |
|-------------|-----|
| Local dev (Vite + HMR) | http://localhost:5173/ |
| GitHub Pages demo | https://lamteksystem.github.io/lamteksystem/ |
| Repository | https://github.com/lamteksystem/lamteksystem |

## Daily commands

| Task | Command |
|------|---------|
| Install deps | `npm ci` |
| Dev server (HMR on **5173**) | `npm run dev` |
| Lint | `npm run lint` |
| Lint autofix | `npm run lint:fix` |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm run test` |
| Production build | `npm run build` |
| E2E (starts dev server) | `npm run test:e2e` |
| Full validate (lint + types + test + build) | `npm run validate` |
| Remote DB migrations | `npm run db:push:remote` |
| **Ship everything** | `npm run ship -- "your commit message"` |

## Git hooks (Husky)

| Hook | Runs |
|------|------|
| **pre-commit** | `lint-staged` — ESLint fix on staged `.ts` / `.tsx` |
| **pre-push** | `npm run validate` |

Bypass only when intentional: `git commit --no-verify` / `git push --no-verify`.

## HMR (hot reload)

- Vite **React Fast Refresh** via `@vitejs/plugin-react`.
- Dev port **5173** (`vite.config.ts`; override with `VITE_DEV_PORT`).
- `server.hmr.overlay` shows compile errors in the browser.

Restart dev if hooks/env change: stop terminal, `npm run dev` again.

## CI (GitHub Actions)

Workflow **CI** on every PR and push to `main`:

1. **lint** — ESLint + TypeScript
2. **test** — Vitest + production build
3. **e2e** — Playwright smoke tests on port **5173**

Workflow **Deploy GitHub Pages** on push to `main` — live demo.

## Node version

- **`.nvmrc`**: `22`
- **`package.json` engines**: `>=20`
- CI uses **Node 22**

## After you change code

```bash
npm run ship -- "feat: short description"
```

Runs validate → remote migrations → commit → push → Pages deploy.

See also: `docs/DEPLOY_GITHUB_PAGES.md`, `.cursor/rules/ship-github-pages.mdc`.
