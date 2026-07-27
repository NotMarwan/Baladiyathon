const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const root = path.resolve(__dirname, '..', '..');
  const out = path.join(root, 'output', 'submission');
  const html = path.join(out, 'masar-baladiyathon-judging-deck.html');
  const pdf = path.join(out, 'masar-baladiyathon-judging-deck.pdf');
  const qa = path.join(out, 'qa');
  fs.mkdirSync(qa, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto('file:///' + html.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => null))));
  const slides = page.locator('.slide');
  const count = await slides.count();
  const bounds = [];
  for (let i = 0; i < count; i += 1) {
    const slide = slides.nth(i);
    await slide.screenshot({ path: path.join(qa, `slide-${String(i + 1).padStart(2, '0')}.png`) });
    bounds.push(await slide.evaluate((element) => ({
      slide: element.dataset.slide,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
    })));
  }
  await page.pdf({ path: pdf, printBackground: true, preferCSSPageSize: true, tagged: true });
  fs.writeFileSync(path.join(qa, 'browser-check.json'), JSON.stringify({ count, errors, bounds }, null, 2));
  await browser.close();
  if (errors.length) throw new Error(errors.join('\n'));
  const overflow = bounds.filter((item) => item.scrollWidth > item.clientWidth || item.scrollHeight > item.clientHeight);
  if (overflow.length) throw new Error('slide overflow: ' + JSON.stringify(overflow));
  console.log(JSON.stringify({ pdf, count, errors: errors.length }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
