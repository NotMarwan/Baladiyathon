'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const tokens = fs.readFileSync(path.join(ROOT, 'athar-tokens.css'), 'utf8');

const REQUIRED = [
  '--athar-canvas', '--athar-surface', '--athar-surface-raised',
  '--athar-ink', '--athar-muted', '--athar-faint', '--athar-line',
  '--athar-primary', '--athar-primary-hover', '--athar-primary-soft',
  '--athar-accent', '--athar-accent-soft',
  '--athar-success', '--athar-success-soft',
  '--athar-warning', '--athar-warning-soft',
  '--athar-danger', '--athar-danger-soft',
  '--athar-info', '--athar-info-soft',
  '--athar-space-1', '--athar-space-2', '--athar-space-3',
  '--athar-space-4', '--athar-space-6', '--athar-space-8', '--athar-space-12',
  '--athar-radius-sm', '--athar-radius', '--athar-radius-lg',
  '--athar-row-h', '--athar-toolbar-h', '--athar-panel-w',
  '--athar-t-hover', '--athar-t-control', '--athar-t-panel', '--athar-t-map',
  '--athar-font', '--athar-font-mono',
];

ok('ملف الوسوم يعرّف كل وسم مطلوب', () => {
  for (const token of REQUIRED) {
    assert.ok(tokens.includes(token + ':'), `وسم مفقود: ${token}`);
  }
});

ok('صفحة الخريطة تستهلك الوسوم ولا تعرّف لوحتها الخاصة', () => {
  const css = fs.readFileSync(path.join(ROOT, 'athar-worksmap-page.css'), 'utf8');
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.strictEqual(hex.length, 0, `ألوان خام في تنسيق الصفحة: ${hex.join(', ')}`);
  assert.ok(css.includes('var(--athar-'), 'الصفحة لا تقرأ الوسوم');
});

ok('شريط التنقل فاتح ويقرأ الوسوم لا قيماً مثبتة', () => {
  const nav = fs.readFileSync(path.join(ROOT, 'athar-nav.js'), 'utf8');
  assert.ok(!nav.includes('#102535'), 'الشريط الداكن ما زال موجوداً');
  assert.ok(nav.includes('var(--athar-'), 'الشريط لا يقرأ الوسوم');
});

ok('الوسوم تحمل الخط العربي أولاً والأحادي للأرقام', () => {
  assert.ok(tokens.includes('Noto Sans Arabic'), 'الخط العربي مفقود');
  assert.ok(/--athar-font-mono:[^;]*monospace/.test(tokens), 'الخط الأحادي مفقود');
});

console.log(`\n${passed} اختبارات نجحت`);
