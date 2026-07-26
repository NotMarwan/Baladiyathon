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

test('الحالة المعلَّقة تبقى معلَّقة ولا تُحذف لتبدو القائمة مكتملة', () => {
  const pending = Cases.cases().filter((item) => item.status);
  assert.ok(pending.length >= 1, 'لا حالة معلَّقة — هل حُذفت؟');
  pending.forEach((item) => {
    assert.strictEqual(item.evidenceLevel, 'context-only',
      `${item.key}: معلَّق ودرجته أعلى من سياقي`);
    assert.strictEqual(item.usedFor, 'لا شيء بعد.');
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

test('نطاق الاحتكاك في وحدة الحساسية مشتقّ من السجل لا مكتوب فيها', () => {
  const assumption = Sensitivity.ASSUMPTIONS
    .find((item) => item.key === 'workZoneFriction');
  const prior = Cases.priorFor('capacityPerLaneInWorkZone');
  const span = assumption.range();
  const base = Engine.DEFAULTS.capacityPerLane;

  assert.strictEqual(span.low, Math.round((base / prior.priorHigh) * 100) / 100);
  assert.strictEqual(span.high, Math.round((base / prior.priorLow) * 100) / 100);
  assert.ok(assumption.source && assumption.source.indexOf('comparable-cases') !== -1,
    'النطاق بلا إشارة إلى مصدره');
});

test('الدليل وسّع النطاق ولم يضيّقه — والتوسيع هو النتيجة لا العيب', () => {
  /* النطاق القديم كان [1.00 – 1.25]. لو صار الجديد أضيق منه لكان ذلك علامة
     على أن أحداً ضيّقه ليبدو القرار مستقراً. هذه البوابة تجعل ذلك فشلاً. */
  const span = Sensitivity.ASSUMPTIONS
    .find((item) => item.key === 'workZoneFriction').range();
  const OLD = { low: 1.0, high: 1.25 };
  assert.ok(span.high > OLD.high,
    `الحدّ الأعلى ${span.high} لم يتجاوز القديم ${OLD.high} — هل ضُيّق النطاق؟`);
  assert.ok(span.low > OLD.low,
    `الحدّ الأدنى ${span.low} لم يرتفع عن «لا احتكاك» — وهو ما لا تسنده حالة`);
  assert.ok(span.high - span.low > OLD.high - OLD.low,
    'النطاق الجديد أضيق — تضييق بلا بيانات جديدة تلميعٌ لا معايرة');
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
