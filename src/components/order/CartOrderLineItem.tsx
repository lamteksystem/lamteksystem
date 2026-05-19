import { useEffect, useState } from 'react'
import { loadOrderLineBreakdown, type OrderLineComponentRow } from '@/lib/orderLineBreakdown'

export interface CartOrderLineData {
  id: string
  quantity: number
  unit_price: number
  product_id?: string | null
  product_snapshot: {
    name?: string
    sku?: string
    image_url?: string
  }
  options?: Record<string, unknown>
}

interface CartOrderLineItemProps {
  line: CartOrderLineData
  qtyDraft: string
  onQtyDraftChange: (value: string) => void
  onQtyBlur: () => void
  onDecrease: () => void
  onIncrease: () => void
  onRemove: () => void
}

export default function CartOrderLineItem({
  line,
  qtyDraft,
  onQtyDraftChange,
  onQtyBlur,
  onDecrease,
  onIncrease,
  onRemove,
}: CartOrderLineItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [parts, setParts] = useState<OrderLineComponentRow[]>([])
  const [partsSource, setPartsSource] = useState<'bom' | 'options' | 'single'>('single')
  const [partsLoading, setPartsLoading] = useState(false)

  useEffect(() => {
    if (!expanded) return
    let cancelled = false
    setPartsLoading(true)
    void loadOrderLineBreakdown(line.product_id ?? null, line.options ?? {}).then((result) => {
      if (cancelled) return
      setParts(result.rows)
      setPartsSource(result.source)
      setPartsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [expanded, line.id, line.product_id, line.options])

  const name = line.product_snapshot.name ?? 'Product'
  const sku = line.product_snapshot.sku

  return (
    <li className={`cart-line${expanded ? ' cart-line--expanded' : ''}`}>
      <button
        type="button"
        className="cart-line-expand-trigger"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="cart-line-expand-icon" aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
        <div className="cart-line-media">
          {line.product_snapshot.image_url ? (
            <img src={line.product_snapshot.image_url} alt="" />
          ) : (
            <div className="cart-line-placeholder">—</div>
          )}
        </div>
        <div className="cart-line-info">
          <span className="cart-line-name">{name}</span>
          {sku ? <span className="cart-line-sku">SKU: {sku}</span> : null}
          <span className="cart-line-unit">£{Number(line.unit_price).toFixed(2)} each</span>
        </div>
        <span className="cart-line-total-preview">
          £{(line.quantity * Number(line.unit_price)).toFixed(2)}
        </span>
      </button>

      <div className="cart-line-controls">
        <div className="cart-line-qty">
          <button type="button" className="btn btn-icon" onClick={onDecrease} aria-label="Decrease quantity">
            −
          </button>
          <input
            className="cart-line-qty-input"
            inputMode="numeric"
            aria-label="Quantity"
            value={qtyDraft}
            onChange={(e) => {
              const v = e.target.value
              if (v === '' || /^[0-9]+$/.test(v)) onQtyDraftChange(v)
            }}
            onBlur={onQtyBlur}
          />
          <button type="button" className="btn btn-icon" onClick={onIncrease} aria-label="Increase quantity">
            +
          </button>
        </div>
        <button
          type="button"
          className="btn btn-icon cart-line-remove"
          onClick={onRemove}
          aria-label="Remove line"
          title="Remove"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="cart-line-breakdown">
          {partsLoading ? (
            <p className="admin-muted">Loading parts…</p>
          ) : partsSource === 'single' || parts.length === 0 ? (
            <p className="admin-muted">This line is a single catalogue product (no component list).</p>
          ) : (
            <ul className="cart-line-parts">
              {parts.map((part, idx) => (
                <li key={`${part.label}-${part.sku ?? idx}`}>
                  <span className="cart-line-part-name">{part.label}</span>
                  {part.sku ? <code className="cart-line-part-sku">{part.sku}</code> : null}
                  {part.quantity != null ? (
                    <span className="cart-line-part-qty">× {part.quantity}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}
