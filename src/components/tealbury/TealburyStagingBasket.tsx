import type { ProductRow } from '@/types/database'
import { displayProductCode } from '@/lib/tealburyProductDisplay'

export interface StagedLine {
  product: ProductRow
  quantity: number
}

interface TealburyStagingBasketProps {
  lines: StagedLine[]
  onQuantityChange: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
  onClear: () => void
  onCommit: () => void
  committing: boolean
}

export default function TealburyStagingBasket({
  lines,
  onQuantityChange,
  onRemove,
  onClear,
  onCommit,
  committing,
}: TealburyStagingBasketProps) {
  const totalExVat = lines.reduce((sum, l) => sum + Number(l.product.unit_price) * l.quantity, 0)

  return (
    <section className="tb-basket" aria-label="Selection basket">
      <header className="tb-basket-header">
        <h3>Basket</h3>
        <span className="tb-basket-count">{lines.length} line{lines.length === 1 ? '' : 's'}</span>
      </header>

      {lines.length === 0 ? (
        <p className="tb-basket-empty">
          Add products from the list or detail panel. Lines stay here until you add them to your order.
        </p>
      ) : (
        <ul className="tb-basket-lines">
          {lines.map((line) => (
            <li key={line.product.id} className="tb-basket-line">
              <div className="tb-basket-line-main">
                <span className="tb-basket-line-code">{displayProductCode(line.product)}</span>
                <span className="tb-basket-line-name" title={line.product.name ?? ''}>
                  {line.product.name}
                </span>
              </div>
              <div className="tb-basket-line-actions">
                <div className="qty-stepper qty-stepper--compact">
                  <button
                    type="button"
                    className="qty-stepper-btn"
                    aria-label="Decrease quantity"
                    onClick={() => onQuantityChange(line.product.id, Math.max(1, line.quantity - 1))}
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
                      onQuantityChange(
                        line.product.id,
                        Number.isFinite(n) && n > 0 ? Math.floor(n) : 1,
                      )
                    }}
                    disabled={committing}
                    aria-label="Quantity"
                  />
                  <button
                    type="button"
                    className="qty-stepper-btn"
                    aria-label="Increase quantity"
                    onClick={() => onQuantityChange(line.product.id, Math.min(99, line.quantity + 1))}
                    disabled={committing}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="tb-basket-remove"
                  onClick={() => onRemove(line.product.id)}
                  disabled={committing}
                  aria-label={`Remove ${line.product.name}`}
                >
                  ×
                </button>
              </div>
              <span className="tb-basket-line-price">
                £{(Number(line.product.unit_price) * line.quantity).toFixed(2)} ex VAT
              </span>
            </li>
          ))}
        </ul>
      )}

      <footer className="tb-basket-footer">
        <div className="tb-basket-total">
          <span>Total ex VAT</span>
          <strong>£{totalExVat.toFixed(2)}</strong>
        </div>
        <p className="tb-basket-vat-note">All prices exclude VAT.</p>
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
            {committing ? 'Adding…' : 'Add to order'}
          </button>
        </div>
      </footer>
    </section>
  )
}
