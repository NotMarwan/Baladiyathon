'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const pages = ['athar-prototype.html', 'athar-lab.html', 'athar-city-impact.html', 'athar-map.html'];
const navJs = fs.readFileSync(path.join(__dirname, '..', 'athar-nav.js'), 'utf8');

ok('nav module links exactly the four family pages', () => {
  for (const page of pages) {
    assert.ok(navJs.includes(`"${page}"`), `nav missing link to ${page}`);
  }
});

ok('all four pages load athar-nav.js', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.ok(html.includes('src="athar-nav.js"'), `${page} does not load nav`);
  }
});

ok('nav marks the current page and uses Arabic labels', () => {
  assert.ok(navJs.includes('aria-current'));
  for (const label of ['النموذج التفاعلي', 'مختبر الابتكار', 'لوحة أثر المدينة', 'الخريطة']) {
    assert.ok(navJs.includes(label), `missing label ${label}`);
  }
});

console.log(`ALL NAV TESTS PASSED (${passed})`);
