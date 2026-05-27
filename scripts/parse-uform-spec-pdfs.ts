/**
 * Parse UFORM tech-spec PDFs → JSON for pricelist workbench import.
 *
 *   npm run catalogue:parse-uform-specs
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { parseUformSpecText, type UformSpecJsonBundle } from '../src/lib/uformSpecParse.ts'

type PdfParseCtor = new (opts: { data: Buffer }) => {
  getText(): Promise<{ text?: string }>
  destroy(): Promise<void>
}

async function loadPdfParse(): Promise<PdfParseCtor> {
  const mod = await import('pdf-parse')
  const PDFParse = (mod as { PDFParse?: PdfParseCtor; default?: PdfParseCtor }).PDFParse ?? mod.default
  if (!PDFParse) throw new Error('pdf-parse: missing PDFParse export')
  return PDFParse
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const dirArg = process.argv.includes('--dir')
  ? process.argv[process.argv.indexOf('--dir') + 1]
  : join(root, 'Pricelists and Specifications', 'uform', 'specs')

async function extractText(pdfPath: string, PDFParse: PdfParseCtor): Promise<string> {
  const buf = readFileSync(pdfPath)
  const parser = new PDFParse({ data: buf })
  try {
    const data = await parser.getText()
    return data.text ?? ''
  } finally {
    await parser.destroy()
  }
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

  const pdf = await loadPdfParse()
  const allProducts = []
  const fileMeta: UformSpecJsonBundle['files'] = []

  for (const file of files) {
    const stem = basename(file, '.pdf')
    const text = await extractText(join(dirArg, file), pdf)
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
