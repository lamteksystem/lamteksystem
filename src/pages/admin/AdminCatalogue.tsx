import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CatalogueCategoriesManager from '@/components/admin/CatalogueCategoriesManager'
import CatalogueTealburyImportBlock from '@/components/admin/CatalogueTealburyImportBlock'
import SmartCategoriseModal from '@/components/admin/SmartCategoriseModal'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { supabase } from '@/lib/supabase'
import { useAdminUi } from '@/contexts/AdminUiContext'
import AdminProductModal from '@/components/admin/AdminProductModal'
import { ColumnSettings } from '@/components/admin/ColumnSettings'
import {
  HorizontalScrollWithArrows,
  HorizontalScrollToolbarArrows,
  type HorizontalScrollHandle,
  type HorizontalScrollState,
} from '@/components/admin/HorizontalScrollWithArrows'
import { StockMtmSwitch } from '@/components/admin/StockMtmSwitch'
import { useColumnVisibility } from '@/hooks/useColumnVisibility'
import { useColumnWidths } from '@/hooks/useColumnWidths'
import { usePermission } from '@/hooks/usePermission'
import { useAssemblyPartTypes } from '@/hooks/useAssemblyPartTypes'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import { fetchCompleteProductIds } from '@/lib/productAssembly'
import {
  categorySlugMatchesImported,
  fetchProductCategoryMap,
  formatCategoryNames,
  getProductCategoryIds,
  normalizeCategorySelection,
  productMatchesAnyCategorySlug,
  productMatchesCategoryFilter,
  saveProductCategories,
  type ProductCategoryMap,
} from '@/lib/productCategories'
import { ProductCategoryMultiSelect } from '@/components/admin/ProductCategoryMultiSelect'
import type { CategoryRow } from '@/types/database'
import type { ProductRow } from '@/types/database'
import ListPager from '@/components/admin/ListPager'
import { useListPagination, normalizePageSize } from '@/lib/listPagination'
import { fetchAllProducts } from '@/lib/supabaseFetchAll'
import {
  buildExportRows,
  downloadCsv,
  downloadXlsx,
  parseCsvFile,
  parseXlsxFile,
  runCatalogueAudit,
  parseImageMappingCsv,
  matchImageRowsToProducts,
  type CatalogueImportRow,
  type ImportResult,
  type CatalogueAuditResult,
  type ImageMappingRow,
  type ImageMatchResult,
} from '@/lib/catalogue-import-export'

type CatalogueViewType = 'table' | 'grid' | 'list' | 'compact'

const CATALOGUE_COLUMNS = [
  { id: 'image', label: 'Image' },
  { id: 'name', label: 'Name' },
  { id: 'sku', label: 'SKU' },
  { id: 'category', label: 'Category' },
  { id: 'description', label: 'Description' },
  { id: 'unit_price', label: 'Default customer price' },
  { id: 'cost_price', label: 'Lamtek cost price' },
  { id: 'stock', label: 'Stock & qty' },
  { id: 'active', label: 'Active' },
]

/** Default column widths (px) when the user has not resized a column. */
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  image: 64,
  name: 240,
  sku: 100,
  category: 120,
  description: 280,
  unit_price: 88,
  cost_price: 88,
  stock: 120,
  active: 72,
}

/** Minimum widths while drag-resizing (can be narrower than title text; headers wrap). */
const COLUMN_RESIZE_MIN_WIDTHS: Record<string, number> = {
  image: 56,
  name: 120,
  sku: 80,
  category: 100,
  description: 140,
  unit_price: 72,
  cost_price: 72,
  stock: 100,
  active: 64,
}

function catalogueColumnWidth(columnId: string, saved: Record<string, number>): number {
  const fallback = DEFAULT_COLUMN_WIDTHS[columnId] ?? 100
  const min = COLUMN_RESIZE_MIN_WIDTHS[columnId] ?? 60
  const raw = saved[columnId]
  if (raw == null || !Number.isFinite(raw) || raw < min) return fallback
  return raw
}

const CENTER_ALIGN_COLUMNS = new Set(['image', 'stock', 'active', 'unit_price', 'cost_price'])

/** Price columns use wrapped header labels so they can stay narrow. */
const WRAP_HEADER_COLUMNS = new Set(['unit_price', 'cost_price', 'stock'])

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'other'
}

export default function AdminCatalogue() {
  const { tableDensity, rowsPerPage } = useAdminUi()
  const { allowed: canEditCatalogue } = usePermission('admin.catalogue', 'edit')
  const columnVisibility = useColumnVisibility('catalogue', CATALOGUE_COLUMNS)
  const { visibleIds, setColumnVisible, setColumnOrder, resetToDefault, isVisible, columnDefs, order } = columnVisibility
  const [editingCell, setEditingCell] = useState<{ productId: string; field: string } | null>(null)
  const [inlineSaving, setInlineSaving] = useState(false)
  const [headerDrop, setHeaderDrop] = useState<{ targetId: string; position: 'before' | 'after' } | null>(null)
  const [headerDraggingId, setHeaderDraggingId] = useState<string | null>(null)
  const { widths: columnWidths, setWidth, persistWidths } = useColumnWidths('catalogue')
  const [resizingColId, setResizingColId] = useState<string | null>(null)
  const resizeStartRef = useRef({ x: 0, width: 0 })
  const catalogueScrollRef = useRef<HorizontalScrollHandle>(null)
  const [catalogueScrollState, setCatalogueScrollState] = useState<HorizontalScrollState>({
    canScrollLeft: false,
    canScrollRight: false,
  })
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [productCategoryMap, setProductCategoryMap] = useState<ProductCategoryMap>(new Map())
  const [categoryEditDraft, setCategoryEditDraft] = useState<{
    productId: string
    ids: string[]
    primary: string
  } | null>(null)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [searchFilter, setSearchFilter] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [stockOnly, setStockOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'sku_asc' | 'sku_desc' | 'price_asc' | 'price_desc'>('name_asc')
  const [catalogProgramFilter, setCatalogProgramFilter] = useState<'all' | 'lamtek' | 'tealbury'>('all')
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const catalogueTab: 'browse' | 'import' | 'audit' | 'images' =
    tabParam === 'import' || tabParam === 'audit' || tabParam === 'images' ? tabParam : 'browse'

  function setCatalogueTab(next: 'browse' | 'import' | 'audit' | 'images') {
    if (next === 'browse') setSearchParams({}, { replace: true })
    else setSearchParams({ tab: next }, { replace: true })
  }
  const [productGroupFilter, setProductGroupFilter] = useState<'all' | 'doors_fronts' | 'carcasses' | 'accessories'>('all')
  const [viewType, setViewType] = useState<CatalogueViewType>('table')
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null)
  const [smartCategoriseOpen, setSmartCategoriseOpen] = useState(false)
  const [completeProductIds, setCompleteProductIds] = useState<Set<string>>(new Set())
  const {
    types: assemblyPartTypes,
    labels: assemblyPartTypeLabels,
    reload: reloadAssemblyPartTypes,
  } = useAssemblyPartTypes(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageAssignResult, setImageAssignResult] = useState<{ updated: number; skipped: string[] } | null>(null)
  const [imageMappingRows, setImageMappingRows] = useState<ImageMappingRow[] | null>(null)
  const [imageMatchResults, setImageMatchResults] = useState<ImageMatchResult[] | null>(null)
  const [imageMatchThreshold, setImageMatchThreshold] = useState(0.8)
  const [imageAssignSaving, setImageAssignSaving] = useState(false)
  const [imageApplyAllSaving, setImageApplyAllSaving] = useState(false)
  const [imageReviewModalIndex, setImageReviewModalIndex] = useState<number | null>(null)
  const [imageReviewOverrideProductIds, setImageReviewOverrideProductIds] = useState<Set<string>>(new Set())
  const [imageReviewProductSearch, setImageReviewProductSearch] = useState('')
  const [isStockUpdating, setIsStockUpdating] = useState<string | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const xlsxInputRef = useRef<HTMLInputElement>(null)
  const productImagesInputRef = useRef<HTMLInputElement>(null)
  const imageMappingCsvRef = useRef<HTMLInputElement>(null)
  const [auditResult, setAuditResult] = useState<CatalogueAuditResult | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const auditFileRef = useRef<HTMLInputElement>(null)
  /** Delay opening the product modal so double-click inline edit on the same row can cancel it. */
  const openProductModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelPendingProductModal() {
    if (openProductModalTimerRef.current) {
      clearTimeout(openProductModalTimerRef.current)
      openProductModalTimerRef.current = null
    }
  }

  function scheduleOpenProductModal(p: ProductRow) {
    if (editingCell) return
    cancelPendingProductModal()
    openProductModalTimerRef.current = setTimeout(() => {
      openProductModalTimerRef.current = null
      setSelectedProduct(p)
    }, 420)
  }

  useEffect(() => {
    if (!canEditCatalogue) setEditingCell(null)
  }, [canEditCatalogue])

  useEffect(() => {
    return () => cancelPendingProductModal()
  }, [])

  useEffect(() => {
    if (editingCell) cancelPendingProductModal()
  }, [editingCell])

  async function toggleIsStock(p: ProductRow) {
    if (!canEditCatalogue) return
    setIsStockUpdating(p.id)
    const next = !(p.is_stock !== false)
    const { error } = await supabase.from('products').update({ is_stock: next }).eq('id', p.id)
    if (!error) setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_stock: next } : x)))
    setIsStockUpdating(null)
  }

  async function saveInlineEdit(productId: string, field: string, value: string | number | boolean | null) {
    if (!canEditCatalogue) {
      setEditingCell(null)
      return
    }
    setInlineSaving(true)
    setEditingCell(null)
    let v: string | number | boolean | null = value
    if (field === 'stock_quantity') {
      const n = typeof value === 'number' ? value : parseInt(String(value), 10)
      v = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
    }
    const payload: Record<string, unknown> = { [field]: v }
    const { error } = await supabase.from('products').update(payload).eq('id', productId)
    if (!error) {
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, [field]: value } : p))
      )
    }
    setInlineSaving(false)
  }

  async function load() {
    const [catRes, allProducts, catMap, completeIds] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order').order('name'),
      fetchAllProducts(),
      fetchProductCategoryMap(),
      fetchCompleteProductIds(),
    ])
    setCategories(catRes.data ?? [])
    setProducts(allProducts)
    setProductCategoryMap(catMap)
    setCompleteProductIds(completeIds)
    setLoading(false)
  }

  async function saveInlineCategories(productId: string, ids: string[], primary: string) {
    if (!canEditCatalogue) {
      setEditingCell(null)
      setCategoryEditDraft(null)
      return
    }
    setInlineSaving(true)
    const normalized = normalizeCategorySelection(ids, primary)
    const result = await saveProductCategories(productId, normalized.ids, normalized.primary)
    if (result.error) {
      window.alert(`Could not save categories: ${result.error}`)
      setInlineSaving(false)
      return
    }
    setProductCategoryMap((prev) => {
      const next = new Map(prev)
      next.set(productId, result.categoryIds)
      return next
    })
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, category_id: result.primaryCategoryId } : p))
    )
    setCategoryEditDraft(null)
    setEditingCell(null)
    setInlineSaving(false)
  }

  useEffect(() => {
    load()
  }, [])

  const columnWidthsRef = useRef(columnWidths)
  columnWidthsRef.current = columnWidths
  useEffect(() => {
    if (!resizingColId) return
    const minW = COLUMN_RESIZE_MIN_WIDTHS[resizingColId] ?? 60
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartRef.current.x
      const newW = Math.max(minW, resizeStartRef.current.width + delta)
      setWidth(resizingColId, newW)
    }
    const onUp = () => {
      persistWidths(columnWidthsRef.current)
      setResizingColId(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingColId, setWidth, persistWidths])

  const categoryMap = new Map(categories.map((c) => [c.id, c]))
  const searchLower = searchFilter.trim().toLowerCase()

  function matchesProductGroup(p: ProductRow): boolean {
    if (productGroupFilter === 'all') return true
    const catIds = getProductCategoryIds(p.id, p.category_id, productCategoryMap)
    return productMatchesAnyCategorySlug(catIds, p.category_id, categoryMap, (slugLower) => {
      if (productGroupFilter === 'doors_fronts') {
        return slugLower === 'doors' || categorySlugMatchesImported(slugLower, 'doors')
      }
      if (productGroupFilter === 'carcasses') {
        return slugLower === 'carcasses' || categorySlugMatchesImported(slugLower, 'carcasses')
      }
      if (productGroupFilter === 'accessories') {
        return ['hinges-fittings', 'legs-plinth', 'handles', 'wirework', 'fittings', 'lighting'].some(
          (b) => slugLower === b || categorySlugMatchesImported(slugLower, b)
        )
      }
      return true
    })
  }

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (categoryFilter) {
          const catIds = getProductCategoryIds(p.id, p.category_id, productCategoryMap)
          if (
            !productMatchesCategoryFilter(
              catIds,
              p.category_id,
              categoryFilter,
              categoryMap,
              categorySlugMatchesImported,
            )
          ) {
            return false
          }
        }
        if (catalogProgramFilter !== 'all') {
          const prog = p.catalog_program ?? CATALOG_PROGRAM.LAMTEK
          if (prog !== catalogProgramFilter) return false
        }
        if (!matchesProductGroup(p)) return false
        if (activeOnly && !p.active) return false
        if (stockOnly && p.is_stock === false) return false
        if (!searchLower) return true
        const name = (p.name ?? '').toLowerCase()
        const sku = (p.sku ?? '').toLowerCase()
        const desc = (p.description ?? '').toLowerCase()
        return name.includes(searchLower) || sku.includes(searchLower) || desc.includes(searchLower)
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name_asc':
            return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
          case 'name_desc':
            return (b.name ?? '').localeCompare(a.name ?? '', undefined, { sensitivity: 'base' })
          case 'sku_asc':
            return (a.sku ?? '').localeCompare(b.sku ?? '', undefined, { sensitivity: 'base' })
          case 'sku_desc':
            return (b.sku ?? '').localeCompare(a.sku ?? '', undefined, { sensitivity: 'base' })
          case 'price_asc':
            return Number(a.unit_price) - Number(b.unit_price)
          case 'price_desc':
            return Number(b.unit_price) - Number(a.unit_price)
          default:
            return 0
        }
      })
  }, [
    products,
    categoryFilter,
    productCategoryMap,
    categoryMap,
    categories,
    catalogProgramFilter,
    productGroupFilter,
    activeOnly,
    stockOnly,
    searchLower,
    sortBy,
  ])

  const {
    pageItems: pagedProducts,
    totalItems: filteredTotal,
    totalPages,
    currentPage,
    pageSize,
    setPageSize,
    rangeStart,
    rangeEnd,
    goToPage,
  } = useListPagination(filteredProducts, {
    defaultPageSize: normalizePageSize(rowsPerPage),
    resetDeps: [
      categoryFilter,
      searchFilter,
      activeOnly,
      stockOnly,
      sortBy,
      catalogProgramFilter,
      productGroupFilter,
    ],
  })

  const categoriesByParent = categories.filter((c) => !c.parent_id)

  const visibleCatalogueCols = useMemo(
    () => columnDefs.filter((c) => isVisible(c.id)),
    [columnDefs, visibleIds]
  )

  const catalogueTableWidthPx = useMemo(
    () => visibleCatalogueCols.reduce((sum, c) => sum + catalogueColumnWidth(c.id, columnWidths), 0),
    [visibleCatalogueCols, columnWidths]
  )

  const LAMTEK_PRODUCT_IMAGES_LINK = 'https://www.lamtek.co.uk/products'

  async function handleProductImagesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setImageUploading(true)
    setImageAssignResult(null)
    const uploadedPaths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = safeName
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (error) {
        setImageAssignResult({ updated: 0, skipped: [`${file.name}: ${error.message}`] })
        setImageUploading(false)
        e.target.value = ''
        return
      }
      uploadedPaths.push(path)
    }
    let updated = 0
    const skipped: string[] = []
    for (const path of uploadedPaths) {
      const base = path.replace(/\.[^.]+$/, '')
      const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(path)
      const url = publicUrlData.publicUrl
      const match = products.find((p) => p.sku && p.sku.trim().toLowerCase() === base.toLowerCase())
      if (match) {
        const { error: upErr } = await supabase.from('products').update({ image_url: url, image_alt: match.name }).eq('id', match.id)
        if (!upErr) updated++
        else skipped.push(`${path}: ${upErr.message}`)
      } else {
        skipped.push(`${path} (no product with SKU "${base}")`)
      }
    }
    setImageAssignResult({ updated, skipped })
    setImageUploading(false)
    e.target.value = ''
    if (updated > 0) load()
  }

  async function handleImageMappingCsvSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImageAssignResult(null)
    try {
      const rows = await parseImageMappingCsv(file)
      setImageMappingRows(rows)
      const results = matchImageRowsToProducts(products, rows, imageMatchThreshold)
      setImageMatchResults(results)
    } catch (err) {
      setImageMatchResults(null)
      setImageMappingRows(null)
      setImageAssignResult({ updated: 0, skipped: [err instanceof Error ? err.message : 'Failed to parse CSV'] })
    }
  }

  function rerunImageMatching() {
    if (!imageMappingRows?.length) return
    const results = matchImageRowsToProducts(products, imageMappingRows, imageMatchThreshold)
    setImageMatchResults(results)
  }

  function openImageReviewModal(index: number) {
    setImageReviewModalIndex(index)
    setImageReviewProductSearch('')
    const r = imageMatchResults?.[index]
    setImageReviewOverrideProductIds(new Set((r?.products ?? []).map((p) => p.id)))
  }

  async function saveImageAssignment() {
    const idx = imageReviewModalIndex
    const r = idx != null ? imageMatchResults?.[idx] : null
    if (idx == null || !r || imageAssignSaving) return
    const productIds = imageReviewOverrideProductIds.size ? Array.from(imageReviewOverrideProductIds) : (r.products.map((p) => p.id))
    if (!productIds.length) {
      setImageReviewModalIndex(null)
      return
    }
    setImageAssignSaving(true)
    const { error } = await supabase
      .from('products')
      .update({ image_url: r.imageUrl, image_alt: products.find((p) => p.id === productIds[0])?.name ?? null })
      .in('id', productIds)
    setImageAssignSaving(false)
    setImageReviewModalIndex(null)
    if (!error) {
      load()
      setImageMatchResults((prev) => {
        if (!prev) return prev
        const next = [...prev]
        next[idx] = { ...next[idx], products: products.filter((p) => productIds.includes(p.id)), status: 'matched' }
        return next
      })
    }
  }

  async function applyAllImageAssignments() {
    if (!imageMatchResults?.length || imageApplyAllSaving) return
    setImageApplyAllSaving(true)
    let updated = 0
    for (const r of imageMatchResults) {
      if (r.status !== 'matched' || !r.products.length) continue
      const productIds = r.products.map((p) => p.id)
      const { error } = await supabase
        .from('products')
        .update({ image_url: r.imageUrl, image_alt: r.products[0]?.name ?? null })
        .in('id', productIds)
      if (!error) updated += productIds.length
    }
    setImageApplyAllSaving(false)
    if (updated > 0) load()
  }

  function handleExportCsv() {
    const rows = buildExportRows(products, categories)
    downloadCsv(rows, `catalogue-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function handleExportXlsx() {
    const rows = buildExportRows(products, categories)
    downloadXlsx(rows, `catalogue-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function runImport(rows: CatalogueImportRow[]): Promise<ImportResult> {
    const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }
    const slugToId = new Map<string, string>(
      (await supabase.from('categories').select('id, slug')).data?.map((c) => [c.slug, c.id]) ?? []
    )

    for (const row of rows) {
      const catSlug = row.category_slug || slugify(row.category_name || 'other')
      let catId = slugToId.get(catSlug)
      if (!catId) {
        const { data: newCat, error: catErr } = await supabase
          .from('categories')
          .insert({
            name: row.category_name || catSlug.replace(/-/g, ' '),
            slug: catSlug,
            sort_order: 0,
          })
          .select('id')
          .single()
        if (catErr) {
          result.errors.push(`Category ${catSlug}: ${catErr.message}`)
          result.skipped++
          continue
        }
        const newId = newCat?.id
        if (newId) {
          catId = newId
          slugToId.set(catSlug, newId)
        }
      }
      if (!catId) {
        result.skipped++
        continue
      }

      const payload = {
        category_id: catId,
        name: row.name.slice(0, 255),
        description: row.description || null,
        sku: row.sku || null,
        unit_price: Math.max(0, row.unit_price),
        active: row.active,
        sort_order: 0,
        image_url: row.image_url || null,
        image_alt: row.image_alt || null,
        is_stock: row.is_stock !== false,
      }

      if (row.sku) {
        const { data: existing } = await supabase.from('products').select('id').eq('sku', row.sku).maybeSingle()
        if (existing) {
          const { error: upErr } = await supabase.from('products').update(payload).eq('id', existing.id)
          if (upErr) result.errors.push(`Update ${row.sku}: ${upErr.message}`)
          else result.updated++
          continue
        }
      }

      const { error: insErr } = await supabase.from('products').insert(payload)
      if (insErr) {
        result.errors.push(`Insert ${row.name}: ${insErr.message}`)
        result.skipped++
      } else {
        result.inserted++
      }
    }
    return result
  }

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const rows = await parseCsvFile(file)
      const result = await runImport(rows)
      setImportResult(result)
      await load()
    } catch (err) {
      setImportResult({ inserted: 0, updated: 0, skipped: 0, errors: [err instanceof Error ? err.message : 'Import failed'] })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleImportXlsx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const rows = await parseXlsxFile(file)
      const result = await runImport(rows)
      setImportResult(result)
      await load()
    } catch (err) {
      setImportResult({ inserted: 0, updated: 0, skipped: 0, errors: [err instanceof Error ? err.message : 'Import failed'] })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleAuditFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAuditLoading(true)
    setAuditResult(null)
    try {
      const rows = file.name.toLowerCase().endsWith('.csv')
        ? await parseCsvFile(file)
        : await parseXlsxFile(file)
      const result = runCatalogueAudit(rows, products.map((p) => ({ id: p.id, sku: p.sku })))
      setAuditResult(result)
    } catch (err) {
      setAuditResult({
        missingInDb: [],
        extraInDb: [],
        duplicateSkus: [],
        fileSkuCount: 0,
        dbProductCount: products.length,
      })
    } finally {
      setAuditLoading(false)
      e.target.value = ''
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading catalogue…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <p className="page-intro">
        Browse Lamtek and Tealbury products in one place. Use <strong>Import &amp; export</strong> for Lamtek CSV/XLSX and the Tealbury customer workbook; <strong>Audit</strong> and <strong>Images</strong> for tools that are used less often.
      </p>

      {canEditCatalogue && (
        <div className="admin-catalogue-quick-tools" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Link to="/admin/catalogue/components/import" className="btn btn-small">
            Component import / export
          </Link>
          <Link to="/admin/catalogue/components/variant-builder" className="btn btn-small btn-outline">
            Variant matrix builder
          </Link>
          <Link to="/admin/catalogue/wipe" className="btn btn-small btn-danger-outline">
            Reset catalogue
          </Link>
        </div>
      )}

      <div className="admin-catalogue-tabs" role="tablist" aria-label="Catalogue sections">
        <button
          type="button"
          role="tab"
          aria-selected={catalogueTab === 'browse'}
          className={`btn btn-small ${catalogueTab === 'browse' ? '' : 'btn-outline'}`}
          onClick={() => setCatalogueTab('browse')}
        >
          Browse
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={catalogueTab === 'import'}
          className={`btn btn-small ${catalogueTab === 'import' ? '' : 'btn-outline'}`}
          onClick={() => setCatalogueTab('import')}
        >
          Import &amp; export
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={catalogueTab === 'audit'}
          className={`btn btn-small ${catalogueTab === 'audit' ? '' : 'btn-outline'}`}
          onClick={() => setCatalogueTab('audit')}
        >
          Audit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={catalogueTab === 'images'}
          className={`btn btn-small ${catalogueTab === 'images' ? '' : 'btn-outline'}`}
          onClick={() => setCatalogueTab('images')}
        >
          Images
        </button>
      </div>

      {catalogueTab === 'import' && (
        <div className="admin-catalogue-import-export card admin-card" style={{ marginTop: '1rem' }}>
          <h2>Import &amp; export</h2>

          <h3 className="admin-card-subtitle" style={{ marginTop: 0 }}>
            Lamtek catalogue (CSV or Excel)
          </h3>
          <p className="admin-muted">
            Standard portal format: same columns as export. Updates products by SKU; creates categories from <code>category_slug</code> / <code>category_name</code>. Lamtek component rows use the default catalogue program unless you set it in the sheet (future).
          </p>
          <div className="admin-import-export-actions">
            <div className="admin-export-buttons">
              <span className="admin-export-label">Export:</span>
              <button type="button" className="btn btn-outline btn-small" onClick={handleExportCsv}>
                Download CSV
              </button>
              <button type="button" className="btn btn-outline btn-small" onClick={handleExportXlsx}>
                Download XLSX
              </button>
            </div>
            <div className="admin-import-buttons">
              <span className="admin-export-label">Import:</span>
              <label className="btn btn-outline btn-small">
                {importing ? 'Importing…' : 'From CSV'}
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  className="admin-file-input"
                  disabled={importing}
                  onChange={handleImportCsv}
                />
              </label>
              <label className="btn btn-outline btn-small">
                {importing ? '…' : 'From XLS/XLSX'}
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="admin-file-input"
                  disabled={importing}
                  onChange={handleImportXlsx}
                />
              </label>
            </div>
          </div>
          <p className="admin-import-hint">
            Columns: category_slug, category_name, name, description, sku, unit_price, active, image_url, image_alt, is_stock.
          </p>
          {importResult && (
            <div className={`admin-import-result ${importResult.errors.length ? 'has-errors' : ''}`}>
              <strong>Result:</strong> {importResult.inserted} inserted, {importResult.updated} updated, {importResult.skipped} skipped.
              {importResult.errors.length > 0 && (
                <ul className="admin-import-errors">
                  {importResult.errors.slice(0, 10).map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                  {importResult.errors.length > 10 && <li>… and {importResult.errors.length - 10} more</li>}
                </ul>
              )}
            </div>
          )}

          <hr className="admin-catalogue-tab-divider" style={{ margin: '1.25rem 0', border: 0, borderTop: '1px solid var(--admin-border, #e5e7eb)' }} />

          <CatalogueTealburyImportBlock />
        </div>
      )}

      {catalogueTab === 'audit' && (
        <div className="card admin-card admin-catalogue-audit" style={{ marginTop: '1rem' }}>
        <h2>Catalogue audit</h2>
        <p className="admin-muted">
          Upload your master spreadsheet (CSV or XLSX with the same columns as export). The audit compares by <strong>SKU</strong>: missing in DB (in file but not in catalogue), extra in DB (in catalogue but not in file), and duplicate SKUs (same SKU more than once in the database).
        </p>
        <div className="admin-audit-actions">
          <label className="btn btn-outline btn-small">
            {auditLoading ? 'Running…' : 'Run audit (CSV or XLSX)'}
            <input
              ref={auditFileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="admin-file-input"
              disabled={auditLoading}
              onChange={handleAuditFile}
            />
          </label>
        </div>
        {auditResult && (
          <div className="admin-audit-result">
            <p><strong>Summary:</strong> File SKUs: {auditResult.fileSkuCount} · DB products: {auditResult.dbProductCount}</p>
            <div className="admin-audit-sections">
              <div className="admin-audit-section">
                <h3>Missing in DB ({auditResult.missingInDb.length})</h3>
                <p className="admin-muted">In spreadsheet but not in catalogue. Import the file to add them.</p>
                {auditResult.missingInDb.length === 0 ? (
                  <p className="admin-muted">None.</p>
                ) : (
                  <ul className="admin-audit-list">
                    {auditResult.missingInDb.slice(0, 50).map((sku) => (
                      <li key={sku}><code>{sku}</code></li>
                    ))}
                    {auditResult.missingInDb.length > 50 && (
                      <li className="admin-muted">… and {auditResult.missingInDb.length - 50} more</li>
                    )}
                  </ul>
                )}
              </div>
              <div className="admin-audit-section">
                <h3>Extra in DB ({auditResult.extraInDb.length})</h3>
                <p className="admin-muted">In catalogue but not in spreadsheet. Consider archiving or removing.</p>
                {auditResult.extraInDb.length === 0 ? (
                  <p className="admin-muted">None.</p>
                ) : (
                  <ul className="admin-audit-list">
                    {auditResult.extraInDb.slice(0, 50).map((sku) => (
                      <li key={sku}><code>{sku}</code></li>
                    ))}
                    {auditResult.extraInDb.length > 50 && (
                      <li className="admin-muted">… and {auditResult.extraInDb.length - 50} more</li>
                    )}
                  </ul>
                )}
              </div>
              <div className="admin-audit-section">
                <h3>Duplicate SKUs ({auditResult.duplicateSkus.length})</h3>
                <p className="admin-muted">Same SKU appears more than once in the database. Merge or delete duplicates in Catalogue.</p>
                {auditResult.duplicateSkus.length === 0 ? (
                  <p className="admin-muted">None.</p>
                ) : (
                  <ul className="admin-audit-list">
                    {auditResult.duplicateSkus.slice(0, 30).map((d) => (
                      <li key={d.sku}><code>{d.sku}</code> — {d.count} row(s)</li>
                    ))}
                    {auditResult.duplicateSkus.length > 30 && (
                      <li className="admin-muted">… and {auditResult.duplicateSkus.length - 30} more</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {catalogueTab === 'images' && (
      <div className="card admin-card admin-product-images-card" style={{ marginTop: '1rem' }}>
        <h2>Product images</h2>
        <p className="admin-muted">
          Lamtek product reference:{' '}
          <a href={LAMTEK_PRODUCT_IMAGES_LINK} target="_blank" rel="noopener noreferrer">
            Open Lamtek product reference
          </a>
          . Use the <strong>image mapping CSV</strong> to assign images to products by SKU, product name, or folder path (e.g. <code>Door Ascot MTM/Ascot Kitchen</code>). Or upload images named by <strong>SKU</strong> below.
        </p>

        <div className="admin-product-images-section">
          <h3>Image mapping from CSV</h3>
          <p className="admin-muted">
            Upload a CSV with columns <code>sku</code> and <code>image_url</code>, or <code>product_name</code> and <code>image_url</code>, or <code>path</code> and <code>image_url</code>. Path can be folder path (e.g. &quot;Door Ascot MTM/Ascot Kitchen&quot;) — we match by folder/product name to catalogue products. Use Dropbox direct links for <code>image_url</code> (add <code>?dl=1</code> to file links).
          </p>
          <div className="admin-product-images-upload">
            <input
              ref={imageMappingCsvRef}
              type="file"
              accept=".csv"
              className="admin-file-input"
              onChange={handleImageMappingCsvSelect}
            />
            <span className="admin-muted">Select a CSV file to run matching.</span>
          </div>

          {imageMatchResults != null && imageMatchResults.length > 0 && (
            <>
              <div className="admin-image-match-controls">
                <label>
                  Match threshold (stricter → looser)
                  <input
                    type="range"
                    min="0.5"
                    max="1"
                    step="0.1"
                    value={imageMatchThreshold}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setImageMatchThreshold(v)
                      if (imageMappingRows?.length)
                        setImageMatchResults(matchImageRowsToProducts(products, imageMappingRows, v))
                    }}
                  />
                  <span className="admin-muted">{Math.round(imageMatchThreshold * 100)}%</span>
                </label>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={rerunImageMatching}>
                  Re-run matching
                </button>
                {imageMatchResults.some((r) => r.status === 'matched' && r.products.length > 0) && (
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={imageApplyAllSaving}
                    onClick={applyAllImageAssignments}
                  >
                    {imageApplyAllSaving ? 'Applying…' : 'Apply all matched'}
                  </button>
                )}
              </div>
              <div className="admin-image-progress-summary">
                <strong>Progress:</strong>{' '}
                <span>{imageMatchResults.length} items checked</span>
                <span> · </span>
                <span>{imageMatchResults.filter((r) => r.status === 'matched').length} with match(es)</span>
                <span> · </span>
                <span>{imageMatchResults.filter((r) => r.status === 'no_match').length} no match</span>
              </div>
              <div className="admin-image-match-list">
                {imageMatchResults.map((r, idx) => (
                  <div key={idx} className={`admin-image-match-row admin-image-match-row--${r.status}`}>
                    <div className="admin-image-match-preview">
                      <img src={r.imageUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).src = '' }} />
                    </div>
                    <div className="admin-image-match-info">
                      <div className="admin-image-match-path">{r.imagePathOrName}</div>
                      <div className="admin-muted">
                        {r.status === 'matched'
                          ? `${r.products.length} product(s): ${r.products.map((p) => p.name ?? p.sku).slice(0, 3).join(', ')}${r.products.length > 3 ? '…' : ''}`
                          : 'No match'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => openImageReviewModal(idx)}
                    >
                      {r.status === 'matched' ? 'Review / edit' : 'Assign manually'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="admin-product-images-section">
          <h3>Upload images by SKU</h3>
          <p className="admin-muted">
            Upload image files whose filename (without extension) equals the product <strong>SKU</strong> (e.g. <code>ABC-123.jpg</code>).
          </p>
          <div className="admin-product-images-upload">
            <input
              ref={productImagesInputRef}
              type="file"
              accept="image/*"
              multiple
              className="admin-file-input"
              disabled={imageUploading}
              onChange={handleProductImagesUpload}
            />
            <span className="admin-muted">
              {imageUploading ? 'Uploading…' : 'Select one or more images. Filename (without extension) = product SKU.'}
            </span>
          </div>
        </div>

        {imageAssignResult && (
          <div className="admin-import-result">
            <strong>Result:</strong> {imageAssignResult.updated} product(s) updated with new image.
            {imageAssignResult.skipped.length > 0 && (
              <ul className="admin-import-errors">
                {imageAssignResult.skipped.slice(0, 15).map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
                {imageAssignResult.skipped.length > 15 && <li>… and {imageAssignResult.skipped.length - 15} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>
      )}

      {imageReviewModalIndex != null && imageMatchResults?.[imageReviewModalIndex] && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="image-review-title" onClick={(ev) => ev.target === ev.currentTarget && setImageReviewModalIndex(null)}>
          <div className="admin-modal admin-modal--large admin-image-review-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="image-review-title">Assign image to products</h2>
            {(() => {
              const r = imageMatchResults[imageReviewModalIndex]
              return (
                <>
                  <div className="admin-image-review-image">
                    <img src={r.imageUrl} alt="" />
                    <div className="admin-muted">{r.imagePathOrName}</div>
                  </div>
                  <div className="admin-image-review-products">
                    <p className="admin-muted">Select which products should use this image:</p>
                    <input
                      type="search"
                      placeholder="Filter by name or SKU…"
                      value={imageReviewProductSearch}
                      onChange={(e) => setImageReviewProductSearch(e.target.value)}
                      className="admin-filter-input"
                    />
                    <div className="admin-image-review-product-list">
                      {products
                        .filter((p) => {
                          if (!imageReviewProductSearch.trim()) return true
                          const q = imageReviewProductSearch.trim().toLowerCase()
                          return ((p.name ?? '').toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q))
                        })
                        .map((p) => (
                          <label key={p.id} className="admin-image-review-product-item">
                            <input
                              type="checkbox"
                              checked={imageReviewOverrideProductIds.has(p.id)}
                              onChange={(e) => {
                                setImageReviewOverrideProductIds((prev) => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(p.id)
                                  else next.delete(p.id)
                                  return next
                                })
                              }}
                            />
                            <span>{p.name ?? p.sku ?? p.id}</span>
                            {p.sku && <code className="admin-muted">{p.sku}</code>}
                          </label>
                        ))}
                    </div>
                  </div>
                  <div className="admin-modal-actions">
                    <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setImageReviewModalIndex(null)}>
                      Cancel
                    </button>
                    <button type="button" className="admin-btn" disabled={imageAssignSaving || imageReviewOverrideProductIds.size === 0} onClick={saveImageAssignment}>
                      {imageAssignSaving ? 'Saving…' : 'Save assignment'}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {catalogueTab === 'browse' && (
      <>
      <div className="admin-filters admin-catalogue-toolbar">
        <label>
          Search
          <input
            type="search"
            placeholder="Name, SKU, description…"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="admin-filter-input"
          />
        </label>
        <label>
          Category
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="admin-select"
          >
            <option value="">All</option>
            {categoriesByParent.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Catalogue
          <select
            value={catalogProgramFilter}
            onChange={(e) => setCatalogProgramFilter(e.target.value as typeof catalogProgramFilter)}
            className="admin-select"
          >
            <option value="all">All</option>
            <option value={CATALOG_PROGRAM.LAMTEK}>Lamtek</option>
            <option value={CATALOG_PROGRAM.TEALBURY}>Tealbury</option>
          </select>
        </label>
        <label>
          Product group
          <select
            value={productGroupFilter}
            onChange={(e) => setProductGroupFilter(e.target.value as typeof productGroupFilter)}
            className="admin-select"
          >
            <option value="all">All</option>
            <option value="doors_fronts">Doors &amp; fronts</option>
            <option value="carcasses">Carcasses</option>
            <option value="accessories">Accessories</option>
          </select>
        </label>
        <label className="admin-filter-check">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          Active only
        </label>
        <label className="admin-filter-check">
          <input type="checkbox" checked={stockOnly} onChange={(e) => setStockOnly(e.target.checked)} />
          Stock items only
        </label>
        {canEditCatalogue && (
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => setSmartCategoriseOpen(true)}
            title="Open the smart categorisation tool. Use the full page for history & settings."
          >
            Smart categorise
          </button>
        )}
        <label>
          Sort by
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="admin-select"
          >
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="sku_asc">SKU A–Z</option>
            <option value="sku_desc">SKU Z–A</option>
            <option value="price_asc">Price low–high</option>
            <option value="price_desc">Price high–low</option>
          </select>
        </label>
        <div className="admin-catalogue-view-toggle" role="group" aria-label="View type">
          <button
            type="button"
            className={viewType === 'table' ? 'active' : ''}
            onClick={() => setViewType('table')}
            title="Table"
            aria-pressed={viewType === 'table'}
          >
            ☰
          </button>
          <button
            type="button"
            className={viewType === 'grid' ? 'active' : ''}
            onClick={() => setViewType('grid')}
            title="Grid"
            aria-pressed={viewType === 'grid'}
          >
            ◫
          </button>
          <button
            type="button"
            className={viewType === 'list' ? 'active' : ''}
            onClick={() => setViewType('list')}
            title="List"
            aria-pressed={viewType === 'list'}
          >
            ≡
          </button>
          <button
            type="button"
            className={viewType === 'compact' ? 'active' : ''}
            onClick={() => setViewType('compact')}
            title="Compact"
            aria-pressed={viewType === 'compact'}
          >
            ▤
          </button>
        </div>
      </div>

      <div className="card admin-card">
        <div className="admin-card-heading-row">
          <h2>
            Products ({filteredTotal}
            {filteredTotal !== products.length ? ` of ${products.length}` : ''})
          </h2>
          <div className="admin-catalogue-heading-actions">
            <HorizontalScrollToolbarArrows
              canScrollLeft={catalogueScrollState.canScrollLeft}
              canScrollRight={catalogueScrollState.canScrollRight}
              onScrollLeft={() => catalogueScrollRef.current?.scrollLeft()}
              onScrollRight={() => catalogueScrollRef.current?.scrollRight()}
            />
            <ColumnSettings
              columnDefs={columnDefs}
              visibleIds={visibleIds}
              setColumnVisible={setColumnVisible}
              order={order}
              setColumnOrder={setColumnOrder}
              resetToDefault={resetToDefault}
              tooltip="Column settings – click here to edit columns"
            />
          </div>
        </div>
        <HorizontalScrollWithArrows
          ref={catalogueScrollRef}
          fixedArrows={false}
          onScrollStateChange={setCatalogueScrollState}
          className={
            viewType === 'table'
              ? 'admin-horizontal-scroll-wrap--catalogue-table'
              : 'admin-horizontal-scroll-wrap--catalogue-fluid'
          }
          innerClassName={viewType === 'table' ? 'admin-catalogue-table-scroll' : undefined}
          contentStyle={
            viewType === 'table' ? { minWidth: `${catalogueTableWidthPx}px` } : undefined
          }
        >
        {viewType === 'table' ? (
          <div
            className={`table-wrap admin-table-wrap admin-catalogue-table-wrap admin-table-wrap--${tableDensity}`}
            style={{ width: catalogueTableWidthPx, minWidth: catalogueTableWidthPx }}
          >
            <table
              className="admin-table admin-table--has-dividers admin-table--resizable admin-table--sticky-header admin-catalogue-table"
              style={{ width: catalogueTableWidthPx, minWidth: catalogueTableWidthPx }}
            >
              <colgroup>
                {visibleCatalogueCols.map((col) => (
                  <col
                    key={col.id}
                    style={{
                      width: `${catalogueColumnWidth(col.id, columnWidths)}px`,
                      minWidth: catalogueColumnWidth(col.id, columnWidths),
                    }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {visibleCatalogueCols.map((col) => (
                    <th
                      key={col.id}
                      className={`admin-th ${headerDraggingId === col.id ? 'admin-th--dragging' : ''} ${headerDrop?.targetId === col.id ? `admin-th--drop-${headerDrop.position}` : ''} ${CENTER_ALIGN_COLUMNS.has(col.id) ? 'admin-cell-center' : ''} ${WRAP_HEADER_COLUMNS.has(col.id) ? 'admin-th--header-wrap' : ''}`}
                      style={{
                        width: catalogueColumnWidth(col.id, columnWidths),
                        minWidth: catalogueColumnWidth(col.id, columnWidths),
                      }}
                      draggable={!!setColumnOrder}
                      onDragStart={(e) => {
                        if (!setColumnOrder) return
                        setHeaderDraggingId(col.id)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', col.id)
                      }}
                      onDragOver={(e) => {
                        if (!setColumnOrder || !headerDraggingId || headerDraggingId === col.id) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        const mid = rect.left + rect.width / 2
                        setHeaderDrop({ targetId: col.id, position: e.clientX < mid ? 'before' : 'after' })
                      }}
                      onDragLeave={() => setHeaderDrop(null)}
                      onDrop={(e) => {
                        e.preventDefault()
                        const pos = headerDrop?.targetId === col.id ? headerDrop.position : 'after'
                        setHeaderDrop(null)
                        setHeaderDraggingId(null)
                        const draggedId = e.dataTransfer.getData('text/plain')
                        if (!setColumnOrder || !draggedId || draggedId === col.id || !order) return
                        const fromIdx = order.indexOf(draggedId)
                        let toIdx = order.indexOf(col.id)
                        if (fromIdx === -1 || toIdx === -1) return
                        if (pos === 'after') toIdx += 1
                        const next = [...order]
                        next.splice(fromIdx, 1)
                        const insertIdx = next.indexOf(col.id) + (pos === 'after' ? 1 : 0)
                        next.splice(insertIdx, 0, draggedId)
                        setColumnOrder(next)
                      }}
                      onDragEnd={() => { setHeaderDraggingId(null); setHeaderDrop(null) }}
                    >
                      {col.label}
                      <span
                        className="admin-th-resizer"
                        role="separator"
                        aria-label={`Resize ${col.label} column`}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          resizeStartRef.current = {
                            x: e.clientX,
                            width: catalogueColumnWidth(col.id, columnWidths),
                          }
                          setResizingColId(col.id)
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTotal === 0 ? (
                  <tr>
                    <td colSpan={visibleIds.length || 1} className="admin-table-empty">No products match.</td>
                  </tr>
                ) : (
                  pagedProducts.map((p) => {
                    const isStock = p.is_stock !== false
                    const availability = getProductAvailabilityMeta(p)
                    return (
                      <tr
                        key={p.id}
                        className="admin-catalogue-table-row"
                        onClick={() => {
                          if (editingCell) return
                          scheduleOpenProductModal(p)
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (editingCell) return
                          if (e.key === 'Enter') {
                            cancelPendingProductModal()
                            setSelectedProduct(p)
                          }
                        }}
                      >
                        {visibleCatalogueCols.map((col) => {
                          const isEditing = editingCell?.productId === p.id && editingCell?.field === (col.id === 'category' ? 'category_id' : col.id)
                          const onDoubleClick = (e: React.MouseEvent) => {
                            e.stopPropagation()
                            cancelPendingProductModal()
                            if (!canEditCatalogue) return
                            if (['name', 'sku', 'category', 'description', 'unit_price', 'cost_price', 'active'].includes(col.id)) {
                              setEditingCell({ productId: p.id, field: col.id === 'category' ? 'category_id' : col.id })
                            }
                          }
                          if (col.id === 'image') {
                            return (
                              <td key={col.id} className="admin-table-cell-image admin-cell-center">
                                {p.image_url ? (
                                  <img src={p.image_url} alt={p.image_alt ?? p.name ?? ''} />
                                ) : (
                                  <span className="admin-muted">—</span>
                                )}
                              </td>
                            )
                          }
                          if (col.id === 'name') {
                            return (
                              <td key={col.id} onDoubleClick={onDoubleClick} className="admin-table-cell-editable" title="Double click to edit">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    defaultValue={p.name}
                                    autoFocus
                                    className="admin-inline-edit-input"
                                    onBlur={(e) => saveInlineEdit(p.id, 'name', e.target.value.trim() || p.name)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveInlineEdit(p.id, 'name', (e.target as HTMLInputElement).value.trim() || p.name)
                                      if (e.key === 'Escape') setEditingCell(null)
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <>
                                    {p.name}
                                    {completeProductIds.has(p.id) && (
                                      <span className="admin-badge admin-badge--bom" title="Has component breakdown defined">
                                        Complete unit
                                      </span>
                                    )}
                                  </>
                                )}
                              </td>
                            )
                          }
                          if (col.id === 'sku') {
                            return (
                              <td
                                key={col.id}
                                onDoubleClick={onDoubleClick}
                                className="admin-table-cell-editable admin-table-cell-sku"
                                title="Double click to edit"
                              >
                                {isEditing ? (
                                  <input
                                    type="text"
                                    defaultValue={p.sku ?? ''}
                                    autoFocus
                                    className="admin-inline-edit-input"
                                    onBlur={(e) => saveInlineEdit(p.id, 'sku', e.target.value.trim() || null)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveInlineEdit(p.id, 'sku', (e.target as HTMLInputElement).value.trim() || null)
                                      if (e.key === 'Escape') setEditingCell(null)
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <code className="admin-table-cell-sku-code">{p.sku ?? '—'}</code>
                                )}
                              </td>
                            )
                          }
                          if (col.id === 'category') {
                            const catIds = getProductCategoryIds(p.id, p.category_id, productCategoryMap)
                            const editingCategories =
                              isEditing ||
                              (categoryEditDraft?.productId === p.id && editingCell?.field === 'category_id')
                            return (
                              <td
                                key={col.id}
                                onDoubleClick={(e) => {
                                  if (!canEditCatalogue) return
                                  e.stopPropagation()
                                  const ids = catIds.length > 0 ? catIds : [p.category_id]
                                  setCategoryEditDraft({
                                    productId: p.id,
                                    ids,
                                    primary: ids[0] ?? p.category_id,
                                  })
                                  setEditingCell({ productId: p.id, field: 'category_id' })
                                }}
                                className="admin-table-cell-editable admin-table-cell-categories"
                                title="Double click to edit categories"
                              >
                                {editingCategories && categoryEditDraft?.productId === p.id ? (
                                  <ProductCategoryMultiSelect
                                    compact
                                    categories={categories}
                                    selectedIds={categoryEditDraft.ids}
                                    primaryId={categoryEditDraft.primary}
                                    onChange={(ids, primary) =>
                                      setCategoryEditDraft({ productId: p.id, ids, primary })
                                    }
                                  />
                                ) : (
                                  formatCategoryNames(catIds, categoryMap)
                                )}
                                {editingCategories && categoryEditDraft?.productId === p.id && (
                                  <div className="product-category-inline-actions">
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        void saveInlineCategories(
                                          p.id,
                                          categoryEditDraft.ids,
                                          categoryEditDraft.primary
                                        )
                                      }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setCategoryEditDraft(null)
                                        setEditingCell(null)
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </td>
                            )
                          }
                          if (col.id === 'description') {
                            return (
                              <td key={col.id} onDoubleClick={onDoubleClick} className="admin-table-cell-desc admin-table-cell-editable" title="Double click to edit">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    defaultValue={p.description ?? ''}
                                    autoFocus
                                    className="admin-inline-edit-input"
                                    onBlur={(e) => saveInlineEdit(p.id, 'description', e.target.value.trim() || null)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveInlineEdit(p.id, 'description', (e.target as HTMLInputElement).value.trim() || null)
                                      if (e.key === 'Escape') setEditingCell(null)
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  (p.description ?? '—').slice(0, 80) + ((p.description?.length ?? 0) > 80 ? '…' : '')
                                )}
                              </td>
                            )
                          }
                          if (col.id === 'unit_price') {
                            return (
                              <td key={col.id} onDoubleClick={onDoubleClick} className="admin-table-cell-editable admin-cell-center" title="Double click to edit">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue={p.unit_price}
                                    autoFocus
                                    className="admin-inline-edit-input"
                                    onBlur={(e) => {
                                      const v = parseFloat(e.target.value)
                                      if (!Number.isNaN(v) && v >= 0) saveInlineEdit(p.id, 'unit_price', v)
                                      else setEditingCell(null)
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const v = parseFloat((e.target as HTMLInputElement).value)
                                        if (!Number.isNaN(v) && v >= 0) saveInlineEdit(p.id, 'unit_price', v)
                                      }
                                      if (e.key === 'Escape') setEditingCell(null)
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  `£${Number(p.unit_price).toFixed(2)}`
                                )}
                              </td>
                            )
                          }
                          if (col.id === 'cost_price') {
                            return (
                              <td key={col.id} onDoubleClick={onDoubleClick} className="admin-table-cell-editable admin-cell-center" title="Double click to edit">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue={p.cost_price ?? ''}
                                    autoFocus
                                    className="admin-inline-edit-input"
                                    onBlur={(e) => {
                                      const raw = e.target.value.trim()
                                      if (raw === '') saveInlineEdit(p.id, 'cost_price', null)
                                      else {
                                        const v = parseFloat(raw)
                                        if (!Number.isNaN(v) && v >= 0) saveInlineEdit(p.id, 'cost_price', v)
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const raw = (e.target as HTMLInputElement).value.trim()
                                        if (raw === '') saveInlineEdit(p.id, 'cost_price', null)
                                        else {
                                          const v = parseFloat(raw)
                                          if (!Number.isNaN(v) && v >= 0) saveInlineEdit(p.id, 'cost_price', v)
                                        }
                                      }
                                      if (e.key === 'Escape') setEditingCell(null)
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  p.cost_price != null ? `£${Number(p.cost_price).toFixed(2)}` : '—'
                                )}
                              </td>
                            )
                          }
                          if (col.id === 'stock') {
                            const qtyEditing = editingCell?.productId === p.id && editingCell?.field === 'stock_quantity'
                            return (
                              <td key={col.id} className="admin-table-cell-stock-mtm admin-cell-center">
                                <div className="admin-catalogue-stock-switch-wrap" onClick={(e) => e.stopPropagation()}>
                                  <StockMtmSwitch
                                    isStock={isStock}
                                    loading={isStockUpdating === p.id}
                                    onToggle={() => toggleIsStock(p)}
                                  />
                                </div>
                                <div
                                  className={
                                    canEditCatalogue
                                      ? 'admin-catalogue-stock-qty admin-table-cell-editable'
                                      : 'admin-catalogue-stock-qty'
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation()
                                    cancelPendingProductModal()
                                    if (!canEditCatalogue) return
                                    setEditingCell({ productId: p.id, field: 'stock_quantity' })
                                  }}
                                  title={canEditCatalogue ? 'Double-click to edit quantity' : undefined}
                                >
                                  {qtyEditing ? (
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      className="admin-inline-edit-input"
                                      autoFocus
                                      defaultValue={p.stock_quantity ?? 0}
                                      onBlur={(e) => {
                                        const v = parseInt(e.target.value, 10)
                                        void saveInlineEdit(p.id, 'stock_quantity', Number.isFinite(v) && v >= 0 ? v : 0)
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const v = parseInt((e.target as HTMLInputElement).value, 10)
                                          void saveInlineEdit(p.id, 'stock_quantity', Number.isFinite(v) && v >= 0 ? v : 0)
                                        }
                                        if (e.key === 'Escape') setEditingCell(null)
                                      }}
                                      onClick={(ev) => ev.stopPropagation()}
                                    />
                                  ) : (
                                    <span className="admin-catalogue-stock-qty-value">Qty: {p.stock_quantity ?? 0}</span>
                                  )}
                                </div>
                                <div
                                  className="admin-muted admin-catalogue-stock-avail"
                                  style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}
                                  title={availability.detail ?? availability.label}
                                >
                                  {availability.label}
                                </div>
                              </td>
                            )
                          }
                          if (col.id === 'active') {
                            return (
                              <td key={col.id} onDoubleClick={onDoubleClick} className="admin-table-cell-editable admin-cell-center" title="Double click to edit">
                                {isEditing ? (
                                  <select
                                    autoFocus
                                    className="admin-inline-edit-input"
                                    defaultValue={p.active ? '1' : '0'}
                                    onBlur={(e) => saveInlineEdit(p.id, 'active', e.target.value === '1')}
                                    onChange={(e) => saveInlineEdit(p.id, 'active', e.target.value === '1')}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <option value="1">Yes</option>
                                    <option value="0">No</option>
                                  </select>
                                ) : (
                                  p.active ? 'Yes' : 'No'
                                )}
                              </td>
                            )
                          }
                          return <td key={col.id}>—</td>
                        })}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            {inlineSaving && <p className="admin-muted admin-inline-saving-hint">Saving…</p>}
          </div>
        ) : (
          <div className={`admin-catalogue-grid admin-catalogue-view--${viewType}`}>
            {filteredTotal === 0 ? (
              <p className="admin-muted">No products match.</p>
            ) : (
              pagedProducts.map((p) => {
                const isStock = p.is_stock !== false
                const availability = getProductAvailabilityMeta(p)
                const isEditing = (field: string) => editingCell?.productId === p.id && editingCell?.field === (field === 'category' ? 'category_id' : field)
                const startEdit = (e: React.MouseEvent, field: string) => {
                  e.stopPropagation()
                  cancelPendingProductModal()
                  if (!canEditCatalogue) return
                  setEditingCell({ productId: p.id, field: field === 'category' ? 'category_id' : field })
                }
                const stopProp = (e: React.MouseEvent) => e.stopPropagation()
                return (
                  <div
                    key={p.id}
                    className={`admin-catalogue-card ${viewType === 'list' ? 'admin-catalogue-card--list' : ''}`}
                    onClick={() => {
                      if (editingCell) return
                      scheduleOpenProductModal(p)
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (editingCell) return
                      if (e.key === 'Enter') {
                        cancelPendingProductModal()
                        setSelectedProduct(p)
                      }
                    }}
                  >
                    {isVisible('image') && (
                      <div className="admin-catalogue-card-image">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.image_alt ?? p.name ?? ''} />
                        ) : (
                          <span className="admin-muted" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>No image</span>
                        )}
                      </div>
                    )}
                    <div className="admin-catalogue-card-body">
                      {isVisible('name') && (
                        <div className="admin-catalogue-card-name admin-card-editable" onClick={stopProp} onDoubleClick={(e) => startEdit(e, 'name')} title="Double click to edit">
                          {isEditing('name') ? (
                            <input className="admin-inline-edit-input" autoFocus defaultValue={p.name} onBlur={(e) => saveInlineEdit(p.id, 'name', e.target.value.trim() || p.name)} onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(p.id, 'name', (e.target as HTMLInputElement).value.trim() || p.name); if (e.key === 'Escape') setEditingCell(null) }} onClick={stopProp} />
                          ) : (
                            p.name
                          )}
                        </div>
                      )}
                      {isVisible('sku') && (
                        <div className="admin-catalogue-card-sku admin-card-editable" onClick={stopProp} onDoubleClick={(e) => startEdit(e, 'sku')} title="Double click to edit">
                          {isEditing('sku') ? (
                            <input className="admin-inline-edit-input" autoFocus defaultValue={p.sku ?? ''} onBlur={(e) => saveInlineEdit(p.id, 'sku', e.target.value.trim() || null)} onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(p.id, 'sku', (e.target as HTMLInputElement).value.trim() || null); if (e.key === 'Escape') setEditingCell(null) }} onClick={stopProp} />
                          ) : (
                            p.sku ?? '—'
                          )}
                        </div>
                      )}
                      {isVisible('category') && viewType !== 'compact' && (
                        <span className="admin-muted" onClick={stopProp} title="Open product to edit categories">
                          {formatCategoryNames(
                            getProductCategoryIds(p.id, p.category_id, productCategoryMap),
                            categoryMap
                          )}
                        </span>
                      )}
                      {isVisible('description') && viewType !== 'compact' && (
                        <div className="admin-catalogue-card-desc admin-muted admin-card-editable" onClick={stopProp} onDoubleClick={(e) => startEdit(e, 'description')} title="Double click to edit">
                          {isEditing('description') ? (
                            <input className="admin-inline-edit-input" autoFocus defaultValue={p.description ?? ''} onBlur={(e) => saveInlineEdit(p.id, 'description', e.target.value.trim() || null)} onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(p.id, 'description', (e.target as HTMLInputElement).value.trim() || null); if (e.key === 'Escape') setEditingCell(null) }} onClick={stopProp} />
                          ) : (
                            (p.description ?? '').length > 0 ? (p.description ?? '').slice(0, 100) + ((p.description?.length ?? 0) > 100 ? '…' : '') : '—'
                          )}
                        </div>
                      )}
                      {isVisible('unit_price') && (
                        <div className="admin-catalogue-card-price admin-card-editable" onClick={stopProp} onDoubleClick={(e) => startEdit(e, 'unit_price')} title="Double click to edit">
                          {isEditing('unit_price') ? (
                            <input type="number" step="0.01" min="0" className="admin-inline-edit-input" autoFocus defaultValue={p.unit_price} onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v >= 0) saveInlineEdit(p.id, 'unit_price', v); else setEditingCell(null) }} onKeyDown={(e) => { if (e.key === 'Enter') { const v = parseFloat((e.target as HTMLInputElement).value); if (!Number.isNaN(v) && v >= 0) saveInlineEdit(p.id, 'unit_price', v) } if (e.key === 'Escape') setEditingCell(null) }} onClick={stopProp} />
                          ) : (
                            `£${Number(p.unit_price).toFixed(2)}`
                          )}
                        </div>
                      )}
                      {isVisible('cost_price') && (
                        <div className="admin-catalogue-card-cost admin-card-editable" onClick={stopProp} onDoubleClick={(e) => startEdit(e, 'cost_price')} title="Double click to edit">
                          {isEditing('cost_price') ? (
                            <input type="number" step="0.01" min="0" className="admin-inline-edit-input" autoFocus defaultValue={p.cost_price ?? ''} onBlur={(e) => { const raw = e.target.value.trim(); if (raw === '') saveInlineEdit(p.id, 'cost_price', null); else { const v = parseFloat(raw); if (!Number.isNaN(v) && v >= 0) saveInlineEdit(p.id, 'cost_price', v) } }} onKeyDown={(e) => { if (e.key === 'Enter') { const raw = (e.target as HTMLInputElement).value.trim(); if (raw === '') saveInlineEdit(p.id, 'cost_price', null); else { const v = parseFloat(raw); if (!Number.isNaN(v) && v >= 0) saveInlineEdit(p.id, 'cost_price', v) } } if (e.key === 'Escape') setEditingCell(null) }} onClick={stopProp} />
                          ) : (
                            p.cost_price != null ? `Cost £${Number(p.cost_price).toFixed(2)}` : '—'
                          )}
                        </div>
                      )}
                      {isVisible('stock') && (
                        <div className="admin-catalogue-card-stock">
                          <div onClick={stopProp}>
                            <StockMtmSwitch isStock={isStock} loading={isStockUpdating === p.id} onToggle={() => toggleIsStock(p)} compact />
                          </div>
                          <div
                            className={
                              canEditCatalogue
                                ? 'admin-catalogue-card-qty admin-card-editable admin-muted'
                                : 'admin-catalogue-card-qty admin-muted'
                            }
                            onDoubleClick={(e) => {
                              if (!canEditCatalogue) return
                              startEdit(e, 'stock_quantity')
                            }}
                            title={canEditCatalogue ? 'Double-click to edit quantity' : undefined}
                          >
                            {editingCell?.productId === p.id && editingCell?.field === 'stock_quantity' ? (
                              <input
                                type="number"
                                min={0}
                                step={1}
                                className="admin-inline-edit-input"
                                autoFocus
                                defaultValue={p.stock_quantity ?? 0}
                                onBlur={(e) => {
                                  const v = parseInt(e.target.value, 10)
                                  void saveInlineEdit(p.id, 'stock_quantity', Number.isFinite(v) && v >= 0 ? v : 0)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const v = parseInt((e.target as HTMLInputElement).value, 10)
                                    void saveInlineEdit(p.id, 'stock_quantity', Number.isFinite(v) && v >= 0 ? v : 0)
                                  }
                                  if (e.key === 'Escape') setEditingCell(null)
                                }}
                                onClick={stopProp}
                              />
                            ) : (
                              <>Qty: {p.stock_quantity ?? 0}</>
                            )}
                          </div>
                          <div className="admin-muted" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }} title={availability.detail ?? availability.label}>
                            {availability.label}
                          </div>
                        </div>
                      )}
                      {isVisible('active') && viewType !== 'compact' && (
                        <span className="admin-muted admin-card-editable" onClick={stopProp} onDoubleClick={(e) => startEdit(e, 'active')} title="Double click to edit">
                          {isEditing('active') ? (
                            <select className="admin-inline-edit-input" autoFocus defaultValue={p.active ? '1' : '0'} onBlur={(e) => saveInlineEdit(p.id, 'active', e.target.value === '1')} onChange={(e) => saveInlineEdit(p.id, 'active', e.target.value === '1')} onClick={stopProp}>
                              <option value="1">Yes</option>
                              <option value="0">No</option>
                            </select>
                          ) : (
                            p.active ? 'Active' : 'Inactive'
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
        </HorizontalScrollWithArrows>
        <ListPager
          totalItems={filteredTotal}
          totalPages={totalPages}
          currentPage={currentPage}
          pageSize={pageSize}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onPageChange={goToPage}
          onPageSizeChange={setPageSize}
          itemLabel={filteredTotal === 1 ? 'product' : 'products'}
          ariaLabel="Catalogue products"
        />
      </div>

      {selectedProduct && (
        <AdminProductModal
          key={selectedProduct.id}
          product={selectedProduct}
          categories={categories}
          productCategoryMap={productCategoryMap}
          canEditCatalogue={canEditCatalogue}
          partTypes={assemblyPartTypes}
          partTypeLabels={assemblyPartTypeLabels}
          allProducts={products}
          onClose={() => setSelectedProduct(null)}
          onSaved={() => void load()}
          onCategoriesChange={(next) => setCategories(next)}
          onPartTypesChange={() => void reloadAssemblyPartTypes()}
          onProductSaved={(productId, categoryIds, primary) => {
            setProductCategoryMap((prev) => {
              const next = new Map(prev)
              next.set(productId, categoryIds)
              return next
            })
            setProducts((prev) =>
              prev.map((p) => (p.id === productId ? { ...p, category_id: primary } : p))
            )
            setSelectedProduct((prev) =>
              prev && prev.id === productId ? { ...prev, category_id: primary } : prev
            )
          }}
        />
      )}

      <CatalogueCategoriesManager
        categories={categories}
        products={products}
        productCategoryMap={productCategoryMap}
        onChanged={() => {
          void load()
        }}
      />

      {smartCategoriseOpen && (
        <SmartCategoriseModal
          open={smartCategoriseOpen}
          onClose={() => setSmartCategoriseOpen(false)}
          products={products}
          categories={categories}
          onApplied={() => {
            void load()
          }}
        />
      )}
      </>
      )}
    </div>
  )
}
