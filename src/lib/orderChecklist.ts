import type { CategoryRow, ProductRow } from '@/types/database'
import type { OrderProject } from '@/lib/orderProject'

export type ChecklistGroupId =
  | 'units'
  | 'doors_frontals'
  | 'handles_rails'
  | 'hinges_fittings'
  | 'internals_storage'
  | 'lighting'
  | 'worktops_panels'
  | 'mouldings_finishing'
  | 'accessories_misc'

export type ChecklistGroup = {
  id: ChecklistGroupId
  title: string
  hint: string
  is_complete: boolean
  matched_examples: string[]
  suggested_search_terms: string[]
}

function norm(s: string | null | undefined) {
  return (s ?? '').toLowerCase()
}

function categoryText(categoryId: string | null | undefined, categoriesById: Map<string, CategoryRow>) {
  if (!categoryId) return ''
  const c = categoriesById.get(categoryId)
  if (!c) return ''
  return `${norm(c.name)} ${norm(c.slug)}`
}

function productText(p: { name?: string | null; sku?: string | null; category_id?: string | null }, categoriesById: Map<string, CategoryRow>) {
  return `${norm(p.name)} ${norm(p.sku)} ${categoryText(p.category_id ?? null, categoriesById)}`
}

export function buildOrderChecklist(params: {
  project: OrderProject | null
  lines: Array<{ product: Pick<ProductRow, 'name' | 'sku' | 'category_id'> | null; snapshotName?: string | null; snapshotSku?: string | null }>
  categories: CategoryRow[]
}): ChecklistGroup[] {
  const categoriesById = new Map(params.categories.map((c) => [c.id, c]))

  const lineTexts = params.lines.map((l) => {
    if (l.product) return productText(l.product, categoriesById)
    return `${norm(l.snapshotName)} ${norm(l.snapshotSku)}`
  })

  const hasAny = (keywords: string[]) => {
    if (keywords.length === 0) return false
    return lineTexts.some((t) => keywords.some((k) => t.includes(k)))
  }

  const examplesFor = (keywords: string[]) => {
    const ex: string[] = []
    for (const l of params.lines) {
      const t = l.product ? productText(l.product, categoriesById) : `${norm(l.snapshotName)} ${norm(l.snapshotSku)}`
      if (keywords.some((k) => t.includes(k))) {
        const label = (l.product?.name ?? l.snapshotName ?? 'Item').toString()
        if (!ex.includes(label)) ex.push(label)
      }
      if (ex.length >= 3) break
    }
    return ex
  }

  // Heuristic keyword sets (we can refine once products/categories are more structured).
  const K = {
    units: ['unit', 'carcass', 'base', 'wall', 'tall', 'larder', 'cabinet', 'drawer unit'],
    doors: ['door', 'front', 'frontal', 'drawer front', 'fascia'],
    handles: ['handle', 'knob', 'rail', 'gola', 'profile'],
    hinges: ['hinge', 'backplate', 'soft close', 'runner', 'fixing', 'bracket', 'fitting'],
    internals: ['storage', 'internal', 'bin', 'pull out', 'larder', 'carousel', 'wirework', 'cutlery', 'spice'],
    lighting: ['light', 'led', 'driver', 'sensor', 'strip'],
    worktops: ['worktop', 'panel', 'end panel', 'splashback', 'upstand'],
    mouldings: ['plinth', 'cornice', 'pelmet', 'mould', 'trim', 'filler'],
    accessories: ['accessory', 'tap', 'sink', 'appliance', 'socket', 'hood', 'canopy'],
  } as const

  const groups: Array<Omit<ChecklistGroup, 'is_complete' | 'matched_examples'> & { keywords: string[] }> = [
    {
      id: 'units',
      title: 'Units / carcasses',
      hint: 'Base, wall, tall units (or equivalent).',
      keywords: [...K.units],
      suggested_search_terms: ['base unit', 'wall unit', 'tall unit', 'carcass'],
    },
    {
      id: 'doors_frontals',
      title: 'Doors & frontals',
      hint: 'Doors, drawer fronts, panels that define the look.',
      keywords: [...K.doors],
      suggested_search_terms: ['door', 'drawer front', 'frontal'],
    },
    {
      id: 'handles_rails',
      title: 'Handles / rails',
      hint: 'Handles, knobs, handleless rails and profiles.',
      keywords: [...K.handles],
      suggested_search_terms: ['handle', 'knob', 'gola rail'],
    },
    {
      id: 'hinges_fittings',
      title: 'Hinges & fittings',
      hint: 'Hinges, runners, brackets, fixings.',
      keywords: [...K.hinges],
      suggested_search_terms: ['hinge', 'runner', 'bracket'],
    },
    {
      id: 'internals_storage',
      title: 'Internal storage',
      hint: 'Bins, larder pull-outs, wirework, inserts.',
      keywords: [...K.internals],
      suggested_search_terms: ['pull out', 'bin', 'wirework'],
    },
    {
      id: 'lighting',
      title: 'Lighting (optional)',
      hint: 'LED strips, sensors, drivers.',
      keywords: [...K.lighting],
      suggested_search_terms: ['LED', 'driver', 'sensor'],
    },
    {
      id: 'worktops_panels',
      title: 'Worktops & panels (optional)',
      hint: 'Worktops, end panels, upstands, splashbacks.',
      keywords: [...K.worktops],
      suggested_search_terms: ['worktop', 'end panel', 'upstand'],
    },
    {
      id: 'mouldings_finishing',
      title: 'Mouldings & finishing (optional)',
      hint: 'Plinths, cornice/pelmet, trims.',
      keywords: [...K.mouldings],
      suggested_search_terms: ['plinth', 'cornice', 'pelmet'],
    },
    {
      id: 'accessories_misc',
      title: 'Accessories (optional)',
      hint: 'Sinks, taps, appliances, extras.',
      keywords: [...K.accessories],
      suggested_search_terms: ['sink', 'tap', 'appliance'],
    },
  ]

  // If the user is doing "collection" and doesn’t know postcode, don’t block; checklist is informative anyway.
  const _room = params.project?.room_type ?? null
  const prioritizeUnits = _room === 'kitchen' || _room === 'bedroom' || _room === 'other'

  const evaluated = groups.map((g) => {
    const isComplete = hasAny(g.keywords) || (!prioritizeUnits && g.id === 'units')
    return {
      id: g.id,
      title: g.title,
      hint: g.hint,
      is_complete: isComplete,
      matched_examples: isComplete ? examplesFor(g.keywords) : [],
      suggested_search_terms: g.suggested_search_terms,
    } satisfies ChecklistGroup
  })

  return evaluated
}

