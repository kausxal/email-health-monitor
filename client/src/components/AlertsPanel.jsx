import { useState, useEffect } from 'react'

function AlertIcon({ type }) {
  const icons = {
    critical: '🔴',
    banned: '⊘',
    connection: '⚡',
    drop: '▽',
    poor: '△',
  }
  return <span className="text-xs">{icons[type] || '△'}</span>
}

function AlertTime({ ts }) {
  const [ago, setAgo] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(ts).getTime()
      const mins = Math.floor(diff / 60000)
      if (mins < 1) setAgo('NOW')
      else if (mins < 60) setAgo(`${mins}M AGO`)
      else setAgo(`${Math.floor(mins / 60)}H AGO`)
    }
    update()
    const interval = setInterval(update, 30_000)
    return () => clearInterval(interval)
  }, [ts])

  return <span className="text-[10px] text-[var(--tx-dim)] tracking-wider">{ago}</span>
}

export default function AlertsPanel({ alerts }) {
  const visible = alerts.slice(0, 10)

  return (
    <div className="chrome-surface h-full max-h-96 overflow-y-auto" style={{ background: 'var(--surface)' }}>
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-[var(--border)]">
        <h2 className="text-xs tracking-[0.12em] text-[var(--tx-primary)]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>ALERTS</h2>
        {alerts.length > 0 && (
          <span className="text-[10px] text-[var(--tx-muted)] tracking-wider">{alerts.length} TOTAL</span>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-[var(--tx-dim)] text-sm tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>CLEAR</p>
          <p className="text-[var(--tx-dim)] text-xs">no alerts</p>
        </div>
      ) : (
        <div className="p-2 space-y-px">
          {visible.map((alert, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 text-xs transition-colors"
              style={{
                background: alert.type === 'critical' || alert.type === 'banned'
                  ? 'rgba(255, 51, 85, 0.04)'
                  : alert.type === 'drop' || alert.type === 'poor'
                  ? 'rgba(255, 136, 0, 0.04)'
                  : 'transparent',
                borderLeft: `2px solid ${
                  alert.type === 'critical' || alert.type === 'banned' ? 'var(--danger)'
                  : alert.type === 'drop' || alert.type === 'poor' ? 'var(--warning-alt)'
                  : 'var(--border-active)'
                }`,
              }}
            >
              <AlertIcon type={alert.type} />
              <div className="flex-1 min-w-0">
                <p className="text-[var(--tx-secondary)] leading-relaxed">{alert.message}</p>
                <AlertTime ts={alert.timestamp} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
