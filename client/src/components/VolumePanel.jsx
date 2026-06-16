import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function VolumeTooltip({ active, payload, label }) {
  if (!active || !payload) return null
  return (
    <div className="p-3 text-xs" style={{ background: 'var(--chart-bg)', border: '1px solid var(--chart-border)' }}>
      <p className="text-[var(--tx-muted)] mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={
          p.dataKey === 'sent' ? 'text-[var(--safe)]' :
          p.dataKey === 'opened' ? 'text-[var(--warn)]' :
          p.dataKey === 'replied' ? 'text-[var(--accent)]' :
          p.dataKey === 'bounced' ? 'text-[var(--danger)]' :
          'text-[var(--accent)]'
        }>
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

function todayStr() { const d = new Date(); return d.toISOString().slice(0, 10) }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

export default function VolumePanel() {
  const [data, setData] = useState(null)
  const [view, setView] = useState('daily')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  useEffect(() => {
    const fetchVolume = async () => {
      try {
        const params = new URLSearchParams()
        if (start) params.set('start', start)
        if (end) params.set('end', end)
        if (view) params.set('view', view)
        const qs = params.toString()
        const res = await fetch(`/api/volume${qs ? '?' + qs : ''}`)
        const d = await res.json()
        if (!d.error) setData(d)
      } catch {}
    }
    fetchVolume()
    const interval = setInterval(fetchVolume, start && end ? 300_000 : 60_000)
    return () => clearInterval(interval)
  }, [start, end, view])

  if (!data) return null

  const isApi = data.source === 'api'
  const chartData = data.chartData || []
  const formatDate = (v) => {
    if (!v) return ''
    if (v.length === 7) return v.slice(-2) + '/' + v.slice(0, 4)
    const parts = v.split('-')
    return parts.length === 3 ? parts.slice(1).join('/') : v
  }

  return (
    <div className="chrome-surface p-3 md:p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-xs tracking-[0.12em] text-[var(--tx-primary)]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          VOLUME{isApi ? ` · ${data.range?.start?.slice(5)} → ${data.range?.end?.slice(5)}` : ''}
        </h2>
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
          <button onClick={() => setView('monthly')}
            className={`text-[10px] px-2 py-0.5 border tracking-wider ${view === 'monthly' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--tx-muted)]'}`}
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            MONTHLY
          </button>
        </div>
      </div>

      {/* Date range pickers */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input type="date" value={start} onChange={e => setStart(e.target.value)}
          max={end || todayStr()}
          className="chrome-input px-2 py-1 text-[10px] w-32"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }} />
        <span className="text-[var(--tx-dim)] text-[10px]">→</span>
        <input type="date" value={end} onChange={e => setEnd(e.target.value)}
          min={start || ''} max={todayStr()}
          className="chrome-input px-2 py-1 text-[10px] w-32"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }} />
        <button onClick={() => { setStart(''); setEnd('') }}
          className="text-[10px] text-[var(--tx-muted)] hover:text-[var(--tx-secondary)] tracking-wider"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          CLEAR
        </button>
      </div>

      {/* Summary cards */}
      {isApi ? (
        <div className="grid grid-cols-4 gap-px mb-4" style={{ background: 'var(--border)' }}>
          {[
            { label: 'SENT', value: data.totals?.sent?.toLocaleString() || '0', color: 'text-[var(--safe)]' },
            { label: 'OPENED', value: data.totals?.opened?.toLocaleString() || '0', color: 'text-[var(--warn)]' },
            { label: 'REPLIED', value: data.totals?.replied?.toLocaleString() || '0', color: 'text-[var(--accent)]' },
            { label: 'BOUNCED', value: data.totals?.bounced?.toLocaleString() || '0', color: 'text-[var(--danger)]' },
          ].map(s => (
            <div key={s.label} className="p-2 text-center" style={{ background: 'var(--surface)' }}>
              <p className="text-[9px] tracking-[0.12em] text-[var(--tx-muted)] mb-0.5" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{s.label}</p>
              <p className={`text-sm md:text-base ${s.color}`} style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>{s.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-px mb-4" style={{ background: 'var(--border)' }}>
          {[
            { label: 'DAILY CAPACITY', value: data.today?.capacity?.toLocaleString(), color: 'text-[var(--accent)]' },
            { label: 'EST. SENT TODAY', value: data.today?.estimatedSent?.toLocaleString(), color: 'text-[var(--safe)]' },
            { label: 'ACTIVE ACCOUNTS', value: data.today ? `${data.today.activeCount}/${data.today.accountCount}` : '—', color: 'text-[var(--tx-primary)]' },
          ].map(s => (
            <div key={s.label} className="p-3 text-center" style={{ background: 'var(--surface)' }}>
              <p className="text-[9px] tracking-[0.12em] text-[var(--tx-muted)] mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{s.label}</p>
              <p className={`text-sm md:text-base ${s.color}`} style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Range totals (API mode) */}
      {isApi && chartData.length > 0 && (
        <p className="text-[10px] text-[var(--tx-dim)] mb-2 tracking-wider">
          {data.totals.sent.toLocaleString()} sent in range · Ø {Math.round(data.totals.sent / chartData.length).toLocaleString()}/day
          {data.range && ` · ${data.range.start} → ${data.range.end}`}
        </p>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="h-32 md:h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="2 2" stroke="var(--chart-grid)" />
              <XAxis dataKey="date" tickFormatter={formatDate}
                stroke="var(--chart-axis)" fontSize={9} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--chart-axis)" fontSize={9} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<VolumeTooltip />} />
              {isApi ? (
                <>
                  <Bar dataKey="sent" name="SENT" fill="var(--safe)" opacity={0.8} />
                  <Bar dataKey="opened" name="OPENED" fill="var(--warn)" opacity={0.6} />
                  <Bar dataKey="replied" name="REPLIED" fill="var(--accent)" opacity={0.7} />
                </>
              ) : (
                <>
                  <Bar dataKey="capacity" name="CAPACITY" fill="var(--accent)" opacity={0.3} />
                  <Bar dataKey="sent" name="SENT" fill="var(--safe)" opacity={0.8} />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartData.length <= 1 && !isApi && (
        <p className="text-[var(--tx-dim)] text-[10px] text-center py-4">collecting data — check back in a few hours</p>
      )}
      {chartData.length <= 1 && isApi && (
        <p className="text-[var(--tx-dim)] text-[10px] text-center py-4">no data for this range — try different dates</p>
      )}
    </div>
  )
}
