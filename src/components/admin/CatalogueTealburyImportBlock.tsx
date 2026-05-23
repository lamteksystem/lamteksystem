import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { parseTealburyPricelistWorkbook, slugifyCategorySegment, type TealburyParsedRow } from '@/lib/tealburyPricelistParse'
import type { Json } from '@/types/database'

const TEALBURY_SLUG_PREFIX = 'tealbury-'
const CHUNK = 200

function csvEscapeCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

async function ensureTealburyCategoryId(name: string): Promise<string> {
  const cleaned = name.trim()
  let slugCore = slugifyCategorySegment(cleaned)
  if (slugCore.startsWith('tealbury-')) slugCore = slugCore.slice('tealbury-'.length)
  const slug = `${TEALBURY_SLUG_PREFIX}${slugCore}`.slice(0, 80)
  const { data: existing, error: selErr } = await supabase.from('categories').select('id').eq('slug', slug).maybeSingle()
  if (selErr) throw selErr
  if (existing?.id) return existing.id
  const { data: ins, error: insErr } = await supabase
    .from('categories')
    .insert({ name: cleaned.slice(0, 200), slug, sort_order: 520 })
    .select('id')
    .single()
  if (insErr) throw insErr
  if (!ins?.id) throw new Error('Category insert returned no id')
  return ins.id
}

async function purgeTealburyCatalogue(): Promise<void> {
  const ids: string[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data: page, error: selErr } = await supabase
      .from('products')
      .select('id')
      .eq('catalog_program', CATALOG_PROGRAM.TEALBURY)
      .range(from, from + PAGE - 1)
    if (selErr) throw selErr
    if (!page?.length) break
    ids.push(...page.map((r) => r.id))
    if (page.length < PAGE) break
    from += PAGE
  }
  if (!ids.length) {
    await removeOrphanTealburyCategories()
    return
  }
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK)
    const { error: alErr } = await supabase.from('assembly_lines').delete().in('product_id', part)
    if (alErr) throw alErr
  }
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK)
    const { error: delErr } = await supabase.from('products').delete().in('id', part)
    if (delErr) throw delErr
  }
  await removeOrphanTealburyCategories()
}

async function removeOrphanTealburyCategories(): Promise<void> {
  const { data: cats, error } = await supabase.from('categories').select('id').like('slug', `${TEALBURY_SLUG_PREFIX}%`)
  if (error) throw error
  for (const c of cats ?? []) {
    const { count, error: cErr } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('category_id', c.id)
    if (cErr) throw cErr
    if ((count ?? 0) === 0) {
      const { error: dErr } = await supabase.from('categories').delete().eq('id', c.id)
      if (dErr) throw dErr
    }
  }
}

/**
 * Tealbury workbook import (customer XLSX with per–door-range sheets). Used on the unified Catalogue admin page.
 */
export default function CatalogueTealburyImportBlock() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<TealburyParsedRow[] | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onFile = useCallback(async (f: File | null) => {
    setError(null)
    setMessage(null)
    setParsed(null)
    setWarnings([])
    if (!f) return
    if (!/\.xlsx$/i.test(f.name)) {
      setError('Please choose an .xlsx file (Excel workbook).')
      return
    }
    setBusy(true)
    try {
      const buf = await f.arrayBuffer()
      const { rows, warnings: w } = parseTealburyPricelistWorkbook(buf)
      if (!rows.length) {
        setError(
          'No product rows were parsed. Expected Tealbury customer tables (CODE, H/W/D mm, PRICE) on each door-range sheet, or Lamtek trade kitchen/bedroom layouts.'
        )
        setWarnings(w)
        return
      }
      setParsed(rows)
      setWarnings(w)
      setMessage(
        `Parsed ${rows.length} row(s). If the workbook has a Pricelist hub plus separate range sheets, each range is imported separately (SKU includes the sheet name). Review the preview, then import.`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const runImport = useCallback(async () => {
    if (!parsed?.length) {
      setError('Parse a workbook first.')
      return
    }
    if (
      !window.confirm(
        `Replace all Tealbury catalogue products with ${parsed.length} row(s) from the spreadsheet? Lamtek component products are not changed.`
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      setMessage('Removing existing Tealbury products…')
      await purgeTealburyCatalogue()

      const categoryCache = new Map<string, string>()
      async function catIdFor(section: string): Promise<string> {
        const k = section.trim() || 'Tealbury'
        if (categoryCache.has(k)) return categoryCache.get(k)!
        const id = await ensureTealburyCategoryId(k.startsWith('Tealbury') ? k : `Tealbury — ${k}`)
        categoryCache.set(k, id)
        return id
      }

      const payloads = []
      for (const row of parsed) {
        const category_id = await catIdFor(row.categoryName)
        payloads.push({
          category_id,
          name: row.name,
          description: row.description,
          sku: row.sku,
          unit_price: row.unitPrice,
          cost_price: row.cost_price,
          options: row.options as Json,
          active: true,
          is_stock: true,
          sort_order: 0,
          stock_quantity: 0,
          catalog_program: CATALOG_PROGRAM.TEALBURY,
        })
      }

      setMessage('Inserting products…')
      for (let i = 0; i < payloads.length; i += CHUNK) {
        const slice = payloads.slice(i, i + CHUNK)
        const { error: insErr } = await supabase.from('products').insert(slice)
        if (insErr) throw insErr
      }
      setMessage(`Imported ${payloads.length} Tealbury product(s).`)
      setParsed(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [parsed])

  const exportCsv = useCallback(async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('sku, name, description, unit_price, cost_price, options, category_id')
        .eq('catalog_program', CATALOG_PROGRAM.TEALBURY)
        .order('sku')
      if (pErr) throw pErr
      const { data: cats, error: cErr } = await supabase.from('categories').select('id, name, slug')
      if (cErr) throw cErr
      const catById = new Map((cats ?? []).map((c) => [c.id, c]))
      const headers = ['sku', 'category', 'name', 'unit_price_ex_vat', 'cost_price', 'description', 'options_json']
      const lines = [headers.join(',')]
      for (const p of products ?? []) {
        const cat = p.category_id ? catById.get(p.category_id) : undefined
        const row = [
          csvEscapeCell(p.sku ?? ''),
          csvEscapeCell(cat?.name ?? ''),
          csvEscapeCell(p.name ?? ''),
          csvEscapeCell(String(p.unit_price ?? '')),
          csvEscapeCell(p.cost_price != null ? String(p.cost_price) : ''),
          csvEscapeCell((p.description ?? '').replace(/\r\n/g, '\n')),
          csvEscapeCell(JSON.stringify(p.options ?? {})),
        ]
        lines.push(row.join(','))
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tealbury-catalogue-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setMessage(`Exported ${products?.length ?? 0} row(s).`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <div className="admin-tealbury-import-block">
      <h3 className="admin-card-subtitle">Tealbury customer workbook (.xlsx)</h3>
      <p className="admin-muted" style={{ marginBottom: '0.75rem' }}>
        For full editing, category assignment, and template export, use{' '}
        <Link to="/admin/catalogue-tools/pricelist-workbench">Pricelist workbench</Link>. Quick replace-import below reads each{' '}
        <strong>door / range sheet</strong> (skips the Pricelist hub when range sheets exist).
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          void onFile(f)
        }}
      />

      {warnings.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4 className="admin-muted">Parser notices</h4>
          <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
            {warnings.slice(0, 25).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {warnings.length > 25 ? <p className="admin-muted">…and {warnings.length - 25} more.</p> : null}
        </div>
      )}

      {parsed && parsed.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4 className="admin-muted">Preview ({parsed.length} rows)</h4>
          <div className="admin-table-scroll" style={{ maxHeight: '280px', marginTop: '0.5rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Section</th>
                  <th>Name</th>
                  <th>Unit £</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 60).map((r) => (
                  <tr key={`${r.sku}-${r.categoryName}`}>
                    <td>{r.sku}</td>
                    <td>{r.categoryName}</td>
                    <td>{r.name}</td>
                    <td>{r.unitPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.length > 60 ? <p className="admin-muted">Showing first 60 rows.</p> : null}
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn" disabled={busy} onClick={() => void runImport()}>
              Replace Tealbury catalogue
            </button>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void exportCsv()}>
              Export Tealbury CSV
            </button>
          </div>
        </div>
      )}

      {message && <p className="admin-message-ok" style={{ marginTop: '0.75rem' }}>{message}</p>}
      {error && <p className="admin-error" style={{ marginTop: '0.75rem' }}>{error}</p>}
    </div>
  )
}
