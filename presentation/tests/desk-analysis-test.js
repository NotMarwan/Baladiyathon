/**
 * أثر — حارس «رقم واحد لكمية واحدة».
 * ---------------------------------------------------------------------------
 * بطاقةُ السجل على الخريطة تقرأ ما كتبه `scripts/build-city-portfolio.js` مع
 * كل تصريح. وملفُ القرار في المكتب يحسبه في المتصفح. فإن اختلف الحسابان ولو
 * بواحد بالمئة، عرض المنتجُ الواحد رقمين لكمية واحدة — وهو عطب ثقة لا عطب
 * دقة: المراجع الذي يرى ٢٣٬٧٥٢ هنا و٢٣٬٧٠٧ هناك لا يعرف أيّهما يوقّع عليه.
 *
 * وقد وقع فعلاً: المكتب كان يضرب نافذة يوم كامل في عدد الأيام، والمحفظة تقرأ
 * `optimize().baseline` الذي يبني نوافذه من المدة الكلية فتكون الأخيرة ناقصةً
 * حين لا تنتهي المدة على حدّ اليوم. ١٣٢ من ١٥٠ سجلاً اختلفت.
 *
 * هذا الملف يقارن الحسابين على المحفظة كلها. لا عيّنة — كل تصريح.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const Engine = require(path.join(ROOT, 'athar-engine.js'));
const Analysis = require(path.join(ROOT, 'athar-desk-analysis.js'));

/* المحفظة ملف متصفح (`window.ATHAR_CITY_PORTFOLIO = …`) — يُقرأ بمضيف صغير. */
function loadPortfolio() {
  const source = fs.readFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson.js'), 'utf8');
  const sandbox = { window: {}, self: undefined };
  sandbox.self = sandbox.window;
  // eslint-disable-next-line no-new-func
  new Function('window', 'self', source)(sandbox.window, sandbox.window);
  return sandbox.window.ATHAR_CITY_PORTFOLIO;
}

const portfolio = loadPortfolio();
let failures = 0;

function ok(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.error('not ok - ' + name);
    console.error('  ' + err.message);
  }
}

ok('المحفظة موجودة وفيها ١٥٠ تصريحاً', () => {
  assert.ok(portfolio && Array.isArray(portfolio.features));
  assert.strictEqual(portfolio.features.length, 150);
});

/* ---- التطابق مع الأرقام المنشورة ---- */

const rows = portfolio.features.map((feature) => {
  const p = feature.properties;
  const analysis = Analysis.evaluate(p, Engine);
  const best = analysis.alternatives[0] || null;
  return { p, analysis, best };
});

ok('الأثر كما طُلب يطابق ما تعرضه بطاقة الخريطة — في كل تصريح', () => {
  const off = rows.filter((row) =>
    Math.abs(Math.round(row.analysis.scored.delayVehHours) - row.p.impactVehHours) > 1);
  assert.strictEqual(off.length, 0,
    off.length + ' تصريحاً يختلف، أولها ' + (off[0] && off[0].p.id) + ': '
      + (off[0] && Math.round(off[0].analysis.scored.delayVehHours))
      + ' في المكتب مقابل ' + (off[0] && off[0].p.impactVehHours) + ' على البطاقة');
});

ok('أثر البديل الموصى به يطابق المنشور كذلك', () => {
  const off = rows.filter((row) =>
    row.best && Math.abs(Math.round(row.best.delayVehHours) - row.p.bestVehHours) > 1);
  assert.strictEqual(off.length, 0,
    off.length + ' تصريحاً يختلف، أولها ' + (off[0] && off[0].p.id));
});

ok('نسبة تأخير الرحلة تطابق المنشورة', () => {
  const off = rows.filter((row) =>
    Math.abs(row.analysis.scored.delayPct - row.p.delayPct) > 0.1);
  assert.strictEqual(off.length, 0, off.length + ' تصريحاً يختلف');
});

/**
 * «الفرق عن الطلب» في المكتب و«الوفر» على البطاقة وجهان لكمية واحدة: الأول
 * سالبٌ لأنه فرق، والثاني موجبٌ لأنه مكسب. اختلافهما بأكثر من عُشر نقطة يعني
 * أن أحدهما لم يعد يصف الآخر.
 */
ok('الفرق عن الطلب هو الوفر المنشور بإشارة معكوسة', () => {
  const off = rows.filter((row) => {
    if (row.analysis.delta === null) return false;
    return Math.abs(-row.analysis.delta - row.p.savedPct) > 0.1;
  });
  assert.strictEqual(off.length, 0, off.length + ' تصريحاً يختلف');
});

/* ---- المدخلات ---- */

ok('النافذة اليومية والمجموع حقلان مختلفان — لا يُخلطان', () => {
  const long = rows.find((row) => row.p.durationHours > row.p.windowHours);
  assert.ok(long, 'لا تصريح متعدد الأيام في المحفظة — الاختبار بلا مادة');
  assert.strictEqual(long.analysis.input.durationHours, long.p.windowHours);
  assert.strictEqual(long.analysis.input.totalHours, long.p.durationHours);
});

ok('المدة تُسقَّف كما في بناء المحفظة — لا سقفان', () => {
  const capped = Analysis.inputsFor({ durationHours: 5000, windowHours: 8, workDays: 3 }, Engine);
  assert.strictEqual(capped.totalHours, Analysis.MAX_PERMIT_HOURS);
  const tiny = Analysis.inputsFor({ durationHours: 1, windowHours: 8, workDays: 1 }, Engine);
  assert.strictEqual(tiny.totalHours, Analysis.MIN_PERMIT_HOURS);
});

ok('غياب المجموع يُستنتج من النافذة والأيام لا يُفترض رقماً', () => {
  const derived = Analysis.inputsFor({ windowHours: 6, workDays: 4 }, Engine);
  assert.strictEqual(derived.totalHours, 24);
});

ok('غياب الحركة يقع على القيمة التوضيحية المعلنة في المحرك', () => {
  const fallback = Analysis.inputsFor({ windowHours: 8, workDays: 1 }, Engine);
  assert.strictEqual(fallback.aadt, Engine.DEFAULTS.aadt);
  assert.strictEqual(fallback.lanes, Engine.DEFAULTS.lanes);
});

/**
 * تصريح بلا تاريخ لا يُسقط الملف: الساعة تقع على الثامنة صباحاً بوصفها
 * افتراضاً معلناً، ولا تصير NaN تتسلّل إلى BPR فتُخرج رقماً بلا معنى.
 */
ok('تاريخ معطوب لا يُنتج NaN — يقع على افتراض معلن', () => {
  const broken = Analysis.evaluate(
    { start: 'ليس تاريخاً', end: 'ولا هذا', aadt: 40000, lanes: 3, lanesClosed: 1,
      windowHours: 8, workDays: 2, durationHours: 16 }, Engine);
  assert.strictEqual(broken.input.startHour, 8);
  assert.ok(Number.isFinite(broken.scored.delayVehHours));
  assert.ok(Number.isFinite(broken.scored.delayPct));
});

ok('لا بديل أفضل: الفرق يبقى معرَّفاً ولا يصير قسمةً على صفر', () => {
  const zero = Analysis.evaluate(
    { aadt: 1, lanes: 4, lanesClosed: 1, windowHours: 8, workDays: 1, durationHours: 8,
      start: '2026-07-24T22:00:00.000Z', end: '2026-07-25T06:00:00.000Z' }, Engine);
  assert.ok(zero.delta === null || Number.isFinite(zero.delta));
});

/* ---- الوحدات مشتقّة من الرقم نفسه ---- */

ok('وحدات القرار مشتقّة من الأثر المعروض لا من حساب موازٍ', () => {
  const row = rows[0];
  const ph = Engine.personHours(row.analysis.scored.delayVehHours);
  assert.strictEqual(row.analysis.units.personHoursLow, ph.lowPersonHours);
  assert.strictEqual(row.analysis.units.personHoursHigh, ph.highPersonHours);
});

if (failures) {
  console.error('\n' + failures + ' فشل');
  process.exit(1);
}
console.log('\nكل اختبارات تحليل المكتب نجحت');
