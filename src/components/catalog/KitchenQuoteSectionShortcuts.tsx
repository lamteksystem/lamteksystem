import {
  KITCHEN_SECTION_SHORTCUTS,
  countKitchenShortcutProducts,
  filtersForKitchenShortcut,
  type KitchenSectionShortcut,
} from '@/lib/kitchenQuoteBrowse'
import type { WorkbenchFilterState } from '@/lib/catalogProductDisplay'
import type { ProductCategoryMap } from '@/lib/productCategories'
import type { CategoryRow, CategoryTypeRow, ProductRow } from '@/types/database'
import type { TealburyOrderSetup } from '@/lib/tealburyOrderSetup'

type Props = {
  products: ProductRow[]
  categories: CategoryRow[]
  setup: TealburyOrderSetup
  productCategoryMap: ProductCategoryMap
  completeProductIds: Set<string>
  categoryTypes: CategoryTypeRow[]
  activeShortcutId: string | null
  onApplyShortcut: (patch: Partial<WorkbenchFilterState>, shortcut: KitchenSectionShortcut) => void
}

export default function KitchenQuoteSectionShortcuts({
  products,
  categories,
  setup,
  productCategoryMap,
  completeProductIds,
  categoryTypes,
  activeShortcutId,
  onApplyShortcut,
}: Props) {
  return (
    <div className="kq-section-shortcuts" role="navigation" aria-label="Quick browse for this kitchen">
      <span className="kq-section-shortcuts-label">Add products for this kitchen</span>
      <div className="kq-section-shortcuts-chips">
        {KITCHEN_SECTION_SHORTCUTS.map((shortcut) => {
          const count = countKitchenShortcutProducts(products, shortcut, setup, categories, {
            productCategoryMap,
            completeProductIds,
            categoryTypes,
          })
          const active = activeShortcutId === shortcut.id
          return (
            <button
              key={shortcut.id}
              type="button"
              className={`kq-section-shortcut-chip${active ? ' active' : ''}${count === 0 ? ' kq-section-shortcut-chip--empty' : ''}`}
              disabled={count === 0}
              title={count === 0 ? 'No matching products in catalogue for this kitchen' : undefined}
              onClick={() =>
                onApplyShortcut(filtersForKitchenShortcut(shortcut, setup, categories), shortcut)
              }
            >
              {shortcut.label}
              <span className="kq-section-shortcut-count">{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
