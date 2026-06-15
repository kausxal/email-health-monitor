import { useState, useRef, Fragment } from 'react'

function Badge({ label, color }) {
  const pct = parseInt(label)
  return (
    <span className={`text-[10px] px-2 py-0.5 border tracking-wider ${
      color === 'good' ? 'text-[var(--safe)] border-[var(--safe)]' :
      color === 'moderate' ? 'text-[var(--warn)] border-[var(--warn)]' :
      color === 'poor' ? 'text-[var(--danger)] border-[var(--danger)]' :
      'text-[var(--tx-muted)] border-[var(--tx-muted)]'
    }`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
      {!isNaN(pct) ? `${pct}%` : label}
    </span>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] tracking-[0.12em] text-[var(--tx-muted)] mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{title}</p>
      {children}
    </div>
  )
}

function DetailRow({ label, value, status }) {
  const sc = status === 'pass' || status === true || status === 'OK' ? 'text-[var(--safe)]'
    : status === 'warning' || status === 'softfail' || status === 'quarantine' || status === 'neutral' ? 'text-[var(--warn)]'
    : status === 'missing' || status === false || status === 'none' || status === 'poor' ? 'text-[var(--danger)]'
    : 'text-[var(--tx-muted)]'
  const sl = status === true ? 'OK' : status === false ? 'MISSING' : typeof status === 'string' ? status.toUpperCase() : ''
  return (
    <div className="flex items-start gap-3 py-1 border-b border-[var(--border)]/20">
      <span className="text-[var(--tx-secondary)] text-[10px] w-16 shrink-0">{label}</span>
      <span className="text-[var(--tx-muted)] text-[10px] font-mono break-all flex-1">{value || <span className="italic">—</span>}</span>
      {sl && <span className={`text-[10px] tracking-wider shrink-0 ${sc}`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{sl}</span>}
    </div>
  )
}

function ExpandedDetail({ r }) {
  if (!r.domain) return (
    <div className="px-4 py-3 text-[10px] text-[var(--danger)]">no domain found for this company</div>
  )
  return (
    <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Section title="MX FIREWALL">
          <DetailRow label="Risk" value={r.mxRisk} status={r.mxRisk} />
          <DetailRow label="Provider" value={r.mxDetail?.providers?.join(', ') || '—'} />
          <DetailRow label="MX Count" value={r.mxDetail?.mxCount != null ? String(r.mxDetail.mxCount) : '—'} />
          {r.mxDetail?.mxRecords?.map((rec, i) => <DetailRow key={i} label={`MX ${i+1}`} value={rec} />)}
        </Section>
      </div>
      <div>
        <Section title="DNS AUTHENTICATION">
          <DetailRow label="SPF" value={r.dnsAuth?.spf?.raw} status={r.dnsAuth?.spf?.status || 'missing'} />
          <DetailRow label="DKIM" value={r.dnsAuth?.dkim?.found ? `${r.dnsAuth.dkim.selector}._domainkey` : null} status={r.dnsAuth?.dkim?.found || false} />
          <DetailRow label="DMARC" value={r.dnsAuth?.dmarc?.raw} status={r.dnsAuth?.dmarc?.policy || 'missing'} />
        </Section>
        <Section title="BLACKLIST">
          {r.blacklist?.listed ? r.blacklist.checks.map((c, i) => <DetailRow key={i} label={`BL ${i+1}`} value={`${c.ip} → ${c.blacklist}`} status="poor" />)
            : <DetailRow label="Status" value="not listed on any DNSBL" status={true} />}
        </Section>
        <Section title="LANDING PROBABILITY">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-lg ${r.deliverability?.level === 'good' ? 'text-[var(--safe)]' : r.deliverability?.level === 'moderate' ? 'text-[var(--warn)]' : 'text-[var(--danger)]'}`}
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>
              {r.deliverability?.score || '?'}%
            </span>
            <span className="text-[10px] text-[var(--tx-muted)]">chance your email lands</span>
          </div>
          <p className={`text-[10px] tracking-wider ${r.deliverability?.level === 'good' ? 'text-[var(--safe)]' : r.deliverability?.level === 'moderate' ? 'text-[var(--warn)]' : 'text-[var(--danger)]'}`}
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            {r.deliverability?.level === 'good' ? 'HIGH CHANCE — send cold campaigns' :
             r.deliverability?.level === 'moderate' ? 'MODERATE RISK — test low volume first' :
             r.deliverability?.level === 'poor' ? 'HIGH RISK — use LinkedIn / phone outreach' :
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
    setLoading(true); setError(null); setStatus(`SCANNING ${lines.length} ITEMS (5 AT A TIME)...`)

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
    const header = 'name,domain,mx_risk,mx_provider,channel,landing_probability,dns_spf,dns_dkim,dns_dmarc,blacklisted,recommendation\n'
    const rows = results.map(r => {
      const prov = r.mxDetail?.providers?.join('; ') || ''
      const ch = r.deliverability?.level === 'good' ? 'EMAIL' : r.deliverability?.level === 'moderate' ? 'TEST' : r.deliverability?.level === 'poor' ? 'LINKEDIN' : '—'
      const rec = r.deliverability?.level === 'good' ? 'send cold campaigns' : r.deliverability?.level === 'moderate' ? 'test low volume' : r.deliverability?.level === 'poor' ? 'use LinkedIn/phone' : '—'
      return [
        `"${r.name}"`, `"${r.domain}"`, r.mxRisk || '', `"${prov}"`, ch,
        `${r.deliverability?.score ?? ''}%`, r.dnsAuth?.spf?.status || '',
        r.dnsAuth?.dkim?.found ? 'OK' : '', r.dnsAuth?.dmarc?.policy || '',
        r.blacklist?.listed ? 'YES' : '', rec,
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
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-6 text-[10px] text-[var(--tx-muted)] tracking-wider">
        <span>⚡ 5 PARALLEL · MX + DNS + BLACKLIST PER ITEM</span>
        <span>⊘ MAX 100/REQ</span>
        <span>⏱ 30 SCANS/15M</span>
      </div>

      <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
        className="chrome-border p-4 md:p-6 mb-4 text-center cursor-pointer transition-colors hover:border-[var(--border-active)]"
        style={{ background: 'var(--surface)' }} onClick={() => fileInputRef.current?.click()}>
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
        <p className="text-[var(--tx-secondary)] text-xs md:text-sm mb-2 tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>ENTER COMPANY NAMES OR DOMAINS</p>
        <p className="text-[10px] text-[var(--tx-muted)] tracking-wider">one per line · auto-detects domains vs company names · or drop CSV</p>
      </div>

      <textarea value={input} onChange={e => setInput(e.target.value)}
        placeholder={`acme corp\nstripe\nstripe.com → auto-detected as domain`}
        className="w-full h-24 md:h-28 chrome-surface text-xs text-[var(--tx-secondary)] p-3 mb-4 resize-none outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />

      <div className="flex items-center gap-3 mb-6">
        <button onClick={runScan} disabled={loading || !input.trim()} className="chrome-button px-4 py-2 text-xs">◈ SCAN</button>
        {results.length > 0 && <button onClick={exportCSV} className="chrome-button px-4 py-2 text-xs">⬇ EXPORT CSV</button>}
        {loading && <div className="flex items-center gap-2 text-xs text-[var(--tx-muted)]">
          <div className="w-3 h-3 border border-[var(--accent)] animate-spin" style={{ boxShadow: '0 0 6px var(--accent-shadow)' }} />
          {status}
        </div>}
        {!loading && status && <span className="text-xs text-[var(--tx-muted)] tracking-wider">{status}</span>}
        {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px mb-6" style={{ background: 'var(--border)' }}>
          {[
            { label: 'TOTAL', value: results.length, color: 'text-[var(--tx-primary)]', key: 'total' },
            { label: 'DOMAINS FOUND', value: results.filter(r => r.domain).length, color: 'text-[var(--safe)]', key: 'found' },
            { label: 'HIGH CHANCE', value: results.filter(r => r.deliverability?.level === 'good').length, color: 'text-[var(--safe)]', key: 'good' },
            { label: 'HIGH RISK', value: results.filter(r => r.deliverability?.level === 'poor').length, color: 'text-[var(--danger)]', key: 'poor' },
          ].map(s => (
            <div key={s.key} className="p-4" style={{ background: 'var(--surface)' }}>
              <p className="text-[10px] tracking-[0.12em] text-[var(--tx-muted)] mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{s.label}</p>
              <p className={`text-2xl ${s.color}`} style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {sortedResults.length > 0 && (
        <div className="chrome-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--tx-muted)] text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">LAND</th>
                  <th className="text-left px-4 py-3 font-medium">COMPANY</th>
                  <th className="text-left px-4 py-3 font-medium hide-mobile">DOMAIN</th>
                  <th className="text-left px-4 py-3 font-medium">FIREWALL</th>
                  <th className="text-left px-4 py-3 font-medium">CHANNEL</th>
                  <th className="text-left px-4 py-3 font-medium hide-mobile">SPF</th>
                  <th className="text-left px-4 py-3 font-medium hide-mobile">DKIM</th>
                  <th className="text-left px-4 py-3 font-medium hide-mobile">DMARC</th>
                  <th className="text-left px-4 py-3 font-medium hide-mobile">BL</th>
                  <th className="text-left px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r, i) => (
                  <Fragment key={i}>
                    <tr onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                      className="border-b border-[var(--border)]/50 cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                      style={r.deliverability?.level === 'poor' ? { background: 'rgba(255,51,85,0.03)' } : r.deliverability?.level === 'moderate' ? { background: 'rgba(255,204,0,0.03)' } : {}}>
                      <td className="px-4 py-3">
                        {r.deliverability ? <Badge label={`${r.deliverability.score}`} color={r.deliverability.level} /> : <span className="text-[var(--tx-muted)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--tx-primary)] max-w-[120px] md:max-w-[160px] truncate">{r.name}</td>
                      <td className="px-4 py-3 text-[var(--tx-secondary)] hide-mobile">{r.domain || <span className="text-[var(--tx-muted)]">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[10px] tracking-wider ${r.mxRisk === 'high' ? 'text-[var(--danger)]' : r.mxRisk === 'medium' ? 'text-[var(--warn)]' : r.mxRisk === 'low' ? 'text-[var(--safe)]' : 'text-[var(--tx-muted)]'}`}
                            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{r.mxRisk || '—'}</span>
                          <span className="text-[9px] text-[var(--tx-muted)] max-w-[100px] md:max-w-[120px] truncate" title={(r.mxDetail?.providers || []).join(', ')}>
                            {(r.mxDetail?.providers || []).join(', ') || ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 border tracking-wider ${r.deliverability?.level === 'good' ? 'text-[var(--safe)] border-[var(--safe)]' : r.deliverability?.level === 'moderate' ? 'text-[var(--warn)] border-[var(--warn)]' : 'text-[var(--danger)] border-[var(--danger)]'}`}
                          style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                          {r.deliverability?.level === 'good' ? 'EMAIL' : r.deliverability?.level === 'moderate' ? 'TEST' : r.deliverability?.level === 'poor' ? 'LINKEDIN' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hide-mobile">
                        <span className={`text-[10px] ${r.dnsAuth?.spf?.status === 'pass' ? 'text-[var(--safe)]' : r.dnsAuth?.spf?.status === 'missing' ? 'text-[var(--danger)]' : 'text-[var(--warn)]'}`}
                          style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{r.dnsAuth?.spf?.status || '—'}</span>
                      </td>
                      <td className="px-4 py-3 hide-mobile">
                        <span className={`text-[10px] ${r.dnsAuth?.dkim?.found ? 'text-[var(--safe)]' : 'text-[var(--danger)]'}`}
                          style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{r.dnsAuth?.dkim?.found ? 'OK' : '—'}</span>
                      </td>
                      <td className="px-4 py-3 hide-mobile">
                        <span className={`text-[10px] ${r.dnsAuth?.dmarc?.policy === 'reject' ? 'text-[var(--safe)]' : r.dnsAuth?.dmarc?.policy === 'none' || !r.dnsAuth?.dmarc ? 'text-[var(--danger)]' : 'text-[var(--warn)]'}`}
                          style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{r.dnsAuth?.dmarc?.policy || '—'}</span>
                      </td>
                      <td className="px-4 py-3 hide-mobile">
                        <span className={`text-[10px] ${r.blacklist?.listed ? 'text-[var(--danger)]' : 'text-[var(--tx-muted)]'}`}
                          style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{r.blacklist?.listed ? 'YES' : '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {r.domain && <button onClick={e => { e.stopPropagation(); addToWatchlist(r.domain, r.name); }}
                          className="text-[10px] text-[var(--tx-muted)] hover:text-[var(--accent)] transition-colors"
                          style={{ fontFamily: "'Bebas Neue', sans-serif" }} title="add to watchlist">+</button>}
                      </td>
                    </tr>
                    {expandedRow === i && (
                      <tr key={`${i}-detail`}><td colSpan={10} className="p-0" style={{ background: 'rgba(0,0,0,0.15)' }}><ExpandedDetail r={r} /></td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-[var(--tx-dim)] px-4 py-2 border-t border-[var(--border)] tracking-wider">
            click any row for details · CHANNEL column shows recommended outreach method
          </div>
        </div>
      )}

      {results.length === 0 && !loading && (
        <div className="chrome-surface text-center py-12 md:py-16">
          <p className="text-[var(--tx-muted)] text-base md:text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>TARGET SCANNER</p>
          <p className="text-[var(--tx-dim)] text-xs">one place for every signal: MX firewall + DNS auth + blacklist + landing probability + channel recommendation</p>
        </div>
      )}
    </div>
  )
}
