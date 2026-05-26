import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { WorkbenchOrderLine } from '@/hooks/useWorkbenchOrderLines'
import { loadOrderLineBreakdown, type OrderLineComponentRow } from '@/lib/orderLineBreakdown'

interface CatalogOrderLinesPanelProps {
  lines: WorkbenchOrderLine[]
  loading?: boolean
  cartHref?: string
  onQuantityChange?: (lineId: string, quantity: number) => void
  onRemoveLine?: (lineId: string) => void
  /** Disables controls while a line update is in flight. */
  mutatingLineId?: string | null
}

function lineTitle(line: WorkbenchOrderLine): string {
  return line.product_snapshot.name ?? 'Product'
}

function lineCode(line: WorkbenchOrderLine): string {
  return line.product_snapshot.sku ?? '—'
}

function LineBreakdown({ line }: { line: WorkbenchOrderLine }) {
  const [rows, setRows] = useState<OrderLineComponentRow[]>([])
  const [source, setSource] = useState<'bom' | 'options' | 'single'>('single')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void loadOrderLineBreakdown(line.product_id, line.options).then((result) => {
      if (cancelled) return
      setRows(result.rows)
      setSource(result.source)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [line.id, line.product_id, line.options])

  if (loading) {
    return <p className="tb-order-line-breakdown tb-muted">Loading parts…</p>
  }
  if (source === 'single' || rows.length === 0) {
    return <p className="tb-order-line-breakdown tb-muted">Single catalogue line (no component breakdown).</p>
  }
  return (
    <ul className="tb-order-line-parts">
      {rows.map((row, idx) => (
        <li key={`${row.label}-${row.sku ?? idx}`}>
          <span className="tb-order-line-part-name">{row.label}</span>
          {row.sku ? <span className="tb-order-line-part-sku">{row.sku}</span> : null}
          {row.quantity != null ? (
            <span className="tb-order-line-part-qty">× {row.quantity}</span>
          ) : null}
          {row.detail ? <span className="tb-order-line-part-role">{row.detail}</span> : null}
        </li>
      ))}
    </ul>
  )
}

export default function CatalogOrderLinesPanel({
  lines,
  loading = false,
  cartHref = '',
  onQuantityChange,
  onRemoveLine,
  mutatingLineId = null,
}: CatalogOrderLinesPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const totalExVat = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
  const canEditLines = Boolean(onQuantityChange && onRemoveLine)

  return (
    <section className="tb-order-lines" aria-label="Lines on order">
      <header className="tb-basket-header">
        <h3>On order</h3>
        <span className="tb-basket-count">
          {lines.length} line{lines.length === 1 ? '' : 's'}
        </span>
      </header>

      {loading && lines.length === 0 ? (
        <p className="tb-basket-empty">Loading order lines…</p>
      ) : lines.length === 0 ? (
        <p className="tb-basket-empty">No lines yet. Add products from the table or detail panel.</p>
      ) : (
        <ul className="tb-order-lines-list">
          {lines.map((line) => {
            const expanded = expandedId === line.id
            const lineBusy = mutatingLineId === line.id
            const lineTotal = line.quantity * line.unit_price
            return (
              <li key={line.id} className={`tb-order-line${expanded ? ' tb-order-line--expanded' : ''}`}>
                <div className="tb-order-line-header">
                  <button
                    type="button"
                    className="tb-order-line-expand"
                    onClick={() => setExpandedId((prev) => (prev === line.id ? null : line.id))}
                    aria-expanded={expanded}
                    aria-label={expanded ? 'Collapse line details' : 'Expand line details'}
                  >
                    <span className="tb-order-line-chevron" aria-hidden>
                      {expanded ? '▾' : '▸'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="tb-order-line-summary"
                    onClick={() => setExpandedId((prev) => (prev === line.id ? null : line.id))}
                  >
                    <span className="tb-order-line-main">
                      <span className="tb-basket-line-code">{lineCode(line)}</span>
                      <span className="tb-basket-line-name" title={lineTitle(line)}>
                        {lineTitle(line)}
                      </span>
                    </span>
                  </button>
                  {canEditLines ? (
                    <div
                      className="tb-order-line-actions"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <div className="qty-stepper qty-stepper--compact">
                        <button
                          type="button"
                          className="qty-stepper-btn"
                          aria-label="Decrease quantity"
                          disabled={lineBusy}
                          onClick={() =>
                            onQuantityChange!(
                              line.id,
                              line.quantity <= 1 ? 0 : line.quantity - 1,
                            )
                          }
                        >
                          −
                        </button>
                        <input
                          className="qty-stepper-input"
                          inputMode="numeric"
                          value={line.quantity}
                          disabled={lineBusy}
                          aria-label={`Quantity for ${lineTitle(line)}`}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            onQuantityChange!(
                              line.id,
                              Number.isFinite(n) && n > 0 ? Math.floor(n) : 1,
                            )
                          }}
                        />
                        <button
                          type="button"
                          className="qty-stepper-btn"
                          aria-label="Increase quantity"
                          disabled={lineBusy}
                          onClick={() =>
                            onQuantityChange!(line.id, Math.min(99, line.quantity + 1))
                          }
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="tb-basket-remove"
                        disabled={lineBusy}
                        aria-label={`Remove ${lineTitle(line)}`}
                        onClick={() => onRemoveLine!(line.id)}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <span className="tb-order-line-meta">
                      <span className="tb-order-line-qty">× {line.quantity}</span>
                    </span>
                  )}
                  <span className="tb-order-line-price">£{lineTotal.toFixed(2)}</span>
                </div>
                {expanded && (
                  <div className="tb-order-line-detail">
                    <LineBreakdown line={line} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {lines.length > 0 && (
        <footer className="tb-order-lines-footer">
          <div className="tb-basket-total">
            <span>Total ex VAT</span>
            <strong>£{totalExVat.toFixed(2)}</strong>
          </div>
          {cartHref ? (
            <Link to={cartHref} className="btn btn-small btn-block">
              Review in cart →
            </Link>
          ) : null}
        </footer>
      )}
    </section>
  )
}
