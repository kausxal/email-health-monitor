export default function StatsBar({ stats }) {
  const items = [
    { label: 'ACCOUNTS', value: stats.total, color: 'text-[#d4d4d4]' },
    { label: 'HEALTHY', value: stats.byLabel?.healthy || 0, color: 'text-[#00ff88]' },
    { label: 'WARNING', value: stats.byLabel?.warning || 0, color: 'text-[#ffcc00]' },
    { label: 'POOR', value: stats.byLabel?.poor || 0, color: 'text-[#ff8800]' },
    { label: 'CRITICAL', value: stats.byLabel?.critical || 0, color: 'text-[#ff3355]' },
    { label: 'AVG SCORE', value: `${stats.avgHealth}%`, color: stats.avgHealth >= 90 ? 'text-[#00ff88]' : stats.avgHealth >= 70 ? 'text-[#ffcc00]' : 'text-[#ff3355]' },
  ]

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-px mb-6" style={{ background: 'var(--chromium-border)' }}>
      {items.map(item => (
        <div key={item.label} className="p-4" style={{ background: 'var(--chromium-surface)' }}>
          <p className="text-[10px] tracking-[0.12em] text-[#555] mb-1.5" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{item.label}</p>
          <p className={`text-2xl ${item.color}`} style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}
