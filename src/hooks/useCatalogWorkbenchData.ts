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
      const { data: catData } = await supabase.from('categories').select('*').order('sort_order').order('name')

      let assyList: AssemblyWithLines[] = []
      const { data: assyData } = await supabase
        .from('assemblies')
        .select(
          `*, assembly_lines ( id, assembly_id, product_id, quantity, sort_order, component_role, product:products (*) )`,
        )
        .eq('active', true)
        .order('sort_order')
        .order('width_mm', { nullsFirst: false })
      const rawAssemblies = (assyData ?? []) as AssemblyWithLines[]
      if (programs.includes(CATALOG_PROGRAM.LAMTEK) && programs.includes(CATALOG_PROGRAM.TEALBURY)) {
        assyList = rawAssemblies
      } else if (programs.includes(CATALOG_PROGRAM.TEALBURY)) {
        assyList = rawAssemblies.filter(
          (a) =>
            a.product_id &&
            plist.some((p) => p.id === a.product_id && p.catalog_program === CATALOG_PROGRAM.TEALBURY),
        )
      } else if (programs.includes(CATALOG_PROGRAM.LAMTEK)) {
        assyList = rawAssemblies.filter((a) =>
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
