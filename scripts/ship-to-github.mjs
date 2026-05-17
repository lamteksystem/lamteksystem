/**
 * Apply remote migrations, commit, and push to main (GitHub Pages deploy).
 *
 * Usage:
 *   npm run ship -- "feat: describe your change"
 *   node scripts/ship-to-github.mjs "fix: something"
 *
 * Skips commit if working tree is clean after db push.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const message = process.argv.slice(2).join(' ').trim()
if (!message) {
  console.error('Usage: npm run ship -- "commit message"')
  process.exit(1)
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    ...opts,
  })
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1)
}

console.log('→ Lint & typecheck…')
run('npm', ['run', 'lint'])
run('npm', ['run', 'typecheck'])

console.log('→ Unit tests…')
run('npm', ['run', 'test'])

console.log('→ Building…')
run('npm', ['run', 'build'])

console.log('→ Pushing Supabase migrations to remote…')
run('npm', ['run', 'db:push:remote'])

const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })
const dirty = (status.stdout ?? '').trim()
if (!dirty) {
  console.log('→ No file changes to commit. Remote DB and git are up to date.')
  console.log('→ Demo: https://lamteksystem.github.io/lamteksystem/')
  process.exit(0)
}

console.log('→ Committing…')
run('git', ['add', '-A'])
// Quote message for Windows shells (semicolons/spaces break unquoted -m args).
run('git', [`commit -m "${message.replace(/"/g, '\\"')}"`])

console.log('→ Pushing to origin main (GitHub Pages will deploy)…')
run('git', ['push', 'origin', 'main'])

console.log('→ Done. Pages deploy: Actions → Deploy GitHub Pages')
console.log('   Demo: https://lamteksystem.github.io/lamteksystem/')
