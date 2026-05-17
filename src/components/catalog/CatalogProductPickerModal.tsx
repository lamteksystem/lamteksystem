import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import CatalogProductWorkbench from '@/components/catalog/CatalogProductWorkbench'
import { CATALOG_PROGRAM, type CatalogProgram } from '@/lib/catalogProgram'
import type { AssemblyWithLines, CategoryRow, ProductRow } from '@/types/database'

export interface CatalogPickerCommitPayload {
  products: { product: ProductRow; quantity: number }[]
  assemblies: { assembly: AssemblyWithLines; quantity: number }[]
}

interface CatalogProductPickerModalProps {
  open: boolean
  title?: string
  products: ProductRow[]
  categories: CategoryRow[]
  assemblies?: AssemblyWithLines[]
  catalogPrograms?: CatalogProgram[]
  customerUserId?: string | null
  preferencesScope: string
  commitLabel?: string
  onClose: () => void
  onCommit: (payload: CatalogPickerCommitPayload) => Promise<void>
}

export default function CatalogProductPickerModal({
  open,
  title = 'Product search',
  products,
  categories,
  assemblies = [],
  catalogPrograms = [CATALOG_PROGRAM.LAMTEK, CATALOG_PROGRAM.TEALBURY],
  customerUserId,
  preferencesScope,
  commitLabel = 'Add to order',
  onClose,
  onCommit,
}: CatalogProductPickerModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="catalog-picker-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="catalog-picker-shell">
        <header className="catalog-picker-header">
          <h2>{title}</h2>
          <button type="button" className="catalog-picker-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <CatalogProductWorkbench
          products={products}
          categories={categories}
          assemblies={assemblies}
          allowedCatalogPrograms={catalogPrograms}
          customerUserId={customerUserId}
          preferencesScope={preferencesScope}
          showCatalogueSwitcher={catalogPrograms.length > 1}
          commitLabel={commitLabel}
          onCommit={onCommit}
          embedded
        />
      </div>
    </div>,
    document.body,
  )
}
