import { useState } from 'react'

function HealthBadge({ score }) {
  const label = score >= 90 ? 'healthy' : score >= 70 ? 'warning' : score >= 50 ? 'poor' : 'critical'
  const colors = {
    healthy: 'text-[var(--safe)] border-[var(--safe)]',
    warning: 'text-[var(--warn)] border-[var(--warn)]',
    poor: 'text-[var(--warning-alt)] border-[var(--warning-alt)]',
    critical: 'text-[var(--danger)] border-[var(--danger)]',
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
    active: 'var(--safe)',
    connection_error: 'var(--danger)',
    paused: 'var(--warn)',
    disabled: 'var(--tx-muted)',
  }
  const c = colors[status] || 'var(--tx-muted)'
  return (
    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}40` }} />
  )
}

export default function AccountCard({ account }) {
  const [expanded, setExpanded] = useState(false)
  const a = account

  return (
    <div className="chrome-border transition-colors" style={{ background: 'var(--surface)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3 md:p-4 flex items-center gap-4"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusDot status={a.status} />
            <span className="text-xs text-[var(--tx-primary)] tracking-wide truncate">{a.email}</span>
          </div>
          <div className="flex items-center gap-3 md:gap-4 text-[10px] text-[var(--tx-muted)] uppercase tracking-wider flex-wrap">
            <span className={a.status === 'connection_error' ? 'text-[var(--danger)]' : ''}>
              {a.status?.replace('_', ' ')}
            </span>
            <span className={a.warmup_status === 'banned' ? 'text-[var(--danger)]' : ''}>
              warmup: {a.warmup_status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <HealthBadge score={a.health_score} />
          <svg className={`w-3 h-3 text-[var(--tx-muted)] transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-3 md:px-4 pb-4 border-t border-[var(--border)] pt-3">
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <p className="text-[var(--tx-muted)] tracking-wider mb-1 text-[10px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>HEALTH SCORE</p>
              <div className="h-1.5 w-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${a.health_score}%`,
                    background: a.health_score >= 90 ? 'var(--safe)' : a.health_score >= 70 ? 'var(--warn)' : a.health_score >= 50 ? 'var(--warning-alt)' : 'var(--danger)',
                    boxShadow: `0 0 8px ${a.health_score >= 90 ? 'rgba(0,255,136,0.3)' : a.health_score >= 70 ? 'rgba(255,204,0,0.3)' : a.health_score >= 50 ? 'rgba(255,136,0,0.3)' : 'rgba(255,51,85,0.3)'}`,
                  }}
                />
              </div>
              <p className="text-[var(--tx-secondary)] mt-1">{a.health_score}%</p>
            </div>

            <div>
              <p className="text-[var(--tx-muted)] tracking-wider mb-1 text-[10px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>WARMUP</p>
              <p className="text-[var(--tx-secondary)]">{a.stat_warmup_score ?? 'N/A'}</p>
            </div>

            <div>
              <p className="text-[var(--tx-muted)] tracking-wider mb-1 text-[10px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>DAILY LIMIT</p>
              <p className="text-[var(--tx-secondary)]">{a.payload?.daily_limit ?? 'N/A'}/day</p>
            </div>

            <div>
              <p className="text-[var(--tx-muted)] tracking-wider mb-1 text-[10px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>TRACKING</p>
              <p className={a.payload?.tracking_domain?.status === 'CTD_ACTIVE' ? 'text-[var(--safe)]' : 'text-[var(--danger)]'}>
                {a.payload?.tracking_domain?.status?.replace('CTD_', '') || 'NONE'}
              </p>
            </div>

            <div>
              <p className="text-[var(--tx-muted)] tracking-wider mb-1 text-[10px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>PROVIDER</p>
              <p className="text-[var(--tx-secondary)]">{a.provider_code === 1 ? 'SMTP' : a.provider_code === 2 ? 'Google' : a.provider_code === 3 ? 'Microsoft' : `#${a.provider_code}`}</p>
            </div>

            <div>
              <p className="text-[var(--tx-muted)] tracking-wider mb-1 text-[10px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>CREATED</p>
              <p className="text-[var(--tx-secondary)]">{new Date(a.timestamp_created).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
