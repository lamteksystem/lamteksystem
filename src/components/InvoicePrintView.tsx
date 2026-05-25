import type { OrderRow } from '@/types/database'
import { VAT_RATE } from '@/lib/tax'
import type { QuoteDocumentDisplayOptions } from '@/lib/quoteDocumentDisplay'
import { DEFAULT_QUOTE_DOCUMENT_DISPLAY } from '@/lib/quoteDocumentDisplay'

interface LineItem {
  id: string
  product_snapshot: { name?: string; sku?: string }
  quantity: number
  unit_price: number
  combination_label?: string | null
}

export type InvoicePrintVariant = 'invoice' | 'quote' | 'quote_no_pricing'

interface InvoicePrintViewProps {
  order: OrderRow
  lines: LineItem[]
  companyName: string
  paymentTerms?: string | null
  variant?: InvoicePrintVariant
  display?: Partial<QuoteDocumentDisplayOptions>
}

type LineGroup = { label: string | null; lines: LineItem[] }

function groupLines(lines: LineItem[], showGroups: boolean): LineGroup[] {
  if (!showGroups) return [{ label: null, lines }]
  const map = new Map<string, LineItem[]>()
  const order: string[] = []
  for (const line of lines) {
    const key = line.combination_label?.trim() || ''
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(line)
  }
  return order.map((key) => ({
    label: key || null,
    lines: map.get(key) ?? [],
  }))
}

export default function InvoicePrintView({
  order,
  lines,
  companyName,
  paymentTerms,
  variant = 'invoice',
  display: displayPartial,
}: InvoicePrintViewProps) {
  const display = { ...DEFAULT_QUOTE_DOCUMENT_DISPLAY, ...displayPartial }
  const totalExVat = lines.reduce((s, l) => s + l.quantity * Number(l.unit_price), 0)
  const totalIncVat = totalExVat * VAT_RATE
  const showPricing = variant !== 'quote_no_pricing' && !display.hideUnitPrice
  const showLineTotals = showPricing && !display.hideLineTotals
  const showSku = !display.hideSku
  const showVat = showPricing && !display.hideVatBreakdown
  const showPaymentTerms = display.hidePaymentTerms ? false : !!paymentTerms
  const groups = groupLines(lines, display.showCombinationGroups && variant !== 'invoice')

  const title =
    variant === 'invoice'
      ? 'Invoice'
      : variant === 'quote_no_pricing'
        ? 'Quotation (no pricing)'
        : 'Quotation'

  return (
    <div className={`invoice-print-view invoice-print-view--${variant}`}>
      <header className="invoice-print-header">
        <h1>{title}</h1>
        {variant === 'invoice' && order.invoice_number && (
          <p className="invoice-print-number">{order.invoice_number}</p>
        )}
        <p className="invoice-print-date">Date: {new Date(order.created_at).toLocaleDateString()}</p>
      </header>

      <div className="invoice-print-meta">
        <div className="invoice-print-block">
          <strong>Bill to</strong>
          <p>{companyName}</p>
          {order.delivery_address && (
            <>
              <strong>Delivery address</strong>
              <p>{[order.delivery_address, order.delivery_postcode].filter(Boolean).join(', ')}</p>
            </>
          )}
        </div>
        <div className="invoice-print-block">
          {order.reference && (
            <p>
              <strong>Order reference</strong> {order.reference}
            </p>
          )}
          {showPaymentTerms && paymentTerms && (
            <p>
              <strong>Payment terms</strong> {paymentTerms}
            </p>
          )}
        </div>
      </div>

      {groups.map((group, gi) => (
        <div key={gi} className="invoice-print-line-group">
          {group.label && (
            <h2 className="invoice-print-combination-heading">{group.label}</h2>
          )}
          <table className="invoice-print-table">
            <thead>
              <tr>
                {showSku && <th>Code</th>}
                <th>Description</th>
                <th>Qty</th>
                {showPricing && <th>Unit price</th>}
                {showLineTotals && <th>Total</th>}
              </tr>
            </thead>
            <tbody>
              {group.lines.map((l) => {
                const snap = l.product_snapshot as { name?: string; sku?: string }
                return (
                  <tr key={l.id}>
                    {showSku && <td>{snap?.sku ?? '—'}</td>}
                    <td>{snap?.name ?? 'Product'}</td>
                    <td>{l.quantity}</td>
                    {showPricing && <td>£{Number(l.unit_price).toFixed(2)}</td>}
                    {showLineTotals && (
                      <td>£{(l.quantity * Number(l.unit_price)).toFixed(2)}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {showVat && (
        <div className="invoice-print-totals">
          <p>
            <strong>Subtotal (ex VAT)</strong> £{totalExVat.toFixed(2)}
          </p>
          <p>
            <strong>VAT (20%)</strong> £{(totalIncVat - totalExVat).toFixed(2)}
          </p>
          <p>
            <strong>Total (inc VAT)</strong> £{totalIncVat.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  )
}
