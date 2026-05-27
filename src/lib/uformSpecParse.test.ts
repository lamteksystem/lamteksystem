import { describe, expect, it } from 'vitest'
import { parseUformSpecText } from '@/lib/uformSpecParse'

describe('parseUformSpecText', () => {
  it('extracts door sizes from Kensington-style spec text', () => {
    const text = [
      'STANDARD DRAWERFRONTS',
      '715 x 597',
      'STANDARD DOORS',
      '140 x 497 slab',
      'STANDARD ACCESSORIES',
      'PLINTH',
      '150 X 3000 X 16',
    ].join('\n')
    const products = parseUformSpecText(text, 'kensington-tech-spec-1')
    const drawerFronts = products.filter((p) => p.kind === 'drawer_front')
    const doors = products.filter((p) => p.kind === 'door')
    expect(drawerFronts.some((d) => d.height_mm === 715 && d.width_mm === 597)).toBe(true)
    expect(drawerFronts.some((d) => d.section === 'Drawer Fronts')).toBe(true)
    expect(doors.some((d) => d.height_mm === 140 && d.width_mm === 497)).toBe(true)
  })
})
