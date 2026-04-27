export function StockMtmSwitch({
  isStock,
  loading,
  onToggle,
  compact,
}: { isStock: boolean; loading: boolean; onToggle: () => void; compact?: boolean }) {
  return (
    <div
      className={`admin-stock-mtm-switch ${isStock ? 'admin-stock-mtm-switch--stock' : 'admin-stock-mtm-switch--mtm'} ${compact ? 'admin-stock-mtm-switch--compact' : ''}`}
      role="switch"
      aria-checked={isStock}
      aria-label={isStock ? 'Stock item – click for MTM' : 'Made to measure – click for Stock'}
      title={isStock ? 'Stock – click for MTM' : 'MTM – click for Stock'}
      onClick={loading ? undefined : onToggle}
    >
      <span className="admin-stock-mtm-switch-segment admin-stock-mtm-switch-segment--stock">Stock</span>
      <span className="admin-stock-mtm-switch-segment admin-stock-mtm-switch-segment--mtm">MTM</span>
      {loading && <span className="admin-stock-mtm-switch-loading" aria-hidden>…</span>}
    </div>
  )
}
