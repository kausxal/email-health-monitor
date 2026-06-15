# Black Chromium — Email Infrastructure Monitor

A single-page app for cold email operators who need to know two things: are **my** sending accounts healthy, and can **I** reach my target companies?

Built for sales engineers, lead gen agencies, and anyone running cold email campaigns who's tired of guessing whether their email will land.

---

## What it does

### Health Monitor (tab 1)
Connects to your Instantly or Smartlead account and shows you the real picture: which emails are warming up, which are banned, and which have tracking domain issues. Polls every 30 seconds so you can spot problems before they crater a campaign.

### Target Scanner (tab 2)
The core workflow. Paste a list of company names or domains and get back everything that matters for deliverability:

- **Domain resolution** — feeds company names through a web scraper to find their actual domain (saves hours of manual research)
- **MX firewall detection** — identifies if they use Proofpoint, Mimecast, Barracuda, or 40+ other email security providers. If they do, your cold email probably won't land.
- **SPF / DKIM / DMARC** — reads their DNS records so you can see how sophisticated their email setup is
- **DNS blacklist check** — checks Spamhaus, Barracuda, SORBS, SpamCop, and others for their IPs
- **Deliverability score** — combines everything into a 0-100 score with a clear recommendation: email safe, test first, or avoid email

Click any row to expand and see the raw MX records, DNS text, and blacklist details.

### Watchlist (tab 3)
Save domains you're tracking. Recheck them anytime to catch MX provider changes or auth degradations. If a company switches from Mimecast to Google Workspace, you want to know.

### Config (tab 4)
Drop in your Instantly or Smartlead API key. That's it.

---

## The architecture

```
client/     React (Vite) — black chromium UI
server/     Express API — DNS-over-HTTPS, rate limited
scraper/    Python service — web search for company → domain resolution
api/        Vercel serverless entry point
```

The server runs on Vercel for free. The Python scraper is a sidecar — you run it locally or on a cheap VM. Everything else is stateless.

---

## Running locally

```bash
# Install dependencies
npm install
cd client && npm install

# Build the frontend
npm run build

# Start the server (port 3456)
npm start

# Optional: start the Python scraper (port 8766)
cd scraper
pip install -r requirements.txt
python main.py
```

Then open `http://localhost:3456`.

---

## What it won't do

- It won't send emails for you. You need Instantly or Smartlead for that.
- It won't guarantee delivery. No tool can.
- The deliverability score is a heuristic, not a promise. Use it to prioritize, not to decide with certainty.

---

## The aesthetic

Black chromium. Industrial. No rounded corners, no gradients, no fluff. Bebas Neue for headings, JetBrains Mono for data. A scanline overlay and a grid that reminds you this is infrastructure, not a toy.

---

Built for cold email operators who want to spend less time guessing and more time sending.
