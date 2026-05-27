/** Core Lamtek product-type categories (pre-import taxonomy). Used when pruning auto-generated categories. */
/** Top-level product-type categories (Lighting lives under Accessories). */
export const CORE_CATALOGUE_CATEGORY_NAMES = [
  'Carcasses',
  'Cornice & Pelmet',
  'Doors',
  'Fittings',
  'Handles',
  'Hinges & Fittings',
  'Mouldings',
  'Panels',
  'Plinth',
  'Posts',
  'Shelves & Interiors',
  'Wirework',
  'Accessories',
] as const

export const ACCESSORIES_SUBCATEGORY_NAMES = ['Cutlery Trays', 'Lighting', 'Misc'] as const

export type CoreCatalogueCategoryName = (typeof CORE_CATALOGUE_CATEGORY_NAMES)[number]
