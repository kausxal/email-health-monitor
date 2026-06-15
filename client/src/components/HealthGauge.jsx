export default function HealthGauge({ accounts }) {
  if (!accounts.length) return null

  const byLabel = { healthy: 0, warning: 0, poor: 0, critical: 0 }
  for (const a of accounts) {
    byLabel[a.health_label] = (byLabel[a.health_label] || 0) + 1
  }
  const total = accounts.length

  const segments = [
    { label: 'Healthy', count: byLabel.healthy, color: 'bg-green-500', pct: (byLabel.healthy / total) * 100 },
    { label: 'Warning', count: byLabel.warning, color: 'bg-yellow-500', pct: (byLabel.warning / total) * 100 },
    { label: 'Poor', count: byLabel.poor, color: 'bg-orange-500', pct: (byLabel.poor / total) * 100 },
    { label: 'Critical', count: byLabel.critical, color: 'bg-red-500', pct: (byLabel.critical / total) * 100 },
  ]

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <h2 className="text-sm font-semibold text-gray-200 mb-3">Health Distribution</h2>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-800 mb-3">
        {segments.map(s => s.count > 0 && (
          <div key={s.label} className={s.color} style={{ width: `${s.pct}%` }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>
      <div className="flex gap-4 text-xs text-gray-400 flex-wrap">
        {segments.map(s => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${s.color}`} />
            {s.label}: <strong className="text-gray-200">{s.count}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}
