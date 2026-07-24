'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const pages = [
  'athar-desk.html',
  'athar-decision.html',
  'athar-map.html',
  'athar-prototype.html',
  'athar-lab.html',
  'athar-city-impact.html',
  'athar-sources.html',
];
const navJs = fs.readFileSync(path.join(__dirname, '..', 'athar-nav.js'), 'utf8');

ok('الشريط يربط كل صفحات العائلة', () => {
  for (const page of pages) {
    assert.ok(navJs.includes(`"${page}"`), `nav missing link to ${page}`);
  }
});

ok('كل صفحة عائلة تحمّل athar-nav.js', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.ok(html.includes('src="athar-nav.js"'), `${page} does not load nav`);
  }
});

ok('الشريط يعلّم الصفحة الحالية بتسميات عربية', () => {
  assert.ok(navJs.includes('aria-current'));
  for (const label of ['مكتب المراجع', 'شاشة القرار', 'الخريطة', 'النموذج التفاعلي', 'مختبر الابتكار', 'لوحة أثر المدينة', 'سجل المصادر']) {
    assert.ok(navJs.includes(label), `missing label ${label}`);
  }
});

ok('لا صفحة يتيمة: كل صفحة عائلة يصلها الشريط', () => {
  const orphans = pages.filter((page) => !navJs.includes(`"${page}"`));
  assert.deepStrictEqual(orphans, [], `صفحات يتيمة: ${orphans.join(', ')}`);
});

ok('مكتب المراجع أول تبويب — المحكّم يفتح المنتج لا العرض', () => {
  const order = pages
    .map((page) => ({ page, at: navJs.indexOf(`"${page}"`) }))
    .filter((entry) => entry.at !== -1)
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.page);
  assert.strictEqual(order[0], 'athar-desk.html');
});

console.log(`ALL NAV TESTS PASSED (${passed})`);
