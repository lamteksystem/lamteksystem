import { getUserPreference, setUserPreference } from '@/lib/userPreferences'
import type { WorkbenchFilterState } from '@/lib/catalogProductDisplay'
import { EMPTY_WORKBENCH_FILTERS } from '@/lib/catalogProductDisplay'

export interface SavedFilterPreset {
  id: string
  name: string
  filters: WorkbenchFilterState
}

function filtersKey(scope: string) {
  return `catalog_workbench_filters_${scope}`
}

function favouritesKey(scope: string) {
  return `catalog_workbench_favourites_${scope}`
}

function presetsKey(scope: string) {
  return `catalog_workbench_presets_${scope}`
}

export async function loadWorkbenchFilters(scope: string): Promise<WorkbenchFilterState> {
  const raw = await getUserPreference(filtersKey(scope))
  if (!raw) return { ...EMPTY_WORKBENCH_FILTERS }
  try {
    const parsed = JSON.parse(raw) as Partial<WorkbenchFilterState>
    return { ...EMPTY_WORKBENCH_FILTERS, ...parsed }
  } catch {
    return { ...EMPTY_WORKBENCH_FILTERS }
  }
}

export async function saveWorkbenchFilters(scope: string, filters: WorkbenchFilterState): Promise<void> {
  await setUserPreference(filtersKey(scope), JSON.stringify(filters))
}

export async function loadFavouriteProductIds(scope: string): Promise<string[]> {
  const raw = await getUserPreference(favouritesKey(scope))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export async function saveFavouriteProductIds(scope: string, ids: string[]): Promise<void> {
  await setUserPreference(favouritesKey(scope), JSON.stringify(ids))
}

export async function loadFilterPresets(scope: string): Promise<SavedFilterPreset[]> {
  const raw = await getUserPreference(presetsKey(scope))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as SavedFilterPreset[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveFilterPresets(scope: string, presets: SavedFilterPreset[]): Promise<void> {
  await setUserPreference(presetsKey(scope), JSON.stringify(presets))
}
