'use strict';
/**
 * بوابة سجل الحالات المقارنة.
 *
 * ما تحرسه: أن السجل يبقى **مصدر نطاقات** لا مصدر ادّعاءات. أي أن كل حالة
 * تحمل مصدرها ودرجتها وما لا تُثبته، وأن النطاق المشتقّ منها يصل إلى وحدة
 * الحساسية كما هو لا مُعاد كتابته.
 *
 * التشغيل: node presentation/tests/comparable-cases-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;

const Cases = require(path.join(ROOT, 'athar-comparable-cases.js'));
const Sensitivity = require(path.join(ROOT, 'athar-sensitivity.js'));
const Engine = require(path.join(ROOT, 'athar-engine.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

// ---- شكل السجل ----------------------------------------------------------

test('كل حالة تحمل مصدراً وتاريخ وصول ودرجة دليل', () => {
  const all = Cases.cases();
  assert.ok(all.length >= 6, `${all.length} حالة فقط`);
  all.forEach((item) => {
    assert.ok(item.url || item.kind === 'منهجية لا حالة',
      `${item.key}: بلا رابط`);
    assert.ok(item.accessedOn, `${item.key}: بلا تاريخ وصول`);
    assert.ok(Cases.LEVELS.includes(item.evidenceLevel),
      `${item.key}: درجة دليل خارج القائمة — «${item.evidenceLevel}»`);
  });
});

test('كل حالة تقول ما لا تُثبته', () => {
  /* الحقل الذي يُنسى أولاً هو الذي يمنع سوء الاستعمال. حالةٌ بلا حدّ مكتوب
     تُقتبس بعد شهر في شريحة على أنها تثبت ما لا تثبته. */
  Cases.cases().forEach((item) => {
    assert.ok(item.doesNotProve && item.doesNotProve.length > 3,
      `${item.key}: بلا «لا يُثبت»`);
  });
});

test('لا حالة سعودية بقياسات — والنتيجة معلَنة لا مخفية', () => {
  /* هذه أهم بوابة في الملف: لو دخلت حالة سعودية بلا قياس تحت درجة أعلى من
     «مرجع سياقي»، لصار السجل يوحي بمعايرة محلية لا وجود لها. */
  assert.strictEqual(Cases.summary().localMeasured, 0,
    'حالة سعودية بقياسات ظهرت — راجع مصدرها قبل الاحتفال بها');
  const outcome = Cases.LEDGER.localSearchOutcome;
  assert.ok(outcome && outcome.found === 'لا شيء',
    'نتيجة البحث المحلي غير معلَنة');
  assert.match(outcome.consequence, /نظير عالمي/);
});

test('الحالة المعلَّقة لا تُحذف ولا تُرفَّع بلا قراءة', () => {
  /* كانت البوابة تشترط بقاء حالة معلَّقة واحدة على الأقل — وهو شرطٌ يجعل
     **إنجاز** القراءة فشلاً. حالةُ ديلاوير كانت المعلَّقة الوحيدة، وقُرئت
     فعلاً (خمسة وعشرون موقعاً، متوسط 1475 مركبة/ساعة/حارة)، فسقطت البوابة
     على نجاح.
     المحروس الحقيقي شيئان لا ثالث لهما:
       · المعلَّق ما دام معلَّقاً يبقى `context-only` ولا يُستعمل في شيء.
       · والخروج من التعليق يحتاج **قياساً وطريقة قياس** — لا رفعَ راية. */
  const pending = Cases.cases().filter((item) => item.status);
  pending.forEach((item) => {
    assert.strictEqual(item.evidenceLevel, 'context-only',
      `${item.key}: معلَّق ودرجته أعلى من سياقي`);
    assert.strictEqual(item.usedFor, 'لا شيء بعد.');
  });

  const resolved = Cases.cases().filter((item) => !item.status
    && item.evidenceLevel === 'global-field-measured');
  resolved.forEach((item) => {
    assert.ok(item.metric && Object.keys(item.metric).length > 0,
      `${item.key}: رُفع إلى قياس ميداني بلا رقم واحد`);
    assert.ok(item.measurementMethod && item.measurementMethod.length > 10,
      `${item.key}: قياس ميداني بلا طريقة قياس معلنة`);
    assert.ok(item.doesNotProve && item.doesNotProve.length > 10,
      `${item.key}: بلا حدّ مكتوب`);
  });
});

// ---- الأهلية ------------------------------------------------------------

test('المرجع السياقي لا يدخل مجموعة المعايرة', () => {
  Cases.cases()
    .filter((item) => item.evidenceLevel === 'context-only')
    .forEach((item) => {
      assert.strictEqual(Cases.eligibility(item).eligible, false,
        `${item.key}: مرجع سياقي دخل المعايرة`);
    });
});

test('الحالة الناقصة تُخفَّض ولا تُرفض — الرفض يخفي ما تعرفه', () => {
  const thin = { key: 'x', roadType: 'arterial', evidenceLevel: 'global-analog' };
  const verdict = Cases.eligibility(thin);
  assert.strictEqual(verdict.eligible, false);
  assert.ok(verdict.demotedTo, 'خُفِّضت إلى لا شيء');
  assert.ok(verdict.attributesPresent < verdict.attributesRequired);
});

// ---- التشابه ------------------------------------------------------------

test('درجة التشابه تعلن ما طابق وما غاب — لا رقم مجرَّد', () => {
  const item = { roadType: 'freeway', closureType: 'إغلاق حارة قصير الأمد' };
  const verdict = Cases.similarity(item, { roadType: 'arterial', closureType: 'إغلاق حارة قصير الأمد' });
  assert.ok(verdict.matched.length >= 1);
  assert.ok(verdict.missing.length >= 1, 'الأبعاد الغائبة لم تُعلن');
  assert.ok(['قوي', 'متوسط', 'ضعيف'].includes(verdict.band));
});

test('التشابه لا يُعرض بدقة زائفة', () => {
  const verdict = Cases.similarity({ roadType: 'freeway' }, { roadType: 'freeway' });
  const decimals = String(verdict.score).split('.')[1] || '';
  assert.ok(decimals.length <= 2, `دقة زائفة: ${verdict.score}`);
});

test('صنف الطريق أثقل بُعد — والاختلاف فيه يُسقط التشابه', () => {
  const roadType = Cases.DIMENSIONS.find((dimension) => dimension.key === 'roadType');
  const other = Cases.DIMENSIONS.filter((dimension) => dimension.key !== 'roadType');
  other.forEach((dimension) => {
    assert.ok(roadType.weight >= dimension.weight,
      `${dimension.key} أثقل من صنف الطريق`);
  });
});

// ---- النطاق المشتقّ ------------------------------------------------------

test('النطاق المشتقّ يحمل سنده وحكمه على النطاق القديم', () => {
  const prior = Cases.priorFor('capacityPerLaneInWorkZone');
  assert.ok(prior, 'لا نطاق مشتقّ');
  assert.ok(Array.isArray(prior.basis) && prior.basis.length >= 2,
    'نطاق بسند أقلّ من حالتين');
  assert.ok(prior.priorLow < prior.priorHigh);
  assert.ok(prior.verdictOnCurrentRange && prior.verdictOnCurrentRange.length > 20);
  assert.strictEqual(prior.evidenceLevel, 'global-analog',
    'النطاق يدّعي درجة أعلى من نظير عالمي');
});

test('كل حالة في السند موجودة فعلاً في السجل', () => {
  /* سندٌ يشير إلى حالة محذوفة يُبقي الرقم ويفقد مصدره. */
  const prior = Cases.priorFor('capacityPerLaneInWorkZone');
  const keys = Cases.cases().map((item) => item.key);
  prior.basis.forEach((entry) => {
    const key = entry.split(' ')[0];
    assert.ok(keys.includes(key), `سند إلى حالة غير موجودة: ${key}`);
  });
});

test('الدليل المقيس يحرّك محور السعة لا محور الأرضية', () => {
  /* كانت هذه البوابة تؤكّد أن نطاق **الاحتكاك** مشتقّ من السجل بقسمة
     1800 على طرفَي السعة. وكان ذلك يحرس اشتقاقاً ساقطاً بُعدياً: نسبة سعة
     تُستعمل أرضيةَ نسبة زمن، وهما لا يتساويان تحت BPR.
     فانتقل الحرس إلى موضعه: الدليل المقيس يدخل بوحدته الأصلية على محور
     سعة الحارة داخل منطقة العمل، والأرضية تُعلَن بلا سند. */
  const capacity = Sensitivity.ASSUMPTIONS
    .find((item) => item.key === 'workZoneLaneCapacity');
  const prior = Cases.priorFor('capacityPerLaneInWorkZone');
  const span = capacity.range();

  assert.strictEqual(span.low, prior.priorLow, 'حدّ السعة الأدنى ليس من السجل');
  assert.strictEqual(span.high, prior.priorHigh, 'حدّ السعة الأعلى ليس من السجل');
  assert.strictEqual(capacity.unit, prior.unit,
    'المحور يحرّك الدليل بوحدة غير وحدته — وهو ما كان العيب');
  assert.ok(capacity.source && capacity.source.indexOf('comparable-cases') !== -1,
    'محور السعة بلا إشارة إلى مصدره');
});

test('أرضية الزمن معلَنة بلا سند ولا تدّعي اشتقاقاً', () => {
  const floor = Sensitivity.ASSUMPTIONS
    .find((item) => item.key === 'workZoneFriction');
  assert.strictEqual(floor.kind, 'افتراض معلن',
    'الأرضية ما زالت تُعرض «محسوبة» — وهي بلا سند مقيس');
  assert.ok(/بلا سند/.test(floor.why),
    'تعليل الأرضية لا يقول إنها بلا سند');
  assert.ok(!floor.source || floor.source.indexOf('comparable-cases') === -1,
    'الأرضية تشير إلى سجل الحالات — وهو عدٌّ مزدوج للدليل نفسه');
});

test('المظروف المقيس لم يُضيَّق — والتضييق قبل التحكيم تلميع', () => {
  /* حارسُ التضييق باقٍ، وانتقل معه إلى محور السعة حيث صار الدليل يعيش.
     السجل يحمل أولوية أضيق وأقرب لنوع الطريق [1240 – 1475] من ديلاوير،
     ولو استُعملت لتضييق المسح لبدت التوصيات أثبت مما هي. */
  const span = Sensitivity.ASSUMPTIONS
    .find((item) => item.key === 'workZoneLaneCapacity').range();
  const wide = Cases.priorFor('capacityPerLaneInWorkZone');
  const arterial = Cases.priorFor('capacityPerLaneInWorkZone_signalizedArterial');

  assert.ok(arterial, 'أولوية الشريان بإشارات غابت عن السجل');
  assert.ok(arterial.priorLow > wide.priorLow && arterial.priorHigh < wide.priorHigh,
    'أولوية الشريان لم تعد أضيق من المظروف — راجع السجل');
  assert.strictEqual(span.low, wide.priorLow,
    'المسح ضُيّق إلى أولوية الشريان — تضييق بلا قرار مكتوب');
  assert.strictEqual(span.high, wide.priorHigh,
    'المسح ضُيّق من الأعلى — تضييق بلا قرار مكتوب');
  assert.ok(arterial.whyItDoesNotReplaceTheWiderRange,
    'الأولوية الأضيق بلا سبب مكتوب لعدم استعمالها في التضييق');
});

// ---- الادّعاءات الممنوعة --------------------------------------------------

test('الادّعاء الممنوع يُلتقط', () => {
  const claim = 'أثبتنا أن تصريح الرياض يوفّر نسبة محددة من التأخير';
  const verdict = Cases.checkClaim(claim);
  assert.strictEqual(verdict.ok, false, `مرّ ادّعاء ممنوع: ${claim}`);
});

test('الصياغة المسموحة تمرّ وتذكر أنها غير معايرة محلياً', () => {
  const phrasing = Cases.permittedPhrasing('capacityPerLaneInWorkZone');
  assert.match(phrasing, /لم يُعاير بعد/);
  assert.match(phrasing, /الرياض/);
  assert.strictEqual(Cases.checkClaim(phrasing).ok, true,
    'الصياغة المسموحة نفسها تسقط في البوابة');
});

test('قائمة الاستعمالات الممنوعة غير فارغة ومكتوبة في السجل', () => {
  assert.ok(Array.isArray(Cases.LEDGER.forbiddenUses));
  assert.ok(Cases.LEDGER.forbiddenUses.length >= 4);
  assert.match(Cases.LEDGER.hardRule, /النطاق الأولي مستند إلى حالات مشابهة/);
});

// ---- الاتساق مع الملف ----------------------------------------------------

test('الملف على القرص هو ما تقرؤه الوحدة', () => {
  const raw = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'comparable-cases.json'), 'utf8'));
  assert.strictEqual(raw.cases.length, Cases.cases().length);
  assert.strictEqual(raw.derivedPriors.length, Cases.summary().priors);
});

console.log(`ALL TESTS PASSED (${count})`);
