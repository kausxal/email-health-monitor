import { useState, useEffect, useCallback } from 'react'
import StatsBar from './components/StatsBar'
import AlertsPanel from './components/AlertsPanel'
import AccountList from './components/AccountList'
import ChartPanel from './components/ChartPanel'
import HealthGauge from './components/HealthGauge'
import BulkScanner from './components/BulkScanner'
import VolumePanel from './components/VolumePanel'
import ContentAnalyzer from './components/ContentAnalyzer'
import ApolloLookup from './components/ApolloLookup'
import SenderDiagnostics from './components/SenderDiagnostics'
import Watchlist from './components/Watchlist'
import Settings from './components/Settings'

const LS_KEY = 'email_monitor_settings'
const THEME_KEY = 'email_monitor_theme'

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : { provider: 'instantly', apiKey: '', apolloApiKey: '' }
  } catch { return { provider: 'instantly', apiKey: '', apolloApiKey: '' } }
}

function loadTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'dark' } catch { return 'dark' }
}

function Tab({ active, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 md:px-5 py-2 text-xs md:text-sm tracking-wider uppercase transition-all duration-150 glitch-hover ${
        active
          ? 'chrome-accent-border text-[var(--accent)]'
          : 'chrome-border text-[var(--tx-muted)] hover:text-[var(--tx-secondary)]'
      }`}
      style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}
    >
      <span className="mr-1.5">{icon}</span>
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
  const [theme, setTheme] = useState(loadTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

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
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8 gap-3">
          <div>
            <h1 className="text-2xl md:text-4xl tracking-wider text-[var(--tx-primary)]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              BLACK CHROMIUM
            </h1>
            <p className="text-[10px] md:text-xs text-[var(--tx-muted)] tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              email infrastructure monitor
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={toggleTheme}
              className="chrome-button px-3 py-1.5 text-[11px] md:text-xs"
              title={theme === 'dark' ? 'switch to light' : 'switch to dark'}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            {tab === 'health' && (
              <>
                {criticalCount > 0 && (
                  <span className="chrome-chip text-[var(--danger)] border-[var(--danger)] animate-pulse">
                    {criticalCount} critical
                  </span>
                )}
                {banned > 0 && (
                  <span className="chrome-chip text-[#b366ff] border-[#b366ff] animate-pulse">
                    {banned} banned
                  </span>
                )}
                {settings.apiKey && (
                  <span className="text-[var(--tx-dim)] text-[10px] md:text-xs hide-mobile">
                    {accounts.length} acc · {lastFetch ? new Date(lastFetch).toLocaleTimeString() : '—'}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 md:gap-2 mb-6 md:mb-8 overflow-x-auto pb-1">
          <Tab active={tab === 'health'} label="Health" icon="◆" onClick={() => setTab('health')} />
          <Tab active={tab === 'scanner'} label="Scanner" icon="◎" onClick={() => setTab('scanner')} />
          <Tab active={tab === 'status'} label="Status" icon="◈" onClick={() => setTab('status')} />
          <Tab active={tab === 'content'} label="Content" icon="▣" onClick={() => setTab('content')} />
          <Tab active={tab === 'apollo'} label="Apollo" icon="@" onClick={() => setTab('apollo')} />
          <Tab active={tab === 'watch'} label="Watch" icon="✦" onClick={() => setTab('watch')} />
          <Tab active={tab === 'settings'} label="Config" icon="◇" onClick={() => setTab('settings')} />
        </div>

        {/* Content */}
        {tab === 'health' ? (
          settings.apiKey ? (
            loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-5 h-5 border border-[var(--accent)] animate-spin" style={{ boxShadow: '0 0 12px var(--accent-shadow)' }} />
              </div>
            ) : error ? (
              <div className="chrome-surface p-8 max-w-lg mx-auto text-center">
                <p className="text-[var(--danger)] text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>CONNECTION FAILURE</p>
                <p className="text-[var(--tx-muted)] text-xs mb-6">{error}</p>
                <button onClick={fetchData} className="chrome-button px-6 py-2 text-sm">RETRY</button>
              </div>
            ) : (
              <>
                {stats && <StatsBar stats={stats} />}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
                  <HealthGauge accounts={accounts} />
                  <VolumePanel />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
                  <AlertsPanel alerts={alerts} />
                  <div className="lg:col-span-2">
                    <ChartPanel history={history} />
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3 mb-4 flex-wrap">
                  <input type="text" placeholder="SEARCH EMAIL..." value={search} onChange={e => setSearch(e.target.value)}
                    className="chrome-input px-4 py-2 w-48 md:w-64 text-[10px] md:text-xs uppercase tracking-wider" />
                  {['all', 'healthy', 'warning', 'poor', 'critical'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`chrome-chip cursor-pointer transition-colors ${
                        filter === f
                          ? f === 'healthy' ? 'chrome-chip text-[var(--safe)] border-[var(--safe)]'
                            : f === 'warning' ? 'chrome-chip text-[var(--warn)] border-[var(--warn)]'
                            : f === 'poor' ? 'chrome-chip text-[var(--warning-alt)] border-[var(--warning-alt)]'
                            : f === 'critical' ? 'chrome-chip text-[var(--danger)] border-[var(--danger)]'
                            : 'chrome-chip text-[var(--tx-secondary)] border-[var(--border-active)]'
                          : 'chrome-chip text-[var(--tx-muted)] border-[var(--border)] hover:text-[var(--tx-secondary)] hover:border-[var(--border-active)]'
                      }`}>
                      {f}
                    </button>
                  ))}
                  <button onClick={fetchData} className="text-[var(--tx-dim)] text-[10px] hover:text-[var(--tx-muted)] transition-colors ml-auto uppercase tracking-wider">↻ refresh</button>
                </div>
                <AccountList accounts={filteredAccounts} />
              </>
            )
          ) : (
            <div className="text-center py-20 md:py-24">
              <p className="text-[var(--tx-muted)] text-lg mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>NO API KEY</p>
              <p className="text-[var(--tx-dim)] text-xs mb-6">Configure your provider in Settings</p>
              <button onClick={() => setTab('settings')} className="chrome-button px-6 py-2">CONFIG</button>
            </div>
          )
        ) : tab === 'scanner' ? (
          <BulkScanner />
        ) : tab === 'status' ? (
          <SenderDiagnostics />
        ) : tab === 'content' ? (
          <ContentAnalyzer />
        ) : tab === 'apollo' ? (
          <ApolloLookup apolloApiKey={settings.apolloApiKey} />
        ) : tab === 'watch' ? (
          <Watchlist />
        ) : (
          <Settings settings={settings} onSave={saveSettings} />
        )}

        <div className="text-center text-[var(--tx-dim)] text-[10px] mt-8 md:mt-12 pb-4 tracking-wider">
          BLACK CHROMIUM · v2.0 · {settings.apiKey ? 'POLL 30s' : 'UNCONFIGURED'}
        </div>
      </div>
    </div>
  )
}
