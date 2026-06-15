export default function StatsBar({ stats }) {
  const items = [
    { label: 'ACCOUNTS', value: stats.total, color: 'text-[var(--tx-primary)]' },
    { label: 'HEALTHY', value: stats.byLabel?.healthy || 0, color: 'text-[var(--safe)]' },
    { label: 'WARNING', value: stats.byLabel?.warning || 0, color: 'text-[var(--warn)]' },
    { label: 'POOR', value: stats.byLabel?.poor || 0, color: 'text-[var(--warning-alt)]' },
    { label: 'CRITICAL', value: stats.byLabel?.critical || 0, color: 'text-[var(--danger)]' },
    { label: 'AVG SCORE', value: `${stats.avgHealth}%`, color: stats.avgHealth >= 90 ? 'text-[var(--safe)]' : stats.avgHealth >= 70 ? 'text-[var(--warn)]' : 'text-[var(--danger)]' },
  ]

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-px mb-6" style={{ background: 'var(--border)' }}>
      {items.map(item => (
        <div key={item.label} className="p-3 md:p-4" style={{ background: 'var(--surface)' }}>
          <p className="text-[10px] tracking-[0.12em] text-[var(--tx-muted)] mb-1.5" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{item.label}</p>
          <p className={`text-xl md:text-2xl ${item.color}`} style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}
