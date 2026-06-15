import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload) return null
  const time = new Date(label).toLocaleTimeString()
  return (
    <div className="p-3 text-xs" style={{ background: '#0c0c0c', border: '1px solid #2a2a2a' }}>
      <p className="text-[#555] mb-2 tracking-wider">{time}</p>
      {payload.map((p, i) => (
        <p key={i} className={p.color === '#ff3355' ? 'text-[#ff3355]' : p.color === '#00ff88' ? 'text-[#00ff88]' : p.color === '#ffcc00' ? 'text-[#ffcc00]' : 'text-[#a0a0a0]'}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function ChartPanel({ history }) {
  if (history.length < 2) {
    return (
      <div className="chrome-surface h-full min-h-[240px] flex items-center justify-center">
        <p className="text-[#333] text-xs tracking-wider">WAITING FOR DATA</p>
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
    <div className="chrome-surface h-full min-h-[300px]">
      <div className="p-4 border-b border-[#1a1a1a]">
        <h2 className="text-xs tracking-[0.12em] text-[#d4d4d4]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>HEALTH TRENDS</h2>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="2 2" stroke="#1a1a1a" />
            <XAxis
              dataKey="time"
              tickFormatter={ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              stroke="#333"
              fontSize={9}
              tickLine={false}
              axisLine={false}
            />
            <YAxis domain={[0, 100]} stroke="#333" fontSize={9} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="avg" name="AVG" stroke="#00ff88" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="min" name="MIN" stroke="#ffcc00" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="critical" name="CRIT" stroke="#ff3355" strokeWidth={1} dot={false} strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
