'use strict';
/**
 * بوابة سجل المزوّدين ولقطة محطات وزارة النقل.
 * ---------------------------------------------------------------------------
 * **العيب الذي تحرسه.**
 *
 * سجل المزوّدين هو ما يمنع مسار من الادّعاء بحجمٍ لا يملكه. وكل بند فيه جملةٌ
 * عن العالم: «فُحص كذا فوُجد كذا». والجملة عن العالم إن لم يُفحص صدقها صارت
 * أقوى ما في المستودع وأقلّه سنداً — لأنها تُقرأ نتيجة فحصٍ لا رأياً.
 *
 * فهذه الحزمة تُعيد حساب **كل رقم** في بند وزارة النقل من اللقطة الخام
 * المحفوظة، وترفض أن يكون في السجل رقمٌ لا يُشتقّ من بياناته. والتغطية داخل
 * الرياض تُعاد من ملف الطرق نفسه لا من صندوق مكتوب.
 *
 * **وما تحرس منه بالذات.**
 *
 * أن يتحوّل «لم نستطع الفحص» إلى «لا يوجد». البوابة الوطنية محجوبة عن الوصول
 * الآلي، والفرق بين الحالتين هو الفرق الذي يقوم عليه السجل كله.
 *
 * التشغيل: node presentation/tests/mot-count-stations-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const registry = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data', 'traffic-provider-registry.json'), 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data', 'mot-count-stations.json'), 'utf8'));

const providerOf = (key) => registry.providers.find((one) => one.key === key);
const mot = providerOf('mot-open-data');
const density = mot.datasetsMeasured['Traffic density on roads.xlsx'];

const round3 = (value) => Math.round(value * 1000) / 1000;

test('اللقطة تحمل مصدرها وتاريخه ورخصتها وشرط إسنادها', () => {
  assert.ok(snapshot.source && snapshot.source.portal, 'لقطةٌ بلا بوابة مصدر');
  assert.match(snapshot.source.portal, /mot\.gov\.sa/);
  assert.ok(snapshot.source.accessedOn, 'لقطةٌ بلا تاريخ وصول — والشروط تتغيّر');
  assert.strictEqual(snapshot.license.attributionRequired, true);
  assert.ok(snapshot.license.attribution.indexOf(snapshot.source.portal) !== -1,
    'شرط الإسناد بلا رابط البوابة — وهو نصّ الشرط نفسه');
  /* دورها مكتوب في اللقطة نفسها لا في ذاكرة من كتبها. */
  assert.match(snapshot.role, /مرساة معقولية/);
  assert.match(snapshot.role, /لا معايرة/);
  assert.ok(snapshot.whyNotCalibration.length > 200,
    'سببُ عدم صلاحيتها معايرةً أقصر من أن يقنع');
  assert.ok(snapshot.knownLimits.length >= 3, 'لقطةٌ بحدودٍ أقل من ثلاثة');
});

test('عدد الصفوف في السجل يطابق اللقطة', () => {
  assert.strictEqual(density.dataRows, snapshot.rows.length);
  assert.ok(snapshot.rows.length > 0, 'لقطة فارغة');
});

test('الفترة والدقّة الزمنية كما في الصفوف — لا كما نتذكّرها', () => {
  const froms = new Set(snapshot.rows.map((one) => one.periodFrom));
  const tos = new Set(snapshot.rows.map((one) => one.periodTo));
  assert.strictEqual(froms.size, 1, 'أكثر من بداية فترة — «سنة واحدة» ادّعاء');
  assert.strictEqual(tos.size, 1, 'أكثر من نهاية فترة');
  assert.strictEqual([...froms][0], density.periodFrom);
  assert.strictEqual([...tos][0], density.periodTo);
  /* الدقّة السنوية ليست وصفاً بل هي بنية الملف: صفٌّ واحد لكل محطة لسنة
     كاملة. ولو حمل الملف أكثر من فترة لاحتمل تفصيلاً أدقّ. */
  assert.strictEqual(density.temporalResolution, 'annual');
  const span = (Date.parse(density.periodTo) - Date.parse(density.periodFrom))
    / 86400000;
  assert.ok(span > 300, `الفترة ${span} يوماً — أقصر من سنة`);
});

test('المدى الجغرافي والوسيط والأقصى مُعادة من الصفوف', () => {
  const lats = snapshot.rows.map((one) => one.lat);
  const lons = snapshot.rows.map((one) => one.lon);
  const daily = snapshot.rows.map((one) => one.dailyTotal).sort((a, b) => a - b);

  assert.strictEqual(round3(Math.min.apply(null, lats)), density.extent.latMin);
  assert.strictEqual(round3(Math.max.apply(null, lats)), density.extent.latMax);
  assert.strictEqual(round3(Math.min.apply(null, lons)), density.extent.lonMin);
  assert.strictEqual(round3(Math.max.apply(null, lons)), density.extent.lonMax);

  assert.strictEqual(daily[0], density.dailyTotal.min);
  assert.strictEqual(daily[daily.length - 1], density.dailyTotal.max);
  assert.strictEqual(daily[Math.floor(daily.length / 2)], density.dailyTotal.median);

  /* والحكم المبنيّ عليها: هذه أحجام طرق بين المدن لا شرايين حضرية. أدنى نطاق
     شرياني في المحفظة سبعون ألفاً، وأقصى محطة وطنية دونه بمراتب. */
  assert.ok(density.dailyTotal.max < 70000,
    'أقصى محطة تبلغ نطاق الشرياني — فالحكم «صنف آخر» يسقط');
});

test('الاتساق الداخلي المعلن معدود لا مقدَّر', () => {
  const [low, high] = density.internalConsistency.toleranceRatio;
  let matching = 0;
  snapshot.rows.forEach((one) => {
    const ratio = one.yearTotal / one.dailyTotal;
    if (ratio >= low && ratio <= high) matching += 1;
  });
  assert.strictEqual(matching, density.internalConsistency.rowsMatching);
  assert.strictEqual(snapshot.rows.length - matching,
    density.internalConsistency.rowsFailing);
  /* والصفوف المخالفة تبقى في اللقطة: حذفها يجعل المصدر يبدو أنظف مما هو. */
  assert.ok(density.internalConsistency.rowsFailing > 0,
    'الملف متّسق تماماً — راجع الحساب قبل تصديقه');
});

test('تغطية الرياض معادة من ملف الطرق نفسه لا من صندوق مكتوب', () => {
  const roads = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'riyadh-roads.geojson'), 'utf8'));
  let latMin = Infinity; let latMax = -Infinity;
  let lonMin = Infinity; let lonMax = -Infinity;
  roads.features.forEach((feature) => {
    const geometry = feature.geometry;
    if (!geometry || geometry.type !== 'LineString') return;
    geometry.coordinates.forEach((point) => {
      if (point[0] < lonMin) lonMin = point[0];
      if (point[0] > lonMax) lonMax = point[0];
      if (point[1] < latMin) latMin = point[1];
      if (point[1] > latMax) latMax = point[1];
    });
  });

  const inBox = (pad) => snapshot.rows.filter((one) => one.lon >= lonMin - pad
    && one.lon <= lonMax + pad && one.lat >= latMin - pad && one.lat <= latMax + pad);

  const coverage = mot.riyadhCoverageMeasured;
  assert.strictEqual(coverage.networkBoxFrom, 'presentation/data/riyadh-roads.geojson');
  assert.strictEqual(inBox(0).length, coverage.insideNetworkBox,
    'عدد المحطات داخل نطاق الشبكة لا يطابق المعلن');
  assert.strictEqual(inBox(0.25).length, coverage.withinQuarterDegree);
  assert.strictEqual(inBox(0.5).length, coverage.withinHalfDegree);

  /* والمحطة الوحيدة منشورة بقيمها كي لا يبقى «واحدة» رقماً بلا وجه. */
  const only = inBox(0)[0];
  const declared = coverage.insideNetworkBoxStation;
  assert.strictEqual(only.roadNo, declared.roadNo);
  assert.strictEqual(only.dailyTotal, declared.dailyTotal);
  assert.strictEqual(only.yearTotal, declared.yearTotal);
  assert.strictEqual(round3(only.lat), declared.lat);
  assert.strictEqual(round3(only.lon), declared.lon);
  /* والادّعاء الحاكم: هذه المحطة نفسها من الصفوف غير المتّسقة. */
  const ratio = only.yearTotal / only.dailyTotal;
  const [low, high] = density.internalConsistency.toleranceRatio;
  assert.ok(ratio < low || ratio > high,
    'المحطة الوحيدة متّسقة — فالجملة عنها في السجل غير صحيحة');
});

test('لا ادّعاء تغطية حضرية — والنتيجة السلبية مكتوبة صراحةً', () => {
  assert.strictEqual(mot.riyadhCoverageMeasured.portfolioStreetsCovered, 0);
  assert.match(mot.riyadhCoverageMeasured.verdict, /صفر تغطية/);
  assert.strictEqual(mot.examined, true);
  assert.ok(mot.examinedOn, 'فحصٌ بلا تاريخ');
  assert.ok(mot.snapshot.indexOf('mot-count-stations.json') !== -1,
    'بندٌ يدّعي فحصاً بلا لقطة يُرجع إليها');
  assert.strictEqual(mot.volumeProvided, true,
    'الوزارة تعطي حجماً فعلاً — نفيه مبالغةٌ في الاتجاه الآخر');
});

test('البوابة الوطنية «غير متحقَّق» لا «لا يوجد»', () => {
  const portal = providerOf('national-open-data-portal');
  assert.ok(portal, 'البوابة الوطنية غائبة عن السجل');
  /* الحجب يمنع الفحص ولا يثبت الغياب. وتحويل الأولى إلى الثانية هو نوع
     القفزة الذي بُني هذا السجل ليمنعه. */
  assert.strictEqual(portal.examined, false);
  assert.strictEqual(portal.volumeProvided, 'غير متحقَّق');
  assert.ok(portal.accessAttempts.length >= 3,
    'حكمٌ بتعذّر الوصول على محاولةٍ أو اثنتين');
  assert.ok(portal.accessAttempts.some((one) => one.indexOf('متصفح') !== -1),
    'لم تُجرَّب أداة المتصفح — والحجب قد يكون على fetch وحده');
  assert.match(portal.howToProceed, /غير متحقَّق/);
});

test('بوابة الهيئة الملكية: فهرسٌ كامل بلا حجم', () => {
  const rcrc = providerOf('rcrc-open-data');
  assert.ok(rcrc, 'بوابة الهيئة الملكية غائبة عن السجل');
  assert.strictEqual(rcrc.examined, true);
  assert.strictEqual(rcrc.volumeProvided, false);
  assert.ok(rcrc.catalogSize > 0, 'فهرسٌ بلا حجم معلن');
  assert.ok(rcrc.trafficRelatedDatasets.length > 0,
    'لا مجموعة متعلقة بالحركة — وفي الفهرس مجموعات نقل عام');
  /* المجموعة التي يستعملها المستودع سلفاً مسمّاة، فلا يُعاد فحصها ولا
     يُنسى أنها منه. */
  assert.ok(rcrc.trafficRelatedDatasets.some(
    (one) => one.indexOf('traffic-intersections') !== -1),
  'مجموعة التقاطعات المستعمَلة في المستودع غير مذكورة');
});

test('كل مزوّد يحمل حكمه وحالة الحجم عنده', () => {
  assert.ok(registry.providers.length >= 8, 'السجل أقصر من المتوقَّع');
  registry.providers.forEach((one) => {
    assert.ok(one.key && one.name, 'مزوّد بلا مفتاح أو اسم');
    assert.ok(one.verdict && one.verdict.length > 20, `${one.key}: بلا حكم مكتوب`);
    assert.ok(Object.prototype.hasOwnProperty.call(one, 'volumeProvided'),
      `${one.key}: بلا حالة حجم — وهي السؤال الذي بُني له السجل`);
  });
  /* النتيجة الحاكمة مكتوبة مرة واحدة في رأس السجل، لا تُستنتج من البنود. */
  assert.match(registry.volumeGapVerdict, /لا مصدر مفتوح واحد/);
  assert.match(registry.speedIsNotVolume, /السرعة لا تُحوَّل إلى حجم/);
  assert.ok(registry.revisions.length >= 2, 'سجلٌ بلا تاريخ مراجعات');
});

test('Waze غير مؤهَّل، والأهلية شرط تنظيمي لا تقني', () => {
  const waze = providerOf('waze-for-cities');
  assert.ok(waze, 'بند Waze غائب');
  assert.strictEqual(waze.volumeProvided, false,
    'Waze لا يعطي حجماً — وإعلانه خلاف ذلك يفتح باباً مغلقاً');
  assert.match(waze.eligibilityForUs, /غير مؤهَّل/);
  assert.match(waze.eligibilityForUs, /لا يُلتف عليه/);
});

console.log(`ALL TESTS PASSED (${count})`);
