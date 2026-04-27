import type { OrderRow } from '@/types/database'
import { VAT_RATE } from '@/lib/tax'

interface LineItem {
  id: string
  product_snapshot: { name?: string; sku?: string }
  quantity: number
  unit_price: number
}

export type InvoicePrintVariant = 'invoice' | 'quote' | 'quote_no_pricing'

interface InvoicePrintViewProps {
  order: OrderRow
  lines: LineItem[]
  companyName: string
  paymentTerms?: string | null
  variant?: InvoicePrintVariant
}

export default function InvoicePrintView({
  order,
  lines,
  companyName,
  paymentTerms,
  variant = 'invoice',
}: InvoicePrintViewProps) {
  const totalExVat = lines.reduce((s, l) => s + l.quantity * Number(l.unit_price), 0)
  const totalIncVat = totalExVat * VAT_RATE
  const showPricing = variant !== 'quote_no_pricing'

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
          {paymentTerms && showPricing && (
            <p>
              <strong>Payment terms</strong> {paymentTerms}
            </p>
          )}
        </div>
      </div>

      <table className="invoice-print-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            {showPricing && (
              <>
                <th>Unit price</th>
                <th>Total</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td>{(l.product_snapshot as { name?: string })?.name ?? 'Product'}</td>
              <td>{l.quantity}</td>
              {showPricing && (
                <>
                  <td>£{Number(l.unit_price).toFixed(2)}</td>
                  <td>£{(l.quantity * Number(l.unit_price)).toFixed(2)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {showPricing && (
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
