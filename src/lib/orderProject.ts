import { getUserPreference, setUserPreference } from '@/lib/userPreferences'

export type OrderProject = {
  room_type: 'kitchen' | 'bedroom' | 'other'
  delivery_method: 'deliver' | 'collect'
  postcode: string | null
  site_notes: string | null
  measurements: {
    room_length_mm: number | null
    room_width_mm: number | null
    ceiling_height_mm: number | null
  }
  updated_at: string
}

function keyFor(orderId: string) {
  return `order_project_${orderId}`
}

export async function getOrderProject(orderId: string): Promise<OrderProject | null> {
  const raw = await getUserPreference(keyFor(orderId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as OrderProject
  } catch {
    return null
  }
}

export async function setOrderProject(orderId: string, project: Omit<OrderProject, 'updated_at'>): Promise<void> {
  const payload: OrderProject = { ...project, updated_at: new Date().toISOString() }
  await setUserPreference(keyFor(orderId), JSON.stringify(payload))
}

