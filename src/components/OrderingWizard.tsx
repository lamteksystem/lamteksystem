import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CategoryRow } from '@/types/database'
import { PageNav } from '@/components/PageNav'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { getOrderProject, setOrderProject, type OrderProject } from '@/lib/orderProject'

type OrderType = 'stock' | 'mto'
type OrderMode = 'component' | 'complete'
type RoomType = OrderProject['room_type']
type DeliveryMethod = OrderProject['delivery_method']

const STEP_TYPE = 'type'
const STEP_RANGE = 'range'
const STEP_MODE = 'mode'
const STEP_PROJECT = 'project'

export default function OrderingWizard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const type = searchParams.get('type') as OrderType | null
  const rangeId = searchParams.get('range')
  const mode = searchParams.get('mode') as OrderMode | null

  const { draftOrder, ensureDraftOrder } = useDraftOrder()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [project, setProject] = useState<OrderProject>({
    room_type: 'kitchen',
    delivery_method: 'deliver',
    postcode: null,
    site_notes: null,
    measurements: { room_length_mm: null, room_width_mm: null, ceiling_height_mm: null },
    updated_at: new Date().toISOString(),
  })
  const [projectLoadedFor, setProjectLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name, slug, sort_order, parent_id')
      .is('parent_id', null)
      .order('sort_order')
      .order('name')
      .then(({ data }) => {
        setCategories(data ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    // Load per-basket project setup from persistent prefs once we have a draft order.
    if (!draftOrder?.id) return
    if (projectLoadedFor === draftOrder.id) return
    setProjectLoadedFor(draftOrder.id)
    getOrderProject(draftOrder.id)
      .then((p) => { if (p) setProject(p) })
      .catch(() => {})
  }, [draftOrder?.id, projectLoadedFor])

  const setStep = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setSearchParams(next, { replace: true })
  }

  // MTO: no range step – go straight to Made to measure
  useEffect(() => {
    if (type === 'mto') navigate('/ordering/mto', { replace: true })
  }, [type, navigate])

  if (type === 'mto') return <div className="ordering-wizard"><p>Redirecting to Made to measure…</p></div>

  const currentStep = !type ? STEP_TYPE : !rangeId ? STEP_RANGE : !mode ? STEP_MODE : STEP_PROJECT
  const rangeName = rangeId ? categories.find((c) => c.id === rangeId)?.name : null

  async function ensureProjectOrderId(): Promise<string> {
    if (draftOrder?.id) return draftOrder.id
    return await ensureDraftOrder()
  }

  const projectReady =
    project.room_type &&
    project.delivery_method &&
    (project.delivery_method === 'collect' || (project.postcode ?? '').trim().length >= 5)

  async function saveAndContinue() {
    if (saving) return
    setSaving(true)
    try {
      const orderId = await ensureProjectOrderId()
      await setOrderProject(orderId, {
        room_type: project.room_type,
        delivery_method: project.delivery_method,
        postcode: project.delivery_method === 'deliver' ? (project.postcode ?? null) : null,
        site_notes: project.site_notes ?? null,
        measurements: project.measurements,
      })
      // Move into the ordering page with the chosen flow parameters.
      navigate(`/ordering?type=${type}&range=${rangeId}&mode=${mode}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ordering-wizard">
      <PageNav backTo="/" backLabel="Dashboard" />
      <div className="ordering-wizard-header">
        <h1>Create order</h1>
        <p className="ordering-wizard-intro">
          Stock: pick a range then browse by component or complete units. Made to measure: doors, worktops, mouldings (no range).
        </p>
        <Link to="/ordering" className="btn btn-ghost btn-small ordering-wizard-skip">
          Skip – browse all products
        </Link>
      </div>

      <div className="ordering-wizard-steps">
        <div className={`ordering-wizard-step-indicator ${currentStep === STEP_TYPE ? 'active' : ''} ${type ? 'done' : ''}`}>
          <span className="ordering-wizard-step-num">1</span>
          <span className="ordering-wizard-step-label">Order type</span>
        </div>
        <div className={`ordering-wizard-step-indicator ${currentStep === STEP_RANGE ? 'active' : ''} ${rangeId ? 'done' : ''}`}>
          <span className="ordering-wizard-step-num">2</span>
          <span className="ordering-wizard-step-label">Range (stock only)</span>
        </div>
        <div className={`ordering-wizard-step-indicator ${currentStep === STEP_MODE ? 'active' : ''} ${mode ? 'done' : ''}`}>
          <span className="ordering-wizard-step-num">3</span>
          <span className="ordering-wizard-step-label">Component or complete</span>
        </div>
        <div className={`ordering-wizard-step-indicator ${currentStep === STEP_PROJECT ? 'active' : ''}`}>
          <span className="ordering-wizard-step-num">4</span>
          <span className="ordering-wizard-step-label">Project setup</span>
        </div>
      </div>

      {currentStep === STEP_TYPE && (
        <div className="ordering-wizard-cards">
          <button
            type="button"
            className="ordering-wizard-card"
            onClick={() => setStep({ type: 'stock', range: '', mode: '' })}
          >
            <span className="ordering-wizard-card-icon">📦</span>
            <h2 className="ordering-wizard-card-title">Stock</h2>
            <p className="ordering-wizard-card-desc">
              Order from our standard catalogue: components and complete units from stock ranges.
            </p>
          </button>
          <button
            type="button"
            className="ordering-wizard-card"
            onClick={() => setStep({ type: 'mto', range: '', mode: '' })}
          >
            <span className="ordering-wizard-card-icon">✏️</span>
            <h2 className="ordering-wizard-card-title">Made to measure</h2>
            <p className="ordering-wizard-card-desc">
              Configure non-standard sizes, angled units, framed doors, worktops, and mouldings.
            </p>
          </button>
        </div>
      )}

      {currentStep === STEP_RANGE && (
        <>
          <div className="ordering-wizard-back">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setStep({ type: '', range: '', mode: '' })}>
              ← Change order type
            </button>
          </div>
          {loading ? (
            <p className="ordering-wizard-loading">Loading ranges…</p>
          ) : (
            <div className="ordering-wizard-cards ordering-wizard-cards--range">
              {categories.length === 0 ? (
                <div className="card">
                  <p>No ranges available.</p>
                </div>
              ) : (
                categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className="ordering-wizard-card ordering-wizard-card--range"
                    onClick={() => setStep({ range: cat.id, mode: '' })}
                  >
                    <h2 className="ordering-wizard-card-title">{cat.name}</h2>
                    <p className="ordering-wizard-card-desc">Browse {cat.name} products and units</p>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}

      {currentStep === STEP_MODE && type === 'stock' && (
        <>
          <div className="ordering-wizard-back">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setStep({ range: '', mode: '' })}>
              ← Change range
            </button>
            {rangeName && <span className="ordering-wizard-context">Range: {rangeName}</span>}
          </div>
          <div className="ordering-wizard-cards">
            <button
              type="button"
              className="ordering-wizard-card"
              onClick={() => setStep({ mode: 'component' })}
            >
              <span className="ordering-wizard-card-icon">🔩</span>
              <h2 className="ordering-wizard-card-title">Component based</h2>
              <p className="ordering-wizard-card-desc">
                Add individual products: doors, handles, hinges, lighting, and accessories.
              </p>
            </button>
            <button
              type="button"
              className="ordering-wizard-card"
              onClick={() => setStep({ mode: 'complete' })}
            >
              <span className="ordering-wizard-card-icon">📐</span>
              <h2 className="ordering-wizard-card-title">Complete based</h2>
              <p className="ordering-wizard-card-desc">
                Add full units (base, wall, tall) with all components included.
              </p>
            </button>
          </div>
        </>
      )}

      {currentStep === STEP_PROJECT && type === 'stock' && rangeId && mode && (
        <>
          <div className="ordering-wizard-back">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setStep({ mode: '' })}>
              ← Change component/complete
            </button>
            {rangeName && <span className="ordering-wizard-context">Range: {rangeName}</span>}
          </div>

          <div className="card" style={{ padding: '1rem' }}>
            <h2 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Project setup</h2>
            <p className="admin-muted" style={{ marginTop: 0 }}>
              This saves to your basket (draft) so the order stays organised and staff can see intent later.
            </p>

            <div className="admin-inline-form admin-inline-form--stack" style={{ marginTop: '0.75rem' }}>
              <label>
                Room type{' '}
                <select
                  value={project.room_type}
                  onChange={(e) => setProject((p) => ({ ...p, room_type: e.target.value as RoomType }))}
                >
                  <option value="kitchen">Kitchen</option>
                  <option value="bedroom">Bedroom</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                Delivery method{' '}
                <select
                  value={project.delivery_method}
                  onChange={(e) => setProject((p) => ({ ...p, delivery_method: e.target.value as DeliveryMethod }))}
                >
                  <option value="deliver">Delivery</option>
                  <option value="collect">Click &amp; Collect (collection)</option>
                </select>
              </label>

              {project.delivery_method === 'deliver' && (
                <label>
                  Delivery postcode{' '}
                  <input
                    value={project.postcode ?? ''}
                    onChange={(e) => setProject((p) => ({ ...p, postcode: e.target.value }))}
                    placeholder="e.g. OL11 1AA"
                    inputMode="text"
                    autoComplete="postal-code"
                  />
                </label>
              )}

              <div className="admin-inline-form" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ minWidth: 180 }}>
                  Room length (mm)
                  <input
                    value={project.measurements.room_length_mm ?? ''}
                    onChange={(e) => setProject((p) => ({
                      ...p,
                      measurements: { ...p.measurements, room_length_mm: e.target.value ? Number(e.target.value) : null },
                    }))}
                    inputMode="numeric"
                    placeholder="optional"
                  />
                </label>
                <label style={{ minWidth: 180 }}>
                  Room width (mm)
                  <input
                    value={project.measurements.room_width_mm ?? ''}
                    onChange={(e) => setProject((p) => ({
                      ...p,
                      measurements: { ...p.measurements, room_width_mm: e.target.value ? Number(e.target.value) : null },
                    }))}
                    inputMode="numeric"
                    placeholder="optional"
                  />
                </label>
                <label style={{ minWidth: 180 }}>
                  Ceiling height (mm)
                  <input
                    value={project.measurements.ceiling_height_mm ?? ''}
                    onChange={(e) => setProject((p) => ({
                      ...p,
                      measurements: { ...p.measurements, ceiling_height_mm: e.target.value ? Number(e.target.value) : null },
                    }))}
                    inputMode="numeric"
                    placeholder="optional"
                  />
                </label>
              </div>

              <label>
                Site / project notes (optional)
                <textarea
                  value={project.site_notes ?? ''}
                  onChange={(e) => setProject((p) => ({ ...p, site_notes: e.target.value }))}
                  rows={3}
                  placeholder="Anything we should know: access constraints, deadlines, style notes, etc."
                />
              </label>
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn"
                disabled={!projectReady || saving}
                onClick={saveAndContinue}
                title={!projectReady ? 'Add a postcode for delivery (or choose collection) to continue.' : undefined}
              >
                {saving ? 'Saving…' : 'Start adding items →'}
              </button>
              <Link to="/ordering/cart" className="btn btn-outline">View cart →</Link>
              {!projectReady && (
                <span className="admin-muted" style={{ fontSize: '0.9rem' }}>
                  Tip: choose Click &amp; Collect if you don’t know the delivery postcode yet.
                </span>
              )}
            </div>
          </div>
        </>
      )}

      <div className="ordering-wizard-footer">
        <Link to="/ordering/cart" className="btn btn-outline">
          View cart →
        </Link>
      </div>
    </div>
  )
}
