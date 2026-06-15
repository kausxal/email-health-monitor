import { useState } from 'react'

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] tracking-[0.12em] text-[#555] mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{title}</p>
      {children}
    </div>
  )
}

function RecordRow({ label, value, status }) {
  const statusColor = status === 'pass' || status === true ? 'text-[#00ff88]' : status === 'warning' || status === 'softfail' ? 'text-[#ffcc00]' : 'text-[#ff3355]'
  const statusLabel = status === true || status === 'pass' ? 'OK' : status === false || status === 'missing' ? 'MISSING' : typeof status === 'string' ? status.toUpperCase() : ''
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-[#1a1a1a]/30">
      <span className="text-[#a0a0a0] text-xs w-16 shrink-0">{label}</span>
      <span className="text-[#555] text-xs font-mono break-all flex-1">{value || <span className="italic">not found</span>}</span>
      {statusLabel && <span className={`text-[10px] tracking-wider shrink-0 ${statusColor}`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{statusLabel}</span>}
    </div>
  )
}

export default function DnsTools() {
  const [domain, setDomain] = useState('')
  const [dnsResult, setDnsResult] = useState(null)
  const [blResult, setBlResult] = useState(null)
  const [loadingDns, setLoadingDns] = useState(false)
  const [loadingBl, setLoadingBl] = useState(false)
  const [error, setError] = useState(null)

  const checkDns = async () => {
    if (!domain.trim()) return
    setLoadingDns(true); setError(null); setDnsResult(null)
    try {
      const res = await fetch('/api/dns/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: [domain.trim()] }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setDnsResult(data.results?.[0] || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingDns(false)
    }
  }

  const checkBlacklist = async () => {
    if (!domain.trim()) return
    setLoadingBl(true); setError(null); setBlResult(null)
    try {
      const res = await fetch('/api/blacklist/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: [domain.trim()] }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setBlResult(data.results?.[0] || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingBl(false)
    }
  }

  const runAll = () => {
    checkDns()
    checkBlacklist()
  }

  const domainOk = domain.trim().length > 0

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-6 text-[10px] text-[#555] tracking-wider">
        <span>◈ SPF · DKIM · DMARC · DNSBL</span>
        <span>⊘ DNS-OVER-HTTPS</span>
      </div>

      {/* Input */}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="text"
          value={domain}
          onChange={e => setDomain(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runAll()}
          placeholder="domain.com"
          className="flex-1 chrome-surface text-xs text-[#a0a0a0] p-3 outline-none"
          style={{ background: 'var(--chromium-surface)', border: '1px solid var(--chromium-border)' }}
        />
        <button onClick={runAll} disabled={!domainOk || loadingDns || loadingBl} className="chrome-button px-4 py-2 text-xs">◈ CHECK</button>
      </div>

      {loadingDns || loadingBl ? (
        <div className="flex items-center gap-2 text-xs text-[#555]">
          <div className="w-3 h-3 border border-[#00f0ff] animate-spin" style={{ boxShadow: '0 0 6px rgba(0,240,255,0.1)' }} />
          CHECKING...
        </div>
      ) : null}

      {error && <p className="text-xs text-[#ff3355] mb-4">{error}</p>}

      {/* DNS Auth Results */}
      {dnsResult && (
        <div className="chrome-surface p-4 mb-4">
          <Section title={`AUTHENTICATION — ${dnsResult.domain}`}>
            <RecordRow label="SPF" value={dnsResult.spf?.raw} status={dnsResult.spf?.status || 'missing'} />
            <RecordRow label="DKIM" value={dnsResult.dkim?.found ? `${dnsResult.dkim.selector}._domainkey` : null} status={dnsResult.dkim?.found || false} />
            <RecordRow label="DMARC" value={dnsResult.dmarc?.raw} status={dnsResult.dmarc?.policy === 'reject' ? 'pass' : dnsResult.dmarc?.policy === 'quarantine' ? 'warning' : dnsResult.dmarc?.status || 'missing'} />
          </Section>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-[#555] tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>STATUS:</span>
            {dnsResult.spf?.status === 'pass' && dnsResult.dkim?.found && dnsResult.dmarc?.policy === 'reject' ? (
              <span className="text-[10px] text-[#00ff88]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>FULLY AUTHENTICATED</span>
            ) : dnsResult.spf?.status === 'missing' && !dnsResult.dkim?.found && dnsResult.dmarc?.status === 'missing' ? (
              <span className="text-[10px] text-[#ff3355]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>NO AUTHENTICATION</span>
            ) : (
              <span className="text-[10px] text-[#ffcc00]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>PARTIAL</span>
            )}
          </div>
        </div>
      )}

      {/* Blacklist Results */}
      {blResult && (
        <div className="chrome-surface p-4">
          <Section title={`BLACKLIST — ${blResult.domain}`}>
            {blResult.ips?.length > 0 ? (
              <div className="text-xs text-[#555] mb-2">IPs: {blResult.ips.join(', ')}</div>
            ) : (
              <div className="text-xs text-[#555] mb-2">no A records found</div>
            )}
            {blResult.listed ? (
              <div>
                <p className="text-[10px] text-[#ff3355] mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>LISTED ON {blResult.checks.length} BLACKLIST(S)</p>
                {blResult.checks.map((c, i) => (
                  <div key={i} className="text-[10px] text-[#ff3355] mb-1">{c.ip} → {c.blacklist}</div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#00ff88]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>NOT LISTED</span>
                <span className="text-[10px] text-[#555]">({6} DNSBLs checked)</span>
              </div>
            )}
          </Section>
        </div>
      )}

      {/* Empty State */}
      {!dnsResult && !blResult && !loadingDns && !loadingBl && !error && (
        <div className="chrome-surface text-center py-16">
          <p className="text-[#555] text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>DNS TOOLS</p>
          <p className="text-[#333] text-xs">check SPF, DKIM, DMARC records and DNS blacklists for any domain</p>
        </div>
      )}
    </div>
  )
}
