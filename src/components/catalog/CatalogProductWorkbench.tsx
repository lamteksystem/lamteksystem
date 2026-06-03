import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Filter, Layers } from 'lucide-react'
import type { AssemblyWithLines, CategoryRow, ProductRow } from '@/types/database'
import { CATALOG_PROGRAM, type CatalogProgram } from '@/lib/catalogProgram'
import { buildCategoryTreeOptions } from '@/lib/categoryTaxonomy'
import {
  CATALOG_WORKBENCH_COLUMNS,
  CATALOG_WORKBENCH_DEFAULT_ORDER_IDS,
  CATALOG_WORKBENCH_DEFAULT_VISIBLE_IDS,
  CATALOG_WORKBENCH_LOCKED_COLUMN_IDS,
  workbenchTableCellClass,
  workbenchTableColClass,
  workbenchTableColumnLabel,
} from '@/lib/catalogWorkbenchColumns'
import { fetchCatalogWorkbenchColumnDefaults } from '@/lib/catalogWorkbenchSettings'
import { renderWorkbenchProductCell } from '@/components/catalog/catalogWorkbenchTableCells'
import {
  EMPTY_WORKBENCH_FILTERS,
  buildCatalogFacets,
  catalogProgramLabel,
  categoryNameById,
  countWorkbenchBrowseChipProducts,
  filterCatalogProducts,
  type WorkbenchFilterState,
} from '@/lib/catalogProductDisplay'
import { ColumnSettings } from '@/components/admin/ColumnSettings'
import { useColumnVisibility } from '@/hooks/useColumnVisibility'
import {
  loadFavouriteProductIds,
  loadFilterPresets,
  loadWorkbenchFilters,
  loadWorkbenchLayout,
  saveFavouriteProductIds,
  saveFilterPresets,
  saveWorkbenchFilters,
  saveWorkbenchLayout,
  type SavedFilterPreset,
} from '@/lib/productWorkbenchPrefs'
import { resolveProductPriceBreakdown } from '@/lib/productWorkbenchPricing'
import CatalogProductDetailPanel from '@/components/catalog/CatalogProductDetailPanel'
import CatalogOrderLinesPanel from '@/components/catalog/CatalogOrderLinesPanel'
import CatalogProductStagingBasket, {
  type StagedCatalogLine,
} from '@/components/catalog/CatalogProductStagingBasket'
import { useWorkbenchOrderLines } from '@/hooks/useWorkbenchOrderLines'
import type { CatalogPickerCommitPayload } from '@/components/catalog/CatalogProductPickerModal'
import { usePermission } from '@/hooks/usePermission'
import { useAssemblyPartTypes } from '@/hooks/useAssemblyPartTypes'
import { supabase } from '@/lib/supabase'
import { recalcOrderTotals } from '@/lib/orders'
import { fetchProductCategoryMap, type ProductCategoryMap } from '@/lib/productCategories'
import { fetchCompleteProductIds } from '@/lib/productAssembly'
import { resolveAssemblyForHingeBrand } from '@/lib/tealburyBomResolve'
import { useCategoryTypes } from '@/hooks/useCategoryTypes'
import {
  isTealburyCatalogueChoice,
  orderNeedsTealburyKitchenSetup,
  type TealburyOrderSetup,
} from '@/lib/tealburyOrderSetup'
import AdminProductModal from '@/components/admin/AdminProductModal'
import CatalogueCategoriesManager from '@/components/admin/CatalogueCategoriesManager'

type MainTab = 'products' | 'assemblies'
export type CatalogLinePersistence = 'staged' | 'immediate'

interface CatalogProductWorkbenchProps {
  products: ProductRow[]
  categories: CategoryRow[]
  assemblies?: AssemblyWithLines[]
  allowedCatalogPrograms?: CatalogProgram[]
  customerUserId?: string | null
  preferencesScope: string
  orderId?: string | null
  orderLinesRefreshToken?: number
  cartLineCount?: number
  cartHref?: string
  commitLabel?: string
  addButtonLabel?: string
  linePersistence?: CatalogLinePersistence
  showCatalogueSwitcher?: boolean
  embedded?: boolean
  /** Product search opened in a fixed-height modal (enables scrollable pane layout). */
  inModal?: boolean
  initialCategoryId?: string | null
  /** When set, section filters and product-kind tabs follow Tealbury kitchen setup. */
  tealburySetup?: TealburyOrderSetup | null
  onCommit: (payload: CatalogPickerCommitPayload) => Promise<void>
  /** Renders above the workbench grid (customer bar, quote ref, etc.). */
  buildBar?: ReactNode
}

export default function CatalogProductWorkbench({
  products,
  categories,
  assemblies = [],
  allowedCatalogPrograms = [CATALOG_PROGRAM.LAMTEK],
  customerUserId,
  preferencesScope,
  orderId = null,
  orderLinesRefreshToken = 0,
  cartLineCount = 0,
  cartHref = '/ordering/cart',
  commitLabel = 'Add to order',
  addButtonLabel = 'Add to order',
  linePersistence = 'staged',
  showCatalogueSwitcher = false,
  embedded = false,
  inModal = false,
  initialCategoryId = null,
  tealburySetup = null,
  onCommit,
  buildBar,
}: CatalogProductWorkbenchProps) {
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const appliedSetupRangeIdRef = useRef<string | null>(null)
  const [filters, setFilters] = useState<WorkbenchFilterState>({
    ...EMPTY_WORKBENCH_FILTERS,
    categoryId: initialCategoryId,
  })
  const [mainTab, setMainTab] = useState<MainTab>('products')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [staged, setStaged] = useState<StagedCatalogLine[]>([])
  const [committing, setCommitting] = useState(false)
  const [rowQtyById, setRowQtyById] = useState<Record<string, number>>({})
  const [mutatingOrderLineId, setMutatingOrderLineId] = useState<string | null>(null)
  const [assemblyQtyById, setAssemblyQtyById] = useState<Record<string, number>>({})
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [favouriteIds, setFavouriteIds] = useState<string[]>([])
  const [filterPresets, setFilterPresets] = useState<SavedFilterPreset[]>([])
  const [sellPriceByProductId, setSellPriceByProductId] = useState<Record<string, number>>({})
  const [prefsReady, setPrefsReady] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightPaneOpen, setRightPaneOpen] = useState(true)
  const [layoutReady, setLayoutReady] = useState(false)
  const immediate = linePersistence === 'immediate'
  const { lines: orderLines, loading: orderLinesLoading, reload: reloadOrderLines } =
    useWorkbenchOrderLines(immediate ? orderId : null, orderLinesRefreshToken)

  // Admin inline editing — gated on catalogue.edit permission. When admin saves a
  // product or edits categories from inside the workbench we refetch products and
  // categories from supabase and store them in the override state below, so the
  // ordering screen reflects the change immediately without the parent reloading.
  const { allowed: canEditCatalogue } = usePermission('admin.catalogue', 'edit')
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)
  const [managingCategories, setManagingCategories] = useState(false)
  const [productsOverride, setProductsOverride] = useState<ProductRow[] | null>(null)
  const [categoriesOverride, setCategoriesOverride] = useState<CategoryRow[] | null>(null)
  const [productCategoryMap, setProductCategoryMap] = useState<ProductCategoryMap>(new Map())
  const [completeProductIds, setCompleteProductIds] = useState<Set<string>>(new Set())
  const { types: categoryTypes } = useCategoryTypes(true)
  const {
    types: assemblyPartTypes,
    labels: assemblyPartTypeLabels,
    reload: reloadAssemblyPartTypes,
  } = useAssemblyPartTypes(canEditCatalogue)

  // When the parent passes new products/categories (e.g. the user navigates to a
  // different range or program) drop any local override so we read the fresh data.
  useEffect(() => {
    setProductsOverride(null)
  }, [products])
  useEffect(() => {
    setCategoriesOverride(null)
  }, [categories])

  useEffect(() => {
    let cancelled = false
    void fetchProductCategoryMap().then((map) => {
      if (!cancelled) setProductCategoryMap(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchCompleteProductIds().then((ids) => {
      if (!cancelled) setCompleteProductIds(ids)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Esc closes the manage-categories modal. (AdminProductModal handles its own keys.)
  useEffect(() => {
    if (!managingCategories) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setManagingCategories(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [managingCategories])

  const effectiveProducts = productsOverride ?? products
  const effectiveCategories = categoriesOverride ?? categories

  const refreshCatalogueFromDb = useCallback(async () => {
    const [{ data: prodData }, { data: catData }, pcMap] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('*').order('sort_order').order('name'),
      fetchProductCategoryMap(),
    ])
    setProductsOverride((prodData ?? []) as ProductRow[])
    setCategoriesOverride((catData ?? []) as CategoryRow[])
    setProductCategoryMap(pcMap)
  }, [])

  const favouriteSet = useMemo(() => new Set(favouriteIds), [favouriteIds])

  const scopeProducts = useMemo(() => {
    const allowed = new Set(allowedCatalogPrograms)
    return effectiveProducts.filter((p) => !p.catalog_program || allowed.has(p.catalog_program))
  }, [effectiveProducts, allowedCatalogPrograms])

  const facets = useMemo(
    () =>
      buildCatalogFacets(scopeProducts, {
        categories: effectiveCategories,
        categoryTypes,
        productCategoryMap,
        lineStylePreference: tealburySetup?.line_style_preference,
        completeProductIds,
      }),
    [
      scopeProducts,
      effectiveCategories,
      categoryTypes,
      productCategoryMap,
      tealburySetup?.line_style_preference,
      completeProductIds,
    ],
  )
  const catMap = useMemo(() => categoryNameById(effectiveCategories), [effectiveCategories])
  const filtered = useMemo(
    () =>
      filterCatalogProducts(scopeProducts, filters, favouriteSet, effectiveCategories, {
        productCategoryMap,
        completeProductIds,
        categoryTypes,
        tealburySetup:
          tealburySetup &&
          isTealburyCatalogueChoice(tealburySetup.catalogue_choice) &&
          !orderNeedsTealburyKitchenSetup(tealburySetup)
            ? tealburySetup
            : null,
      }),
    [
      scopeProducts,
      filters,
      favouriteSet,
      effectiveCategories,
      productCategoryMap,
      completeProductIds,
      categoryTypes,
      tealburySetup,
    ],
  )
  const hideCompleteInBrowse = Boolean(
    tealburySetup &&
      isTealburyCatalogueChoice(tealburySetup.catalogue_choice) &&
      !orderNeedsTealburyKitchenSetup(tealburySetup),
  )
  const browseOptions = useMemo(
    () =>
      buildCategoryTreeOptions(effectiveCategories, filters.browseMode, {
        hideCompleteCategory: hideCompleteInBrowse,
      }),
    [effectiveCategories, filters.browseMode, hideCompleteInBrowse],
  )
  const kitchenRangeBrowseOptions = useMemo(
    () => browseOptions.filter((o) => o.chipSection === 'kitchen_range'),
    [browseOptions],
  )
  const categoryBrowseOptions = useMemo(
    () => browseOptions.filter((o) => o.chipSection === 'product_category'),
    [browseOptions],
  )
  const selectedProduct = useMemo(
    () => effectiveProducts.find((p) => p.id === selectedProductId) ?? null,
    [effectiveProducts, selectedProductId],
  )

  const chipCountFilterOptions = useMemo(
    () => ({
      productCategoryMap,
      completeProductIds,
      categoryTypes,
      tealburySetup:
        tealburySetup &&
        isTealburyCatalogueChoice(tealburySetup.catalogue_choice) &&
        !orderNeedsTealburyKitchenSetup(tealburySetup)
          ? tealburySetup
          : null,
    }),
    [productCategoryMap, completeProductIds, categoryTypes, tealburySetup],
  )

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const opt of browseOptions) {
      counts.set(
        opt.id,
        countWorkbenchBrowseChipProducts(
          scopeProducts,
          filters,
          opt.id,
          effectiveCategories,
          chipCountFilterOptions,
        ),
      )
    }
    return counts
  }, [browseOptions, scopeProducts, filters, effectiveCategories, chipCountFilterOptions])

  const [orgColumnDefaults, setOrgColumnDefaults] = useState<{
    order: string[]
    visible: string[]
    updatedAt: string | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchCatalogWorkbenchColumnDefaults().then((defaults) => {
      if (!cancelled) setOrgColumnDefaults(defaults)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const columnVisibility = useColumnVisibility(
    `workbench_${preferencesScope}`,
    CATALOG_WORKBENCH_COLUMNS,
    orgColumnDefaults?.visible ?? CATALOG_WORKBENCH_DEFAULT_VISIBLE_IDS,
    {
      defaultOrder: orgColumnDefaults?.order ?? CATALOG_WORKBENCH_DEFAULT_ORDER_IDS,
      defaultsEpoch: orgColumnDefaults?.updatedAt ?? 'loading',
    },
  )
  const {
    visibleIds: workbenchVisibleIds,
    setColumnVisible,
    setColumnOrder,
    resetToDefault: resetWorkbenchColumns,
    order: workbenchColumnOrder,
  } = columnVisibility

  const tableColumnIds = useMemo(() => {
    const scrollable = workbenchColumnOrder.filter(
      (id) => workbenchVisibleIds.includes(id) && !CATALOG_WORKBENCH_LOCKED_COLUMN_IDS.has(id),
    )
    const locked = workbenchColumnOrder.filter((id) => CATALOG_WORKBENCH_LOCKED_COLUMN_IDS.has(id))
    return [...scrollable, ...locked]
  }, [workbenchColumnOrder, workbenchVisibleIds])

  const settingsColumnOrder = useMemo(
    () => workbenchColumnOrder.filter((id) => !CATALOG_WORKBENCH_LOCKED_COLUMN_IDS.has(id)),
    [workbenchColumnOrder],
  )
  const settingsColumnDefs = useMemo(
    () =>
      settingsColumnOrder
        .map((id) => CATALOG_WORKBENCH_COLUMNS.find((c) => c.id === id))
        .filter((c): c is (typeof CATALOG_WORKBENCH_COLUMNS)[number] => !!c),
    [settingsColumnOrder],
  )
  const settingsVisibleIds = useMemo(
    () => workbenchVisibleIds.filter((id) => !CATALOG_WORKBENCH_LOCKED_COLUMN_IDS.has(id)),
    [workbenchVisibleIds],
  )

  const handleWorkbenchColumnOrder = useCallback(
    (orderedConfigurableIds: string[]) => {
      const locked = workbenchColumnOrder.filter((id) => CATALOG_WORKBENCH_LOCKED_COLUMN_IDS.has(id))
      setColumnOrder([...orderedConfigurableIds, ...locked])
    },
    [workbenchColumnOrder, setColumnOrder],
  )

  const updateFilter = useCallback((patch: Partial<WorkbenchFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({ ...EMPTY_WORKBENCH_FILTERS, categoryId: initialCategoryId })
  }, [initialCategoryId])

  useEffect(() => {
    let cancelled = false
    void loadWorkbenchLayout().then((layout) => {
      if (cancelled) return
      setLeftCollapsed(layout.leftCollapsed)
      setRightPaneOpen(layout.rightPaneOpen)
      setLayoutReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!layoutReady) return
    void saveWorkbenchLayout({ leftCollapsed, rightPaneOpen })
  }, [layoutReady, leftCollapsed, rightPaneOpen])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [savedFilters, favs, presets] = await Promise.all([
        loadWorkbenchFilters(preferencesScope),
        loadFavouriteProductIds(preferencesScope),
        loadFilterPresets(preferencesScope),
      ])
      if (cancelled) return
      const setupReady =
        tealburySetup &&
        isTealburyCatalogueChoice(tealburySetup.catalogue_choice) &&
        !orderNeedsTealburyKitchenSetup(tealburySetup)
      setFilters({
        ...EMPTY_WORKBENCH_FILTERS,
        ...savedFilters,
        browseMode: setupReady || tealburySetup?.kitchen_range_id ? 'range' : (savedFilters.browseMode ?? 'category'),
        categoryId: initialCategoryId ?? tealburySetup?.kitchen_range_id ?? savedFilters.categoryId ?? null,
        productKind: setupReady ? (savedFilters.productKind ?? 'complete') : (savedFilters.productKind ?? 'all'),
      })
      setFavouriteIds(favs)
      setFilterPresets(presets)
      setPrefsReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [preferencesScope, initialCategoryId, tealburySetup])

  useEffect(() => {
    if (
      !tealburySetup ||
      !isTealburyCatalogueChoice(tealburySetup.catalogue_choice) ||
      orderNeedsTealburyKitchenSetup(tealburySetup)
    ) {
      appliedSetupRangeIdRef.current = null
      return
    }
    const rangeId = tealburySetup.kitchen_range_id ?? null
    if (appliedSetupRangeIdRef.current === rangeId) return
    appliedSetupRangeIdRef.current = rangeId
    setFilters((prev) => ({
      ...prev,
      browseMode: 'range',
      categoryId: rangeId,
      productKind: prev.productKind === 'all' ? 'complete' : prev.productKind,
    }))
  }, [tealburySetup])

  useEffect(() => {
    if (!prefsReady) return
    const t = window.setTimeout(() => {
      void saveWorkbenchFilters(preferencesScope, filters)
    }, 400)
    return () => window.clearTimeout(t)
  }, [filters, preferencesScope, prefsReady])

  useEffect(() => {
    if (!statusMessage) return
    const t = window.setTimeout(() => setStatusMessage(null), 4000)
    return () => window.clearTimeout(t)
  }, [statusMessage])

  useEffect(() => {
    if (!customerUserId || filtered.length === 0) return
    let cancelled = false
    const slice = filtered.slice(0, 40)
    void (async () => {
      const entries = await Promise.all(
        slice.map(async (p) => {
          const b = await resolveProductPriceBreakdown({
            product: p,
            customerUserId,
            doorFinish: tealburySetup?.door_finish ?? null,
          })
          return [p.id, b.sellPrice] as const
        }),
      )
      if (cancelled) return
      setSellPriceByProductId((prev) => {
        const next = { ...prev }
        for (const [id, price] of entries) next[id] = price
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [filtered, customerUserId, tealburySetup?.door_finish])

  const toggleFavourite = useCallback(
    (productId: string) => {
      setFavouriteIds((prev) => {
        const next = prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
        void saveFavouriteProductIds(preferencesScope, next)
        return next
      })
    },
    [preferencesScope],
  )

  const productUnitPrice = useCallback(
    (product: ProductRow) => sellPriceByProductId[product.id] ?? Number(product.unit_price),
    [sellPriceByProductId],
  )

  const persistPayload = useCallback(
    async (payload: CatalogPickerCommitPayload, successMessage: string) => {
      setCommitting(true)
      try {
        await onCommit(payload)
        if (immediate) await reloadOrderLines()
        setStatusMessage(successMessage)
      } catch (e) {
        console.error(e)
        setStatusMessage('Could not add line — please try again')
      } finally {
        setCommitting(false)
      }
    },
    [immediate, onCommit, reloadOrderLines],
  )

  const assemblyForCompleteProduct = useCallback(
    (productId: string) =>
      assemblies.find((a) => a.product_id === productId && (a.assembly_lines?.length ?? 0) > 0) ?? null,
    [assemblies],
  )

  const addAssemblyToBasket = useCallback(
    (assembly: AssemblyWithLines, quantity: number) => {
      const resolved =
        tealburySetup?.hinge_brand != null
          ? resolveAssemblyForHingeBrand(assembly, tealburySetup.hinge_brand, scopeProducts)
          : assembly
      if (linePersistence === 'immediate') {
        void persistPayload(
          { products: [], assemblies: [{ assembly: resolved, quantity }] },
          `Added ${quantity} × ${assembly.name} (complete unit BOM) to order`,
        )
        return
      }
      const unitPrice = (resolved.assembly_lines ?? []).reduce((sum, line) => {
        const product = line.product as ProductRow | undefined
        return sum + (product ? line.quantity * Number(product.unit_price) : 0)
      }, 0)
      setStaged((prev) => {
        const existing = prev.find((l) => l.kind === 'assembly' && l.assembly.id === resolved.id)
        if (existing && existing.kind === 'assembly') {
          return prev.map((l) =>
            l.id === existing.id ? { ...l, quantity: Math.min(99, l.quantity + quantity) } : l,
          )
        }
        return [
          ...prev,
          { kind: 'assembly', id: `a-${resolved.id}`, assembly: resolved, quantity, unitPrice },
        ]
      })
      setStatusMessage(`Added ${quantity} × ${assembly.name} to selection — confirm below`)
    },
    [linePersistence, persistPayload, tealburySetup?.hinge_brand, scopeProducts],
  )

  const handleOrderLineQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      if (!immediate || !orderId) return
      setMutatingOrderLineId(lineId)
      try {
        if (quantity < 1) {
          const { error } = await supabase.from('order_lines').delete().eq('id', lineId)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('order_lines')
            .update({ quantity })
            .eq('id', lineId)
          if (error) throw error
        }
        await recalcOrderTotals(orderId)
        await reloadOrderLines()
      } catch (e) {
        console.error(e)
        setStatusMessage('Could not update order line quantity.')
      } finally {
        setMutatingOrderLineId(null)
      }
    },
    [immediate, orderId, reloadOrderLines],
  )

  const handleOrderLineRemove = useCallback(
    async (lineId: string) => {
      if (!immediate || !orderId) return
      setMutatingOrderLineId(lineId)
      try {
        const { error } = await supabase.from('order_lines').delete().eq('id', lineId)
        if (error) throw error
        await recalcOrderTotals(orderId)
        await reloadOrderLines()
      } catch (e) {
        console.error(e)
        setStatusMessage('Could not remove order line.')
      } finally {
        setMutatingOrderLineId(null)
      }
    },
    [immediate, orderId, reloadOrderLines],
  )

  const addProductToBasket = useCallback(
    (product: ProductRow, quantity: number) => {
      const bom = completeProductIds.has(product.id) ? assemblyForCompleteProduct(product.id) : null
      if (bom) {
        addAssemblyToBasket(bom, quantity)
        return
      }
      if (linePersistence === 'immediate') {
        void persistPayload(
          { products: [{ product, quantity }], assemblies: [] },
          `Added ${quantity} × ${product.name} to order`,
        )
        return
      }
      const unitPrice = productUnitPrice(product)
      setStaged((prev) => {
        const existing = prev.find((l) => l.kind === 'product' && l.product.id === product.id)
        if (existing && existing.kind === 'product') {
          return prev.map((l) =>
            l.id === existing.id ? { ...l, quantity: Math.min(99, l.quantity + quantity) } : l,
          )
        }
        return [
          ...prev,
          { kind: 'product', id: `p-${product.id}`, product, quantity, unitPrice },
        ]
      })
      setStatusMessage(`Added ${quantity} × ${product.name} to selection — confirm below`)
    },
    [linePersistence, persistPayload, productUnitPrice, completeProductIds, assemblyForCompleteProduct, addAssemblyToBasket],
  )

  const commitBasket = useCallback(async () => {
    if (staged.length === 0) return
    const lineCount = staged.length
    const payload: CatalogPickerCommitPayload = {
      products: staged
        .filter((l): l is StagedCatalogLine & { kind: 'product' } => l.kind === 'product')
        .map((l) => ({ product: l.product, quantity: l.quantity })),
      assemblies: staged
        .filter((l): l is StagedCatalogLine & { kind: 'assembly' } => l.kind === 'assembly')
        .map((l) => ({ assembly: l.assembly, quantity: l.quantity })),
    }
    setCommitting(true)
    try {
      await onCommit(payload)
      setStaged([])
      setStatusMessage(`Added ${lineCount} line${lineCount === 1 ? '' : 's'}`)
    } catch (e) {
      console.error(e)
      setStatusMessage('Could not add lines — please try again')
    } finally {
      setCommitting(false)
    }
  }, [onCommit, staged])

  const filteredAssemblies = useMemo(() => {
    if (!filters.search.trim()) return assemblies
    const q = filters.search.trim().toLowerCase()
    return assemblies.filter((a) => {
      const name = (a.name ?? '').toLowerCase()
      const desc = (a.description ?? '').toLowerCase()
      return name.includes(q) || desc.includes(q)
    })
  }, [assemblies, filters.search])

  function saveCurrentFiltersAsPreset() {
    const name = window.prompt('Name this filter preset')
    if (!name?.trim()) return
    const preset: SavedFilterPreset = {
      id: `preset-${Date.now()}`,
      name: name.trim(),
      filters: { ...filters },
    }
    const next = [...filterPresets, preset]
    setFilterPresets(next)
    void saveFilterPresets(preferencesScope, next)
  }

  const showProductDetail =
    Boolean(selectedProduct && mainTab === 'products')

  const scrollTable = useCallback((direction: -1 | 1) => {
    const el = tableScrollRef.current
    if (!el) return
    el.scrollBy({ left: direction * Math.max(280, el.clientWidth * 0.65), behavior: 'smooth' })
  }, [])

  const workbenchClass = [
    'tb-workbench',
    embedded ? 'tb-workbench--embedded' : '',
    inModal ? 'tb-workbench--in-modal' : '',
    leftCollapsed ? 'tb-workbench--filters-collapsed' : '',
    !rightPaneOpen ? 'tb-workbench--right-hidden' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={buildBar ? 'kq-build-workspace' : undefined}>
      {buildBar}
    <article className={workbenchClass}>
      {statusMessage && (
        <p className="ordering-toast tb-workbench-toast" role="status">
          {statusMessage}
        </p>
      )}
      {tealburySetup &&
        isTealburyCatalogueChoice(tealburySetup.catalogue_choice) &&
        !orderNeedsTealburyKitchenSetup(tealburySetup) && (
        <p className="tb-workbench-setup-banner" role="status">
          Showing products for your kitchen setup (range, finish, and line style). Use filters below to narrow further.
        </p>
      )}

      <div
        className={
          inModal ? 'tb-workbench-panes' : 'tb-workbench-panes tb-workbench-panes--layout-pass-through'
        }
      >
      <aside className="tb-workbench-filters" aria-label="Product filters">
        <div className="tb-pane-toolbar tb-pane-toolbar--filters">
          <div className="tb-filters-head">
            <span className="tb-filters-head-icon" aria-hidden>
              <Filter size={18} strokeWidth={2} />
            </span>
            <div className="tb-filters-head-text">
              <h2>Product search</h2>
              <p>Filter by category, range, or unit type</p>
            </div>
          </div>
          <button
            type="button"
            className="tb-pane-toggle"
            onClick={() => setLeftCollapsed((v) => !v)}
            aria-expanded={!leftCollapsed}
            aria-label={leftCollapsed ? 'Expand filters' : 'Collapse filters'}
            title={leftCollapsed ? 'Expand filters' : 'Collapse filters'}
          >
            {leftCollapsed ? '»' : '«'}
          </button>
        </div>
        {!leftCollapsed && (
        <>

        <label className="tb-filter-field">
          <span>Product code</span>
          <input
            type="text"
            value={filters.productCode}
            onChange={(e) => updateFilter({ productCode: e.target.value })}
            placeholder="SKU or trade code"
            autoComplete="off"
          />
        </label>

        <div className="tb-filter-group">
          <span className="tb-filter-group-label">Browse by</span>
          <div className="tb-segmented" role="group" aria-label="Browse by">
            <button
              type="button"
              className={filters.browseMode === 'category' ? 'active' : ''}
              onClick={() => updateFilter({ browseMode: 'category', categoryId: null })}
            >
              Categories
            </button>
            <button
              type="button"
              className={filters.browseMode === 'range' ? 'active' : ''}
              onClick={() => updateFilter({ browseMode: 'range', categoryId: null })}
            >
              Kitchen range
            </button>
          </div>
          {canEditCatalogue && (
            <button
              type="button"
              className="tb-admin-inline-action"
              title="Admin · add, rename, delete or re-type categories"
              onClick={() => setManagingCategories(true)}
            >
              Manage categories…
            </button>
          )}
        </div>

        {filters.browseMode === 'range' && kitchenRangeBrowseOptions.length > 0 && (
          <div className="tb-filter-subgroup">
            <span className="tb-filter-subgroup-label">Kitchen range</span>
            <div className="tb-category-chips" role="list" aria-label="Kitchen ranges">
              <button
                type="button"
                role="listitem"
                className={`tb-category-chip${filters.categoryId === null ? ' active' : ''}`}
                onClick={() => updateFilter({ categoryId: null })}
              >
                All ({scopeProducts.length})
              </button>
              {kitchenRangeBrowseOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="listitem"
                  className={`tb-category-chip${filters.categoryId === opt.id ? ' active' : ''}`}
                  onClick={() => updateFilter({ categoryId: opt.id })}
                >
                  {opt.label}
                  {categoryCounts.has(opt.id) ? ` (${categoryCounts.get(opt.id)})` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {(filters.browseMode === 'category' || categoryBrowseOptions.length > 0) && (
          <div className="tb-filter-subgroup">
            <span className="tb-filter-subgroup-label">Categories</span>
            <div className="tb-category-chips" role="list" aria-label="Product categories">
              {filters.browseMode === 'category' && (
                <button
                  type="button"
                  role="listitem"
                  className={`tb-category-chip${filters.categoryId === null ? ' active' : ''}`}
                  onClick={() => updateFilter({ categoryId: null })}
                >
                  All ({scopeProducts.length})
                </button>
              )}
              {categoryBrowseOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="listitem"
                  className={`tb-category-chip${filters.categoryId === opt.id ? ' active' : ''}`}
                  onClick={() => updateFilter({ categoryId: opt.id })}
                >
                  {opt.depth > 0 ? '· ' : ''}
                  {opt.label}
                  {categoryCounts.has(opt.id) ? ` (${categoryCounts.get(opt.id)})` : ''}
                </button>
              ))}
            </div>
            <p className="tb-filter-hint">
              {filters.browseMode === 'range'
                ? 'Cross-range groups (hinges, cornice, lighting, etc.) — usable with any door range.'
                : 'Product groups such as units, cornice, pelmet, and lighting.'}
            </p>
          </div>
        )}

        {filters.browseMode === 'category' && facets.doorRanges.length > 0 && (
          <label className="tb-filter-field">
            <span>Door range</span>
            <select
              value={filters.doorRange ?? ''}
              onChange={(e) => updateFilter({ doorRange: e.target.value || null })}
            >
              <option value="">All door ranges</option>
              {facets.doorRanges.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        )}

        {tealburySetup && (
          <div className="tb-filter-group">
            <span className="tb-filter-group-label">
              <Layers size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} aria-hidden />
              Product type
            </span>
            <div className="tb-segmented" role="group" aria-label="Product type">
              <button
                type="button"
                className={filters.productKind === 'all' ? 'active' : ''}
                onClick={() => updateFilter({ productKind: 'all' })}
              >
                All
              </button>
              <button
                type="button"
                className={filters.productKind === 'complete' ? 'active' : ''}
                onClick={() => updateFilter({ productKind: 'complete' })}
              >
                Units
              </button>
              <button
                type="button"
                className={filters.productKind === 'components' ? 'active' : ''}
                onClick={() => updateFilter({ productKind: 'components' })}
              >
                Parts
              </button>
            </div>
          </div>
        )}

        {facets.sections.length > 0 && (
          <div className="tb-filter-group">
            <span className="tb-filter-group-label">Section</span>
            <div className="tb-category-chips" role="list">
              <button
                type="button"
                role="listitem"
                className={`tb-category-chip${filters.section === null ? ' active' : ''}`}
                onClick={() => updateFilter({ section: null })}
              >
                All
              </button>
              {facets.sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="listitem"
                  className={`tb-category-chip${filters.section === s.id ? ' active' : ''}`}
                  onClick={() => updateFilter({ section: s.id })}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {showCatalogueSwitcher && allowedCatalogPrograms.length > 1 && (
          <label className="tb-filter-field">
            <span>Catalogue</span>
            <select
              value={filters.catalogProgram ?? ''}
              onChange={(e) =>
                updateFilter({
                  catalogProgram: (e.target.value || null) as CatalogProgram | null,
                })
              }
            >
              <option value="">All catalogues</option>
              {allowedCatalogPrograms.map((prog) => (
                <option key={prog} value={prog}>
                  {catalogProgramLabel(prog)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="tb-check-row tb-filter-checkbox">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) => updateFilter({ inStockOnly: e.target.checked })}
          />
          In stock only
        </label>
        <label className="tb-check-row tb-filter-checkbox">
          <input
            type="checkbox"
            checked={filters.favouritesOnly}
            onChange={(e) => updateFilter({ favouritesOnly: e.target.checked })}
          />
          Favourites only
        </label>

        {filterPresets.length > 0 && (
          <label className="tb-filter-field">
            <span>Saved filters</span>
            <select
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value
                if (!id) return
                const preset = filterPresets.find((p) => p.id === id)
                if (preset) setFilters(preset.filters)
                e.target.value = ''
              }}
            >
              <option value="">Load preset…</option>
              {filterPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="button" className="btn btn-outline btn-small" onClick={saveCurrentFiltersAsPreset}>
          Save filters
        </button>
        <button type="button" className="btn btn-outline btn-small tb-filter-clear" onClick={clearFilters}>
          Clear filters
        </button>
        </>
        )}
      </aside>

      <section className="tb-workbench-main" aria-label="Product results">
        <header className="tb-workbench-toolbar">
          <form
            className="tb-search-form"
            onSubmit={(e) => {
              e.preventDefault()
            }}
          >
            <input
              type="search"
              className="tb-search-input"
              placeholder="Search products by name, code or description…"
              value={filters.search}
              onChange={(e) => updateFilter({ search: e.target.value })}
            />
            <button type="submit" className="btn btn-small">
              Search
            </button>
            {filters.search.trim() && (
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => updateFilter({ search: '' })}
              >
                Clear
              </button>
            )}
          </form>
          {!rightPaneOpen && (
            <button
              type="button"
              className="btn btn-outline btn-small tb-pane-reopen"
              onClick={() => setRightPaneOpen(true)}
            >
              Show order panel
              {(immediate ? orderLines.length : cartLineCount) > 0
                ? ` (${immediate ? orderLines.length : cartLineCount})`
                : ''}
            </button>
          )}
          <p className="tb-result-meta">
            <strong>{mainTab === 'products' ? filtered.length : filteredAssemblies.length}</strong>{' '}
            {mainTab === 'products' ? 'product' : 'unit'}
            {(mainTab === 'products' ? filtered.length : filteredAssemblies.length) === 1 ? '' : 's'}
          </p>
          <div className="tb-table-scroll-controls" role="group" aria-label="Scroll product table">
            <button
              type="button"
              className="tb-table-scroll-btn"
              onClick={() => scrollTable(-1)}
              aria-label="Scroll table left"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="tb-table-scroll-btn"
              onClick={() => scrollTable(1)}
              aria-label="Scroll table right"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          {mainTab === 'products' && (
            <ColumnSettings
              columnDefs={settingsColumnDefs}
              visibleIds={settingsVisibleIds}
              setColumnVisible={setColumnVisible}
              order={settingsColumnOrder}
              setColumnOrder={handleWorkbenchColumnOrder}
              resetToDefault={resetWorkbenchColumns}
              visibilityControl="radio"
              lockedColumnsHint="Qty and Add are always shown at the right of the table."
              tooltip="Product table columns — show, hide, and reorder"
            />
          )}
        </header>

        <div className="tb-workbench-tabs">
          <button
            type="button"
            className={mainTab === 'products' ? 'active' : ''}
            onClick={() => setMainTab('products')}
          >
            Products
          </button>
          {assemblies.length > 0 && (
            <button
              type="button"
              className={mainTab === 'assemblies' ? 'active' : ''}
              onClick={() => setMainTab('assemblies')}
            >
              Complete units
            </button>
          )}
        </div>

        {mainTab === 'products' ? (
        <div className="tb-table-wrap" ref={tableScrollRef}>
          <table
            className="tb-product-table"
            style={{ minWidth: `${Math.max(480, tableColumnIds.length * 96)}px` }}
          >
            <colgroup>
              {tableColumnIds.map((colId) => (
                <col key={colId} className={workbenchTableColClass(colId)} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {tableColumnIds.map((colId) => (
                  <th key={colId} scope="col" className={workbenchTableCellClass(colId)}>
                    {colId === 'action' ? (
                      <span className="visually-hidden">{workbenchTableColumnLabel(colId)}</span>
                    ) : (
                      workbenchTableColumnLabel(colId)
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnIds.length} className="tb-table-empty">
                    No products match your filters. Try clearing search or choosing another range.
                  </td>
                </tr>
              ) : (
                filtered.map((product) => {
                  const isSelected = product.id === selectedProductId
                  const sell = productUnitPrice(product)
                  const qty = rowQtyById[product.id] ?? 1
                  const rangeName = product.category_id ? catMap.get(product.category_id) : undefined
                  const categoryLabel = rangeName ?? undefined
                  const visibleColumnIds = new Set(workbenchVisibleIds)

                  return (
                    <tr
                      key={product.id}
                      className={isSelected ? 'tb-row-selected' : undefined}
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      {tableColumnIds.map((colId) => (
                        <td
                          key={colId}
                          className={workbenchTableCellClass(colId)}
                          onClick={
                            colId === 'qty' || colId === 'action'
                              ? (e) => e.stopPropagation()
                              : undefined
                          }
                        >
                          {colId !== 'qty' &&
                            colId !== 'action' &&
                            renderWorkbenchProductCell(colId, {
                              product,
                              rangeName,
                              sell,
                              visibleColumnIds,
                              categoryLabel,
                            })}
                          {colId === 'qty' && (
                            <div className="qty-stepper qty-stepper--compact">
                              <button
                                type="button"
                                className="qty-stepper-btn"
                                onClick={() =>
                                  setRowQtyById((prev) => ({
                                    ...prev,
                                    [product.id]: Math.max(1, (prev[product.id] ?? 1) - 1),
                                  }))
                                }
                              >
                                −
                              </button>
                              <input
                                className="qty-stepper-input"
                                inputMode="numeric"
                                value={qty}
                                onChange={(e) => {
                                  const n = Number(e.target.value)
                                  setRowQtyById((prev) => ({
                                    ...prev,
                                    [product.id]: Number.isFinite(n) && n > 0 ? Math.floor(n) : 1,
                                  }))
                                }}
                              />
                              <button
                                type="button"
                                className="qty-stepper-btn"
                                onClick={() =>
                                  setRowQtyById((prev) => ({
                                    ...prev,
                                    [product.id]: Math.min(99, (prev[product.id] ?? 1) + 1),
                                  }))
                                }
                              >
                                +
                              </button>
                            </div>
                          )}
                          {colId === 'action' && (
                            <div className="tb-row-actions">
                              <button
                                type="button"
                                className="btn btn-small tb-btn-add"
                                onClick={() => addProductToBasket(product, qty)}
                              >
                                Add
                              </button>
                              {canEditCatalogue && (
                                <button
                                  type="button"
                                  className="tb-admin-row-edit"
                                  title={`Edit "${product.name}" (admin)`}
                                  aria-label={`Edit ${product.name}`}
                                  onClick={() => setEditingProduct(product)}
                                >
                                  ✎
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        ) : (
        <div className="tb-table-wrap" ref={tableScrollRef}>
          <table className="tb-product-table">
            <thead>
              <tr>
                <th scope="col">Unit</th>
                <th scope="col">Description</th>
                <th scope="col">Price</th>
                <th scope="col">Qty</th>
                <th scope="col"><span className="visually-hidden">Add</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredAssemblies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="tb-table-empty">No complete units match your search.</td>
                </tr>
              ) : (
                filteredAssemblies.map((assembly) => {
                  const unitPrice = (assembly.assembly_lines ?? []).reduce((sum, line) => {
                    const product = line.product as ProductRow | undefined
                    return sum + (product ? line.quantity * Number(product.unit_price) : 0)
                  }, 0)
                  const qty = assemblyQtyById[assembly.id] ?? 1
                  return (
                    <tr key={assembly.id}>
                      <td><strong>{assembly.name}</strong></td>
                      <td>{assembly.description ?? '—'}</td>
                      <td>
                        <strong>£{unitPrice.toFixed(2)}</strong>
                        <span className="tb-muted"> ex VAT</span>
                      </td>
                      <td>
                        <div className="qty-stepper qty-stepper--compact">
                          <button
                            type="button"
                            className="qty-stepper-btn"
                            onClick={() =>
                              setAssemblyQtyById((prev) => ({
                                ...prev,
                                [assembly.id]: Math.max(1, (prev[assembly.id] ?? 1) - 1),
                              }))
                            }
                          >
                            −
                          </button>
                          <input
                            className="qty-stepper-input"
                            value={qty}
                            onChange={(e) => {
                              const n = Number(e.target.value)
                              setAssemblyQtyById((prev) => ({
                                ...prev,
                                [assembly.id]: Number.isFinite(n) && n > 0 ? Math.floor(n) : 1,
                              }))
                            }}
                          />
                          <button
                            type="button"
                            className="qty-stepper-btn"
                            onClick={() =>
                              setAssemblyQtyById((prev) => ({
                                ...prev,
                                [assembly.id]: Math.min(99, (prev[assembly.id] ?? 1) + 1),
                              }))
                            }
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-small tb-btn-add"
                          onClick={() => addAssemblyToBasket(assembly, qty)}
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        )}
      </section>

      {rightPaneOpen && (
      <aside
        className={`tb-workbench-right${showProductDetail ? ' tb-workbench-right--detail-open' : ''}`}
        aria-label="Order and product details"
      >
        <div className="tb-right-pane-toolbar">
          <span className="tb-right-pane-toolbar-label">Order panel</span>
          <button
            type="button"
            className="tb-pane-toggle tb-pane-toggle--detail"
            onClick={() => setRightPaneOpen(false)}
            title="Hide order panel"
          >
            Hide panel
          </button>
        </div>

        <div className="tb-right-pane-body">
          {showProductDetail && selectedProduct ? (
            <div className="tb-right-pane-stack">
              <div className="tb-right-pane-detail">
                <CatalogProductDetailPanel
                  product={selectedProduct}
                  categories={effectiveCategories}
                  customerUserId={customerUserId}
                  doorFinish={tealburySetup?.door_finish ?? null}
                  isComplete={completeProductIds.has(selectedProduct.id)}
                  isFavourite={favouriteSet.has(selectedProduct.id)}
                  onToggleFavourite={() => toggleFavourite(selectedProduct.id)}
                  onClose={() => setSelectedProductId(null)}
                  onAddToBasket={addProductToBasket}
                  addButtonLabel={addButtonLabel}
                  adding={committing}
                  onAdminEdit={canEditCatalogue ? () => setEditingProduct(selectedProduct) : undefined}
                />
              </div>
              <div className="tb-right-pane-order tb-right-pane-order--below-detail">
                {immediate ? (
                  <CatalogOrderLinesPanel
                    lines={orderLines}
                    loading={orderLinesLoading}
                    cartHref={cartHref}
                    onQuantityChange={handleOrderLineQuantity}
                    onRemoveLine={handleOrderLineRemove}
                    mutatingLineId={mutatingOrderLineId}
                  />
                ) : (
                  <CatalogProductStagingBasket
                    lines={staged}
                    linePersistence={linePersistence}
                    cartLineCount={cartLineCount}
                    cartHref={cartHref}
                    commitLabel={commitLabel}
                    onQuantityChange={(lineId, quantity) => {
                      setStaged((prev) => prev.map((l) => (l.id === lineId ? { ...l, quantity } : l)))
                    }}
                    onRemove={(lineId) => setStaged((prev) => prev.filter((l) => l.id !== lineId))}
                    onClear={() => setStaged([])}
                    onCommit={() => void commitBasket()}
                    committing={committing}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="tb-right-pane-order">
              {immediate ? (
                <CatalogOrderLinesPanel
                  lines={orderLines}
                  loading={orderLinesLoading}
                  cartHref={cartHref}
                  onQuantityChange={handleOrderLineQuantity}
                  onRemoveLine={handleOrderLineRemove}
                  mutatingLineId={mutatingOrderLineId}
                />
              ) : (
                <CatalogProductStagingBasket
                  lines={staged}
                  linePersistence={linePersistence}
                  cartLineCount={cartLineCount}
                  cartHref={cartHref}
                  commitLabel={commitLabel}
                  onQuantityChange={(lineId, quantity) => {
                    setStaged((prev) => prev.map((l) => (l.id === lineId ? { ...l, quantity } : l)))
                  }}
                  onRemove={(lineId) => setStaged((prev) => prev.filter((l) => l.id !== lineId))}
                  onClear={() => setStaged([])}
                  onCommit={() => void commitBasket()}
                  committing={committing}
                />
              )}
            </div>
          )}
        </div>

        {!(showProductDetail && selectedProduct) ? (
          <p className="tb-right-pane-hint">Select a product row to view details and add lines below.</p>
        ) : null}
      </aside>
      )}
      </div>

      {canEditCatalogue && editingProduct && (
        <AdminProductModal
          key={editingProduct.id}
          product={editingProduct}
          categories={effectiveCategories}
          productCategoryMap={productCategoryMap}
          canEditCatalogue
          partTypes={assemblyPartTypes}
          partTypeLabels={assemblyPartTypeLabels}
          allProducts={effectiveProducts}
          onClose={() => setEditingProduct(null)}
          onSaved={() => void refreshCatalogueFromDb()}
          onCategoriesChange={(next) => setCategoriesOverride(next)}
          onPartTypesChange={() => void reloadAssemblyPartTypes()}
          onProductSaved={(productId, categoryIds, primary) => {
            setProductCategoryMap((prev) => {
              const next = new Map(prev)
              next.set(productId, categoryIds)
              return next
            })
            setProductsOverride((prev) => {
              const base = prev ?? products
              return base.map((p) => (p.id === productId ? { ...p, category_id: primary } : p))
            })
            setEditingProduct((prev) =>
              prev && prev.id === productId ? { ...prev, category_id: primary } : prev,
            )
          }}
        />
      )}

      {canEditCatalogue &&
        managingCategories &&
        createPortal(
          <div
            className="admin-modal-overlay admin-modal-overlay--top"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workbench-categories-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setManagingCategories(false)
            }}
          >
            <div className="admin-modal card tb-categories-modal">
              <header className="tb-categories-modal-header">
                <div>
                  <h2 id="workbench-categories-modal-title">Manage categories</h2>
                  <p className="admin-muted tb-categories-modal-sub">
                    Add, rename, re-parent, or delete categories. Changes apply to the ordering
                    screen immediately.
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-modal-close"
                  onClick={() => setManagingCategories(false)}
                  aria-label="Close manage categories"
                >
                  ×
                </button>
              </header>
              <div className="tb-categories-modal-body">
                <CatalogueCategoriesManager
                  categories={effectiveCategories}
                  products={effectiveProducts}
                  productCategoryMap={productCategoryMap}
                  onChanged={() => void refreshCatalogueFromDb()}
                  variant="embedded"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </article>
    </div>
  )
}
