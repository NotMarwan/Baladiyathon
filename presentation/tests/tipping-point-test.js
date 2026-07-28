'use strict';
/**
 * نقطة الانقلاب — بوابة سؤال الفريق الأحمر ٣.
 *
 * `docs/evaluation/loop/cycle-01/RED-TEAM.md` سأل: "صنّفت تصريحاً بجوار
 * مستشفى؛ جدولتكم لم تتغيّر حرفاً. وزنكم يحتاج أن يتضاعف ثلاث مرات ليتغيّر،
 * وحتى حينها ينتقل لساعة لا لنهار." والمستودع يمنع رفع `OBJECTIVE_WEIGHTS`
 * إلى رقم يُرضي السؤال بلا سند — القاعدة «لا رقم بلا سند». فالردّ هنا ليس
 * رقماً جديداً، بل حقلٌ في `switchPoints` يقول أدنى وزن يقلب الفائز، ويقوله
 * صراحةً حتى حين لا يوجد.
 *
 * هذه البوابة لا تثق برقم `switchPoint` على ظاهره: كل فحص انقلاب يُعاد
 * اشتقاقه عبر استدعاء `optimize()` مباشرة عند الوزن ± إبسِلون، فإن حُسبت
 * نقطة الانقلاب خطأً ينقلب الفائز في مكانٍ آخر غير المُعلَن وتسقط البوابة.
 *
 * التشغيل: node presentation/tests/tipping-point-test.js
 */

const assert = require('node:assert');
const path = require('node:path');

const MasarEngine = require(path.join(__dirname, '..', 'masar-engine.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

// نفس مُدخل `sensitivity-test.js` — طلبٌ بجوار مستشفى، حساسية `hospital`.
const HOSPITAL_INPUT = {
  aadt: 45000,
  lanes: 3,
  lanesClosed: 1,
  startHour: 8,
  durationHours: 120,
  capacityPerLane: 1800,
  freeFlowMin: 6,
  sensitivity: 'hospital',
};

const EXPECTED_KEYS = ['key', 'currentWeight', 'current', 'weight', 'next',
  'deltaPct', 'neverFlips', 'note'].sort();

// ---- الشكل والعقد ----------------------------------------------------------

test('كل مُدخل في switchPoints يحمل العقد كاملاً: الوزن الحالي، ونقطة الانقلاب أو غيابها', () => {
  const result = MasarEngine.optimize(HOSPITAL_INPUT);
  assert.strictEqual(result.switchPoints.length, 2, 'مفتاحا الوزن معاً — sensitivity وnightPremium');
  result.switchPoints.forEach((entry) => {
    assert.deepStrictEqual(Object.keys(entry).sort(), EXPECTED_KEYS);
    assert.ok(['sensitivity', 'nightPremium'].indexOf(entry.key) !== -1, `مفتاح غير معروف: ${entry.key}`);
  });
});

test('currentWeight هو الوزن المستعمَل فعلياً في هذا النداء — لا ثابت الوحدة دائماً', () => {
  const base = MasarEngine.optimize(HOSPITAL_INPUT).switchPoints
    .find((s) => s.key === 'sensitivity');
  assert.strictEqual(base.currentWeight, MasarEngine.OBJECTIVE_WEIGHTS.sensitivity);

  const overridden = MasarEngine.optimize({
    ...HOSPITAL_INPUT, weights: { sensitivity: 2.4 },
  }).switchPoints.find((s) => s.key === 'sensitivity');
  assert.strictEqual(overridden.currentWeight, 2.4,
    'تجاوز الوزن لم ينعكس في currentWeight — الحقل لا يطابق مُدخله');
});

// ---- الإثبات: نقطة الانقلاب مُعاد اشتقاقها عبر المحرك، لا مُخمَّنة --------

test('طلبٌ بجوار مستشفى: نقطة انقلاب sensitivity تُعيد إنتاج نفسها عبر optimize() مباشرة', () => {
  const base = MasarEngine.optimize(HOSPITAL_INPUT);
  const sp = base.switchPoints.find((s) => s.key === 'sensitivity');
  assert.strictEqual(sp.neverFlips, false, 'هذا المُدخل يجب أن ينقلب — عدّل الثابت أعلاه إن تغيّر سلوك المحرك');
  assert.strictEqual(base.rankedLabels[0], sp.current, 'current لا يطابق الفائز الفعلي');

  const below = MasarEngine.optimize({
    ...HOSPITAL_INPUT, weights: { sensitivity: sp.weight - 1e-3 },
  });
  assert.strictEqual(below.rankedLabels[0], sp.current,
    'الفائز تغيّر قبل نقطة الانقلاب المُعلَنة — الحساب مبكر');

  const above = MasarEngine.optimize({
    ...HOSPITAL_INPUT, weights: { sensitivity: sp.weight + 1e-3 },
  });
  assert.strictEqual(above.rankedLabels[0], sp.next,
    'الفائز لم ينقلب إلى next بعد نقطة الانقلاب — الحساب خطأ');
});

test('نفس الإثبات على وزن nightPremium', () => {
  const base = MasarEngine.optimize(HOSPITAL_INPUT);
  const sp = base.switchPoints.find((s) => s.key === 'nightPremium');
  assert.strictEqual(sp.neverFlips, false);

  const below = MasarEngine.optimize({
    ...HOSPITAL_INPUT, weights: { nightPremium: sp.weight - 1e-3 },
  });
  assert.strictEqual(below.rankedLabels[0], sp.current);

  const above = MasarEngine.optimize({
    ...HOSPITAL_INPUT, weights: { nightPremium: sp.weight + 1e-3 },
  });
  assert.strictEqual(above.rankedLabels[0], sp.next);
});

// ---- الحساب: النسبة والمضاعِف يُشتقّان جبرياً، لا رقمان منفصلان -----------

test('deltaPct محسوب جبرياً من weight وcurrentWeight — يُعاد اشتقاق كلٍّ من الآخر', () => {
  const result = MasarEngine.optimize(HOSPITAL_INPUT);
  const flipping = result.switchPoints.filter((s) => !s.neverFlips);
  assert.ok(flipping.length > 0, 'لا مدخل ينقلب في هذا الطلب — الحالة المفحوصة هنا فارغة');
  flipping.forEach((sp) => {
    const expectedPct = ((sp.weight - sp.currentWeight) / sp.currentWeight) * 100;
    assert.ok(Math.abs(sp.deltaPct - expectedPct) < 1e-9,
      `${sp.key}: deltaPct لا يطابق (weight-currentWeight)/currentWeight`);
    const reconstructedWeight = sp.currentWeight * (1 + sp.deltaPct / 100);
    assert.ok(Math.abs(reconstructedWeight - sp.weight) < 1e-6,
      `${sp.key}: weight لا يُعاد اشتقاقه من currentWeight وdeltaPct`);
  });
});

// ---- الفائز الذي لا ينقلب يُصرَّح به، لا رقمٌ زائف يُخترَع ------------------

test('حساسية normal بلا نطاقات: لا وزن يقلب الفائز — والحقل يصرّح بدل أن يخترع رقماً', () => {
  /* SENSITIVITY_BANDS.normal فارغة، فكل المرشحين يتساوون في sensitivityHours
     (صفر) — لا فرق يستطيع أي وزن أن يكبّره باتجاه الانقلاب. حالة معروفة
     الجواب سلفاً: switchPoint يجب أن يُصرّح بالعجز، لا أن يُخمِّن رقماً. */
  const result = MasarEngine.optimize({ ...HOSPITAL_INPUT, sensitivity: 'normal' });
  const sp = result.switchPoints.find((s) => s.key === 'sensitivity');
  assert.strictEqual(sp.neverFlips, true);
  assert.strictEqual(sp.weight, null, 'رقم زائف بدل التصريح الصريح بالعجز');
  assert.strictEqual(sp.next, null);
  assert.strictEqual(sp.deltaPct, null);
  assert.ok(/لا ينقلب/.test(sp.note), 'الملاحظة لا تصرّح بالعجز نصاً');

  /* تأكيد تجريبي لا جبري فقط: رفع الوزن حتى مليون مرة يجب ألا يغيّر الفائز —
     وإلا كذب الحقل الجبري على ما يفعله المحرك فعلاً. */
  const huge = MasarEngine.optimize({
    ...HOSPITAL_INPUT, sensitivity: 'normal', weights: { sensitivity: 1e6 },
  });
  assert.strictEqual(huge.rankedLabels[0], result.rankedLabels[0],
    'الفائز انقلب تجريبياً رغم أن الحقل صرّح بأنه لن ينقلب');
});

// ---- قيد صلب: الإضافة معلوماتية بحتة، لا تمسّ الترتيب أو الفائزين --------

test('قراءة switchPoints لا تغيّر top3 ولا candidateCount ولا rankedLabels', () => {
  const a = MasarEngine.optimize(HOSPITAL_INPUT);
  const b = MasarEngine.optimize(HOSPITAL_INPUT);
  assert.deepStrictEqual(a.rankedLabels, b.rankedLabels);
  assert.strictEqual(a.candidateCount, b.candidateCount);
  assert.deepStrictEqual(a.top3.map((c) => c.label), b.top3.map((c) => c.label));
});

console.log(`ALL TESTS PASSED (${count})`);
