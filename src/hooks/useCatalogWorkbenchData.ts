import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CATALOG_PROGRAM, type CatalogProgram } from '@/lib/catalogProgram'
import type { AssemblyWithLines, CategoryRow, ProductRow } from '@/types/database'

export function useCatalogWorkbenchData(programs: CatalogProgram[]) {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [assemblies, setAssemblies] = useState<AssemblyWithLines[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (programs.length === 0) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      const programFilter = programs.length === 1 ? programs[0] : null
      let prodQuery = supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('sort_order')
        .order('name')
      if (programFilter) {
        prodQuery = prodQuery.eq('catalog_program', programFilter)
      } else {
        prodQuery = prodQuery.in('catalog_program', programs)
      }
      const { data: prodData } = await prodQuery
      const plist = (prodData ?? []) as ProductRow[]
      const catIds = [...new Set(plist.map((p) => p.category_id).filter(Boolean))] as string[]
      const { data: catData } =
        catIds.length === 0
          ? { data: [] as CategoryRow[] }
          : await supabase.from('categories').select('*').in('id', catIds).order('sort_order').order('name')

      let assyList: AssemblyWithLines[] = []
      if (programs.includes(CATALOG_PROGRAM.LAMTEK)) {
        const { data: assyData } = await supabase
          .from('assemblies')
          .select(
            `*, assembly_lines ( id, assembly_id, product_id, quantity, sort_order, product:products (*) )`,
          )
          .eq('active', true)
          .order('sort_order')
          .order('width_mm', { nullsFirst: false })
        assyList = ((assyData ?? []) as AssemblyWithLines[]).filter((a) =>
          (a.assembly_lines ?? []).every((line) => {
            const p = line.product as ProductRow | undefined
            return !p || p.catalog_program !== CATALOG_PROGRAM.TEALBURY
          }),
        )
      }

      if (!cancelled) {
        setProducts(plist)
        setCategories((catData ?? []) as CategoryRow[])
        setAssemblies(assyList)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [programs.join(',')])

  return { products, categories, assemblies, loading }
}
