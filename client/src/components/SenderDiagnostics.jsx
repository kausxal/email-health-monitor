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
  const [bimi, setBimi] = useState(null)
  const [dmarcXml, setDmarcXml] = useState('')
  const [dmarcResult, setDmarcResult] = useState(null)
  const [dmarcLoading, setDmarcLoading] = useState(false)
  const [dmarcError, setDmarcError] = useState(null)

  const check = async () => {
    if (!domain.trim()) return
    setLoading(true); setError(null); setResult(null); setBimi(null)
    try {
      const [diagRes, bimiRes] = await Promise.all([
        fetch('/api/sender/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: domain.trim() }),
        }),
        fetch('/api/bimi/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: domain.trim() }),
        }),
      ])
      const diag = await diagRes.json()
      if (diag.error) { setError(diag.error); return }

      const bimiData = await bimiRes.json()
      setBimi(bimiData)

      if (bimiData.found) {
        diag.issues.push({
          check: 'bimi', severity: 'good', label: 'BIMI record found',
          detail: bimiData.raw, fix: 'Your BIMI record is set up — branded logo will show in supporting mail clients.',
        })
      } else {
        diag.issues.push({
          check: 'bimi', severity: 'low', label: 'No BIMI record',
          fix: 'Add a BIMI record (default._bimi.yourdomain.com) with your brand logo to improve recognition and trust.',
        })
      }

      setResult(diag)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const parseDmarc = async () => {
    if (!dmarcXml.trim()) return
    setDmarcLoading(true); setDmarcError(null); setDmarcResult(null)
    try {
      const res = await fetch('/api/dmarc/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: dmarcXml.trim() }),
      })
      const data = await res.json()
      if (data.error) { setDmarcError(data.error); return }
      setDmarcResult(data)
    } catch (err) { setDmarcError(err.message) }
    finally { setDmarcLoading(false) }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-6 text-[10px] text-[var(--tx-muted)] tracking-wider">
        <span>◈ SPF · DKIM · DMARC · MX · BLACKLIST · BIMI</span>
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
        SCANNING DOMAIN + BIMI...
      </div>}

      {error && <p className="text-xs text-[var(--danger)] mb-4">{error}</p>}

      {result && (
        <div className="chrome-surface overflow-hidden">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-sm tracking-[0.12em] text-[var(--tx-primary)]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{result.domain}</h2>
              <div className="flex items-center gap-3">
                {bimi?.found && bimi.logoUrl && (
                  <img src={bimi.logoUrl} alt="BIMI logo" className="w-6 h-6 rounded"
                    onError={e => { e.target.style.display = 'none' }} />
                )}
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

      {/* DMARC Report Parser */}
      <div className="mt-8">
        <div className="flex flex-wrap gap-x-6 gap-y-1 mb-4 text-[10px] text-[var(--tx-muted)] tracking-wider">
          <span>◈ DMARC AGGREGATE REPORT PARSER</span>
          <span>⊘ PASTE XML FROM GOOGLE / CLOUDFLARE / VALIMAI.</span>
        </div>

        <textarea value={dmarcXml} onChange={e => setDmarcXml(e.target.value)}
          placeholder={`Paste DMARC aggregate report XML here...\n\nGet these from:\n- Google Postmaster Tools\n- Cloudflare Email Security\n- Valimail / Dmarcian\n- Your DMARC reporting provider\n\nThe parser extracts: sending sources, pass/fail counts, disposition, DKIM/SPF results.`}
          className="w-full h-32 chrome-surface text-xs text-[var(--tx-secondary)] p-3 mb-3 resize-none outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />

        <div className="flex items-center gap-3 mb-4">
          <button onClick={parseDmarc} disabled={dmarcLoading || !dmarcXml.trim()} className="chrome-button px-4 py-2 text-xs">◈ PARSE DMARC XML</button>
          {dmarcLoading && <div className="flex items-center gap-2 text-xs text-[var(--tx-muted)]">
            <div className="w-3 h-3 border border-[var(--accent)] animate-spin" style={{ boxShadow: '0 0 6px var(--accent-shadow)' }} />
            PARSING...
          </div>}
          {dmarcError && <span className="text-xs text-[var(--danger)]">{dmarcError}</span>}
        </div>

        {dmarcResult && (
          <div className="chrome-surface overflow-hidden">
            <div className="p-4 border-b border-[var(--border)]">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-sm tracking-[0.12em] text-[var(--tx-primary)]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {dmarcResult.domain} · {dmarcResult.policy.toUpperCase()} POLICY
                </h2>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-[var(--tx-muted)]">{dmarcResult.orgName}</span>
                  <span className={`${dmarcResult.passRate >= 95 ? 'text-[var(--safe)]' : dmarcResult.passRate >= 80 ? 'text-[var(--warn)]' : 'text-[var(--danger)]'}`}
                    style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>
                    {dmarcResult.passRate}% PASS RATE
                  </span>
                </div>
              </div>
              <div className="flex gap-3 mt-2 flex-wrap text-[10px] text-[var(--tx-muted)]">
                <span>📨 {dmarcResult.totalCount} total emails</span>
                <span className="text-[var(--safe)]">✓ {dmarcResult.passCount} passed</span>
                <span className="text-[var(--danger)]">✗ {dmarcResult.failCount} failed</span>
              </div>
            </div>

            {dmarcResult.bySource?.length > 0 && (
              <div className="p-3 border-b border-[var(--border)]">
                <h3 className="text-[10px] tracking-wider text-[var(--tx-muted)] mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>SENDING SOURCES</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-[var(--tx-muted)] border-b border-[var(--border)]/30">
                        <th className="text-left py-1 pr-2 font-normal">SOURCE IP</th>
                        <th className="text-right px-2 font-normal">TOTAL</th>
                        <th className="text-right px-2 font-normal text-[var(--safe)]">PASS</th>
                        <th className="text-right px-2 font-normal text-[var(--danger)]">FAIL</th>
                        <th className="text-right pl-2 font-normal">RATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dmarcResult.bySource.map((s, i) => (
                        <tr key={i} className="border-b border-[var(--border)]/10 text-[var(--tx-secondary)]">
                          <td className="py-1 pr-2 font-mono">{s.ip}</td>
                          <td className="text-right px-2">{s.total}</td>
                          <td className="text-right px-2 text-[var(--safe)]">{s.pass}</td>
                          <td className="text-right px-2 text-[var(--danger)]">{s.fail}</td>
                          <td className="text-right pl-2">{s.total > 0 ? Math.round(s.pass / s.total * 100) : 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {dmarcResult.records?.length > 0 && (
              <div className="p-3">
                <h3 className="text-[10px] tracking-wider text-[var(--tx-muted)] mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>DETAILED RECORDS</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-[var(--tx-muted)] border-b border-[var(--border)]/30">
                        <th className="text-left py-1 pr-2 font-normal">SOURCE IP</th>
                        <th className="text-right px-2 font-normal">COUNT</th>
                        <th className="text-right px-2 font-normal">DISPOSITION</th>
                        <th className="text-right px-2 font-normal">DKIM</th>
                        <th className="text-right px-2 font-normal">SPF</th>
                        <th className="text-right pl-2 font-normal">HEADER FROM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dmarcResult.records.map((r, i) => (
                        <tr key={i} className="border-b border-[var(--border)]/10 text-[var(--tx-secondary)]">
                          <td className="py-1 pr-2 font-mono">{r.sourceIp}</td>
                          <td className="text-right px-2">{r.count}</td>
                          <td className={`text-right px-2 ${r.disposition === 'reject' ? 'text-[var(--danger)]' : r.disposition === 'quarantine' ? 'text-[var(--warn)]' : 'text-[var(--tx-muted)]'}`}>{r.disposition}</td>
                          <td className={`text-right px-2 ${r.dkim === 'pass' ? 'text-[var(--safe)]' : 'text-[var(--danger)]'}`}>{r.dkim}</td>
                          <td className={`text-right px-2 ${r.spf === 'pass' ? 'text-[var(--safe)]' : 'text-[var(--danger)]'}`}>{r.spf}</td>
                          <td className="text-right pl-2 font-mono">{r.headerFrom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
