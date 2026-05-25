import { useEffect, useMemo, useState } from 'react'
import { buildCategoryTreeOptions, productMatchesBrowseFilter } from '@/lib/categoryTaxonomy'
import { getProductFinishLabels } from '@/lib/catalogProductDisplay'
import { CARCASS_FINISH_OPTIONS } from '@/lib/orderRangeFinish'
import {
  BUILD_STYLE_OPTIONS,
  LINE_STYLE_OPTIONS,
  saveTealburyOrderSetup,
  type TealburyOrderSetup,
} from '@/lib/tealburyOrderSetup'
import type { CategoryRow, ProductRow } from '@/types/database'

type WizardStep = 'build-style' | 'range' | 'door-finish' | 'line-style' | 'carcass'

type Props = {
  orderId: string
  isQuote: boolean
  categories: CategoryRow[]
  products: ProductRow[]
  initial?: TealburyOrderSetup | null
  onComplete: (setup: TealburyOrderSetup) => void
}

export default function TealburyOrderSetupWizard({
  orderId,
  isQuote,
  categories,
  products,
  initial,
  onComplete,
}: Props) {
  const [step, setStep] = useState<WizardStep>('build-style')
  const [buildStyle, setBuildStyle] = useState<TealburyOrderSetup['build_style']>(initial?.build_style ?? null)
  const [rangeId, setRangeId] = useState<string | null>(initial?.kitchen_range_id ?? null)
  const [doorFinish, setDoorFinish] = useState<string | null>(initial?.door_finish ?? null)
  const [lineStyle, setLineStyle] = useState<TealburyOrderSetup['line_style_preference']>(
    initial?.line_style_preference ?? null,
  )
  const [carcassFinish, setCarcassFinish] = useState<string | null>(initial?.carcass_finish ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!initial) return
    if (initial.build_style) setBuildStyle(initial.build_style)
    if (initial.kitchen_range_id) setRangeId(initial.kitchen_range_id)
    if (initial.door_finish) setDoorFinish(initial.door_finish)
    if (initial.line_style_preference) setLineStyle(initial.line_style_preference)
    if (initial.carcass_finish) setCarcassFinish(initial.carcass_finish)
  }, [initial])

  const rangeOptions = useMemo(
    () => buildCategoryTreeOptions(categories, 'range').filter((o) => o.kind === 'door_range'),
    [categories],
  )

  const productsInRange = useMemo(() => {
    if (!rangeId) return []
    return products.filter((p) => productMatchesBrowseFilter(p, categories, 'range', rangeId))
  }, [products, categories, rangeId])

  const doorFinishOptions = useMemo(() => getProductFinishLabels(productsInRange), [productsInRange])

  const docLabel = isQuote ? 'quote' : 'order'

  async function finish(finalCarcass: string) {
    if (!buildStyle || !rangeId || !doorFinish || !lineStyle) {
      setError('Complete each step before continuing.')
      return
    }
    setSubmitting(true)
    setError(null)
    const setup: TealburyOrderSetup = {
      build_style: buildStyle,
      kitchen_range_id: rangeId,
      door_finish: doorFinish,
      line_style_preference: lineStyle,
      carcass_finish: finalCarcass,
    }
    const { error: saveErr } = await saveTealburyOrderSetup(orderId, setup)
    setSubmitting(false)
    if (saveErr) {
      setError(saveErr)
      return
    }
    onComplete(setup)
  }

  return (
    <div className="card admin-card tealbury-setup-wizard">
      <h2 className="admin-modal-form-section-title" style={{ marginTop: 0 }}>
        Tealbury kitchen setup
      </h2>
      <p className="admin-muted page-intro" style={{ marginTop: 0 }}>
        Configure this {docLabel} before adding products. Complete units (base, wall, tall) use a BOM of carcass,
        doors, hinges, and fittings; accessories such as plinth and cornice are added separately.
      </p>
      <p className="admin-muted">
        <strong>{isQuote ? 'Quote' : 'Order'}</strong> — you are building a {docLabel}. Change type from the admin menu
        if needed.
      </p>

      {step === 'build-style' && (
        <div className="tealbury-setup-step">
          <h3>Flat pack or rigid?</h3>
          <div className="tealbury-setup-options">
            {BUILD_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`tealbury-setup-option${buildStyle === opt.value ? ' tealbury-setup-option--active' : ''}`}
                onClick={() => {
                  setBuildStyle(opt.value)
                  setStep('range')
                  setError(null)
                }}
              >
                <strong>{opt.label}</strong>
                <span className="admin-muted">{opt.detail}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'range' && (
        <div className="tealbury-setup-step">
          <h3>Kitchen range</h3>
          <div className="tealbury-setup-options tealbury-setup-options--grid">
            {rangeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`tealbury-setup-option${rangeId === opt.id ? ' tealbury-setup-option--active' : ''}`}
                onClick={() => {
                  setRangeId(opt.id)
                  setDoorFinish(null)
                  setStep('door-finish')
                  setError(null)
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-outline btn-small" onClick={() => setStep('build-style')}>
            ← Back
          </button>
        </div>
      )}

      {step === 'door-finish' && (
        <div className="tealbury-setup-step">
          <h3>Door / range finish</h3>
          {doorFinishOptions.length === 0 ? (
            <p className="admin-muted">No finishes found for this range — check catalogue data.</p>
          ) : (
            <div className="tealbury-setup-options tealbury-setup-options--grid">
              {doorFinishOptions.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`tealbury-setup-option${doorFinish === f ? ' tealbury-setup-option--active' : ''}`}
                  onClick={() => {
                    setDoorFinish(f)
                    setStep('line-style')
                    setError(null)
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-outline btn-small" onClick={() => setStep('range')}>
            ← Back
          </button>
        </div>
      )}

      {step === 'line-style' && (
        <div className="tealbury-setup-step">
          <h3>Predominant line style</h3>
          <p className="admin-muted">You can still add other unit types later; this sets the default browse filter.</p>
          <div className="tealbury-setup-options">
            {LINE_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`tealbury-setup-option${lineStyle === opt.value ? ' tealbury-setup-option--active' : ''}`}
                onClick={() => {
                  setLineStyle(opt.value)
                  setStep('carcass')
                  setError(null)
                }}
              >
                <strong>{opt.label}</strong>
                <span className="admin-muted">{opt.detail}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-outline btn-small" onClick={() => setStep('door-finish')}>
            ← Back
          </button>
        </div>
      )}

      {step === 'carcass' && (
        <div className="tealbury-setup-step">
          <h3>Cabinet / carcass colour</h3>
          <div className="tealbury-setup-options tealbury-setup-options--grid">
            {CARCASS_FINISH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`tealbury-setup-option${carcassFinish === opt.value ? ' tealbury-setup-option--active' : ''}`}
                disabled={submitting}
                onClick={() => void finish(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-outline btn-small" onClick={() => setStep('line-style')}>
            ← Back
          </button>
        </div>
      )}

      {error && <p className="admin-error">{error}</p>}
      {submitting && <p className="admin-muted">Saving…</p>}
    </div>
  )
}
