'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const tokens = fs.readFileSync(path.join(ROOT, 'masar-tokens.css'), 'utf8');

const REQUIRED = [
  '--masar-canvas', '--masar-surface', '--masar-surface-raised',
  '--masar-ink', '--masar-muted', '--masar-faint', '--masar-line',
  '--masar-primary', '--masar-primary-hover', '--masar-primary-soft',
  '--masar-accent', '--masar-accent-soft',
  '--masar-success', '--masar-success-soft',
  '--masar-warning', '--masar-warning-soft',
  '--masar-danger', '--masar-danger-soft',
  '--masar-info', '--masar-info-soft',
  '--masar-on-ink', '--masar-success-on-ink',
  '--masar-space-1', '--masar-space-2', '--masar-space-3',
  '--masar-space-4', '--masar-space-6', '--masar-space-8', '--masar-space-12',
  '--masar-radius-sm', '--masar-radius', '--masar-radius-lg',
  '--masar-row-h', '--masar-toolbar-h', '--masar-panel-w',
  '--masar-t-hover', '--masar-t-control', '--masar-t-panel', '--masar-t-map',
  '--masar-font', '--masar-font-mono',
];

ok('ملف الوسوم يعرّف كل وسم مطلوب', () => {
  for (const token of REQUIRED) {
    assert.ok(tokens.includes(token + ':'), `وسم مفقود: ${token}`);
  }
});

ok('صفحة الخريطة تستهلك الوسوم ولا تعرّف لوحتها الخاصة', () => {
  const css = fs.readFileSync(path.join(ROOT, 'masar-worksmap-page.css'), 'utf8');
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.strictEqual(hex.length, 0, `ألوان خام في تنسيق الصفحة: ${hex.join(', ')}`);
  assert.ok(css.includes('var(--masar-'), 'الصفحة لا تقرأ الوسوم');
});

ok('شريط التنقل فاتح ويقرأ الوسوم لا قيماً مثبتة', () => {
  const nav = fs.readFileSync(path.join(ROOT, 'masar-nav.js'), 'utf8');
  assert.ok(!nav.includes('#102535'), 'الشريط الداكن ما زال موجوداً');
  assert.ok(nav.includes('var(--masar-'), 'الشريط لا يقرأ الوسوم');
});

ok('الوسوم تحمل الخط العربي أولاً والأحادي للأرقام', () => {
  assert.ok(tokens.includes('Noto Sans Arabic'), 'الخط العربي مفقود');
  assert.ok(/--masar-font-mono:[^;]*monospace/.test(tokens), 'الخط الأحادي مفقود');
});

/* ---- انتشار الهوية: كل صفحة داخل النظام، والانحراف مسقوف ---- */

/**
 * السقف لكل صفحة هو عدد الألوان الخام المسموح بها بعد التوحيد.
 * صفر مستحيل: ألوان طبقات الخريطة وثوابت الرسم في JS لا تقرأ متغيّرات CSS.
 * لكنها معدودة ومقصودة — ورفع أي سقف هنا قرار واعٍ لا انزلاق.
 */
const HEX_BUDGET = {
  'masar-home.html': 0,
  'masar-overview.html': 0,
  'masar-advanced.html': 0,
  'masar-desk.html': 0,
  'masar-map.html': 4,
  'masar-sources.html': 4,
  'masar-city-impact.html': 8,
  'masar-decision.html': 13,
  'masar-lab.html': 3,
  'masar-prototype.html': 12,
  'masar-pitch.html': 4,
  // تبويب مؤقّت — يُحذف سطره هنا مع الصفحة. صفر: المخطط كله من الوسوم.
  'masar-journey.html': 0,
};

/**
 * الاستيراد يُفحص **وسماً** لا ذِكراً.
 * ---------------------------------------------------------------------------
 * الصيغة السابقة كانت `html.indexOf('masar-tokens.css') !== -1`. و`masar-pitch.html`
 * يحمل الاسم في **تعليق CSS** («بقية الأدوار من masar-tokens.css كي لا تتفرّق
 * الهوية عن المنتج») بلا وسم `<link>` واحد. فمرّ الحارس على نيّةٍ مكتوبة، بينما
 * الصفحة تُصيَّر بلا هوية: كل `var(--masar-*)` غير معرَّف، فتسقط الخلفية والسطح
 * والحدّ ولون العَلَم — على **الملف الوحيد الذي يقف أمام اللجنة**.
 *
 * نجا من ١٣٦٦ فحصاً لأن الحارس كان يقرأ ذِكراً. والحارس الذي يقبل الذِّكر بدل
 * الحِمل يحرس الوثيقة لا الصفحة.
 */
const TOKEN_LINK = /<link\b[^>]*\bhref\s*=\s*["'][^"']*masar-tokens\.css["']/i;
const NAV_SCRIPT = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*masar-nav\.js["']/i;

ok('كل صفحة عائلة تستورد ملف الوسوم أو تحمّل الشريط الذي يحقنه', () => {
  Object.keys(HEX_BUDGET).forEach((page) => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(TOKEN_LINK.test(html) || NAV_SCRIPT.test(html),
      `${page} خارج نظام الوسوم — لا وسم <link> للوسوم ولا <script> للشريط `
      + '(ذِكر الاسم في تعليق لا يحمّل شيئاً)');
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
const DARK_ALLOWED = ['masar-pitch.html'];

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
  const surfaces = ['--masar-surface', '--masar-surface-raised', '--masar-canvas', '--masar-primary-soft'];
  const inks = ['--masar-ink', '--masar-muted', '--masar-faint'];

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
    const ratio = contrast(hexOf('--masar-' + tone), hexOf('--masar-' + tone + '-soft'));
    assert.ok(ratio >= 4.5, `نبرة ${tone} = ${ratio.toFixed(2)}:1 على خلفيتها`);
  });
});

ok('نصّا الشريط الداكن يبلغان الحد على الحبر', () => {
  // الشريط الوحيد الداكن في المنتج. نبرة النجاح الفاتحة عليه رقمٌ كبير لا نص
  // صغير، فيكفيها 3:1 — ونص الشريط العادي نصٌّ صغير يلزمه 4.5.
  const ink = hexOf('--masar-ink');
  const plain = contrast(hexOf('--masar-on-ink'), ink);
  assert.ok(plain >= 4.5, `نص الشريط على الحبر = ${plain.toFixed(2)}:1`);
  const figure = contrast(hexOf('--masar-success-on-ink'), ink);
  assert.ok(figure >= 3, `رقم الشريط على الحبر = ${figure.toFixed(2)}:1`);
});

ok('نص الزر الأساسي يُقرأ على لون الهوية', () => {
  const ratio = contrast('#ffffff', hexOf('--masar-primary'));
  assert.ok(ratio >= 4.5, `أبيض على الأساسي = ${ratio.toFixed(2)}:1`);
});

console.log(`\n${passed} اختبارات نجحت`);
