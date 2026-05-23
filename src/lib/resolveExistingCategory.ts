import { slugifyCategoryName } from '@/lib/categoryAdmin'
import type { CategoryRow } from '@/types/database'

/** Match an imported section name to an existing category only — never invent slugs or rows. */
export function resolveExistingCategoryId(
  sectionName: string,
  categories: CategoryRow[],
): string | null {
  const sectionTrim = sectionName.trim()
  if (!sectionTrim) return null

  const candidates = [sectionTrim]
  if (!/^tealbury/i.test(sectionTrim)) {
    candidates.push(`Tealbury — ${sectionTrim}`)
  }

  const seen = new Set<string>()
  for (const name of candidates) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const byName = categories.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())
    if (byName) return byName.id

    const slug = slugifyCategoryName(name)
    const bySlug = categories.find((c) => c.slug === slug)
    if (bySlug) return bySlug.id

    const partial = categories.find((c) => {
      const cn = c.name.toLowerCase()
      const sn = name.toLowerCase()
      if (sn.length < 4) return false
      return cn === sn || (cn.includes(sn) && sn.length >= cn.length * 0.6)
    })
    if (partial) return partial.id
  }

  return null
}
