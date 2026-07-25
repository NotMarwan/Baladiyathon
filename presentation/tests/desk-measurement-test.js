'use strict';
const assert = require('assert');
const path = require('path');

const Measure = require(path.join(__dirname, '..', 'athar-desk-measurement.js'));
const Calibration = require(path.join(__dirname, '..', 'athar-impact-calibration.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

/** مخزن في الذاكرة بعقد localStorage — الوحدة تُحقن مخزنها ولا تفترضه. */
function memoryStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
  };
}

/* ---- الرصدة التركيبية: ثابتة ومعقولة ---- */

ok('الرصدة مشتقّة من المعرّف — إعادة التشغيل تعطي الرقم نفسه', () => {
  // رقم يتغيّر كل تحديث يكشف نفسه للمحكّم في ثانيتين.
  const first = Measure.syntheticObservation('p084', 1000);
  const second = Measure.syntheticObservation('p084', 1000);
  assert.deepStrictEqual(first, second);
});

ok('معرّفان مختلفان يعطيان رصدتين مختلفتين', () => {
  const a = Measure.syntheticObservation('p001', 1000);
  const b = Measure.syntheticObservation('p002', 1000);
  assert.notStrictEqual(a.observedVehHours, b.observedVehHours);
});

ok('النسبة تقع في نطاق معلن ولا تشذّ', () => {
  for (let i = 0; i < 400; i += 1) {
    const found = Measure.syntheticObservation('p' + i, 5000);
    assert.ok(found.ratio >= 0.72 && found.ratio <= 1.46,
      `نسبة خارج النطاق: ${found.ratio}`);
  }
});

ok('الرصدة تُعلن أنها تركيبية في بنيتها لا في نصّها فقط', () => {
  assert.strictEqual(Measure.syntheticObservation('p1', 100).synthetic, true);
});

ok('توقّع غير موجب لا يُنتج رصدة', () => {
  assert.strictEqual(Measure.syntheticObservation('p1', 0), null);
  assert.strictEqual(Measure.syntheticObservation('p1', -5), null);
  assert.strictEqual(Measure.syntheticObservation('p1', NaN), null);
});

/* ---- الانحراف: اتجاهه يصف خطأ المحرك ---- */

ok('رصدٌ أعلى من التوقّع يعني أن المحرك قدّر أقل', () => {
  const gap = Measure.deviation(1000, 1400);
  assert.strictEqual(Math.round(gap.pct), 40);
  assert.strictEqual(gap.direction, 'under');
  assert.ok(gap.label.indexOf('أقل') !== -1);
});

ok('رصدٌ أدنى من التوقّع يعني أن المحرك قدّر أكثر', () => {
  const gap = Measure.deviation(1000, 700);
  assert.strictEqual(Math.round(gap.pct), -30);
  assert.strictEqual(gap.direction, 'over');
  assert.ok(gap.label.indexOf('أكثر') !== -1);
});

ok('فرق دون نصف بالمئة يُقرأ مطابقاً لا انحرافاً', () => {
  assert.strictEqual(Measure.deviation(1000, 1002).direction, 'exact');
});

ok('توقّع صفري لا يُقسم عليه', () => {
  assert.strictEqual(Measure.deviation(0, 500), null);
  assert.strictEqual(Measure.deviation(1000, NaN), null);
});

/* ---- الثقة في المعامل: عددها لا قيمتها ---- */

ok('الثقة تتبع عدد الرصدات لا قيمة المعامل', () => {
  assert.strictEqual(Measure.factorConfidence(0).level, 'لا رصدات');
  assert.strictEqual(Measure.factorConfidence(3).tone, 'danger');
  assert.strictEqual(Measure.factorConfidence(12).tone, 'warning');
  assert.strictEqual(Measure.factorConfidence(30).tone, 'success');
});

ok('ثلاث رصدات لا تُقدَّم كقابلة للاعتماد', () => {
  // وسيط على ثلاث رصدات رقمٌ لا معنى له؛ عرضه بلا قيد تضليل.
  assert.ok(Measure.factorConfidence(3).level.indexOf('غير كافٍ') !== -1);
});

/* ---- ما يُرصد وما لا يُرصد ---- */

ok('لا يُرصد عمل قبل تنفيذه', () => {
  ['Draft', 'ImpactScreening', 'StrategyReview', 'Approved', 'Scheduled']
    .forEach((status) => assert.ok(!Measure.isMeasurable(status), `${status} قابل للرصد`));
});

ok('كل حالة بعد النشر قابلة للرصد', () => {
  ['Deployed', 'Completed', 'Closed'].forEach((status) => {
    assert.ok(Measure.isMeasurable(status), `${status} غير قابل للرصد`);
  });
});

/* ---- العرض: الحدّ معلن في كل حالة ---- */

const notYet = Measure.render({ status: 'ImpactScreening', statusLabel: 'فرز الأثر' },
  1000, null, { n: 0, factor: 1 });
const awaiting = Measure.render({ status: 'Deployed' }, 1000, null, { n: 4, factor: 1.1 });
const measured = Measure.render({ status: 'Completed' }, 1000,
  { observedVehHours: 1300 }, { n: 34, factor: 1.18 });

ok('كل حالة عرض تعلن أن الأرصاد تركيبية', () => {
  [notYet, awaiting, measured].forEach((html) => {
    assert.ok(html.indexOf('تركيبية') !== -1, 'حالة عرض بلا إعلان');
    assert.ok(html.indexOf('لم يقع قياس ميداني') !== -1, 'ادّعت قياساً ميدانياً');
  });
});

ok('العمل قبل التنفيذ يقول لماذا لا يُرصد بدل أن يعرض فراغاً', () => {
  assert.ok(notYet.indexOf('لا يُرصد عمل قبل تنفيذه') !== -1);
  assert.ok(notYet.indexOf('فرز الأثر') !== -1, 'لم يذكر حالته الحالية');
  assert.ok(notYet.indexOf('deskImportObservation') === -1,
    'عرض زرّ استيراد على عمل لا يُرصد');
});

ok('العمل المنفَّذ بلا رصد يعرض توقّعه وزرّ الاستيراد', () => {
  assert.ok(awaiting.indexOf('deskImportObservation') !== -1);
  assert.ok(awaiting.indexOf('1,000') !== -1, 'التوقّع غير معروض');
});

ok('العمل المرصود يعرض الثلاثة: توقّع ومرصود وانحراف', () => {
  ['التوقّع', 'المرصود', 'الانحراف'].forEach((label) => {
    assert.ok(measured.indexOf(label) !== -1, `غائب: ${label}`);
  });
  assert.ok(measured.indexOf('+30.0٪') !== -1, 'الانحراف غير موقّع بإشارته');
  assert.ok(/dir="ltr"[^>]*>\+30\.0٪/.test(measured),
    'الإشارة غير مثبّتة الاتجاه — ستُقرأ على الطرف الخطأ في فقرة عربية');
});

ok('المعامل لا يُعرض بلا عدد رصداته ومستوى الثقة فيه', () => {
  assert.ok(measured.indexOf('معامل التصحيح') !== -1);
  assert.ok(measured.indexOf('34') !== -1, 'عدد الرصدات غائب');
  assert.ok(measured.indexOf('قابل للاعتماد') !== -1);
  assert.ok(measured.indexOf('الوسيط لا المتوسط') !== -1, 'طريقة الاشتقاق غير معلنة');
});

ok('بلا رصدات لا يُعرض معامل — ويُشرح متى يظهر', () => {
  assert.ok(notYet.indexOf('لا معامل تصحيح بعد') !== -1);
  assert.ok(notYet.indexOf('وسيط نسب المرصود') !== -1);
});

ok('الأرقام لاتينية كبقية المكتب', () => {
  [notYet, awaiting, measured].forEach((html) => {
    assert.ok(!/[٠-٩]/.test(html), 'أرقام عربية-هندية تكسر الاتساق');
  });
});

/* ---- التكامل مع سجل المعايرة الحقيقي ---- */

ok('الرصدات المستوردة تنتج معاملاً يطابق وسيط النسب', () => {
  const log = Calibration.createCalibration(memoryStore());
  [[1000, 1200], [1000, 900], [1000, 1100]].forEach(([predicted, observed], index) => {
    log.record({ permitId: 'p' + index, predictedVehHours: predicted, observedVehHours: observed });
  });

  // النسب 1.2 و0.9 و1.1 — وسيطها 1.1
  assert.strictEqual(Number(log.correctionFactor().toFixed(4)), 1.1);
  assert.strictEqual(log.status().n, 3);
});

ok('رصدة شاذّة لا تُزيح المعامل — وهذا سبب اختيار الوسيط', () => {
  const log = Calibration.createCalibration(memoryStore());
  [[1000, 1000], [1000, 1000], [1000, 1000], [1000, 90000]]
    .forEach(([predicted, observed], index) => {
      log.record({ permitId: 'p' + index, predictedVehHours: predicted, observedVehHours: observed });
    });
  assert.ok(log.correctionFactor() < 2, 'الشاذّة أزاحت المعامل — فهو متوسط لا وسيط');
});

console.log(`\n${passed} اختبارات نجحت`);
