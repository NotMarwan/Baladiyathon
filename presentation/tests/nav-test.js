'use strict';
/**
 * مسار — حارس هيكل التنقل.
 * ---------------------------------------------------------------------------
 * القاعدة التي يفرضها هذا الملف: **الشريط مسار لا فهرس.** خمسة أقسام على
 * الأكثر، والدليل خلف باب واحد. وثمانية تبويبات متساوية — كما كان — تجعل
 * الداخل يقرأ قائمة مواضيع لا يعرف من أين يبدأ فيها.
 *
 * والقاعدة الثانية: **لا صفحة يتيمة.** كل صفحة من العائلة يصلها إما الشريط
 * وإما قسم «التفاصيل المتقدمة». تقليل التبويبات لا يجوز أن يقطع صفحةً عن
 * الوصول — فذلك حذفٌ بغير اسمه.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const navJs = fs.readFileSync(path.join(ROOT, 'masar-nav.js'), 'utf8');
const Catalog = require(path.join(ROOT, 'masar-catalog.js'));

const MAIN = [
  'masar-home.html',
  'masar-map.html',
  'masar-desk.html',
  'masar-overview.html',
  'masar-advanced.html',
];

/** كل صفحة من العائلة: الشريط + المتقدمة. */
const family = MAIN.concat(Catalog.ADVANCED.map((page) => page.file));

const MAX_MAIN = 5;

ok('الشريط لا يتجاوز خمسة أقسام', () => {
  const links = navJs.match(/\{\s*file:\s*'masar-[^']+'/g) || [];
  assert.ok(links.length <= MAX_MAIN,
    `${links.length} قسماً في الشريط — السقف ${MAX_MAIN}`);
});

ok('الأقسام الخمسة بترتيبها: الرئيسية ثم الخريطة ثم المكتب ثم النظرة ثم المتقدمة', () => {
  const order = MAIN
    .map((page) => ({ page, at: navJs.indexOf(`'${page}'`) }))
    .filter((entry) => entry.at !== -1)
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.page);
  assert.deepStrictEqual(order, MAIN, 'ترتيب الأقسام لا يتبع المسار');
});

ok('كل صفحة عائلة تحمّل الشريط', () => {
  family.forEach((page) => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(html.includes('src="masar-nav.js"'), `${page} لا يحمّل الشريط`);
  });
});

ok('لا صفحة يتيمة: ما ليس في الشريط يصله قسم التفاصيل المتقدمة', () => {
  const advanced = fs.readFileSync(path.join(ROOT, 'masar-advanced.html'), 'utf8');
  const orphans = family.filter((page) => {
    if (MAIN.indexOf(page) !== -1) return false;
    return advanced.indexOf('href="' + page + '"') === -1;
  });
  assert.deepStrictEqual(orphans, [], `صفحات يتيمة: ${orphans.join('، ')}`);
});

ok('التسميات عربية والصفحة الحالية معلَّمة', () => {
  assert.ok(navJs.includes('aria-current'), 'لا تعليم للصفحة الحالية');
  ['الرئيسية', 'الخريطة', 'مكتب المراجع', 'نظرة عامة', 'التفاصيل المتقدمة']
    .forEach((label) => {
      assert.ok(navJs.includes(label), `تسمية مفقودة: ${label}`);
    });
});

/**
 * الصفحة المتقدمة تُعلِّم قسمها لا نفسها: من فتح «سجل المصادر» من قسم
 * المتقدمة يجب أن يعرف أين هو من الهيكل، وإلا بدا الشريط بلا موضع حالي فيظنّ
 * أنه خرج من المنتج.
 */
ok('صفحات القسم المتقدم تُعلِّم قسمها في الشريط', () => {
  assert.ok(navJs.indexOf('ADVANCED_PAGES') !== -1, 'لا قائمة لصفحات القسم المتقدم');
  assert.ok(navJs.indexOf("data-section") !== -1, 'لا تعليم للقسم الحالي');

  const listed = (navJs.match(/'masar-[a-z-]+\.html'/g) || [])
    .map((s) => s.replace(/'/g, ''));
  Catalog.ADVANCED.forEach((page) => {
    assert.ok(listed.indexOf(page.file) !== -1,
      `${page.file} في الفهرس وليست في قائمة الشريط`);
  });
});

ok('قائمة الشريط للمتقدمة تطابق الفهرس — لا فرع يتقادم', () => {
  const block = navJs.slice(navJs.indexOf('var ADVANCED_PAGES'),
    navJs.indexOf('var current'));
  const inNav = (block.match(/'masar-[a-z-]+\.html'/g) || []).map((s) => s.replace(/'/g, ''));
  const inCatalog = Catalog.ADVANCED.map((page) => page.file);
  assert.deepStrictEqual(inNav.slice().sort(), inCatalog.slice().sort(),
    'قائمة الشريط والفهرس مختلفتان');
});

ok('الشريط يقرأ الوسوم ولا يعرّف لوحته', () => {
  assert.ok(navJs.includes('var(--masar-'), 'الشريط لا يقرأ الوسوم');
});

console.log(`ALL NAV TESTS PASSED (${passed})`);
