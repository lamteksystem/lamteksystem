import { useState } from 'react'
import { useAddMtoLine } from '@/hooks/useAddMtoLine'
import { DoorAngled, DoorPreview } from '@/components/mto/MtoShapeDiagrams'

const BASE_PRICE = 52
const ANGLE_OPTIONS = [
  { id: 'top-right', label: 'Top right angled' },
  { id: 'top-left', label: 'Top left angled' },
  { id: 'both-top', label: 'Both top corners angled' },
  { id: 'top-right-step', label: 'Top right angled (step)' },
  { id: 'top-left-step', label: 'Top left angled (step)' },
] as const

export default function MtoAngled() {
  const { addMtoLine } = useAddMtoLine()
  const [angleDirection, setAngleDirection] = useState<string>('')
  const [height, setHeight] = useState('')
  const [width, setWidth] = useState('')
  const [hingeHoles, setHingeHoles] = useState<'left' | 'right' | 'none'>('left')
  const [drillFromTop, setDrillFromTop] = useState('')
  const [drillFromBottom, setDrillFromBottom] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [rangeName] = useState('Salisbury')
  const [colour] = useState('Porcelain')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    setError('')
    if (!angleDirection) {
      setError('Please choose angle direction.')
      return
    }
    const h = Number(height)
    const w = Number(width)
    if (!height.trim() || !width.trim() || isNaN(h) || isNaN(w) || h <= 0 || w <= 0) {
      setError('Please enter valid height and width (mm).')
      return
    }
    setAdding(true)
    try {
      const options: Record<string, unknown> = {
        mtoType: 'angled',
        angleDirection,
        height_mm: h,
        width_mm: w,
        hingeHoles,
        drillFromTop_mm: drillFromTop.trim() ? Number(drillFromTop) : null,
        drillFromBottom_mm: drillFromBottom.trim() ? Number(drillFromBottom) : null,
        rangeName,
        colour,
      }
      const label = ANGLE_OPTIONS.find((o) => o.id === angleDirection)?.label ?? angleDirection
      const name = `MTM Angled Door ${h} × ${w} mm (${label})`
      await addMtoLine(
        { name, description: `${rangeName} ${colour}`, sku: 'MTM-ANGLED' },
        options,
        BASE_PRICE,
        quantity
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add to cart')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="mto-config card">
      <h1 className="mto-config-title">MTM Angled door</h1>
      <p className="mto-config-meta">
        Range: {rangeName} · Colour: {colour}
      </p>

      <div className="mto-form">
        <fieldset className="mto-fieldset mto-fieldset--shapes">
          <legend>Choose angle direction</legend>
          <div className="mto-shape-cards">
            {ANGLE_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`mto-shape-card ${angleDirection === opt.id ? 'mto-shape-card--selected' : ''}`}
              >
                <input
                  type="radio"
                  name="angleDirection"
                  checked={angleDirection === opt.id}
                  onChange={() => setAngleDirection(opt.id)}
                  className="mto-shape-card-input"
                />
                <DoorAngled type={opt.id} width={80} height={80} />
                <span className="mto-shape-card-label">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mto-form-row">
          <div className="mto-form-fields">
        <label className="mto-label">
          Height (mm)
          <input
            type="number"
            min={1}
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="mto-input"
          />
        </label>
        <label className="mto-label">
          Width (mm)
          <input
            type="number"
            min={1}
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            className="mto-input"
          />
        </label>

        <fieldset className="mto-fieldset">
          <legend>Hinge holes</legend>
          {(['left', 'right', 'none'] as const).map((opt) => (
            <label key={opt} className="mto-radio">
              <input
                type="radio"
                name="hingeHoles"
                checked={hingeHoles === opt}
                onChange={() => setHingeHoles(opt)}
              />
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </label>
          ))}
        </fieldset>

        <label className="mto-label">
          Drill from top (mm)
          <input
            type="number"
            min={0}
            value={drillFromTop}
            onChange={(e) => setDrillFromTop(e.target.value)}
            className="mto-input"
          />
        </label>
        <label className="mto-label">
          Drill from bottom (mm)
          <input
            type="number"
            min={0}
            value={drillFromBottom}
            onChange={(e) => setDrillFromBottom(e.target.value)}
            className="mto-input"
          />
        </label>

        <label className="mto-label">
          Quantity
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="mto-input"
          />
        </label>

        {error && <p className="mto-error">{error}</p>}
        <button type="button" className="btn btn-success mto-add-btn" onClick={handleAdd} disabled={adding}>
          {adding ? 'Adding…' : 'Add to cart'}
        </button>
          </div>
          <div className="mto-preview-wrap">
            <p className="mto-preview-label">Preview</p>
            {height && width && Number(height) > 0 && Number(width) > 0 && (
              <DoorPreview heightMm={Number(height)} widthMm={Number(width)} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
