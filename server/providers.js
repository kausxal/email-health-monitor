const PROVIDERS = [
  {
    name: "Proofpoint",
    patterns: ["proofpoint.com", "pphosted.com", "ppe-hosted.com", "spamexperto.com", "us-mta", "mxo1", "mxout"],
    risk: "high",
    description: "Enterprise email security gateway. High chance of blocking cold email.",
    tag: "email_firewall"
  },
  {
    name: "Mimecast",
    patterns: ["mimecast.com", "mimecast"],
    risk: "high",
    description: "Email security and threat protection. Filters unsolicited email aggressively.",
    tag: "email_firewall"
  },
  {
    name: "Barracuda",
    patterns: ["barracudanetworks.com", "barracuda.com", "barracuda"],
    risk: "high",
    description: "Email security gateway with spam filtering.",
    tag: "email_firewall"
  },
  {
    name: "Cisco Secure Email (IronPort)",
    patterns: ["ironport.com", "ironport", "cisco.com"],
    risk: "high",
    description: "Enterprise email security appliance. Aggressive filtering.",
    tag: "email_firewall"
  },
  {
    name: "Symantec Email Security",
    patterns: ["messagelabs.com", "symantec.com", "messagelabs"],
    risk: "high",
    description: "Cloud email security. Blocks suspicious senders.",
    tag: "email_firewall"
  },
  {
    name: "Trend Micro Email Security",
    patterns: ["trendmicro.com", "trendmicro", "mailhost", "esmtp"],
    risk: "high",
    description: "Email security with anti-spam protection.",
    tag: "email_firewall"
  },
  {
    name: "Abnormal Security",
    patterns: ["abnormalsecurity.com", "abnormal"],
    risk: "high",
    description: "AI-based email security. Detects and blocks anomalous senders.",
    tag: "email_firewall"
  },
  {
    name: "Cloudflare Email (Area 1)",
    patterns: ["area1.com", "area1", "cloudflare.com"],
    risk: "high",
    description: "Cloud-native email security. Blocks phishing and spam.",
    tag: "email_firewall"
  },
  {
    name: "DarkTrace Email",
    patterns: ["darktrace.com", "darktrace"],
    risk: "high",
    description: "AI email security. Behavioral analysis blocks unusual senders.",
    tag: "email_firewall"
  },
  {
    name: "Tessian",
    patterns: ["tessian.com", "tessian"],
    risk: "high",
    description: "AI email security for enterprises.",
    tag: "email_firewall"
  },
  {
    name: "SpamTitan",
    patterns: ["spamtitan.com", "spamtitan"],
    risk: "high",
    description: "Email security gateway with spam filtering.",
    tag: "email_firewall"
  },
  {
    name: "Fortinet (FortiMail)",
    patterns: ["fortinet.com", "fortimail", "fortigate"],
    risk: "high",
    description: "Enterprise email security gateway.",
    tag: "email_firewall"
  },
  {
    name: "Hornetsecurity",
    patterns: ["hornetsecurity.com", "hornetsecurity"],
    risk: "high",
    description: "Cloud email security suite.",
    tag: "email_firewall"
  },
  {
    name: "VIPRE Email Security",
    patterns: ["vipre.com", "vipre"],
    risk: "high",
    description: "Email security and threat protection.",
    tag: "email_firewall"
  },
  {
    name: "Sophos Email",
    patterns: ["sophos.com", "sophos"],
    risk: "high",
    description: "Sophos email security gateway.",
    tag: "email_firewall"
  },
  {
    name: "Reflexion",
    patterns: ["reflexion.net", "reflexion"],
    risk: "high",
    description: "Email security and archiving.",
    tag: "email_firewall"
  },
  {
    name: "MXGuardDog",
    patterns: ["mxguarddog.com", "mxguarddog"],
    risk: "high",
    description: "Email security gateway.",
    tag: "email_firewall"
  },
  {
    name: "Microsoft 365 / Exchange Online",
    patterns: ["protection.outlook.com", "outlook.com", "mail.protection.outlook.com", "mx.microsoft.com", "messaging.microsoft.com", "onmicrosoft.com"],
    risk: "medium",
    description: "Microsoft 365 email. Standard filtering, may still receive cold email.",
    tag: "microsoft"
  },
  {
    name: "Google Workspace",
    patterns: ["aspmx.l.google.com", "google.com", "googlemail.com", "mx.google.com"],
    risk: "low",
    description: "Google Workspace. Standard spam filtering. Usually reachable.",
    tag: "google"
  },
  {
    name: "Zoho Mail",
    patterns: ["zoho.com", "zohomail.com"],
    risk: "low",
    description: "Zoho email service. Standard filtering.",
    tag: "other"
  },
  {
    name: "Rackspace Email",
    patterns: ["rackspace.com", "emailsrvr.com"],
    risk: "medium",
    description: "Rackspace hosted email.",
    tag: "other"
  },
  {
    name: "GoDaddy Email",
    patterns: ["secureserver.net", "godaddy.com"],
    risk: "low",
    description: "GoDaddy hosted email.",
    tag: "other"
  },
  {
    name: "Namecheap Email",
    patterns: ["namecheap.com", "privateemail.com"],
    risk: "low",
    description: "Namecheap private email.",
    tag: "other"
  },
  {
    name: "Mailgun",
    patterns: ["mailgun.org", "mailgun.com"],
    risk: "low",
    description: "Mailgun transactional email service.",
    tag: "other"
  },
  {
    name: "SendGrid",
    patterns: ["sendgrid.net", "sendgrid.com"],
    risk: "low",
    description: "SendGrid email delivery platform.",
    tag: "other"
  },
  {
    name: "Amazon SES",
    patterns: ["amazonses.com", "aws"],
    risk: "low",
    description: "Amazon Simple Email Service.",
    tag: "other"
  },
  {
    name: "Yandex Mail",
    patterns: ["yandex.net", "yandex.com"],
    risk: "low",
    description: "Yandex email service.",
    tag: "other"
  },
  {
    name: "ProtonMail",
    patterns: ["protonmail.ch", "protonmail.com", "proton.ch"],
    risk: "medium",
    description: "Encrypted email service.",
    tag: "other"
  },
  {
    name: "FastMail",
    patterns: ["fastmail.com", "fastmail.net", "messagingengine.com"],
    risk: "low",
    description: "FastMail email service.",
    tag: "other"
  },
  {
    name: "IceWarp",
    patterns: ["icewarp.com", "icewarp"],
    risk: "medium",
    description: "IceWarp mail server.",
    tag: "other"
  },
  {
    name: "SpamHero",
    patterns: ["spamhero.com", "spamhero"],
    risk: "medium",
    description: "Spam filtering service.",
    tag: "email_filter"
  },
  {
    name: "Comodo Email Security",
    patterns: ["comodo.com", "comodo"],
    risk: "medium",
    description: "Email security gateway.",
    tag: "email_filter"
  },
  {
    name: "Vade Secure",
    patterns: ["vadesecure.com", "vade.com", "vade"],
    risk: "high",
    description: "AI-powered email security. Filters cold email aggressively.",
    tag: "email_firewall"
  },
  {
    name: "Inky",
    patterns: ["inky.com", "inky"],
    risk: "high",
    description: "AI email phishing defense.",
    tag: "email_firewall"
  },
  {
    name: "Trustwave SEG",
    patterns: ["trustwave.com", "trustwave", "mailcontrol.com"],
    risk: "high",
    description: "Enterprise email security gateway (MailControl).",
    tag: "email_firewall"
  },
  {
    name: "GreatHorn",
    patterns: ["greathorn.com", "greathorn"],
    risk: "high",
    description: "Cloud email security platform.",
    tag: "email_firewall"
  },
  {
    name: "Ironscales",
    patterns: ["ironscales.com", "ironscales"],
    risk: "high",
    description: "AI email security platform.",
    tag: "email_firewall"
  },
  {
    name: "Egress Defend",
    patterns: ["egress.com", "egress"],
    risk: "high",
    description: "Intelligent email security gateway.",
    tag: "email_firewall"
  },
  {
    name: "Avanan (Check Point)",
    patterns: ["avanan.com", "avanan", "checkpoint.com"],
    risk: "high",
    description: "Cloud email security suite.",
    tag: "email_firewall"
  }
];

function extractDomain(website) {
  let domain = website.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/^www\./, '');
  domain = domain.replace(/\/.*$/, '');
  domain = domain.split('@').pop() || domain;
  return domain;
}

function identifyProvider(mxHosts) {
  if (!mxHosts || mxHosts.length === 0) return [];
  const found = [];
  for (const host of mxHosts) {
    const h = host.toLowerCase();
    let matched = false;
    for (const p of PROVIDERS) {
      if (!p.patterns || p.patterns.length === 0) continue;
      for (const pat of p.patterns) {
        if (h.includes(pat)) {
          if (!found.find(f => f.name === p.name)) {
            found.push({ ...p });
          }
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
  }
  if (found.length === 0) {
    found.push({
      name: "Custom / Self-Hosted",
      risk: "unknown",
      description: "Unrecognized MX. Could be custom or self-hosted mail server.",
      tag: "unknown"
    });
  }
  return found;
}

function highestRisk(providers) {
  const order = { low: 0, medium: 1, high: 2, unknown: 3 };
  let highest = "low";
  for (const p of providers) {
    const r = p.risk || "unknown";
    if ((order[r] || 99) > (order[highest] || 0)) highest = r;
  }
  return highest;
}

function riskLabel(risk) {
  const labels = {
    low: "Safe - Standard email service, cold email lands normally",
    medium: "Moderate - Some filtering, may still receive cold email",
    high: "BLOCKED - Email firewall detected, cold email unlikely to land",
    unknown: "Unknown - Test with a single email first"
  };
  return labels[risk] || labels.unknown;
}

module.exports = { PROVIDERS, extractDomain, identifyProvider, highestRisk, riskLabel };
