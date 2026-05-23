import { getUserPreference, setUserPreference } from '@/lib/userPreferences'

export type SavedPromptPreset = {
  id: string
  name: string
  prompt: string
  createdAt: string
}

const PROMPT_PRESETS_KEY = 'pricelist_workbench_prompt_presets_v1'

function parsePresets(json: string | null): SavedPromptPreset[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json) as SavedPromptPreset[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function loadPromptPresets(): Promise<SavedPromptPreset[]> {
  const raw = await getUserPreference(PROMPT_PRESETS_KEY)
  return parsePresets(raw)
}

export async function savePromptPresets(presets: SavedPromptPreset[]): Promise<void> {
  await setUserPreference(PROMPT_PRESETS_KEY, JSON.stringify(presets))
}

export function defaultPromptPresetName(prompt: string): string {
  const oneLine = prompt.replace(/\s+/g, ' ').trim()
  if (!oneLine) return 'Untitled command'
  return oneLine.length <= 56 ? oneLine : `${oneLine.slice(0, 53)}…`
}
