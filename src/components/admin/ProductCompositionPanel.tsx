import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAssemblyPartTypes } from '@/hooks/useAssemblyPartTypes'
import { fetchProductAssemblyBom } from '@/lib/productAssembly'
import PartTypeSelectWithAdd from '@/components/admin/PartTypeSelectWithAdd'
import ProductAssemblyEditor from '@/components/admin/ProductAssemblyEditor'
import type { AssemblyPartTypeRow, CategoryRow, ProductRow } from '@/types/database'

type CompositionMode = 'single' | 'assembly' | 'loose'

interface ProductCompositionPanelProps {
  product: ProductRow
  categories: CategoryRow[]
  allProducts: ProductRow[]
  canEdit: boolean
  partTypes?: AssemblyPartTypeRow[]
  partTypeLabels?: Map<string, string>
  onPartTypesChange?: () => void
  /** Called after part_type is written so the parent can refresh its in-memory product list. */
  onProductUpdated?: (patch: Partial<ProductRow>) => void
}

/**
 * Lets an admin decide what a product *is*:
 *
 *   - **Single part**  — the product IS a single part (panel, plinth, cornice, hinge, etc.).
 *     Saves the chosen part type on `products.part_type`. No assembly BOM is involved.
 *   - **Multi-part assembly** — the product is a complete unit assembled from other parts
 *     (the classic Tealbury complete-kitchen product). Delegates to the existing
 *     `ProductAssemblyEditor` so admins can pick component SKUs and quantities.
 *   - **Loose / unclassified** — the default for un-touched products. No part_type, no
 *     assembly. Made-to-measure or "we'll decide later" items live here.
 *
 * The two real modes are *editorially* exclusive — switching to single nulls any draft
 * multi-part state in the UI, and switching to multi nulls `part_type`. The database
 * itself doesn't enforce mutual exclusion, which leaves room for future hybrids without
 * a migration.
 */
export default function ProductCompositionPanel({
  product,
  categories,
  allProducts,
  canEdit,
  partTypes: partTypesProp,
  partTypeLabels: partTypeLabelsProp,
  onPartTypesChange,
  onProductUpdated,
}: ProductCompositionPanelProps) {
  const hookPartTypes = useAssemblyPartTypes(true)
  const partTypes = useMemo<AssemblyPartTypeRow[]>(() => {
    if (partTypesProp && partTypesProp.length > 0) return partTypesProp
    return hookPartTypes.types
  }, [partTypesProp, hookPartTypes.types])

  const [hasAssembly, setHasAssembly] = useState<boolean | null>(null)
  const [partTypeValue, setPartTypeValue] = useState<string>(product.part_type ?? '')
  const [mode, setMode] = useState<CompositionMode>('loose')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  /** Decide the initial mode whenever we hop to a new product. */
  const determineMode = useCallback(async () => {
    setMessage(null)
    const bom = await fetchProductAssemblyBom(product.id)
    const assemblyExists = Boolean(bom && bom.assembly_lines.length > 0)
    setHasAssembly(assemblyExists)
    if (assemblyExists) {
      setMode('assembly')
    } else if (product.part_type) {
      setMode('single')
    } else {
      setMode('loose')
    }
    setPartTypeValue(product.part_type ?? '')
  }, [product.id, product.part_type])

  useEffect(() => {
    void determineMode()
  }, [determineMode])

  async function persistPartType(nextCode: string | null) {
    if (!canEdit) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('products')
      .update({ part_type: nextCode })
      .eq('id', product.id)
    setSaving(false)
    if (error) {
      setMessage({ kind: 'err', text: `Could not save part type: ${error.message}` })
      return
    }
    setPartTypeValue(nextCode ?? '')
    onProductUpdated?.({ part_type: nextCode })
    setMessage({
      kind: 'ok',
      text: nextCode ? 'Saved — this product is now classified as a single part.' : 'Cleared.',
    })
  }

  async function handleModeChange(next: CompositionMode) {
    if (next === mode) return
    if (mode === 'single' && next !== 'single' && partTypeValue) {
      // Leaving single-part mode: clear the part_type so it doesn't linger
      // and silently re-classify the product as a single part.
      await persistPartType(null)
    }
    setMode(next)
  }

  function handleAssemblyCreated() {
    setHasAssembly(true)
    setMode('assembly')
  }

  const modeLabels: Record<CompositionMode, { title: string; body: string }> = {
    single: {
      title: 'Single part',
      body:
        'This product IS a single part — a panel, plinth, cornice, hinge, handle, etc. Pick its part type below; no component breakdown needed.',
    },
    assembly: {
      title: 'Multi-part assembly',
      body:
        'This product is a complete unit assembled from other parts (e.g. a Tealbury base unit = carcass + door + hinges + handles). Define the BOM below.',
    },
    loose: {
      title: 'Loose / not classified',
      body:
        'No part type yet. Use this for made-to-measure items or anything that doesn\'t fit the single / multi-part split.',
    },
  }

  return (
    <div className="product-composition-panel">
      <div className="product-composition-modes" role="radiogroup" aria-label="Composition mode">
        {(['single', 'assembly', 'loose'] as CompositionMode[]).map((m) => {
          const selected = mode === m
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`product-composition-mode${selected ? ' product-composition-mode--selected' : ''}`}
              onClick={() => void handleModeChange(m)}
              disabled={!canEdit || saving}
            >
              <span className="product-composition-mode-title">{modeLabels[m].title}</span>
              <span className="product-composition-mode-body">{modeLabels[m].body}</span>
            </button>
          )
        })}
      </div>

      {mode === 'single' && (
        <div className="product-composition-single">
          <p className="admin-muted product-composition-single-hint">
            Stock take, supplier reorder and reporting all key off this part type. Pick the closest
            match — admins can add new part types from{' '}
            <span className="product-composition-inline-link">
              Settings → Categories → Parts
            </span>
            .
          </p>
          <PartTypeSelectWithAdd
            partTypes={partTypes}
            value={partTypeValue}
            onChange={(code) => void persistPartType(code || null)}
            onPartTypesChange={() => onPartTypesChange?.()}
            disabled={!canEdit || saving}
            selectLabel="This product IS a"
          />
          {partTypeValue && (
            <button
              type="button"
              className="btn btn-sm btn-outline product-composition-clear"
              onClick={() => void persistPartType(null)}
              disabled={!canEdit || saving}
            >
              Clear part type
            </button>
          )}
        </div>
      )}

      {mode === 'assembly' && (
        <div className="product-composition-assembly">
          <ProductAssemblyEditor
            product={product}
            categories={categories}
            allProducts={allProducts}
            canEdit={canEdit}
            partTypes={partTypes}
            partTypeLabels={partTypeLabelsProp ?? hookPartTypes.labels}
            onPartTypesChange={onPartTypesChange}
          />
          {/* Inform parent if a BOM just appeared (so future opens default to "assembly"). */}
          {hasAssembly === false && (
            <p className="admin-muted product-composition-assembly-hint">
              Click <em>Define component breakdown</em> above, then pick the components that make up
              this complete unit.
            </p>
          )}
          {/* Provide a button to flip back when the admin realises this is actually a single part. */}
          <button
            type="button"
            className="btn btn-sm btn-outline product-composition-back"
            onClick={() => {
              handleAssemblyCreated()
              void handleModeChange('single')
            }}
            disabled={!canEdit || saving}
            title="Stop treating this as a multi-part assembly and classify the product as a single part instead."
          >
            Treat as single part instead
          </button>
        </div>
      )}

      {mode === 'loose' && (
        <p className="admin-muted product-composition-loose">
          Nothing to configure. The product won't appear in stock-take part lists until you pick a
          single part type or define a multi-part assembly.
        </p>
      )}

      {message && (
        <p
          className={
            message.kind === 'ok'
              ? 'admin-message-ok product-composition-status'
              : 'admin-error product-composition-status'
          }
          role="status"
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
