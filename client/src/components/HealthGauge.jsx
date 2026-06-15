export default function HealthGauge({ accounts }) {
  if (!accounts.length) return null

  const byLabel = { healthy: 0, warning: 0, poor: 0, critical: 0 }
  for (const a of accounts) byLabel[a.health_label] = (byLabel[a.health_label] || 0) + 1
  const total = accounts.length

  const segments = [
    { label: 'healthy', count: byLabel.healthy, color: '#00ff88', pct: (byLabel.healthy / total) * 100 },
    { label: 'warning', count: byLabel.warning, color: '#ffcc00', pct: (byLabel.warning / total) * 100 },
    { label: 'poor', count: byLabel.poor, color: '#ff8800', pct: (byLabel.poor / total) * 100 },
    { label: 'critical', count: byLabel.critical, color: '#ff3355', pct: (byLabel.critical / total) * 100 },
  ]

  return (
    <div className="chrome-surface p-4 mb-6">
      <h2 className="text-xs tracking-[0.12em] text-[#d4d4d4] mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>DISTRIBUTION</h2>
      <div className="flex h-2 mb-3" style={{ background: 'var(--chromium-bg)' }}>
        {segments.map(s => s.count > 0 && (
          <div key={s.label} style={{ width: `${s.pct}%`, background: s.color, boxShadow: `0 0 8px ${s.color}40` }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>
      <div className="flex gap-4 text-[10px] text-[#555] tracking-wider flex-wrap">
        {segments.map(s => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5" style={{ background: s.color }} />
            {s.label}: <strong className="text-[#a0a0a0]">{s.count}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}
