import asyncio
import json
from urllib.parse import urlparse
from pathlib import Path

from playwright.async_api import async_playwright

BASE = Path(r"C:\\Users\\wasan\\Downloads\\Swarm\\Baladiyathon\\CODEX 5.3 WORK")
RAW = BASE / 'raw-scrape'
SHOTS = BASE / 'screenshots'
REV = BASE / 'reverse-engineering'
for p in [RAW, SHOTS, REV]:
    p.mkdir(parents=True, exist_ok=True)

urls = [
    'https://balady.gov.sa/ar/services/11722',
    'https://www.balady.gov.sa/ar/services/%D8%AA%D8%B5%D8%A7%D8%B1%D9%8A%D8%AD-%D8%A3%D8%B9%D9%85%D8%A7%D9%84-%D8%A8%D9%86%D9%8A%D8%A9-%D8%A7%D9%84%D8%AA%D8%AD%D8%AA%D9%8A%D9%87',
    'https://us.one.network/',
    'https://us.one.network/product/traffic-management/',
    'https://www.symology.co.uk/aurora/',
    'https://www.symology.co.uk/project-items/aurora-for-street-works-authorities/',
    'https://www.myworksites.com/en-nz/',
    'https://opengov.com/products/permitting-and-licensing/right-of-way-permitting/',
    'https://assetlifecycle.trimble.com/en/products/software/cityworks-permitting-licensing-land',
    'https://www.waze.com/wazeforcities/',
    'https://www.haasalert.com/',
    'https://www.haasalert.com/construction',
    'https://prompt.lta.gov.sg/WebUIPWAS/',
    'https://www.ditto.site',
    'https://us.ditto.site/',
    'https://x.com/AbeerAlhasan/status/2080305047909302508?s=20',
    'https://example.com/'
]

viewports = [
    ('desktop', 1440, 2400),
    ('mobile', 390, 2200),
]


def safe_name(url):
    p = urlparse(url)
    host = p.netloc.replace('.', '-').replace(':', '-') or 'site'
    path = (p.path.strip('/') or 'home').replace('/', '-').replace('%', '').replace('-', '_')
    if not path:
        path = 'home'
    fname = f"{host}_{path}".lower()
    fname = ''.join(c if c.isalnum() or c in '._-' else '_' for c in fname)
    if len(fname) > 90:
        fname = fname[:90]
    return fname


async def capture(url, page):
    record = {
        'url': url,
        'status': 'ok',
        'error': None,
        'title': None,
        'meta_description': None,
        'h1': [],
        'top_sections': [],
        'primary_links': [],
        'cta_texts': [],
        'theme_colors': [],
        'screenshots': []
    }

    try:
        await page.set_viewport_size({'width': 1440, 'height': 2400})
        resp = await page.goto(url, wait_until='domcontentloaded', timeout=45000)
        if resp is None:
            record['status'] = 'no-response'
        else:
            record['status'] = f"{resp.status}"

        try:
            await page.wait_for_load_state('networkidle', timeout=20000)
        except Exception:
            pass

        selectors = [
            'button:has-text("Accept")',
            'button:has-text("Agree")',
            'button:has-text("الموافقة")',
            'button:has-text("قبول")',
            'button:has-text("Accept All")',
            'button:has-text("Accept all")',
            '[aria-label="Accept"]',
        ]
        for s in selectors:
            try:
                btn = page.locator(s).first
                if await btn.count():
                    await btn.click(timeout=1000)
                    await page.wait_for_timeout(300)
                    break
            except Exception:
                pass

        record['title'] = await page.title()
        record['meta_description'] = await page.eval_on_selector("meta[name='description']", "el => el?.content || null")

        h1 = await page.locator('h1').all_text_contents()
        record['h1'] = [x.strip() for x in h1[:10] if x.strip()]

        links = await page.eval_on_selector_all('a', 'els => els.slice(0, 80).map(el => (el.innerText || "").trim())')
        clean_links = [x for x in links if x and len(x) < 80]
        record['primary_links'] = list(dict.fromkeys(clean_links))[:20]

        ctas = await page.eval_on_selector_all(
            'button, a[href]',
            '''els =>
            els
            .map(el => (el.innerText || "").replace(/\s+/g, " ").trim())
            .filter(x => x && (x.length > 0) &&
            ( /apply|ابدأ|get started|book|request|sign in|login|تسجيل|اشترك|learn more|send|submit|download|start|get\b|submit/i.test(x) || x.length > 10 ))
            '''
        )
        record['cta_texts'] = list(dict.fromkeys([x for x in (ctas or []) if x]))[:20]

        colors = await page.evaluate('''() => {
            const out = new Set();
            const styles = getComputedStyle(document.documentElement);
            for (const name of Array.from(styles)) {
                if (name.startsWith('--')) {
                    const val = styles.getPropertyValue(name).trim();
                    if (/^#|rgb\(|hsl\(/.test(val)) out.add(val);
                }
            }
            return Array.from(out).slice(0, 30);
        }''')
        record['theme_colors'] = colors[:15]

        sections = await page.eval_on_selector_all('main, section, header, nav, footer, article',
            'els => els.map(el => (el.getAttribute("aria-label") || el.id || (el.className || "").toString().slice(0, 80) || "").slice(0, 80)).filter(Boolean)')
        record['top_sections'] = [s[:80] for s in list(dict.fromkeys(sections))[:30]]

        for label, w, h in viewports:
            await page.set_viewport_size({'width': w, 'height': h})
            await page.wait_for_timeout(500)
            fname = safe_name(url) + f"_{label}.png"
            fpath = SHOTS / fname
            await page.screenshot(path=str(fpath), full_page=True)
            record['screenshots'].append({'viewport': label, 'width': w, 'height': h, 'file': fpath.name})

    except Exception as e:
        record['status'] = 'error'
        record['error'] = str(e)
        try:
            await page.set_viewport_size({'width': 1440, 'height': 1600})
            fallback = safe_name(url) + '_error.png'
            fpath = SHOTS / fallback
            await page.screenshot(path=str(fpath), full_page=True)
            record['screenshots'].append({'viewport': 'fallback', 'file': fpath.name})
        except Exception:
            pass

    return record


async def main():
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
        page = await context.new_page()

        for i, url in enumerate(urls, 1):
            print(f"[{i}/{len(urls)}] {url}")
            data = await capture(url, page)
            results.append(data)

        await context.close()
        await browser.close()

    out = RAW / 'design_capture_results.json'
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')

    md = ['# Design capture inventory', '']
    for r in results:
        md.append(f"- URL: {r['url']}")
        md.append(f"  - status: {r['status']}")
        if r.get('title'):
            md.append(f"  - title: {r['title']}")
        if r.get('meta_description'):
            md.append(f"  - description: {r['meta_description'][:140]}")
        if r.get('h1'):
            md.append('  - h1: ' + ' | '.join(r['h1'][:5]))
        if r.get('cta_texts'):
            md.append('  - cta: ' + ' | '.join(r['cta_texts'][:8]))
        if r.get('top_sections'):
            md.append('  - sections: ' + ' | '.join(r['top_sections'][:8]))
        if r.get('screenshots'):
            md.append('  - screenshots: ' + ', '.join(s['file'] for s in r['screenshots']))
        if r.get('error'):
            md.append(f"  - error: {r['error']}")
        md.append('')
    (RAW / 'design_capture_results.md').write_text('\n'.join(md), encoding='utf-8')


if __name__ == '__main__':
    asyncio.run(main())
