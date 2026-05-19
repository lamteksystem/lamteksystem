/** Keep cart/workbench line order stable when refetching after qty or price updates. */
export function preserveLineOrder<T extends { id: string }>(previous: T[], fetched: T[]): T[] {
  if (fetched.length === 0) return []
  if (previous.length === 0) return fetched

  const byId = new Map(fetched.map((line) => [line.id, line]))
  const ordered: T[] = []

  for (const line of previous) {
    const next = byId.get(line.id)
    if (next) {
      ordered.push(next)
      byId.delete(line.id)
    }
  }

  for (const line of fetched) {
    if (byId.has(line.id)) ordered.push(line)
  }

  return ordered
}
