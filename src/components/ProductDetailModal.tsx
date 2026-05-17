import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getDocumentUrls } from '@/lib/documents'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import { fetchAssembliesUsingComponent, fetchProductAssemblyBom } from '@/lib/productAssembly'
import ProductAssemblyBreakdown from '@/components/ProductAssemblyBreakdown'
import type { CategoryRow, ProductRow, DocumentRow } from '@/types/database'
import { VAT_RATE } from '@/lib/tax'

const OPTION_LABELS: Record<string, string> = {
  finish: 'Finish',
  style: 'Style',
  colour: 'Colour',
  color: 'Colour',
  material: 'Material',
  thickness: 'Thickness',
  width: 'Width',
  height: 'Height',
  depth: 'Depth',
  length: 'Length',
  width_mm: 'Width (mm)',
  height_mm: 'Height (mm)',
  depth_mm: 'Depth (mm)',
}

const MEASUREMENT_KEYS = new Set([
  'width', 'height', 'depth', 'length', 'thickness',
  'width_mm', 'height_mm', 'depth_mm', 'length_mm', 'thickness_mm',
  'dimensions', 'size', 'measurements',
])

function isInternalPricelistKey(k: string): boolean {
  return k.startsWith('lamtek_') || k.startsWith('tealbury_')
}

interface AssemblyWithName {
  id: string
  name: string
}

interface ProductDetailModalProps {
  product: ProductRow
  categories: CategoryRow[]
  allProducts: ProductRow[]
  onClose: () => void
  onSelectProduct?: (product: ProductRow) => void
  onAddToCart?: (product: ProductRow, quantity: number) => void | Promise<void>
}

export default function ProductDetailModal({
  product,
  categories,
  allProducts,
  onClose,
  onSelectProduct,
  onAddToCart,
}: ProductDetailModalProps) {
  const backdropElRef = useRef<HTMLDivElement | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  /** Ignore backdrop dismiss briefly so stray pointer events cannot close immediately after mount. */
  const backdropDismissReadyAtRef = useRef(0)
  const [assemblies, setAssemblies] = useState<AssemblyWithName[]>([])
  const [hasBom, setHasBom] = useState(false)
  const [technicalDocs, setTechnicalDocs] = useState<DocumentRow[]>([])
  const [otherDocs, setOtherDocs] = useState<DocumentRow[]>([])
  const [docUrls, setDocUrls] = useState<Record<string, string>>({})
  const [loadingAssemblies, setLoadingAssemblies] = useState(true)
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)

  const category = categories.find((c) => c.id === product.category_id)
  const availability = getProductAvailabilityMeta(product)
  const options = (product.options as Record<string, unknown>) ?? {}
  const allOptionsList = Object.entries(options).filter(
    ([k, v]) => k !== 'components' && v != null && String(v).trim() !== ''
  ) as [string, string][]
  const optionsList = allOptionsList.filter(([k]) => !MEASUREMENT_KEYS.has(k) && !isInternalPricelistKey(k))
  const measurementsList = allOptionsList.filter(([k]) => MEASUREMENT_KEYS.has(k))
  const componentsFromOptions = Array.isArray(options.components)
    ? (options.components as string[])
    : typeof options.components === 'string'
      ? [options.components]
      : []
  const relatedProducts = allProducts
    .filter((p) => p.id !== product.id && p.category_id === product.category_id)
    .slice(0, 6)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingAssemblies(true)
      const bom = await fetchProductAssemblyBom(product.id)
      if (cancelled) return
      if (bom && bom.assembly_lines.length > 0) {
        setHasBom(true)
        setAssemblies([])
      } else {
        setHasBom(false)
        const usedIn = await fetchAssembliesUsingComponent(product.id)
        if (!cancelled) setAssemblies(usedIn)
      }
      if (!cancelled) setLoadingAssemblies(false)
    }
    load()
    return () => { cancelled = true }
  }, [product.id])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingDocs(true)
      const [
        { data: technical },
        { data: brochureOther },
      ] = await Promise.all([
        supabase.from('documents').select('*').eq('category', 'technical').order('title'),
        supabase.from('documents').select('*').in('category', ['brochure', 'other']).order('title'),
      ])
      const techList = (technical ?? []) as DocumentRow[]
      const otherList = (brochureOther ?? []) as DocumentRow[]
      if (!cancelled) {
        setTechnicalDocs(techList)
        setOtherDocs(otherList)
        const allDocs = [...techList, ...otherList]
        const urlMap = await getDocumentUrls(allDocs)
        if (!cancelled) setDocUrls(urlMap)
      }
      setLoadingDocs(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  function getDocUrl(row: DocumentRow) {
    if (docUrls[row.id]) return docUrls[row.id]
    if (row.file_path.startsWith('http')) return row.file_path
    return supabase.storage.from('documents').getPublicUrl(row.file_path).data.publicUrl
  }

  useLayoutEffect(() => {
    // Long window + mousedown suppression: opening click/pointer can otherwise land on the backdrop as a ghost click.
    backdropDismissReadyAtRef.current = performance.now() + 750
  }, [])

  useEffect(() => {
    returnFocusRef.current = (document.activeElement as HTMLElement | null) ?? null
    window.setTimeout(() => closeBtnRef.current?.focus(), 0)

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!e.repeat) onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const root = modalRef.current
      if (!root) return
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.tabIndex !== -1)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (!active || active === first || !root.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
      // Defer: avoids Strict Mode double-mount + focus churn firing odd follow-up activation in some browsers.
      window.requestAnimationFrame(() => {
        returnFocusRef.current?.focus?.()
      })
    }
  }, [])

  useEffect(() => {
    setQuantity(1)
    setAdding(false)
  }, [product.id])

  const modalTitleId = useMemo(() => `product-modal-title-${product.id}`, [product.id])

  async function handleAdd() {
    if (!onAddToCart) return
    if (adding) return
    const qty = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1
    setAdding(true)
    try {
      await onAddToCart(product, qty)
      onClose()
    } finally {
      setAdding(false)
    }
  }

  function shouldIgnoreBackdropDismiss(): boolean {
    return performance.now() < backdropDismissReadyAtRef.current
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    if (shouldIgnoreBackdropDismiss()) return
    onCloseRef.current()
  }

  const modalTree = (
    <div
      ref={backdropElRef}
      className="product-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      onClick={handleBackdropClick}
    >
      <div className="product-modal card" ref={modalRef}>
        <button
          type="button"
          className="product-modal-close"
          onClick={onClose}
          aria-label="Close"
          ref={closeBtnRef}
        >
          ×
        </button>
        <div className="product-modal-layout">
          <div className="product-modal-media">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.image_alt ?? product.name ?? ''}
                className="product-modal-image"
              />
            ) : (
              <div className="product-modal-placeholder">No image</div>
            )}
          </div>
          <div className="product-modal-body">
            <h2 id={modalTitleId} className="product-modal-title">
              {product.name}
            </h2>

            {/* Product details overview – always visible */}
            <dl className="product-modal-details">
              <dt>SKU</dt>
              <dd>{product.sku ?? '—'}</dd>
              <dt>Range</dt>
              <dd>{category?.name ?? '—'}</dd>
              <dt>Availability</dt>
              <dd title={availability.detail ?? availability.label}>{availability.label}</dd>
              <dt>Price ex VAT</dt>
              <dd>£{Number(product.unit_price).toFixed(2)}</dd>
              <dt>Price inc VAT</dt>
              <dd>£{(Number(product.unit_price) * VAT_RATE).toFixed(2)}</dd>
            </dl>

            {/* Description – section always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">Description</h3>
              {product.description ? (
                <p className="product-modal-desc">{product.description}</p>
              ) : (
                <p className="product-modal-muted">No description.</p>
              )}
            </section>

            {/* Specification – always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">Specification</h3>
              {optionsList.length > 0 ? (
                <ul className="product-modal-spec-list">
                  {optionsList.map(([key, value]) => (
                    <li key={key}>
                      <strong>{OPTION_LABELS[key] ?? key}:</strong> {String(value)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="product-modal-muted">No specification.</p>
              )}
            </section>

            {/* Measurements – always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">Measurements</h3>
              {measurementsList.length > 0 ? (
                <ul className="product-modal-spec-list">
                  {measurementsList.map(([key, value]) => (
                    <li key={key}>
                      <strong>{OPTION_LABELS[key] ?? key}:</strong> {String(value)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="product-modal-muted">No measurements.</p>
              )}
            </section>

            {/* Complete unit make-up / component usage */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">
                {hasBom
                  ? 'Complete unit make-up'
                  : componentsFromOptions.length > 0
                    ? 'Components included'
                    : 'Used in complete units'}
              </h3>
              {hasBom ? (
                <ProductAssemblyBreakdown productId={product.id} />
              ) : componentsFromOptions.length > 0 ? (
                <ul className="product-modal-list">
                  {componentsFromOptions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : loadingAssemblies ? (
                <p className="product-modal-muted">Loading…</p>
              ) : assemblies.length > 0 ? (
                <ul className="product-modal-list">
                  {assemblies.map((a) => (
                    <li key={a.id}>{a.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="product-modal-muted">—</p>
              )}
            </section>

            {/* Related products – always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">Related products</h3>
              {relatedProducts.length > 0 ? (
                <>
                  <ul className="product-modal-related">
                    {relatedProducts.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="product-modal-related-link"
                          onClick={() => onSelectProduct?.(p)}
                        >
                          {p.name}
                          {p.sku && ` (${p.sku})`}
                        </button>
                        <span className="product-modal-related-price">£{Number(p.unit_price).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/products"
                    state={category ? { categoryId: category.id } : undefined}
                    className="product-modal-link"
                  >
                    View all in {category?.name ?? 'this range'} →
                  </Link>
                </>
              ) : (
                <p className="product-modal-muted">None in this range.</p>
              )}
            </section>

            {/* Product guides – always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">Product guides</h3>
              {loadingDocs ? (
                <p className="product-modal-muted">Loading…</p>
              ) : technicalDocs.length > 0 ? (
                <ul className="product-modal-docs">
                  {technicalDocs.map((doc) => (
                    <li key={doc.id}>
                      <a
                        href={getDocUrl(doc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="product-modal-doc-link"
                      >
                        {doc.title}
                      </a>
                      {doc.description && (
                        <span className="product-modal-doc-desc">{doc.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="product-modal-muted">No product guides uploaded yet.</p>
              )}
            </section>

            {/* Documentation – always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">Documentation</h3>
              {loadingDocs ? (
                <p className="product-modal-muted">Loading…</p>
              ) : otherDocs.length > 0 ? (
                <ul className="product-modal-docs">
                  {otherDocs.map((doc) => (
                    <li key={doc.id}>
                      <a
                        href={getDocUrl(doc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="product-modal-doc-link"
                      >
                        {doc.title}
                      </a>
                      {doc.description && (
                        <span className="product-modal-doc-desc">{doc.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="product-modal-muted">No product documentation in this view.</p>
              )}
              <Link to="/downloads" className="product-modal-link">
                View all downloads →
              </Link>
            </section>

            <div className="product-modal-actions">
              {onAddToCart ? (
                <div className="product-modal-actions-row">
                  <label className="product-modal-qty">
                    Qty
                    <select
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      disabled={adding}
                      aria-label="Quantity"
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="btn btn-success" onClick={handleAdd} disabled={adding}>
                    {adding ? 'Adding…' : 'Add to cart'}
                  </button>
                  <Link to="/ordering/cart" className="btn btn-outline" onClick={onClose}>
                    View cart →
                  </Link>
                </div>
              ) : (
                <Link to="/ordering" className="btn">
                  Add to order
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalTree, document.body)
}
