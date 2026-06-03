import { describe, expect, it } from 'vitest'
import { toTitleCase } from '@/lib/titleCase'

describe('toTitleCase', () => {
  it('capitalizes major words and lowercases minor words', () => {
    expect(toTitleCase('plain end panel for the base')).toBe('Plain End Panel for the Base')
  })

  it('title-cases parenthetical range labels', () => {
    expect(toTitleCase('plain end panel (dawson)')).toBe('Plain End Panel (Dawson)')
  })

  it('preserves short acronyms', () => {
    expect(toTitleCase('1000 HL base unit')).toBe('1000 HL Base Unit')
  })
})
