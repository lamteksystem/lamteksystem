import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Check,
  ChevronLeft,
  Columns3,
  Package,
  Palette,
  Wrench,
} from 'lucide-react'
import { buildCategoryTreeOptions, productMatchesBrowseFilter } from '@/lib/categoryTaxonomy'
import { getProductFinishLabels } from '@/lib/catalogProductDisplay'
import { CARCASS_FINISH_OPTIONS, carcassFinishLabel } from '@/lib/orderRangeFinish'
import {
  BUILD_STYLE_OPTIONS,
  HINGE_BRAND_OPTIONS,
  LINE_STYLE_OPTIONS,
  hingeBrandLabel,
  saveTealburyOrderSetup,
  type TealburyOrderSetup,
} from '@/lib/tealburyOrderSetup'
import type { CategoryRow, ProductRow } from '@/types/database'

type WizardStep = 'build-style' | 'range' | 'door-finish' | 'line-style' | 'hinge' | 'carcass'

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'build-style', label: 'Build' },
  { id: 'range', label: 'Range' },
  { id: 'door-finish', label: 'Finish' },
  { id: 'line-style', label: 'Line' },
  { id: 'hinge', label: 'Hinges' },
  { id: 'carcass', label: 'Carcass' },
]

type Props = {
  orderId: string
  isQuote: boolean
  categories: CategoryRow[]
  products: ProductRow[]
  initial?: TealburyOrderSetup | null
  variant?: 'admin' | 'customer'
  onComplete: (setup: TealburyOrderSetup) => void
}

function stepIndex(step: WizardStep): number {
  return STEPS.findIndex((s) => s.id === step)
}

function stepDone(step: WizardStep, state: TealburyOrderSetupPartial): boolean {
  switch (step) {
    case 'build-style':
      return Boolean(state.build_style)
    case 'range':
      return Boolean(state.kitchen_range_id)
    case 'door-finish':
      return Boolean(state.door_finish)
    case 'line-style':
      return Boolean(state.line_style_preference)
    case 'hinge':
      return Boolean(state.hinge_brand)
    case 'carcass':
      return Boolean(state.carcass_finish)
    default:
      return false
  }
}

type TealburyOrderSetupPartial = Partial<TealburyOrderSetup>

export default function TealburyOrderSetupWizard({
  orderId,
  isQuote,
  categories,
  products,
  initial,
  variant = 'admin',
  onComplete,
}: Props) {
  const [step, setStep] = useState<WizardStep>('build-style')
  const [buildStyle, setBuildStyle] = useState<TealburyOrderSetup['build_style']>(initial?.build_style ?? null)
  const [rangeId, setRangeId] = useState<string | null>(initial?.kitchen_range_id ?? null)
  const [doorFinish, setDoorFinish] = useState<string | null>(initial?.door_finish ?? null)
  const [lineStyle, setLineStyle] = useState<TealburyOrderSetup['line_style_preference']>(
    initial?.line_style_preference ?? null,
  )
  const [hingeBrand, setHingeBrand] = useState<TealburyOrderSetup['hinge_brand']>(initial?.hinge_brand ?? null)
  const [carcassFinish, setCarcassFinish] = useState<string | null>(initial?.carcass_finish ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCustomer = variant === 'customer'
  const partial: TealburyOrderSetupPartial = {
    build_style: buildStyle,
    kitchen_range_id: rangeId,
    door_finish: doorFinish,
    line_style_preference: lineStyle,
    hinge_brand: hingeBrand,
    carcass_finish: carcassFinish,
  }

  const currentIdx = stepIndex(step)
  const progressPct = ((currentIdx + 1) / STEPS.length) * 100

  useEffect(() => {
    if (!initial) return
    if (initial.build_style) setBuildStyle(initial.build_style)
    if (initial.kitchen_range_id) setRangeId(initial.kitchen_range_id)
    if (initial.door_finish) setDoorFinish(initial.door_finish)
    if (initial.line_style_preference) setLineStyle(initial.line_style_preference)
    if (initial.hinge_brand) setHingeBrand(initial.hinge_brand)
    if (initial.carcass_finish) setCarcassFinish(initial.carcass_finish)
  }, [initial])

  const rangeOptions = useMemo(
    () => buildCategoryTreeOptions(categories, 'range').filter((o) => o.kind === 'door_range'),
    [categories],
  )

  const rangeName = useMemo(
    () => categories.find((c) => c.id === rangeId)?.name ?? null,
    [categories, rangeId],
  )

  const productsInRange = useMemo(() => {
    if (!rangeId) return []
    return products.filter((p) => productMatchesBrowseFilter(p, categories, 'range', rangeId))
  }, [products, categories, rangeId])

  const doorFinishOptions = useMemo(() => getProductFinishLabels(productsInRange), [productsInRange])

  const docLabel = isQuote ? 'quote' : 'order'

  async function finish(finalCarcass: string) {
    if (!buildStyle || !rangeId || !doorFinish || !lineStyle || !hingeBrand) {
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
      hinge_brand: hingeBrand,
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

  function goBack(target: WizardStep) {
    setStep(target)
    setError(null)
  }

  return (
    <div className={`kq-wizard${isCustomer ? ' kq-wizard--customer' : ''}`}>
      <header className="kq-wizard-hero">
        <span className="kq-wizard-hero-badge">
          <Package size={14} aria-hidden />
          Tealbury kitchen
        </span>
        <h2>{isCustomer ? 'Configure your kitchen' : `Set up this ${docLabel}`}</h2>
        <p>
          A short guided setup so the catalogue shows the right ranges, units, and accessories. Complete kitchens
          add as a full BOM; plinth, cornice and panels stay separate lines.
        </p>
      </header>

      <div className="kq-wizard-progress-wrap">
        <div className="kq-wizard-progress-track" aria-hidden>
          <div className="kq-wizard-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="kq-wizard-steps" role="list" aria-label="Setup steps">
          {STEPS.map((s, i) => {
            const done = stepDone(s.id, partial)
            const active = s.id === step
            return (
              <span
                key={s.id}
                role="listitem"
                className={`kq-wizard-step-pill${active ? ' kq-wizard-step-pill--active' : ''}${done && !active ? ' kq-wizard-step-pill--done' : ''}`}
              >
                <span className="kq-wizard-step-pill-num">{done && !active ? '✓' : i + 1}</span>
                {s.label}
              </span>
            )
          })}
        </div>
      </div>

      <div className="kq-wizard-body">
        <div className="kq-wizard-main">
          {step === 'build-style' && (
            <>
              <h3 className="kq-wizard-step-title">How should units be supplied?</h3>
              <p className="kq-wizard-step-lead">
                Flat pack is quicker to deliver; rigid factory-built units need more space and lead time.
              </p>
              <div className="kq-wizard-options">
                {BUILD_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`kq-wizard-option${buildStyle === opt.value ? ' kq-wizard-option--active' : ''}`}
                    onClick={() => {
                      setBuildStyle(opt.value)
                      setStep('range')
                      setError(null)
                    }}
                  >
                    <span className="kq-wizard-option-icon" aria-hidden>
                      <Box size={22} strokeWidth={1.75} />
                    </span>
                    <span className="kq-wizard-option-text">
                      <strong>{opt.label}</strong>
                      <span>{opt.detail}</span>
                    </span>
                    <Check className="kq-wizard-option-check" size={20} strokeWidth={2.5} aria-hidden />
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'range' && (
            <>
              <h3 className="kq-wizard-step-title">Choose a kitchen range</h3>
              <p className="kq-wizard-step-lead">Door style and pricing follow the range you pick.</p>
              <div className="kq-wizard-options kq-wizard-options--grid">
                {rangeOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`kq-wizard-option kq-wizard-option--compact${rangeId === opt.id ? ' kq-wizard-option--active' : ''}`}
                    onClick={() => {
                      setRangeId(opt.id)
                      setDoorFinish(null)
                      setStep('door-finish')
                      setError(null)
                    }}
                  >
                    <span className="kq-wizard-option-text">
                      <strong>{opt.label}</strong>
                    </span>
                    <Check className="kq-wizard-option-check" size={20} strokeWidth={2.5} aria-hidden />
                  </button>
                ))}
              </div>
              <nav className="kq-wizard-nav">
                <button type="button" className="btn btn-outline btn-small" onClick={() => goBack('build-style')}>
                  <ChevronLeft size={16} aria-hidden /> Back
                </button>
              </nav>
            </>
          )}

          {step === 'door-finish' && (
            <>
              <h3 className="kq-wizard-step-title">Door / range finish</h3>
              <p className="kq-wizard-step-lead">
                {rangeName ? <>For <strong>{rangeName}</strong>.</> : 'Select the door programme finish.'}
              </p>
              {doorFinishOptions.length === 0 ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setDoorFinish('— none recorded —')
                    setStep('line-style')
                  }}
                >
                  Continue without a recorded finish
                </button>
              ) : (
                <div className="kq-wizard-options kq-wizard-options--swatch">
                  {doorFinishOptions.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`kq-wizard-option kq-wizard-option--compact${doorFinish === f ? ' kq-wizard-option--active' : ''}`}
                      onClick={() => {
                        setDoorFinish(f)
                        setStep('line-style')
                        setError(null)
                      }}
                    >
                      <span className="kq-wizard-option-text">
                        <strong>{f}</strong>
                      </span>
                      <Check className="kq-wizard-option-check" size={20} strokeWidth={2.5} aria-hidden />
                    </button>
                  ))}
                </div>
              )}
              <nav className="kq-wizard-nav">
                <button type="button" className="btn btn-outline btn-small" onClick={() => goBack('range')}>
                  <ChevronLeft size={16} aria-hidden /> Back
                </button>
              </nav>
            </>
          )}

          {step === 'line-style' && (
            <>
              <h3 className="kq-wizard-step-title">Predominant line style</h3>
              <p className="kq-wizard-step-lead">Sets the default category filter — you can still add other unit types.</p>
              <div className="kq-wizard-options">
                {LINE_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`kq-wizard-option${lineStyle === opt.value ? ' kq-wizard-option--active' : ''}`}
                    onClick={() => {
                      setLineStyle(opt.value)
                      setStep('hinge')
                      setError(null)
                    }}
                  >
                    <span className="kq-wizard-option-icon" aria-hidden>
                      <Columns3 size={22} strokeWidth={1.75} />
                    </span>
                    <span className="kq-wizard-option-text">
                      <strong>{opt.label}</strong>
                      <span>{opt.detail}</span>
                    </span>
                    <Check className="kq-wizard-option-check" size={20} strokeWidth={2.5} aria-hidden />
                  </button>
                ))}
              </div>
              <nav className="kq-wizard-nav">
                <button type="button" className="btn btn-outline btn-small" onClick={() => goBack('door-finish')}>
                  <ChevronLeft size={16} aria-hidden /> Back
                </button>
              </nav>
            </>
          )}

          {step === 'hinge' && (
            <>
              <h3 className="kq-wizard-step-title">Hinge brand</h3>
              <p className="kq-wizard-step-lead">Complete units will use matching hinges and hinge plates from this brand.</p>
              <div className="kq-wizard-options kq-wizard-options--grid">
                {HINGE_BRAND_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`kq-wizard-option kq-wizard-option--compact${hingeBrand === opt.value ? ' kq-wizard-option--active' : ''}`}
                    onClick={() => {
                      setHingeBrand(opt.value)
                      setStep('carcass')
                      setError(null)
                    }}
                  >
                    <span className="kq-wizard-option-icon" aria-hidden>
                      <Wrench size={20} strokeWidth={1.75} />
                    </span>
                    <span className="kq-wizard-option-text">
                      <strong>{opt.label}</strong>
                    </span>
                    <Check className="kq-wizard-option-check" size={20} strokeWidth={2.5} aria-hidden />
                  </button>
                ))}
              </div>
              <nav className="kq-wizard-nav">
                <button type="button" className="btn btn-outline btn-small" onClick={() => goBack('line-style')}>
                  <ChevronLeft size={16} aria-hidden /> Back
                </button>
              </nav>
            </>
          )}

          {step === 'carcass' && (
            <>
              <h3 className="kq-wizard-step-title">Cabinet / carcass colour</h3>
              <p className="kq-wizard-step-lead">Interior carcass colour for units in this {docLabel}.</p>
              <div className="kq-wizard-options kq-wizard-options--grid">
                {CARCASS_FINISH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`kq-wizard-option kq-wizard-option--compact${carcassFinish === opt.value ? ' kq-wizard-option--active' : ''}`}
                    disabled={submitting}
                    onClick={() => void finish(opt.value)}
                  >
                    <span className="kq-wizard-option-icon" aria-hidden>
                      <Palette size={20} strokeWidth={1.75} />
                    </span>
                    <span className="kq-wizard-option-text">
                      <strong>{opt.label}</strong>
                    </span>
                    <Check className="kq-wizard-option-check" size={20} strokeWidth={2.5} aria-hidden />
                  </button>
                ))}
              </div>
              <nav className="kq-wizard-nav">
                <button type="button" className="btn btn-outline btn-small" onClick={() => goBack('hinge')}>
                  <ChevronLeft size={16} aria-hidden /> Back
                </button>
                {submitting && <span className="admin-muted">Saving…</span>}
              </nav>
            </>
          )}
        </div>

        <aside className="kq-wizard-summary" aria-label="Choices so far">
          <h3>Your kitchen</h3>
          {!buildStyle && !rangeId ? (
            <p className="kq-wizard-summary-empty">Choices appear here as you go.</p>
          ) : (
            <dl>
              <div>
                <dt>Build</dt>
                <dd>{buildStyle === 'flat_pack' ? 'Flat pack' : buildStyle === 'rigid' ? 'Rigid' : '—'}</dd>
              </div>
              <div>
                <dt>Range</dt>
                <dd>{rangeName ?? '—'}</dd>
              </div>
              <div>
                <dt>Door finish</dt>
                <dd>{doorFinish ?? '—'}</dd>
              </div>
              <div>
                <dt>Line style</dt>
                <dd>
                  {lineStyle === 'high_line'
                    ? 'High-line'
                    : lineStyle === 'drawer_line'
                      ? 'Drawer-line'
                      : lineStyle === 'mixed'
                        ? 'Mixed'
                        : '—'}
                </dd>
              </div>
              <div>
                <dt>Hinges</dt>
                <dd>{hingeBrandLabel(hingeBrand) ?? '—'}</dd>
              </div>
              <div>
                <dt>Carcass</dt>
                <dd>{carcassFinishLabel(carcassFinish) ?? '—'}</dd>
              </div>
            </dl>
          )}
        </aside>
      </div>

      {error && (
        <p className="kq-wizard-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
