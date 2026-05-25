import type { ProductRow } from '@/types/database'

type Props = {
  product: ProductRow
  className?: string
}

function marginPct(sell: number, cost: number | null): string | null {
  if (cost == null || sell <= 0) return null
  const m = ((sell - cost) / sell) * 100
  return `${m.toFixed(1)}%`
}

/** Catalogue / cost / sell breakdown (TruBlue-style product economics). */
export default function ProductPricingBreakdown({ product, className }: Props) {
  const sell = Number(product.unit_price ?? 0)
  const cost = product.cost_price != null ? Number(product.cost_price) : null
  const margin = cost != null ? sell - cost : null
  const marginPercent = marginPct(sell, cost)

  return (
    <section className={className ?? 'admin-product-pricing-breakdown card admin-card'}>
      <h3 className="admin-modal-form-section-title">Pricing breakdown</h3>
      <table className="admin-product-pricing-table">
        <tbody>
          <tr className="admin-product-pricing-row--catalogue">
            <th scope="row">Sell price (list)</th>
            <td>£{sell.toFixed(2)}</td>
          </tr>
          <tr className="admin-product-pricing-row--cost">
            <th scope="row">Cost price</th>
            <td>{cost != null ? `£${cost.toFixed(2)}` : '—'}</td>
          </tr>
          <tr className="admin-product-pricing-row--margin">
            <th scope="row">Margin</th>
            <td>
              {margin != null ? (
                <>
                  £{margin.toFixed(2)}
                  {marginPercent ? ` (${marginPercent})` : ''}
                </>
              ) : (
                '—'
              )}
            </td>
          </tr>
          <tr>
            <th scope="row">Stock on hand</th>
            <td>{product.stock_quantity ?? 0}</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}
