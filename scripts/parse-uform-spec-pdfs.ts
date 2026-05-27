/**
 * Parse UFORM tech-spec PDFs → JSON for pricelist workbench import.
 *
 *   npm run catalogue:parse-uform-specs
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
// @ts-expect-error no types
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { parseUformSpecText, type UformSpecJsonBundle } from '../src/lib/uformSpecParse.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const dirArg = process.argv.includes('--dir')
  ? process.argv[process.argv.indexOf('--dir') + 1]
  : join(root, 'Pricelists and Specifications', 'uform', 'specs')

async function extractText(pdfPath: string): Promise<string> {
  const buf = readFileSync(pdfPath)
  const data = await pdf(buf)
  return data.text ?? ''
}

async function main() {
  if (!existsSync(dirArg)) {
    console.error(`Directory not found: ${dirArg}`)
    process.exit(1)
  }

  const files = readdirSync(dirArg).filter((f) => /\.pdf$/i.test(f))
  if (!files.length) {
    console.error(`No PDF files in ${dirArg}`)
    process.exit(1)
  }

  const allProducts = []
  const fileMeta: UformSpecJsonBundle['files'] = []

  for (const file of files) {
    const stem = basename(file, '.pdf')
    const text = await extractText(join(dirArg, file))
    const products = parseUformSpecText(text, stem)
    fileMeta.push({
      file,
      door_range: products[0]?.door_range ?? stem,
      product_count: products.length,
    })
    allProducts.push(...products)
    console.log(`${file}: ${products.length} product(s) → ${products[0]?.door_range ?? '?'}`)
  }

  const outDir = join(root, 'Pricelists and Specifications', 'generated')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'uform-spec-products.json')
  const bundle: UformSpecJsonBundle = {
    generated_at: new Date().toISOString(),
    files: fileMeta,
    products: allProducts,
  }
  writeFileSync(outPath, JSON.stringify(bundle, null, 2), 'utf8')
  console.log(`\nWrote ${allProducts.length} products → ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
