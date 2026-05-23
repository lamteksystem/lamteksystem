/** Core Lamtek product-type categories (pre-import taxonomy). Used when pruning auto-generated categories. */
export const CORE_CATALOGUE_CATEGORY_NAMES = [
  'Carcasses',
  'Cornice & Pelmet',
  'Doors',
  'Fittings',
  'Handles',
  'Hinges & Fittings',
  'Lighting',
  'Mouldings',
  'Panels',
  'Plinth',
  'Posts',
  'Shelves & Interiors',
  'Wirework',
] as const

export type CoreCatalogueCategoryName = (typeof CORE_CATALOGUE_CATEGORY_NAMES)[number]
