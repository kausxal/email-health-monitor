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

  // Volume snapshot
  const totalCapacity = enriched.reduce((s, a) => s + parseInt(a.payload?.daily_limit || 0, 10), 0);
  const activeSending = enriched.filter(a => a.status === 'active' && a.warmup_status !== 'disabled').length;
  const estDailySent = Math.round(enriched.reduce((s, a) => {
    const limit = parseInt(a.payload?.daily_limit || 0, 10);
    if (a.status === 'connection_error') return s;
    if (a.warmup_status === 'active') return s + Math.round(limit * 0.8);
    if (a.warmup_status === 'paused') return s + Math.round(limit * 0.3);
    return s + Math.round(limit * 0.5);
  }, 0));
  volumeHistory.push({
    timestamp: now,
    totalCapacity,
    estDailySent,
    accountCount: enriched.length,
    activeCount: activeSending,
  });
  if (volumeHistory.length > 2880) volumeHistory = volumeHistory.slice(-2880);
  // Persist compact snapshot to file every 5 minutes
  if (volumeHistory.length % 10 === 0) {
    try { fs.writeFileSync(VOLUME_FILE, JSON.stringify(volumeHistory.slice(-288))); } catch {}
  }

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

// ─── DNS Auth Checker (SPF, DKIM, DMARC) ───

async function resolveTxtViaDoh(domain) {
  const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`);
  const data = await res.json();
  if (data.Status !== 0 || !data.Answer) return [];
  return data.Answer.filter(a => a.type === 16).map(a => a.data.replace(/^"|"$/g, ''));
}

async function checkDnsAuth(domain) {
  const spfRecords = await resolveTxtViaDoh(domain);
  const spf = spfRecords.find(r => r.startsWith('v=spf1')) || null;

  const dmarcRecords = await resolveTxtViaDoh(`_dmarc.${domain}`);
  const dmarc = dmarcRecords.find(r => r.startsWith('v=DMARC1')) || null;

  let dkim = null;
  for (const selector of ['default', 'google', 'selector1', 'selector2', 'dkim', 'mail', 'smtp', 'zoho', 'mx']) {
    const records = await resolveTxtViaDoh(`${selector}._domainkey.${domain}`);
    const dkimRecord = records.find(r => r.startsWith('v=DKIM1'));
    if (dkimRecord) { dkim = { selector, record: dkimRecord }; break; }
  }

  const spfStatus = !spf ? 'missing' : spf.includes('-all') ? 'pass' : spf.includes('~all') ? 'softfail' : 'neutral';
  const dmarcPolicy = dmarc ? (dmarc.match(/p=(none|quarantine|reject)/) || [])[1] || 'unknown' : 'none';
  const dmarcStatus = !dmarc ? 'missing' : dmarcPolicy === 'reject' ? 'pass' : dmarcPolicy === 'quarantine' ? 'quarantine' : 'none';

  return {
    domain,
    spf: { raw: spf, status: spfStatus },
    dkim: { found: !!dkim, selector: dkim?.selector || null, raw: dkim?.record || null },
    dmarc: { raw: dmarc, status: dmarcStatus, policy: dmarcPolicy },
    score: spfStatus === 'pass' ? 10 : spfStatus === 'softfail' ? 5 : 0,
  };
}

app.post('/api/dns/lookup', async (req, res) => {
  const { domains } = req.body;
  if (!domains || !Array.isArray(domains) || domains.length === 0)
    return res.status(400).json({ error: 'Must provide an array of domains' });
  if (domains.length > 50) return res.status(400).json({ error: 'Max 50 domains per request' });

  const results = await Promise.allSettled(domains.map(d => checkDnsAuth(typeof d === 'string' ? d : d.domain)));
  const dnsResults = results.map(r => r.status === 'fulfilled' ? r.value : { domain: 'error', error: r.reason?.message });
  res.json({ results: dnsResults });
});

// ─── Sender Diagnostics ───

const FIX_GUIDES = {
  spf_missing: { severity: 'high', label: 'SPF record missing', fix: 'Add a TXT record for your domain: v=spf1 include:_spf.yourprovider.com ~all' },
  spf_weak: { severity: 'medium', label: 'SPF uses ~all (softfail)', fix: 'Switch ~all to -all once you have identified all sending sources' },
  spf_pass: { severity: 'good', label: 'SPF configured correctly', fix: null },
  dkim_missing: { severity: 'high', label: 'DKIM not found', fix: 'Generate a DKIM key in your email provider and add a TXT record for [selector]._domainkey.yourdomain.com' },
  dkim_ok: { severity: 'good', label: 'DKIM configured', fix: null },
  dmarc_missing: { severity: 'medium', label: 'DMARC record missing', fix: 'Add a TXT record for _dmarc.yourdomain.com: v=DMARC1; p=none; rua=mailto:reports@yourdomain.com — then gradually move to p=quarantine then p=reject' },
  dmarc_none: { severity: 'low', label: 'DMARC policy: none (monitoring only)', fix: 'Set p=quarantine after monitoring for a few weeks, then p=reject' },
  dmarc_pass: { severity: 'good', label: 'DMARC policy: reject or quarantine', fix: null },
  mx_missing: { severity: 'high', label: 'No MX records (cannot receive email)', fix: 'Add MX records pointing to your email provider. Without MX, your domain cannot receive replies.' },
  mx_ok: { severity: 'good', label: 'MX records configured', fix: null },
  blacklisted: { severity: 'high', label: 'Domain IPs appear on DNS blacklists', fix: 'Check Spamhaus, Barracuda, etc. Request delisting. Common causes: compromised server, spam traps, high bounce rates.' },
  clean: { severity: 'good', label: 'Not on any DNS blacklist', fix: null },
};

app.post('/api/sender/check', async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  const issues = [];

  // MX
  let mxRecords = [];
  try {
    mxRecords = await resolveMxViaDoh(domain);
  } catch {}
  if (mxRecords.length === 0) {
    issues.push({ check: 'mx', status: 'mx_missing', ...FIX_GUIDES.mx_missing });
  } else {
    issues.push({ check: 'mx', status: 'mx_ok', detail: `${mxRecords.length} MX records found`, ...FIX_GUIDES.mx_ok });
  }

  // SPF
  const spfTxt = await resolveTxtViaDoh(domain);
  const spf = spfTxt.find(r => r.startsWith('v=spf1')) || null;
  if (!spf) {
    issues.push({ check: 'spf', status: 'spf_missing', ...FIX_GUIDES.spf_missing });
  } else if (spf.includes('-all')) {
    issues.push({ check: 'spf', status: 'spf_pass', detail: spf, ...FIX_GUIDES.spf_pass });
  } else if (spf.includes('~all')) {
    issues.push({ check: 'spf', status: 'spf_weak', detail: spf, ...FIX_GUIDES.spf_weak });
  } else {
    issues.push({ check: 'spf', status: 'spf_weak', detail: spf + ' (no -all or ~all)', ...FIX_GUIDES.spf_weak });
  }

  // DKIM
  let dkimFound = false;
  let dkimSelector = null;
  for (const selector of ['default', 'google', 'selector1', 'selector2', 'dkim', 'mail', 'smtp', 'zoho', 'mx', 'protonmail', 'outlook']) {
    const records = await resolveTxtViaDoh(`${selector}._domainkey.${domain}`);
    if (records.find(r => r.startsWith('v=DKIM1'))) { dkimFound = true; dkimSelector = selector; break; }
  }
  if (!dkimFound) {
    issues.push({ check: 'dkim', status: 'dkim_missing', ...FIX_GUIDES.dkim_missing });
  } else {
    issues.push({ check: 'dkim', status: 'dkim_ok', detail: `Selector: ${dkimSelector}`, ...FIX_GUIDES.dkim_ok });
  }

  // DMARC
  const dmarcTxt = await resolveTxtViaDoh(`_dmarc.${domain}`);
  const dmarc = dmarcTxt.find(r => r.startsWith('v=DMARC1')) || null;
  if (!dmarc) {
    issues.push({ check: 'dmarc', status: 'dmarc_missing', ...FIX_GUIDES.dmarc_missing });
  } else {
    const policy = (dmarc.match(/p=(none|quarantine|reject)/) || [])[1] || 'none';
    if (policy === 'reject' || policy === 'quarantine') {
      issues.push({ check: 'dmarc', status: 'dmarc_pass', detail: dmarc, ...FIX_GUIDES.dmarc_pass });
    } else {
      issues.push({ check: 'dmarc', status: 'dmarc_none', detail: dmarc, ...FIX_GUIDES.dmarc_none });
    }
  }

  // Blacklist
  const bl = await getBlacklistStatus(domain);
  if (bl.listed) {
    issues.push({ check: 'blacklist', status: 'blacklisted', detail: bl.checks.map(c => `${c.ip} → ${c.blacklist}`).join(', '), ...FIX_GUIDES.blacklisted });
  } else {
    issues.push({ check: 'blacklist', status: 'clean', ...FIX_GUIDES.clean });
  }

  // Overall score (0-100)
  const severityScores = { high: -25, medium: -10, low: -5, good: 0 };
  let score = 100;
  for (const issue of issues) {
    score += severityScores[issue.severity] || 0;
  }
  score = Math.max(0, Math.min(100, score));

  const critical = issues.filter(i => i.severity === 'high').length;
  const warnings = issues.filter(i => i.severity === 'medium').length;
  const level = critical > 0 ? 'poor' : warnings > 0 ? 'moderate' : 'good';

  res.json({ domain, score, level, critical, warnings, issues });
});

// ─── BIMI Checker ───

app.post('/api/bimi/check', async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try {
    const txtRecords = await resolveTxtViaDoh(`default._bimi.${domain}`);
    const bimi = txtRecords.find(r => r.startsWith('v=BIMI1')) || null;
    let logoUrl = null;
    if (bimi) {
      const urlMatch = bimi.match(/l=([^;\s]+)/);
      if (urlMatch) logoUrl = urlMatch[1];
    }
    res.json({ domain, found: !!bimi, raw: bimi, logoUrl });
  } catch (e) {
    res.json({ domain, found: false, raw: null, logoUrl: null, error: e.message });
  }
});

// ─── Email Content Analyzer ───

const SPAM_TRIGGERS = [
  'free', 'guarantee', 'act now', 'limited time', 'click here', 'buy now',
  'exclusive offer', 'congratulations', 'winner', 'urgent', 'immediately',
  'amazing', 'incredible', 'once in a lifetime', 'no cost', 'bonus',
  'earn money', 'work from home', 'double your', 'increase sales',
  'unlimited', 'trial', 'cash', 'promise', 'discount', 'cheap', 'deal',
  'eliminate debt', 'extra income', 'financial freedom', 'investment',
  'lowest price', 'million dollars', 'risk-free', 'satisfaction guaranteed',
  'stop snoring', 'weight loss', 'viagra', 'refinance', 'credit',
  'obligation', 'opt in', 'pre-approved', 'privacy policy', 'removal',
  'reserves the right', 'no catch', 'no hidden', 'no obligation',
  'not spam', 'per day', 'save big', 'social security', 'this is not spam',
];

app.post('/api/content/analyze', async (req, res) => {
  const { subject, body, fromName, fromEmail } = req.body;
  if (!body) return res.status(400).json({ error: 'Email body is required' });

  const issues = [];
  const fullText = `${subject || ''} ${body}`.toLowerCase();
  const wordCount = body.split(/\s+/).length;

  // 1. Trigger word scan
  const foundTriggers = SPAM_TRIGGERS.filter(t => fullText.includes(t.toLowerCase()));
  if (foundTriggers.length > 3) {
    issues.push({ severity: 'high', label: `${foundTriggers.length} spam trigger words found`, detail: foundTriggers.slice(0, 10).join(', '), fix: 'Remove or reduce trigger words. Focus on personalization and value proposition.' });
  } else if (foundTriggers.length > 0) {
    issues.push({ severity: 'low', label: `${foundTriggers.length} minor trigger word(s)`, detail: foundTriggers.join(', '), fix: 'Consider rephrasing to avoid spam filter keywords.' });
  }

  // 2. Subject line
  if (subject) {
    const subLen = subject.length;
    if (subLen < 20) issues.push({ severity: 'low', label: `Subject too short (${subLen} chars)`, fix: 'Aim for 50-70 character subject lines for optimal delivery.' });
    else if (subLen > 90) issues.push({ severity: 'medium', label: `Subject too long (${subLen} chars)`, fix: 'Keep subject lines under 90 characters to avoid truncation on mobile.' });
    if (subject === subject.toUpperCase() && subject.length > 5) issues.push({ severity: 'medium', label: 'Subject is ALL CAPS', fix: 'Use sentence case — ALL CAPS triggers spam filters.' });
    if (subject.includes('!')) issues.push({ severity: 'medium', label: `Subject contains ${(subject.match(/!/g) || []).length} exclamation mark(s)`, fix: 'Remove exclamation marks from subject lines.' });
    if (subject.toLowerCase().includes('re:')) issues.push({ severity: 'medium', label: 'Subject contains RE: (looks like reply)', fix: 'Remove RE: prefix from cold emails — looks deceptive.' });
  } else {
    issues.push({ severity: 'high', label: 'No subject line', fix: 'Always include a subject line.' });
  }

  // 3. Body structure
  const linkCount = (body.match(/https?:\/\/[^\s<>"']+/g) || []).length;
  const imgCount = (body.match(/<img[^>]+>/gi) || []).length;
  const exclaimCount = (body.match(/!/g) || []).length;
  const capsWords = body.split(/\s+/).filter(w => w.length > 2 && w === w.toUpperCase()).length;

  if (linkCount > 5) issues.push({ severity: 'high', label: `${linkCount} links in email`, detail: 'Too many links triggers spam filters', fix: 'Limit to 1-2 relevant links per cold email.' });
  if (imgCount > 3) issues.push({ severity: 'medium', label: `${imgCount} images in email`, fix: 'Cold emails with mostly images look like marketing. Use mostly text with at most 1 image.' });
  if (exclaimCount > 5) issues.push({ severity: 'medium', label: `${exclaimCount} exclamation marks found`, fix: 'Reduce exclamation marks — they add an aggressive tone and trigger spam filters.' });
  if (capsWords > 5) issues.push({ severity: 'medium', label: `${capsWords} ALL CAPS words found`, fix: 'Avoid using ALL CAPS for emphasis. Use bold or italics instead.' });

  // 4. Text length
  if (wordCount < 20 && !subject) issues.push({ severity: 'medium', label: `Very short email (${wordCount} words)`, fix: 'Cold emails should be 50-125 words for optimal engagement.' });
  else if (wordCount < 20) issues.push({ severity: 'low', label: `Short email (${wordCount} words)`, fix: 'Consider expanding to 50-125 words for context.' });
  if (wordCount > 500) issues.push({ severity: 'low', label: `Very long email (${wordCount} words)`, fix: 'Keep cold emails under 200 words — long emails get skimmed or ignored.' });

  // 5. Personalization check
  const hasNameToken = fullText.includes('{{') || fullText.includes('{first') || fullText.includes('{name');
  if (!hasNameToken) issues.push({ severity: 'low', label: 'No personalization detected', fix: 'Add personalization tokens like {{first_name}} to improve engagement and deliverability.' });

  // 6. From name check
  if (fromName && fromName === fromName.toUpperCase() && fromName.length > 3) {
    issues.push({ severity: 'low', label: 'From name is ALL CAPS', fix: 'Use normal capitalization for sender name — ALL CAPS looks like spam.' });
  }

  // 7. Text vs HTML ratio
  const htmlTagCount = (body.match(/<[^>]+>/g) || []).length;
  if (htmlTagCount > 100) issues.push({ severity: 'medium', label: 'HTML-heavy email', fix: 'Cold emails should be plain text or light HTML. High HTML ratio triggers spam filters.' });

  // Score
  const severityScores = { high: -20, medium: -10, low: -5 };
  let score = 100;
  for (const issue of issues) score += severityScores[issue.severity] || 0;
  score = Math.max(0, Math.min(100, score));

  const level = score >= 80 ? 'good' : score >= 50 ? 'moderate' : 'poor';

  res.json({
    score, level,
    stats: { wordCount, linkCount, imgCount, exclaimCount, capsWords, triggerWords: foundTriggers.length, htmlTags: htmlTagCount },
    issues,
    fromName, fromEmail,
  });
});

// ─── DMARC Report Parser (XML upload) ───

const { XMLParser } = (() => {
  try { return require('fast-xml-parser'); } catch { return { XMLParser: null }; }
})();

app.post('/api/dmarc/parse', async (req, res) => {
  if (!XMLParser) return res.status(500).json({ error: 'fast-xml-parser not installed. Run: npm install fast-xml-parser' });

  const { xml } = req.body;
  if (!xml) return res.status(400).json({ error: 'DMARC XML report content is required' });

  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(xml);
    const feedback = parsed.feedback || {};

    const metadata = feedback.report_metadata || {};
    const policy = feedback.policy_published || {};
    const records = feedback.record || [];

    const recordList = Array.isArray(records) ? records : [records];

    const results = recordList.map(r => {
      const row = r.row || {};
      const idents = r.identifiers || {};
      const evalPol = row.policy_evaluated || {};
      return {
        sourceIp: row.source_ip || 'unknown',
        count: parseInt(row.count || 0, 10),
        disposition: evalPol.disposition || 'none',
        dkim: evalPol.dkim || 'fail',
        spf: evalPol.spf || 'fail',
        headerFrom: idents.header_from || 'unknown',
        envelopeFrom: idents.envelope_from || 'unknown',
      };
    });

    const totalCount = results.reduce((s, r) => s + r.count, 0);
    const passCount = results.filter(r => r.dkim === 'pass' && r.spf === 'pass').reduce((s, r) => s + r.count, 0);
    const failCount = totalCount - passCount;

    const bySource = {};
    for (const r of results) {
      if (!bySource[r.sourceIp]) bySource[r.sourceIp] = { ip: r.sourceIp, total: 0, pass: 0, fail: 0, headerFrom: r.headerFrom };
      bySource[r.sourceIp].total += r.count;
      if (r.dkim === 'pass' && r.spf === 'pass') bySource[r.sourceIp].pass += r.count;
      else bySource[r.sourceIp].fail += r.count;
    }

    res.json({
      domain: policy.domain || 'unknown',
      policy: policy.p || 'none',
      orgName: metadata.org_name || 'unknown',
      orgEmail: metadata.email || 'unknown',
      reportId: metadata['@_report_id'] || null,
      dateRange: metadata.date_range || null,
      totalCount,
      passCount,
      failCount,
      passRate: totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0,
      bySource: Object.values(bySource),
      records: results,
    });
  } catch (e) {
    res.status(400).json({ error: `Failed to parse DMARC XML: ${e.message}` });
  }
});

// ─── Blacklist (DNSBL) Checker ───

const DNSBLS = [
  { name: 'Spamhaus', host: 'zen.spamhaus.org' },
  { name: 'Barracuda', host: 'b.barracudacentral.org' },
  { name: 'SORBS', host: 'dnsbl.sorbs.net' },
  { name: 'SpamCop', host: 'bl.spamcop.net' },
  { name: 'MXToolbox', host: 'dnsbl.mxtoolbox.com' },
  { name: 'SpamRats', host: 'bl.spamrats.com' },
];

async function reverseIp(ip) {
  return ip.split('.').reverse().join('.');
}

async function checkIpInDnsbl(ip, dnsbl) {
  const lookup = `${await reverseIp(ip)}.${dnsbl}`;
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(lookup)}&type=A`);
    const data = await res.json();
    if (data.Status === 0 && data.Answer) {
      return data.Answer.some(a => a.type === 1 && a.data.startsWith('127.'));
    }
  } catch {}
  return false;
}

async function lookupDomainIps(domain) {
  const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
  const data = await res.json();
  if (data.Status !== 0 || !data.Answer) return [];
  return data.Answer.filter(a => a.type === 1).map(a => a.data);
}

async function getBlacklistStatus(domain) {
  try {
    const ips = await lookupDomainIps(domain);
    const checks = [];
    for (const ip of ips.slice(0, 2)) {
      for (const bl of DNSBLS) {
        if (await checkIpInDnsbl(ip, bl.host)) checks.push({ ip, blacklist: bl.name });
      }
    }
    return { listed: checks.length > 0, checks };
  } catch {
    return { listed: false, checks: [] };
  }
}

app.post('/api/blacklist/check', async (req, res) => {
  const { domains } = req.body;
  if (!domains || !Array.isArray(domains) || domains.length === 0)
    return res.status(400).json({ error: 'Must provide an array of domains' });
  if (domains.length > 20) return res.status(400).json({ error: 'Max 20 domains per request' });

  const results = await Promise.allSettled(domains.map(async item => {
    const domain = typeof item === 'string' ? item : item.domain;
    try {
      const bl = await getBlacklistStatus(domain);
      const ips = await lookupDomainIps(domain);
      return { domain, ips, listed: bl.listed, checks: bl.checks, score: bl.listed ? -20 : 0 };
    } catch (e) {
      return { domain, ips: [], listed: false, checks: [], score: 0, error: e.message };
    }
  }));
  res.json({ results: results.map(r => r.status === 'fulfilled' ? r.value : { domain: 'error', error: r.reason?.message }) });
});

// ─── Bulk Scanner (unified pipeline) ───

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:8766';

function computeDeliverability(mxResult, dnsResult, blResult) {
  let score = 50;
  const signals = [];

  if (mxResult) {
    if (mxResult.risk === 'high') { score -= 25; signals.push('mx_blocked'); }
    else if (mxResult.risk === 'medium') { score -= 10; signals.push('mx_moderate'); }
    else if (mxResult.risk === 'low') { score += 10; signals.push('mx_clean'); }
    else signals.push('mx_unknown');
    if (mxResult.mxCount === 0) { score -= 15; signals.push('no_mx'); }
    else if (mxResult.mxCount >= 2) { score += 5; signals.push('mx_redundant'); }
  }

  if (dnsResult) {
    if (dnsResult.spf?.status === 'pass') { score += 10; signals.push('spf_ok'); }
    else if (dnsResult.spf?.status === 'missing') { score -= 10; signals.push('spf_missing'); }
    else signals.push('spf_weak');

    if (dnsResult.dkim?.found) { score += 5; signals.push('dkim_ok'); }
    else { score -= 5; signals.push('dkim_missing'); }

    if (dnsResult.dmarc?.policy === 'reject') { score += 5; signals.push('dmarc_strict'); }
    else if (dnsResult.dmarc?.policy === 'quarantine') { score += 2; signals.push('dmarc_quarantine'); }
    else if (dnsResult.dmarc?.status === 'missing') { score -= 5; signals.push('dmarc_missing'); }
  }

  if (blResult) {
    if (blResult.listed) { score -= 25; signals.push('blacklisted'); }
    else { score += 5; signals.push('not_blacklisted'); }
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 75 ? 'good' : score >= 45 ? 'moderate' : 'poor';
  return { score, level, signals };
}

const bulkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30,
  message: { error: 'Rate limit exceeded. Max 30 bulk scans per 15 min.' },
  standardHeaders: true, legacyHeaders: false,
});

async function processOneItem(item) {
  const name = typeof item === 'string' ? item : item.name || item.company || item.domain || item.website || '';
  const inputDomain = typeof item === 'string' ? null : item.domain || item.website || null;
  if (!name.trim()) return null;

  let domain = inputDomain;

  if (!domain) {
    try {
      const scRes = await fetch(`${SCRAPER_URL}/scrape/company`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: name.trim() }),
      });
      if (scRes.ok) {
        const scData = await scRes.json();
        domain = scData.domain || null;
      }
    } catch {}
  }

  const entry = { name, domain: domain || '', mxRisk: null, dnsAuth: null, blacklist: null, deliverability: null };

  if (domain) {
    const [mxRes, dnsRes, blRes] = await Promise.allSettled([
      lookupDomains([{ domain, company: name }]),
      checkDnsAuth(domain),
      getBlacklistStatus(domain),
    ]);

    if (mxRes.status === 'fulfilled') {
      entry.mxRisk = mxRes.value.results?.[0]?.risk || null;
      entry.mxDetail = mxRes.value.results?.[0] || null;
    }
    if (dnsRes.status === 'fulfilled') entry.dnsAuth = dnsRes.value;
    if (blRes.status === 'fulfilled') entry.blacklist = blRes.value;

    entry.deliverability = computeDeliverability(entry.mxDetail, entry.dnsAuth, entry.blacklist);
  }

  return entry;
}

app.post('/api/bulk/scan', bulkLimiter, async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Must provide an array of items' });
  if (items.length > 100) return res.status(400).json({ error: 'Max 100 items per scan' });

  const CONCURRENCY = 5;
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(item => processOneItem(item)));
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
  }

  res.json({ results, total: results.length });
});

// ─── Watchlist (local file-based, in-memory for serverless) ───

const WATCHLIST_FILE = path.join(__dirname, '..', 'watchlist.json');
function loadWatchlist() {
  try {
    if (fs.existsSync(WATCHLIST_FILE)) return JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));
  } catch {}
  return [];
}

function saveWatchlist(data) {
  try { fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(data, null, 2)); } catch {}
}

app.get('/api/watchlist', (req, res) => {
  const watchlist = loadWatchlist();
  res.json({ watchlist });
});

app.post('/api/watchlist', (req, res) => {
  const { domain, name, notes } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  const watchlist = loadWatchlist();
  if (!watchlist.find(w => w.domain === domain)) {
    watchlist.push({ domain, name: name || domain, notes: notes || '', added: Date.now() });
    saveWatchlist(watchlist);
  }
  res.json({ watchlist });
});

app.delete('/api/watchlist/:domain', (req, res) => {
  let watchlist = loadWatchlist();
  watchlist = watchlist.filter(w => w.domain !== req.params.domain);
  saveWatchlist(watchlist);
  res.json({ watchlist });
});

// ─── Volume Tracking ───

const VOLUME_FILE = path.join(__dirname, '..', 'volume_history.json');
let volumeHistory = [];

function loadVolumeHistory() {
  try {
    if (fs.existsSync(VOLUME_FILE)) {
      const raw = fs.readFileSync(VOLUME_FILE, 'utf8');
      volumeHistory = JSON.parse(raw);
    }
  } catch {}
}
loadVolumeHistory();

app.get('/api/volume', async (req, res) => {
  const { provider, apiKey } = getRequestCredentials(req);

  if (volumeHistory.length === 0 && apiKey) {
    try {
      await fetchAccounts(provider, apiKey);
    } catch {}
  }

  const recent = volumeHistory.slice(-288); // last ~24h at 30s intervals
  const byDay = {};
  const byWeek = {};
  for (const v of recent) {
    const day = new Date(v.timestamp).toISOString().slice(0, 10);
    const week = `${new Date(v.timestamp).getFullYear()}-W${String(Math.ceil(new Date(v.timestamp).getDate() / 7)).padStart(2, '0')}`;
    if (!byDay[day]) byDay[day] = { day, totalCapacity: 0, estDailySent: 0, count: 0 };
    byDay[day].totalCapacity += v.totalCapacity;
    byDay[day].estDailySent += v.estDailySent;
    byDay[day].count++;
    if (!byWeek[week]) byWeek[week] = { week, totalCapacity: 0, estDailySent: 0, count: 0 };
    byWeek[week].totalCapacity += v.totalCapacity;
    byWeek[week].estDailySent += v.estDailySent;
    byWeek[week].count++;
  }

  const latest = recent[recent.length - 1] || { totalCapacity: 0, estDailySent: 0, accountCount: 0, activeCount: 0 };

  // Average daily values
  const dailyAvg = Object.values(byDay).map(d => ({
    day: d.day,
    capacity: Math.round(d.totalCapacity / d.count),
    sent: Math.round(d.estDailySent / d.count),
  }));

  res.json({
    today: {
      capacity: latest.totalCapacity,
      estimatedSent: latest.estDailySent,
      accountCount: latest.accountCount,
      activeCount: latest.activeCount,
    },
    daily: dailyAvg,
    weekly: Object.values(byWeek).map(w => ({
      week: w.week,
      capacity: Math.round(w.totalCapacity / w.count),
      sent: Math.round(w.estDailySent / w.count),
    })),
  });
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
// ─── Apollo People Lookup ───

app.post('/api/apollo/lookup', async (req, res) => {
  const { email, linkedinUrl, apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'Apollo API key is required' });
  if (!email && !linkedinUrl) return res.status(400).json({ error: 'Email or LinkedIn URL is required' });

  const body = {};
  if (email) body.email = email;
  if (linkedinUrl) body.linkedin_url = linkedinUrl;

  try {
    const apolloRes = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (apolloRes.status === 401 || apolloRes.status === 403) {
      return res.status(400).json({ error: 'Invalid Apollo API key' });
    }

    const data = await apolloRes.json();
    if (!data.person) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const p = data.person;
    res.json({
      id: p.id,
      name: p.name,
      firstName: p.first_name,
      lastName: p.last_name,
      headline: p.headline,
      title: p.title,
      email: p.email,
      emails: [
        { address: p.email, type: 'primary', status: p.email_status },
        ...(p.secondary_emails || []).map(e => ({ address: e, type: 'secondary' })),
      ].filter(e => e.address),
      phone: p.phone_numbers?.[0]?.sanitized_number || p.phone || null,
      city: p.city,
      state: p.state,
      country: p.country,
      organization: p.organization?.name || null,
      orgWebsite: p.organization?.website_url || null,
      linkedinUrl: p.linkedin_url,
      facebookUrl: p.facebook_url,
      twitterUrl: p.twitter_url,
      photoUrl: p.photo_url,
      sanitizedPhone: p.sanitized_phone || null,
    });
  } catch (e) {
    res.status(500).json({ error: `Apollo lookup failed: ${e.message}` });
  }
});

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
