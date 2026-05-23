/** Admin product & category tooling (separate from live Catalogue / Categories browse). */
export const CATALOGUE_TOOLS = {
  hub: '/admin/catalogue-tools',
  pricelistWorkbench: '/admin/catalogue-tools/pricelist-workbench',
  catalogueData: '/admin/catalogue-tools/catalogue-data',
  catalogueDataImport: '/admin/catalogue-tools/catalogue-data?tab=import',
  catalogueDataAudit: '/admin/catalogue-tools/catalogue-data?tab=audit',
  catalogueDataImages: '/admin/catalogue-tools/catalogue-data?tab=images',
  smartCategorise: '/admin/catalogue-tools/smart-categorise',
  parts: '/admin/catalogue-tools/parts',
  componentImport: '/admin/catalogue-tools/components/import',
  variantBuilder: '/admin/catalogue-tools/components/variant-builder',
  wipe: '/admin/catalogue-tools/wipe',
} as const

export const LIVE_CATALOGUE = {
  products: '/admin/catalogue',
  categories: '/admin/catalogue/categories',
} as const
