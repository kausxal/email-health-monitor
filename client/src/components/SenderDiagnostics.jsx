import { useState } from 'react'

function IssueRow({ issue }) {
  const sevColor = issue.severity === 'good' ? 'text-[var(--safe)]' : issue.severity === 'high' ? 'text-[var(--danger)]' : issue.severity === 'medium' ? 'text-[var(--warn)]' : 'text-[var(--warning-alt)]'
  const bgColor = issue.severity === 'good' ? 'rgba(0,255,136,0.03)' : issue.severity === 'high' ? 'rgba(255,51,85,0.03)' : 'rgba(255,204,0,0.03)'
  return (
    <div className="p-3 border-b border-[var(--border)]/30 text-xs" style={{ background: bgColor }}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] px-2 py-0.5 border tracking-wider ${sevColor} border-current`}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          {issue.severity.toUpperCase()}
        </span>
        <span className="text-[var(--tx-primary)] font-medium">{issue.label}</span>
      </div>
      {issue.detail && <p className="text-[var(--tx-muted)] text-[10px] mb-1 font-mono break-all">{issue.detail}</p>}
      {issue.fix && <p className="text-[var(--accent)] text-[10px] leading-relaxed">→ {issue.fix}</p>}
    </div>
  )
}

export default function SenderDiagnostics() {
  const [domain, setDomain] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const check = async () => {
    if (!domain.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/sender/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResult(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-6 text-[10px] text-[var(--tx-muted)] tracking-wider">
        <span>◈ SPF · DKIM · DMARC · MX · BLACKLIST</span>
        <span>⊘ CHECKS YOUR SENDING DOMAIN SETUP</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <input type="text" value={domain} onChange={e => setDomain(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="yourdomain.com"
          className="flex-1 chrome-surface text-xs text-[var(--tx-secondary)] p-3 outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
        <button onClick={check} disabled={loading || !domain.trim()} className="chrome-button px-4 py-2 text-xs">◈ CHECK</button>
      </div>

      {loading && <div className="flex items-center gap-2 text-xs text-[var(--tx-muted)] mb-4">
        <div className="w-3 h-3 border border-[var(--accent)] animate-spin" style={{ boxShadow: '0 0 6px var(--accent-shadow)' }} />
        SCANNING...
      </div>}

      {error && <p className="text-xs text-[var(--danger)] mb-4">{error}</p>}

      {result && (
        <div className="chrome-surface overflow-hidden">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-sm tracking-[0.12em] text-[var(--tx-primary)]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{result.domain}</h2>
              <div className="flex items-center gap-3">
                <span className={`text-lg ${result.level === 'good' ? 'text-[var(--safe)]' : result.level === 'moderate' ? 'text-[var(--warn)]' : 'text-[var(--danger)]'}`}
                  style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>
                  {result.score}% SENDER READY
                </span>
              </div>
            </div>
            {result.critical > 0 && <p className="text-[10px] text-[var(--danger)] mt-1">{result.critical} critical {result.critical === 1 ? 'issue' : 'issues'} — fix before sending cold email</p>}
            {result.warnings > 0 && result.critical === 0 && <p className="text-[10px] text-[var(--warn)] mt-1">{result.warnings} warnings — address for better deliverability</p>}
            {result.critical === 0 && result.warnings === 0 && <p className="text-[10px] text-[var(--safe)] mt-1">all checks pass — your domain is ready for cold email</p>}
          </div>
          <div>
            {result.issues?.map((issue, i) => <IssueRow key={i} issue={issue} />)}
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="chrome-surface text-center py-12 md:py-16">
          <p className="text-[var(--tx-muted)] text-base md:text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>SENDER DIAGNOSTICS</p>
          <p className="text-[var(--tx-dim)] text-xs">check if YOUR domain is configured to send cold email successfully</p>
        </div>
      )}
    </div>
  )
}
