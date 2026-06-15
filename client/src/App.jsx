import { useState, useEffect, useCallback } from 'react'
import StatsBar from './components/StatsBar'
import AlertsPanel from './components/AlertsPanel'
import AccountList from './components/AccountList'
import ChartPanel from './components/ChartPanel'
import HealthGauge from './components/HealthGauge'
import MxChecker from './components/MxChecker'
import Settings from './components/Settings'

const LS_KEY = 'email_monitor_settings'

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : { provider: 'instantly', apiKey: '' }
  } catch { return { provider: 'instantly', apiKey: '' } }
}

function Tab({ active, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 text-sm tracking-wider uppercase transition-all duration-150 glitch-hover ${
        active
          ? 'text-[#00f0ff] chrome-accent-border'
          : 'text-[#555] chrome-border hover:text-[#a0a0a0]'
      }`}
      style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
  )
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
    } catch {
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
    <div className="min-h-screen" style={{ background: 'var(--chromium-bg)' }}>
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl tracking-wider text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              BLACK CHROMIUM
            </h1>
            <p className="text-xs text-[#555] tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              email infrastructure monitor
            </p>
          </div>
          {tab === 'health' && (
            <div className="flex items-center gap-3">
              {criticalCount > 0 && (
                <span className="chrome-chip bg-red-950/30 text-[#ff3355] border-[#ff3355] animate-pulse">
                  {criticalCount} critical
                </span>
              )}
              {banned > 0 && (
                <span className="chrome-chip bg-purple-950/30 text-[#b366ff] border-[#b366ff] animate-pulse">
                  {banned} banned
                </span>
              )}
              {settings.apiKey && (
                <span className="text-[#333] text-xs">
                  {accounts.length} acc · {lastFetch ? new Date(lastFetch).toLocaleTimeString() : '—'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          <Tab active={tab === 'health'} label="Health" icon="◆" onClick={() => setTab('health')} />
          <Tab active={tab === 'mx'} label="Firewall" icon="◈" onClick={() => setTab('mx')} />
          <Tab active={tab === 'settings'} label="Config" icon="◇" onClick={() => setTab('settings')} />
        </div>

        {/* Content */}
        {tab === 'health' ? (
          settings.apiKey ? (
            loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-5 h-5 border border-[#00f0ff] animate-spin" style={{ boxShadow: '0 0 12px rgba(0,240,255,0.15)' }} />
              </div>
            ) : error ? (
              <div className="chrome-surface p-8 max-w-lg mx-auto text-center">
                <p className="text-[#ff3355] text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>CONNECTION FAILURE</p>
                <p className="text-[#555] text-xs mb-6">{error}</p>
                <button onClick={fetchData} className="chrome-button px-6 py-2 text-sm">RETRY</button>
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
                  <input type="text" placeholder="SEARCH EMAIL..." value={search} onChange={e => setSearch(e.target.value)}
                    className="chrome-input px-4 py-2 w-64 text-xs uppercase tracking-wider" />
                  {['all', 'healthy', 'warning', 'poor', 'critical'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`chrome-chip cursor-pointer transition-colors ${
                        filter === f
                          ? f === 'healthy' ? 'text-[#00ff88] border-[#00ff88] bg-green-950/20'
                            : f === 'warning' ? 'text-[#ffcc00] border-[#ffcc00] bg-yellow-950/20'
                            : f === 'poor' ? 'text-[#ff8800] border-[#ff8800] bg-orange-950/20'
                            : f === 'critical' ? 'text-[#ff3355] border-[#ff3355] bg-red-950/20'
                            : 'text-[#a0a0a0] border-[#2a2a2a] bg-transparent'
                          : 'text-[#555] border-[#1a1a1a] bg-transparent hover:text-[#a0a0a0] hover:border-[#2a2a2a]'
                      }`}>
                      {f}
                    </button>
                  ))}
                  <button onClick={fetchData} className="text-[#333] text-xs hover:text-[#555] transition-colors ml-auto uppercase tracking-wider">↻ refresh</button>
                </div>
                <AccountList accounts={filteredAccounts} />
              </>
            )
          ) : (
            <div className="text-center py-24">
              <p className="text-[#555] text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>NO API KEY</p>
              <p className="text-[#333] text-xs mb-6">Configure your provider in Settings</p>
              <button onClick={() => setTab('settings')} className="chrome-button px-6 py-2">CONFIG</button>
            </div>
          )
        ) : tab === 'mx' ? (
          <MxChecker />
        ) : (
          <Settings settings={settings} onSave={saveSettings} />
        )}

        <div className="text-center text-[#1a1a1a] text-xs mt-12 pb-4 tracking-wider">
          BLACK CHROMIUM · v2.0 · {settings.apiKey ? 'POLL 30s' : 'UNCONFIGURED'}
        </div>
      </div>
    </div>
  )
}
