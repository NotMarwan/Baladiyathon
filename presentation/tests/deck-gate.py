"""مسار — بوابة العرض التقديمي (WP-G2).

العرض هو ما يراه المحكّم أولاً وآخراً، وكان **غير مفحوص تشغيلياً**: يقع خارج
جذر الخادم فيردّ عليه `403`، فلا يُفتح ولا يُقاس. وغير المتحقَّق يُحتسب فشلاً.

ما تسأله هذه البوابة ولا يستطيع اختبار Node سؤاله:

  · هل تُعرَض شريحة واحدة في كل لحظة، وهل ينتقل بينها زرّ لوحة المفاتيح فعلاً؟
  · هل يخرج طلب إلى مضيف خارجي أثناء التحميل؟
  · هل يفيض شيء أفقياً على جوّال أو لوح أو مكتب؟
  · هل يصرخ شيء في الطرفية؟

    python tests/deck-gate.py            # يخرج بـ 1 إن سقط شيء

تتطلّب الخادم يعمل على 8734.
"""
import asyncio
import sys

from playwright.async_api import async_playwright

BASE = 'http://localhost:8734'
DECK = BASE + '/submission/masar-baladiyathon-judging-deck.html'
WIDTHS = [390, 768, 1440]

LAUNCH_ARGS = [
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
]

# عدد الشرائح مثبَّت عمداً: شريحة تُحذف أو تُضاف بلا قصد تغيّر مدة العرض
# ونصيب كل فكرة منه. تغييره قرار يُكتب، لا انزلاق يُكتشف أمام اللجنة.
#
# القرار المكتوب: تسعة عشر ⟶ إحدى وعشرون في ٢٦ يوليو ٢٠٢٦. شريحتان أُضيفتا
# لاكتشافين حدثا بعد بناء العرض ولم يكن يعرفهما: حكم حمل البديل (١١٢ من ١٥٠
# لا يتحمّل)، وبرهان التبادلية (٥٧٦ منطقة عمل حكومية أجنبية بصفر أخطاء).
EXPECTED_SLIDES = 21

# سقف زمن التحميل. العرض يحمل نحو ميغابايتين من الصور المضمَّنة، فالسقف واسع
# — الغرض التقاط انهيار لا معايرة أداء.
MAX_LOAD_MS = 8000

# لا استثناء. قائمة فارغة عمداً: استثناء يُضاف هنا قرار يُكتب سببه.
ALLOWED_ERRORS = []


def tolerated(message):
    return any(fragment in message for fragment in ALLOWED_ERRORS)


async def main():
    failures = []

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(args=LAUNCH_ARGS)

        for width in WIDTHS:
            context = await browser.new_context(
                viewport={'width': width, 'height': 900})
            page = await context.new_page()

            errors = []
            external = []
            page.on('console', lambda m: errors.append(m.text)
                    if m.type == 'error' and not tolerated(m.text) else None)
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('request', lambda r: external.append(r.url)
                    if not r.url.startswith(BASE) and not r.url.startswith('data:')
                    else None)

            response = await page.goto(DECK, wait_until='load')
            if response is None or response.status != 200:
                status = 'بلا استجابة' if response is None else response.status
                failures.append(f'{width}: العرض لا يُقدَّم — {status}')
                await context.close()
                continue

            timing = await page.evaluate(
                '() => { const t = performance.getEntriesByType("navigation")[0];'
                ' return Math.round(t.loadEventEnd - t.startTime); }')
            if timing > MAX_LOAD_MS:
                failures.append(f'{width}: التحميل {timing}ms فوق السقف {MAX_LOAD_MS}')

            slides = await page.evaluate(
                '() => document.querySelectorAll(".slide").length')
            if slides != EXPECTED_SLIDES:
                failures.append(
                    f'{width}: {slides} شريحة لا {EXPECTED_SLIDES}')

            # العرض شريطٌ متمرّر بـ`scroll-snap`، لا مبدّل شرائح: كل الشرائح
            # `display:block` داخل حاوية واحدة. فالسؤال الصحيح ليس «كم شريحة
            # مرئية في DOM» بل **أيّ شريحة تملأ نافذة العرض الآن**.
            #
            # الصياغة الأولى لهذه البوابة سألت السؤال الخاطئ فأبلغت عن عيب لا
            # وجود له. بوابةٌ تبلّغ خطأً كاذباً تُفقد الثقة في تبليغها الصحيح.
            centre = ('() => { const y = innerHeight / 2;'
                      ' return [...document.querySelectorAll(".slide")]'
                      '.findIndex(s => { const r = s.getBoundingClientRect();'
                      ' return r.top <= y && r.bottom >= y; }); }')

            fills = await page.evaluate(
                '() => { const y = innerHeight / 2;'
                ' return [...document.querySelectorAll(".slide")]'
                '.filter(s => { const r = s.getBoundingClientRect();'
                ' return r.top <= y && r.bottom >= y; }).length; }')
            if fills != 1:
                failures.append(f'{width}: {fills} شريحة تملأ منتصف الشاشة')

            # التنقل: يُقاس بانتقال الشريحة التي تملأ الشاشة فعلاً، لا بوجود
            # مستمع حدث — مستمعٌ لا يفعل شيئاً يمرّ في فحص الوجود.
            await page.click('body')
            first = await page.evaluate(centre)
            await page.keyboard.press('ArrowRight')
            await page.wait_for_timeout(900)
            second = await page.evaluate(centre)
            if second != first + 1:
                failures.append(
                    f'{width}: ArrowRight نقل من {first} إلى {second} لا إلى {first + 1}')

            await page.keyboard.press('ArrowLeft')
            await page.wait_for_timeout(900)
            back = await page.evaluate(centre)
            if back != first:
                failures.append(f'{width}: ArrowLeft عاد إلى {back} لا إلى {first}')

            # الفيض يُقاس على الحاوية المتمرّرة كذلك: الجسد لا يتمرّر هنا،
            # فقياسه وحده يعطي صفراً دائماً ويخفي فيضاً حقيقياً داخل العرض.
            overflow = await page.evaluate(
                '() => { const d = document.getElementById("deck") '
                '|| document.documentElement;'
                ' return Math.max(document.documentElement.scrollWidth'
                ' - document.documentElement.clientWidth,'
                ' d.scrollWidth - d.clientWidth); }')
            if overflow > 0:
                failures.append(f'{width}: فيض أفقي {overflow}px')

            if external:
                failures.append(
                    f'{width}: طلب خارجي — {external[0]}')
            if errors:
                failures.append(f'{width}: خطأ طرفية — {errors[0]}')

            await context.close()

        await browser.close()

    if failures:
        print('سقطت بوابة العرض:')
        for item in failures:
            print('  ' + item)
        sys.exit(1)

    print(f'العرض: {EXPECTED_SLIDES} شريحة × {len(WIDTHS)} عروض — '
          'تنقّل يعمل، لا مضيف خارجي، لا فيض، لا خطأ')


asyncio.run(main())
