/**
 * Assign product images from a local folder (e.g. Dropbox) to products in the catalogue.
 * Matches images to products by SKU, name, description, category, numbers, keywords, then uploads
 * to Supabase storage and sets product.image_url.
 *
 * Usage:
 *   npm run assign-images -- "C:\path\to\images"
 *   DRY_RUN=1 npm run assign-images -- "."
 *
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, extname, basename, resolve, dirname } from 'path'
import { createClient } from '@supabase/supabase-js'

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const BUCKET = 'product-images'

/** Words to strip from filename when matching (reduces noise) */
const STRIP_SUFFIXES = /\s*(image\s*\d*|tech\s*\d*|front|side|back|view|photo|img|pic|\d+)\s*$/gi

/** Product/finish keywords that often appear in both filename and product name */
const KEYWORDS = new Set([
  'handle', 'handles', 'knob', 'knobs', 'strap', 'pull', 'bar', 'd handle', 'trim',
  'chrome', 'black', 'nickel', 'brass', 'brushed', 'matt', 'matte', 'satin', 'antique', 'copper', 'pewter', 'gold',
  'mm', '160mm', '320mm', '200mm', '100mm', '96mm', '64mm', '38mm', '32mm', '60mm', '50mm',
  'anthracite', 'champagne', 'grey', 'gray', 'white', 'ivory', 'oak', 'vinyl', 'profile', 'cornice', 'plinth',
  'canopy', 'drawer', 'draw', 'gola', 'vertex', 'emuca', 'gallery', 'rail', 'bracket', 'hinge', 'cap', 'radius',
  'classic', 'contemporary', 'bullnose', 'pilaster', 'glass', 'central', 'horizontal', 'vertical', 'lateral',
])

function normalizeForMatch(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .toLowerCase()
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(str) {
  return normalizeForMatch(str).split(/\s+/).filter(Boolean)
}

/** Clean filename for matching: remove extension and common suffixes */
function filenameToSearchBase(filenameBase) {
  let base = filenameBase.replace(/\.[^.]+$/, '').trim()
  base = base.replace(STRIP_SUFFIXES, '').trim()
  return base || filenameBase.replace(/\.[^.]+$/, '')
}

/** Extract possible SKU/codes from filename: alphanumeric chunks, dimension patterns */
function extractPossibleSkus(filenameBase) {
  const raw = filenameBase.replace(/\.[^.]+$/, '')
  const tokens = raw.split(/[-_\s]+/)
  const skus = []
  for (const t of tokens) {
    const cleaned = t.replace(/[^a-zA-Z0-9]/g, '')
    if (cleaned.length >= 2 && cleaned.length <= 50) skus.push(cleaned)
    if (/^[A-Za-z]+-\d+/.test(t) || /\d+x\d+/.test(t)) skus.push(t)
  }
  // Also catch codes like FF47760BN, 890062, IP4B150
  const codeLike = raw.match(/\b[A-Z0-9]{4,20}\b/gi) || []
  codeLike.forEach((c) => skus.push(c.replace(/[^a-zA-Z0-9]/g, '')))
  return [...new Set(skus)]
}

/** Extract a leading or standalone number from filename (e.g. "141.jpeg" -> 141, "170 hinge a" -> 170) */
function extractLeadingNumbers(filenameBase) {
  const base = filenameBase.replace(/\.[^.]+$/, '')
  const leading = base.match(/^(\d+)(?:\s|_|-|$)/)
  if (leading) return [parseInt(leading[1], 10)]
  const all = (base.match(/\b\d{2,5}\b/g) || []).map(Number).filter((n) => n > 0)
  return all
}

/** Keywords present in str (normalized) */
function extractKeywords(str) {
  const norm = normalizeForMatch(str)
  const found = []
  for (const kw of KEYWORDS) {
    if (norm.includes(kw)) found.push(kw)
  }
  return found
}

function productToSearchRow(p, categoryName, categorySlug) {
  const nameNorm = normalizeForMatch(p.name)
  const skuNorm = (p.sku || '').toLowerCase().replace(/\s+/g, '')
  const catNorm = normalizeForMatch(categoryName || '')
  const descNorm = normalizeForMatch(p.description || '')
  return {
    id: p.id,
    name: p.name,
    nameNorm,
    nameTokens: tokenize(p.name),
    sku: (p.sku || '').trim(),
    skuNorm: skuNorm || null,
    categoryName: categoryName || '',
    categoryNorm: catNorm,
    categorySlug: (categorySlug || '').toLowerCase(),
    categoryTokens: tokenize(categoryName || ''),
    descriptionNorm: descNorm,
    descriptionTokens: tokenize(p.description || ''),
    nameNumbers: extractNumbers(p.name),
    nameKeywords: extractKeywords(p.name + ' ' + (p.description || '')),
  }
}

/** Extract numbers from string */
function extractNumbers(str) {
  const matches = (str || '').replace(/\s/g, '').match(/\d+/g)
  return (matches || []).map(Number).filter((n) => n > 0)
}

/** Longest substring of base (min len) that appears in target */
function longestSubstringIn(baseNorm, targetNorm, minLen = 4) {
  let best = 0
  for (let len = Math.min(baseNorm.length, targetNorm.length); len >= minLen; len--) {
    for (let i = 0; i <= baseNorm.length - len; i++) {
      const sub = baseNorm.slice(i, i + len)
      if (targetNorm.includes(sub)) return len
    }
  }
  return 0
}

/** Score 0..1 for filename vs product search row. Uses many strategies. options.folderHint = { folderNorm, folderTokens } from parent dir name. */
function scoreMatch(filenameBase, search, options = {}) {
  const baseNorm = normalizeForMatch(filenameBase)
  const baseTokens = tokenize(filenameBase)
  const possibleSkus = extractPossibleSkus(filenameBase)
  const baseNumbers = extractNumbers(filenameBase)
  const nameNumbers = search.nameNumbers || extractNumbers(search.name)
  const baseKeywords = extractKeywords(filenameBase)
  const leadingNums = extractLeadingNumbers(filenameBase)
  const folderHint = options.folderHint || null

  let score = 0

  // 0) Parent folder name matches category – boost products in that category (e.g. "Accessories Handles" -> Handles)
  if (folderHint && folderHint.folderNorm && folderHint.folderTokens && folderHint.folderTokens.length > 0) {
    const catNorm = (search.categoryNorm || '').toLowerCase()
    const catSlug = (search.categorySlug || '').toLowerCase()
    const folderNorm = folderHint.folderNorm
    if (catNorm && folderNorm.includes(catNorm)) score = Math.max(score, 0.35)
    if (catSlug && folderNorm.includes(catSlug)) score = Math.max(score, 0.38)
    const tokenOverlap = folderHint.folderTokens.filter((t) => t.length > 1 && (catNorm.includes(t) || catSlug.includes(t) || (search.nameNorm && search.nameNorm.includes(t)))).length
    if (tokenOverlap > 0) score = Math.max(score, 0.32 + 0.1 * tokenOverlap)
  }

  // 1) Exact SKU match
  if (search.skuNorm && baseNorm.replace(/\s/g, '') === search.skuNorm) return Math.max(score, 1.0)
  if (search.skuNorm && baseNorm.includes(search.skuNorm)) score = Math.max(score, 0.95)

  // 2) Extracted code equals product SKU (normalized)
  const productSkuClean = (search.sku || '').toLowerCase().replace(/\s+/g, '')
  if (productSkuClean && possibleSkus.some((s) => s.toLowerCase().replace(/\s/g, '') === productSkuClean)) score = Math.max(score, 0.93)

  // 3) Product SKU contained in filename or filename code contained in product SKU (partial)
  if (productSkuClean && productSkuClean.length >= 4) {
    if (baseNorm.replace(/\s/g, '').includes(productSkuClean)) score = Math.max(score, 0.9)
    for (const s of possibleSkus) {
      const sClean = s.toLowerCase().replace(/\s/g, '')
      if (sClean.length >= 4 && productSkuClean.includes(sClean)) score = Math.max(score, 0.82)
      if (sClean.length >= 4 && baseNorm.includes(sClean) && search.skuNorm && search.skuNorm.includes(sClean)) score = Math.max(score, 0.8)
    }
  }

  // 4) Product name contained in filename or vice versa
  if (search.nameNorm && baseNorm.includes(search.nameNorm)) score = Math.max(score, 0.9)
  if (search.nameNorm && search.nameNorm.includes(baseNorm)) score = Math.max(score, 0.85)

  // 5) Leading number in filename matches product (e.g. "141.jpeg" -> product "141 Camden Handle...")
  for (const num of leadingNums) {
    if (nameNumbers.includes(num) || (search.skuNorm && search.skuNorm.includes(String(num)))) {
      const nameOverlap = search.nameTokens.filter((t) => t.length > 1 && baseTokens.some((b) => b.includes(t) || t.includes(b))).length
      score = Math.max(score, 0.5 + 0.25 * (nameOverlap / Math.max(search.nameTokens.length, 1)))
      if (baseTokens.length <= 3) score = Math.max(score, 0.72)
    }
  }

  // 6) Single or multiple numbers overlap (e.g. "180 181" or "170 hinge" -> product with 170, 180 in name)
  if (baseNumbers.length >= 1 && nameNumbers.length >= 1) {
    const same = baseNumbers.filter((n) => nameNumbers.includes(n)).length
    if (same >= 2) score = Math.max(score, 0.78)
    else if (same >= 1) score = Math.max(score, 0.55)
  }

  // 7) Category/range in filename + numbers
  if (search.categoryNorm && baseNorm.includes(search.categoryNorm)) {
    const nameOverlap = search.nameTokens.filter((t) => t.length > 1 && baseTokens.some((b) => b.includes(t) || t.includes(b))).length
    let s = 0.5 + 0.2 * (nameOverlap / Math.max(search.nameTokens.length, 1))
    if (nameNumbers.length >= 2 && baseNumbers.length >= 2) {
      const sameNumbers = nameNumbers.filter((n) => baseNumbers.includes(n)).length
      if (sameNumbers >= 2) s = Math.max(s, 0.88)
      else if (sameNumbers >= 1) s = Math.max(s, 0.7)
    }
    score = Math.max(score, s)
  }

  // 8) Category slug in filename (e.g. "Handles" folder / "handle" in name)
  if (search.categorySlug && baseNorm.includes(search.categorySlug)) {
    const nameOverlap = search.nameTokens.filter((t) => t.length > 1 && baseTokens.some((b) => b.includes(t) || t.includes(b))).length
    score = Math.max(score, 0.45 + 0.25 * (nameOverlap / Math.max(search.nameTokens.length, 1)))
  }

  // 9) Keyword overlap (handle, chrome, 160mm, etc.)
  if (baseKeywords.length > 0 && search.nameKeywords && search.nameKeywords.length > 0) {
    const keywordOverlap = baseKeywords.filter((k) => search.nameKeywords.includes(k)).length
    const nameOverlap = search.nameTokens.filter((t) => t.length > 1 && baseTokens.some((b) => b.includes(t) || t.includes(b))).length
    const combined = (keywordOverlap / Math.max(baseKeywords.length, 1)) * 0.5 + (nameOverlap / Math.max(search.nameTokens.length, 1)) * 0.5
    score = Math.max(score, 0.4 + 0.35 * combined)
  }

  // 10) Longest substring of filename in product name (e.g. "Kensington Pull Handle" in product, "Kensington Pull Handle - Matt Black 100mm.jpg")
  const subLen = longestSubstringIn(baseNorm, search.nameNorm, 5)
  if (subLen >= 8) score = Math.max(score, 0.65)
  else if (subLen >= 5) score = Math.max(score, 0.5)

  // 11) Description overlap: filename tokens in product description
  if (search.descriptionNorm && search.descriptionNorm.length > 10) {
    const descOverlap = baseTokens.filter((t) => t.length > 2 && search.descriptionNorm.includes(t)).length
    if (descOverlap >= 2) score = Math.max(score, 0.52)
    else if (descOverlap >= 1) score = Math.max(score, 0.38)
  }

  // 12) Word overlap (existing, but with lower bar)
  const overlap = search.nameTokens.filter((t) => t.length > 1 && baseTokens.some((b) => b.includes(t) || t.includes(b))).length
  const totalWords = Math.max(search.nameTokens.length, baseTokens.length, 1)
  score = Math.max(score, 0.35 * (overlap / totalWords))

  // 13) Single token/code: filename is one or two tokens (e.g. "8901462", "IP4N71") -> product SKU or name contains it
  if (baseTokens.length <= 2 && baseNorm.length >= 4) {
    const mainToken = baseTokens[0].replace(/[^a-z0-9]/gi, '')
    if (mainToken.length >= 4) {
      if (search.skuNorm && search.skuNorm.includes(mainToken.toLowerCase())) score = Math.max(score, 0.58)
      if (search.nameNorm && search.nameNorm.includes(mainToken.toLowerCase())) score = Math.max(score, 0.5)
    }
  }

  // 14) Any extracted code from filename appears at start of product SKU or name (starts-with)
  for (const code of possibleSkus) {
    if (code.length < 5) continue
    const codeLower = code.toLowerCase()
    if (search.skuNorm && (search.skuNorm.startsWith(codeLower) || codeLower.startsWith(search.skuNorm))) score = Math.max(score, 0.62)
    if (search.nameNorm && search.nameNorm.includes(codeLower)) score = Math.max(score, 0.48)
  }

  // 15) Filename starts with product name (first 6+ chars)
  if (search.nameNorm.length >= 6 && baseNorm.startsWith(search.nameNorm.slice(0, 8))) score = Math.max(score, 0.55)

  return score
}

/** Try matching using only the first part of a compound code (e.g. FF13420BL from FF13420BL_FF13460BL) */
function findBestProductWithCompoundCodes(filenameBase, searchRows, threshold, folderHint = null) {
  const base = filenameBase.replace(/\.[^.]+$/, '')
  const parts = base.split(/[_\-]+/).filter((p) => p.length >= 4)
  if (parts.length <= 1) return null
  const matchOpts = folderHint ? { folderHint } : {}
  let best = null
  let bestScore = 0
  for (const part of parts) {
    for (const row of searchRows) {
      const s = scoreMatch(part, row, matchOpts)
      if (s > bestScore && s >= threshold) {
        bestScore = s
        best = row
      }
    }
  }
  return best ? { productId: best.id, productName: best.name, score: bestScore } : null
}

/** Find best product for this filename; use relaxed threshold for second/third pass. Raised thresholds to reduce wrong assignments. */
function findBestProduct(filenameBase, searchRows, options = {}) {
  const threshold = options.veryRelaxed ? 0.24 : options.relaxed ? 0.32 : 0.38
  const useStripped = options.useStripped !== false
  const base = useStripped ? filenameToSearchBase(filenameBase) : filenameBase.replace(/\.[^.]+$/, '')
  const matchOpts = options.folderHint ? { folderHint: options.folderHint } : {}
  let best = null
  let bestScore = 0
  for (const row of searchRows) {
    const s = scoreMatch(base, row, matchOpts)
    if (s > bestScore && s >= threshold) {
      bestScore = s
      best = row
    }
  }
  if (best) return { productId: best.id, productName: best.name, score: bestScore }
  if (options.tryCompoundCodes && filenameBase.includes('_')) {
    const compound = findBestProductWithCompoundCodes(filenameBase, searchRows, threshold, options.folderHint)
    if (compound) return compound
  }
  return null
}

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'src', '.git', 'docs', 'scripts', 'supabase', 'product-images', 'product-images-extracted', 'product-images-from-zip'])

function collectImagePaths(dir, baseDir = dir, excludeDirs = EXCLUDE_DIRS) {
  const out = []
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (!excludeDirs.has(e.name)) out.push(...collectImagePaths(full, baseDir, excludeDirs))
    } else if (e.isFile() && IMG_EXT.has(extname(e.name).toLowerCase())) {
      out.push(full)
    }
  }
  return out
}

async function main() {
  const folderPath = process.argv[2]
  if (!folderPath) {
    console.error('Usage: npm run assign-images -- "C:\\path\\to\\images"')
    console.error('Example: npm run assign-images -- "C:\\Users\\You\\Dropbox\\Trade Mouldings\\product-images"')
    process.exit(1)
  }

  const resolved = resolve(folderPath)
  let stat
  try {
    stat = statSync(resolved)
  } catch (e) {
    console.error('Folder not found or not readable:', resolved)
    process.exit(1)
  }
  if (!stat.isDirectory()) {
    console.error('Not a directory:', resolved)
    process.exit(1)
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  console.log('Scanning folder:', resolved)
  const imagePaths = collectImagePaths(resolved)
  console.log('Found', imagePaths.length, 'image file(s)')

  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, description, sku, category_id')
    .eq('active', true)
  if (prodErr) {
    console.error('Failed to load products:', prodErr.message)
    process.exit(1)
  }

  const { data: categories } = await supabase.from('categories').select('id, name, slug')
  const catById = new Map()
  const catSlugById = new Map()
  for (const c of categories || []) {
    catById.set(c.id, c.name)
    catSlugById.set(c.id, c.slug || '')
  }

  const searchRows = (products || []).map((p) =>
    productToSearchRow(p, catById.get(p.category_id), catSlugById.get(p.category_id))
  )

  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'
  if (dryRun) console.log('DRY_RUN: no uploads or DB updates.\n')

  let assigned = 0
  let skipped = 0
  const report = []

  for (const filePath of imagePaths) {
    const fileName = basename(filePath)
    const base = fileName.replace(/\.[^.]+$/, '')
    const ext = extname(fileName).toLowerCase()
    const parentFolderName = basename(dirname(filePath))
    const folderHint = parentFolderName
      ? { folderNorm: normalizeForMatch(parentFolderName), folderTokens: tokenize(parentFolderName) }
      : null
    const opts = (overrides) => (folderHint ? { ...overrides, folderHint } : overrides)

    let match = findBestProduct(base, searchRows, opts({ relaxed: false }))
    if (!match) match = findBestProduct(base, searchRows, opts({ relaxed: true }))
    if (!match) match = findBestProduct(fileName.replace(/\.[^.]+$/, ''), searchRows, opts({ relaxed: true, useStripped: false }))
    if (!match) match = findBestProduct(base, searchRows, opts({ relaxed: true, tryCompoundCodes: true }))
    if (!match) match = findBestProduct(base, searchRows, opts({ veryRelaxed: true }))
    if (!match) match = findBestProduct(base, searchRows, opts({ veryRelaxed: true, tryCompoundCodes: true }))
    if (!match) {
      report.push({ file: fileName, action: 'skip', reason: 'no product match' })
      skipped++
      continue
    }

    if (dryRun) {
      report.push({ file: fileName, action: 'would assign', product: match.productName, score: match.score.toFixed(2) })
      assigned++
      continue
    }

    let safeStorageName = base.replace(/[^a-zA-Z0-9._-]/g, '_') + ext
    let fileBuffer = readFileSync(filePath)
    const maxSizeBytes = 4 * 1024 * 1024 // 4MB – resize if larger when sharp available
    if (fileBuffer.length > maxSizeBytes) {
      try {
        const sharp = (await import('sharp')).default
        fileBuffer = await sharp(fileBuffer)
          .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()
        safeStorageName = base.replace(/[^a-zA-Z0-9._-]/g, '_') + '.jpg'
      } catch (_) {
        // sharp not installed or failed – upload original
      }
    }
    const contentType = safeStorageName.endsWith('.png') ? 'image/png' : safeStorageName.endsWith('.webp') ? 'image/webp' : safeStorageName.endsWith('.gif') ? 'image/gif' : 'image/jpeg'
    const maxAttempts = 2
    let uploadErr = null
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await supabase.storage.from(BUCKET).upload(safeStorageName, fileBuffer, {
        contentType,
        upsert: true,
      })
      uploadErr = result.error
      if (!uploadErr) break
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 500 * attempt))
    }
    if (uploadErr) {
      report.push({ file: fileName, action: 'error', reason: uploadErr.message })
      skipped++
      continue
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(safeStorageName)
    const url = urlData.publicUrl
    let updateErr = null
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await supabase
        .from('products')
        .update({ image_url: url, image_alt: match.productName })
        .eq('id', match.productId)
      updateErr = result.error
      if (!updateErr) break
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 500 * attempt))
    }
    if (updateErr) {
      report.push({ file: fileName, action: 'error', reason: updateErr.message })
      skipped++
      continue
    }
    report.push({ file: fileName, action: 'assigned', product: match.productName })
    assigned++
  }

  console.log('\nResult:', assigned, 'assigned', skipped, 'skipped')
  report.forEach((r) => {
    if (r.action === 'assigned' || r.action === 'would assign') console.log('  ', r.file, '→', r.product, r.score ? `(score ${r.score})` : '')
    else console.log('  ', r.file, '-', r.reason || r.action)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
