'use strict';
/**
 * بوابة أدوات الاستدامة — ميزانية الممر وحلقة المعايرة.
 * ---------------------------------------------------------------------------
 * «الأثر» في هذا المنتج رقمٌ لحظي، و«الاستدامة» أداتان تجعلانه متكرّراً:
 *
 *   · `masar-impact-budget.js` — سقف شهري لساعات-المركبة على الممر، يستهلكه
 *     كل تصريح جديد. هو الآلية الوحيدة التي تجعل الممر «ممتلئاً» فيفرض إعادة
 *     جدولة بدل أن يبقى الأثر عدّاداً يزيد بلا سقف.
 *   · `masar-impact-calibration.js` — سجل مقارنات المتوقَّع بالمرصود، ومنه
 *     معامل التصحيح. هو ما يجعل ادّعاء «يتحسّن مع كل تصريح» آليةً لا وعداً.
 *
 * وكلتاهما كانت بلا حزمة. والفراغ لم يكن نظرياً: سجل المعايرة كان يقبل رصدةً
 * بلا مرصود أو بمرصودٍ سالب، فيصير المعامل `NaN` أو عدداً سالباً **ويصل
 * الشاشة** — تبويب القياس يطبع «معامل التصحيح: -0.50×»، والنموذج التفاعلي
 * يضرب ساعات-المركبة فيه فيعرض أثراً سالباً.
 *
 * ولذلك أغلب ما هنا فحوصُ **حدود ومدخلات فاسدة** لا فحوص حساب: الحساب في
 * الوحدتين سطران، والخطر كله في ما يدخلهما وما يخرج إلى الشاشة.
 *
 * التشغيل: node presentation/tests/impact-budget-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;

const Budget = require(path.join(ROOT, 'masar-impact-budget.js'));
const Calibration = require(path.join(ROOT, 'masar-impact-calibration.js'));
const Measurement = require(path.join(ROOT, 'masar-desk-measurement.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

function memoryStore(seed) {
  const cell = {};
  if (seed !== undefined) cell[Calibration.STORAGE_KEY] = JSON.stringify(seed);
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(cell, key) ? cell[key] : null),
    setItem: (key, value) => { cell[key] = String(value); },
  };
}

// ---- ميزانية الممر -------------------------------------------------------

test('الاستهلاك يتراكم — التصريح الجديد يُضاف إلى ما سبقه لا يحلّ محلّه', () => {
  /* لو استُبدل بدل أن يُضاف لصار كل تصريح يُقيَّم وحده، وسقط معنى «الممر
     يمتلئ» كله — وهو الفرق بين ميزانية وحاسبة. */
  const verdict = Budget.corridorBudget({
    monthlyBudgetVehHours: 40000,
    consumedVehHours: 12000,
    currentPermitVehHours: 5000,
  });
  assert.strictEqual(verdict.consumedBefore, 12000);
  assert.strictEqual(verdict.consumedAfter, 17000);
  assert.strictEqual(verdict.remaining, 23000);
  assert.strictEqual(Number(verdict.pctUsed.toFixed(2)), 42.5);
});

test('العتبتان محكومتان بالمعلَن — لا رقم مدفون في شرط', () => {
  const at = (pct) => Budget.corridorBudget({
    monthlyBudgetVehHours: 1000,
    consumedVehHours: 0,
    currentPermitVehHours: pct * 10,
  }).verdict;

  assert.strictEqual(at(Budget.NEAR_CAP_PCT - 0.1), 'ضمن الميزانية');
  assert.strictEqual(at(Budget.NEAR_CAP_PCT), 'قرب السقف');
  assert.strictEqual(at(Budget.OVER_CAP_PCT - 0.1), 'قرب السقف');
  assert.strictEqual(at(Budget.OVER_CAP_PCT), 'تجاوز — يتطلب إعادة جدولة');
  assert.ok(Budget.NEAR_CAP_PCT < Budget.OVER_CAP_PCT);
});

test('المتبقي لا ينزل تحت الصفر — «متبقٍّ سالب» يُقرأ رصيداً', () => {
  const verdict = Budget.corridorBudget({
    monthlyBudgetVehHours: 1000,
    consumedVehHours: 900,
    currentPermitVehHours: 600,
  });
  assert.strictEqual(verdict.remaining, 0);
  assert.strictEqual(verdict.consumedAfter, 1500);
  assert.strictEqual(verdict.verdict, 'تجاوز — يتطلب إعادة جدولة');
});

test('السقف الفاسد يفشل نحو التجاوز لا نحو الاطمئنان', () => {
  /* هذا الفحص عن **اتجاه الفشل** لا عن قيمة. سقفٌ صفر أو غير عددي يعطي نسبةً
     لا تُقارن، وأي حكم متساهل عندها يعرض «ضمن الميزانية» على ممر لا نعرف عنه
     شيئاً — وهو أسوأ من الامتناع. */
  [0, -5, NaN, undefined].forEach((budget) => {
    const verdict = Budget.corridorBudget({
      monthlyBudgetVehHours: budget,
      consumedVehHours: 0,
      currentPermitVehHours: 10,
    }).verdict;
    assert.strictEqual(verdict, 'تجاوز — يتطلب إعادة جدولة',
      `سقف فاسد (${String(budget)}) لم يفشل نحو التجاوز`);
  });
});

test('عيبٌ مثبَّت: الاستهلاك الفاسد يُقرأ صفراً فيُطمئن الممر كذباً', () => {
  /* **فحص توصيفي لعيبٍ قائم، لا إقرارٌ به.**
     `masar-impact-budget.js:28-29` يكتب `input.consumedVehHours || 0`، و`NaN`
     قيمة زائفة، فتصير صفراً. النتيجة أن ممراً استُهلك تسعون بالمئة من سقفه
     وجاءت قيمة استهلاكه فاسدة يُقرأ **«ضمن الميزانية»** — وهو أسوأ اتجاه فشل
     ممكن في أداة سقف: تعطّلُ القياس يُقرأ سعةً متاحة.
     والإصلاح سطرٌ واحد: حارسٌ `Number.isFinite` بدل `||`، ثم فشلٌ نحو التجاوز
     كما في الفحص أعلاه. والملف خارج ملكية هذا الدور، فيُثبَّت السلوك القائم
     هنا كي **يسقط هذا الفحص يوم يُصلَح** فيُقلَب التأكيد قصداً لا سهواً. */
  const blind = Budget.corridorBudget({
    monthlyBudgetVehHours: 1000,
    consumedVehHours: NaN,
    currentPermitVehHours: 10,
  });
  assert.strictEqual(blind.consumedBefore, 0,
    'تغيّر السلوك — راجع masar-impact-budget.js واقلب هذا الفحص إلى الحارس الصحيح');
  assert.strictEqual(blind.verdict, 'ضمن الميزانية',
    'العيب أُصلح — احذف هذا الفحص وأضف السقف الفاسد إلى فحص اتجاه الفشل');
});

test('لا سقف افتراضي داخل الوحدة — السقف قرار جهة لا ثابت شيفرة', () => {
  /* سقفُ ممرٍّ مكتوبٌ في الوحدة يصير رقماً بلا مصدر يُنسخ إلى كل سطح.
     الوحدة تحسب فقط، والسقف يأتي من المستدعي حيث يمكن وسمه بمصدره. */
  const source = fs.readFileSync(path.join(ROOT, 'masar-impact-budget.js'), 'utf8');
  const exported = Object.keys(Budget);
  exported.forEach((key) => {
    if (typeof Budget[key] !== 'number') return;
    assert.ok(Budget[key] <= 100,
      `«${key}» = ${Budget[key]} — رقم كبير مُصدَّر من وحدة الميزانية يُقرأ سقفاً`);
  });
  assert.ok(!/monthlyBudgetVehHours\s*[:=]\s*\d/.test(source),
    'سقف شهري مكتوب داخل الوحدة');
});

// ---- حلقة المعايرة -------------------------------------------------------

test('السجل الفارغ يعطي معاملاً محايداً لا صفراً ولا NaN', () => {
  const log = Calibration.createCalibration(memoryStore());
  assert.strictEqual(log.correctionFactor(), 1);
  assert.strictEqual(log.status().n, 0);
});

test('الرصدة بلا مرصود تُرفض — لا تُقبل ناقصةً لتُكمَّل لاحقاً', () => {
  /* `undefined / 1200` يعطي `NaN`، والوسيط يعيده كما هو، فيضرب المنتجُ
     ساعات-المركبة في `NaN`. الرفض عند الكتابة لأن السجل يُقرأ من أكثر من
     سطح، وحارسُ سطحٍ واحد لا يحمي البقية. */
  const log = Calibration.createCalibration(memoryStore());
  assert.strictEqual(log.record({ permitId: 'X', predictedVehHours: 1200 }), false);
  assert.strictEqual(log.status().n, 0);
  assert.strictEqual(log.correctionFactor(), 1);
});

test('المرصود السالب أو الصفري أو غير المنتهي يُرفض', () => {
  const log = Calibration.createCalibration(memoryStore());
  [-50, 0, NaN, Infinity, '900', null].forEach((observed) => {
    assert.strictEqual(
      log.record({ permitId: 'B', predictedVehHours: 100, observedVehHours: observed }),
      false, `قُبل مرصود غير صالح: ${String(observed)}`);
  });
  assert.strictEqual(log.status().n, 0);
});

test('التوقّع غير الصالح يُرفض كما كان — الحارس لم يُستبدل بل اتّسع', () => {
  const log = Calibration.createCalibration(memoryStore());
  assert.strictEqual(
    log.record({ permitId: 'A', predictedVehHours: 0, observedVehHours: 100 }), false);
  assert.strictEqual(
    log.record({ permitId: 'A', predictedVehHours: -3, observedVehHours: 100 }), false);
  assert.strictEqual(
    log.record({ permitId: 'A', predictedVehHours: 100, observedVehHours: 110 }), true);
  assert.strictEqual(log.status().n, 1);
});

test('السجل الموروث الفاسد يُصفّى عند القراءة لا عند الكتابة وحدها', () => {
  /* `localStorage` يعيش عبر النسخ. صفٌّ فاسد كُتب بنسخة سابقة بلا حارس
     يبقى إلى الأبد، وحارسُ الكتابة وحده لا ينظّفه. */
  const log = Calibration.createCalibration(memoryStore([
    { permitId: 'L1', predictedVehHours: 100, observedVehHours: 110 },
    { permitId: 'L2', predictedVehHours: 100 },
    { permitId: 'L3', predictedVehHours: 100, observedVehHours: -5 },
  ]));
  assert.strictEqual(log.records().length, 3, 'الصفوف لا تُحذف — تُستبعد من الحساب');
  assert.strictEqual(log.status().n, 1, '«n» يعدّ النسب الصالحة لا الصفوف');
  assert.strictEqual(Number(log.correctionFactor().toFixed(4)), 1.1);
});

test('المعامل وسيطٌ لا متوسط — الشاذّة الواحدة لا تقوده', () => {
  const log = Calibration.createCalibration(memoryStore());
  [[100, 110], [100, 105], [100, 5000]].forEach(([predicted, observed], index) => {
    log.record({ permitId: 'p' + index, predictedVehHours: predicted, observedVehHours: observed });
  });
  assert.strictEqual(log.correctionFactor(), 1.1);
});

test('الثبات: السجل يُقرأ من المخزن لا من الذاكرة', () => {
  const store = memoryStore();
  const first = Calibration.createCalibration(store);
  first.record({ permitId: 'P1', predictedVehHours: 200, observedVehHours: 240 });
  const second = Calibration.createCalibration(store);
  assert.strictEqual(second.status().n, 1);
  assert.strictEqual(second.correctionFactor(), 1.2);
});

// ---- الوصل: ما يصل الشاشة فعلاً -------------------------------------------

test('سجلٌّ فاسد لا يطبع NaN ولا معاملاً سالباً في تبويب القياس', () => {
  /* هذا هو الفحص الحاكم. الوحدتان السابقتان تختبران الحساب؛ وهذا يستدعي
     دالة التصيير الحقيقية في `masar-desk-measurement.js` — وهي ما يراه
     المراجع — ويفتّش عن الأثر في نصّها. */
  const poisoned = Calibration.createCalibration(memoryStore([
    { permitId: 'L1', predictedVehHours: 100 },
    { permitId: 'L2', predictedVehHours: 100, observedVehHours: -50 },
  ]));
  const html = Measurement.render(
    { status: 'Completed' }, 5000, { observedVehHours: 4000 }, poisoned.status());

  assert.ok(!/NaN/.test(html), 'تبويب القياس طبع NaN');
  assert.ok(!/-\d+(\.\d+)?×/.test(html), 'تبويب القياس طبع معاملاً سالباً');
  assert.ok(/لا معامل تصحيح بعد/.test(html),
    'سجلٌّ بلا نسبة صالحة عرض معاملاً — والصحيح أن يقول إنه بلا معامل');
});

test('المعامل الصالح يصل الشاشة بقيمته — الحارس لا يبتلع الصحيح', () => {
  /* حارسٌ يمنع الفاسد ويمنع الصالح معه يُخفي العطل ولا يصلحه. */
  const healthy = Calibration.createCalibration(memoryStore());
  [[1000, 1200], [800, 960], [500, 600]].forEach(([predicted, observed], index) => {
    healthy.record({ permitId: 'H' + index, predictedVehHours: predicted, observedVehHours: observed });
  });
  const html = Measurement.render(
    { status: 'Completed' }, 5000, { observedVehHours: 6000 }, healthy.status());

  assert.ok(/1\.20×/.test(html), 'المعامل الصالح لم يصل الشاشة');
  assert.ok(/من <strong>3<\/strong> رصدة/.test(html), 'عدد الرصدات لم يصل الشاشة');
});

console.log(`ALL TESTS PASSED (${count})`);
