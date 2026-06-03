import { useMemo } from 'react'
import {
  applyHingeBrandToDraftBom,
  buildDraftComponentPool,
  getWorkbenchBom,
  roleLabel,
  type WorkbenchBom,
} from '@/lib/workbenchBom'
import { HINGE_BRAND_OPTIONS, type HingeBrand } from '@/lib/tealburyOrderSetup'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'

interface WorkbenchBomBreakdownProps {
  row: PricelistWorkbenchRow
  /** Full draft — used for hinge-brand preview swap. */
  allRows: PricelistWorkbenchRow[]
  /** Preview hinges as if the order used this brand (Titus / Hafele / Blum). */
  hingeBrandPreview?: HingeBrand | null
  compact?: boolean
  className?: string
}

export default function WorkbenchBomBreakdown({
  row,
  allRows,
  hingeBrandPreview = null,
  compact,
  className,
}: WorkbenchBomBreakdownProps) {
  const baseBom = getWorkbenchBom(row)
  const displayBom: WorkbenchBom | null = useMemo(() => {
    if (!baseBom) return null
    if (!hingeBrandPreview) return baseBom
    const pool = buildDraftComponentPool(allRows)
    return applyHingeBrandToDraftBom(baseBom, hingeBrandPreview, pool)
  }, [baseBom, hingeBrandPreview, allRows])

  if (!displayBom || displayBom.lines.length === 0) {
    return (
      <p className={`admin-muted workbench-bom-breakdown ${className ?? ''}`.trim()}>
        No component breakdown computed yet. Use &ldquo;Compute BOM in draft&rdquo; on this row or from
        catalogue setup.
      </p>
    )
  }

  const widthMm = row.options?.tealbury_dims_mm as { w?: string } | undefined
  const wLabel = widthMm?.w ? `${widthMm.w}mm unit` : null

  return (
    <div
      className={`workbench-bom-breakdown${compact ? ' workbench-bom-breakdown--compact' : ''}${className ? ` ${className}` : ''}`}
    >
      <p className="workbench-bom-breakdown-intro">
        Draft make-up{wLabel ? ` (${wLabel})` : ''}
        {displayBom.templateId ? ` · template ${displayBom.templateId}` : ''}
        {hingeBrandPreview ? ` · hinges shown as ${hingeBrandPreview}` : ''}. Stored in the workbench
        until you publish; order setup can still swap hinge brand at quote time.
      </p>
      {displayBom.warnings.length > 0 && (
        <ul className="admin-muted workbench-bom-breakdown-warnings">
          {displayBom.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <table className="product-assembly-breakdown-table">
        <thead>
          <tr>
            <th>Part</th>
            <th>Product</th>
            <th>SKU</th>
            <th>Qty</th>
            {!compact && <th>List £</th>}
          </tr>
        </thead>
        <tbody>
          {displayBom.lines.map((line, i) => (
            <tr key={`${line.component_sku}-${i}`}>
              <td>{roleLabel(line.component_role)}</td>
              <td>{line.name ?? '—'}</td>
              <td>
                <code>{line.component_sku}</code>
              </td>
              <td>{line.quantity}</td>
              {!compact && (
                <td>{line.unit_price != null ? `£${line.unit_price.toFixed(2)}` : '—'}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function HingeBrandPreviewSelect({
  value,
  onChange,
}: {
  value: HingeBrand | null
  onChange: (v: HingeBrand | null) => void
}) {
  return (
    <label className="admin-hinge-preview-select">
      <span className="admin-muted">Preview hinge brand</span>
      <select
        className="admin-input"
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value as HingeBrand) || null)}
      >
        <option value="">(as computed)</option>
        {HINGE_BRAND_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
