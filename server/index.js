const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { PROVIDERS, extractDomain, identifyProvider, highestRisk, riskLabel } = require('./providers');
const fs = require('fs');

async function resolveMxViaDoh(domain) {
  const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`);
  const data = await res.json();
  if (data.Status !== 0 || !data.Answer) return [];
  return data.Answer
    .filter(a => a.type === 15)
    .map(a => {
      const spaceIdx = a.data.indexOf(' ');
      const priority = parseInt(a.data.substring(0, spaceIdx), 10);
      const exchange = a.data.substring(spaceIdx + 1).replace(/\.$/, '');
      return { priority, exchange };
    });
}

const PROVIDER_CONFIGS = {
  instantly: {
    baseUrl: 'https://api.instantly.ai/api/v1',
    listEndpoint: (apiKey) => `/account/list?api_key=${apiKey}&limit=100`,
    parseResponse: (data) => (data.accounts || []).map(a => ({
      email: a.email,
      status: a.status || 'unknown',
      warmup_status: a.warmup_status || 'unknown',
      stat_warmup_score: a.stat_warmup_score ?? 100,
      setup_pending: !!a.setup_pending,
      payload: a.payload || {},
      tracking_domain_status: a.payload?.tracking_domain?.status,
    })),
  },
  smartlead: {
    baseUrl: 'https://server.smartlead.ai/api/v1',
    listEndpoint: (apiKey) => `/email-accounts/?api_key=${apiKey}&limit=100`,
    parseResponse: (data) => {
      const accounts = Array.isArray(data) ? data : (data.data || []);
      return accounts.map(a => ({
        email: a.email || '',
        status: a.is_smtp_success !== false ? 'active' : 'connection_error',
        warmup_status: a.email_warmup_status === 'ACTIVE' ? 'active' :
                       a.email_warmup_status === 'INACTIVE' ? 'paused' : 'disabled',
        stat_warmup_score: a.warmup_score ?? 100,
        setup_pending: false,
        payload: {},
        tracking_domain_status: null,
      }));
    },
  },
};

const app = express();
const PORT = process.env.PORT || 3456;
const FALLBACK_API_KEY = process.env.INSTANTLY_API_KEY || 'j5qdbgdn6hmqsaqfwnvmh9m84tej';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const mxLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Rate limit exceeded. Max 100 MX lookups per 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const mxCsvLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Rate limit exceeded. Max 20 CSV uploads per 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const healthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_DOMAINS_PER_REQUEST = 500;

// Per-instance cache (used in local mode only)
let cachedAccounts = [];
let healthHistory = [];
let alerts = [];
let lastFetch = null;

function computeHealthScore(account) {
  let score = 100;

  if (account.status === 'connection_error') score -= 30;
  if (account.status === 'paused') score -= 15;
  if (account.status === 'disabled') score -= 40;

  if (account.warmup_status === 'banned') score -= 50;
  if (account.warmup_status === 'paused') score -= 20;
  if (account.warmup_status === 'disabled') score -= 30;

  const warmupScore = account.stat_warmup_score || 100;
  score = Math.min(score, warmupScore);

  if (account.setup_pending) score -= 15;

  const ctd = account.tracking_domain_status;
  if (ctd && ctd !== 'CTD_ACTIVE') {
    if (ctd === 'CTD_FAILED' || ctd === 'CTD_EXPIRED') score -= 20;
    else if (ctd === 'CTD_PENDING') score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function getHealthLabel(score) {
  if (score >= 90) return 'healthy';
  if (score >= 70) return 'warning';
  if (score >= 50) return 'poor';
  return 'critical';
}

function computeAlerts(accounts) {
  const result = [];
  for (const a of accounts) {
    const score = computeHealthScore(a);
    const label = getHealthLabel(score);

    if (label === 'critical') {
      result.push({ email: a.email, type: 'critical', message: `Critical: ${a.email} health score is ${score}`, timestamp: new Date().toISOString(), score });
    } else if (label === 'poor') {
      result.push({ email: a.email, type: 'poor', message: `Warning: ${a.email} health score dropped to ${score}`, timestamp: new Date().toISOString(), score });
    }
    if (a.warmup_status === 'banned') {
      result.push({ email: a.email, type: 'banned', message: `BANNED: ${a.email} warmup was banned!`, timestamp: new Date().toISOString(), score });
    }
    if (a.status === 'connection_error') {
      result.push({ email: a.email, type: 'connection', message: `${a.email} has connection error`, timestamp: new Date().toISOString(), score });
    }
  }
  return result.slice(0, 50);
}

async function fetchAccounts(provider, apiKey) {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  const url = `${config.baseUrl}${config.listEndpoint(apiKey)}`;
  const res = await fetch(url);
  const rawData = await res.json();

  if (!res.ok) {
    const errMsg = rawData.message || rawData.error || `HTTP ${res.status}`;
    throw new Error(`${provider}: ${errMsg}`);
  }

  const rawAccounts = config.parseResponse(rawData);
  const enriched = rawAccounts.map(a => ({
    ...a,
    health_score: computeHealthScore(a),
    health_label: getHealthLabel(computeHealthScore(a)),
  }));

  // Update local cache
  const now = Date.now();
  cachedAccounts = enriched;
  lastFetch = now;
  alerts = computeAlerts(enriched);

  healthHistory.push({
    timestamp: now,
    accounts: enriched.map(a => ({ email: a.email, score: a.health_score, status: a.status }))
  });
  if (healthHistory.length > 100) healthHistory = healthHistory.slice(-100);

  return enriched;
}

// ─── Instantly Health Monitor Routes ───

function getRequestCredentials(req) {
  const provider = req.headers['x-provider'] || 'instantly';
  const apiKey = req.headers['x-api-key'] || FALLBACK_API_KEY;
  return { provider, apiKey };
}

app.get('/api/accounts', healthLimiter, async (req, res) => {
  const { provider, apiKey } = getRequestCredentials(req);
  if (!apiKey) return res.status(400).json({ error: 'No API key provided. Set it in Settings or via INSTANTLY_API_KEY env var.' });

  try {
    const accounts = await fetchAccounts(provider, apiKey);
    res.json({ accounts, lastFetch, alertsCount: alerts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alerts', (req, res) => {
  res.json({ alerts, total: alerts.length });
});

app.get('/api/history', (req, res) => {
  res.json({ history: healthHistory });
});

app.get('/api/stats', async (req, res) => {
  const { provider, apiKey } = getRequestCredentials(req);

  if (cachedAccounts.length === 0 && apiKey) {
    try {
      await fetchAccounts(provider, apiKey);
    } catch (err) {
      return res.json({ total: 0, byLabel: {}, byStatus: {}, byWarmup: {}, avgHealth: 0 });
    }
  }

  const byLabel = { healthy: 0, warning: 0, poor: 0, critical: 0 };
  const byStatus = {};
  const byWarmup = {};
  for (const a of cachedAccounts) {
    byLabel[a.health_label] = (byLabel[a.health_label] || 0) + 1;
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    byWarmup[a.warmup_status] = (byWarmup[a.warmup_status] || 0) + 1;
  }
  res.json({
    total: cachedAccounts.length,
    byLabel, byStatus, byWarmup,
    avgHealth: cachedAccounts.length
      ? Math.round(cachedAccounts.reduce((s, a) => s + a.health_score, 0) / cachedAccounts.length)
      : 0
  });
});

// ─── MX Firewall Checker Routes ───

async function lookupDomains(domains) {
  const BATCH_SIZE = 5;
  const results = [];

  for (let i = 0; i < domains.length; i += BATCH_SIZE) {
    const batch = domains.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        const domain = extractDomain(item.domain || item.website || item);
        const company = item.company || item.company_name || item.name || domain;
        try {
          const mxRecords = await resolveMxViaDoh(domain);
          const exchanges = mxRecords
            .sort((a, b) => a.priority - b.priority)
            .map(m => m.exchange);

          const providers = identifyProvider(exchanges);
          const risk = highestRisk(providers);

          return {
            domain,
            company,
            mxRecords: exchanges.slice(0, 5),
            mxCount: exchanges.length,
            providers: providers.map(p => p.name),
            risk,
            description: providers.map(p => p.description).join(' | ') || riskLabel(risk),
          };
        } catch (err) {
          if (err.message && (err.message.includes('ENOTFOUND') || err.message.includes('NODATA'))) {
            return { domain, company, mxRecords: [], mxCount: 0, providers: [], risk: 'unknown', description: 'Domain not found or no DNS records' };
          }
          return { domain, company, mxRecords: [], mxCount: 0, providers: [], risk: 'unknown', description: `DNS error: ${err.message}` };
        }
      })
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value);
      else results.push({ domain: 'error', company: '', mxRecords: [], mxCount: 0, providers: [], risk: 'unknown', description: r.reason?.message || 'Unknown error' });
    }
  }

  const summary = { low: 0, medium: 0, high: 0, unknown: 0 };
  for (const r of results) {
    summary[r.risk] = (summary[r.risk] || 0) + 1;
  }

  return { results, summary, total: results.length };
}

app.post('/api/mx/lookup', mxLookupLimiter, async (req, res) => {
  const { domains } = req.body;
  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: 'Must provide an array of domains' });
  }
  if (domains.length > MAX_DOMAINS_PER_REQUEST) {
    return res.status(400).json({ error: `Too many domains. Max ${MAX_DOMAINS_PER_REQUEST} per request.` });
  }

  const result = await lookupDomains(domains);
  res.json(result);
});

app.post('/api/mx/lookup-csv', mxCsvLimiter, async (req, res) => {
  const { csvData } = req.body;
  if (!csvData) return res.status(400).json({ error: 'No CSV data provided' });

  try {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    const domainCol = headers.findIndex(h => ['domain', 'website', 'url', 'site', 'company website', 'web'].includes(h));
    const companyCol = headers.findIndex(h => ['company', 'company name', 'organization', 'org', 'business', 'name'].includes(h));

    if (domainCol === -1) return res.status(400).json({ error: 'CSV must have a "domain" or "website" column' });

    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length > Math.max(domainCol, companyCol >= 0 ? companyCol : 0)) {
        const domain = cols[domainCol]?.trim();
        const company = companyCol >= 0 ? (cols[companyCol]?.trim() || domain) : domain;
        if (domain) items.push({ domain, company });
      }
    }

    if (items.length === 0) return res.status(400).json({ error: 'No valid domains found in CSV' });

    const result = await lookupDomains(items);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

app.get('/api/mx/providers', (req, res) => {
  res.json({ providers: PROVIDERS });
});

// ─── Serve Frontend (local only) ───

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

// ─── Health Monitor Background Polling (local only) ───
let monitorInterval = null;

const startMonitor = () => {
  const apiKey = FALLBACK_API_KEY;
  if (!apiKey) { console.log('No API key — health monitor disabled'); return; }
  fetchAccounts('instantly', apiKey).then(() => console.log(`Initial fetch: ${cachedAccounts.length} accounts`));
  monitorInterval = setInterval(() => fetchAccounts('instantly', FALLBACK_API_KEY), 30_000);
};

// ─── Start (local only) ───
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_RUNTIME_API;
if (!isServerless) {
  app.listen(PORT, () => {
    console.log(`Email Health Monitor + MX Checker running on port ${PORT}`);
    startMonitor();
  });
}

module.exports = app;
