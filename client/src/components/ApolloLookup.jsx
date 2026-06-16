import { useState, useEffect } from 'react'

const STORAGE_KEY = 'apollo_lookup_session'

function maskEmail(email) {
  if (!email) return ''
  const [local, domain] = email.split('@')
  if (!domain) return email
  return `${local[0]}${'*'.repeat(Math.min(local.length - 1, 4))}@${domain}`
}

export default function ApolloLookup({ apolloApiKey }) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [revealed, setRevealed] = useState({})

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        setResult(data.result || null)
        setInput(data.input || '')
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      if (result) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ result, input }))
      }
    } catch {}
  }, [result, input])

  const lookup = async () => {
    const val = input.trim()
    if (!val) return
    if (!apolloApiKey) { setError('No Apollo API key configured — add one in Settings'); return }
    setLoading(true); setError(null); setResult(null); setRevealed({})
    try {
      const body = { apiKey: apolloApiKey }
      if (val.includes('linkedin.com')) body.linkedinUrl = val
      else body.email = val

      const res = await fetch('/api/apollo/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResult(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const clearSession = () => {
    localStorage.removeItem(STORAGE_KEY)
    setResult(null)
    setInput('')
    setRevealed({})
    setError(null)
  }

  const toggleReveal = (idx) => {
    setRevealed(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-6 text-[10px] text-[var(--tx-muted)] tracking-wider">
        <span>◈ APOLLO.IO PERSON LOOKUP</span>
        <span>⊘ PASTE EMAIL OR LINKEDIN URL</span>
      </div>

      {!apolloApiKey && (
        <div className="chrome-surface p-4 mb-4 border border-[var(--warn)]" style={{ background: 'rgba(255,204,0,0.04)' }}>
          <p className="text-xs text-[var(--warn)] tracking-wider">◆ No Apollo API key set — go to Config tab to add one</p>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookup()}
          placeholder="email@company.com or https://linkedin.com/in/username"
          className="flex-1 chrome-surface text-xs text-[var(--tx-secondary)] p-3 outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
        <button onClick={lookup} disabled={loading || !input.trim() || !apolloApiKey} className="chrome-button px-4 py-2 text-xs">◈ LOOKUP</button>
        {result && <button onClick={clearSession} className="chrome-button px-4 py-2 text-xs" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>✕ CLEAR</button>}
      </div>

      {loading && <div className="flex items-center gap-2 text-xs text-[var(--tx-muted)] mb-4">
        <div className="w-3 h-3 border border-[var(--accent)] animate-spin" style={{ boxShadow: '0 0 6px var(--accent-shadow)' }} />
        LOOKING UP...
      </div>}

      {error && <p className="text-xs text-[var(--danger)] mb-4">{error}</p>}

      {result && (
        <div className="chrome-surface overflow-hidden">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-3 mb-2">
              {result.photoUrl && (
                <img src={result.photoUrl} alt="" className="w-10 h-10 rounded-full border border-[var(--border)]"
                  onError={e => { e.target.style.display = 'none' }} />
              )}
              <div>
                <h2 className="text-sm tracking-[0.12em] text-[var(--tx-primary)]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{result.name}</h2>
                {result.headline && <p className="text-[10px] text-[var(--tx-muted)]">{result.headline}</p>}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Company + Title */}
            {(result.organization || result.title) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.organization && (
                  <div>
                    <p className="text-[10px] tracking-wider text-[var(--tx-muted)] mb-0.5" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>COMPANY</p>
                    <p className="text-xs text-[var(--tx-secondary)]">
                      {result.organization}
                      {result.orgWebsite && <span className="ml-2 text-[var(--accent)]">({result.orgWebsite})</span>}
                    </p>
                  </div>
                )}
                {result.title && (
                  <div>
                    <p className="text-[10px] tracking-wider text-[var(--tx-muted)] mb-0.5" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>TITLE</p>
                    <p className="text-xs text-[var(--tx-secondary)]">{result.title}</p>
                  </div>
                )}
              </div>
            )}

            {/* Location */}
            {(result.city || result.state || result.country) && (
              <div>
                <p className="text-[10px] tracking-wider text-[var(--tx-muted)] mb-0.5" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>LOCATION</p>
                <p className="text-xs text-[var(--tx-secondary)]">{[result.city, result.state, result.country].filter(Boolean).join(', ')}</p>
              </div>
            )}

            {/* Phone */}
            {result.phone && (
              <div>
                <p className="text-[10px] tracking-wider text-[var(--tx-muted)] mb-0.5" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>PHONE</p>
                <p className="text-xs text-[var(--tx-secondary)]">{result.phone}</p>
              </div>
            )}

            {/* Emails */}
            {result.emails?.length > 0 && (
              <div>
                <p className="text-[10px] tracking-wider text-[var(--tx-muted)] mb-1.5" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>EMAIL{result.emails.length > 1 ? 'S' : ''}</p>
                <div className="space-y-1.5">
                  {result.emails.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-[var(--tx-secondary)]">
                        {revealed[i] ? e.address : maskEmail(e.address)}
                      </span>
                      {e.status && (
                        <span className={`text-[9px] px-1.5 py-0.5 border tracking-wider ${
                          e.status === 'verified' ? 'text-[var(--safe)] border-[var(--safe)]' :
                          e.status === 'guessed' ? 'text-[var(--warn)] border-[var(--warn)]' :
                          'text-[var(--tx-muted)] border-[var(--tx-muted)]'
                        }`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                          {e.status.toUpperCase()}
                        </span>
                      )}
                      <button onClick={() => toggleReveal(i)}
                        className="text-[10px] text-[var(--accent)] hover:underline tracking-wider"
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                        {revealed[i] ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Social links */}
            <div className="flex flex-wrap gap-3">
              {result.linkedinUrl && (
                <a href={result.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-[var(--accent)] hover:underline tracking-wider"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  LINKEDIN ↗
                </a>
              )}
              {result.twitterUrl && (
                <a href={result.twitterUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-[var(--accent)] hover:underline tracking-wider"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  TWITTER ↗
                </a>
              )}
              {result.facebookUrl && (
                <a href={result.facebookUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-[var(--accent)] hover:underline tracking-wider"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  FACEBOOK ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="chrome-surface text-center py-12 md:py-16">
          <p className="text-[var(--tx-muted)] text-base md:text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>APOLLO LOOKUP</p>
          <p className="text-[var(--tx-dim)] text-xs">paste an email or LinkedIn URL to get full prospect details with click-to-reveal emails</p>
        </div>
      )}
    </div>
  )
}
