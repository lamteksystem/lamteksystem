import { useState } from 'react'
import { useAddMtoLine } from '@/hooks/useAddMtoLine'
import { DoorFramed, DoorPreview } from '@/components/mto/MtoShapeDiagrams'

const BASE_PRICE = 58

export default function MtoFramed() {
  const { addMtoLine } = useAddMtoLine()
  const [height, setHeight] = useState('')
  const [width, setWidth] = useState('')
  const [hingeHoles, setHingeHoles] = useState<'left' | 'right' | 'none'>('left')
  const [drillFromTop, setDrillFromTop] = useState('')
  const [drillFromBottom, setDrillFromBottom] = useState('')
  const [additionalDrill1, setAdditionalDrill1] = useState('')
  const [additionalDrill2, setAdditionalDrill2] = useState('')
  const [additionalDrill3, setAdditionalDrill3] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [rangeName] = useState('Salisbury')
  const [colour] = useState('Porcelain')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    setError('')
    const h = Number(height)
    const w = Number(width)
    if (!height.trim() || !width.trim() || isNaN(h) || isNaN(w) || h <= 0 || w <= 0) {
      setError('Please enter valid height and width (mm).')
      return
    }
    setAdding(true)
    try {
      const options: Record<string, unknown> = {
        mtoType: 'framed',
        height_mm: h,
        width_mm: w,
        hingeHoles,
        drillFromTop_mm: drillFromTop.trim() ? Number(drillFromTop) : null,
        drillFromBottom_mm: drillFromBottom.trim() ? Number(drillFromBottom) : null,
        additionalDrill_mm: [additionalDrill1, additionalDrill2, additionalDrill3]
          .filter((s) => s.trim())
          .map(Number),
        rangeName,
        colour,
      }
      const name = `MTM Framed door ${h} × ${w} mm`
      await addMtoLine(
        { name, description: `${rangeName} ${colour}. Feature doors <395mm wide supplied with no internal design; <1100mm high come with one hole.`, sku: 'MTM-FRAMED' },
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
      <h1 className="mto-config-title">MTM Framed door</h1>
      <p className="mto-config-meta">
        Range: {rangeName} · Colour: {colour}
      </p>

      <div className="mto-note mto-note--info">
        All feature doors less than 395mm wide are supplied with no internal design. All feature doors less than 1100mm high will come with one hole.
      </div>

      <div className="mto-form-row">
        <div className="mto-form-fields">
      <div className="mto-form">
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

        <div className="mto-note">*Advisable if door is over 900mm high</div>
        <label className="mto-label">
          Additional drill holes (mm from top)
          <div className="mto-input-row">
            <input type="number" min={0} value={additionalDrill1} onChange={(e) => setAdditionalDrill1(e.target.value)} className="mto-input" />
            <input type="number" min={0} value={additionalDrill2} onChange={(e) => setAdditionalDrill2(e.target.value)} className="mto-input" />
            <input type="number" min={0} value={additionalDrill3} onChange={(e) => setAdditionalDrill3(e.target.value)} className="mto-input" />
          </div>
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
        </div>
        <div className="mto-preview-wrap">
          <p className="mto-preview-label">Shape</p>
          <DoorFramed width={120} height={120} />
          {height && width && Number(height) > 0 && Number(width) > 0 && (
            <>
              <p className="mto-preview-label">Size</p>
              <DoorPreview heightMm={Number(height)} widthMm={Number(width)} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
