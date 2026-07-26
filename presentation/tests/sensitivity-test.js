'use strict';
/**
 * WP-E1 — بوابة تحليل الحساسية.
 *
 * الخطر الذي تحرسه ليس خطأً حسابياً، بل **جدولاً يبدو تحليلاً وليس به**:
 * أرقام مكتوبة يدوياً، أو حسابٌ موازٍ لا يمرّ بالمحرك، أو مقياسٌ واحد يخفي
 * افتراضاً يقلب التوصية بلا أن يمسّ ساعات-المركبة.
 *
 * ولذلك أغلب الفحوص هنا **دلالية**: تسأل هل يقول الجدول الشيء الصحيح عن
 * افتراضٍ نعرف سلفاً كيف يجب أن يتصرّف، لا هل الرقم فيه عدد.
 *
 * التشغيل: node presentation/tests/sensitivity-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;
const Engine = require(path.join(ROOT, 'athar-engine.js'));
const Sensitivity = require(path.join(ROOT, 'athar-sensitivity.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const INPUT = {
  aadt: 45000,
  lanes: 3,
  lanesClosed: 1,
  startHour: 8,
  durationHours: 120,
  capacityPerLane: 1800,
  freeFlowMin: 6,
  sensitivity: 'hospital',
};

/* الوصول بالمفتاح يمرّ بحارس.
   إسقاط افتراض من الجرد كان يُسقط الحزمة بـ«Cannot read properties of
   undefined» — رسالةٌ صحيحة النتيجة عديمة الدلالة. بوابةٌ لا تقول ما انكسر
   تُقرأ عطلاً في الاختبار لا عيباً في المُختبَر. */
const rowsOf = (result) => {
  const byKey = {};
  result.rows.forEach((row) => { byKey[row.key] = row; });
  return new Proxy(byKey, {
    get(target, key) {
      if (typeof key === 'string' && !(key in target)) {
        throw new assert.AssertionError({
          message: `الافتراض «${key}» خارج جرد الحساسية — أُسقط أو أُعيدت تسميته`,
          actual: Object.keys(target).join(' '),
          expected: key,
        });
      }
      return target[key];
    },
  });
};

// ---- التحليل يمرّ بالمحرك ------------------------------------------------

test('الأساس هو ناتج المحرك نفسه — لا حساب موازٍ', () => {
  const result = Sensitivity.tornado(INPUT);
  const plan = Engine.optimize(INPUT);
  assert.strictEqual(result.base.impactVehHours, plan.baseline.delayVehHours,
    'أثر الأساس لا يطابق ناتج optimize — التحليل يحسب لنفسه');
  assert.strictEqual(result.base.recommendedEquivalent,
    plan.top3[0].totalEquivalentVehHours);
  assert.strictEqual(result.base.level, Engine.score(INPUT).level);
});

test('كل صفّ يعيد إنتاج نفسه عند تمرير حدّه إلى المحرك مباشرة', () => {
  /* الفحص الحاكم على «لا رقم مخزَّن»: تُؤخذ قيمة الحدّ من الصفّ، وتُمرَّر
     إلى المحرك عبر مسار التطبيق المعلن، ويُشترط تطابق الناتج. جدولٌ فيه رقم
     مكتوب يدوياً يسقط هنا. */
  const result = Sensitivity.tornado(INPUT);
  const applyByKey = {};
  Sensitivity.ASSUMPTIONS.forEach((a) => { applyByKey[a.key] = a.apply; });

  result.rows.forEach((row) => {
    const lowInput = applyByKey[row.key](INPUT, row.lowValue);
    const highInput = applyByKey[row.key](INPUT, row.highValue);
    assert.strictEqual(Engine.optimize(lowInput).baseline.delayVehHours,
      row.lowImpactVehHours, `${row.key}: الحدّ الأدنى لا يُعاد إنتاجه`);
    assert.strictEqual(Engine.optimize(highInput).baseline.delayVehHours,
      row.highImpactVehHours, `${row.key}: الحدّ الأعلى لا يُعاد إنتاجه`);
  });
});

test('لا رقم من ثلاث خانات مكتوب في الوحدة', () => {
  /* نفس الحارس المستعمل في athar-canonical.js: جدولٌ يُفترض أن يحسب كل شيء
     لا يحتاج ثابتاً كبيراً.
     استثناءان معلنان لا أكثر:
       · 1600 و2000 — حدّا سعة الحارة، نطاق HCM معلَّل في `why`.
       · 100 — تحويل كسر إلى نسبة مئوية، لا مُدخل.
     أي رقم آخر من ثلاث خانات يعني قيمة دخلت الجدول بلا حساب. */
  const source = fs.readFileSync(path.join(ROOT, 'athar-sensitivity.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/[^\n]*/gm, ' ');
  const ALLOWED = ['1600', '2000', '100'];
  const planted = (source.match(/\b\d{3,}\b/g) || [])
    .filter((token) => ALLOWED.indexOf(token) === -1);
  assert.deepStrictEqual(planted, [],
    `أرقام مزروعة في وحدة الحساسية: ${planted.join(' ')}`);
});

// ---- دلالة كل افتراض ----------------------------------------------------

test('أرضية السعة بلا أثر ما لم تُغلق كل الحارات — ولها أثر حين تُغلق', () => {
  /* افتراضٌ نعرف سلفاً متى يعمل. لو أظهر الجدول له أثراً هنا لكان يحسب شيئاً
     آخر؛ ولو أظهر صفراً في الحالة الثانية لكان الجدول زينة. */
  const partial = rowsOf(Sensitivity.tornado(INPUT)).minCapacityFraction;
  assert.strictEqual(partial.swingVehHours, 0,
    'أرضية السعة تؤثر مع إغلاق حارة من ثلاث');

  const full = rowsOf(Sensitivity.tornado({ ...INPUT, lanesClosed: 3 })).minCapacityFraction;
  assert.ok(full.swingVehHours > 0,
    'أرضية السعة بلا أثر حتى مع إغلاق كل الحارات — الجدول لا يحسب');
});

test('ثابت المعايرة لا يمسّ ساعات-المركبة إطلاقاً', () => {
  const row = rowsOf(Sensitivity.tornado(INPUT)).scoreCalibration;
  assert.strictEqual(row.swingVehHours, 0,
    'ثابت المعايرة حرّك ساعات-المركبة — تسرّب إلى كمية فيزيائية');
  assert.strictEqual(row.swingEquivalentVehHours, 0);
});

test('ثابت المعايرة يغيّر التصنيف حين تكون الحالة قرب الحدّ', () => {
  /* الحالة تُختار بالبحث لا بالتخمين: أول مُدخل تقع درجته قرب حدّ التصنيف.
     تثبيت مُدخلٍ بعينه يجعل الفحص يسقط كلما تغيّرت المعايرة. */
  let found = null;
  for (let aadt = 20000; aadt <= 90000 && !found; aadt += 1000) {
    const row = rowsOf(Sensitivity.tornado({ ...INPUT, aadt })).scoreCalibration;
    if (row.changesLevel) found = { aadt, row };
  }
  assert.ok(found, 'لا حالة يغيّر فيها ثابت المعايرة التصنيف — الحدّ لا يُفحص');
  assert.strictEqual(found.row.swingVehHours, 0);
});

test('الوزن المعلن يقلب التوصية بلا أن يمسّ الأثر — والمقياسان يظهران ذلك', () => {
  const row = rowsOf(Sensitivity.tornado(INPUT)).weightSensitivity;
  assert.strictEqual(row.swingVehHours, 0, 'وزن تفضيلي سرّب أثراً فيزيائياً');
  assert.ok(row.swingEquivalentVehHours > 0,
    'الوزن بلا أثر على المجموع المكافئ — لا يُرجَّح به شيء');
  assert.ok(row.changesRecommendation, 'وزن الجوار من صفر إلى الضِعف لا يغيّر قراراً');
  assert.strictEqual(row.kind, 'وزن معلن');
});

test('السعة المتبقية بلا أثر على الأثر المعلن ولها أثر على القرار', () => {
  /* الحالة التي يخفيها المقياس الواحد: صفرٌ في عمود واحد وانقلابٌ في القرار. */
  const row = rowsOf(Sensitivity.tornado(INPUT)).residualCapacityFraction;
  assert.strictEqual(row.swingVehHours, 0);
  assert.ok(row.swingEquivalentVehHours > 0,
    'السعة المتبقية بلا أثر على المجموع — الحدّ معطَّل');
});

test('مضاعِف الاحتكاك أعلى وقعاً من ثابتٍ لا يمسّ الأثر', () => {
  const rows = rowsOf(Sensitivity.tornado(INPUT));
  assert.ok(rows.workZoneFriction.swingVehHours > rows.scoreCalibration.swingVehHours,
    'ترتيب الوقع مقلوب');
});

// ---- إعادة التشكيل -------------------------------------------------------

test('إعادة تشكيل الملف تحفظ المجموع والترتيب', () => {
  [0.5, 0.75, 1, 1.35, 2].forEach((k) => {
    const shaped = Sensitivity.reshapeProfile(Engine.HOURLY_PROFILE, k);
    assert.strictEqual(shaped.length, 24);
    const sum = shaped.reduce((total, v) => total + v, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `k=${k}: المجموع ${sum}`);

    /* الترتيب محفوظ: أسّ موجب دالة رتيبة. لو انكسر لصار التحليل يقيس إعادة
       ترتيب اليوم لا حدّة الذروة. */
    const order = (list) => list
      .map((v, i) => ({ v, i }))
      .sort((a, b) => a.v - b.v || a.i - b.i)
      .map((item) => item.i);
    assert.deepStrictEqual(order(shaped), order(Engine.HOURLY_PROFILE),
      `k=${k}: ترتيب الساعات تغيّر`);
  });
  assert.deepStrictEqual(
    Sensitivity.reshapeProfile(Engine.HOURLY_PROFILE, 1).map((v) => v.toFixed(6)),
    Engine.HOURLY_PROFILE.map((v) => v.toFixed(6)),
    'k=1 ليست الهوية');
});

test('حدّة أعلى ترفع الذروة وتخفض القاع', () => {
  const sharper = Sensitivity.reshapeProfile(Engine.HOURLY_PROFILE, 1.35);
  const flatter = Sensitivity.reshapeProfile(Engine.HOURLY_PROFILE, 0.75);
  const peak = Engine.HOURLY_PROFILE.indexOf(Math.max(...Engine.HOURLY_PROFILE));
  const trough = Engine.HOURLY_PROFILE.indexOf(Math.min(...Engine.HOURLY_PROFILE));
  assert.ok(sharper[peak] > Engine.HOURLY_PROFILE[peak], 'الحدّة لا ترفع الذروة');
  assert.ok(sharper[trough] < Engine.HOURLY_PROFILE[trough], 'الحدّة لا تخفض القاع');
  assert.ok(flatter[peak] < Engine.HOURLY_PROFILE[peak], 'الفلطحة لا تخفض الذروة');
});

// ---- تجاوز المعايرة مفحوص ------------------------------------------------

test('المحرك يرفض ملف طلب لا يجمع إلى واحد', () => {
  const bad = Engine.HOURLY_PROFILE.map((v) => v * 2);
  assert.throws(() => Engine.score({ ...INPUT, calibration: { hourlyProfile: bad } }),
    /المجموع/, 'ملف طلب مضاعَف مرّ — كل رقم بعده يتضاعف بصمت');
  assert.throws(() => Engine.score({
    ...INPUT, calibration: { hourlyProfile: [1] },
  }), /أربع وعشرون/);
  assert.throws(() => Engine.score({
    ...INPUT, calibration: { workZoneFriction: 0 },
  }), /workZoneFriction/);
  assert.throws(() => Engine.score({
    ...INPUT, calibration: { minCapacityFraction: -1 },
  }), /minCapacityFraction/);
});

test('غياب التجاوز يعطي النتيجة نفسها بالضبط', () => {
  assert.strictEqual(
    Engine.score(INPUT).delayVehHours,
    Engine.score({ ...INPUT, calibration: {} }).delayVehHours,
    'تجاوز فارغ غيّر النتيجة');
});

// ---- شكل الجدول ----------------------------------------------------------

test('الصفوف مرتّبة تنازلياً بالوقع', () => {
  const result = Sensitivity.tornado(INPUT);
  for (let i = 1; i < result.rows.length; i += 1) {
    assert.ok(result.rows[i - 1].swingVehHours >= result.rows[i].swingVehHours,
      `الترتيب مكسور عند ${i}`);
  }
  assert.strictEqual(result.dominant.key, result.rows[0].key);
});

test('كل افتراض يحمل تعليل نطاقه ونوعه', () => {
  const kinds = ['محسوب', 'وزن معلن', 'مُدخل غير مقيس'];
  Sensitivity.ASSUMPTIONS.forEach((a) => {
    assert.ok(a.why && a.why.length > 30, `${a.key}: تعليل النطاق قصير أو غائب`);
    assert.ok(kinds.indexOf(a.kind) !== -1, `${a.key}: نوع غير معروف ${a.kind}`);
    assert.ok(a.unit, `${a.key}: بلا وحدة`);
  });
  /* النوع الثالث موجود فعلاً: جردٌ يفحص ثوابت المحرك وحدها يمدح نفسه. */
  const unmeasured = Sensitivity.ASSUMPTIONS
    .filter((a) => a.kind === 'مُدخل غير مقيس');
  assert.ok(unmeasured.length >= 2,
    'الجرد لا يفحص المدخلات غير المقيسة — يفحص المحرك ويعفي البيانات');
});

test('الجرد يغطي كل ثابت معايرة مصدَّر من المحرك', () => {
  /* حارس ضد الجرد الانتقائي: ثابتٌ يُضاف إلى `CALIBRATION` ولا يدخل التحليل
     يبقى غير مفحوص بلا أن يلاحظ أحد. */
  const keys = Sensitivity.ASSUMPTIONS.map((a) => a.key);
  ['SCORE_CALIBRATION', 'WORK_ZONE_FRICTION', 'MIN_CAPACITY_FRACTION']
    .forEach((constant) => {
      const camel = constant.toLowerCase().replace(/_(.)/g, (m, c) => c.toUpperCase());
      assert.ok(keys.indexOf(camel) !== -1, `${constant} خارج جرد الحساسية`);
    });
  assert.ok(keys.indexOf('residualCapacityFraction') !== -1);
  assert.ok(keys.indexOf('weightSensitivity') !== -1);
  assert.ok(keys.indexOf('weightNightPremium') !== -1);
});

test('الملاحظات تُشتقّ من الأرقام لا تُكتب سلفاً', () => {
  const withFlip = Sensitivity.tornado(INPUT);
  assert.ok(withFlip.notes.some((note) => /يقلب التوصية/.test(note)),
    'حالة فيها انقلاب بلا ملاحظة');

  /* حالة بلا حساسية جوار وبإغلاق قصير: الملاحظة يجب أن تختلف. */
  const quiet = Sensitivity.tornado({
    ...INPUT, sensitivity: 'normal', durationHours: 6, aadt: 12000,
  });
  assert.notDeepStrictEqual(quiet.notes, withFlip.notes,
    'الملاحظات نفسها لحالتين مختلفتين — نصّ ثابت لا اشتقاق');
});

console.log(`ALL TESTS PASSED (${count})`);
