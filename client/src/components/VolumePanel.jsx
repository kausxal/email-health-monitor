import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function VolumeTooltip({ active, payload, label }) {
  if (!active || !payload) return null
  return (
    <div className="p-3 text-xs" style={{ background: 'var(--chart-bg)', border: '1px solid var(--chart-border)' }}>
      <p className="text-[var(--tx-muted)] mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={p.dataKey === 'sent' ? 'text-[var(--safe)]' : 'text-[var(--accent)]'}>
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export default function VolumePanel() {
  const [data, setData] = useState(null)
  const [view, setView] = useState('daily')

  useEffect(() => {
    const fetchVolume = async () => {
      try {
        const res = await fetch('/api/volume')
        const d = await res.json()
        if (!d.error) setData(d)
      } catch {}
    }
    fetchVolume()
    const interval = setInterval(fetchVolume, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!data) return null

  const chartData = view === 'daily'
    ? (data.daily || []).slice(-14)
    : (data.weekly || []).slice(-8)

  return (
    <div className="chrome-surface p-3 md:p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs tracking-[0.12em] text-[var(--tx-primary)]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VOLUME</h2>
        <div className="flex gap-1">
          <button onClick={() => setView('daily')}
            className={`text-[10px] px-2 py-0.5 border tracking-wider ${view === 'daily' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--tx-muted)]'}`}
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            DAILY
          </button>
          <button onClick={() => setView('weekly')}
            className={`text-[10px] px-2 py-0.5 border tracking-wider ${view === 'weekly' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--tx-muted)]'}`}
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            WEEKLY
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px mb-4" style={{ background: 'var(--border)' }}>
        {[
          { label: 'DAILY CAPACITY', value: data.today.capacity.toLocaleString(), color: 'text-[var(--accent)]' },
          { label: 'EST. SENT TODAY', value: data.today.estimatedSent.toLocaleString(), color: 'text-[var(--safe)]' },
          { label: 'ACTIVE ACCOUNTS', value: `${data.today.activeCount}/${data.today.accountCount}`, color: 'text-[var(--tx-primary)]' },
        ].map(s => (
          <div key={s.label} className="p-3 text-center" style={{ background: 'var(--surface)' }}>
            <p className="text-[9px] tracking-[0.12em] text-[var(--tx-muted)] mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{s.label}</p>
            <p className={`text-sm md:text-base ${s.color}`} style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {chartData.length > 1 && (
        <div className="h-32 md:h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="2 2" stroke="var(--chart-grid)" />
              <XAxis
                dataKey={view === 'daily' ? 'day' : 'week'}
                tickFormatter={v => view === 'daily' ? v.slice(5) : v.slice(-2)}
                stroke="var(--chart-axis)"
                fontSize={9}
                tickLine={false}
                axisLine={false}
              />
              <YAxis stroke="var(--chart-axis)" fontSize={9} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<VolumeTooltip />} />
              <Bar dataKey="capacity" name="CAPACITY" fill="var(--accent)" opacity={0.3} />
              <Bar dataKey="sent" name="SENT" fill="var(--safe)" opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartData.length <= 1 && (
        <p className="text-[var(--tx-dim)] text-[10px] text-center py-4">collecting data — check back in a few hours</p>
      )}
    </div>
  )
}
