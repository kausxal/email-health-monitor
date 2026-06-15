import { useState, useRef } from 'react'

function RiskBadge({ risk }) {
  const colors = {
    low: 'bg-green-900/30 text-green-300 border-green-700/50',
    medium: 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50',
    high: 'bg-red-900/30 text-red-300 border-red-700/50',
    unknown: 'bg-gray-800 text-gray-400 border-gray-700/50',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[risk] || colors.unknown}`}>
      {risk.toUpperCase()}
    </span>
  )
}

function RiskIcon({ risk }) {
  return {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
    unknown: '⚪'
  }[risk] || '⚪'
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
    setStatus(`Processing ${file.name}...`)
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
      setStatus(`Checked ${data.total} domains — ${data.summary?.high || 0} blocked, ${data.summary?.low || 0} safe`)
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
    const text = prompt('Paste comma-separated domains (e.g. google.com, stripe.com):')
    if (!text) return
    const domains = text.split(',').map(s => s.trim()).filter(Boolean)
    if (domains.length === 0) return

    setLoading(true); setError(null); setStatus(`Checking ${domains.length} domains...`)
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
      setStatus(`Checked ${data.total} domains`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = () => {
    if (results.length === 0) return
    const header = 'Domain,Company,MX Records,Provider,Risk,Recommendation\n'
    const rows = results.map(r => {
      const mx = (r.mxRecords || []).join('; ')
      const prov = (r.providers || []).join('; ')
      const rec = r.risk === 'high' ? 'Use LinkedIn/phone instead of cold email'
        : r.risk === 'medium' ? 'Test with low volume first'
        : r.risk === 'low' ? 'Cold email should land normally'
        : 'Unknown - test first'
      return `"${r.domain}","${r.company}","${mx}","${prov}","${r.risk}","${rec}"`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `mx-check-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const riskOrder = { low: 0, medium: 1, high: 2, unknown: 3 }
  const sortedResults = [...results].sort((a, b) => (riskOrder[b.risk] || 0) - (riskOrder[a.risk] || 0))

  const blockedCount = summary?.high || 0
  const safeCount = summary?.low || 0

  return (
    <div>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-gray-700 rounded-xl p-8 mb-6 text-center hover:border-emerald-700/50 transition-colors bg-gray-900/50 cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
        <div className="text-3xl mb-3">📂</div>
        <p className="text-gray-300 font-medium mb-1">Drop a CSV here or click to browse</p>
        <p className="text-xs text-gray-600">CSV should have columns: <code className="text-emerald-500">domain</code>, <code className="text-emerald-500">website</code>, or <code className="text-emerald-500">company website</code></p>
      </div>

      {/* Quick Paste */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={handlePaste} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm border border-gray-700 transition-colors">
          📋 Paste Domains
        </button>
        {results.length > 0 && (
          <button onClick={exportCSV} className="bg-emerald-800 hover:bg-emerald-700 text-emerald-200 px-4 py-2 rounded-lg text-sm border border-emerald-700/50 transition-colors">
            💾 Export CSV
          </button>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            {status}
          </div>
        )}
        {!loading && status && <span className="text-sm text-gray-500">{status}</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: summary.low + summary.medium + summary.high + summary.unknown, color: 'text-gray-200' },
            { label: 'Safe 🟢', value: summary.low || 0, color: 'text-green-400' },
            { label: 'Blocked 🔴', value: summary.high || 0, color: blockedCount > 0 ? 'text-red-400 animate-pulse' : 'text-red-400' },
            { label: 'Unknown ⚪', value: summary.unknown || 0, color: 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Results Table */}
      {sortedResults.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="text-left px-4 py-3 font-medium">Risk</th>
                  <th className="text-left px-4 py-3 font-medium">Domain</th>
                  <th className="text-left px-4 py-3 font-medium">Company</th>
                  <th className="text-left px-4 py-3 font-medium">Detected Provider</th>
                  <th className="text-left px-4 py-3 font-medium">MX Records</th>
                  <th className="text-left px-4 py-3 font-medium">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r, i) => (
                  <tr
                    key={i}
                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                    className={`border-b border-gray-800/50 cursor-pointer transition-colors hover:bg-gray-800/30 ${
                      r.risk === 'high' ? 'bg-red-950/20' : r.risk === 'medium' ? 'bg-yellow-950/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3"><RiskBadge risk={r.risk} /></td>
                    <td className="px-4 py-3 font-medium text-gray-200">{r.domain}</td>
                    <td className="px-4 py-3 text-gray-400">{r.company}</td>
                    <td className="px-4 py-3 text-gray-300">{(r.providers || []).join(', ') || 'None'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                      {(r.mxRecords || []).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${r.risk === 'high' ? 'text-red-400' : r.risk === 'medium' ? 'text-yellow-400' : r.risk === 'low' ? 'text-green-400' : 'text-gray-500'}`}>
                        {r.risk === 'high' ? 'Use LinkedIn/phone' : r.risk === 'medium' ? 'Test low volume' : r.risk === 'low' ? 'Cold email OK' : 'Test first'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-gray-600 px-4 py-2 border-t border-gray-800">
            {sortedResults.length} results · Click a row for details · Sorted by worst risk first
          </div>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !loading && (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="text-4xl mb-4">🛡️</div>
          <p className="text-gray-400 mb-2">No domains checked yet</p>
          <p className="text-xs text-gray-600">Import a CSV or paste domains to check if they use email firewalls</p>
        </div>
      )}
    </div>
  )
}
