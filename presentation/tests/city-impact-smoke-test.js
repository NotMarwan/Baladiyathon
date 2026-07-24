'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(
  path.join(__dirname, '..', 'athar-city-impact.html'),
  'utf8'
);
const Portfolio = require(path.join(__dirname, '..', 'athar-portfolio.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

ok('page carries the mandatory representative-scenario badge', () => {
  assert.ok(html.includes('id="badge-representative"'));
  assert.ok(html.includes(Portfolio.LABEL));
});

ok('page loads engine then portfolio scripts', () => {
  const engineAt = html.indexOf('athar-engine.js');
  const portfolioAt = html.indexOf('athar-portfolio.js');
  assert.ok(engineAt !== -1 && portfolioAt !== -1 && engineAt < portfolioAt);
});

ok('page has counter, 4 cards, chart, methodology section', () => {
  for (const id of [
    'counter-saved-veh-hours',
    'card-time-value',
    'card-co2',
    'card-person-hours',
    'card-dig-once',
    'chart-by-class',
    'section-methodology',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
});

ok('methodology declares equation, seed and permit count', () => {
  assert.ok(html.includes('تأخير كما قُدم'));
  assert.ok(html.includes(String(Portfolio.SEED)));
  assert.ok(html.includes('150'));
});

ok('no hand-written result numbers: dynamic slots are empty placeholders', () => {
  const counter = html.match(/id="counter-saved-veh-hours"[^>]*>([^<]*)</);
  assert.ok(counter && counter[1].trim().replace('—', '') === '', 'counter must be filled by JS only');
});

ok('page is RTL Arabic and fully offline (no external src/href assets)', () => {
  assert.ok(/dir="rtl"/.test(html));
  assert.ok(!/(?:src|link[^>]*href)="https?:/.test(html), 'no external assets');
});

console.log(`ALL CITY IMPACT SMOKE TESTS PASSED (${passed})`);
