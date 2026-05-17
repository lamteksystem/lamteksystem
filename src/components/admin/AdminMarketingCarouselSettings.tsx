import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermission } from '@/hooks/usePermission'
import type { MarketingSiteSettingsRow, ProductRow } from '@/types/database'

export default function AdminMarketingCarouselSettings({ embedded = false }: { embedded?: boolean }) {
  const { allowed: canEdit, loading: permLoading } = usePermission('admin.settings', 'edit')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [carouselLimit, setCarouselLimit] = useState(6)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<ProductRow[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Map<string, ProductRow>>(new Map())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: row, error: e1 } = await supabase
      .from('marketing_site_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle()
    if (e1) {
      setError(e1.message)
      setLoading(false)
      return
    }
    const s = row as MarketingSiteSettingsRow | null
    if (s) {
      setCarouselLimit(s.carousel_limit ?? 6)
      const ids = s.carousel_product_ids ?? []
      setSelectedIds(ids)
      if (ids.length > 0) {
        const { data: prods } = await supabase.from('products').select('*').in('id', ids)
        const m = new Map<string, ProductRow>()
        ;(prods ?? []).forEach((p) => m.set(p.id, p as ProductRow))
        setSelectedProducts(m)
      } else {
        setSelectedProducts(new Map())
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const raw = search.trim().replace(/[%_]/g, '')
    if (raw.length < 2) {
      setSearchResults([])
      return
    }
    const t = window.setTimeout(async () => {
      const like = `%${raw}%`
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .or(`name.ilike.${like},sku.ilike.${like}`)
        .limit(12)
      setSearchResults((data ?? []) as ProductRow[])
    }, 200)
    return () => window.clearTimeout(t)
  }, [search])

  function addProduct(p: ProductRow) {
    if (selectedIds.includes(p.id)) return
    if (selectedIds.length >= carouselLimit) {
      setError(`Maximum ${carouselLimit} products (increase limit or remove one).`)
      return
    }
    setError(null)
    setSelectedIds((prev) => [...prev, p.id])
    setSelectedProducts((prev) => new Map(prev).set(p.id, p))
    setSearch('')
    setSearchResults([])
  }

  function removeProduct(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id))
    setSelectedProducts((prev) => {
      const m = new Map(prev)
      m.delete(id)
      return m
    })
  }

  function move(id: string, dir: -1 | 1) {
    setSelectedIds((prev) => {
      const i = prev.indexOf(id)
      if (i < 0) return prev
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function save() {
    if (!canEdit) return
    setSaving(true)
    setError(null)
    setSaved(false)
    const lim = Math.min(24, Math.max(1, carouselLimit))
    const capped = selectedIds.slice(0, lim)
    const { error: e } = await supabase
      .from('marketing_site_settings')
      .update({
        carousel_limit: lim,
        carousel_product_ids: capped,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'default')
    setSaving(false)
    if (e) {
      setError(e.message)
      return
    }
    setSelectedIds(capped)
    setCarouselLimit(lim)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  const wrapClass = embedded ? 'admin-settings-embedded-panel' : 'card admin-settings-card'

  if (permLoading || loading) {
    return (
      <section className={wrapClass}>
        {!embedded && <h2>Public site — popular products carousel</h2>}
        <p className="page-intro">Loading…</p>
      </section>
    )
  }

  if (!canEdit) {
    return (
      <section className={wrapClass}>
        {!embedded && <h2>Public site — popular products carousel</h2>}
        <p className="page-intro">You do not have permission to edit site marketing settings.</p>
      </section>
    )
  }

  return (
    <section className={wrapClass}>
      {!embedded && <h2>Public site — popular products carousel</h2>}
      <p className="page-intro">
        Controls the homepage carousel on the public marketing site (before login). Choose how many slides to show and which catalogue products appear.
      </p>

      {error && <p className="login-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
      {saved && <p className="admin-settings-hint" style={{ color: 'var(--lamtek-success)' }}>Saved.</p>}

      <div className="admin-settings-list">
        <label className="admin-settings-row">
          <span className="admin-settings-label">Visible carousel items (max)</span>
          <input
            type="number"
            min={1}
            max={24}
            value={carouselLimit}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!Number.isFinite(v)) return
              setCarouselLimit(Math.min(24, Math.max(1, v)))
            }}
            className="admin-settings-select"
            style={{ maxWidth: '6rem' }}
          />
        </label>
        <p className="admin-settings-hint">
          If you pick specific products below, only up to this many will be shown (in list order).
          If the list is empty, the site fills the carousel with active catalogue products up to this limit.
        </p>

        <div style={{ marginTop: '1rem' }}>
          <label>
            <span className="admin-settings-label">Add product by search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or SKU (min 2 characters)"
              className="admin-settings-select"
              style={{ width: '100%', maxWidth: '420px', marginTop: '0.35rem' }}
            />
          </label>
          {searchResults.length > 0 && (
            <ul className="admin-marketing-search-results">
              {searchResults.map((p) => (
                <li key={p.id}>
                  <button type="button" className="btn btn-small btn-outline" onClick={() => addProduct(p)}>
                    Add — {p.name} {p.sku ? `(${p.sku})` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ marginTop: '1rem' }}>
          <span className="admin-settings-label">Selected products (order = carousel order)</span>
          <ol className="admin-marketing-selected">
            {selectedIds.map((id) => {
              const p = selectedProducts.get(id)
              return (
                <li key={id}>
                  <span>{p?.name ?? id.slice(0, 8)}</span>
                  <span className="admin-marketing-selected-actions">
                    <button type="button" className="btn btn-small btn-outline" onClick={() => move(id, -1)}>
                      Up
                    </button>
                    <button type="button" className="btn btn-small btn-outline" onClick={() => move(id, 1)}>
                      Down
                    </button>
                    <button type="button" className="btn btn-small" onClick={() => removeProduct(id)}>
                      Remove
                    </button>
                  </span>
                </li>
              )
            })}
          </ol>
          {selectedIds.length === 0 && (
            <p className="admin-settings-hint">None selected — homepage will auto-pick active products.</p>
          )}
        </div>

        <div style={{ marginTop: '1rem' }}>
          <button type="button" className="btn" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save carousel settings'}
          </button>
        </div>
      </div>
    </section>
  )
}

