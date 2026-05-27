import type { WorkbenchWarning } from '@/lib/pricelistWorkbenchWarnings'

type Props = {
  warnings: WorkbenchWarning[]
}

export default function PricelistWorkbenchWarningsPanel({ warnings }: Props) {
  if (!warnings.length) return null

  const duplicates = warnings.filter((w) => w.type === 'duplicate_sku_merged')
  const skipped = warnings.filter((w) => w.type === 'sheet_skipped')
  const generic = warnings.filter((w) => w.type === 'generic')

  return (
    <div className="admin-pricelist-warnings-detail">
      {skipped.map((w, i) =>
        w.type === 'sheet_skipped' ? (
          <div key={`skip-${i}`} className="admin-callout admin-callout--info">
            <strong>Sheet “{w.sheet}” was not imported as product rows.</strong>
            <p>
              That sheet is a <strong>door-range selector</strong> (Excel formulas such as INDIRECT/VLOOKUP) that
              points at the real price tables on other tabs (No Doors, Dawson, Oakham, …).
            </p>
            <p>
              <strong>You are not missing prices:</strong> static prices were loaded from those per-range sheets
              instead. Re-importing the hub sheet would only duplicate or confuse SKUs. If a door range tab is missing
              from the workbook, add that sheet in Excel — the hub alone cannot supply prices.
            </p>
          </div>
        ) : null,
      )}

      {duplicates.length > 0 && (
        <div className="admin-callout admin-callout--warn">
          <strong>
            {duplicates.length} duplicate SKU{duplicates.length === 1 ? '' : 's'} merged during Lamtek import
          </strong>
          <p>
            The same trade code appeared more than once (often kitchen + bedroom sections, or multiple finish columns on
            one line). The importer kept <strong>one workbench row per SKU</strong> and combined descriptions; the
            <strong> lowest price</strong> was kept. That is usually correct for Lamtek — you do not need two separate
            products with code <code>CPL</code>, for example.
          </p>
          <details className="admin-pricelist-warnings-details">
            <summary>View merged SKUs ({duplicates.length})</summary>
            <ul className="admin-pricelist-warnings-list">
              {duplicates.slice(0, 40).map((w) =>
                w.type === 'duplicate_sku_merged' ? (
                  <li key={w.sku}>
                    <code>{w.sku}</code>
                    {w.mergedCount > 1 ? ` — ${w.mergedCount + 1} lines combined` : ''}
                    {w.keptName ? ` · kept: ${w.keptName.slice(0, 60)}` : ''}
                  </li>
                ) : null,
              )}
            </ul>
            {duplicates.length > 40 ? (
              <p className="admin-muted">…and {duplicates.length - 40} more.</p>
            ) : null}
          </details>
        </div>
      )}

      {generic.length > 0 && (
        <details className="admin-pricelist-warnings-details">
          <summary>Other notices ({generic.length})</summary>
          <ul className="admin-pricelist-warnings-list">
            {generic.map((w, i) => (
              <li key={i}>{w.type === 'generic' ? w.message : ''}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
