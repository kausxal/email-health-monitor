import { useState, useEffect, useCallback } from 'react'

function computeDiff(oldR, newR) {
  const changes = []
  if (!oldR || !newR) return changes
  if (oldR.mxRisk !== newR.mxRisk) changes.push(`MX: ${oldR.mxRisk || '?'} → ${newR.mxRisk || '?'}`)
  if ((oldR.mxDetail?.providers || []).join() !== (newR.mxDetail?.providers || []).join())
    changes.push(`Provider: ${(oldR.mxDetail?.providers || []).join(',') || 'none'} → ${(newR.mxDetail?.providers || []).join(',') || 'none'}`)
  if (oldR.dnsAuth?.spf?.status !== newR.dnsAuth?.spf?.status) changes.push(`SPF: ${oldR.dnsAuth?.spf?.status || '?'} → ${newR.dnsAuth?.spf?.status || '?'}`)
  if (oldR.dnsAuth?.dkim?.found !== newR.dnsAuth?.dkim?.found) changes.push(`DKIM: ${oldR.dnsAuth?.dkim?.found ? 'OK' : 'NO'} → ${newR.dnsAuth?.dkim?.found ? 'OK' : 'NO'}`)
  if (oldR.dnsAuth?.dmarc?.policy !== newR.dnsAuth?.dmarc?.policy) changes.push(`DMARC: ${oldR.dnsAuth?.dmarc?.policy || '?'} → ${newR.dnsAuth?.dmarc?.policy || '?'}`)
  if (oldR.blacklist?.listed !== newR.blacklist?.listed) changes.push(`Blacklist: ${oldR.blacklist?.listed ? 'LISTED' : 'CLEAN'} → ${newR.blacklist?.listed ? 'LISTED' : 'CLEAN'}`)
  return changes
}

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState([])
  const [checking, setChecking] = useState({})
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/watchlist')
      const data = await res.json()
      if (!data.error) setWatchlist(data.watchlist || [])
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  const remove = async (domain) => {
    await fetch(`/api/watchlist/${encodeURIComponent(domain)}`, { method: 'DELETE' })
    setWatchlist(w => w.filter(x => x.domain !== domain))
  }

  const recheck = async (domain, name) => {
    setChecking(c => ({ ...c, [domain]: 'scanning' }))
    try {
      const res = await fetch('/api/bulk/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ name, domain }] }),
      })
      const data = await res.json()
      const result = data.results?.[0]
      if (result) {
        setWatchlist(w => w.map(x => {
          if (x.domain !== domain) return x
          const old = x.lastResult
          const changes = old ? computeDiff(old, result) : []
          return { ...x, lastResult: result, lastChecked: Date.now(), lastDiff: changes, diffSeen: false }
        }))
      }
    } catch {}
    setChecking(c => ({ ...c, [domain]: null }))
  }

  const recheckAll = async () => {
    for (const item of watchlist) {
      await recheck(item.domain, item.name)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-6 text-[10px] text-[var(--tx-muted)] tracking-wider">
        <span>◈ SAVED DOMAINS</span>
        <span>⊘ PERSISTED TO DISK</span>
        {watchlist.length > 0 && <span>⊘ {watchlist.length} TRACKED</span>}
      </div>

      {error && <p className="text-xs text-[var(--danger)] mb-4">{error}</p>}

      {watchlist.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <button onClick={recheckAll} className="chrome-button px-4 py-2 text-xs">◈ RECHECK ALL</button>
        </div>
      )}

      {watchlist.length === 0 ? (
        <div className="chrome-surface text-center py-12 md:py-16">
          <p className="text-[var(--tx-muted)] text-base md:text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>WATCHLIST</p>
          <p className="text-[var(--tx-dim)] text-xs">add domains from Target Scanner — recheck shows what changed since last scan</p>
        </div>
      ) : (
        <div className="chrome-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--tx-muted)] text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">DOMAIN</th>
                  <th className="text-left px-4 py-3 font-medium">SCORE</th>
                  <th className="text-left px-4 py-3 font-medium hide-mobile">CHANNEL</th>
                  <th className="text-left px-4 py-3 font-medium hide-mobile">MX</th>
                  <th className="text-left px-4 py-3 font-medium hide-mobile">CHANGES</th>
                  <th className="text-left px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((item, i) => {
                  const lr = item.lastResult
                  const del = lr?.deliverability
                  const hasDiff = item.lastDiff?.length > 0
                  return (
                    <tr key={i} className={`border-b border-[var(--border)]/50 transition-colors hover:bg-[var(--bg-hover)] ${hasDiff ? 'bg-[var(--warn)]/5' : ''}`}>
                      <td className="px-4 py-3 font-medium text-[var(--tx-primary)] flex items-center gap-2">
                        {item.domain}
                        {hasDiff && <span className="text-[var(--warn)] text-[9px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>CHANGED</span>}
                      </td>
                      <td className="px-4 py-3">
                        {del ? (
                          <span className={`text-[10px] px-2 py-0.5 border tracking-wider ${del.level === 'good' ? 'text-[var(--safe)] border-[var(--safe)]' : del.level === 'moderate' ? 'text-[var(--warn)] border-[var(--warn)]' : 'text-[var(--danger)] border-[var(--danger)]'}`}
                            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{del.score}%</span>
                        ) : <span className="text-[var(--tx-muted)]">—</span>}
                      </td>
                      <td className="px-4 py-3 hide-mobile">
                        <span className={`text-[10px] ${del?.level === 'good' ? 'text-[var(--safe)]' : del?.level === 'moderate' ? 'text-[var(--warn)]' : 'text-[var(--danger)]'}`}
                          style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                          {del?.level === 'good' ? 'EMAIL' : del?.level === 'moderate' ? 'TEST' : del?.level === 'poor' ? 'LINKEDIN' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hide-mobile">
                        <span className={`text-[10px] tracking-wider ${lr?.mxRisk === 'high' ? 'text-[var(--danger)]' : lr?.mxRisk === 'medium' ? 'text-[var(--warn)]' : lr?.mxRisk === 'low' ? 'text-[var(--safe)]' : 'text-[var(--tx-muted)]'}`}
                          style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{lr?.mxRisk || '—'}</span>
                      </td>
                      <td className="px-4 py-3 hide-mobile">
                        {hasDiff ? (
                          <div className="space-y-0.5">
                            {item.lastDiff.map((d, di) => (
                              <p key={di} className="text-[9px] text-[var(--warn)] leading-tight">{d}</p>
                            ))}
                          </div>
                        ) : item.lastChecked ? (
                          <span className="text-[var(--tx-dim)] text-[9px]">no changes</span>
                        ) : <span className="text-[var(--tx-dim)] text-[9px]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => recheck(item.domain, item.name)} disabled={checking[item.domain]}
                            className="text-[10px] text-[var(--tx-muted)] hover:text-[var(--accent)] transition-colors"
                            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                            {checking[item.domain] ? '...' : '⇄'}
                          </button>
                          <button onClick={() => remove(item.domain)}
                            className="text-[10px] text-[var(--tx-muted)] hover:text-[var(--danger)] transition-colors"
                            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
