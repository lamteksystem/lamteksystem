import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getUserPreference, setUserPreference } from '@/lib/userPreferences'
import type { OrderRow, OrderLineRow, ProductRow, CustomerProfileRow, LocationRow, ProductStockRow } from '@/types/database'
import { lamtekPortalLocations } from '@/lib/lamtekLocations'
import { AreaTrendChart } from '@/components/charts/AreaTrendChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { formatDashboardCurrency, statusBreakdown, trendToChartPoints } from '@/lib/dashboardAnalytics'

type DatePreset = '7d' | '30d' | '90d' | 'ytd'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1)
}

function downloadCsv(filename: string, rows: Record<string, string | number | null | undefined>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function formatDateShort(d: string | null | undefined) {
  return d ? String(d).slice(0, 10) : '—'
}

export default function AdminReports() {
  type ReportCardKey = 'sales' | 'status' | 'customers' | 'products' | 'revenue' | 'margin' | 'stock'
  const [preset, setPreset] = useState<DatePreset>('30d')
  const [from, setFrom] = useState<string>(() => isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
  const [to, setTo] = useState<string>(() => isoDate(new Date()))
  const [loading, setLoading] = useState(true)
  const [stockLowThreshold, setStockLowThreshold] = useState<number>(5)
  const [selectedLowStockProductId, setSelectedLowStockProductId] = useState<string | null>(null)
  const [trendDays, setTrendDays] = useState<7 | 14 | 30>(14)

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [lines, setLines] = useState<OrderLineRow[]>([])
  const [productsById, setProductsById] = useState<Map<string, ProductRow>>(new Map())
  const [customersByUserId, setCustomersByUserId] = useState<Map<string, CustomerProfileRow>>(new Map())

  const [locations, setLocations] = useState<LocationRow[]>([])
  const [stockLocationId, setStockLocationId] = useState<string>('')
  const [stockRows, setStockRows] = useState<ProductStockRow[]>([])
  const [stockFallbackNames, setStockFallbackNames] = useState<Map<string, string>>(new Map())
  const [stockProductsByStockKey, setStockProductsByStockKey] = useState<Map<string, ProductRow>>(new Map())
  const [stockAliases, setStockAliases] = useState<Record<string, string>>({})
  const [aliasInput, setAliasInput] = useState('')
  const [savingAlias, setSavingAlias] = useState(false)
  const [inlineEditingProductId, setInlineEditingProductId] = useState<string | null>(null)
  const [inlineAliasDraft, setInlineAliasDraft] = useState('')
  const [selectedReportCard, setSelectedReportCard] = useState<ReportCardKey | null>(null)
  const [statusCardFilter, setStatusCardFilter] = useState<string | 'all'>('all')
  const [trendCardDateFilter, setTrendCardDateFilter] = useState<string | null>(null)

  const STOCK_ALIAS_PREF_KEY = 'admin_reports_stock_aliases'

  function stockAliasKey(locationId: string, productId: string) {
    return `${locationId}:${productId}`
  }

  useEffect(() => {
    const now = new Date()
    if (preset === '7d') {
      setFrom(isoDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)))
      setTo(isoDate(now))
    }
    if (preset === '30d') {
      setFrom(isoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)))
      setTo(isoDate(now))
    }
    if (preset === '90d') {
      setFrom(isoDate(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)))
      setTo(isoDate(now))
    }
    if (preset === 'ytd') {
      setFrom(isoDate(startOfYear(now)))
      setTo(isoDate(now))
    }
  }, [preset])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const fromTs = `${from}T00:00:00Z`
      const toTs = `${to}T23:59:59Z`

      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', fromTs)
        .lte('created_at', toTs)
        .in('status', ['placed', 'invoiced', 'paid'])
        .order('created_at', { ascending: false })
        .limit(2000)

      const list = (orderData ?? []) as OrderRow[]
      setOrders(list)

      const orderIds = list.map((o) => o.id)
      if (orderIds.length === 0) {
        setLines([])
        setProductsById(new Map())
        setCustomersByUserId(new Map())
        setLoading(false)
        return
      }

      const [linesRes, productsRes, profilesRes] = await Promise.all([
        supabase.from('order_lines').select('*').in('order_id', orderIds),
        supabase.from('products').select('*'),
        supabase.from('customer_profiles').select('*').in('user_id', [...new Set(list.map((o) => o.user_id))]),
      ])

      const lineList = (linesRes.data ?? []) as OrderLineRow[]
      setLines(lineList)

      const prodMap = new Map<string, ProductRow>()
      ;(productsRes.data ?? []).forEach((p) => prodMap.set((p as ProductRow).id, p as ProductRow))
      // Merge products we need for sales metrics (order lines) into the map.
      // We also populate products for stock reports in a separate effect.
      setProductsById((prev) => {
        const next = new Map(prev)
        for (const [id, row] of prodMap.entries()) next.set(id, row)
        return next
      })

      const custMap = new Map<string, CustomerProfileRow>()
      ;(profilesRes.data ?? []).forEach((c) => custMap.set((c as CustomerProfileRow).user_id, c as CustomerProfileRow))
      setCustomersByUserId(custMap)

      setLoading(false)
    }
    load()
  }, [from, to])

  useEffect(() => {
    async function loadLocations() {
      const { data } = await supabase.from('locations').select('*').eq('active', true).order('sort_order').order('name')
      const locs = lamtekPortalLocations((data ?? []) as LocationRow[])
      setLocations(locs)
      setStockLocationId((prev) => (prev && locs.some((l) => l.id === prev) ? prev : (locs[0]?.id ?? '')))
    }
    loadLocations()
     
  }, [])

  useEffect(() => {
    let cancelled = false
    getUserPreference(STOCK_ALIAS_PREF_KEY).then((raw) => {
      if (cancelled) return
      if (!raw) {
        setStockAliases({})
        return
      }
      try {
        const parsed = JSON.parse(raw) as Record<string, string>
        setStockAliases(parsed && typeof parsed === 'object' ? parsed : {})
      } catch (_) {
        setStockAliases({})
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    async function loadStock() {
      if (!stockLocationId) {
        setStockRows([])
        setStockFallbackNames(new Map())
        setStockProductsByStockKey(new Map())
        return
      }

      const { data } = await supabase
        .from('product_stock')
        .select('*')
        .eq('location_id', stockLocationId)

      const list = (data ?? []) as ProductStockRow[]
      setStockRows(list)

      // Ensure we also have product names/SKUs for the stock items we display.
      const productIds = [...new Set(list.map((r) => r.product_id).filter(Boolean))]
      if (productIds.length === 0) return
      const idBatches = chunkArray(productIds, 150)

      const stockProducts: ProductRow[] = []
      for (const batch of idBatches) {
        const { data: stockBatch, error } = await supabase
          .from('products')
          .select('*')
          .in('id', batch)
        if (error) {
          console.error('Failed loading stock products by id batch', error)
          continue
        }
        ;(stockBatch ?? []).forEach((p) => stockProducts.push(p as ProductRow))
      }

      const prodMap = new Map<string, ProductRow>()
      ;(stockProducts ?? []).forEach((p) => prodMap.set((p as ProductRow).id, p as ProductRow))
      setProductsById((prev) => {
        const next = new Map(prev)
        for (const [id, row] of prodMap.entries()) next.set(id, row)
        return next
      })

      // Some legacy datasets may store stock `product_id` as SKU-like references.
      // Try resolving unmatched stock keys against products.sku so we can show names.
      const unresolvedStockKeys = productIds.filter((id) => !prodMap.has(id))
      const skuAliasMap = new Map<string, ProductRow>()
      if (unresolvedStockKeys.length > 0) {
        for (const batch of chunkArray(unresolvedStockKeys, 150)) {
          const { data: skuProducts, error } = await supabase
            .from('products')
            .select('*')
            .in('sku', batch)
          if (error) {
            console.error('Failed loading stock products by sku batch', error)
            continue
          }
          ;(skuProducts ?? []).forEach((p) => {
            const row = p as ProductRow
            if (row.sku) skuAliasMap.set(row.sku, row)
          })
        }
      }

      const stockKeyMap = new Map<string, ProductRow>()
      productIds.forEach((k) => {
        const direct = prodMap.get(k)
        if (direct) stockKeyMap.set(k, direct)
        else {
          const viaSku = skuAliasMap.get(k)
          if (viaSku) stockKeyMap.set(k, viaSku)
        }
      })
      setStockProductsByStockKey(stockKeyMap)

      // Fallback naming: for products that no longer have a clean product record/name,
      // infer a user-friendly name from historical order line snapshots.
      const fallback = new Map<string, string>()
      const unresolvedForSnapshots = productIds.filter((id) => !stockKeyMap.has(id))
      if (unresolvedForSnapshots.length > 0) {
        for (const batch of chunkArray(unresolvedForSnapshots, 150)) {
          const { data: lineSnapshots, error } = await supabase
            .from('order_lines')
            .select('product_id, product_snapshot')
            .in('product_id', batch)
            .limit(5000)
          if (error) {
            console.error('Failed loading order line snapshots batch', error)
            continue
          }
          ;(lineSnapshots ?? []).forEach((row) => {
            const pid = (row as { product_id?: string }).product_id
            const snap = (row as { product_snapshot?: any }).product_snapshot
            const snapName = typeof snap?.name === 'string' ? snap.name.trim() : ''
            if (pid && snapName && !fallback.has(pid)) fallback.set(pid, snapName)
          })
        }
      }
      setStockFallbackNames(fallback)
    }
    loadStock()
  }, [stockLocationId])

  const metrics = useMemo(() => {
    const totalInc = orders.reduce((s, o) => s + Number(o.total_inc_vat || 0), 0)
    const totalEx = orders.reduce((s, o) => s + Number(o.total_ex_vat || 0), 0)

    let cogs = 0
    const revenueByProduct = new Map<string, number>()
    const unitsByProduct = new Map<string, number>()
    for (const l of lines) {
      const qty = Number(l.quantity || 0)
      const revenue = qty * Number(l.unit_price || 0)
      const prod = productsById.get(l.product_id)
      const cost = qty * Number(prod?.cost_price || 0)
      cogs += cost
      revenueByProduct.set(l.product_id, (revenueByProduct.get(l.product_id) ?? 0) + revenue)
      unitsByProduct.set(l.product_id, (unitsByProduct.get(l.product_id) ?? 0) + qty)
    }

    const marginEx = totalEx - cogs
    const marginPct = totalEx > 0 ? (marginEx / totalEx) * 100 : 0

    const byStatus: Record<string, number> = {}
    const revenueByStatus: Record<string, number> = {}
    for (const o of orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
    for (const o of orders) {
      revenueByStatus[o.status] = (revenueByStatus[o.status] ?? 0) + Number(o.total_ex_vat || 0)
    }

    const revenueByCustomer = new Map<string, number>()
    for (const o of orders) {
      revenueByCustomer.set(o.user_id, (revenueByCustomer.get(o.user_id) ?? 0) + Number(o.total_ex_vat || 0))
    }

    const topCustomers = [...revenueByCustomer.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, rev]) => ({ userId, rev }))

    const topProducts = [...revenueByProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([productId, rev]) => ({ productId, rev, units: unitsByProduct.get(productId) ?? 0 }))

    const orderDateById = new Map<string, string>()
    for (const o of orders) {
      const key = (o.created_at ?? '').slice(0, 10)
      if (key) orderDateById.set(o.id, key)
    }

    const revenueByDay = new Map<string, number>()
    for (const o of orders) {
      const key = (o.created_at ?? '').slice(0, 10)
      if (!key) continue
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(o.total_ex_vat || 0))
    }

    const cogsByDay = new Map<string, number>()
    for (const l of lines) {
      const key = orderDateById.get(l.order_id)
      if (!key) continue
      const qty = Number(l.quantity || 0)
      const prod = productsById.get(l.product_id)
      const cost = qty * Number(prod?.cost_price || 0)
      cogsByDay.set(key, (cogsByDay.get(key) ?? 0) + cost)
    }

    const revenueTrend = [...revenueByDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-trendDays)
      .map(([date, rev]) => ({ date, rev }))

    const marginTrend = revenueTrend.map((r) => {
      const cogsDay = cogsByDay.get(r.date) ?? 0
      return {
        date: r.date,
        rev: r.rev,
        cogs: cogsDay,
        margin: r.rev - cogsDay,
      }
    })

    return { totalInc, totalEx, cogs, marginEx, marginPct, byStatus, revenueByStatus, topCustomers, topProducts, revenueTrend, marginTrend }
  }, [orders, lines, productsById, trendDays])

  const stockMetrics = useMemo(() => {
    const qtyByProduct = new Map<string, number>()
    for (const r of stockRows) qtyByProduct.set(r.product_id, Number(r.quantity || 0))

    const low = [...qtyByProduct.entries()]
      .map(([productId, qty]) => {
        const product = stockProductsByStockKey.get(productId) ?? productsById.get(productId)
        const unitCost = Number(product?.cost_price || 0)
        return {
          productId,
          qty,
          product,
          unitCost,
          totalCost: qty * unitCost,
        }
      })
      .filter((x) => (x.product?.active ?? true) && (x.qty <= stockLowThreshold))
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 25)

    let valuation = 0
    for (const [productId, qty] of qtyByProduct.entries()) {
      const p = stockProductsByStockKey.get(productId) ?? productsById.get(productId)
      const cost = Number(p?.cost_price || 0)
      valuation += qty * cost
    }

    return { low, valuation }
  }, [stockRows, productsById, stockProductsByStockKey, stockLowThreshold])

  function getStockDisplayName(productId: string, product?: ProductRow) {
    const alias = (stockAliases[stockAliasKey(stockLocationId, productId)] ?? '').trim()
    // Ignore legacy placeholder aliases saved during earlier iterations.
    if (alias && alias !== 'Unknown product' && !alias.startsWith('Stock item ')) return alias
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)
    if (product?.name?.trim()) return product.name
    const snapName = stockFallbackNames.get(productId)
    if (snapName) return snapName
    if (product?.sku?.trim()) return `SKU ${product.sku}`
    if (!isUuid) return `SKU ${productId}`
    // Final fallback: keep labels user-friendly (no opaque IDs in UI).
    return 'Needs naming'
  }

  const selectedLowStockItem = useMemo(
    () => stockMetrics.low.find((x) => x.productId === selectedLowStockProductId) ?? null,
    [stockMetrics.low, selectedLowStockProductId]
  )

  const statusCardOrders = useMemo(() => {
    const list = statusCardFilter === 'all' ? orders : orders.filter((o) => o.status === statusCardFilter)
    // Keep newest first.
    return [...list].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
  }, [orders, statusCardFilter])

  const trendCardOrders = useMemo(() => {
    if (!trendCardDateFilter) return []
    const target = trendCardDateFilter
    return orders
      .filter((o) => String(o.created_at ?? '').slice(0, 10) === target)
      .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
  }, [orders, trendCardDateFilter])

  useEffect(() => {
    if (!selectedLowStockItem) {
      setAliasInput('')
      return
    }
    const key = stockAliasKey(stockLocationId, selectedLowStockItem.productId)
    setAliasInput(stockAliases[key] ?? '')
  }, [selectedLowStockItem, stockAliases, stockLocationId])

  async function saveAlias() {
    if (!selectedLowStockItem || !stockLocationId) return
    await saveAliasForProduct(selectedLowStockItem.productId, aliasInput)
  }

  async function saveAliasForProduct(productId: string, nextName: string) {
    if (!stockLocationId) return
    const key = stockAliasKey(stockLocationId, productId)
    const next = { ...stockAliases }
    const trimmed = nextName.trim()
    if (trimmed) next[key] = trimmed
    else delete next[key]
    setStockAliases(next)
    setSavingAlias(true)
    await setUserPreference(STOCK_ALIAS_PREF_KEY, JSON.stringify(next))
    setSavingAlias(false)
  }

  function onCardClick(card: ReportCardKey) {
    setSelectedReportCard(card)
    if (card === 'status') setStatusCardFilter('all')
    if (card === 'revenue' || card === 'margin') setTrendCardDateFilter(null)
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading reports…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">Reports</span>
      </div>

      <div
        className="card admin-card admin-card--interactive"
        role="button"
        tabIndex={0}
        onClick={() => onCardClick('sales')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onCardClick('sales')
          }
        }}
      >
        <h2>Sales overview</h2>
        <div className="admin-inline-form--stack">
          <label>
            Preset{' '}
            <select value={preset} onChange={(e) => setPreset(e.target.value as DatePreset)}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="ytd">Year to date</option>
            </select>
          </label>
          <label>
            From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="admin-report-metrics">
          <div className="admin-report-metric">
            <div className="admin-muted">Orders</div>
            <div className="admin-report-metric-value">{orders.length}</div>
          </div>
          <div className="admin-report-metric">
            <div className="admin-muted">Revenue (ex VAT)</div>
            <div className="admin-report-metric-value">£{metrics.totalEx.toFixed(2)}</div>
          </div>
          <div className="admin-report-metric">
            <div className="admin-muted">COGS (ex VAT)</div>
            <div className="admin-report-metric-value">£{metrics.cogs.toFixed(2)}</div>
          </div>
          <div className="admin-report-metric">
            <div className="admin-muted">Gross margin</div>
            <div className="admin-report-metric-value">£{metrics.marginEx.toFixed(2)} ({metrics.marginPct.toFixed(1)}%)</div>
          </div>
        </div>
        <div className="admin-inline-form--stack" style={{ marginTop: '0.5rem' }}>
          <label>
            Trend window{' '}
            <select value={trendDays} onChange={(e) => setTrendDays(Number(e.target.value) as 7 | 14 | 30)}>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </label>
        </div>
        <div className="admin-inline-form--stack" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-small btn-outline"
            onClick={(e) => {
              e.stopPropagation()
              downloadCsv(`orders_${from}_to_${to}.csv`, orders.map((o) => ({
              id: o.id,
              reference: o.reference ?? '',
              user_id: o.user_id,
              status: o.status,
              created_at: o.created_at,
              total_ex_vat: Number(o.total_ex_vat || 0),
              total_inc_vat: Number(o.total_inc_vat || 0),
              invoice_number: o.invoice_number ?? '',
              })))
            }}
            disabled={orders.length === 0}
          >
            Export orders CSV
          </button>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="card admin-card admin-card--interactive" role="button" tabIndex={0} onClick={() => onCardClick('status')}>
          <h2>Orders by status</h2>
          <ul className="admin-report-list">
            {Object.entries(metrics.byStatus).map(([s, n]) => (
              <li key={s} className="admin-report-list-item">
                <span className="admin-report-list-label">{s}</span>
                <span className="admin-report-list-value">
                  {n} · £{(metrics.revenueByStatus[s] ?? 0).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card admin-card admin-card--interactive" role="button" tabIndex={0} onClick={() => onCardClick('customers')}>
          <h2>Top customers (ex VAT)</h2>
          {metrics.topCustomers.length === 0 ? (
            <p className="admin-muted">No data.</p>
          ) : (
            <ul className="admin-report-list">
              {metrics.topCustomers.map((c) => (
                <li key={c.userId} className="admin-report-list-item">
                  <span className="admin-report-list-label">
                    {customersByUserId.get(c.userId)?.company_name ?? c.userId.slice(0, 8)}
                  </span>
                  <span className="admin-report-list-value">£{c.rev.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="admin-inline-form--stack" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-small btn-outline"
              onClick={(e) => {
                e.stopPropagation()
                downloadCsv(`top_customers_${from}_to_${to}.csv`, metrics.topCustomers.map((c) => ({
                customer: customersByUserId.get(c.userId)?.company_name ?? c.userId,
                user_id: c.userId,
                revenue_ex_vat: Number(c.rev),
                })))
              }}
              disabled={metrics.topCustomers.length === 0}
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="card admin-card admin-card--interactive" role="button" tabIndex={0} onClick={() => onCardClick('products')}>
          <h2>Top products (revenue)</h2>
          {metrics.topProducts.length === 0 ? (
            <p className="admin-muted">No data.</p>
          ) : (
            <ul className="admin-report-list">
              {metrics.topProducts.map((p) => (
                <li key={p.productId} className="admin-report-list-item">
                  <span className="admin-report-list-label">
                    {productsById.get(p.productId)?.name ?? p.productId.slice(0, 8)} <span className="admin-muted">({p.units} units)</span>
                  </span>
                  <span className="admin-report-list-value">£{p.rev.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="admin-inline-form--stack" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-small btn-outline"
              onClick={(e) => {
                e.stopPropagation()
                downloadCsv(`top_products_${from}_to_${to}.csv`, metrics.topProducts.map((p) => ({
                product: productsById.get(p.productId)?.name ?? p.productId,
                sku: productsById.get(p.productId)?.sku ?? '',
                product_id: p.productId,
                units: Number(p.units),
                revenue: Number(p.rev),
                })))
              }}
              disabled={metrics.topProducts.length === 0}
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="card admin-card admin-card--interactive" role="button" tabIndex={0} onClick={() => onCardClick('revenue')}>
          <h2>Revenue trend (ex VAT)</h2>
          {metrics.revenueTrend.length === 0 ? (
            <p className="admin-muted">No data.</p>
          ) : (
            <AreaTrendChart data={revenueChartData} height={200} valueFormatter={(n) => formatDashboardCurrency(n)} ariaLabel="Revenue trend" />
          )}
          <div className="admin-inline-form--stack" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-small btn-outline"
              onClick={(e) => {
                e.stopPropagation()
                downloadCsv(`revenue_trend_${from}_to_${to}.csv`, metrics.revenueTrend.map((x) => ({
                date: x.date,
                revenue_ex_vat: Number(x.rev),
                })))
              }}
              disabled={metrics.revenueTrend.length === 0}
            >
              Export trend CSV
            </button>
          </div>
        </div>
        <div className="card admin-card admin-card--interactive" role="button" tabIndex={0} onClick={() => onCardClick('margin')}>
          <h2>Margin trend (ex VAT)</h2>
          {metrics.marginTrend.length === 0 ? (
            <p className="admin-muted">No data.</p>
          ) : (
            <AreaTrendChart data={marginChartData} height={200} valueFormatter={(n) => formatDashboardCurrency(n)} ariaLabel="Margin trend" />
          )}
          <div className="admin-inline-form--stack" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-small btn-outline"
              onClick={(e) => {
                e.stopPropagation()
                downloadCsv(`margin_trend_${from}_to_${to}.csv`, metrics.marginTrend.map((x) => ({
                date: x.date,
                revenue_ex_vat: Number(x.rev),
                cogs_ex_vat: Number(x.cogs),
                margin_ex_vat: Number(x.margin),
                })))
              }}
              disabled={metrics.marginTrend.length === 0}
            >
              Export margin CSV
            </button>
          </div>
        </div>
      </div>

      <div className="card admin-card admin-card--interactive" style={{ marginTop: '1rem' }} role="button" tabIndex={0} onClick={() => onCardClick('stock')}>
        <h2>Stock (by location)</h2>
        <div className="admin-inline-form--stack">
          <label>
            Location{' '}
            <select value={stockLocationId} onChange={(e) => setStockLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code ? `${l.code} — ` : ''}{l.name}
                </option>
              ))}
            </select>
          </label>
            <label>
              Low threshold{' '}
              <select value={stockLowThreshold} onChange={(e) => setStockLowThreshold(Number(e.target.value))}>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </label>
          <div className="admin-muted">Valuation (cost): £{stockMetrics.valuation.toFixed(2)}</div>
        </div>
          {stockMetrics.low.length === 0 ? (
            <p className="admin-muted">No low-stock items (â‰¤ {stockLowThreshold}).</p>
        ) : (
          <>
              <p className="admin-muted">Low stock (â‰¤ {stockLowThreshold})</p>
            <ul className="admin-report-list">
              {stockMetrics.low.map((x) => (
                <li key={x.productId} className="admin-report-list-item">
                  <span className="admin-report-list-label">
                    {inlineEditingProductId === x.productId ? (
                      <input
                        type="text"
                        className="admin-filter-input"
                        value={inlineAliasDraft}
                        autoFocus
                        placeholder="Type stock name and press Enter"
                        onChange={(e) => setInlineAliasDraft(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            await saveAliasForProduct(x.productId, inlineAliasDraft)
                            setInlineEditingProductId(null)
                          } else if (e.key === 'Escape') {
                            setInlineEditingProductId(null)
                          }
                        }}
                        onBlur={async () => {
                          await saveAliasForProduct(x.productId, inlineAliasDraft)
                          setInlineEditingProductId(null)
                        }}
                        style={{ minWidth: '18rem' }}
                      />
                    ) : (
                      <span
                        className="link-btn"
                        onDoubleClick={() => {
                          setInlineEditingProductId(x.productId)
                          const key = stockAliasKey(stockLocationId, x.productId)
                          setInlineAliasDraft(stockAliases[key] ?? getStockDisplayName(x.productId, x.product))
                        }}
                        title="Double-click to rename inline."
                        style={{ cursor: 'text' }}
                      >
                        {getStockDisplayName(x.productId, x.product)}{' '}
                      </span>
                    )}
                    {!x.product?.name && !stockFallbackNames.get(x.productId) && inlineEditingProductId !== x.productId ? (
                      <span className="admin-muted"> (double-click to name)</span>
                    ) : null}
                    {x.product?.sku ? <span className="admin-muted">({x.product.sku})</span> : null}
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => setSelectedLowStockProductId(x.productId)}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Details
                    </button>
                  </span>
                    <span className="admin-report-list-value">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setSelectedLowStockProductId(x.productId)}
                        style={{ padding: 0, border: 0, background: 'none', cursor: 'pointer' }}
                      >
                        Qty {x.qty} · £{Number(x.totalCost).toFixed(2)}
                      </button>
                    </span>
                </li>
              ))}
            </ul>
            <div className="admin-inline-form--stack" style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-small btn-outline"
                onClick={(e) => {
                  e.stopPropagation()
                  downloadCsv(`low_stock_${stockLocationId}.csv`, stockMetrics.low.map((x) => ({
                  product: getStockDisplayName(x.productId, x.product),
                  sku: x.product?.sku ?? '',
                  product_id: x.productId,
                  quantity: Number(x.qty),
                  unit_cost: Number(x.unitCost),
                  total_cost: Number(x.totalCost),
                  })))
                }}
              >
                Export low stock CSV
              </button>
            </div>
          </>
        )}
      </div>

      {selectedLowStockItem && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedLowStockProductId(null)}>
          <div className="admin-modal card admin-modal--large" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Stock item detail</h3>
            <p className="admin-muted" style={{ marginTop: 0 }}>
              Location: {locations.find((l) => l.id === stockLocationId)?.name ?? stockLocationId}
            </p>
            <ul className="admin-report-list">
              <li className="admin-report-list-item">
                <span className="admin-report-list-label">Display name</span>
                <span className="admin-report-list-value">{getStockDisplayName(selectedLowStockItem.productId, selectedLowStockItem.product)}</span>
              </li>
              <li className="admin-report-list-item">
                <span className="admin-report-list-label">SKU</span>
                <span className="admin-report-list-value">{selectedLowStockItem.product?.sku ?? '—'}</span>
              </li>
              <li className="admin-report-list-item">
                <span className="admin-report-list-label">Internal product ID</span>
                <span className="admin-report-list-value"><code>{selectedLowStockItem.productId}</code></span>
              </li>
              <li className="admin-report-list-item">
                <span className="admin-report-list-label">Quantity at location</span>
                <span className="admin-report-list-value">{selectedLowStockItem.qty}</span>
              </li>
              <li className="admin-report-list-item">
                <span className="admin-report-list-label">Unit cost</span>
                <span className="admin-report-list-value">£{selectedLowStockItem.unitCost.toFixed(2)}</span>
              </li>
              <li className="admin-report-list-item">
                <span className="admin-report-list-label">Total cost value</span>
                <span className="admin-report-list-value">£{selectedLowStockItem.totalCost.toFixed(2)}</span>
              </li>
            </ul>
            <div className="admin-inline-form--stack" style={{ marginTop: '0.75rem' }}>
              <label>
                Custom display name{' '}
                <input
                  type="text"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  placeholder="Set a clearer stock item name"
                  className="admin-filter-input"
                  style={{ minWidth: '20rem' }}
                />
              </label>
              <button
                type="button"
                className="btn btn-small"
                onClick={saveAlias}
                disabled={savingAlias}
              >
                {savingAlias ? 'Saving…' : 'Save name'}
              </button>
              <button
                type="button"
                className="btn btn-small btn-outline"
                onClick={() => setAliasInput('')}
                disabled={savingAlias}
              >
                Clear
              </button>
            </div>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelectedLowStockProductId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedReportCard && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedReportCard(null)}>
          <div className="admin-modal card admin-modal--large" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>
              {selectedReportCard === 'sales' && 'Sales overview detail'}
              {selectedReportCard === 'status' && 'Orders by status detail'}
              {selectedReportCard === 'customers' && 'Top customers detail'}
              {selectedReportCard === 'products' && 'Top products detail'}
              {selectedReportCard === 'revenue' && 'Revenue trend detail'}
              {selectedReportCard === 'margin' && 'Margin trend detail'}
              {selectedReportCard === 'stock' && 'Stock summary detail'}
            </h3>
            <ul className="admin-report-list">
              {selectedReportCard === 'sales' && (
                <>
                  <li className="admin-report-list-item"><span className="admin-report-list-label">Orders</span><span className="admin-report-list-value">{orders.length}</span></li>
                  <li className="admin-report-list-item"><span className="admin-report-list-label">Revenue (ex VAT)</span><span className="admin-report-list-value">£{metrics.totalEx.toFixed(2)}</span></li>
                  <li className="admin-report-list-item"><span className="admin-report-list-label">COGS (ex VAT)</span><span className="admin-report-list-value">£{metrics.cogs.toFixed(2)}</span></li>
                  <li className="admin-report-list-item"><span className="admin-report-list-label">Gross margin</span><span className="admin-report-list-value">£{metrics.marginEx.toFixed(2)} ({metrics.marginPct.toFixed(1)}%)</span></li>
                </>
              )}
              {selectedReportCard === 'status' && (
                <>
                  <li className="admin-report-list-item">
                    <span className="admin-report-list-label">Filter</span>
                    <span className="admin-report-list-value" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-small btn-outline" onClick={() => setStatusCardFilter('all')}>
                        All
                      </button>
                      {Object.entries(metrics.byStatus).map(([s, n]) => (
                        <button
                          key={s}
                          type="button"
                          className="btn btn-small"
                          style={{
                            background: statusCardFilter === s ? 'var(--lamtek-primary-500)' : undefined,
                            color: statusCardFilter === s ? 'white' : undefined,
                          }}
                          onClick={() => setStatusCardFilter(s)}
                          title={`${n} orders`}
                        >
                          {s}
                        </button>
                      ))}
                    </span>
                  </li>
                  <li className="admin-report-list-item">
                    <span className="admin-report-list-label">Matching orders</span>
                    <span className="admin-report-list-value">{statusCardOrders.length} orders</span>
                  </li>
                  <li className="admin-report-list-item" style={{ alignItems: 'baseline' }}>
                    <span className="admin-report-list-label">Order list</span>
                    <span className="admin-report-list-value admin-muted">Newest first</span>
                  </li>
                  <li style={{ padding: 0, borderBottom: 'none' }}>
                    <div style={{ maxHeight: '48vh', overflow: 'auto' }}>
                      <ul className="admin-report-list" style={{ borderTop: '1px solid var(--lamtek-border)' }}>
                        {statusCardOrders.slice(0, 200).map((o) => (
                          <li key={o.id} className="admin-report-list-item">
                            <span className="admin-report-list-label">
                              <Link to={`/admin/orders/${o.id}`} className="admin-table-link">
                                {o.reference ?? o.id.slice(0, 8)}
                              </Link>
                              <span className="admin-muted" style={{ marginLeft: '0.5rem' }}>
                                {formatDateShort(o.created_at)}
                              </span>
                            </span>
                            <span className="admin-report-list-value">
                              £{Number(o.total_ex_vat || 0).toFixed(2)}
                              <span className="admin-muted" style={{ marginLeft: '0.5rem' }}>({o.status})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      {statusCardOrders.length > 200 ? (
                        <p className="admin-muted" style={{ margin: '0.5rem 0 0' }}>
                          Showing first 200 results for performance.
                        </p>
                      ) : null}
                    </div>
                  </li>
                </>
              )}
              {selectedReportCard === 'customers' && metrics.topCustomers.map((c) => (
                <li key={c.userId} className="admin-report-list-item">
                  <span className="admin-report-list-label">{customersByUserId.get(c.userId)?.company_name ?? c.userId}</span>
                  <span className="admin-report-list-value">£{c.rev.toFixed(2)}</span>
                </li>
              ))}
              {selectedReportCard === 'products' && metrics.topProducts.map((p) => (
                <li key={p.productId} className="admin-report-list-item">
                  <span className="admin-report-list-label">{productsById.get(p.productId)?.name ?? p.productId} ({p.units} units)</span>
                  <span className="admin-report-list-value">£{p.rev.toFixed(2)}</span>
                </li>
              ))}
              {selectedReportCard === 'revenue' && (
                <>
                  <li className="admin-report-list-item">
                    <span className="admin-report-list-label">Selected date</span>
                    <span className="admin-report-list-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <span>{trendCardDateFilter ?? 'None (click a date below)'}</span>
                      {trendCardDateFilter ? (
                        <button type="button" className="btn btn-small btn-outline" onClick={() => setTrendCardDateFilter(null)}>
                          Clear
                        </button>
                      ) : null}
                    </span>
                  </li>
                  {metrics.revenueTrend.map((p) => (
                    <li
                      key={p.date}
                      className="admin-report-list-item"
                      role="button"
                      tabIndex={0}
                      style={{
                        cursor: 'pointer',
                        background: trendCardDateFilter === p.date ? 'var(--lamtek-primary-50)' : undefined,
                      }}
                      onClick={() => setTrendCardDateFilter(p.date)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setTrendCardDateFilter(p.date)
                      }}
                    >
                      <span className="admin-report-list-label">{p.date}</span>
                      <span className="admin-report-list-value">£{p.rev.toFixed(2)}</span>
                    </li>
                  ))}
                  <li className="admin-report-list-item" style={{ alignItems: 'baseline' }}>
                    <span className="admin-report-list-label">Orders on selected date</span>
                    <span className="admin-report-list-value admin-muted">{trendCardDateFilter ? `${trendCardOrders.length} orders` : ''}</span>
                  </li>
                  <li style={{ padding: 0, borderBottom: 'none' }}>
                    <div style={{ maxHeight: '48vh', overflow: 'auto' }}>
                      <ul className="admin-report-list" style={{ borderTop: '1px solid var(--lamtek-border)' }}>
                        {trendCardDateFilter && trendCardOrders.length === 0 ? (
                          <li className="admin-report-list-item">
                            <span className="admin-report-list-label">No orders</span>
                            <span className="admin-report-list-value">—</span>
                          </li>
                        ) : null}
                        {trendCardDateFilter
                          ? trendCardOrders.slice(0, 200).map((o) => (
                              <li key={o.id} className="admin-report-list-item">
                                <span className="admin-report-list-label">
                                  <Link to={`/admin/orders/${o.id}`} className="admin-table-link">
                                    {o.reference ?? o.id.slice(0, 8)}
                                  </Link>
                                  <span className="admin-muted" style={{ marginLeft: '0.5rem' }}>
                                    {formatDateShort(o.created_at)}
                                  </span>
                                </span>
                                <span className="admin-report-list-value">
                                  £{Number(o.total_ex_vat || 0).toFixed(2)} <span className="admin-muted" style={{ marginLeft: '0.5rem' }}>({o.status})</span>
                                </span>
                              </li>
                            ))
                          : null}
                      </ul>
                      {trendCardDateFilter && trendCardOrders.length > 200 ? (
                        <p className="admin-muted" style={{ margin: '0.5rem 0 0' }}>
                          Showing first 200 results for performance.
                        </p>
                      ) : null}
                    </div>
                  </li>
                </>
              )}
              {selectedReportCard === 'margin' && (
                <>
                  <li className="admin-report-list-item">
                    <span className="admin-report-list-label">Selected date</span>
                    <span className="admin-report-list-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <span>{trendCardDateFilter ?? 'None (click a date below)'}</span>
                      {trendCardDateFilter ? (
                        <button type="button" className="btn btn-small btn-outline" onClick={() => setTrendCardDateFilter(null)}>
                          Clear
                        </button>
                      ) : null}
                    </span>
                  </li>
                  {metrics.marginTrend.map((p) => (
                    <li
                      key={p.date}
                      className="admin-report-list-item"
                      role="button"
                      tabIndex={0}
                      style={{
                        cursor: 'pointer',
                        background: trendCardDateFilter === p.date ? 'var(--lamtek-primary-50)' : undefined,
                      }}
                      onClick={() => setTrendCardDateFilter(p.date)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setTrendCardDateFilter(p.date)
                      }}
                    >
                      <span className="admin-report-list-label">{p.date}</span>
                      <span className="admin-report-list-value">£{p.margin.toFixed(2)}</span>
                    </li>
                  ))}
                  <li className="admin-report-list-item" style={{ alignItems: 'baseline' }}>
                    <span className="admin-report-list-label">Orders on selected date</span>
                    <span className="admin-report-list-value admin-muted">{trendCardDateFilter ? `${trendCardOrders.length} orders` : ''}</span>
                  </li>
                  <li style={{ padding: 0, borderBottom: 'none' }}>
                    <div style={{ maxHeight: '48vh', overflow: 'auto' }}>
                      <ul className="admin-report-list" style={{ borderTop: '1px solid var(--lamtek-border)' }}>
                        {trendCardDateFilter && trendCardOrders.length === 0 ? (
                          <li className="admin-report-list-item">
                            <span className="admin-report-list-label">No orders</span>
                            <span className="admin-report-list-value">—</span>
                          </li>
                        ) : null}
                        {trendCardDateFilter
                          ? trendCardOrders.slice(0, 200).map((o) => (
                              <li key={o.id} className="admin-report-list-item">
                                <span className="admin-report-list-label">
                                  <Link to={`/admin/orders/${o.id}`} className="admin-table-link">
                                    {o.reference ?? o.id.slice(0, 8)}
                                  </Link>
                                  <span className="admin-muted" style={{ marginLeft: '0.5rem' }}>
                                    {formatDateShort(o.created_at)}
                                  </span>
                                </span>
                                <span className="admin-report-list-value">
                                  £{Number(o.total_ex_vat || 0).toFixed(2)} <span className="admin-muted" style={{ marginLeft: '0.5rem' }}>({o.status})</span>
                                </span>
                              </li>
                            ))
                          : null}
                      </ul>
                      {trendCardDateFilter && trendCardOrders.length > 200 ? (
                        <p className="admin-muted" style={{ margin: '0.5rem 0 0' }}>
                          Showing first 200 results for performance.
                        </p>
                      ) : null}
                    </div>
                  </li>
                </>
              )}
              {selectedReportCard === 'stock' && (
                <>
                  <li className="admin-report-list-item"><span className="admin-report-list-label">Location</span><span className="admin-report-list-value">{locations.find((l) => l.id === stockLocationId)?.name ?? stockLocationId}</span></li>
                  <li className="admin-report-list-item"><span className="admin-report-list-label">Low stock threshold</span><span className="admin-report-list-value">{stockLowThreshold}</span></li>
                  <li className="admin-report-list-item"><span className="admin-report-list-label">Low stock items</span><span className="admin-report-list-value">{stockMetrics.low.length}</span></li>
                  <li className="admin-report-list-item"><span className="admin-report-list-label">Valuation (cost)</span><span className="admin-report-list-value">£{stockMetrics.valuation.toFixed(2)}</span></li>
                </>
              )}
            </ul>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setSelectedReportCard(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


