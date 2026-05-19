import fs from 'fs'
import path from 'path'
const root = path.join(import.meta.dirname, '..')
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const write = (rel, c) => fs.writeFileSync(path.join(root, rel), c, 'utf8')
const block = read('scripts/admin-dashboard-charts-block.txt').replace(/TAGV/g, 'div')
let admin = read('src/pages/admin/AdminDashboard.tsx')
if (!admin.includes('BarTrendChart')) {
  admin = admin.replace("import { useEffect, useState } from 'react'", "import { useEffect, useMemo, useState } from 'react'")
  admin = admin.replace("import { useStaff } from '@/hooks/useStaff'\n", `import { useStaff } from '@/hooks/useStaff'
import { AreaTrendChart } from '@/components/charts/AreaTrendChart'
import { BarTrendChart } from '@/components/charts/BarTrendChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { AnimatedChartIllustration, DashboardHeroRibbon, StatOrdersGlyph, StatRevenueGlyph } from '@/components/dashboard/DashboardDecorSvgs'
import { VisualStatCard } from '@/components/dashboard/VisualStatCard'
import { buildDailyCounts, buildDailyRevenue, formatDashboardCurrency, sparklineFromPoints, statusBreakdown } from '@/lib/dashboardAnalytics'
`)
  admin = admin.replace('  total_inc_vat: number\n}', `  total_inc_vat: number\n}\n\ntype TrendOrder = { created_at: string; status: string; total_inc_vat: number }`)
  admin = admin.replace('  })\n\n  useEffect(() => {', '  })\n  const [trendOrders, setTrendOrders] = useState<TrendOrder[]>([])\n\n  useEffect(() => {')
  admin = admin.replace('const todayIso = todayStart.toISOString()', `const todayIso = todayStart.toISOString()\n      const thirtyDaysAgo = new Date()\n      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)`)
  admin = admin.replace('recentRes,\n      ]', 'recentRes,\n        trendRes,\n      ]')
  admin = admin.replace(".limit(10),\n      ])", `.limit(10),\n        supabase.from('orders').select('created_at, status, total_inc_vat').gte('created_at', thirtyDaysAgo.toISOString()).eq('is_archived', false).neq('status', 'cancelled'),\n      ])`)
  admin = admin.replace('recentOrders: (recentRes.data ?? []) as RecentOrder[],\n      })', 'recentOrders: (recentRes.data ?? []) as RecentOrder[],\n      })\n      setTrendOrders((trendRes.data ?? []) as TrendOrder[])')
  admin = admin.replace('  }, [])\n\n  const greeting', `  }, [])\n\n  const orderVolumeTrend = useMemo(() => buildDailyCounts(trendOrders, 30), [trendOrders])\n  const revenueTrend = useMemo(() => buildDailyRevenue(trendOrders.filter((o) => ['paid', 'invoiced', 'placed'].includes(o.status)), 30), [trendOrders])\n  const statusChart = useMemo(() => statusBreakdown(trendOrders), [trendOrders])\n  const orderSpark = useMemo(() => sparklineFromPoints(orderVolumeTrend), [orderVolumeTrend])\n  const revenueSpark = useMemo(() => sparklineFromPoints(revenueTrend), [revenueTrend])\n\n  const greeting`)
  admin = admin.replace('<header className="admin-dashboard-hero">', '<header className="admin-dashboard-hero admin-dashboard-hero-visual">')
  admin = admin.replace('        </div>\n      </header>\n\n      {stats.ordersPlaced > 0 && (', `        </div>\n        <DashboardHeroRibbon className="admin-dashboard-hero-ribbon" />\n      </header>\n\n      {stats.ordersPlaced > 0 && (`)
}
const s = admin.indexOf('      <section className="admin-dashboard-metrics"')
const end = admin.indexOf('      <div className="admin-dashboard-main">')
if (s >= 0 && end > s) admin = admin.slice(0, s) + block + admin.slice(end)
write('src/pages/admin/AdminDashboard.tsx', admin)
let main = read('src/main.tsx')
if (!main.includes('dashboard-visuals')) write('src/main.tsx', main.replace("import './styles/catalog-picker.css'", "import './styles/catalog-picker.css'\nimport './styles/dashboard-visuals.css'"))
console.log('admin ok', admin.includes('BarTrendChart'))
