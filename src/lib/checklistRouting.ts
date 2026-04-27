import type { AssemblyWithLines, CategoryRow } from '@/types/database'

export type ChecklistHint =
  | 'units'
  | 'doors_frontals'
  | 'handles_rails'
  | 'hinges_fittings'
  | 'internals_storage'
  | 'lighting'
  | 'worktops_panels'
  | 'mouldings_finishing'
  | 'accessories_misc'

const KEYWORDS: Record<ChecklistHint, string[]> = {
  units: ['unit', 'carcass', 'cabinet', 'base', 'wall', 'tall'],
  doors_frontals: ['door', 'frontal', 'drawer'],
  handles_rails: ['handle', 'knob', 'rail', 'gola', 'profile'],
  hinges_fittings: ['hinge', 'runner', 'fitting', 'bracket', 'fixing'],
  internals_storage: ['storage', 'internal', 'wirework', 'larder', 'bin'],
  lighting: ['lighting', 'light', 'led'],
  worktops_panels: ['worktop', 'panel', 'upstand', 'splashback'],
  mouldings_finishing: ['plinth', 'cornice', 'pelmet', 'mould', 'trim', 'filler'],
  accessories_misc: ['accessories', 'accessory', 'sink', 'tap', 'appliance'],
}

function scoreText(text: string, keywords: string[]): number {
  let score = 0
  for (const kw of keywords) {
    if (text === kw) score += 6
    else if (text.startsWith(`${kw} `) || text.endsWith(` ${kw}`)) score += 4
    else if (text.includes(kw)) score += 2
  }
  return score
}

export function resolveChecklistCategoryId(categories: CategoryRow[], hint: ChecklistHint): string | null {
  const keywords = KEYWORDS[hint]
  let best: { id: string; score: number } | null = null
  for (const c of categories) {
    const text = `${(c.name ?? '').toLowerCase()} ${(c.slug ?? '').toLowerCase()}`
    const score = scoreText(text, keywords)
    if (score <= 0) continue
    if (!best || score > best.score) best = { id: c.id, score }
  }
  return best?.id ?? null
}

export function resolveChecklistAssemblyFilters(
  assemblies: AssemblyWithLines[],
  hint: ChecklistHint
): { unitType: 'base_unit' | 'wall_unit' | 'tall_unit' | 'other' | ''; collectionSlug: string } {
  const keywords = KEYWORDS[hint]

  // Suggested unit type per checklist intent; can be overridden by stronger data matches.
  const preferredType: Record<ChecklistHint, 'base_unit' | 'wall_unit' | 'tall_unit' | 'other' | ''> = {
    units: 'base_unit',
    doors_frontals: '',
    handles_rails: '',
    hinges_fittings: '',
    internals_storage: '',
    lighting: '',
    worktops_panels: '',
    mouldings_finishing: '',
    accessories_misc: '',
  }

  let bestCollection: { slug: string; score: number } | null = null
  for (const a of assemblies) {
    const slug = (a.collection_slug ?? '').trim()
    if (!slug) continue
    const text = `${(a.name ?? '').toLowerCase()} ${(a.description ?? '').toLowerCase()} ${slug.toLowerCase()}`
    const score = scoreText(text, keywords)
    if (score <= 0) continue
    if (!bestCollection || score > bestCollection.score) {
      bestCollection = { slug, score }
    }
  }

  return {
    unitType: preferredType[hint],
    collectionSlug: bestCollection?.slug ?? '',
  }
}

