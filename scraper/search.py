from scrapling import Fetcher
from urllib.parse import urlparse, quote_plus
import re

fetcher = Fetcher(save_state=False)

def extract_domain(url):
    parsed = urlparse(url)
    return parsed.netloc.lower().replace('www.', '')

def clean_text(text):
    if not text:
        return ''
    return re.sub(r'\s+', ' ', text).strip()

def search_duckduckgo(query: str, max_results: int = 5):
    url = f'https://html.duckduckgo.com/html/?q={quote_plus(query)}'
    page = fetcher.get(url)

    if page.status != 200:
        return []

    results = []
    result_links = page.css('.result__a')

    for link in result_links[:max_results]:
        href = link.attrib.get('href', '')
        title = clean_text(link.text)

        snippet_el = link.parent.css('.result__snippet')
        snippet = clean_text(snippet_el[0].text) if snippet_el and snippet_el[0].text else ''

        if href.startswith('//'):
            href = 'https:' + href

        domain = extract_domain(href)
        if not domain or domain == 'duckduckgo.com':
            continue

        results.append({
            'title': title,
            'url': href,
            'domain': domain,
            'snippet': snippet[:300],
        })

    return results


def search_google(query: str, max_results: int = 5):
    url = f'https://www.google.com/search?q={quote_plus(query)}&hl=en'
    page = fetcher.get(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    })

    if page.status != 200:
        return []

    results = []
    seen_domains = set()

    for link in page.css('a[href^="http"]'):
        href = link.attrib.get('href', '')
        if 'google.com' in href or not href.startswith('http'):
            continue

        domain = extract_domain(href)
        if not domain or domain in seen_domains:
            continue
        seen_domains.add(domain)

        title_el = link.css('h3')
        title = clean_text(title_el[0].text) if title_el else ''

        parent = link.parent
        snippet_el = parent.css('.VwiC3b, [data-snf="x5v2E"], .lyLwlc') if parent else []
        snippet = clean_text(snippet_el[0].text) if snippet_el and snippet_el[0].text else ''

        results.append({
            'title': title,
            'url': href,
            'domain': domain,
            'snippet': snippet[:300],
        })

        if len(results) >= max_results:
            break

    return results


def search_company(query: str):
    ddg_results = search_duckduckgo(query, max_results=3)

    if ddg_results:
        best = ddg_results[0]
        return {
            'query': query,
            'name': best['title'],
            'domain': best['domain'],
            'url': best['url'],
            'snippet': best['snippet'],
            'source': 'duckduckgo',
        }

    gg_results = search_google(query, max_results=3)
    if gg_results:
        best = gg_results[0]
        return {
            'query': query,
            'name': best['title'],
            'domain': best['domain'],
            'url': best['url'],
            'snippet': best['snippet'],
            'source': 'google',
        }

    return {'query': query, 'name': '', 'domain': '', 'url': '', 'snippet': '', 'source': 'none'}
