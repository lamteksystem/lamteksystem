/**
 * Title Case for product display names (major words capitalized; minor words lowercase).
 */
const MINOR_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'but',
  'or',
  'for',
  'nor',
  'on',
  'at',
  'to',
  'from',
  'by',
  'in',
  'of',
  'as',
  'with',
  'vs',
  'per',
])

function capitalizeWord(word: string, isFirst: boolean): string {
  if (!word) return word
  if (!isFirst && MINOR_WORDS.has(word.toLowerCase())) return word.toLowerCase()
  if (/^\d+(\.\d+)?(mm|cm|m)?$/i.test(word)) return word.toLowerCase()
  if (word.length <= 4 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word
  if (word.includes('-')) {
    return word
      .split('-')
      .map((part, i) => capitalizeWord(part, isFirst && i === 0))
      .join('-')
  }
  if (word.includes('/')) {
    return word
      .split('/')
      .map((part, i) => capitalizeWord(part, isFirst && i === 0))
      .join('/')
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

function titleCaseSegment(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  const words = trimmed.split(/\s+/)
  return words.map((w, i) => capitalizeWord(w, i === 0)).join(' ')
}

/** Apply title case to a product name (handles parentheticals like "(dawson)"). */
export function toTitleCase(name: string): string {
  const raw = name.trim()
  if (!raw) return raw
  const parts = raw.split(/(\s*\([^)]*\))/g).filter((p) => p.length > 0)
  return parts
    .map((part) => {
      const paren = part.match(/^\s*(\([^)]*\))$/)
      if (paren) {
        const inner = paren[1].slice(1, -1)
        return ` (${titleCaseSegment(inner)})`
      }
      return titleCaseSegment(part)
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeProductDisplayName(name: string): string {
  return toTitleCase(name)
}
