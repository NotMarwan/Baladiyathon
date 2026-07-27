'use strict';
/**
 * بوابة مِنسَب — منسوب الحِمل على الشارع.
 * ---------------------------------------------------------------------------
 * **العيب الذي تحرسه.**
 *
 * كل رقم أثر في المنتج يتناسب طردياً مع حركة الشارع، وحركة الشارع في المحفظة
 * رقمٌ عشوائي ببذرة ثابتة داخل نطاق صنفه — الشارع الواحد يحمل قيمتين
 * متباعدتين بلا سبب. مِنسَب يضع مكانه منزلةً نسبية لها مدخلات تُقرأ.
 *
 * **وما تحرس منه — وهو أخطر.**
 *
 * أن يُقرأ المؤشّر عدّاً. مِنسَب مشتقّ بالكامل: أربعة مدخلات من هندسة الشبكة
 * ووسوم OSM، بأوزان هي حكمٌ هندسي لا معايرة، ونسبةِ إشغالٍ مفترضة. درجته
 * `model-derived` ولا ترتفع — وهذا ما تفحصه الحزمة على كل درجة في السُّلَّم لا
 * على واحدة.
 *
 * وثلاثة فحوص هنا تحرس **صدق العلّة** لا صحة الحساب:
 *   · الشريحة تُقرأ من الترتيب لا من قيمة المؤشّر — «من أثقل 10٪» يجب أن تكون
 *     صادقة عدّاً لا اصطلاحاً على عتبة.
 *   · المدخل الغائب يبقى فارغاً ولا يصير صفراً.
 *   · مِنسَب مستقلٌّ عن `aadt` العشوائي — فلو تسرّب إلى مدخلاته صار المؤشّر
 *     يعيد تسمية الرقم الذي جاء ليحلّ محلّه.
 *
 * التشغيل: node presentation/tests/street-load-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;

const Engine = require(path.join(ROOT, 'masar-engine.js'));
const Model = require(path.join(ROOT, 'masar-street-load.js'));
const Evidence = require(path.join(ROOT, 'masar-route-evidence.js'));
const Analysis = require(path.join(ROOT, 'masar-desk-analysis.js'));
const DeskFile = require(path.join(ROOT, 'masar-desk-file.js'));

const REPORT = path.join(ROOT, 'data', 'street-load.json');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const portfolio = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8'));

/* ------------------------------------------------------------ النموذج */

test('الأوزان معلنة بسببها ومجموعها واحد', () => {
  const sum = Model.WEIGHTS.reduce((total, one) => total + one.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `مجموع الأوزان ${sum} لا واحد`);
  Model.WEIGHTS.forEach((one) => {
    assert.ok(one.why && one.why.length > 60,
      `${one.key}: وزنٌ بلا سبب مكتوب — والوزن بلا سبب رقمٌ مزروع`);
    /* الحدّ مع السبب: وزنٌ يُعلَن سببه ولا يُعلَن ما لا يقوله يقرأ أقوى مما هو. */
    assert.ok(one.limit && one.limit.length > 30, `${one.key}: مدخلٌ بلا حدّ مكتوب`);
    assert.ok(one.unit && one.unit.length, `${one.key}: مدخلٌ بلا وحدة`);
  });
});

test('الدرجة model-derived ولا ترتفع — على كل درجة في السُّلَّم', () => {
  assert.strictEqual(Model.GRADE, 'model-derived');
  assert.strictEqual(report.grade, 'model-derived');
  assert.strictEqual(Model.assertGrade('model-derived'), true);

  /* الفحص على السُّلَّم كله لا على درجة مختارة: درجةٌ جديدة تُضاف غداً إلى
     masar-route-evidence.js وتمرّ صامتةً تفتح الباب الذي أُغلق. */
  const others = Evidence.EVIDENCE_GRADES
    .map((grade) => grade.key)
    .filter((key) => key !== Model.GRADE);
  assert.ok(others.length >= 8, 'السُّلَّم أقصر من المتوقَّع — راجع الدرجات');
  others.forEach((key) => {
    assert.throws(() => Model.assertGrade(key), /model-derived/,
      `assertGrade تقبل «${key}» — والدرجة تُرفع بلا بيانات`);
    assert.ok(Model.FORBIDDEN_GRADES[key],
      `«${key}» ممنوعة بلا سبب مكتوب — المنع بلا علّة عُرفٌ لا فحص`);
  });
  assert.throws(() => Model.assertGrade('local-field'), /لا قياس قبل\/أثناء\/بعد/);
});

test('المنزلة المئينية: متعادلان بمنزلة واحدة، والترتيب محفوظ', () => {
  const ranks = Model.percentileRanks([10, 30, 20, 30]);
  assert.strictEqual(ranks[0], 0, 'الأدنى ليس عند الصفر');
  assert.strictEqual(ranks[2], 0.333, `المنزلة الوسطى ${ranks[2]}`);
  assert.strictEqual(ranks[1], ranks[3],
    'قيمتان متساويتان بمنزلتين — ترتيب الإدخال صار معلومةً وهو ليس كذلك');
  assert.ok(ranks[1] > ranks[2] && ranks[2] > ranks[0], 'الترتيب غير محفوظ');

  const withHole = Model.percentileRanks([5, null, 9]);
  assert.strictEqual(withHole[1], null, 'الغائب أُعطي منزلة — والغياب ليس قيمة');
});

test('المدخل الغائب يُسقط ولا يصير صفراً', () => {
  const full = Model.combine({
    centrality: 0.5, capacity: 0.5, buildings: 0.5, roadClass: 0.5 });
  const withoutBuildings = Model.combine({
    centrality: 0.5, capacity: 0.5, buildings: null, roadClass: 0.5 });

  assert.strictEqual(full.loadIndex, 0.5);
  /* لو صار الغائب صفراً لهبط المؤشّر إلى 0.4 — أي «شارعٌ أخفّ»، وهو ادّعاءٌ
     لا يقوله الغياب. إعادة قسمة الأوزان تُبقيه على ما تقوله المدخلات الحاضرة. */
  assert.strictEqual(withoutBuildings.loadIndex, 0.5,
    'الغياب حرّك المؤشّر — أي أنه حُسب صفراً');
  assert.deepStrictEqual(withoutBuildings.missing, ['buildings']);
  assert.ok(withoutBuildings.weightSum < full.weightSum,
    'مجموع الأوزان لم ينقص بغياب مدخل');
  assert.strictEqual(Model.combine({}).loadIndex, null,
    'بلا مدخل واحد يخرج رقمٌ — والعدم لا يُلخَّص برقم');
});

test('المدى مدىً أبداً لا نقطة، ومشتقٌّ من السعة ونسبة معلنة', () => {
  const light = Model.vphBandFor(0, 7200);
  const heavy = Model.vphBandFor(1, 7200);
  assert.ok(light.high > light.low, 'المدى منهار إلى نقطة');
  assert.ok(heavy.high > heavy.low, 'المدى منهار إلى نقطة');
  assert.ok(heavy.low > light.low && heavy.high > light.high,
    'المنسوب الأعلى لا يعطي حملاً أعلى — المؤشّر لا يفعل شيئاً');

  /* المدى حاصل ضرب السعة في النسبة المعلنة، لا رقماً موازياً. */
  assert.strictEqual(light.low, Math.round(7200 * Model.VC_AT_ZERO.low));
  assert.strictEqual(heavy.high, Math.round(7200 * Model.VC_AT_ONE.high));
  /* السقف عند السعة تماماً: هي العتبة التي عندها يتكوّن الطابور، والعتبة
     نفسها في build-alternate-load.js. تجاوزها يجعل المؤشّر يدّعي طابوراً. */
  assert.strictEqual(Model.VC_AT_ONE.high, 1.00);
  assert.ok(Model.VC_AT_ZERO.high < 0.85,
    'أدنى السُّلَّم يبلغ حدّ «يقترب من طاقته» — فلا يبقى للسُّلَّم أسفل');
  assert.strictEqual(Model.vphBandFor(0.5, null), null, 'مدىً بلا سعة');
});

test('الشريحة تُقرأ من الترتيب لا من قيمة المؤشّر', () => {
  /* العيب الذي أوقعنا فيه أول تشغيل: أعلى مقطع في المحفظة — الأول من 129 —
     وُسم «من أثقل ربع المحفظة» لأن قيمته 0.89 دون عتبة 0.90. وسمٌ صحيح
     المبنى كاذب المعنى: «أثقل 10٪» ادّعاءٌ عن موقعٍ بين أقران، لا عن عتبة. */
  assert.strictEqual(Model.tierOf(1, 100).key, 'top');
  assert.strictEqual(Model.tierOf(10, 100).key, 'top');
  assert.strictEqual(Model.tierOf(11, 100).key, 'high');
  assert.strictEqual(Model.tierOf(100, 100).key, 'low');
  assert.strictEqual(Model.tierOf(null, 100).key, 'unknown');
  assert.strictEqual(Model.tierOf(5, 3).key, 'unknown', 'ترتيب فوق العدد قُبِل');
  /* الأثقل يحمل الشريحة العليا مهما صغرت المحفظة — وإلا خرج «الأول من واحد»
     موسوماً «من أخفّ ربع المحفظة». */
  assert.strictEqual(Model.tierOf(1, 1).key, 'top');

  /* والصدق عدّاً على المحفظة نفسها: من وُسم «أثقل 10٪» لا يبلغ عددهم عُشر
     المرتَّبين — الوسم يبقى دون ما يقوله لا فوقه. */
  const total = report.segments.length;
  const cap = Math.max(1, Math.floor(total * 0.10));
  const top = report.segments.filter((row) => row.tier === 'top');
  assert.ok(top.length <= cap,
    `${top.length} مقطعاً موسوماً «أثقل 10٪» من ${total} — والحدّ ${cap}`);
  assert.ok((top.length / total) <= 0.10,
    `حصة الموسومين «أثقل 10٪» ${(100 * top.length) / total}٪ — فوق وسمهم`);
  top.forEach((row) => {
    assert.ok(row.rank <= cap, `${row.permitRef}: ترتيبه ${row.rank} ووسمه «أثقل 10٪»`);
  });
  /* وكل مقطع في شريحة، ولا شريحة بلا مقطع تفصلها عن جارتها. */
  report.segments.forEach((row) => {
    assert.strictEqual(row.tier, Model.tierOf(row.rank, total).key,
      `${row.permitRef}: شريحته لا تُعاد من ترتيبه`);
  });
});

/* ------------------------------------------------------------ المخرَج */

test('كل تصريح في المحفظة له منسوب أو سبب — بلا إسقاط صامت', () => {
  /* إسقاط ما تعذّر حسابه يجعل النسب تُقرأ على محفظة أصغر من المعلَنة، وهي
     أخطر طريقة لتحسين رقم: لا تكذب، تُخفي المقام. */
  assert.strictEqual(report.coverage.permitsInPortfolio, portfolio.features.length);
  assert.strictEqual(Object.keys(report.permits).length, portfolio.features.length);
  portfolio.features.forEach((feature) => {
    const entry = report.permits[feature.properties.permitRef];
    assert.ok(entry, `${feature.properties.permitRef}: بلا مدخل في مِنسَب`);
    assert.ok(['segment', 'street', 'none'].indexOf(entry.basis) !== -1,
      `${entry.basis}: أساسٌ غير معروف`);
    if (entry.loadIndex === null) {
      assert.ok(entry.reason && entry.reason.length > 10,
        `${feature.properties.permitRef}: بلا منسوب وبلا سبب`);
    } else {
      assert.ok(entry.loadIndex >= 0 && entry.loadIndex <= 1,
        `${feature.properties.permitRef}: منسوب ${entry.loadIndex} خارج السُّلَّم`);
    }
  });
  const summed = Object.values(report.coverage.permitsByBasis)
    .reduce((a, b) => a + b, 0);
  assert.strictEqual(summed, portfolio.features.length,
    'مجموع الأسس لا يساوي المحفظة');
});

test('المقطع بلا مدخل مبانٍ يُعلن غيابه ولا يُملأ', () => {
  const missing = report.segments.filter((row) => row.inputsMissing.length);
  assert.strictEqual(missing.length, report.coverage.segmentsMissingAnyInput,
    'عدد المقاطع الناقصة في الملخّص لا يطابق الصفوف');
  missing.forEach((row) => {
    assert.strictEqual(row.buildingsPerKm2, null,
      `${row.permitRef}: مدخل غائب وقيمته ليست فارغة`);
    assert.ok(row.weightSumUsed < 1,
      `${row.permitRef}: مدخل غائب ومجموع الأوزان كامل — أي أنه حُسب`);
    assert.ok(row.loadIndex !== null, `${row.permitRef}: سقط بدل أن يُعاد وزنه`);
  });
});

test('السعة من عدد الحارات × سعة الحارة المعلنة في المحرك', () => {
  report.segments.forEach((row) => {
    if (!row.lanes) return;
    assert.strictEqual(row.capacityVph, row.lanes * Engine.DEFAULTS.capacityPerLane,
      `${row.permitRef}: سعة لا تساوي الحارات × ${Engine.DEFAULTS.capacityPerLane}`);
  });
  assert.strictEqual(report.capacityPerLane, Engine.DEFAULTS.capacityPerLane,
    'التقرير ينشر سعة حارة تخالف المحرك — نسختان من الرقم نفسه');
});

test('الترتيب يتبع المنسوب، والمنسوب يتبع مدخلاته', () => {
  const sorted = report.segments.slice().sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(sorted[i - 1].loadIndex >= sorted[i].loadIndex,
      `الترتيب ${sorted[i].rank} يخالف المنسوب`);
  }
  /* المنسوب مجموعٌ موزون لا رقم مكتوب: يُعاد حسابه من الصف نفسه. */
  report.segments.forEach((row) => {
    const again = Model.combine(row.normalized);
    assert.strictEqual(again.loadIndex, row.loadIndex,
      `${row.permitRef}: المنسوب لا يُعاد إنتاجه من مدخلاته`);
  });
});

test('مِنسَب مستقلٌّ عن aadt العشوائي — وإلا أعاد تسمية ما جاء ليحلّ محلّه', () => {
  const byRef = {};
  portfolio.features.forEach((one) => { byRef[one.properties.permitRef] = one.properties; });
  const pairs = report.segments
    .map((row) => ({ index: row.loadIndex, aadt: byRef[row.permitRef].aadt }))
    .filter((one) => Number.isFinite(one.aadt));
  assert.ok(pairs.length > 100, 'عيّنة أصغر من أن يُحكم عليها');

  const rank = (values) => {
    const order = values.map((value, at) => ({ value, at })).sort((a, b) => a.value - b.value);
    const out = new Array(values.length);
    order.forEach((one, at) => { out[one.at] = at + 1; });
    return out;
  };
  const ra = rank(pairs.map((one) => one.index));
  const rb = rank(pairs.map((one) => one.aadt));
  const n = ra.length;
  const mean = (n + 1) / 2;
  let cov = 0; let va = 0; let vb = 0;
  for (let i = 0; i < n; i += 1) {
    cov += (ra[i] - mean) * (rb[i] - mean);
    va += (ra[i] - mean) ** 2;
    vb += (rb[i] - mean) ** 2;
  }
  const rho = cov / Math.sqrt(va * vb);
  /* الحدّ فضفاض عمداً: المطلوب إثبات الاستقلال البنيوي لا صفرٌ إحصائي.
     ارتباطٌ فوق 0.3 مع رقمٍ عشوائي يعني أن العشوائي تسرّب إلى المدخلات. */
  assert.ok(Math.abs(rho) < 0.3,
    `ارتباط مِنسَب بـ aadt العشوائي ${rho.toFixed(3)} — الرقم العشوائي تسرّب`);
});

/* ------------------------------------------- الحساسية وخطّ الأساس */

test('حساسية الأوزان منشورة — رفعاً وخفضاً وحذفاً ومساواةً', () => {
  const variants = report.sensitivity.weights;
  /* أربعة مدخلات × (رفع، خفض، حذف) + أوزان متساوية. */
  assert.strictEqual(variants.length, Model.WEIGHTS.length * 3 + 1,
    `${variants.length} بديلاً — عائلة ناقصة`);
  variants.forEach((one) => {
    assert.ok(one.why && one.why.length > 20, `${one.label}: بديلٌ بلا سؤال يجيبه`);
    assert.ok(Number.isFinite(one.spearman), `${one.label}: بلا ارتباط رتب`);
    assert.ok(Number.isFinite(one.moved), `${one.label}: بلا عدّ للمتحرّكين`);
    assert.ok(Number.isFinite(one.worstShift), `${one.label}: بلا أقصى إزاحة`);
    /* رأس الترتيب منشور مع الارتباط: ارتباطٌ 0.98 قد يخفي انقلاب العشرة
       الأوائل، وهم موضع القرار. */
    assert.ok(Number.isFinite(one.topTenKept), `${one.label}: رأس الترتيب غير منشور`);
  });
  Model.WEIGHTS.forEach((one) => {
    assert.ok(variants.some((variant) => variant.label === `بلا «${one.label}»`),
      `${one.key}: بلا بديل حذفٍ — فلا يُعرف هل هو زينة`);
  });
});

test('المقارنة بخطّ الأساس الساذج منشورة برقمها', () => {
  const base = report.baseline;
  assert.ok(Number.isFinite(base.spearmanWithClassOnly), 'بلا ارتباط بخطّ الأساس');
  assert.ok(Number.isFinite(base.varianceExplainedByClass),
    'بلا حصةٍ لما يفسّره الصنف وحده — وهي الرقم الحاسم');
  assert.ok(base.pairsClassCannotOrder > 0,
    'خطّ الأساس يرتّب كل زوج — أي أنه ليس ثلاث فئات');
  assert.strictEqual(base.pairsTotal,
    (base.segments * (base.segments - 1)) / 2, 'عدّ الأزواج لا يطابق العدد');
  /* الفحص ليس «المؤشّر أفضل» — لا مرجع يُحكَم به. الفحص أن الفرق **منشور**:
     لو كان الصنف يفسّر كل شيء لوجب أن يظهر ذلك رقماً لا أن يُخفى. */
  assert.ok(base.varianceExplainedByClass >= 0 && base.varianceExplainedByClass <= 1,
    'حصة التشتّت خارج المدى');
  Object.keys(base.perClass).forEach((key) => {
    assert.ok(base.perClass[key].count > 0, `${key}: صنفٌ بلا مقاطع`);
    assert.ok(base.perClass[key].spread >= 0, `${key}: مدىً سالب`);
  });
});

test('العيّنة تُعلن بذرتها وحجمها وتوزيعها واستقرارها', () => {
  assert.ok(report.sample.routes > 0, 'بلا مسار في العيّنة');
  assert.ok(Number.isFinite(report.sample.seed), 'عيّنةٌ بلا بذرة — غير قابلة للإعادة');
  const shares = report.sample.tripMix.reduce((sum, one) => sum + one.share, 0);
  assert.ok(Math.abs(shares - 1) < 1e-9, `حصص التوزيع ${shares} لا واحد`);
  report.sample.tripMix.forEach((band) => {
    assert.ok(band.why && band.why.length > 20, `${band.key}: نطاقٌ بلا سبب`);
    assert.ok(band.maxKm > band.minKm, `${band.key}: نطاقٌ مقلوب`);
  });
  assert.ok(Number.isFinite(report.sampleStability.spearmanHalfVsHalf),
    'استقرار العيّنة غير منشور — فلا يُعرف هل المؤشّر يقرأ الشبكة أم الضجيج');
  assert.ok(report.sensitivity.tripMix.between.length >= 3,
    'أثر توزيع الرحلات غير مقارَن بين نطاقاته');
});

test('مرساة المعقولية حدٌّ سفلي معلن — لا معايرة', () => {
  const anchor = report.reasonableness;
  assert.match(anchor.role, /لا معايرة/);
  assert.ok(anchor.stations > 0, 'مرساةٌ بلا محطات');
  assert.ok(anchor.doesNotProve && anchor.doesNotProve.length > 40,
    'مرساةٌ بلا حدّ مكتوب تُقرأ معايرة');
  assert.ok(anchor.highestPortfolioBandHigh > anchor.highestStationPeakVph,
    'مديات المحفظة كلها دون أعلى محطة بين المدن — خللٌ في السعة أو النسبة');
});

/* ------------------------------------------------------------ اللغة */

test('لا مفردة قياس على رقم مشتقّ — بوابة اللغة نفسها', () => {
  const surfaces = [report.what, report.limit, report.derivedFrom,
    report.doesNotProve, Model.LIMIT_TEXT, Model.DERIVED_FROM];
  surfaces.forEach((textValue) => {
    const check = Evidence.checkLanguage('model-derived', textValue);
    assert.ok(check.ok, `نصّ عرضٍ يخالف البوابة: ${check.violations.join(' · ')}`);
  });
  Model.TIERS.forEach((tier) => {
    const check = Evidence.checkLanguage('model-derived', tier.label);
    assert.ok(check.ok, `وسم شريحة يخالف البوابة: ${check.violations.join(' · ')}`);
  });
  /* «AADT» على سطح عرضٍ لمِنسَب يجعله يُقرأ بديلاً عن الحجم لا مؤشّراً عليه. */
  assert.ok(report.limit.indexOf('AADT') === -1,
    'حدّ مِنسَب يذكر AADT — فيُقرأ عدّاً بأسماء أخرى');
  assert.match(report.limit, /ليس عدّاً للمركبات/);
});

/* ------------------------------------------------------------ البطاقة */

function featureWithBasis(basis) {
  return portfolio.features.find((one) => {
    const entry = report.permits[one.properties.permitRef];
    return entry && entry.basis === basis;
  });
}

test('البطاقة تعرض المنسوب بلغة تُقرأ بلا مصطلح', () => {
  const feature = featureWithBasis('segment');
  assert.ok(feature, 'لا تصريح بمنسوب مقطع في المحفظة');
  const entry = report.permits[feature.properties.permitRef];

  global.MASAR_STREET_LOAD = report;
  const analysis = Analysis.evaluate(feature.properties, Engine);
  const html = DeskFile.renderSummary(feature, analysis);

  assert.ok(html.indexOf('مِنسَب') !== -1, 'البطاقة لا تذكر المؤشّر أصلاً');
  assert.ok(html.indexOf('مِنسَب هذا المقطع') !== -1,
    'البطاقة تنسب منسوب المقطع إلى الشارع كله');
  assert.ok(html.indexOf(entry.tierLabel) !== -1, 'الشريحة غير معروضة');
  assert.ok(html.indexOf('مركبة/ساعة') !== -1, 'المدى المطلق غير معروض');
  assert.ok(html.indexOf('–') !== -1, 'المدى معروض نقطةً لا مدىً');
});

test('الحدّ على البطاقة نفسها لا في حاشيتها', () => {
  const feature = featureWithBasis('segment');
  global.MASAR_STREET_LOAD = report;
  const analysis = Analysis.evaluate(feature.properties, Engine);
  const html = DeskFile.renderSummary(feature, analysis);

  /* الحدّ في كتلته الخاصة لا في صنف الحاشية: «ليس عدّاً للمركبات» بلون
     الحاشية تحت رقمٍ كبير إخفاءٌ بصيغة إفصاح. */
  assert.ok(html.indexOf('desk-street-load-limit') !== -1,
    'الحدّ بلا كتلته الخاصة — يُقرأ حاشية');
  const at = html.indexOf('desk-street-load-limit');
  const block = html.slice(at, at + 900);
  assert.ok(block.indexOf('ليس عدّاً للمركبات') !== -1, 'الحدّ بلا جملته الحاسمة');
  assert.ok(block.indexOf('لا يوجد عدّ حقيقي لهذا الشارع') !== -1,
    'الحدّ لا يقول لماذا لا يوجد عدّ');

  const css = fs.readFileSync(path.join(ROOT, 'masar-desk.css'), 'utf8');
  assert.match(css, /\.desk-street-load-limit/,
    'كتلة الحدّ بلا نمط — فتُعرض كسطر عادي');
});

test('التصريح بلا مقطع يقول أساسه ولا يدّعي دقّة لا يملكها', () => {
  const feature = featureWithBasis('street');
  if (!feature) return; // لا تصريح على أساس الشارع في هذه المحفظة
  const entry = report.permits[feature.properties.permitRef];
  assert.strictEqual(entry.vphBand, null,
    'منسوب شارعٍ بمدىً مطلق — والمدى من سعة مقطع، ولا سعة واحدة للشارع');

  global.MASAR_STREET_LOAD = report;
  const analysis = Analysis.evaluate(feature.properties, Engine);
  const html = DeskFile.renderSummary(feature, analysis);
  assert.ok(html.indexOf('مِنسَب هذا الشارع') !== -1,
    'تصريحٌ بلا مقطع يُعرض منسوبه بلفظ المقطع');
  assert.ok(html.indexOf(entry.reason.slice(0, 20)) !== -1,
    'سبب الأساس الأضعف غير معروض');
});

test('غياب الملخّص يُسكت البطاقة ولا يُسقطها', () => {
  /* بطاقةٌ صامتة أصدق من تقدير، وأسلم من صفحة تسقط. */
  const feature = portfolio.features[0];
  const saved = global.MASAR_STREET_LOAD;
  delete global.MASAR_STREET_LOAD;
  try {
    const analysis = Analysis.evaluate(feature.properties, Engine);
    const html = DeskFile.renderSummary(feature, analysis);
    assert.ok(html.indexOf('مِنسَب') === -1, 'البطاقة تعرض القسم بلا بيانات');
    assert.ok(html.length > 100, 'البطاقة سقطت بغياب ملف اختياري');
  } finally {
    global.MASAR_STREET_LOAD = saved;
  }
});

/* ------------------------------------------------------------ الملخّص */

test('أرقام الملخّص المكتوب تطابق المخرَجات المولَّدة', () => {
  /* الملخّص نصٌّ يقرؤه إنسان، وأرقامه منقولة بيد. ونقلٌ باليد يتقادم صامتاً:
     يتغيّر المخرَج ويبقى النصّ يقول ما كان. فتُقارَن الأرقام الحاكمة فيه
     بمصادرها، ويسقط الخط إن افترقا. */
  const summary = fs.readFileSync(
    path.join(ROOT, '..', 'docs', 'STREET-LOAD-2026-07-27.md'), 'utf8');
  const shadow = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'street-load-shadow.json'), 'utf8'));
  const stations = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'mot-count-stations.json'), 'utf8'));
  const dropCentrality = report.sensitivity.weights
    .find((one) => one.label === 'بلا «المركزية البنيوية»');

  const claims = [
    ['عدد المقاطع', String(report.segments.length)],
    ['عدد الشوارع', String(Object.keys(report.streets).length)],
    ['حجم العيّنة', report.sample.routes.toLocaleString('en')],
    ['استقرار العيّنة', String(report.sampleStability.spearmanHalfVsHalf)],
    ['ارتباط خطّ الأساس', String(report.baseline.spearmanWithClassOnly)],
    ['حصة تشتّت الصنف', String(report.baseline.varianceExplainedByClass)],
    ['الأزواج المتعادلة', report.baseline.pairsClassCannotOrder.toLocaleString('en')],
    ['انقلابات الصنف', report.baseline.classInversions.toLocaleString('en')],
    ['ارتباط حذف المركزية', String(dropCentrality.spearman)],
    ['متحرّكو حذف المركزية', String(dropCentrality.moved)],
    ['ارتباط الظلّ', String(shadow.ranking.spearman)],
    ['متحرّكو الظلّ', String(shadow.ranking.movedMoreThanThreshold)],
    ['تغيّرت شدّته', String(shadow.ranking.severityChanged)],
    ['تغيّرت نافذته', String(shadow.ranking.recommendedWindowChanged)],
    ['وسيط نسبة الظلّ', String(shadow.aadtRatio.median)],
    ['ضِعف المجموع', String(shadow.convexity.midOverCurrent)],
    ['محطات الوزارة', String(stations.rows.length)],
    ['مقاطع بلا مبانٍ', String(report.coverage.segmentsMissingBuildings)],
  ];
  const stale = claims.filter(([, value]) => summary.indexOf(value) === -1)
    .map(([label, value]) => `${label} (${value})`);
  assert.deepStrictEqual(stale, [],
    `أرقامٌ في المخرَج لا أثر لها في الملخّص:\n    ${stale.join('\n    ')}`);

  /* والملخّص يقول الثلاثة التي طُلب منه قولها. */
  assert.match(summary, /## ما قِس/);
  assert.match(summary, /## ما افتُرض/);
  assert.match(summary, /## ما بقي مجهولاً/);
  assert.match(summary, /غير منفَّذة/,
    'الملمح الزمني لم يُسجَّل «غير منفَّذة» — والمهمة المشروطة تُسجَّل حالتها');
});

test('المكتب يُحمّل الملخّص', () => {
  const page = fs.readFileSync(path.join(ROOT, 'masar-desk.html'), 'utf8');
  assert.match(page, /data\/street-load\.js/, 'المكتب لا يُحمّل ملخّص مِنسَب');
  const bundle = fs.readFileSync(path.join(ROOT, 'data', 'street-load.js'), 'utf8');
  assert.match(bundle, /^window\.MASAR_STREET_LOAD = /,
    'ملف المتصفح لا يُصدّر المتغيّر المتوقَّع');
});

console.log(`ALL TESTS PASSED (${count})`);
