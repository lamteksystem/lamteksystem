import fs from 'fs'
import path from 'path'

const p = path.join(import.meta.dirname, '..', 'src/pages/admin/AdminReports.tsx')
let r = fs.readFileSync(p, 'utf8')
if (r.includes('DonutChart')) {
  console.log('reports already patched')
  process.exit(0)
}
r = r.replace(
  "import { lamtekPortalLocations } from '@/lib/lamtekLocations'",
  `import { lamtekPortalLocations } from '@/lib/lamtekLocations'
import { AreaTrendChart } from '@/components/charts/AreaTrendChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { formatDashboardCurrency, statusBreakdown, trendToChartPoints } from '@/lib/dashboardAnalytics'`,
)
r = r.replace(
  '  }, [orders, lines, productsById, trendDays])\n\n  const stockMetrics',
  `  }, [orders, lines, productsById, trendDays])

  const statusChartData = useMemo(() => statusBreakdown(orders.map((o) => ({ status: o.status }))), [orders])
  const revenueChartData = useMemo(() => trendToChartPoints(metrics.revenueTrend, 'rev'), [metrics.revenueTrend])
  const marginChartData = useMemo(() => trendToChartPoints(metrics.marginTrend, 'margin'), [metrics.marginTrend])

  const stockMetrics`,
)
r = r.replace(
  '<h2>Orders by status</h2>\n          <ul className="admin-report-list">',
  '<h2>Orders by status</h2>\n          {statusChartData.length > 0 ? <DonutChart data={statusChartData} height={200} ariaLabel="Orders by status" /> : <p className="admin-muted">No data.</p>}\n          <ul className="admin-report-list" style={{ marginTop: \'0.75rem\' }}>',
)
r = r.replace(
  /(<h2>Revenue trend \(ex VAT\)<\/h2>\s*\{metrics\.revenueTrend\.length === 0 \? \(\s*<p className="admin-muted">No data\.<\/p>\s*\) : \(\s*)<ul className="admin-report-list">[\s\S]*?<\/ul>\s*\)/,
  '$1<AreaTrendChart data={revenueChartData} height={200} valueFormatter={(n) => formatDashboardCurrency(n)} ariaLabel="Revenue trend" />\n          )',
)
r = r.replace(
  /(<h2>Margin trend \(ex VAT\)<\/h2>\s*\{metrics\.marginTrend\.length === 0 \? \(\s*<p className="admin-muted">No data\.<\/p>\s*\) : \(\s*)<ul className="admin-report-list">[\s\S]*?<\/ul>\s*\)/,
  '$1<AreaTrendChart data={marginChartData} height={200} valueFormatter={(n) => formatDashboardCurrency(n)} ariaLabel="Margin trend" />\n          )',
)
fs.writeFileSync(p, r)
console.log('reports patched')
