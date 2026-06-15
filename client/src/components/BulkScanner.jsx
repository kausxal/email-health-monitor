import { useState, useRef } from 'react'

function Badge({ label, color }) {
  const colors = {
    good: 'text-[#00ff88] border-[#00ff88]',
    moderate: 'text-[#ffcc00] border-[#ffcc00]',
    poor: 'text-[#ff3355] border-[#ff3355]',
    none: 'text-[#555] border-[#555]',
  }
  return (
    <span className={`text-[10px] px-2 py-0.5 border tracking-wider ${colors[color] || colors.none}`}
      style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
      {label}
    </span>
  )
}

export default function BulkScanner() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  const fileInputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file) return
    const text = await file.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const items = lines.map(l => {
      const cols = l.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      return { name: cols[1] || cols[0], domain: cols[0] }
    })
    setInput(items.map(i => i.name || i.domain).join('\n'))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) handleFile(file)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) handleFile(file)
  }

  const runScan = async () => {
    const lines = input.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setLoading(true); setError(null); setStatus(`SCANNING ${lines.length} ITEMS...`)

    const items = lines.map(l => {
      const isDomain = l.includes('.') && !l.includes(' ')
      return isDomain ? { name: l, domain: l } : { name: l }
    })

    try {
      const res = await fetch('/api/bulk/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResults(data.results || [])
      setStatus(`${data.total} SCANNED`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const addToWatchlist = async (domain, name) => {
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, name }),
    })
  }

  const exportCSV = () => {
    if (results.length === 0) return
    const header = 'name,domain,mx_risk,dns_score,blacklisted,deliverability_score,deliverability_level,signals\n'
    const rows = results.map(r => {
      const score = r.deliverability?.score ?? '—'
      const level = r.deliverability?.level ?? '—'
      const signals = (r.deliverability?.signals || []).join('; ')
      return `"${r.name}","${r.domain}","${r.mxRisk || '—'}","${r.dnsAuth?.spf?.status || '—'}","${r.blacklist?.listed || false}","${score}","${level}","${signals}"`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `target-scan-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const delOrder = { poor: 0, moderate: 1, good: 2, null: 3 }
  const sortedResults = [...results].sort((a, b) => (delOrder[a.deliverability?.level] || 3) - (delOrder[b.deliverability?.level] || 3))

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-6 text-[10px] text-[#555] tracking-wider">
        <span>⚡ COMPANY NAMES → DOMAINS → MX + DNS + BLACKLIST + SCORE</span>
        <span>⊘ MAX 100/REQ</span>
        <span>⏱ 30 SCANS/15M</span>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="chrome-border p-8 mb-4 text-center cursor-pointer transition-colors hover:border-[#2a2a2a]"
        style={{ background: 'var(--chromium-surface)' }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
        <p className="text-[#a0a0a0] text-sm mb-2 tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>DROP CSV OR TYPE BELOW</p>
        <p className="text-[10px] text-[#555] tracking-wider">one name/domain per line · auto-detects domains vs company names</p>
      </div>

      {/* Text Input */}
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={`acme corp\nstripe\nstripe.com (auto-detected as domain)`}
        className="w-full h-28 chrome-surface text-xs text-[#a0a0a0] p-3 mb-4 resize-none outline-none"
        style={{ background: 'var(--chromium-surface)', border: '1px solid var(--chromium-border)' }}
      />

      {/* Actions */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={runScan} disabled={loading || !input.trim()} className="chrome-button px-4 py-2 text-xs">◈ SCAN</button>
        {results.length > 0 && (
          <button onClick={exportCSV} className="chrome-button px-4 py-2 text-xs">⬇ EXPORT CSV</button>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#555]">
            <div className="w-3 h-3 border border-[#00f0ff] animate-spin" style={{ boxShadow: '0 0 6px rgba(0,240,255,0.1)' }} />
            {status}
          </div>
        )}
        {!loading && status && <span className="text-xs text-[#555] tracking-wider">{status}</span>}
        {error && <span className="text-xs text-[#ff3355]">{error}</span>}
      </div>

      {/* Summary Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px mb-6" style={{ background: 'var(--chromium-border)' }}>
          {[
            { label: 'TOTAL', value: results.length, color: 'text-[#d4d4d4]', key: 'total' },
            { label: 'DOMAINS FOUND', value: results.filter(r => r.domain).length, color: 'text-[#00ff88]', key: 'found' },
            { label: 'GOOD', value: results.filter(r => r.deliverability?.level === 'good').length, color: 'text-[#00ff88]', key: 'good' },
            { label: 'POOR', value: results.filter(r => r.deliverability?.level === 'poor').length, color: 'text-[#ff3355]', key: 'poor' },
          ].map(s => (
            <div key={s.key} className="p-4" style={{ background: 'var(--chromium-surface)' }}>
              <p className="text-[10px] tracking-[0.12em] text-[#555] mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{s.label}</p>
              <p className={`text-2xl ${s.color}`} style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Results Table */}
      {sortedResults.length > 0 && (
        <div className="chrome-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#555] text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">SCORE</th>
                  <th className="text-left px-4 py-3 font-medium">NAME</th>
                  <th className="text-left px-4 py-3 font-medium">DOMAIN</th>
                  <th className="text-left px-4 py-3 font-medium">MX</th>
                  <th className="text-left px-4 py-3 font-medium">SPF</th>
                  <th className="text-left px-4 py-3 font-medium">DKIM</th>
                  <th className="text-left px-4 py-3 font-medium">DMARC</th>
                  <th className="text-left px-4 py-3 font-medium">BL</th>
                  <th className="text-left px-4 py-3 font-medium">WATCH</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r, i) => (
                  <tr
                    key={i}
                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                    className="border-b border-[#1a1a1a]/50 cursor-pointer transition-colors hover:bg-white/[0.02]"
                    style={r.deliverability?.level === 'poor' ? { background: 'rgba(255,51,85,0.03)' } : r.deliverability?.level === 'moderate' ? { background: 'rgba(255,204,0,0.03)' } : {}}
                  >
                    <td className="px-4 py-3">
                      {r.deliverability ? (
                        <Badge label={`${r.deliverability.score}`} color={r.deliverability.level} />
                      ) : <span className="text-[#555]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[#d4d4d4] max-w-[160px] truncate">{r.name}</td>
                    <td className="px-4 py-3 text-[#a0a0a0]">{r.domain || <span className="text-[#555]">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] tracking-wider ${
                        r.mxRisk === 'high' ? 'text-[#ff3355]' : r.mxRisk === 'medium' ? 'text-[#ffcc00]' : r.mxRisk === 'low' ? 'text-[#00ff88]' : 'text-[#555]'
                      }`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                        {r.mxRisk || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] ${r.dnsAuth?.spf?.status === 'pass' ? 'text-[#00ff88]' : r.dnsAuth?.spf?.status === 'missing' ? 'text-[#ff3355]' : 'text-[#ffcc00]'}`}
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                        {r.dnsAuth?.spf?.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] ${r.dnsAuth?.dkim?.found ? 'text-[#00ff88]' : 'text-[#ff3355]'}`}
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                        {r.dnsAuth?.dkim?.found ? 'OK' : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] ${r.dnsAuth?.dmarc?.policy === 'reject' ? 'text-[#00ff88]' : r.dnsAuth?.dmarc?.policy === 'none' || !r.dnsAuth?.dmarc ? 'text-[#ff3355]' : 'text-[#ffcc00]'}`}
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                        {r.dnsAuth?.dmarc?.policy || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] ${r.blacklist?.listed ? 'text-[#ff3355]' : 'text-[#00ff88]'}`}
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                        {r.blacklist?.listed ? 'YES' : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.domain && (
                        <button
                          onClick={e => { e.stopPropagation(); addToWatchlist(r.domain, r.name); }}
                          className="text-[10px] text-[#555] hover:text-[#00f0ff] transition-colors"
                          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                        >
                          +
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !loading && (
        <div className="chrome-surface text-center py-16">
          <p className="text-[#555] text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>TARGET SCANNER</p>
          <p className="text-[#333] text-xs">enter company names / domains or drop CSV — scans MX firewall, DNS auth, blacklist, and deliverability score</p>
        </div>
      )}
    </div>
  )
}
