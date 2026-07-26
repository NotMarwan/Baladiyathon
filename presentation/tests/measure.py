"""مسار — مقياس الحلقة.

يقيس ما يراه المراجع لا ما يقيسه الخادم: متى يظهر أول شيء، ومتى يصبح
صندوق الأعمال قابلاً للاستعمال، ومتى تكتمل الخريطة — عند ثلاث سرعات معالج.

    python tests/measure.py                 # المكتب، ثلاث سرعات
    python tests/measure.py --page masar-map.html --cpu 6

الخرج JSON على stdout ويُلحق بـ tests/measure-ledger.json حتى يكون
لكل دورة رقم «قبل» و«بعد» لا انطباع.
"""
import argparse
import asyncio
import json
import os
import time

from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
LEDGER = os.path.join(HERE, 'measure-ledger.json')
BASE = 'http://localhost:8734/'

# أول إطار مفيد لكل صفحة: العنصر الذي يعني «الأداة صارت مستعملة».
READY_SELECTOR = {
    'masar-desk.html': '#deskList [data-work-id]',
    'masar-map.html': '#wmStat',
}

# الخريطة جاهزة: لكل صفحة مقبضها الخاص، ولا صفحة تنتظر مقبض أخرى.
MAP_READY = {
    'masar-desk.html': ('() => window.__masarDesk && window.__masarDesk.map'
                        ' && window.__masarDesk.map.map.loaded()'),
    'masar-map.html': ('() => window.__masarWorksMap'
                       ' && window.__masarWorksMap.map.loaded()'),
}

# مهلة واحدة قصيرة نسبياً: القياس الفاشل يجب أن يفشل بسرعة ليُقرأ كفشل.
TIMEOUT_MS = 45000

LAUNCH_ARGS = [
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox', '--no-sandbox',
]


async def measure_once(browser, page_name, cpu_rate, shot_at_ms=0):
    page = await browser.new_page(viewport={'width': 1440, 'height': 900})
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))

    cdp = await page.context.new_cdp_session(page)
    if cpu_rate > 1:
        await cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu_rate})

    started = time.time()
    await page.goto(BASE + page_name, wait_until='commit')

    result = {'page': page_name, 'cpu': cpu_rate}

    async def timed(key, awaitable):
        """كل انتظار يقيس نفسه. انتظار يفشل لا يُزيح رقم جاره."""
        try:
            await awaitable
            result[key] = round(time.time() - started, 2)
        except Exception:
            result[key] = None

    waits = [timed('load_s', page.wait_for_load_state('load', timeout=TIMEOUT_MS))]

    selector = READY_SELECTOR.get(page_name)
    if selector:
        waits.append(timed('usable_s', page.wait_for_selector(
            selector, timeout=TIMEOUT_MS, state='attached')))

    # ماذا يرى المراجع عند ثانية بعينها.
    # -----------------------------------------------------------------------
    # استطلاع المُحدِّدات يمر بالخيط الرئيسي، والخيط تحت الخنق مشغول بفكّ
    # البيانات — فيقيس انشغال الخيط لا ظهور العنصر، ويعطي رقماً يبدو دقيقاً
    # وهو كاذب. اللقطة تأتي من عملية التصيير مباشرة فتقول ما على الشاشة فعلاً.
    if shot_at_ms:
        async def snap():
            await asyncio.sleep(shot_at_ms / 1000.0)
            shots = os.path.join(HERE, 'shots')
            os.makedirs(shots, exist_ok=True)
            name = '%s-cpu%d-%dms.png' % (page_name.replace('.html', ''), cpu_rate, shot_at_ms)
            await page.screenshot(path=os.path.join(shots, name))
            result['shot'] = name
        waits.append(snap())

    ready = MAP_READY.get(page_name)
    if ready:
        waits.append(timed('map_ready_s', page.wait_for_function(ready, timeout=TIMEOUT_MS)))

    await asyncio.gather(*waits)

    # الرسم الأول المحتوي: الرقم الذي يفصل «الصفحة معطلة» عن «الصفحة تعمل».
    paint = await page.evaluate(
        "() => { const e = performance.getEntriesByName('first-contentful-paint')[0];"
        " return e ? Math.round(e.startTime) : null; }")
    result['fcp_ms'] = paint

    result['bytes_kb'] = await page.evaluate(
        "() => Math.round(performance.getEntriesByType('resource')"
        ".reduce((sum, r) => sum + (r.transferSize || r.encodedBodySize || 0), 0) / 1024)")

    result['errors'] = errors[:5]
    await page.close()
    return result


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--page', default='masar-desk.html')
    parser.add_argument('--cpu', type=int, nargs='*', default=[1, 4, 6])
    parser.add_argument('--label', default='')
    parser.add_argument('--shot-at', type=int, default=0, dest='shot_at',
                        help='لقطة عند هذا الزمن بالملّي — ما يراه المراجع لا ما يقوله المؤقت')
    args = parser.parse_args()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=LAUNCH_ARGS)
        runs = [await measure_once(browser, args.page, rate, args.shot_at)
                for rate in args.cpu]
        await browser.close()

    entry = {'label': args.label, 'at': time.strftime('%Y-%m-%d %H:%M'), 'runs': runs}
    print(json.dumps(runs, ensure_ascii=False, indent=1))

    ledger = []
    if os.path.exists(LEDGER):
        try:
            with open(LEDGER, encoding='utf-8') as handle:
                ledger = json.load(handle)
        except Exception:
            ledger = []
    ledger.append(entry)
    with open(LEDGER, 'w', encoding='utf-8') as handle:
        json.dump(ledger, handle, ensure_ascii=False, indent=1)


asyncio.run(main())
