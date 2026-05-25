import { useEffect, useState } from 'react'
import {
  DEFAULT_QUOTE_DOCUMENT_DISPLAY,
  loadQuoteDocumentDisplayPrefs,
  mergeQuoteDocumentDisplay,
  quoteDisplayToSearchParams,
  saveQuoteDocumentDisplayPrefs,
  type QuoteDocumentDisplayOptions,
} from '@/lib/quoteDocumentDisplay'

type Props = {
  orderId: string
  basePath: string
  className?: string
}

export default function QuoteDocumentOptionsPanel({ orderId, basePath, className }: Props) {
  const [opts, setOpts] = useState<QuoteDocumentDisplayOptions>(DEFAULT_QUOTE_DOCUMENT_DISPLAY)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void loadQuoteDocumentDisplayPrefs().then((prefs) => {
      setOpts(prefs)
      setLoaded(true)
    })
  }, [])

  function update(patch: Partial<QuoteDocumentDisplayOptions>) {
    setOpts((o) => mergeQuoteDocumentDisplay({ ...o, ...patch }))
    setSaved(false)
  }

  async function saveDefaults() {
    await saveQuoteDocumentDisplayPrefs(opts)
    setSaved(true)
  }

  const qs = quoteDisplayToSearchParams(opts)
  const withPricing = `${basePath}/${orderId}/quote${qs ? `?${qs}` : ''}`
  const noPricing = `${basePath}/${orderId}/quote?mode=no-pricing${qs ? `&${qs}` : ''}`

  if (!loaded) return <p className="admin-muted">Loading quote options…</p>

  return (
    <section className={className ?? 'card admin-card admin-quote-doc-options'}>
      <h3 className="admin-modal-form-section-title">Quote document display</h3>
      <p className="admin-muted admin-quote-doc-options-intro">
        Control what customers see on printed or PDF quotations. Save as your default, or use the
        preview links below for this quote only.
      </p>
      <div className="admin-quote-doc-options-grid">
        <label className="admin-settings-row">
          <span>Hide product codes (SKU)</span>
          <input type="checkbox" checked={opts.hideSku} onChange={(e) => update({ hideSku: e.target.checked })} />
        </label>
        <label className="admin-settings-row">
          <span>Hide unit prices</span>
          <input
            type="checkbox"
            checked={opts.hideUnitPrice}
            onChange={(e) => update({ hideUnitPrice: e.target.checked })}
          />
        </label>
        <label className="admin-settings-row">
          <span>Hide line totals</span>
          <input
            type="checkbox"
            checked={opts.hideLineTotals}
            onChange={(e) => update({ hideLineTotals: e.target.checked })}
          />
        </label>
        <label className="admin-settings-row">
          <span>Hide VAT breakdown</span>
          <input
            type="checkbox"
            checked={opts.hideVatBreakdown}
            onChange={(e) => update({ hideVatBreakdown: e.target.checked })}
          />
        </label>
        <label className="admin-settings-row">
          <span>Hide payment terms</span>
          <input
            type="checkbox"
            checked={opts.hidePaymentTerms}
            onChange={(e) => update({ hidePaymentTerms: e.target.checked })}
          />
        </label>
        <label className="admin-settings-row">
          <span>Group lines by combination</span>
          <input
            type="checkbox"
            checked={opts.showCombinationGroups}
            onChange={(e) => update({ showCombinationGroups: e.target.checked })}
          />
        </label>
      </div>
      <div className="admin-quote-doc-options-actions">
        <button type="button" className="btn btn-outline btn-small" onClick={() => void saveDefaults()}>
          Save as my default
        </button>
        {saved && <span className="admin-message-ok">Saved.</span>}
        <a href={withPricing} className="btn btn-small" target="_blank" rel="noreferrer">
          Preview with pricing
        </a>
        <a href={noPricing} className="btn btn-outline btn-small" target="_blank" rel="noreferrer">
          Preview no pricing
        </a>
      </div>
    </section>
  )
}
