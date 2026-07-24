const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const root = path.resolve(__dirname, '..', '..');
  const input = path.join(__dirname, 'diagram-assets.html');
  const out = path.join(root, 'output', 'submission');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
  await page.goto('file:///' + input.replace(/\\/g, '/'));
  const jobs = [
    ['#actors', 'athar-actors-use-cases.png'],
    ['#sequence', 'athar-target-operating-sequence.png'],
    ['#reviewer', 'athar-reviewer-decision-journey.png'],
  ];
  for (const [selector, name] of jobs) {
    await page.locator(selector).screenshot({ path: path.join(out, name) });
  }
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
