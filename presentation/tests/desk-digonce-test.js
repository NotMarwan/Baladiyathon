'use strict';
const assert = require('assert');
const path = require('path');

const DigOnce = require(path.join(__dirname, '..', 'masar-desk-digonce.js'));
const Engine = require(path.join(__dirname, '..', 'masar-engine.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

/** خط أفقي بطول تقريبي معلوم عند خط عرض الرياض. */
function line(km) {
  const degrees = km / 111.32 / Math.cos(24.7 * Math.PI / 180);
  return { type: 'LineString', coordinates: [[46.68, 24.7], [46.68 + degrees, 24.7]] };
}

function work(props, km) {
  return {
    type: 'Feature',
    geometry: line(km === undefined ? 1 : km),
    properties: Object.assign({
      id: 'w1', permitRef: 'BLD-0001', street: 'طريق الملك فهد',
      promoter: 'شركة المياه', status: 'ImpactScreening',
      start: '2026-07-20T06:00:00Z', end: '2026-07-24T06:00:00Z',
    }, props || {}),
  };
}

/* ---- الطول: يُقاس من الهندسة لا يُفترض ---- */

ok('طول الخط يُحسب بالكيلومترات من الإحداثيات', () => {
  assert.ok(Math.abs(DigOnce.lengthKm(line(2)) - 2) < 0.05,
    `الطول المحسوب ${DigOnce.lengthKm(line(2))}`);
});

ok('هندسة غائبة أو نقطة تعطي صفراً لا استثناء', () => {
  assert.strictEqual(DigOnce.lengthKm(null), 0);
  assert.strictEqual(DigOnce.lengthKm({ type: 'Point', coordinates: [46, 24] }), 0);
});

/* ---- الترشيح: الشارع نفسه ونافذة قريبة ---- */

const anchor = work({ id: 'a', permitRef: 'BLD-A' });

ok('التصريح المتداخل على الشارع نفسه مرشّح', () => {
  const other = work({ id: 'b', permitRef: 'BLD-B', start: '2026-07-22T06:00:00Z', end: '2026-07-26T06:00:00Z' });
  assert.strictEqual(DigOnce.candidates(anchor, [anchor, other]).length, 1);
});

ok('تصريح على شارع آخر ليس مرشّحاً مهما تداخلت نافذته', () => {
  const other = work({ id: 'b', street: 'طريق العليا', start: '2026-07-21T06:00:00Z' });
  assert.strictEqual(DigOnce.candidates(anchor, [anchor, other]).length, 0);
});

ok('فجوة أقصر من الحدّ تُبقي الترشيح — الدمج لا يشترط تداخلاً', () => {
  // تصريحان متعاقبان بيومين: حفرة واحدة تخدمهما، وحفرتان هدر.
  const near = work({ id: 'b', start: '2026-07-26T06:00:00Z', end: '2026-07-28T06:00:00Z' });
  assert.strictEqual(DigOnce.candidates(anchor, [anchor, near]).length, 1);
});

ok('فجوة أطول من الحدّ تُسقط الترشيح', () => {
  const far = work({ id: 'b', start: '2026-09-01T06:00:00Z', end: '2026-09-03T06:00:00Z' });
  assert.strictEqual(DigOnce.candidates(anchor, [anchor, far]).length, 0);
});

ok('العمل لا يُرشّح نفسه', () => {
  assert.strictEqual(DigOnce.candidates(anchor, [anchor]).length, 0);
});

ok('تاريخ تالف لا يُدخل عضواً ولا يُسقط الحساب', () => {
  const broken = work({ id: 'b', start: 'ليس تاريخاً', end: 'ولا هذا' });
  assert.strictEqual(DigOnce.candidates(anchor, [anchor, broken]).length, 0);
});

/* ---- التقييم: النموذج المعلن ---- */

const impacts = { a: 1000, b: 600, c: 400 };
const impactOf = (feature) => impacts[feature.properties.id] || 0;

const group = [
  work({ id: 'b', permitRef: 'BLD-B', promoter: 'شركة الاتصالات' }, 2),
  work({ id: 'c', permitRef: 'BLD-C', promoter: 'شركة الكهرباء' }, 3),
];
const merge = DigOnce.evaluate(work({ id: 'a', permitRef: 'BLD-A' }, 1), group, impactOf, Engine);

ok('عضو واحد ليس دمجاً', () => {
  assert.strictEqual(DigOnce.evaluate(anchor, [], impactOf, Engine), null);
});

ok('الخندق المشترك أقصر الأعضاء لا أطولها', () => {
  // أخذُ الأطول يضخّم الوفر باختلافٍ لا يقع على الأرض.
  assert.ok(Math.abs(merge.trenchKm - 1) < 0.05, `الخندق ${merge.trenchKm}`);
  assert.ok(Math.abs(merge.longestKm - 3) < 0.05);
});

ok('التأخير بعد الدمج أثر أشدّ الأعضاء لا مجموعها', () => {
  assert.strictEqual(merge.separateVehHours, 2000);
  assert.strictEqual(merge.mergedVehHours, 1000);
  assert.strictEqual(merge.savedVehHours, 1000);
});

/* WP-A2: الوحدة كانت تنقل نطاقاً مالياً من المحرك. صارت تنقل كمية مادية. */
ok('الكميات منقولة من المحرك، والافتراض يسافر معها', () => {
  const direct = Engine.digOnce({ trenchKm: merge.trenchKm, permitsMerged: 3 });
  assert.strictEqual(merge.duplicateTrenchKmEquivalent,
    direct.duplicateTrenchKmEquivalent);
  assert.strictEqual(merge.additionalPermitsInGroups, direct.additionalPermitsInGroups);
  assert.strictEqual(merge.additionalPermitsInGroups, 2, 'ثلاثة أعضاء = تصريحان إضافيان');
  assert.ok(merge.duplicateTrenchKmEquivalent > 0);
  assert.ok(/تداخل تام/.test(merge.overlapAssumption), 'الافتراض لم يُنقل');
  assert.strictEqual(merge.savedLowSAR, undefined, 'حقل مالي عاد إلى الوحدة');
});

ok('النافذة المدمجة تمتد من أبكر بداية إلى آخر نهاية', () => {
  const early = work({ id: 'b', start: '2026-07-18T06:00:00Z', end: '2026-07-22T06:00:00Z' });
  const late = work({ id: 'c', start: '2026-07-23T06:00:00Z', end: '2026-07-30T06:00:00Z' });
  const span = DigOnce.evaluate(work({ id: 'a' }), [early, late], impactOf, Engine);
  assert.strictEqual(new Date(span.spanFrom).toISOString().slice(0, 10), '2026-07-18');
  assert.strictEqual(new Date(span.spanTo).toISOString().slice(0, 10), '2026-07-30');
});

ok('الجهات تُجمع بلا تكرار', () => {
  assert.strictEqual(merge.promoters.length, 3);
  const same = DigOnce.evaluate(work({ id: 'a' }),
    [work({ id: 'b' }), work({ id: 'c' })], impactOf, Engine);
  assert.strictEqual(same.promoters.length, 1, 'الجهة نفسها عُدّت مرات');
});

ok('طول صفري يمنع التقييم — لا وفر على خندق بلا طول', () => {
  const noGeometry = { type: 'Feature', geometry: null, properties: anchor.properties };
  assert.strictEqual(DigOnce.evaluate(noGeometry, [anchor], impactOf, Engine), null);
});

/* ---- العرض: يقترح ولا يأمر ---- */

const html = DigOnce.render(merge, 'طريق الملك فهد');

ok('العرض يذكر كل عضو بمرجعه وجهته ونافذته', () => {
  ['BLD-A', 'BLD-B', 'BLD-C'].forEach((ref) => {
    assert.ok(html.indexOf(ref) !== -1, `عضو غائب: ${ref}`);
  });
  assert.ok(html.indexOf('شركة الكهرباء') !== -1, 'الجهة غير معروضة');
});

ok('الأساس الحسابي مكتوب على الشاشة لا مخفيّ في الشيفرة', () => {
  assert.ok(html.indexOf('أقصر الأعضاء') !== -1, 'اختيار الخندق غير مبرَّر');
  assert.ok(html.indexOf('أشدّ الأعضاء') !== -1, 'نموذج التأخير غير معلن');
});

ok('ما يجب التحقّق منه يُعرض مع الرقم لا بعده', () => {
  assert.ok(html.indexOf('قبل أن يصير هذا قراراً') !== -1);
  assert.ok(html.indexOf('أعماق الخدمات') !== -1);
  assert.ok(html.indexOf('موافقة') !== -1);
});

ok('لا زرّ يجعل الدمج يبدو بضغطة', () => {
  // قرار لا نملك مدخلاته لا يُعرض كأنه بضغطة.
  assert.ok(html.indexOf('<button') === -1, 'عُرض زرّ تنفيذ لدمج يحتاج موافقات');
  assert.ok(html.indexOf('اقتراح للتنسيق لا أمر تنفيذ') !== -1);
});

/*
 * WP-A2. كان الفحص يفرض عرض نطاق مالي بنسبته — وكان يحرس صياغة سليمة لرقم
 * لا أساس له: النطاق مستورد من سياق آخر، والكلفة التي يضرب فيها افتراض غير
 * معروض. عرضُ رقمٍ خاطئ بنطاقٍ أنيق يظل رقماً خاطئاً.
 *
 * البطاقة صارت تعرض كمية مادية ومعها من يملك مُدخل الكلفة، فيُفحص ذلك.
 */
ok('البطاقة تعرض كمية مادية وتسمّي مالك مُدخل الكلفة والافتراض', () => {
  assert.ok(/تصريحاً/.test(html), 'عدد التصاريح الإضافية غير معروض');
  assert.ok(!/متجنَّبة|أُلغيت|سقطت/.test(html),
    'البطاقة تدّعي أثراً (حفريات متجنَّبة) بلا هندسة تثبته');
  assert.ok(/مكرر مكافئ/.test(html), 'الطول غير مسمّى «مكرر مكافئ»');
  assert.ok(/تداخل تام/.test(html), 'البطاقة تعرض الطول بلا افتراضه');
  assert.ok(html.indexOf('كلفة الخندق لدى الأمانة') !== -1,
    'البطاقة لا تسمّي من يملك مُدخل الكلفة');
  assert.ok(!/﷼|ريال/.test(html), 'عاد رقم مالي إلى البطاقة');
});

ok('بلا مرشّح يقول ذلك صراحةً ولا يعرض فراغاً', () => {
  const empty = DigOnce.render(null, 'طريق العليا');
  assert.ok(empty.indexOf('لا تعارض') !== -1);
  assert.ok(empty.indexOf('طريق العليا') !== -1);
});

ok('الأرقام لاتينية والنصوص مرمَّزة', () => {
  assert.ok(!/[٠-٩]/.test(html), 'أرقام عربية-هندية');
  const injected = DigOnce.render(merge, '<script>alert(1)</script>');
  assert.ok(injected.indexOf('<script>alert') === -1, 'نص غير مرمَّز');
});

/* ---- تمييز العدد بالعربية ---- */

const FORMS = { one: 'تصريح واحد', two: 'تصريحان', few: 'تصاريح', many: 'تصريحاً' };

ok('الواحد يُفرد والاثنان يُثنّيان بلا رقم', () => {
  assert.strictEqual(DigOnce.counted(1, FORMS), 'تصريح واحد');
  assert.strictEqual(DigOnce.counted(2, FORMS), 'تصريحان');
});

ok('من ثلاثة إلى عشرة جمع قلّة، وما فوقها مفرد منصوب', () => {
  assert.strictEqual(DigOnce.counted(3, FORMS), '3 تصاريح');
  assert.strictEqual(DigOnce.counted(10, FORMS), '10 تصاريح');
  assert.strictEqual(DigOnce.counted(11, FORMS), '11 تصريحاً');
  assert.strictEqual(DigOnce.counted(25, FORMS), '25 تصريحاً');
});

ok('العرض لا يقول «2 تصاريح»', () => {
  // خطأ يُقرأ فوراً، ويكلّف أداةً تدّعي الدقّة ادّعاءها.
  const two = DigOnce.render(DigOnce.evaluate(
    work({ id: 'a', permitRef: 'BLD-A' }, 1),
    [work({ id: 'b', permitRef: 'BLD-B' }, 2)], impactOf, Engine), 'طريق أ');
  assert.ok(two.indexOf('تصريحان') !== -1, 'لم يُثنِّ');
  assert.ok(!/\d+\s*تصاريح/.test(two.replace(/تصريحان/g, '')) || two.indexOf('2 تصاريح') === -1,
    'ظهر «2 تصاريح»');
});

console.log(`\n${passed} اختبارات نجحت`);
