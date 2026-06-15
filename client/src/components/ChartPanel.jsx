import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload) return null
  const time = new Date(label).toLocaleTimeString()
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-2">{time}</p>
      {payload.map((p, i) => (
        <p key={i} className={p.color === '#ef4444' ? 'text-red-400' : p.color === '#22c55e' ? 'text-green-400' : p.color === '#f59e0b' ? 'text-yellow-400' : 'text-gray-300'}>
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  )
}

export default function ChartPanel({ history }) {
  if (history.length < 2) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-full min-h-[200px] flex items-center justify-center">
        <p className="text-gray-600 text-sm">Waiting for enough data points to show trends...</p>
      </div>
    )
  }

  const chartData = history.map(h => {
    const scores = h.accounts || []
    const avg = scores.length ? Math.round(scores.reduce((s, a) => s + a.score, 0) / scores.length) : 0
    const min = scores.length ? Math.min(...scores.map(a => a.score)) : 0
    const critical = scores.filter(a => a.status === 'connection_error' || a.score < 50).length
    return {
      time: h.timestamp,
      avg,
      min,
      critical
    }
  })

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-full min-h-[300px]">
      <h2 className="text-sm font-semibold text-gray-200 mb-3">Health Score Trends</h2>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="time"
            tickFormatter={ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            stroke="#475569"
            fontSize={10}
          />
          <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
          <Line type="monotone" dataKey="avg" name="Avg Health" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="min" name="Min Health" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="critical" name="Critical" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="4 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
