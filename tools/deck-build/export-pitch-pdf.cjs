/*
 * PDF عرض المنصة — ثلاث عشرة شريحة.
 * ---------------------------------------------------------------------------
 * `masar-pitch-deck.html` كان يُبنى بأمر (`build-pitch-deck.js`)، وPDFه يُولَّد
 * **بلا أمر** — يدوياً من متصفّح. ونتيجته المحتومة وقعت: قيس الـPDF أقدم من
 * مصدره بـ461 دقيقة، أي أن الملف المرفوع كان يعرض عرضاً سابقاً. وهذا عين ما
 * أصابه الفريق الأحمر في الدورة الماضية على العرض التفصيلي (#10)، ثم تكرّر هنا
 * لأن الإصلاح كان انضباطاً مكتوباً لا أمراً قابلاً للتشغيل.
 *
 * التشغيل: node tools/deck-build/export-pitch-pdf.cjs
 * والبوابة التي تكشف تقادمه: `presentation/tests/submission-deck-test.js`.
 */
const fs = require('fs');
const path = require('path');
const { launchBrowser } = require('./launch-browser.cjs');

(async () => {
  const root = path.resolve(__dirname, '..', '..');
  const out = path.join(root, 'output', 'submission');
  const source = path.join(out, 'masar-pitch-deck.html');
  const pdf = path.join(out, 'masar-pitch-deck.pdf');

  if (!fs.existsSync(source)) {
    throw new Error(`المصدر غير موجود: ${source}\n`
      + '  ابنِه أولاً: node presentation/scripts/build-pitch-deck.js');
  }

  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const problems = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });

  await page.goto('file:///' + source.replace(/\\/g, '/'), { waitUntil: 'load' });
  /* الصور تُفكّ قبل الطباعة. الطباعة قبل فكّها تعطي شرائح بمربّعات فارغة —
     وهي أسوأ من غياب الصورة لأنها تبدو عطلاً في التصميم. */
  await page.evaluate(() => Promise.all(
    [...document.images].map((img) => img.decode().catch(() => null))
  ));

  const slides = await page.locator('.slide').count();
  await page.pdf({ path: pdf, printBackground: true, preferCSSPageSize: true, tagged: true });
  await browser.close();

  if (problems.length) throw new Error('أخطاء صفحة أثناء التصيير:\n  ' + problems.join('\n  '));
  console.log(JSON.stringify({ pdf, slides, bytes: fs.statSync(pdf).size }));
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
