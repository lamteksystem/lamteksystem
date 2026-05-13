export const CATALOG_PROGRAM = {
  LAMTEK: 'lamtek',
  TEALBURY: 'tealbury',
} as const

export type CatalogProgram = (typeof CATALOG_PROGRAM)[keyof typeof CATALOG_PROGRAM]

export function isCatalogProgram(v: string | null | undefined): v is CatalogProgram {
  return v === CATALOG_PROGRAM.LAMTEK || v === CATALOG_PROGRAM.TEALBURY
}
