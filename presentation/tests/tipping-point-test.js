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

/* العقد اتّسع عن قصد: نقطة الانقلاب صارت **مدىً** لا نقطة. الوزن تفضيلٌ بلا
   مصدر، فخطؤه ممكن رفعاً وخفضاً، وحدٌّ واحد يُقرأ متانةً وهو نصف الحقيقة. */
const EXPECTED_KEYS = ['key', 'currentWeight', 'current', 'weight', 'next',
  'deltaPct', 'weightDown', 'nextDown', 'deltaPctDown', 'neverFlips',
  'note'].sort();

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
  const flipping = result.switchPoints.filter((s) => s.weight !== null);
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

// ---- الاتجاه الآخر: خفضُ الوزن يقلب الفائز أيضاً، ويجب أن يُقال ----------

/* مأخوذ من `p060` في محفظة المدينة — أُثبت عليه أن الحدّ السفلي موجود فعلاً.
   وهو مكتوب هنا مستقلاً كي تبقى هذه الحزمة بلا تبعية بيانات. */
const LOWER_BOUND_INPUT = {
  aadt: 28000,
  lanes: 2,
  lanesClosed: 1,
  startHour: 10,
  durationHours: 128,
  freeFlowMin: 6,
  sensitivity: 'hospital',
  roadClass: 'arterial',
};

test('الحدّ السفلي مُعاد اشتقاقه عبر optimize() — خفضُ الوزن يقلب الفائز فعلاً', () => {
  const base = MasarEngine.optimize(LOWER_BOUND_INPUT);
  const sp = base.switchPoints.find((s) => s.key === 'sensitivity');
  assert.notStrictEqual(sp.weightDown, null,
    'هذا المُدخل يجب أن يحمل حدّاً سفلياً — عدّل الثابت أعلاه إن تغيّر سلوك المحرك');
  assert.strictEqual(base.rankedLabels[0], sp.current, 'current لا يطابق الفائز الفعلي');

  const above = MasarEngine.optimize({
    ...LOWER_BOUND_INPUT, weights: { sensitivity: sp.weightDown + 1e-3 },
  });
  assert.strictEqual(above.rankedLabels[0], sp.current,
    'الفائز تغيّر قبل بلوغ الحدّ السفلي المُعلَن — الحساب مبكر');

  const below = MasarEngine.optimize({
    ...LOWER_BOUND_INPUT, weights: { sensitivity: sp.weightDown - 1e-3 },
  });
  assert.strictEqual(below.rankedLabels[0], sp.nextDown,
    'الفائز لم ينقلب إلى nextDown تحت الحدّ السفلي — الحساب خطأ');
});

test('deltaPctDown محسوب جبرياً كنظيره الأعلى، وإشارته سالبة', () => {
  const result = MasarEngine.optimize(LOWER_BOUND_INPUT);
  const lowered = result.switchPoints.filter((s) => s.weightDown !== null);
  assert.ok(lowered.length > 0, 'لا حدّ سفلي في هذا الطلب — الحالة المفحوصة هنا فارغة');
  lowered.forEach((sp) => {
    assert.ok(sp.deltaPctDown < 0, `${sp.key}: خفضٌ بنسبة موجبة — الإشارة مقلوبة`);
    const expected = ((sp.weightDown - sp.currentWeight) / sp.currentWeight) * 100;
    assert.ok(Math.abs(sp.deltaPctDown - expected) < 1e-9,
      `${sp.key}: deltaPctDown لا يطابق (weightDown-currentWeight)/currentWeight`);
    assert.ok(sp.weightDown >= 0, `${sp.key}: حدٌّ سفلي سالب — وزنٌ لا معنى له`);
  });
});

test('`neverFlips` يعني الاتجاهين معاً — لا متانةً نصفية', () => {
  /* `normal` بلا نطاقات: كل المرشحين بصفر ساعة حسّاسة، فلا رفعٌ ولا خفضٌ
     يقلب. وهذه الحالة وحدها يصحّ فيها التصريح بالعجز. */
  const flat = MasarEngine.optimize({ ...HOSPITAL_INPUT, sensitivity: 'normal' })
    .switchPoints.find((s) => s.key === 'sensitivity');
  assert.strictEqual(flat.neverFlips, true);
  assert.strictEqual(flat.weightDown, null);
  assert.strictEqual(flat.weight, null);
  assert.ok(/أيّ اتجاه/.test(flat.note), 'الملاحظة لا تصرّح بأن العجز في الاتجاهين');

  /* والعكس: مُدخلٌ ينقلب خفضاً لا رفعاً يجب ألّا يُعلَن غير قابل للانقلاب.
     كان هذا بالضبط ما يحدث قبل الإصلاح. */
  const oneSided = MasarEngine.optimize(LOWER_BOUND_INPUT).switchPoints
    .filter((s) => s.weightDown !== null && s.weight === null);
  oneSided.forEach((sp) => {
    assert.strictEqual(sp.neverFlips, false,
      `${sp.key}: أُعلن غير قابل للانقلاب بينما خفضُه يقلب الفائز`);
  });
});

// ---- الامتناع بسبب الوزن: عتبةٌ مشتقّة لا مختارة -------------------------

/* مأخوذ من `p069` — أقرب نقطة انقلاب في المحفظة كلها. */
const FRAGILE_INPUT = {
  aadt: 10000,
  lanes: 1,
  lanesClosed: 1,
  startHour: 13,
  durationHours: 101,
  freeFlowMin: 6,
  sensitivity: 'hospital',
  roadClass: 'major',
};

test('توصيةٌ تنقلب بتحريكٍ ضئيل للوزن تُعلَن هشّة — والانقلاب مُعاد اشتقاقه', () => {
  const result = MasarEngine.optimize(FRAGILE_INPUT);
  assert.ok(result.weightFragility,
    'نقطة انقلاب دون التسامح ولم يُعلَن أي تحفّظ');
  const sp = result.switchPoints.find((s) => s.key === result.weightFragility.keys[0]);
  assert.ok(Math.abs(sp.deltaPct) <= result.weightFragility.tolerancePct
    || Math.abs(sp.deltaPctDown) <= result.weightFragility.tolerancePct);

  /* لا يُصدَّق الحقل: يُستدعى المحرك عند طرفَي النقطة المُعلَنة. */
  const flipped = MasarEngine.optimize({
    ...FRAGILE_INPUT, weights: { [sp.key]: sp.weight + 1e-3 },
  });
  assert.strictEqual(flipped.rankedLabels[0], sp.next,
    'الهشاشة مُعلَنة ولا انقلاب فعلي عندها — تحفّظٌ بلا سند');
  const held = MasarEngine.optimize({
    ...FRAGILE_INPUT, weights: { [sp.key]: sp.weight - 1e-3 },
  });
  assert.strictEqual(held.rankedLabels[0], sp.current);
});

test('التسامح مشتقٌّ وقت التشغيل من مظروف السعة المعلَن — لا رقم مكتوب', () => {
  const result = MasarEngine.optimize(FRAGILE_INPUT);
  /* يُعاد اشتقاق العتبة من مخرَج المحرك نفسه: أوسع تحريكٍ نسبيّ في مظروف
     نسبة السعة المتبقية حول قيمتها الافتراضية. رقمٌ يُكتب باليد يُسقط هذا. */
  const envelope = result.residualSensitivity
    .map((entry) => entry.residualCapacityFraction);
  assert.ok(envelope.length > 1, 'المظروف غير معروض — لا يمكن اشتقاق العتبة');
  const derived = envelope.reduce((widest, fraction) => Math.max(widest,
    Math.abs(fraction - MasarEngine.RESIDUAL_CAPACITY_FRACTION)
      / MasarEngine.RESIDUAL_CAPACITY_FRACTION), 0) * 100;
  assert.ok(Math.abs(result.weightFragility.tolerancePct - derived) < 1e-9,
    `التسامح ${result.weightFragility.tolerancePct} لا يطابق المشتقّ ${derived} — `
    + 'عتبةٌ مختارة تسلّلت مكان المشتقّة');
});

test('توصيةٌ متينة الوزن لا تُثقَل بتحفّظ لا يخصّها', () => {
  /* HOSPITAL_INPUT نقطتا انقلابه 42٪ و169٪ — بعيدتان عن التسامح. */
  assert.strictEqual(MasarEngine.optimize(HOSPITAL_INPUT).weightFragility, null,
    'تحفّظ هشاشة على توصية نقطة انقلابها بعيدة — التحفّظ يفقد معناه إن عمّ');
});

// ---- التسليم: التحفّظ يجب أن ينجو من قصّ «أكبر ثلاثة أسباب» --------------

test('التحفّظ يتصدّر reasons فينجو من slice(0,3) الذي يقصّه السطح', () => {
  const result = MasarEngine.optimize(FRAGILE_INPUT);
  const rendered = result.top3[0].reasons.slice(0, 3);
  assert.ok(rendered.some((reason) => /وزنٍ بلا مصدر/.test(reason)),
    'تحفّظ الهشاشة خارج الأسباب الثلاثة الأولى — يُقصّ قبل أن يصل الشاشة.\n'
    + `    الأسباب: ${JSON.stringify(result.top3[0].reasons, null, 2)}`);
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
