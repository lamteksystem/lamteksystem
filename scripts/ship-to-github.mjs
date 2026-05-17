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

function run(cmd, args, { shell = false } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell,
  })
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1)
}

function runGit(args) {
  run('git', args, { shell: false })
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
/** npm.cmd requires shell on Windows (spawnSync EINVAL otherwise). */
const npmOpts = process.platform === 'win32' ? { shell: true } : {}

function runNpm(args) {
  run(npmCmd, args, npmOpts)
}

console.log('→ Lint & typecheck…')
runNpm(['run', 'lint'])
runNpm(['run', 'typecheck'])

console.log('→ Unit tests…')
runNpm(['run', 'test'])

console.log('→ Building…')
runNpm(['run', 'build'])

console.log('→ Pushing Supabase migrations to remote…')
runNpm(['run', 'db:push:remote'])

const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })
const dirty = (status.stdout ?? '').trim()
if (!dirty) {
  console.log('→ No file changes to commit. Remote DB and git are up to date.')
  console.log('→ Demo: https://lamteksystem.github.io/lamteksystem/')
  process.exit(0)
}

console.log('→ Committing…')
runGit(['add', '-A'])
runGit(['commit', '-m', message])

console.log('→ Pushing to origin main (GitHub Pages will deploy)…')
runGit(['push', 'origin', 'main'])

console.log('→ Done. Pages deploy: Actions → Deploy GitHub Pages')
console.log('   Demo: https://lamteksystem.github.io/lamteksystem/')
