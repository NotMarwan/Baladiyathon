const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const root = path.resolve(__dirname, '..', '..');
  const out = path.join(root, 'output', 'submission');
  const source = path.join(out, 'athar-baladiyathon-judging-deck.html');
  const temp = path.join(__dirname, 'masar-pdf-only.html');
  const pdf = path.join(out, 'athar-baladiyathon-judging-deck.pdf');
  let html = fs.readFileSync(source, 'utf8');
  const replacements = [
    ['<title>أثر —', '<title>مسار —'],
    ['<h1>أثر</h1>', '<h1>مسار</h1>'],
    ['مشروع أثر · فريق مسار', 'مشروع مسار · فريق مسار'],
    ['<h2>أثر يحوّل بيانات الإغلاق', '<h2>مسار يحوّل بيانات الإغلاق'],
    ['<h2>أثر يربط الأطراف', '<h2>مسار يربط الأطراف'],
    ['ما تضيفه أثر', 'ما يضيفه مسار'],
    ['<span class="source">أثر · فريق مسار</span>', '<span class="source">مسار · فريق مسار</span>'],
  ];
  for (const [from, to] of replacements) html = html.replaceAll(from, to);
  fs.writeFileSync(temp, html, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('file:///' + temp.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => null))));
  await page.pdf({ path: pdf, printBackground: true, preferCSSPageSize: true, tagged: true });
  await browser.close();
  console.log(pdf);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
