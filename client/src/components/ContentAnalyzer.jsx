import { useState } from 'react'

function IssueRow({ issue }) {
  const sc = issue.severity === 'good' ? 'text-[var(--safe)]' : issue.severity === 'high' ? 'text-[var(--danger)]' : issue.severity === 'medium' ? 'text-[var(--warn)]' : 'text-[var(--warning-alt)]'
  const bg = issue.severity === 'good' ? 'rgba(0,255,136,0.03)' : issue.severity === 'high' ? 'rgba(255,51,85,0.03)' : 'rgba(255,204,0,0.03)'
  return (
    <div className="p-3 border-b border-[var(--border)]/30 text-xs" style={{ background: bg }}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] px-2 py-0.5 border tracking-wider ${sc} border-current`}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{issue.severity.toUpperCase()}</span>
        <span className="text-[var(--tx-primary)]">{issue.label}</span>
      </div>
      {issue.detail && <p className="text-[var(--tx-muted)] text-[10px] mb-1 font-mono break-all">{issue.detail}</p>}
      {issue.fix && <p className="text-[var(--accent)] text-[10px] leading-relaxed">→ {issue.fix}</p>}
    </div>
  )
}

export default function ContentAnalyzer() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [fromName, setFromName] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const analyze = async () => {
    if (!body.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/content/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), body, fromName: fromName.trim() || undefined }),
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
        <span>◈ SPAM SCORE · TRIGGER WORDS · STRUCTURE · PERSONALIZATION</span>
        <span>⊘ PASTE YOUR EMAIL BEFORE SENDING</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input type="text" value={fromName} onChange={e => setFromName(e.target.value)}
          placeholder="From name (optional)" className="chrome-input px-4 py-2.5 text-xs" />
        <div className="md:col-span-2">
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="Subject line" className="chrome-input w-full px-4 py-2.5 text-xs" />
        </div>
      </div>

      <textarea value={body} onChange={e => setBody(e.target.value)}
        placeholder={`Paste your email body here...\n\nChecks:\n- Spam trigger words\n- Subject line quality\n- Link/image count\n- ALL CAPS / exclamation marks\n- Email length\n- Personalization tokens\n- Text vs HTML ratio`}
        className="w-full h-48 chrome-surface text-xs text-[var(--tx-secondary)] p-3 mb-4 resize-none outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />

      <div className="flex items-center gap-3 mb-6">
        <button onClick={analyze} disabled={loading || !body.trim()} className="chrome-button px-4 py-2 text-xs">◈ ANALYZE</button>
        {loading && <div className="flex items-center gap-2 text-xs text-[var(--tx-muted)]">
          <div className="w-3 h-3 border border-[var(--accent)] animate-spin" style={{ boxShadow: '0 0 6px var(--accent-shadow)' }} />
          SCANNING...
        </div>}
        {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
      </div>

      {result && (
        <div className="chrome-surface overflow-hidden">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-sm tracking-[0.12em] text-[var(--tx-primary)]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>SPAM ANALYSIS</h2>
              <div className="flex items-center gap-3">
                <span className={`text-lg ${result.level === 'good' ? 'text-[var(--safe)]' : result.level === 'moderate' ? 'text-[var(--warn)]' : 'text-[var(--danger)]'}`}
                  style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>
                  {result.score}%
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-2 flex-wrap text-[10px] text-[var(--tx-muted)]">
              <span>{result.stats.wordCount} words</span>
              <span>{result.stats.linkCount} links</span>
              <span>{result.stats.imgCount} images</span>
              <span>{result.stats.exclaimCount} exclamation marks</span>
              <span>{result.stats.capsWords} ALL CAPS words</span>
              <span>{result.stats.triggerWords} trigger words</span>
            </div>
          </div>
          {result.issues.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-[var(--safe)] text-xs">No issues found — your email is clean</p>
            </div>
          ) : (
            <div>{result.issues.map((issue, i) => <IssueRow key={i} issue={issue} />)}</div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="chrome-surface text-center py-12 md:py-16">
          <p className="text-[var(--tx-muted)] text-base md:text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>CONTENT ANALYZER</p>
          <p className="text-[var(--tx-dim)] text-xs">catch spam triggers before they catch you — paste your email and get a deliverability score</p>
        </div>
      )}
    </div>
  )
}
