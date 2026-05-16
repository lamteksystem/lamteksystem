import { useEffect, useState } from 'react'
import {
  ASSEMBLY_COMPONENT_ROLE_LABELS,
  fetchProductAssemblyBom,
  type AssemblyComponentRole,
  type ProductAssemblyBom,
} from '@/lib/productAssembly'

interface ProductAssemblyBreakdownProps {
  productId: string
  /** Show per-line stock qty when provided (stock take). */
  stockByProductId?: Map<string, number>
  compact?: boolean
  className?: string
}

export default function ProductAssemblyBreakdown({
  productId,
  stockByProductId,
  compact,
  className,
}: ProductAssemblyBreakdownProps) {
  const [bom, setBom] = useState<ProductAssemblyBom | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchProductAssemblyBom(productId).then((data) => {
      if (cancelled) return
      setBom(data)
      setLoading(false)
    }).catch((e) => {
      if (cancelled) return
      setError(e instanceof Error ? e.message : 'Could not load breakdown.')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [productId])

  if (loading) {
    return <p className={`admin-muted product-assembly-breakdown ${className ?? ''}`.trim()}>Loading make-up…</p>
  }
  if (error) {
    return <p className={`admin-error product-assembly-breakdown ${className ?? ''}`.trim()}>{error}</p>
  }
  if (!bom || bom.assembly_lines.length === 0) {
    return (
      <p className={`admin-muted product-assembly-breakdown ${className ?? ''}`.trim()}>
        No component breakdown is defined for this complete unit yet.
      </p>
    )
  }

  return (
    <div className={`product-assembly-breakdown${compact ? ' product-assembly-breakdown--compact' : ''}${className ? ` ${className}` : ''}`}>
      <p className="product-assembly-breakdown-intro">
        This complete item is made up of the following stocked components (count these in inventory):
      </p>
      <table className="product-assembly-breakdown-table">
        <thead>
          <tr>
            <th>Part</th>
            <th>Product</th>
            <th>SKU</th>
            <th>Qty</th>
            {stockByProductId && <th>Stock here</th>}
          </tr>
        </thead>
        <tbody>
          {bom.assembly_lines.map((line) => (
            <tr key={line.id}>
              <td>{ASSEMBLY_COMPONENT_ROLE_LABELS[line.component_role as AssemblyComponentRole]}</td>
              <td>{line.product?.name ?? '—'}</td>
              <td><code>{line.product?.sku ?? '—'}</code></td>
              <td>{line.quantity}</td>
              {stockByProductId && (
                <td>{stockByProductId.get(line.product_id) ?? 0}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
