import { useState, useEffect, useCallback } from 'react'
import StatsBar from './components/StatsBar'
import AlertsPanel from './components/AlertsPanel'
import AccountList from './components/AccountList'
import ChartPanel from './components/ChartPanel'
import HealthGauge from './components/HealthGauge'
import MxChecker from './components/MxChecker'
import Settings from './components/Settings'

function TabButton({ active, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 shadow-lg shadow-emerald-900/20'
          : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600 hover:text-gray-300'
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}

const LS_KEY = 'email_monitor_settings'

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : { provider: 'instantly', apiKey: '' }
  } catch { return { provider: 'instantly', apiKey: '' } }
}

export default function App() {
  const [tab, setTab] = useState('health')
  const [accounts, setAccounts] = useState([])
  const [alerts, setAlerts] = useState([])
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [settings, setSettings] = useState(loadSettings)

  const headers = {
    'x-provider': settings.provider,
    'x-api-key': settings.apiKey,
  }

  const fetchData = useCallback(async () => {
    if (!settings.apiKey) { setLoading(false); return }
    try {
      const [accRes, alertRes, histRes, statRes] = await Promise.all([
        fetch('/api/accounts', { headers }),
        fetch('/api/alerts', { headers }),
        fetch('/api/history', { headers }),
        fetch('/api/stats', { headers }),
      ])
      const accData = await accRes.json()
      const alertData = await alertRes.json()
      const histData = await histRes.json()
      const statData = await statRes.json()

      if (accData.accounts) setAccounts(accData.accounts)
      if (alertData.alerts) setAlerts(alertData.alerts)
      if (histData.history) setHistory(histData.history)
      if (statData) setStats(statData)
      if (accData.lastFetch) setLastFetch(accData.lastFetch)
      setError(null)
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [settings.apiKey, settings.provider])

  useEffect(() => {
    fetchData()
    if (!settings.apiKey) return
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData, settings.apiKey])

  const saveSettings = (newSettings) => {
    setSettings(newSettings)
    localStorage.setItem(LS_KEY, JSON.stringify(newSettings))
    setLoading(true)
  }

  const filteredAccounts = accounts.filter(a => {
    if (filter !== 'all' && a.health_label !== filter) return false
    if (search && !a.email.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const criticalCount = accounts.filter(a => a.health_label === 'critical').length
  const banned = accounts.filter(a => a.warmup_status === 'banned').length

  return (
    <div className="min-h-screen bg-gray-950 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Email Infrastructure Monitor</h1>
            <p className="text-sm text-gray-500">
              {tab === 'health'
                ? settings.apiKey
                  ? `${accounts.length} accounts · Last poll: ${lastFetch ? new Date(lastFetch).toLocaleTimeString() : 'never'}`
                  : 'Configure API key in Settings'
                : tab === 'mx'
                  ? 'Check if company domains use email firewalls that block cold email'
                  : 'Configure your email provider API key'}
              {tab === 'health' && settings.apiKey && (
                <button onClick={fetchData} className="ml-3 text-emerald-500 hover:text-emerald-400 text-xs underline">refresh</button>
              )}
            </p>
          </div>
          {tab === 'health' && (
            <div className="flex items-center gap-3">
              {criticalCount > 0 && (
                <span className="animate-pulse bg-red-900/50 text-red-300 text-xs px-3 py-1.5 rounded-full font-medium border border-red-800">
                  {criticalCount} critical
                </span>
              )}
              {banned > 0 && (
                <span className="animate-pulse bg-purple-900/50 text-purple-300 text-xs px-3 py-1.5 rounded-full font-medium border border-purple-800">
                  {banned} banned
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          <TabButton active={tab === 'health'} label="Health Monitor" icon="❤️" onClick={() => setTab('health')} />
          <TabButton active={tab === 'mx'} label="MX Firewall Checker" icon="🛡️" onClick={() => setTab('mx')} />
          <TabButton active={tab === 'settings'} label="Settings" icon="⚙️" onClick={() => setTab('settings')} />
        </div>

        {tab === 'health' ? (
          settings.apiKey ? (
            loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="bg-gray-900 border border-red-800 rounded-xl p-8 max-w-md mx-auto text-center">
                <div className="text-4xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-red-400 mb-2">Connection Error</h2>
                <p className="text-gray-400 mb-6">{error}</p>
                <button onClick={fetchData} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">Retry</button>
              </div>
            ) : (
              <>
                {stats && <StatsBar stats={stats} />}
                <HealthGauge accounts={accounts} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <AlertsPanel alerts={alerts} />
                  <div className="lg:col-span-2">
                    <ChartPanel history={history} />
                  </div>
                </div>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <input type="text" placeholder="Search email..." value={search} onChange={e => setSearch(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 w-64 focus:outline-none focus:border-emerald-500/50 placeholder-gray-600" />
                  {['all', 'healthy', 'warning', 'poor', 'critical'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                        filter === f
                          ? f === 'healthy' ? 'bg-green-900/50 text-green-300 border border-green-700'
                            : f === 'warning' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
                            : f === 'poor' ? 'bg-orange-900/50 text-orange-300 border border-orange-700'
                            : f === 'critical' ? 'bg-red-900/50 text-red-300 border border-red-700'
                            : 'bg-gray-800 text-gray-200 border border-gray-700'
                          : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600'
                      }`}>
                      {f}
                    </button>
                  ))}
                </div>
                <AccountList accounts={filteredAccounts} />
              </>
            )
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg mb-4">No API key configured</p>
              <p className="text-gray-600 text-sm mb-6">Go to Settings to connect your email provider.</p>
              <button onClick={() => setTab('settings')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">Open Settings</button>
            </div>
          )
        ) : tab === 'mx' ? (
          <MxChecker />
        ) : (
          <Settings settings={settings} onSave={saveSettings} />
        )}

        <div className="text-center text-gray-700 text-xs mt-8 pb-4">
          Email Infrastructure Monitor · {settings.apiKey ? 'Polls every 30s' : 'Configure API key in Settings'}
        </div>
      </div>
    </div>
  )
}
