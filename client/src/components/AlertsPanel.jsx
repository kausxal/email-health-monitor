import { useState, useEffect } from 'react'

function AlertIcon({ type }) {
  const icons = {
    critical: '🔴',
    banned: '🚫',
    connection: '🔌',
    drop: '📉',
    poor: '⚠️'
  }
  return <span>{icons[type] || '⚠️'}</span>
}

function AlertTime({ ts }) {
  const [ago, setAgo] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(ts).getTime()
      const mins = Math.floor(diff / 60000)
      if (mins < 1) setAgo('just now')
      else if (mins < 60) setAgo(`${mins}m ago`)
      else setAgo(`${Math.floor(mins / 60)}h ago`)
    }
    update()
    const interval = setInterval(update, 30_000)
    return () => clearInterval(interval)
  }, [ts])

  return <span className="text-xs text-gray-600">{ago}</span>
}

export default function AlertsPanel({ alerts }) {
  const visible = alerts.slice(0, 10)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-full max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-200">Alerts</h2>
        {alerts.length > 0 && (
          <span className="text-xs text-gray-500">{alerts.length} total</span>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">✅</div>
          <p className="text-sm text-gray-600">No alerts</p>
          <p className="text-xs text-gray-700">All accounts healthy</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((alert, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg text-xs ${
                alert.type === 'critical' || alert.type === 'banned'
                  ? 'bg-red-950/50 border border-red-900/30'
                  : alert.type === 'drop' || alert.type === 'poor'
                  ? 'bg-orange-950/50 border border-orange-900/30'
                  : 'bg-gray-800/50 border border-gray-700/30'
              }`}
            >
              <AlertIcon type={alert.type} />
              <div className="flex-1 min-w-0">
                <p className="text-gray-300 leading-relaxed">{alert.message}</p>
                <AlertTime ts={alert.timestamp} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
