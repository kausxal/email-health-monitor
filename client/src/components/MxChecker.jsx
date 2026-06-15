import { useState, useRef } from 'react'

function RiskBadge({ risk }) {
  const colors = {
    low: 'text-[#00ff88] border-[#00ff88]',
    medium: 'text-[#ffcc00] border-[#ffcc00]',
    high: 'text-[#ff3355] border-[#ff3355]',
    unknown: 'text-[#555] border-[#555]',
  }
  return (
    <span className={`text-[10px] px-2 py-0.5 border tracking-wider ${colors[risk] || colors.unknown}`}
      style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
      {risk}
    </span>
  )
}

export default function MxChecker() {
  const [results, setResults] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  const fileInputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file) return
    const text = await file.text()
    setStatus(`PROCESSING ${file.name}...`)
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/mx/lookup-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: text }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResults(data.results || [])
      setSummary(data.summary)
      setStatus(`${data.total} DOMAINS · ${data.summary?.high || 0} BLOCKED · ${data.summary?.low || 0} SAFE`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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

  const handlePaste = async () => {
    const text = prompt('PASTE DOMAINS (comma-separated):')
    if (!text) return
    const domains = text.split(',').map(s => s.trim()).filter(Boolean)
    if (domains.length === 0) return

    setLoading(true); setError(null); setStatus(`CHECKING ${domains.length} DOMAINS...`)
    try {
      const res = await fetch('/api/mx/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: domains.map(d => ({ domain: d })) }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResults(data.results || [])
      setSummary(data.summary)
      setStatus(`${data.total} DOMAINS CHECKED`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = () => {
    if (results.length === 0) return
    const header = 'domain,company,provider,risk,mx_records,recommendation\n'
    const rows = results.map(r => {
      const mx = (r.mxRecords || []).join('; ')
      const prov = (r.providers || []).join('; ')
      const rec = r.risk === 'high' ? 'use linkedin/phone' : r.risk === 'medium' ? 'test low volume' : r.risk === 'low' ? 'cold email ok' : 'test first'
      return `"${r.domain}","${r.company}","${prov}","${r.risk}","${mx}","${rec}"`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `mx-firewall-scan-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const riskOrder = { low: 0, medium: 1, high: 2, unknown: 3 }
  const sortedResults = [...results].sort((a, b) => (riskOrder[b.risk] || 0) - (riskOrder[a.risk] || 0))

  return (
    <div>
      {/* Limits info bar */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-6 text-[10px] text-[#555] tracking-wider">
        <span>⚡ BATCH 5 (parallel)</span>
        <span>⊘ MAX 500/REQ</span>
        <span>⏱ 100 LOOKUPS/15M</span>
        <span>◈ 40+ PROVIDERS</span>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="chrome-border p-8 mb-6 text-center cursor-pointer transition-colors hover:border-[#2a2a2a]"
        style={{ background: 'var(--chromium-surface)' }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
        <p className="text-[#a0a0a0] text-sm mb-2 tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>DROP CSV</p>
        <p className="text-[10px] text-[#555] tracking-wider">columns: domain / website / company website</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={handlePaste} className="chrome-button px-4 py-2 text-xs">◈ PASTE</button>
        {results.length > 0 && (
          <button onClick={exportCSV} className="chrome-button px-4 py-2 text-xs">⬇ EXPORT</button>
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
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px mb-6" style={{ background: 'var(--chromium-border)' }}>
          {[
            { label: 'TOTAL', value: summary.low + summary.medium + summary.high + summary.unknown, color: 'text-[#d4d4d4]' },
            { label: 'SAFE', value: summary.low || 0, color: 'text-[#00ff88]' },
            { label: 'BLOCKED', value: summary.high || 0, color: summary.high > 0 ? 'text-[#ff3355]' : 'text-[#ff3355]' },
            { label: 'UNKNOWN', value: summary.unknown || 0, color: 'text-[#555]' },
          ].map(s => (
            <div key={s.label} className="p-4" style={{ background: 'var(--chromium-surface)' }}>
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
                  <th className="text-left px-4 py-3 font-medium">RISK</th>
                  <th className="text-left px-4 py-3 font-medium">DOMAIN</th>
                  <th className="text-left px-4 py-3 font-medium">FIREWALL</th>
                  <th className="text-left px-4 py-3 font-medium">MX RECORDS</th>
                  <th className="text-left px-4 py-3 font-medium">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r, i) => (
                  <tr
                    key={i}
                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                    className="border-b border-[#1a1a1a]/50 cursor-pointer transition-colors hover:bg-white/[0.02]"
                    style={r.risk === 'high' ? { background: 'rgba(255,51,85,0.03)' } : r.risk === 'medium' ? { background: 'rgba(255,204,0,0.03)' } : {}}
                  >
                    <td className="px-4 py-3"><RiskBadge risk={r.risk} /></td>
                    <td className="px-4 py-3 font-medium text-[#d4d4d4]">{r.domain}</td>
                    <td className="px-4 py-3">
                      <span className={r.risk === 'high' ? 'text-[#ff3355]' : r.risk === 'medium' ? 'text-[#ffcc00]' : r.risk === 'low' ? 'text-[#00ff88]' : 'text-[#555]'}>
                        {(r.providers || []).join(', ') || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#555] truncate-mx">{(r.mxRecords || []).join(', ') || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] tracking-wider ${
                        r.risk === 'high' ? 'text-[#ff3355]' : r.risk === 'medium' ? 'text-[#ffcc00]' : r.risk === 'low' ? 'text-[#00ff88]' : 'text-[#555]'
                      }`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                        {r.risk === 'high' ? 'AVOID EMAIL' : r.risk === 'medium' ? 'TEST FIRST' : r.risk === 'low' ? 'EMAIL OK' : 'UNKNOWN'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between text-[10px] text-[#333] px-4 py-2 border-t border-[#1a1a1a] tracking-wider">
            <span>{sortedResults.length} RESULTS · CLICK FOR DETAILS · WORST FIRST</span>
            <span>MAX 500/BATCH</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !loading && (
        <div className="chrome-surface text-center py-16">
          <p className="text-[#555] text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>MX FIREWALL SCANNER</p>
          <p className="text-[#333] text-xs">upload CSV or paste domains to scan</p>
        </div>
      )}
    </div>
  )
}
