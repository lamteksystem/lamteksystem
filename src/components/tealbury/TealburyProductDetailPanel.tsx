import { useState } from 'react'
import type { CategoryRow, ProductRow } from '@/types/database'
import { VAT_RATE } from '@/lib/tax'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import {
  categoryNameById,
  displayProductCode,
  getTealburyPropertiesRows,
  getTealburySpecificationBullets,
} from '@/lib/tealburyProductDisplay'

interface TealburyProductDetailPanelProps {
  product: ProductRow
  categories: CategoryRow[]
  onClose: () => void
  onAddToBasket: (product: ProductRow, quantity: number) => void
}

export default function TealburyProductDetailPanel({
  product,
  categories,
  onClose,
  onAddToBasket,
}: TealburyProductDetailPanelProps) {
  const [quantity, setQuantity] = useState(1)
  const catMap = categoryNameById(categories)
  const availability = getProductAvailabilityMeta(product)
  const specs = getTealburySpecificationBullets(product)
  const properties = getTealburyPropertiesRows(product)
  const unitPrice = Number(product.unit_price)
  const costPrice = product.cost_price != null ? Number(product.cost_price) : null
  const sellIncVat = unitPrice * VAT_RATE

  return (
    <section className="tb-detail" aria-label="Product details">
      <header className="tb-detail-header">
        <h3>Product details</h3>
        <button type="button" className="tb-detail-close" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </header>

      <div className="tb-detail-body">
        <div className="tb-detail-media">
          {product.image_url ? (
            <img src={product.image_url} alt={product.image_alt ?? product.name ?? ''} />
          ) : (
            <div className="tb-detail-placeholder">No image</div>
          )}
        </div>

        <div className="tb-detail-copy">
          <p className="tb-detail-range">
            {(product.category_id && catMap.get(product.category_id)) ?? 'Tealbury'}
          </p>
          <h4 className="tb-detail-title">{product.name}</h4>
          <p className="tb-detail-code">{displayProductCode(product)}</p>
          <p className="tb-detail-availability" title={availability.detail ?? availability.label}>
            {availability.label}
          </p>

          {specs.length > 0 && (
            <div className="tb-detail-block">
              <h5>Specification</h5>
              <ul className="tb-detail-spec-list">
                {specs.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {properties.length > 0 && (
            <div className="tb-detail-block">
              <h5>Properties</h5>
              <table className="tb-detail-props-table">
                <tbody>
                  {properties.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="tb-detail-pricing">
            <div className="tb-price-row tb-price-row--catalogue">
              <span className="tb-price-label">Catalogue price</span>
              <span className="tb-price-value">£{unitPrice.toFixed(2)} ex VAT</span>
            </div>
            {costPrice != null && (
              <div className="tb-price-row tb-price-row--cost">
                <span className="tb-price-label">Cost price</span>
                <span className="tb-price-value">£{costPrice.toFixed(2)}</span>
              </div>
            )}
            <div className="tb-price-row tb-price-row--sell">
              <span className="tb-price-label">Sell price (inc VAT)</span>
              <span className="tb-price-value">£{sellIncVat.toFixed(2)}</span>
            </div>
          </div>

          <div className="tb-detail-add">
            <label className="tb-detail-qty">
              Qty
              <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-small" onClick={() => onAddToBasket(product, quantity)}>
              Add to basket
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
