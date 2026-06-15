import { useState, useEffect, useCallback } from 'react'

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
        setWatchlist(w => w.map(x => x.domain === domain ? { ...x, lastResult: result, lastChecked: Date.now() } : x))
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
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-6 text-[10px] text-[#555] tracking-wider">
        <span>◈ SAVED DOMAINS</span>
        <span>⊘ PERSISTED TO DISK</span>
        {watchlist.length > 0 && <span>⊘ {watchlist.length} TRACKED</span>}
      </div>

      {error && <p className="text-xs text-[#ff3355] mb-4">{error}</p>}

      {watchlist.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <button onClick={recheckAll} className="chrome-button px-4 py-2 text-xs">◈ RECHECK ALL</button>
        </div>
      )}

      {watchlist.length === 0 ? (
        <div className="chrome-surface text-center py-16">
          <p className="text-[#555] text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>WATCHLIST</p>
          <p className="text-[#333] text-xs">add domains from Target Scanner &mdash; recheck anytime for MX provider changes or auth degradations</p>
        </div>
      ) : (
        <div className="chrome-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#555] text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">DOMAIN</th>
                  <th className="text-left px-4 py-3 font-medium">SCORE</th>
                  <th className="text-left px-4 py-3 font-medium">MX</th>
                  <th className="text-left px-4 py-3 font-medium">SPF</th>
                  <th className="text-left px-4 py-3 font-medium">DKIM</th>
                  <th className="text-left px-4 py-3 font-medium">DMARC</th>
                  <th className="text-left px-4 py-3 font-medium">BL</th>
                  <th className="text-left px-4 py-3 font-medium">CHECKED</th>
                  <th className="text-left px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((item, i) => {
                  const lr = item.lastResult
                  const del = lr?.deliverability
                  return (
                    <tr key={i} className="border-b border-[#1a1a1a]/50 transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-[#d4d4d4]">{item.domain}</td>
                      <td className="px-4 py-3">
                        {del ? (
                          <span className={`text-[10px] px-2 py-0.5 border tracking-wider ${
                            del.level === 'good' ? 'text-[#00ff88] border-[#00ff88]' :
                            del.level === 'moderate' ? 'text-[#ffcc00] border-[#ffcc00]' :
                            'text-[#ff3355] border-[#ff3355]'
                          }`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                            {del.score}
                          </span>
                        ) : <span className="text-[#555]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] tracking-wider ${
                          lr?.mxRisk === 'high' ? 'text-[#ff3355]' :
                          lr?.mxRisk === 'medium' ? 'text-[#ffcc00]' :
                          lr?.mxRisk === 'low' ? 'text-[#00ff88]' : 'text-[#555]'
                        }`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                          {lr?.mxRisk || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#555]">{lr?.dnsAuth?.spf?.status || '—'}</td>
                      <td className="px-4 py-3 text-[#555]">{lr?.dnsAuth?.dkim?.found ? 'OK' : '—'}</td>
                      <td className="px-4 py-3 text-[#555]">{lr?.dnsAuth?.dmarc?.policy || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] ${lr?.blacklist?.listed ? 'text-[#ff3355]' : 'text-[#555]'}`}
                          style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                          {lr?.blacklist?.listed ? 'YES' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#333] text-[10px]">
                        {item.lastChecked ? new Date(item.lastChecked).toLocaleTimeString() : 'never'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => recheck(item.domain, item.name)}
                            disabled={checking[item.domain]}
                            className="text-[10px] text-[#555] hover:text-[#00f0ff] transition-colors"
                            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                          >
                            {checking[item.domain] ? '...' : '⇄'}
                          </button>
                          <button
                            onClick={() => remove(item.domain)}
                            className="text-[10px] text-[#555] hover:text-[#ff3355] transition-colors"
                            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                          >
                            ✕
                          </button>
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
