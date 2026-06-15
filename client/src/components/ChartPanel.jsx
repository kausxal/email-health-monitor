import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload) return null
  const time = new Date(label).toLocaleTimeString()
  return (
    <div className="p-3 text-xs" style={{ background: 'var(--chart-bg)', border: '1px solid var(--chart-border)' }}>
      <p className="text-[var(--tx-muted)] mb-2 tracking-wider">{time}</p>
      {payload.map((p, i) => {
        const tc = p.dataKey === 'avg' ? 'text-[var(--safe)]' : p.dataKey === 'min' ? 'text-[var(--warn)]' : p.dataKey === 'critical' ? 'text-[var(--danger)]' : 'text-[var(--tx-secondary)]'
        return <p key={i} className={tc}>{p.name}: {p.value}</p>
      })}
    </div>
  )
}

export default function ChartPanel({ history }) {
  if (history.length < 2) {
    return (
      <div className="chrome-surface h-full min-h-[200px] md:min-h-[240px] flex items-center justify-center">
        <p className="text-[var(--tx-dim)] text-xs tracking-wider">WAITING FOR DATA</p>
      </div>
    )
  }

  const chartData = history.map(h => {
    const scores = h.accounts || []
    const avg = scores.length ? Math.round(scores.reduce((s, a) => s + a.score, 0) / scores.length) : 0
    const min = scores.length ? Math.min(...scores.map(a => a.score)) : 0
    const critical = scores.filter(a => a.status === 'connection_error' || a.score < 50).length
    return { time: h.timestamp, avg, min, critical }
  })

  return (
    <div className="chrome-surface h-full min-h-[280px] md:min-h-[300px]">
      <div className="p-3 md:p-4 border-b border-[var(--border)]">
        <h2 className="text-xs tracking-[0.12em] text-[var(--tx-primary)]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>HEALTH TRENDS</h2>
      </div>
      <div className="p-3 md:p-4">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="2 2" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="time"
              tickFormatter={ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              stroke="var(--chart-axis)"
              fontSize={9}
              tickLine={false}
              axisLine={false}
            />
            <YAxis domain={[0, 100]} stroke="var(--chart-axis)" fontSize={9} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="avg" name="AVG" stroke="var(--safe)" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="min" name="MIN" stroke="var(--warn)" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="critical" name="CRIT" stroke="var(--danger)" strokeWidth={1} dot={false} strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
