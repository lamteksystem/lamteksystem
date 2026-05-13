/**
 * Normalize common UTF-8 mojibake (legacy Windows-1252 style) across src/.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')

const REPLACEMENTS = [
  ['\u00e2\u20ac\u201d', '\u2014'],
  ['\u00e2\u20ac\u00a6', '\u2026'],
  ["\u00e2\u20ac\u2122", "'"],
  ['\u00e2\u2020\u0090', '\u2190'],
  ['\u00e2\u2020\u2019', '\u2192'],
  ['\u00c2\u00b7', '\u00b7'],
]

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name)
    if (name.isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(name.name)) out.push(p)
  }
  return out
}

let filesChanged = 0
for (const file of walk(root)) {
  let s = fs.readFileSync(file, 'utf8')
  const orig = s
  for (const [bad, good] of REPLACEMENTS) {
    s = s.split(bad).join(good)
  }
  s = s.split('\u00c2\u00a3').join('\u00a3')
  if (s !== orig) {
    fs.writeFileSync(file, s, 'utf8')
    filesChanged++
    console.log('fixed', path.relative(path.join(root, '..'), file))
  }
}
console.log('done, filesChanged:', filesChanged)
