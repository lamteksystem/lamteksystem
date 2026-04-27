import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { parseNapwoodXlsxFile, COST_PRICE_MARGIN } from '@/lib/napwood-import'
import type { NapwoodProduct, NapwoodCategory } from '@/lib/napwood-import'

function slugify(name: string): string {
  if (!name || typeof name !== 'string') return 'other'
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'other'
}

type Phase = 'idle' | 'parsing' | 'cleaning' | 'categories' | 'products' | 'done' | 'error'

export default function AdminImportCatalogue() {
  const [file, setFile] = useState<File | null>(null)
  const [cleanBeforeImport, setCleanBeforeImport] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [percent, setPercent] = useState(0)
  const [message, setMessage] = useState('')
  const [inserted, setInserted] = useState(0)
  const [totalProducts, setTotalProducts] = useState(0)
  const [categoryCount, setCategoryCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function runImport() {
    if (!file) {
      setError('Choose an Excel file first.')
      return
    }
    setError(null)
    setPhase('parsing')
    setPercent(0)
    setMessage('Reading file…')
    let categories: NapwoodCategory[] = []
    let products: NapwoodProduct[] = []
    try {
      const result = await parseNapwoodXlsxFile(file)
      categories = result.categories
      products = result.products
      setCategoryCount(categories.length)
      setTotalProducts(products.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('error')
      return
    }
    if (products.length === 0) {
      setError('No products found in sheet 010626. Check the file format.')
      setPhase('error')
      return
    }

    if (cleanBeforeImport) {
      setPhase('cleaning')
      setMessage('Clearing existing catalogue…')
      setPercent(0)
      try {
        const { data: productIds } = await supabase.from('products').select('id').limit(10000)
        const ids = (productIds ?? []).map((r) => r.id)
        if (ids.length > 0) {
          await supabase.from('collection_products').delete().in('product_id', ids)
          await supabase.from('assembly_lines').delete().in('product_id', ids)
          await supabase.from('product_stock').delete().in('product_id', ids)
          const { data: lineIds } = await supabase.from('order_lines').select('id').limit(50000)
          const lineIdList = (lineIds ?? []).map((r) => r.id)
          if (lineIdList.length > 0) {
            for (let i = 0; i < lineIdList.length; i += 500) {
              const chunk = lineIdList.slice(i, i + 500)
              await supabase.from('order_lines').delete().in('id', chunk)
            }
          }
          for (let i = 0; i < ids.length; i += 200) {
            const chunk = ids.slice(i, i + 200)
            await supabase.from('products').delete().in('id', chunk)
          }
        }
        const { data: catIds } = await supabase.from('categories').select('id').limit(5000)
        const catIdList = (catIds ?? []).map((r) => r.id)
        if (catIdList.length > 0) {
          for (let i = 0; i < catIdList.length; i += 200) {
            await supabase.from('categories').delete().in('id', catIdList.slice(i, i + 200))
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setPhase('error')
        return
      }
    }

    setPhase('categories')
    setMessage(`Importing ${categories.length} categories…`)
    const categoryRows = categories.map((c) => ({
      name: c.name,
      slug: c.slug,
      sort_order: 0,
    }))
    const { data: upsertedCategories, error: catError } = await supabase
      .from('categories')
      .upsert(categoryRows, { onConflict: 'slug' })
      .select('id, slug')
    if (catError) {
      setError(catError.message)
      setPhase('error')
      return
    }
    setPercent(5)
    const slugToId = new Map<string, string>()
    for (const row of upsertedCategories ?? []) {
      slugToId.set(row.slug, row.id)
    }

    setPhase('products')
    setMessage('Importing products…')
    let processed = 0
    const BATCH = 50
    for (let i = 0; i < products.length; i += BATCH) {
      const batch = products.slice(i, i + BATCH)
      const rows = batch.map((p, idx) => {
        const slug = slugify(p.productGroup)
        const categoryId = slugToId.get(slug) ?? slugToId.values().next().value
        const costPrice = Math.round(p.unitPrice * COST_PRICE_MARGIN * 100) / 100
        const name = p.name.length > 300 ? p.name.slice(0, 297) + '…' : p.name
        const description = p.name.length > 200 ? (p.name.length > 500 ? p.name.slice(0, 497) + '…' : p.name) : null
        return {
          category_id: categoryId,
          name,
          description,
          sku: p.code,
          unit_price: p.unitPrice,
          cost_price: costPrice,
          sort_order: i + idx,
          active: true,
        }
      })
      const { error: batchError } = await supabase
        .from('products')
        .upsert(rows, { onConflict: 'sku' })
      if (batchError) {
        setError(batchError.message)
        setPhase('error')
        return
      }
      processed += batch.length
      setInserted(processed)
      setPercent(totalProducts ? 5 + Math.round((95 * processed) / totalProducts) : 100)
    }
    setPercent(100)
    setPhase('done')
    setMessage(`Done. ${processed} products, ${categoryCount} categories.`)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setFile(f ?? null)
    setError(null)
    setPhase('idle')
  }

  const inProgress = phase === 'parsing' || phase === 'cleaning' || phase === 'categories' || phase === 'products'

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">
          <Link to="/admin">Admin Dashboard</Link>
          <span className="admin-breadcrumb-sep"> / </span>
          <Link to="/admin/catalogue">Catalogue</Link>
          <span className="admin-breadcrumb-sep"> / </span>
          <span>Import Napwood pricelist</span>
        </span>
      </div>
      <div className="card admin-card admin-import-card">
        <h2>Import Napwood pricelist</h2>
        <p className="admin-muted">
          Upload the <strong>Napwood Construction Price List</strong> Excel file (sheet <code>010626</code>). Products and categories will be created or updated by SKU/slug. Customer price = spreadsheet price; cost = 75% of that (test).
        </p>
        <div className="admin-import-form">
          <label>
            <span className="admin-import-label">Excel file (.xlsx)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={inProgress}
            />
          </label>
          {file && <p className="admin-import-filename">{file.name}</p>}
          <label className="admin-import-checkbox">
            <input
              type="checkbox"
              checked={cleanBeforeImport}
              onChange={(e) => setCleanBeforeImport(e.target.checked)}
              disabled={inProgress}
            />
            <span>Clear existing products and categories before import</span>
          </label>
          <p className="admin-muted admin-import-warn">
            {cleanBeforeImport ? 'Order line items will be removed so products can be deleted. Order headers remain.' : 'Existing products will be updated by SKU; new ones added. Categories updated by slug.'}
          </p>
          <div className="admin-import-actions">
            <button
              type="button"
              className="btn"
              onClick={runImport}
              disabled={inProgress || !file}
            >
              {inProgress ? 'Importing…' : 'Import'}
            </button>
            <Link to="/admin/catalogue" className="btn btn-outline">Back to Catalogue</Link>
          </div>
        </div>

        {(phase === 'parsing' || phase === 'cleaning' || phase === 'categories' || phase === 'products' || phase === 'done' || phase === 'error') && (
          <div className="admin-import-progress-wrap">
            <div className="admin-import-progress-bar">
              <div className="admin-import-progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <p className="admin-import-progress-text">
              {phase === 'done' && message}
              {phase === 'products' && `${message} ${percent}% (${inserted} / ${totalProducts})`}
              {(phase === 'parsing' || phase === 'cleaning' || phase === 'categories') && message}
              {phase === 'error' && error}
            </p>
          </div>
        )}


        {error && phase === 'error' && (
          <div className="admin-message admin-message--err" role="alert">
            {error}
          </div>
        )}
        {phase === 'done' && (
          <div className="admin-message admin-message--ok" role="alert">
            Import complete. {inserted} products, {categoryCount} categories.
          </div>
        )}
      </div>
    </div>
  )
}
