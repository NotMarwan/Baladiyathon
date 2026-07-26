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
  '--athar-on-ink', '--athar-success-on-ink',
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

/* ---- انتشار الهوية: كل صفحة داخل النظام، والانحراف مسقوف ---- */

/**
 * السقف لكل صفحة هو عدد الألوان الخام المسموح بها بعد التوحيد.
 * صفر مستحيل: ألوان طبقات الخريطة وثوابت الرسم في JS لا تقرأ متغيّرات CSS.
 * لكنها معدودة ومقصودة — ورفع أي سقف هنا قرار واعٍ لا انزلاق.
 */
const HEX_BUDGET = {
  'athar-home.html': 0,
  'athar-overview.html': 0,
  'athar-advanced.html': 0,
  'athar-desk.html': 0,
  'athar-map.html': 4,
  'athar-sources.html': 4,
  'athar-city-impact.html': 8,
  'athar-decision.html': 13,
  'athar-lab.html': 3,
  'athar-prototype.html': 12,
  'athar-pitch.html': 4,
  // تبويب مؤقّت — يُحذف سطره هنا مع الصفحة. صفر: المخطط كله من الوسوم.
  'athar-journey.html': 0,
};

ok('كل صفحة عائلة تستورد ملف الوسوم أو تحمّل الشريط الذي يحقنه', () => {
  Object.keys(HEX_BUDGET).forEach((page) => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(html.indexOf('athar-tokens.css') !== -1 || html.indexOf('athar-nav.js') !== -1,
      `${page} خارج نظام الوسوم`);
  });
});

ok('انحراف اللوحة مسقوف في كل صفحة', () => {
  Object.keys(HEX_BUDGET).forEach((page) => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const distinct = new Set((html.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((h) => h.toLowerCase()));
    assert.ok(distinct.size <= HEX_BUDGET[page],
      `${page}: ${distinct.size} لوناً خاماً، السقف ${HEX_BUDGET[page]} — `
      + [...distinct].join(' '));
  });
});

// شرائح العرض وحدها تحتفظ بالأسفلت الداكن: خلفية قاعة لا واجهة تشغيل.
const DARK_ALLOWED = ['athar-pitch.html'];

ok('لا صفحة تشغيل تعيد تعريف الشريط الداكن القديم', () => {
  Object.keys(HEX_BUDGET).forEach((page) => {
    if (DARK_ALLOWED.indexOf(page) !== -1) return;
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(html.indexOf('#102535') === -1, `${page} يحمل لون الشريط الداكن السابق`);
  });
});

/* ---- التباين: يُحسب هنا لا يُفترض ---- */

function hexOf(token) {
  const match = tokens.match(new RegExp(token + ':\\s*(#[0-9a-fA-F]{6})'));
  assert.ok(match, `لا قيمة سداسية للوسم ${token}`);
  return match[1];
}

function luminance(hex) {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

ok('كل لون نص يبلغ حد WCAG AA على السطوح الفاتحة', () => {
  const surfaces = ['--athar-surface', '--athar-surface-raised', '--athar-canvas', '--athar-primary-soft'];
  const inks = ['--athar-ink', '--athar-muted', '--athar-faint'];

  inks.forEach((ink) => {
    surfaces.forEach((surface) => {
      const ratio = contrast(hexOf(ink), hexOf(surface));
      assert.ok(ratio >= 4.5,
        `${ink} على ${surface} = ${ratio.toFixed(2)}:1 — دون 4.5 المطلوبة للنص الصغير`);
    });
  });
});

ok('ألوان الحالة تُقرأ على خلفياتها الناعمة', () => {
  ['success', 'warning', 'danger', 'info'].forEach((tone) => {
    const ratio = contrast(hexOf('--athar-' + tone), hexOf('--athar-' + tone + '-soft'));
    assert.ok(ratio >= 4.5, `نبرة ${tone} = ${ratio.toFixed(2)}:1 على خلفيتها`);
  });
});

ok('نصّا الشريط الداكن يبلغان الحد على الحبر', () => {
  // الشريط الوحيد الداكن في المنتج. نبرة النجاح الفاتحة عليه رقمٌ كبير لا نص
  // صغير، فيكفيها 3:1 — ونص الشريط العادي نصٌّ صغير يلزمه 4.5.
  const ink = hexOf('--athar-ink');
  const plain = contrast(hexOf('--athar-on-ink'), ink);
  assert.ok(plain >= 4.5, `نص الشريط على الحبر = ${plain.toFixed(2)}:1`);
  const figure = contrast(hexOf('--athar-success-on-ink'), ink);
  assert.ok(figure >= 3, `رقم الشريط على الحبر = ${figure.toFixed(2)}:1`);
});

ok('نص الزر الأساسي يُقرأ على لون الهوية', () => {
  const ratio = contrast('#ffffff', hexOf('--athar-primary'));
  assert.ok(ratio >= 4.5, `أبيض على الأساسي = ${ratio.toFixed(2)}:1`);
});

console.log(`\n${passed} اختبارات نجحت`);
