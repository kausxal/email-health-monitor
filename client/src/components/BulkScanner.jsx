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

function Section({ title, children }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] tracking-[0.12em] text-[#555] mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{title}</p>
      {children}
    </div>
  )
}

function DetailRow({ label, value, status }) {
  const sc = status === 'pass' || status === true || status === 'OK' ? 'text-[#00ff88]'
    : status === 'warning' || status === 'softfail' || status === 'quarantine' || status === 'neutral' ? 'text-[#ffcc00]'
    : status === 'missing' || status === false || status === 'none' || status === 'poor' ? 'text-[#ff3355]'
    : 'text-[#555]'
  const sl = status === true ? 'OK' : status === false ? 'MISSING' : typeof status === 'string' ? status.toUpperCase() : ''
  return (
    <div className="flex items-start gap-3 py-1 border-b border-[#1a1a1a]/20">
      <span className="text-[#a0a0a0] text-[10px] w-16 shrink-0">{label}</span>
      <span className="text-[#555] text-[10px] font-mono break-all flex-1">{value || <span className="italic">—</span>}</span>
      {sl && <span className={`text-[10px] tracking-wider shrink-0 ${sc}`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{sl}</span>}
    </div>
  )
}

function ExpandedDetail({ r }) {
  if (!r.domain) return (
    <div className="px-4 py-3 text-[10px] text-[#ff3355]">no domain found for this company</div>
  )

  return (
    <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Section title="MX FIREWALL">
          <DetailRow label="Risk" value={r.mxRisk} status={r.mxRisk} />
          <DetailRow label="Provider" value={r.mxDetail?.providers?.join(', ') || '—'} />
          <DetailRow label="MX Count" value={r.mxDetail?.mxCount != null ? String(r.mxDetail.mxCount) : '—'} />
          {r.mxDetail?.mxRecords?.map((rec, i) => (
            <DetailRow key={i} label={`MX ${i+1}`} value={rec} />
          ))}
        </Section>
      </div>
      <div>
        <Section title="DNS AUTHENTICATION">
          <DetailRow label="SPF" value={r.dnsAuth?.spf?.raw} status={r.dnsAuth?.spf?.status || 'missing'} />
          <DetailRow label="DKIM" value={r.dnsAuth?.dkim?.found ? `${r.dnsAuth.dkim.selector}._domainkey` : null} status={r.dnsAuth?.dkim?.found || false} />
          <DetailRow label="DMARC" value={r.dnsAuth?.dmarc?.raw} status={r.dnsAuth?.dmarc?.policy || 'missing'} />
        </Section>
        <Section title="BLACKLIST">
          {r.blacklist?.listed ? (
            r.blacklist.checks.map((c, i) => (
              <DetailRow key={i} label={`BL ${i+1}`} value={`${c.ip} → ${c.blacklist}`} status="poor" />
            ))
          ) : (
            <DetailRow label="Status" value="not listed on any DNSBL" status={true} />
          )}
        </Section>
        <Section title="RECOMMENDATION">
          <p className={`text-[10px] tracking-wider ${
            r.deliverability?.level === 'good' ? 'text-[#00ff88]' :
            r.deliverability?.level === 'moderate' ? 'text-[#ffcc00]' : 'text-[#ff3355]'
          }`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            {r.deliverability?.level === 'good' ? 'EMAIL SAFE — send cold campaigns' :
             r.deliverability?.level === 'moderate' ? 'TEST FIRST — low volume, monitor bounces' :
             r.deliverability?.level === 'poor' ? 'AVOID EMAIL — use LinkedIn / phone outreach' :
             'INSUFFICIENT DATA'}
          </p>
        </Section>
      </div>
    </div>
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
    const lines = text.split('\n').filter(Boolean)
    const domains = lines.map(l => {
      const cols = l.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      return cols[1] || cols[0]
    }).filter(Boolean)
    setInput(domains.join('\n'))
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

  const singleLookup = async () => {
    const d = input.trim()
    if (!d) return
    setInput(`acme corp\nstripe\nstripe.com`)
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
    const header = 'name,domain,mx_risk,mx_provider,mx_count,dns_spf,dns_dkim,dns_dmarc,blacklisted,deliverability_score,deliverability_level,signals\n'
    const rows = results.map(r => {
      const prov = r.mxDetail?.providers?.join('; ') || ''
      return [
        `"${r.name}"`, `"${r.domain}"`, r.mxRisk || '',
        `"${prov}"`, r.mxDetail?.mxCount ?? '', r.dnsAuth?.spf?.status || '',
        r.dnsAuth?.dkim?.found ? 'OK' : '', r.dnsAuth?.dmarc?.policy || '',
        r.blacklist?.listed ? 'YES' : '', r.deliverability?.score ?? '',
        r.deliverability?.level || '', `"${(r.deliverability?.signals || []).join('; ')}"`
      ].join(',')
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
        <span>⚡ COMPANY NAMES → DOMAINS → MX + SPF/DKIM/DMARC + BLACKLIST + SCORE</span>
        <span>⊘ MAX 100/REQ</span>
        <span>⏱ 30 SCANS/15M</span>
      </div>

      {/* Input area */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="chrome-border p-6 mb-4 text-center cursor-pointer transition-colors hover:border-[#2a2a2a]"
        style={{ background: 'var(--chromium-surface)' }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
        <p className="text-[#a0a0a0] text-sm mb-2 tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>ENTER COMPANY NAMES OR DOMAINS</p>
        <p className="text-[10px] text-[#555] tracking-wider">one per line · auto-detects domains vs company names · or drop CSV</p>
      </div>

      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={`acme corp\nstripe\nstripe.com → auto-detected as domain`}
        className="w-full h-28 chrome-surface text-xs text-[#a0a0a0] p-3 mb-4 resize-none outline-none"
        style={{ background: 'var(--chromium-surface)', border: '1px solid var(--chromium-border)' }}
      />

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
            { label: 'EMAIL SAFE', value: results.filter(r => r.deliverability?.level === 'good').length, color: 'text-[#00ff88]', key: 'good' },
            { label: 'AVOID EMAIL', value: results.filter(r => r.deliverability?.level === 'poor').length, color: 'text-[#ff3355]', key: 'poor' },
          ].map(s => (
            <div key={s.key} className="p-4" style={{ background: 'var(--chromium-surface)' }}>
              <p className="text-[10px] tracking-[0.12em] text-[#555] mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{s.label}</p>
              <p className={`text-2xl ${s.color}`} style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {sortedResults.length > 0 && (
        <div className="chrome-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#555] text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">SCORE</th>
                  <th className="text-left px-4 py-3 font-medium">COMPANY</th>
                  <th className="text-left px-4 py-3 font-medium">DOMAIN</th>
                  <th className="text-left px-4 py-3 font-medium">FIREWALL</th>
                  <th className="text-left px-4 py-3 font-medium">SPF</th>
                  <th className="text-left px-4 py-3 font-medium">DKIM</th>
                  <th className="text-left px-4 py-3 font-medium">DMARC</th>
                  <th className="text-left px-4 py-3 font-medium">BL</th>
                  <th className="text-left px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r, i) => (
                  <>
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
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[10px] tracking-wider ${
                            r.mxRisk === 'high' ? 'text-[#ff3355]' : r.mxRisk === 'medium' ? 'text-[#ffcc00]' : r.mxRisk === 'low' ? 'text-[#00ff88]' : 'text-[#555]'
                          }`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                            {r.mxRisk || '—'}
                          </span>
                          <span className="text-[9px] text-[#555] max-w-[120px] truncate" title={(r.mxDetail?.providers || []).join(', ')}>
                            {(r.mxDetail?.providers || []).join(', ') || ''}
                          </span>
                        </div>
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
                        <span className={`text-[10px] ${r.blacklist?.listed ? 'text-[#ff3355]' : 'text-[#555]'}`}
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
                            title="add to watchlist"
                          >
                            +
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedRow === i && (
                      <tr key={`${i}-detail`}>
                        <td colSpan={9} className="p-0" style={{ background: 'rgba(0,0,0,0.15)' }}>
                          <ExpandedDetail r={r} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-[#333] px-4 py-2 border-t border-[#1a1a1a] tracking-wider">
            click any row for full MX records, SPF/DKIM/DMARC text, blacklist IPs & recommendation
          </div>
        </div>
      )}

      {results.length === 0 && !loading && (
        <div className="chrome-surface text-center py-16">
          <p className="text-[#555] text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>TARGET SCANNER</p>
          <p className="text-[#333] text-xs">one place for every signal: MX firewall + SPF/DKIM/DMARC + blacklist + deliverability score</p>
        </div>
      )}
    </div>
  )
}
