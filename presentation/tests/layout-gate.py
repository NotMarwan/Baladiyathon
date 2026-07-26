"""مسار — بوابة التخطيط.

تفتح كل صفحة على ثلاثة عروض وتسأل سؤالين لا يستطيع اختبار Node سؤالهما:
هل فاض شيء أفقياً، وهل صرخ شيء في الطرفية.

الفيض الأفقي في واجهة RTL ليس تجميلاً: يُزيح الجسد كله فيقع النص خارج
الشاشة من الجهة التي يُقرأ منها، ويجد المراجع نفسه يمرّر ليقرأ أول كلمة.

    python tests/layout-gate.py          # يخرج بـ 1 إن سقط شيء

تُشغَّل بعد كل دورة تمسّ CSS أو بنية صفحة.
"""
import asyncio
import json
import sys

from playwright.async_api import async_playwright

BASE = 'http://localhost:8734/'
WIDTHS = [390, 768, 1440]
PAGES = [
    'masar-desk.html', 'masar-map.html', 'masar-decision.html',
    'masar-city-impact.html', 'masar-sources.html', 'masar-lab.html',
    'masar-prototype.html', 'masar-pitch.html', 'masar-compare.html',
]

LAUNCH_ARGS = [
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
]

# خطأ الطرفية المتوقّع الوحيد: لا شيء. القائمة تبقى فارغة عمداً — استثناء
# يُضاف هنا قرار يُكتب سببه، لا نافذة تُترك مفتوحة.
ALLOWED_ERRORS = []


def tolerated(message):
    return any(fragment in message for fragment in ALLOWED_ERRORS)


async def main():
    failures = []

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, args=LAUNCH_ARGS)

        for width in WIDTHS:
            page = await browser.new_page(viewport={'width': width, 'height': 844})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console',
                    lambda m: errors.append(m.text) if m.type == 'error' else None)

            for name in PAGES:
                errors.clear()
                await page.goto(BASE + name, wait_until='load')
                await page.wait_for_timeout(1500)

                overflow = await page.evaluate(
                    '() => document.documentElement.scrollWidth - window.innerWidth')
                if overflow > 1:
                    failures.append(
                        {'page': name, 'width': width, 'overflowPx': overflow})

                # WP-G2 — سمة نمط موجودة في الترميز ولم تُطبَّق.
                #
                # سياسة أمن المحتوى في WP-D1 حجبت ثلاثاً وثلاثين سمة `style=""`
                # في صفحات المشروع **بصمت**: السمات الساكنة تُحجب دون سطر في
                # الطرفية، فلم يلتقطها فحص الأخطاء أعلاه، ولم تُنتج فيضاً.
                # عاشت البوابة خضراء فوق صفحات مكسورة.
                #
                # `element.style.length === 0` مع وجود السمة هو التوقيع الدقيق
                # لهذه الحالة، ولا يقع في غيرها.
                blocked = await page.evaluate(
                    '() => [...document.querySelectorAll("[style]")]'
                    '.filter(e => e.getAttribute("style").trim()'
                    ' && e.style.length === 0)'
                    '.map(e => e.tagName + "[" + e.getAttribute("style").slice(0, 40) + "]")')
                if blocked:
                    failures.append({'page': name, 'width': width,
                                     'blockedInlineStyles': blocked[:3]})

                loud = [message for message in errors if not tolerated(message)]
                if loud:
                    failures.append({'page': name, 'width': width, 'errors': loud[:3]})

            await page.close()
        await browser.close()

    if failures:
        print(json.dumps(failures, ensure_ascii=False, indent=1))
        print(f'\nسقطت {len(failures)} حالة')
        sys.exit(1)

    print(f'{len(PAGES)} صفحات × {len(WIDTHS)} عروض — لا فيض ولا خطأ')


asyncio.run(main())
