import { useState } from 'react'

function HealthBadge({ score }) {
  const label = score >= 90 ? 'healthy' : score >= 70 ? 'warning' : score >= 50 ? 'poor' : 'critical'
  const colors = {
    healthy: 'text-[#00ff88] border-[#00ff88]',
    warning: 'text-[#ffcc00] border-[#ffcc00]',
    poor: 'text-[#ff8800] border-[#ff8800]',
    critical: 'text-[#ff3355] border-[#ff3355]',
  }
  const dots = {
    healthy: '🟢',
    warning: '🟡',
    poor: '🟠',
    critical: '🔴',
  }

  return (
    <span className={`text-[11px] px-2 py-0.5 border tracking-wider ${colors[label]}`}
      style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
      {dots[label]} {score}%
    </span>
  )
}

function StatusDot({ status }) {
  const colors = {
    active: '#00ff88',
    connection_error: '#ff3355',
    paused: '#ffcc00',
    disabled: '#555',
  }
  return (
    <span className="inline-block w-1.5 h-1.5" style={{ background: colors[status] || '#555', boxShadow: `0 0 6px ${colors[status] || '#555'}40` }} />
  )
}

export default function AccountCard({ account }) {
  const [expanded, setExpanded] = useState(false)
  const a = account

  return (
    <div className="chrome-border transition-colors" style={{ background: 'var(--chromium-surface)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-4"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusDot status={a.status} />
            <span className="text-xs text-[#d4d4d4] tracking-wide truncate">{a.email}</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-[#555] uppercase tracking-wider">
            <span className={a.status === 'connection_error' ? 'text-[#ff3355]' : ''}>
              {a.status?.replace('_', ' ')}
            </span>
            <span className={a.warmup_status === 'banned' ? 'text-[#ff3355]' : ''}>
              warmup: {a.warmup_status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <HealthBadge score={a.health_score} />
          <svg className={`w-3 h-3 text-[#555] transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#1a1a1a] pt-3">
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <p className="text-[#555] tracking-wider mb-1 text-[10px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>HEALTH SCORE</p>
              <div className="h-1.5 w-full overflow-hidden" style={{ background: 'var(--chromium-bg)' }}>
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${a.health_score}%`,
                    background: a.health_score >= 90 ? 'var(--chromium-safe)' : a.health_score >= 70 ? 'var(--chromium-amber)' : a.health_score >= 50 ? 'var(--chromium-warning)' : 'var(--chromium-danger)',
                    boxShadow: `0 0 8px ${a.health_score >= 90 ? 'rgba(0,255,136,0.3)' : a.health_score >= 70 ? 'rgba(255,204,0,0.3)' : a.health_score >= 50 ? 'rgba(255,136,0,0.3)' : 'rgba(255,51,85,0.3)'}`,
                  }}
                />
              </div>
              <p className="text-[#a0a0a0] mt-1">{a.health_score}%</p>
            </div>

            <div>
              <p className="text-[#555] tracking-wider mb-1 text-[10px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>WARMUP</p>
              <p className="text-[#a0a0a0]">{a.stat_warmup_score ?? 'N/A'}</p>
            </div>

            <div>
              <p className="text-[#555] tracking-wider mb-1 text-[10px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>DAILY LIMIT</p>
              <p className="text-[#a0a0a0]">{a.payload?.daily_limit ?? 'N/A'}/day</p>
            </div>

            <div>
              <p className="text-[#555] tracking-wider mb-1 text-[10px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>TRACKING</p>
              <p className={a.payload?.tracking_domain?.status === 'CTD_ACTIVE' ? 'text-[#00ff88]' : 'text-[#ff3355]'}>
                {a.payload?.tracking_domain?.status?.replace('CTD_', '') || 'NONE'}
              </p>
            </div>

            <div>
              <p className="text-[#555] tracking-wider mb-1 text-[10px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>PROVIDER</p>
              <p className="text-[#a0a0a0]">{a.provider_code === 1 ? 'SMTP' : a.provider_code === 2 ? 'Google' : a.provider_code === 3 ? 'Microsoft' : `#${a.provider_code}`}</p>
            </div>

            <div>
              <p className="text-[#555] tracking-wider mb-1 text-[10px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>CREATED</p>
              <p className="text-[#a0a0a0]">{new Date(a.timestamp_created).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
