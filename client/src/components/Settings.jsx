import { useState, useEffect } from 'react'

const PROVIDERS = [
  { id: 'instantly', name: 'Instantly', baseUrl: 'https://api.instantly.ai/api/v1' },
  { id: 'smartlead', name: 'Smartlead', baseUrl: 'https://server.smartlead.ai/api/v1' },
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
        setTestResult({ ok: true, message: `Connected! ${data.accounts?.length || 0} accounts found` })
      }
    } catch (err) {
      setTestResult({ ok: false, message: err.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Email Provider Settings</h2>
        <p className="text-gray-400 text-sm mb-6">
          Connect your email sending platform to monitor account health.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5 font-medium">Provider</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-emerald-500/50"
            >
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-gray-500 text-xs mt-1.5">
              Base URL: {PROVIDERS.find(p => p.id === provider)?.baseUrl}
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5 font-medium">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your API key..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600 font-mono"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!apiKey}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {saved ? 'Saved!' : 'Save Settings'}
            </button>

            <button
              onClick={testConnection}
              disabled={testing || !apiKey}
              className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:text-gray-600 text-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors border border-gray-700"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {testResult && (
            <div className={`mt-2 p-3 rounded-lg text-sm ${
              testResult.ok
                ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800/50'
                : 'bg-red-900/30 text-red-300 border border-red-800/50'
            }`}>
              {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
