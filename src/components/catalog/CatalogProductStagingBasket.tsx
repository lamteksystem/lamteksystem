import { Link } from 'react-router-dom'
import type { AssemblyWithLines, ProductRow } from '@/types/database'
import { displayProductCode } from '@/lib/catalogProductDisplay'
import type { CatalogLinePersistence } from '@/components/catalog/CatalogProductWorkbench'

export type StagedCatalogLine =
  | { kind: 'product'; id: string; product: ProductRow; quantity: number; unitPrice: number }
  | { kind: 'assembly'; id: string; assembly: AssemblyWithLines; quantity: number; unitPrice: number }

interface CatalogProductStagingBasketProps {
  lines: StagedCatalogLine[]
  linePersistence?: CatalogLinePersistence
  cartLineCount?: number
  cartHref?: string
  commitLabel?: string
  onQuantityChange: (lineId: string, quantity: number) => void
  onRemove: (lineId: string) => void
  onClear: () => void
  onCommit: () => void
  committing: boolean
}

function lineLabel(line: StagedCatalogLine): string {
  if (line.kind === 'product') return line.product.name ?? ''
  return line.assembly.name ?? 'Complete unit'
}

function lineCode(line: StagedCatalogLine): string {
  if (line.kind === 'product') return displayProductCode(line.product)
  return line.assembly.name ?? 'Unit'
}

export default function CatalogProductStagingBasket({
  lines,
  linePersistence = 'staged',
  cartLineCount = 0,
  cartHref = '',
  commitLabel = 'Add to order',
  onQuantityChange,
  onRemove,
  onClear,
  onCommit,
  committing,
}: CatalogProductStagingBasketProps) {
  const totalExVat = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  const immediate = linePersistence === 'immediate'

  return (
    <section className="tb-basket" aria-label="Selection basket">
      <header className="tb-basket-header">
        <h3>{immediate ? 'On order' : 'Selection'}</h3>
        <span className="tb-basket-count">
          {immediate ? cartLineCount : lines.length} line
          {(immediate ? cartLineCount : lines.length) === 1 ? '' : 's'}
        </span>
      </header>

      {immediate ? (
        <div className="tb-basket-immediate">
          <p className="tb-basket-empty">
            Lines save to your order as you add them from the table or detail panel.
          </p>
          {cartLineCount > 0 && cartHref ? (
            <Link to={cartHref} className="btn btn-small">
              View order ({cartLineCount}) →
            </Link>
          ) : (
            <p className="tb-basket-vat-note">No lines on this order yet.</p>
          )}
        </div>
      ) : lines.length === 0 ? (
        <p className="tb-basket-empty">
          Add products from the list or detail panel, then confirm below to save to your order.
        </p>
      ) : (
        <ul className="tb-basket-lines">
          {lines.map((line) => (
            <li key={line.id} className="tb-basket-line">
              <div className="tb-basket-line-main">
                <span className="tb-basket-line-code">{lineCode(line)}</span>
                <span className="tb-basket-line-name" title={lineLabel(line)}>
                  {lineLabel(line)}
                  {line.kind === 'assembly' ? ' (complete unit)' : ''}
                </span>
              </div>
              <div className="tb-basket-line-actions">
                <div className="qty-stepper qty-stepper--compact">
                  <button
                    type="button"
                    className="qty-stepper-btn"
                    aria-label="Decrease quantity"
                    onClick={() => onQuantityChange(line.id, Math.max(1, line.quantity - 1))}
                    disabled={committing}
                  >
                    −
                  </button>
                  <input
                    className="qty-stepper-input"
                    inputMode="numeric"
                    value={line.quantity}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      onQuantityChange(line.id, Number.isFinite(n) && n > 0 ? Math.floor(n) : 1)
                    }}
                    disabled={committing}
                    aria-label="Quantity"
                  />
                  <button
                    type="button"
                    className="qty-stepper-btn"
                    aria-label="Increase quantity"
                    onClick={() => onQuantityChange(line.id, Math.min(99, line.quantity + 1))}
                    disabled={committing}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="tb-basket-remove"
                  onClick={() => onRemove(line.id)}
                  disabled={committing}
                  aria-label={`Remove ${lineLabel(line)}`}
                >
                  ×
                </button>
              </div>
              <span className="tb-basket-line-price">£{(line.unitPrice * line.quantity).toFixed(2)} ex VAT</span>
            </li>
          ))}
        </ul>
      )}

      {!immediate && (
      <footer className="tb-basket-footer">
        <div className="tb-basket-total">
          <span>Selection total ex VAT</span>
          <strong>£{totalExVat.toFixed(2)}</strong>
        </div>
        <p className="tb-basket-vat-note">Confirm to save lines to your order. All prices exclude VAT unless noted.</p>
        <div className="tb-basket-actions">
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={onClear}
            disabled={lines.length === 0 || committing}
          >
            Clear
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={onCommit}
            disabled={lines.length === 0 || committing}
          >
            {committing ? 'Adding…' : commitLabel}
          </button>
        </div>
      </footer>
      )}
    </section>
  )
}
