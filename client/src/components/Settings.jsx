import { useState, useEffect } from 'react'

const PROVIDERS = [
  { id: 'instantly', name: 'INSTANTLY', baseUrl: 'https://api.instantly.ai/api/v1' },
  { id: 'smartlead', name: 'SMARTLEAD', baseUrl: 'https://server.smartlead.ai/api/v1' },
]

export default function Settings({ settings, onSave }) {
  const [provider, setProvider] = useState(settings.provider || 'instantly')
  const [apiKey, setApiKey] = useState(settings.apiKey || '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setProvider(settings.provider || 'instantly')
    setApiKey(settings.apiKey || '')
  }, [settings])

  const handleSave = () => {
    onSave({ provider, apiKey })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/accounts', {
        headers: { 'x-provider': provider, 'x-api-key': apiKey }
      })
      const data = await res.json()
      if (data.error) {
        setTestResult({ ok: false, message: data.error })
      } else {
        setTestResult({ ok: true, message: `${data.accounts?.length || 0} ACCOUNTS FOUND` })
      }
    } catch (err) {
      setTestResult({ ok: false, message: err.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-2">
      <div className="chrome-surface p-4 md:p-6">
        <h2 className="text-sm tracking-[0.12em] text-[var(--tx-primary)] mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>PROVIDER CONFIG</h2>
        <p className="text-[10px] text-[var(--tx-muted)] mb-6 tracking-wider">connect your email sending platform</p>

        <div className="space-y-5">
          <div>
            <label className="block text-[10px] text-[var(--tx-muted)] mb-1.5 tracking-wider uppercase">Provider</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className="chrome-input w-full px-4 py-2.5 text-xs uppercase tracking-wider"
            >
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-[var(--tx-dim)] text-[10px] mt-1.5 tracking-wider">{PROVIDERS.find(p => p.id === provider)?.baseUrl}</p>
          </div>

          <div>
            <label className="block text-[10px] text-[var(--tx-muted)] mb-1.5 tracking-wider uppercase">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="ENTER API KEY..."
              className="chrome-input w-full px-4 py-2.5 text-xs uppercase tracking-wider"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!apiKey}
              className="chrome-button px-5 py-2.5 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saved ? 'SAVED' : 'SAVE'}
            </button>

            <button
              onClick={testConnection}
              disabled={testing || !apiKey}
              className="chrome-button px-5 py-2.5 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {testing ? 'TESTING...' : 'TEST'}
            </button>
          </div>

          {testResult && (
            <div className={`p-3 text-xs tracking-wider ${
              testResult.ok
                ? 'border border-[var(--safe)] text-[var(--safe)]'
                : 'border border-[var(--danger)] text-[var(--danger)]'
            }`} style={{ background: testResult.ok ? 'rgba(0,255,136,0.04)' : 'rgba(255,51,85,0.04)' }}>
              {testResult.ok ? '◆ ' : '◇ '}{testResult.message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
