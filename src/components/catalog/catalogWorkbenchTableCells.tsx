import type { ReactNode } from 'react'
import type { ProductRow } from '@/types/database'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import {
  displayProductCode,
  formatProductDimensions,
  getDoorRange,
  getPropertiesRows,
  getSpecificationBullets,
  getTradeCode,
} from '@/lib/catalogProductDisplay'

export interface WorkbenchTableRowContext {
  product: ProductRow
  rangeName?: string
  sell: number
  visibleColumnIds: Set<string>
  categoryLabel?: string
}

export function renderWorkbenchProductCell(
  colId: string,
  ctx: WorkbenchTableRowContext,
): ReactNode {
  const { product, rangeName, sell, visibleColumnIds, categoryLabel } = ctx
  const availability = getProductAvailabilityMeta(product)
  const showNameInDesc = !visibleColumnIds.has('name')
  const showSkuInDesc =
    !visibleColumnIds.has('sku') &&
    Boolean(product.sku && product.sku !== displayProductCode(product))
  const showAvailInDesc = !visibleColumnIds.has('availability')

  switch (colId) {
    case 'image':
      return product.image_url ? (
        <img src={product.image_url} alt="" className="tb-thumb" loading="lazy" />
      ) : (
        <span className="tb-thumb tb-thumb--empty">—</span>
      )
    case 'code':
      return (
        <>
          <span className="tb-code">{displayProductCode(product)}</span>
          {rangeName && !visibleColumnIds.has('category') && (
            <span className="tb-label-tag">{rangeName}</span>
          )}
        </>
      )
    case 'name':
      return <span className="tb-cell-clip tb-desc-name">{product.name}</span>
    case 'sku':
      return product.sku ? (
        <span className="tb-cell-clip">{product.sku}</span>
      ) : (
        <span className="tb-muted">—</span>
      )
    case 'trade_code': {
      const trade = getTradeCode(product)
      return trade ? <span className="tb-cell-clip">{trade}</span> : <span className="tb-muted">—</span>
    }
    case 'category':
      return categoryLabel ? (
        <span className="tb-cell-clip">{categoryLabel}</span>
      ) : (
        <span className="tb-muted">—</span>
      )
    case 'door_range': {
      const door = getDoorRange(product)
      return door ? <span className="tb-cell-clip">{door}</span> : <span className="tb-muted">—</span>
    }
    case 'description':
      return (
        <>
          {showNameInDesc && <span className="tb-cell-clip tb-desc-name">{product.name}</span>}
          {showSkuInDesc && <span className="tb-cell-clip tb-desc-sku">SKU {product.sku}</span>}
          {product.description && (
            <span className="tb-cell-clip tb-desc-body">{product.description}</span>
          )}
          {showAvailInDesc && (
            <span className="tb-cell-clip tb-avail" title={availability.detail ?? availability.label}>
              {availability.label}
            </span>
          )}
        </>
      )
    case 'dimensions': {
      const dims = formatProductDimensions(product)
      return dims ? <span className="tb-cell-clip">{dims}</span> : <span className="tb-muted">—</span>
    }
    case 'availability':
      return (
        <span className="tb-cell-clip tb-avail" title={availability.detail ?? availability.label}>
          {availability.label}
        </span>
      )
    case 'stock':
      return <span className="tb-cell-clip">{product.stock_quantity ?? 0}</span>
    case 'catalogue':
      return (
        <span className="tb-cell-clip">
          {product.catalog_program === CATALOG_PROGRAM.TEALBURY ? 'Tealbury' : 'Lamtek'}
        </span>
      )
    case 'spec': {
      const specs = getSpecificationBullets(product)
      return (
        <ul className="tb-cell-list">
          {specs.length === 0 ? (
            <li className="tb-muted">—</li>
          ) : (
            specs.map((line) => (
              <li key={line} className="tb-cell-clip">
                {line}
              </li>
            ))
          )}
        </ul>
      )
    }
    case 'props': {
      const props = getPropertiesRows(product)
      return (
        <ul className="tb-cell-list">
          {props.length === 0 ? (
            <li className="tb-muted">—</li>
          ) : (
            props.map((row) => (
              <li key={`${row.label}-${row.value}`} className="tb-cell-clip">
                <span className="tb-muted">{row.label}:</span> {row.value}
              </li>
            ))
          )}
        </ul>
      )
    }
    case 'price':
      return (
        <div className="tb-price-cell">
          <strong>£{sell.toFixed(2)}</strong>
          <span className="tb-muted"> ex VAT</span>
          {sell < Number(product.unit_price) && (
            <span className="tb-muted tb-price-was"> was £{Number(product.unit_price).toFixed(2)}</span>
          )}
        </div>
      )
    default:
      return null
  }
}
