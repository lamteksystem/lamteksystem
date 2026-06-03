import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Check,
  ChevronLeft,
  Columns3,
  LayoutGrid,
  ListChecks,
  Package,
  Palette,
  Wrench,
} from 'lucide-react'
import { buildCategoryTreeOptions } from '@/lib/categoryTaxonomy'
import { getProductFinishLabels, productBelongsToKitchenRange } from '@/lib/catalogProductDisplay'
import { CARCASS_FINISH_OPTIONS, carcassFinishLabel } from '@/lib/orderRangeFinish'
import {
  BUILD_STYLE_OPTIONS,
  CATALOGUE_CHOICE_OPTIONS,
  HINGE_BRAND_OPTIONS,
  LINE_STYLE_OPTIONS,
  hingeBrandLabel,
  isKitchenDoorRangeCategoryName,
  saveTealburyOrderSetup,
  type CatalogueChoice,
  type TealburyOrderSetup,
} from '@/lib/tealburyOrderSetup'
import type { CategoryRow, ProductRow } from '@/types/database'

type WizardStep =
  | 'catalogue'
  | 'build-style'
  | 'kitchen-range'
  | 'door-finish'
  | 'line-style'
  | 'hinge'
  | 'carcass'

const TEALBURY_STEPS: { id: WizardStep; label: string }[] = [
  { id: 'catalogue', label: 'Catalogue' },
  { id: 'build-style', label: 'Build' },
  { id: 'kitchen-range', label: 'Range' },
  { id: 'door-finish', label: 'Finish' },
  { id: 'line-style', label: 'Line' },
  { id: 'hinge', label: 'Hinges' },
  { id: 'carcass', label: 'Carcass' },
]

const LAMTEK_STEPS: { id: WizardStep; label: string }[] = [
  { id: 'catalogue', label: 'Catalogue' },
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

function stepIndex(step: WizardStep, steps: { id: WizardStep }[]): number {
  return steps.findIndex((s) => s.id === step)
}

type TealburyOrderSetupPartial = Partial<TealburyOrderSetup>

function stepDone(step: WizardStep, state: TealburyOrderSetupPartial): boolean {
  switch (step) {
    case 'catalogue':
      return Boolean(state.catalogue_choice)
    case 'build-style':
      return Boolean(state.build_style)
    case 'kitchen-range':
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

export default function TealburyOrderSetupWizard({
  orderId,
  isQuote,
  categories,
  products,
  initial,
  variant = 'admin',
  onComplete,
}: Props) {
  const [step, setStep] = useState<WizardStep>('catalogue')
  const [catalogueChoice, setCatalogueChoice] = useState<CatalogueChoice | null>(
    initial?.catalogue_choice ?? null,
  )
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
  const isTealbury = catalogueChoice === 'tealbury'
  const activeSteps = isTealbury || !catalogueChoice ? TEALBURY_STEPS : LAMTEK_STEPS

  const partial: TealburyOrderSetupPartial = {
    catalogue_choice: catalogueChoice,
    build_style: buildStyle,
    kitchen_range_id: rangeId,
    door_finish: doorFinish,
    line_style_preference: lineStyle,
    hinge_brand: hingeBrand,
    carcass_finish: carcassFinish,
  }

  const currentIdx = Math.max(0, stepIndex(step, activeSteps))
  const progressPct = ((currentIdx + 1) / activeSteps.length) * 100

  useEffect(() => {
    if (!initial) return
    if (initial.catalogue_choice) setCatalogueChoice(initial.catalogue_choice)
    if (initial.build_style) setBuildStyle(initial.build_style)
    if (initial.kitchen_range_id) setRangeId(initial.kitchen_range_id)
    if (initial.door_finish) setDoorFinish(initial.door_finish)
    if (initial.line_style_preference) setLineStyle(initial.line_style_preference)
    if (initial.hinge_brand) setHingeBrand(initial.hinge_brand)
    if (initial.carcass_finish) setCarcassFinish(initial.carcass_finish)
  }, [initial])

  const rangeOptions = useMemo(
    () =>
      buildCategoryTreeOptions(categories, 'range')
        .filter((o) => o.kind === 'door_range' && isKitchenDoorRangeCategoryName(o.label)),
    [categories],
  )

  const rangeName = useMemo(
    () => categories.find((c) => c.id === rangeId)?.name ?? null,
    [categories, rangeId],
  )

  const productsInRange = useMemo(() => {
    if (!rangeId) return []
    return products.filter((p) => productBelongsToKitchenRange(p, rangeId, categories))
  }, [products, categories, rangeId])

  const doorFinishOptions = useMemo(() => getProductFinishLabels(productsInRange), [productsInRange])

  const docLabel = isQuote ? 'quote' : 'order'

  function buildSetup(carcass: string | null): TealburyOrderSetup {
    return {
      catalogue_choice: catalogueChoice,
      build_style: isTealbury ? buildStyle : null,
      kitchen_range_id: isTealbury ? rangeId : null,
      door_finish: isTealbury ? doorFinish : null,
      line_style_preference: isTealbury ? lineStyle : null,
      hinge_brand: isTealbury ? hingeBrand : null,
      carcass_finish: isTealbury ? carcass : null,
    }
  }

  async function saveAndComplete(setup: TealburyOrderSetup) {
    setSubmitting(true)
    setError(null)
    const { error: saveErr } = await saveTealburyOrderSetup(orderId, setup)
    setSubmitting(false)
    if (saveErr) {
      setError(saveErr)
      return
    }
    onComplete(setup)
  }

  async function finishLamtek() {
    if (!catalogueChoice) return
    await saveAndComplete(buildSetup(null))
  }

  async function finish(finalCarcass: string) {
    if (!catalogueChoice || !buildStyle || !rangeId || !doorFinish || !lineStyle || !hingeBrand) {
      setError('Complete each step before continuing.')
      return
    }
    await saveAndComplete(buildSetup(finalCarcass))
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
          Kitchen {docLabel} setup
        </span>
        <h2>{isCustomer ? 'Tell us about this kitchen' : `Set up this ${docLabel}`}</h2>
        <p>
          We will ask a few quick questions so the product search shows the right catalogue — Tealbury Complete
          kitchens with matching units, panels, plinth, cornice, and pelmet for your chosen range and finish, or
          Lamtek components if you are ordering parts only.
        </p>
      </header>

      <div className="kq-wizard-progress-wrap">
        <div className="kq-wizard-progress-track" aria-hidden>
          <div className="kq-wizard-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="kq-wizard-steps" role="list" aria-label="Setup steps">
          {activeSteps.map((s, i) => {
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
          {step === 'catalogue' && (
            <>
              <h3 className="kq-wizard-step-title">Which catalogue are you ordering from?</h3>
              <p className="kq-wizard-step-lead">
                Tealbury Complete is for packaged kitchens (door range, finishes, and complete units). Lamtek is
                for individual components without the kitchen wizard.
              </p>
              <div className="kq-wizard-options">
                {CATALOGUE_CHOICE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`kq-wizard-option${catalogueChoice === opt.value ? ' kq-wizard-option--active' : ''}`}
                    disabled={submitting}
                    onClick={() => {
                      setCatalogueChoice(opt.value)
                      setError(null)
                      if (opt.value === 'lamtek') {
                        void finishLamtek()
                        return
                      }
                      setStep('build-style')
                    }}
                  >
                    <span className="kq-wizard-option-icon" aria-hidden>
                      {opt.value === 'tealbury' ? (
                        <LayoutGrid size={22} strokeWidth={1.75} />
                      ) : (
                        <ListChecks size={22} strokeWidth={1.75} />
                      )}
                    </span>
                    <span className="kq-wizard-option-text">
                      <strong>{opt.label}</strong>
                      <span>{opt.detail}</span>
                    </span>
                    <Check className="kq-wizard-option-check" size={20} strokeWidth={2.5} aria-hidden />
                  </button>
                ))}
              </div>
              {submitting && catalogueChoice === 'lamtek' && (
                <p className="admin-muted">Saving…</p>
              )}
            </>
          )}

          {step === 'build-style' && isTealbury && (
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
                      setStep('kitchen-range')
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
              <nav className="kq-wizard-nav">
                <button type="button" className="btn btn-outline btn-small" onClick={() => goBack('catalogue')}>
                  <ChevronLeft size={16} aria-hidden /> Back
                </button>
              </nav>
            </>
          )}

          {step === 'kitchen-range' && isTealbury && (
            <>
              <h3 className="kq-wizard-step-title">Choose a door range</h3>
              <p className="kq-wizard-step-lead">
                Pick the Tealbury door family for this kitchen. Matching panels and trim for that range appear in
                the catalogue after setup.
              </p>
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

          {step === 'door-finish' && isTealbury && (
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
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  onClick={() => goBack('kitchen-range')}
                >
                  <ChevronLeft size={16} aria-hidden /> Back
                </button>
              </nav>
            </>
          )}

          {step === 'line-style' && isTealbury && (
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

          {step === 'hinge' && isTealbury && (
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

          {step === 'carcass' && isTealbury && (
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
          <h3>Your choices</h3>
          {!catalogueChoice && !buildStyle ? (
            <p className="kq-wizard-summary-empty">Choices appear here as you go.</p>
          ) : (
            <dl>
              <div>
                <dt>Catalogue</dt>
                <dd>
                  {catalogueChoice === 'tealbury'
                    ? 'Tealbury Complete'
                    : catalogueChoice === 'lamtek'
                      ? 'Lamtek'
                      : '—'}
                </dd>
              </div>
              {isTealbury && (
                <>
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
                </>
              )}
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
