import { useState } from 'react'
import { useAddMtoLine } from '@/hooks/useAddMtoLine'
import { PanelRect, RoundTop, CornerAngledTop, ProfiledPanel } from '@/components/mto/MtoShapeDiagrams'

const BASE_PANEL_PRICE = 38
const BASE_ROUND_TOP_PRICE = 65
const BASE_ANGLED_TOP_PRICE = 72
const BASE_PROFILED_PRICE = 42

export default function MtoWorktopsPanels() {
  const { addMtoLine } = useAddMtoLine()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  // Panels (height × width, grain height ways)
  const [panelHeight, setPanelHeight] = useState('')
  const [panelWidth, setPanelWidth] = useState('')

  async function handleAddPanel() {
    setError('')
    const h = Number(panelHeight)
    const w = Number(panelWidth)
    if (!panelHeight.trim() || !panelWidth.trim() || isNaN(h) || isNaN(w) || h <= 0 || w <= 0) {
      setError('Please enter valid height and width (mm). Max width 1200.')
      return
    }
    if (w > 1200) {
      setError('Maximum width 1200mm.')
      return
    }
    setAdding(true)
    try {
      await addMtoLine(
        { name: `MTM Panel ${h} × ${w} mm`, description: 'Grain height ways. Salisbury Porcelain.', sku: 'MTM-PANEL' },
        { mtoType: 'worktops-panels', variant: 'panel', height_mm: h, width_mm: w, rangeName: 'Salisbury', colour: 'Porcelain' },
        BASE_PANEL_PRICE,
        1
      )
      setPanelHeight('')
      setPanelWidth('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add to cart')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="mto-config card">
      <h1 className="mto-config-title">MTM Worktops & Panels</h1>
      <div className="mto-note mto-note--info">
        If you require 22mm worktops or panels, these need to be ordered in the gemini door section as a separate order.
      </div>

      <section className="mto-section mto-section--with-diagram">
        <div className="mto-section-diagram"><PanelRect width={80} height={80} /></div>
        <div className="mto-section-content">
        <h2 className="mto-section-title">Panels</h2>
        <p className="mto-config-meta">Grain direction will always run height ways. Maximum width 1200.</p>
        <div className="mto-form mto-form--inline">
          <label className="mto-label">
            Height (mm)
            <input
              type="number"
              min={1}
              value={panelHeight}
              onChange={(e) => setPanelHeight(e.target.value)}
              className="mto-input"
            />
          </label>
          <label className="mto-label">
            Width (mm)
            <input
              type="number"
              min={1}
              max={1200}
              value={panelWidth}
              onChange={(e) => setPanelWidth(e.target.value)}
              className="mto-input"
            />
          </label>
          <button type="button" className="btn btn-success mto-add-btn" onClick={handleAddPanel} disabled={adding}>
            {adding ? 'Adding…' : 'Add MTM Panel'}
          </button>
        </div>
        </div>
      </section>

      <section className="mto-section mto-section--with-diagram">
        <div className="mto-section-diagram"><RoundTop width={80} height={80} /></div>
        <div className="mto-section-content">
        <h2 className="mto-section-title">Round table top</h2>
        <MtoRoundTableTop />
        </div>
      </section>

      <section className="mto-section mto-section--with-diagram">
        <div className="mto-section-diagram"><CornerAngledTop width={80} height={80} /></div>
        <div className="mto-section-content">
        <h2 className="mto-section-title">Corner angled top</h2>
        <MtoCornerAngledTop />
        </div>
      </section>

      <section className="mto-section mto-section--with-diagram">
        <div className="mto-section-diagram"><ProfiledPanel width={80} height={80} /></div>
        <div className="mto-section-content">
        <h2 className="mto-section-title">Panels & tops with profiled edges</h2>
        <p className="mto-config-meta">Grain direction will always run length ways. Maximum depth 1200.</p>
        <MtoProfiledPanels />
        </div>
      </section>

      {error && <p className="mto-error">{error}</p>}
    </div>
  )
}

function MtoRoundTableTop() {
  const { addMtoLine } = useAddMtoLine()
  const [diameter, setDiameter] = useState('')
  const [edgeType, setEdgeType] = useState('')
  const [thickness] = useState('18mm')
  const [reverseColour, setReverseColour] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const edgeOptions = ['Square', 'Pencil', 'Ogee', 'Bullnose', 'Chamfer', 'Radius']

  async function handleAdd() {
    const d = Number(diameter)
    if (!diameter.trim() || isNaN(d) || d <= 0) return
    setAdding(true)
    try {
      await addMtoLine(
        { name: `Round table top Ø${d} mm`, description: `${edgeType || 'Edge'} ${thickness}`, sku: 'MTM-ROUND' },
        { mtoType: 'worktops-panels', variant: 'round-top', diameter_mm: d, edgeType, thickness, reverseColour: reverseColour || null },
        BASE_ROUND_TOP_PRICE,
        quantity
      )
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="mto-form">
      <label className="mto-label">
        Diameter (mm)
        <input type="number" min={1} value={diameter} onChange={(e) => setDiameter(e.target.value)} className="mto-input" />
      </label>
      <fieldset className="mto-fieldset">
        <legend>Edge type</legend>
        <div className="mto-edge-options">
          {edgeOptions.map((opt) => (
            <label key={opt} className="mto-radio">
              <input type="radio" name="edgeType" checked={edgeType === opt} onChange={() => setEdgeType(opt)} />
              {opt}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mto-label">
        Thickness
        <span className="mto-value">18mm</span>
      </label>
      <label className="mto-label">
        Reverse colour
        <select value={reverseColour} onChange={(e) => setReverseColour(e.target.value)} className="mto-input">
          <option value="">Please select…</option>
          <option value="Porcelain">Porcelain</option>
          <option value="White">White</option>
          <option value="Grey">Grey</option>
        </select>
      </label>
      <label className="mto-label">
        Quantity
        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} className="mto-input" />
      </label>
      <button type="button" className="btn btn-success mto-add-btn" onClick={handleAdd} disabled={adding}>
        Add MTM Panel
      </button>
    </div>
  )
}

function MtoCornerAngledTop() {
  const { addMtoLine } = useAddMtoLine()
  const [length, setLength] = useState('')
  const [depth, setDepth] = useState('')
  const [profiledFront, setProfiledFront] = useState(false)
  const [profiledBack, setProfiledBack] = useState(false)
  const [profiledLeft, setProfiledLeft] = useState(false)
  const [profiledRight, setProfiledRight] = useState(false)
  const [angleFrontRight, setAngleFrontRight] = useState(false)
  const [angleFrontLeft, setAngleFrontLeft] = useState(false)
  const [angleBackRight, setAngleBackRight] = useState(false)
  const [angleBackLeft, setAngleBackLeft] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    const l = Number(length)
    const d = Number(depth)
    if (!length.trim() || !depth.trim() || isNaN(l) || isNaN(d) || l <= 0 || d <= 0 || d > 1200) return
    setAdding(true)
    try {
      await addMtoLine(
        { name: `Corner angled top ${l} × ${d} mm`, description: 'Grain length ways. Max depth 1200.', sku: 'MTM-ANGLED-TOP' },
        {
          mtoType: 'worktops-panels',
          variant: 'corner-angled',
          length_mm: l,
          depth_mm: d,
          profiledEdges: { front: profiledFront, back: profiledBack, left: profiledLeft, right: profiledRight },
          anglesRequired: { frontRight: angleFrontRight, frontLeft: angleFrontLeft, backRight: angleBackRight, backLeft: angleBackLeft },
        },
        BASE_ANGLED_TOP_PRICE,
        quantity
      )
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="mto-form">
      <p className="mto-config-meta">Grain direction will always run length ways. Maximum depth 1200.</p>
      <label className="mto-label">Length (mm) <input type="number" min={1} value={length} onChange={(e) => setLength(e.target.value)} className="mto-input" /></label>
      <label className="mto-label">Depth (mm) <input type="number" min={1} max={1200} value={depth} onChange={(e) => setDepth(e.target.value)} className="mto-input" /></label>
      <fieldset className="mto-fieldset">
        <legend>Profiled edges</legend>
        {['Front', 'Back', 'Left', 'Right'].map((side, i) => {
          const setters = [setProfiledFront, setProfiledBack, setProfiledLeft, setProfiledRight]
          return (
            <label key={side} className="mto-radio">
              <input type="checkbox" checked={[profiledFront, profiledBack, profiledLeft, profiledRight][i]} onChange={(e) => setters[i](e.target.checked)} />
              {side}
            </label>
          )
        })}
      </fieldset>
      <fieldset className="mto-fieldset">
        <legend>Angles required</legend>
        <label className="mto-radio"><input type="checkbox" checked={angleFrontRight} onChange={(e) => setAngleFrontRight(e.target.checked)} /> Front right</label>
        <label className="mto-radio"><input type="checkbox" checked={angleFrontLeft} onChange={(e) => setAngleFrontLeft(e.target.checked)} /> Front left</label>
        <label className="mto-radio"><input type="checkbox" checked={angleBackRight} onChange={(e) => setAngleBackRight(e.target.checked)} /> Back right</label>
        <label className="mto-radio"><input type="checkbox" checked={angleBackLeft} onChange={(e) => setAngleBackLeft(e.target.checked)} /> Back left</label>
      </fieldset>
      <label className="mto-label">Quantity <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} className="mto-input" /></label>
      <button type="button" className="btn btn-success mto-add-btn" onClick={handleAdd} disabled={adding}>Add MTM Panel</button>
    </div>
  )
}

function MtoProfiledPanels() {
  const { addMtoLine } = useAddMtoLine()
  const [length, setLength] = useState('')
  const [depth, setDepth] = useState('')
  const [panelEdge, setPanelEdge] = useState<'3mm' | 'square'>('3mm')
  const [panelType, setPanelType] = useState<'plain' | 'tg'>('plain')
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    const l = Number(length)
    const d = Number(depth)
    if (!length.trim() || !depth.trim() || isNaN(l) || isNaN(d) || l <= 0 || d <= 0 || d > 1200) return
    setAdding(true)
    try {
      await addMtoLine(
        { name: `Profiled panel ${l} × ${d} mm`, description: `${panelEdge === '3mm' ? '3mm Radius' : 'Square'} edge, ${panelType === 'tg' ? 'T&G' : 'Plain'}`, sku: 'MTM-PROFILED' },
        { mtoType: 'worktops-panels', variant: 'profiled', length_mm: l, depth_mm: d, panelEdge, panelType },
        BASE_PROFILED_PRICE,
        quantity
      )
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="mto-form">
      <label className="mto-label">Length (mm) <input type="number" min={1} value={length} onChange={(e) => setLength(e.target.value)} className="mto-input" /></label>
      <label className="mto-label">Depth (mm) <input type="number" min={1} max={1200} value={depth} onChange={(e) => setDepth(e.target.value)} className="mto-input" /></label>
      <fieldset className="mto-fieldset">
        <legend>Panel edge</legend>
        <label className="mto-radio"><input type="radio" name="panelEdge" checked={panelEdge === '3mm'} onChange={() => setPanelEdge('3mm')} /> 3mm Radius</label>
        <label className="mto-radio"><input type="radio" name="panelEdge" checked={panelEdge === 'square'} onChange={() => setPanelEdge('square')} /> Square edge</label>
      </fieldset>
      <fieldset className="mto-fieldset">
        <legend>Panel type</legend>
        <label className="mto-radio"><input type="radio" name="panelType" checked={panelType === 'plain'} onChange={() => setPanelType('plain')} /> Plain</label>
        <label className="mto-radio"><input type="radio" name="panelType" checked={panelType === 'tg'} onChange={() => setPanelType('tg')} /> T&G</label>
      </fieldset>
      <label className="mto-label">Thickness <span className="mto-value">18mm</span></label>
      <label className="mto-label">Quantity <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} className="mto-input" /></label>
      <button type="button" className="btn btn-success mto-add-btn" onClick={handleAdd} disabled={adding}>Add MTM Panel</button>
    </div>
  )
}
