'use strict';
/**
 * بوابة الامتثال الاتجاهيّ وإشعار التنسيق.
 * ---------------------------------------------------------------------------
 * **العيب الذي تحرسه.**
 *
 * مؤشّرُ امتثالٍ غير اتجاهيّ يحاسب الأول على وجود الثاني. ومؤشّرٌ يعاقب
 * الطوارئ يعاقب من كسرت عنده ماسورة على أنه لم يخبر أحداً بها قبل أن تُكسر.
 * كلا العيبين يُقرأ في العرض رقماً مرتّباً، ويُرفض في أول مراجعة جدّية.
 *
 * **وأهمّ فحص هنا** هو `الطوارئ مستثناة`: في المحفظة ثمانية تصاريح طارئة
 * تتداخل نوافذها مع سابقٍ على الشارع نفسه، أي أنها **كانت ستُحاسب** لو رُفع
 * الاستثناء. فالفحص ليس تحصيل حاصل: إن سقطت قاعدة الاستثناء تحرّك الرقم
 * وسقطت الحزمة. والفحص المرافق (`الاستثناء يعمل ولا يمرّ فارغاً`) يمنع
 * الوجه المقابل — استثناءً صحيحاً لا يُطبَّق على شيء فيُقرأ عدلاً بلا عمل.
 *
 * **وما تحرس منه أيضاً: علّة الفحص الكاذبة.**
 *
 * المحفظة لا تحمل حالة `missed-window` واحدة — نوافذها متقاربة ومدد أعمالها
 * أطول من تباعد بداياتها، فكل حالة فيها تداخلٌ زمنيّ. فحصُ تلك التصنيفات على
 * المحفظة يعطي أخضر بلا أن يُنفَّذ سطر منها، والأخضر يُقرأ حراسةً. لذلك
 * تُفحص على حالات مُصطنَعة صريحة، ويُفحص **إعلانُ هذا الحدّ نفسه** كي لا
 * يتقادم صامتاً إن تغيّرت المحفظة.
 *
 * التشغيل: node presentation/tests/digonce-compliance-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
global.window = global;

const Portfolio = require(path.join(ROOT, 'masar-portfolio.js'));
const Engine = require(path.join(ROOT, 'masar-engine.js'));
const Analysis = require(path.join(ROOT, 'masar-desk-analysis.js'));
const DeskFile = require(path.join(ROOT, 'masar-desk-file.js'));
const Coordination = require(path.join(ROOT, 'masar-desk-coordination.js'));
const Builder = require(path.join(ROOT, 'scripts', 'build-digonce-compliance.js'));

/* البطاقة تقرأ الوحدة من المضيف — سطرٌ واحد فيها، بلا تعديل رأس UMD، كي يبقى
   الدمج مع من يعمل على الملف نفسه بلا ألم. فالفحص يضع الوحدة على المضيف كما
   يضع المتصفح نتيجة `<script>`. */
global.MasarDeskCoordination = Coordination;

const REPORT = path.join(ROOT, 'data', 'digonce-compliance.json');
const OPTIONS_PAPER = path.join(REPO, 'docs', 'policy', 'DIGONCE-COMPLIANCE-POLICY.md');
const SUMMARY = path.join(REPO, 'docs', 'policy', 'DIGONCE-COMPLIANCE-SUMMARY.md');
const DATA_REQUEST = path.join(REPO, 'research', 'evidence-intelligence',
  'DATA-ACQUISITION-TARGETS.md');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const portfolio = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8'));

/** حالة مُصطنَعة: تصريح بأقل الحقول التي يقرؤها المصنّف. */
function permit(ref, street, promoter, start, end, subtype) {
  return {
    properties: {
      permitRef: ref,
      street: street,
      promoter: promoter,
      start: start,
      end: end,
      subtype: subtype || 'maintenance',
    },
  };
}

// ---- لا إسقاط صامت -------------------------------------------------------

test('كل تصريح في المحفظة له حالة — بلا إسقاط صامت', () => {
  /* إسقاط ما تعذّر حكمه يجعل النسب تُقرأ على محفظة أصغر من المعلَنة، وهي
     أخطر طريقة لتحسين رقم: لا تكذب، تُخفي المقام. */
  assert.strictEqual(report.total, portfolio.features.length);
  portfolio.features.forEach((feature) => {
    const entry = report.permits[feature.properties.permitRef];
    assert.ok(entry, `${feature.properties.permitRef}: بلا حالة`);
    assert.ok(entry.status, 'حالة بلا مفتاح');
  });
  const summed = Object.values(report.tally).reduce((a, b) => a + b, 0);
  assert.strictEqual(summed, report.total,
    'مجموع التصنيفات لا يساوي المحفظة — تصريحٌ سقط من العدّ');
});

// ---- الاتجاهية ------------------------------------------------------------

test('التصنيف اتجاهيّ — المتأخر مسمّى والسابق غير محاسَب', () => {
  const dayOf = (value) => Date.parse(value);
  report.cases.forEach((row) => {
    assert.ok(row.earlierRef, `${row.permitRef}: حالة بلا سابق مسمّى`);
    assert.ok(row.earlierPromoter, `${row.permitRef}: سابق بلا جهة`);
    assert.ok(dayOf(row.start) > dayOf(row.earlierStart),
      `${row.permitRef}: المنسوب إليه ليس المتأخر — بدأ قبل «سابقه»`);
  });

  /* والأول لا يظهر في الحالات أبداً: ظهورُه فيها هو العيب بعينه. */
  const wrongly = Object.entries(report.permits)
    .filter(([, entry]) => (entry.status === 'first-on-street'
      || entry.status === 'alone-on-street') && entry.chargeable);
  assert.deepStrictEqual(wrongly, [],
    'الأول على الشارع محسوب مخالفاً — المؤشّر فقد اتجاهه');
});

test('السابق المنسوب هو أقوى فرصة تنسيق أُتيحت، لا أضعفها', () => {
  /* اختيار الأضعف يجعل المؤشّر يُخفّف عن نفسه بسابقٍ صادف أنه بعيد — وهي
     طريقة صامتة لتحسين رقم. الفحص على حالة فيها سابقان: قريب متداخل وبعيد. */
  const features = [
    permit('A', 'شارع', 'جهة أ', '2026-01-01T00:00:00Z', '2026-01-05T00:00:00Z'),
    permit('B', 'شارع', 'جهة ب', '2026-06-01T00:00:00Z', '2026-06-20T00:00:00Z'),
    permit('C', 'شارع', 'جهة ج', '2026-06-10T00:00:00Z', '2026-06-30T00:00:00Z'),
  ];
  const out = Builder.classify(features, Builder.WINDOW_DAYS);
  assert.strictEqual(out.permits.C.status, 'overlapping');
  assert.strictEqual(out.permits.C.earlierRef, 'B',
    'نُسبت الحالة إلى السابق البعيد بدل المتداخل');
});

test('من بدأ في اللحظة نفسها ليس متأخراً عن أحد', () => {
  const features = [
    permit('A', 'شارع', 'جهة أ', '2026-03-01T08:00:00Z', '2026-03-20T00:00:00Z'),
    permit('B', 'شارع', 'جهة ب', '2026-03-01T08:00:00Z', '2026-03-25T00:00:00Z'),
  ];
  const out = Builder.classify(features, Builder.WINDOW_DAYS);
  assert.strictEqual(out.permits.A.status, 'first-on-street');
  assert.strictEqual(out.permits.B.status, 'first-on-street',
    'مُحاسَبٌ على تأخّرٍ لم يقع — بدأ في اللحظة نفسها');
});

// ---- الطوارئ: أهمّ فحص في الحزمة -----------------------------------------

test('الطوارئ الثمانية والثلاثون مستثناة — لا واحدة منها محسوبة مخالفةً', () => {
  const emergency = portfolio.features
    .filter((feature) => feature.properties.subtype === 'emergency');
  assert.strictEqual(emergency.length, report.exemptionEffect.emergencyPermits,
    'عدد الطوارئ في التقرير يخالف المحفظة');

  const charged = emergency
    .map((feature) => feature.properties.permitRef)
    .filter((ref) => report.permits[ref].chargeable);
  assert.deepStrictEqual(charged, [],
    `حالة طارئة محسوبة مخالفةً: ${charged.join('، ')} — مؤشّر يعاقب الطوارئ `
    + 'مؤشّر ظالم، ويُرفض في أول مراجعة');

  /* والطوارئ خارج البسط **والمقام** معاً: بقاؤها في المقام يخفض نسبة جهةٍ
     جُلّ عملها طارئ لسبب لا علاقة له بتنسيقها. */
  report.promoters.forEach((row) => {
    assert.strictEqual(row.permits, row.emergencyPermits + row.nonEmergencyPermits,
      `${row.promoter}: تفكيك التصاريح لا يجمع`);
  });
  const emergencyByPromoter = {};
  emergency.forEach((feature) => {
    const name = feature.properties.promoter;
    emergencyByPromoter[name] = (emergencyByPromoter[name] || 0) + 1;
  });
  report.promoters.forEach((row) => {
    assert.strictEqual(row.emergencyPermits, emergencyByPromoter[row.promoter] || 0,
      `${row.promoter}: عدّ الطوارئ في المقام يخالف المحفظة`);
  });
});

test('الاستثناء يعمل ولا يمرّ فارغاً — لولاه لتحرّك الرقم', () => {
  /* الوجه المقابل للفحص السابق: استثناءٌ صحيحٌ لا يُطبَّق على شيء يُقرأ
     عدلاً وهو حرفٌ ميت. الرقم أدناه هو أثره المحسوب، وصفرٌ فيه يعني أن
     عدل القاعدة غير مُختبَر على هذه البيانات. */
  const effect = report.exemptionEffect;
  assert.ok(effect.emergencyWithPredecessor > 0,
    'لا تصريح طارئ له سابق — قاعدة الاستثناء غير مُختبَرة على المحفظة');
  assert.strictEqual(effect.emergencyWouldBeChargeable,
    effect.emergencyWithPredecessor,
    'أثر الاستثناء المحسوب لا يطابق عدد الطوارئ التي لها سابق');
  assert.ok(effect.emergencyWouldBeChargeable > 0,
    'الاستثناء لا يُسقط حالةً واحدة — يُقرأ عدلاً بلا عمل');

  /* والحالات المستثناة تحمل ما كانت ستكون عليه، فالقاعدة قابلة للمراجعة. */
  Object.values(report.permits)
    .filter((entry) => entry.status === 'exempt-emergency')
    .forEach((entry) => {
      assert.ok(entry.wouldBe, `${entry.street}: حالة مستثناة بلا ما كانت ستكون`);
    });
});

test('الطارئ يُستثنى وغير الطارئ يُحاسب على المدخلات نفسها', () => {
  /* هذا هو الفحص الذي يسقط لو حُسبت حالة طارئة مخالفةً: زوجٌ واحد بمدخلات
     متطابقة إلا في `subtype`، فالفرق في النتيجة لا يمكن أن يأتي من غيره. */
  const earlier = permit('A', 'شارع', 'جهة أ',
    '2026-04-01T00:00:00Z', '2026-04-20T00:00:00Z');
  const later = (subtype) => permit('B', 'شارع', 'جهة ب',
    '2026-04-10T00:00:00Z', '2026-04-30T00:00:00Z', subtype);

  const planned = Builder.classify([earlier, later('development')],
    Builder.WINDOW_DAYS).permits.B;
  assert.strictEqual(planned.status, 'overlapping');
  assert.strictEqual(planned.chargeable, true,
    'تداخلٌ زمنيّ مخطَّط لا يُحاسب — المؤشّر لا يقيس شيئاً');

  const urgent = Builder.classify([earlier, later('emergency')],
    Builder.WINDOW_DAYS).permits.B;
  assert.strictEqual(urgent.status, 'exempt-emergency');
  assert.strictEqual(urgent.chargeable, false,
    'حالة طارئة محسوبة مخالفةً على المدخلات نفسها');
  assert.strictEqual(urgent.wouldBe, 'overlapping',
    'الاستثناء لا يعلن ما أسقطه');
});

// ---- الاستثناءان الثالث والرابع ------------------------------------------

test('ناقص البيانات غير قابل للحكم لا مخالف', () => {
  const features = [
    permit('A', 'شارع', 'جهة أ', '2026-05-01T00:00:00Z', '2026-05-20T00:00:00Z'),
    permit('B', 'شارع', 'جهة ب', 'ليس تاريخاً', '2026-05-25T00:00:00Z'),
    permit('C', '', 'جهة ج', '2026-05-10T00:00:00Z', '2026-05-30T00:00:00Z'),
  ];
  const out = Builder.classify(features, Builder.WINDOW_DAYS);
  assert.strictEqual(out.permits.B.status, 'unjudgeable');
  assert.strictEqual(out.permits.C.status, 'unjudgeable');
  assert.ok(!out.permits.B.chargeable && !out.permits.C.chargeable,
    'حالة ناقصة البيانات محسوبة مخالفةً — الاستثناء قبل الاتهام');
});

test('الاستثناء الرابع: السابق طارئ والفجوة موجبة — ويسقط عند التداخل', () => {
  /* لا مثال له في المحفظة (كل حالاتها تداخل)، فيُفحص مُصطنَعاً وإلّا كان
     أخضرَ بلا تنفيذ. والحدّ مفحوص معه: التداخل يُبقي الحساب. */
  const urgentEarlier = permit('A', 'شارع', 'جهة أ',
    '2026-02-01T00:00:00Z', '2026-02-10T00:00:00Z', 'emergency');

  const after = Builder.classify([urgentEarlier,
    permit('B', 'شارع', 'جهة ب', '2026-02-15T00:00:00Z', '2026-03-01T00:00:00Z'),
  ], Builder.WINDOW_DAYS).permits.B;
  assert.strictEqual(after.status, 'exempt-unplannable-predecessor',
    'حُوسِب على نافذة طارئة لم تكن معلنة حين خطّط');
  assert.strictEqual(after.chargeable, false);
  assert.strictEqual(after.wouldBe, 'missed-window');

  const during = Builder.classify([urgentEarlier,
    permit('C', 'شارع', 'جهة ج', '2026-02-05T00:00:00Z', '2026-02-20T00:00:00Z'),
  ], Builder.WINDOW_DAYS).permits.C;
  assert.strictEqual(during.status, 'overlapping',
    'الاستثناء الرابع تمدّد إلى التداخل — الخندق كان مفتوحاً وهو يبدأ');
  assert.strictEqual(during.chargeable, true);
});

// ---- العتبة: مصدرها ومعناها وحساسيتها ------------------------------------

test('العتبة مقروءة من مصدر واحد لا منسوخة', () => {
  assert.strictEqual(Builder.WINDOW_DAYS, Portfolio.DIG_ONCE_WINDOW_DAYS,
    'عتبة الكشف انفصلت عن نافذة الدمج — رقمان يفترقان بلا أن ينبّه شيء');
  assert.strictEqual(report.windowDays, Portfolio.DIG_ONCE_WINDOW_DAYS);
  assert.match(report.windowBasis, /اصطلاح لا قياس/,
    'العتبة معروضة بلا إعلان أنها اصطلاح — رقمٌ يهبط من السماء');
});

test('التصنيف يتبع الفجوة ولا يُكتب — والحدود متسقة', () => {
  report.cases.forEach((row) => {
    if (row.status === 'overlapping') {
      assert.ok(row.gapDays < 0, `${row.permitRef}: تداخل بفجوة ${row.gapDays}`);
    } else if (row.status === 'missed-window'
      || row.status === 'exempt-unplannable-predecessor') {
      assert.ok(row.gapDays >= 0 && row.gapDays <= report.windowDays,
        `${row.permitRef}: نافذة قريبة بفجوة ${row.gapDays}`);
    } else if (row.status === 'too-far-apart') {
      assert.ok(row.gapDays > report.windowDays,
        `${row.permitRef}: متباعد بفجوة ${row.gapDays}`);
    }
  });
});

test('حساسية الحصيلة للعتبة معروضة، والاصطلاح ضمن مداها', () => {
  assert.ok(report.sensitivity.length >= 3, 'حساسية بعتبة واحدة ليست حساسية');
  const days = report.sensitivity.map((row) => row.windowDays);
  assert.ok(days.indexOf(report.windowDays) !== -1,
    'الاصطلاح المستعمل خارج مدى الحساسية المعروض');
  assert.ok(Math.min.apply(null, days) < report.windowDays
    && Math.max.apply(null, days) > report.windowDays,
    'الحساسية معروضة في اتجاه واحد — لا تكشف أثر الاختيار');
  /* التداخل الزمني لا يتحرك بالعتبة أبداً: تعريفُه لا يذكرها. */
  report.sensitivity.forEach((row) => {
    assert.strictEqual(row.overlapping, report.tally.overlapping,
      `عتبة ${row.windowDays}: التداخل تحرّك بالعتبة — وهو لا يعتمد عليها`);
  });
});

// ---- حدّ البيانات: معلَن ومطابق للحصيلة ----------------------------------

test('حدّ البيانات معلَن ومطابق لما في الحصيلة فعلاً', () => {
  /* الحدّ مكتوب في التقرير: المحفظة لا تحمل «نافذة فائتة». فإن حملتها يوماً
     صار النصّ كذباً — فيُربط بالعدّ لا يُترك نصّاً حراً. */
  assert.ok(report.dataLimit && report.dataLimit.length > 80,
    'التقرير بلا حدّ مكتوب على بياناته');
  const declaredNone = /لا تقع في هذه المحفظة ولا مرة/.test(report.dataLimit);
  assert.strictEqual(declaredNone, report.tally['missed-window'] === 0,
    'حدّ البيانات المعلَن يخالف الحصيلة — نصٌّ تقادم صامتاً. أعد توليد الملف '
    + 'أو صحّح الحدّ.');
  const declaredOngoingOnly = /لا يحمل الإشعار في هذه المحفظة إلا علاقة ongoing/
    .test(report.dataLimit);
  const onlyOngoing = report.noticeRelations['recently-ended'] === 0
    && report.noticeRelations.upcoming === 0;
  assert.strictEqual(declaredOngoingOnly, onlyOngoing,
    'الحدّ يقول إن الإشعار كله «قائم» والبيانات تقول غير ذلك');
});

test('التقرير يعلن درجته وحدّه ولا يدّعي قياساً', () => {
  assert.strictEqual(report.grade, 'model-derived');
  assert.strictEqual(report.portfolioMode, 'synthetic');
  assert.match(report.doesNotProve, /لا قياس ميداني/);
  assert.match(report.portfolioLimit, /مولَّدة/);
  const forbidden = ['مرصود', 'مقيس', 'مُقاس'];
  forbidden.forEach((word) => {
    assert.ok(report.rule.indexOf(word) === -1,
      `«${word}» في وصف حكم مشتقّ من محفظة مولَّدة`);
  });
  /* الحظر القائم لا يُحيا بصياغة أخرى. */
  const text = JSON.stringify(report);
  assert.ok(!/حفريات? متجنَّبة|عمليات حفر متجنَّبة/.test(text),
    'ادعاء «حفريات متجنَّبة» عاد — العدّ يقول كم تصريحاً زاد عن واحد، لا كم '
    + 'حفرة اختفت');
});

test('كل استثناء يحمل سببه المكتوب', () => {
  const keys = report.exemptions.map((row) => row.key);
  ['exempt-emergency', 'first-on-street', 'unjudgeable',
    'exempt-unplannable-predecessor'].forEach((key) => {
    assert.ok(keys.indexOf(key) !== -1, `استثناء بلا إدراج: ${key}`);
  });
  report.exemptions.forEach((row) => {
    assert.ok(row.why && row.why.length > 40,
      `${row.key}: استثناء بلا سبب مكتوب — قائمةٌ بلا أسباب تتحول إلى مكبّ`);
  });
});

// ---- المؤشّر: بسطه ومقامه --------------------------------------------------

test('مؤشّر كل جهة ببسطه ومقامه، والنسبة مشتقّة لا مكتوبة', () => {
  assert.ok(report.promoters.length >= 2, 'مؤشّر بجهة واحدة ليس مؤشّراً');
  const permits = report.promoters.reduce((sum, row) => sum + row.permits, 0);
  assert.strictEqual(permits, report.total,
    'مجموع تصاريح الجهات لا يساوي المحفظة');

  report.promoters.forEach((row) => {
    assert.ok(row.missedCases <= row.nonEmergencyPermits,
      `${row.promoter}: بسط أكبر من مقامه`);
    if (row.nonEmergencyPermits === 0) {
      assert.strictEqual(row.ratePct, null,
        `${row.promoter}: نسبة بلا مقام — صفرٌ يُقرأ امتثالاً تاماً وهو «لا مقام»`);
      return;
    }
    const expected = Math.round(
      (1000 * row.missedCases) / row.nonEmergencyPermits) / 10;
    assert.strictEqual(row.ratePct, expected,
      `${row.promoter}: النسبة لا تطابق بسطها على مقامها`);
  });

  const chargeable = report.promoters.reduce((sum, row) => sum + row.missedCases, 0);
  assert.strictEqual(chargeable, report.chargeableCaseCount,
    'مجموع حالات الجهات لا يساوي الحصيلة — حالةٌ نُسبت إلى لا أحد');
});

test('الترتيب بلا تشهير — لا لفظ «مخالفة» في مفاتيح المؤشّر', () => {
  /* الصياغة قرارٌ لا تنسيق: لوحة العار تدفع الجهة إلى إخفاء الطلب، وأداة
     التنسيق تدفعها إلى الاتصال بجارها. */
  const surface = fs.readFileSync(path.join(ROOT, 'masar-desk-coordination.js'),
    'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.ok(/فرص التنسيق الفائتة/.test(surface),
    'سطح المؤشّر لا يستعمل الصياغة المقرَّرة «فرص تنسيق فائتة»');

  /* لفظُ التشهير مسموح داخل نفيه وحده — «أداة تنسيق لا لوحة عار» هو التحفّظ
     نفسه، ومنعُه بإطلاق يدفع إلى حذفٍ صامت بلا سبب مكتوب. */
  const SHAME = /(.{0,4})(لوحة عار|قائمة سوداء|المخالفون)/g;
  const unnegated = [];
  let match;
  while ((match = SHAME.exec(surface)) !== null) {
    if (!/لا\s*$/.test(match[1])) unnegated.push(match[2]);
  }
  assert.deepStrictEqual(unnegated, [],
    `صياغة تشهير على سطح المؤشّر: ${unnegated.join('، ')}`);
});

// ---- الإشعار: الشقّ البنّاء ------------------------------------------------

test('الإشعار يسمّي الجهة والتواريخ والإجراء بلغة غير متخصصة', () => {
  const feature = portfolio.features.find((one) => {
    const notice = report.notices[one.properties.permitRef];
    return notice && (notice.others || []).length > 0;
  });
  assert.ok(feature, 'لا تصريح له سياق تنسيق — راجع التقرير');

  global.MASAR_DIGONCE_COMPLIANCE = report;
  const analysis = Analysis.evaluate(feature.properties, Engine);
  const html = DeskFile.renderSummary(feature, analysis);

  assert.ok(html.indexOf('تنبيه تنسيق') !== -1, 'البطاقة لا تُشعر بشيء');
  const other = report.notices[feature.properties.permitRef].others[0];
  assert.ok(html.indexOf(Coordination.escapeHtml(other.promoter)) !== -1,
    'الإشعار لا يسمّي الجهة — «تعارض» بلا اسم لا يُنسَّق معه');
  assert.ok(html.indexOf(other.permitRef) !== -1, 'الإشعار بلا مرجع التصريح');
  assert.ok(html.indexOf('طلب نافذة مشتركة') !== -1,
    'إشعار بلا إجراء مقترح — إبلاغٌ بمشكلة لا دعوةٌ إلى حلّ');
  assert.ok(html.indexOf('السكان') !== -1 || html.indexOf('يدفعون') !== -1,
    'الإشعار بلا أثرٍ يُقرأ بلا مصطلح — التواريخ وحدها لا تقول شيئاً');
  assert.ok(html.indexOf('لا أمر تنفيذ') !== -1,
    'الإشعار يُقرأ أمراً — الدمج يتطلّب موافقة كل جهة');
});

test('كل سطح يعرض المؤشّر يحمل حدّ «المحفظة مولَّدة»', () => {
  /* الأسماء حقيقية والسلوك مولَّد. مؤشّرٌ بلا هذا الحدّ يُقرأ حكماً على شركة
     قائمة، وهو ضرر لا فائدة. */
  const feature = portfolio.features.find((one) => {
    const notice = report.notices[one.properties.permitRef];
    return notice && (notice.others || []).length > 0;
  });
  global.MASAR_DIGONCE_COMPLIANCE = report;
  const html = Coordination.notice(feature.properties, global);
  assert.ok(html.indexOf('مولَّدة') !== -1, 'سطح المؤشّر بلا حدّ التوليد');
  assert.ok(html.indexOf('من') !== -1 && /\d/.test(html),
    'المؤشّر معروض بلا بسطه ومقامه');
  assert.ok(html.indexOf('لا قياس ميداني') !== -1,
    'الحدّ الميداني غائب عن سطح المؤشّر');
  assert.ok(html.indexOf('لا تعدل إلا إذا أُثبت أن الإشعار وصل') !== -1,
    'السطح يعرض مؤشّراً بلا شرطه: الإشعار سابقٌ للعقوبة');
});

test('حالة كل تصريح معروضة — والاستثناء يُعرض كما تُعرض المخالفة', () => {
  /* قائمةٌ تذكر المخالفات وتصمت عن المستثنيات تجعل الصمت اتهاماً. */
  Object.keys(Coordination.STATUSES).forEach((key) => {
    const entry = Coordination.STATUSES[key];
    assert.ok(entry.label && entry.plain && entry.plain.length > 30,
      `${key}: حالة بلا شرح يُقرأ بلا مصطلح`);
  });
  const statuses = new Set(Object.values(report.permits).map((one) => one.status));
  statuses.forEach((status) => {
    assert.ok(Coordination.STATUSES[status],
      `حالة في البيانات بلا صياغة على السطح: ${status}`);
  });
});

test('علاقات الإشعار الثلاث مفحوصة — والمحفظة تحمل واحدة منها فقط', () => {
  /* `recently-ended` و`upcoming` لا مثال لهما في المحفظة، فتُفحصان
     مُصطنَعتين. وبلا ذلك تبقى صياغتاهما على السطح بلا تنفيذ. */
  const here = permit('X', 'شارع', 'جهة س',
    '2026-09-01T00:00:00Z', '2026-09-10T00:00:00Z');
  const before = permit('Y', 'شارع', 'جهة ص',
    '2026-08-01T00:00:00Z', '2026-08-25T00:00:00Z');
  const after = permit('Z', 'شارع', 'جهة ع',
    '2026-09-20T00:00:00Z', '2026-09-30T00:00:00Z');

  const notices = Builder.noticesOf([here, before, after], Builder.WINDOW_DAYS);
  const relations = notices.X.others.reduce((map, row) => {
    map[row.permitRef] = row.relation;
    return map;
  }, {});
  assert.strictEqual(relations.Y, 'recently-ended');
  assert.strictEqual(relations.Z, 'upcoming');

  Object.keys(Coordination.RELATIONS).forEach((key) => {
    const entry = Coordination.RELATIONS[key];
    assert.ok(entry.lead && entry.consequence.length > 30,
      `${key}: علاقة بلا أثرٍ مكتوب بلغة عادية`);
  });

  const upcoming = Coordination.notice(here.properties, {
    MASAR_DIGONCE_COMPLIANCE: {
      windowDays: Builder.WINDOW_DAYS,
      portfolioLimit: 'المحفظة مولَّدة. لا قياس ميداني.',
      notices: notices,
      permits: Builder.classify([here, before, after], Builder.WINDOW_DAYS).permits,
      promoters: [],
    },
  });
  assert.ok(upcoming.indexOf('ما زال بإمكانك أن تلحق بها') !== -1,
    'العمل القادم معروض بلا الفرصة التي يفتحها — وهو الوحيد الذي يُلحق به');
});

test('ما بعد نافذة العتبة خارج الإشعار — لا ضجيج', () => {
  const here = permit('X', 'شارع', 'جهة س',
    '2026-09-01T00:00:00Z', '2026-09-10T00:00:00Z');
  const distant = permit('W', 'شارع', 'جهة ق',
    '2026-01-01T00:00:00Z', '2026-01-10T00:00:00Z');
  const notices = Builder.noticesOf([here, distant], Builder.WINDOW_DAYS);
  assert.deepStrictEqual(notices.X.others, [],
    'عملٌ يفصله شهور معروضٌ في الإشعار — إشعارٌ يُشعر بكل شيء لا يُقرأ');
});

test('غياب الملخّص يُسكت البطاقة ولا يُسقطها', () => {
  /* بطاقةٌ صامتة أصدق من تقدير، وأسلم من صفحة تسقط. */
  const feature = portfolio.features[0];
  const saved = global.MASAR_DIGONCE_COMPLIANCE;
  delete global.MASAR_DIGONCE_COMPLIANCE;
  try {
    const analysis = Analysis.evaluate(feature.properties, Engine);
    const html = DeskFile.renderSummary(feature, analysis);
    assert.ok(html.indexOf('تنبيه تنسيق') === -1,
      'البطاقة تعرض القسم بلا بيانات');
    assert.ok(html.length > 100, 'البطاقة سقطت بغياب ملف اختياري');
    assert.strictEqual(Coordination.notice(feature.properties, {}), '');
  } finally {
    global.MASAR_DIGONCE_COMPLIANCE = saved;
  }
});

test('لا حقن HTML من أسماء الجهات والشوارع', () => {
  const hostile = permit('<img src=x onerror=alert(1)>', '"><script>bad()</script>',
    '<b>جهة</b>', '2026-09-01T00:00:00Z', '2026-09-10T00:00:00Z');
  const other = permit('OK', '"><script>bad()</script>', '<i>جارة</i>',
    '2026-09-03T00:00:00Z', '2026-09-12T00:00:00Z');
  const features = [hostile, other];
  const html = Coordination.notice(other.properties, {
    MASAR_DIGONCE_COMPLIANCE: {
      windowDays: Builder.WINDOW_DAYS,
      portfolioLimit: 'المحفظة مولَّدة. لا قياس ميداني.',
      notices: Builder.noticesOf(features, Builder.WINDOW_DAYS),
      permits: Builder.classify(features, Builder.WINDOW_DAYS).permits,
      promoters: [],
    },
  });
  /* المطلوب أن لا يتكوّن وسم، لا أن تغيب الحروف: `onerror=` مهرَّبةً نصٌّ
     يُقرأ ولا يُنفَّذ. ففحصُ غياب اللفظ يمنع ما لا يضرّ ويفوّت ما يضرّ. */
  assert.ok(html.indexOf('<script') === -1, 'وسم سكربت مرّ من بيانات التصريح');
  assert.ok(html.indexOf('<img') === -1, 'وسم صورة مرّ من مرجع التصريح');
  assert.ok(html.indexOf('<b>') === -1 && html.indexOf('<i>') === -1,
    'وسم مرّ من اسم الجهة');
  assert.ok(html.indexOf('&lt;script') !== -1,
    'النصّ الخطير لم يظهر مهرَّباً — الفحص لا يفحص شيئاً');
});

// ---- الوصل والوثائق -------------------------------------------------------

test('المكتب يُحمّل الملخّص والوحدة، والبطاقة تستدعيها', () => {
  const page = fs.readFileSync(path.join(ROOT, 'masar-desk.html'), 'utf8');
  assert.match(page, /data\/digonce-compliance\.js/,
    'المكتب لا يُحمّل ملخّص الامتثال');
  assert.match(page, /masar-desk-coordination\.js/,
    'المكتب لا يُحمّل وحدة الإشعار');
  const card = fs.readFileSync(path.join(ROOT, 'masar-desk-file.js'), 'utf8');
  assert.match(card, /MasarDeskCoordination/,
    'بطاقة القرار لا تستدعي الإشعار — وحدةٌ محمَّلة لا تُقرأ');
});

test('ورقة الخيارات مكتوبة بمقايضاتها، والإشعار شرط سابق للعقوبة', () => {
  assert.ok(fs.existsSync(OPTIONS_PAPER), `ورقة الخيارات مفقودة: ${OPTIONS_PAPER}`);
  const paper = fs.readFileSync(OPTIONS_PAPER, 'utf8');
  ['غرامة تأخيرية', 'تأخير التصريح التالي', 'مؤشّر امتثال منشور',
    'نافذة مشتركة إلزامية'].forEach((option) => {
    assert.ok(paper.indexOf(option) !== -1, `خيار غائب عن الورقة: ${option}`);
  });
  assert.ok(/يخفق حين|يفشل حين/.test(paper),
    'ورقة خيارات بلا عمود «يخفق حين» ليست ورقة مقايضات');
  assert.ok(paper.indexOf('النظام لا يغرّم') !== -1,
    'الورقة لا تعلن أن الغرامة صلاحية الجهة البلدية');
  assert.ok(/الإشعار شرط سابق للعقوبة/.test(paper),
    'أهمّ سطر في الورقة غائب: الإشعار شرط سابق للعقوبة لا مكمّل لها');
});

test('طلب البيانات مكتوب بجهته وبما يفتحه', () => {
  const register = fs.readFileSync(DATA_REQUEST, 'utf8');
  assert.ok(register.indexOf('سجل تصاريح حفر') !== -1,
    'طلب سجلّ التصاريح غائب عن سجل البيانات المطلوبة');
  assert.ok(register.indexOf('أمانة منطقة الرياض') !== -1,
    'الطلب بلا جهة — طلبٌ بلا مُرسَل إليه ليس طلباً');
  assert.ok(/اثني عشر شهراً|12 شهراً/.test(register),
    'الطلب بلا مدة مطلوبة');
});

test('ملخّص مكتوب: ما قِس وما افتُرض وما بقي مجهولاً', () => {
  assert.ok(fs.existsSync(SUMMARY), `الملخّص مفقود: ${SUMMARY}`);
  const summary = fs.readFileSync(SUMMARY, 'utf8');
  ['ما قِيس', 'ما افتُرض', 'ما بقي مجهولاً'].forEach((section) => {
    assert.ok(summary.indexOf(section) !== -1, `قسم غائب عن الملخّص: ${section}`);
  });
  assert.ok(summary.indexOf('مولَّدة') !== -1,
    'الملخّص بلا حدّ التوليد — وهو أول ما يجب أن يُقرأ');
});

console.log(`ALL TESTS PASSED (${count})`);
