import { useState } from 'react'

function HealthBadge({ score }) {
  const label = score >= 90 ? 'healthy' : score >= 70 ? 'warning' : score >= 50 ? 'poor' : 'critical'
  const colors = {
    healthy: 'bg-green-900/30 text-green-300 border-green-700/50',
    warning: 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50',
    poor: 'bg-orange-900/30 text-orange-300 border-orange-700/50',
    critical: 'bg-red-900/30 text-red-300 border-red-700/50',
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[label]}`}>
      {score}%
    </span>
  )
}

function StatusDot({ status }) {
  const colors = {
    active: 'bg-green-500',
    connection_error: 'bg-red-500',
    paused: 'bg-yellow-500',
    disabled: 'bg-gray-500',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-gray-500'}`} />
}

export default function AccountCard({ account }) {
  const [expanded, setExpanded] = useState(false)
  const a = account

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-4"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusDot status={a.status} />
            <span className="text-sm font-medium text-gray-200 truncate">{a.email}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className={a.status === 'connection_error' ? 'text-red-400' : ''}>
              {a.status?.replace('_', ' ')}
            </span>
            <span className={a.warmup_status === 'banned' ? 'text-red-400 font-semibold' : ''}>
              warmup: {a.warmup_status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <HealthBadge score={a.health_score} />
          <svg className={`w-4 h-4 text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-600 mb-1">Health Score</p>
              <div className="bg-gray-800 rounded-full h-2 w-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    a.health_score >= 90 ? 'bg-green-500'
                    : a.health_score >= 70 ? 'bg-yellow-500'
                    : a.health_score >= 50 ? 'bg-orange-500'
                    : 'bg-red-500'
                  }`}
                  style={{ width: `${a.health_score}%` }}
                />
              </div>
              <p className="text-gray-400 mt-1">{a.health_score}%</p>
            </div>

            <div>
              <p className="text-gray-600 mb-1">Warmup Score</p>
              <p className="text-gray-300">{a.stat_warmup_score ?? 'N/A'}</p>
            </div>

            <div>
              <p className="text-gray-600 mb-1">Daily Limit</p>
              <p className="text-gray-300">{a.payload?.daily_limit ?? 'N/A'}/day</p>
            </div>

            <div>
              <p className="text-gray-600 mb-1">Tracking Domain</p>
              <p className={`${a.payload?.tracking_domain?.status === 'CTD_ACTIVE' ? 'text-green-400' : 'text-red-400'}`}>
                {a.payload?.tracking_domain?.status?.replace('CTD_', '') || 'None'}
              </p>
            </div>

            <div>
              <p className="text-gray-600 mb-1">Provider</p>
              <p className="text-gray-300">{a.provider_code === 1 ? 'SMTP' : a.provider_code === 2 ? 'Google' : a.provider_code === 3 ? 'Microsoft' : `Code ${a.provider_code}`}</p>
            </div>

            <div>
              <p className="text-gray-600 mb-1">Created</p>
              <p className="text-gray-300">{new Date(a.timestamp_created).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
