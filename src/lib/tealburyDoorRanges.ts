/** Door ranges Lamtek buys from UFORM for Tealbury Complete (no Supabase deps). */
export const TEALBURY_DOOR_RANGES = [
  'Oakham Soft Matte',
  'Oakham Gloss',
  'Dawson',
  'Knightsbridge Std',
  'Knightsbridge Prm',
  'Norwood',
  'Papplewick',
] as const

export type TealburyDoorRange = (typeof TEALBURY_DOOR_RANGES)[number]
