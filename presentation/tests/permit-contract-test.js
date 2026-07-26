'use strict';
/**
 * WP-I1 — بوابة عقد بيانات التصريح.
 *
 * **ما تثبته وما لا تثبته.**
 *
 * تثبت: أن العقد يصف حقولاً بوحداتها ومداها، وأن المحقِّق يرفض الناقص
 * والخارج عن المدى ويسمّي الحقل، وأن سجلاً مطابقاً يشغّل المحرك والتصدير
 * بلا معادلة موازية.
 *
 * **ولا تثبت تكاملاً.** لا اتصال بمنصة بلدي، ولا مطابقة أسماء مع الجهة، ولا
 * عقد موقَّع. وللبوابة فحصٌ يحرس هذا الحدّ: أي رفع لحالة «دورة التصريح
 * الرسمية» في جدول المقارنة بحجة وجود العقد يُسقطها.
 *
 * التشغيل: node presentation/tests/permit-contract-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;
const Engine = require(path.join(ROOT, 'athar-engine.js'));
const Contract = require(path.join(ROOT, 'athar-permit-contract.js'));
const Compare = require(path.join(ROOT, 'athar-compare-data.js'));

const SAMPLE = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data', 'permit-contract-sample.json'), 'utf8'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const caseOf = (label) => SAMPLE.records.find((item) => item.case.indexOf(label) === 0).record;
const FULL = caseOf('سجل كامل');

// ---- شكل العقد ----------------------------------------------------------

test('كل حقل يحمل وحدة ودرجة حاجة وسبباً ومتوقَّعاً', () => {
  const needs = ['blocking', 'degrading', 'optional'];
  Contract.FIELDS.forEach((field) => {
    assert.ok(field.unit, `${field.key}: بلا وحدة`);
    assert.ok(needs.indexOf(field.need) !== -1, `${field.key}: درجة حاجة غير معروفة`);
    assert.ok(field.why && field.why.length > 25,
      `${field.key}: بلا سبب يقول لماذا يحتاجه المحرك`);
    assert.ok(field.expects && field.expects.length > 5,
      `${field.key}: بلا وصف للمتوقَّع — الرفض بلا وصفٍ لغز`);
    assert.strictEqual(typeof field.check, 'function');
  });
});

test('كل حقل يعلن مصدر تسميته: من خدمة بلدي أو من عندنا', () => {
  /* ادعاءُ أن حقلاً «من بلدي» وهو من عندنا هو ادعاء مصدرٍ بلا دليل — نفس
     ما نمنعه في سجل المصادر وفي جدول المقارنة. */
  Contract.FIELDS.forEach((field) => {
    assert.ok(field.derivedFrom, `${field.key}: بلا مصدر تسمية`);
    if (field.derivedFrom !== 'ours') {
      assert.ok(/خدمة|الخريطة/.test(field.derivedFrom),
        `${field.key}: مصدر التسمية لا يسمّي خدمةً بعينها — ${field.derivedFrom}`);
    }
  });
  const ours = Contract.FIELDS.filter((field) => field.derivedFrom === 'ours');
  assert.ok(ours.length >= 2,
    'كل الحقول منسوبة إلى بلدي — نسبةٌ شاملة تُقرأ ادعاء مطابقة لم تحدث');
});

test('درجة «تخفض الثقة» مستعملة فعلاً — لا ثنائية إلزامي/اختياري', () => {
  /* ثنائيةُ إلزامي/اختياري تدفع إلى تعليم كل شيء إلزامياً خوفاً، فيُرفض ملف
     كامل لغياب حقلٍ له افتراض معلن. */
  const degrading = Contract.FIELDS.filter((field) => field.need === 'degrading');
  assert.ok(degrading.length >= 2, 'لا حقل في الدرجة الوسطى');
  degrading.forEach((field) => {
    assert.ok(field.fallback && field.fallback.length > 5,
      `${field.key}: يخفض الثقة بلا بديلٍ معلن — أي أنه مانع في الحقيقة`);
  });
});

// ---- المحقِّق يقول ماذا لا صحّة/خطأ --------------------------------------

test('السجل الكامل يمرّ بلا مانع ولا تحفّظ', () => {
  const result = Contract.validate(FULL);
  assert.strictEqual(result.ok, true,
    `مانع: ${result.blocking.map((item) => item.key).join(', ')}`);
  assert.deepStrictEqual(result.degrading, []);
  assert.deepStrictEqual(result.unknown, []);
});

test('الناقص المانع يُرفض ويُسمّى بالاسم', () => {
  const result = Contract.validate(caseOf('ينقصه ما يمنع'));
  assert.strictEqual(result.ok, false);
  const keys = result.blocking.map((item) => item.key).sort();
  assert.deepStrictEqual(keys, ['durationHours', 'geometry']);
  result.blocking.forEach((item) => {
    assert.ok(item.label, `${item.key}: الرفض بلا اسم مقروء`);
    assert.ok(item.reason, `${item.key}: الرفض بلا سبب`);
  });
});

test('الناقص المخفِّض لا يمنع التشغيل ويُعلن بديله', () => {
  const result = Contract.validate(caseOf('ينقصه ما يخفض'));
  assert.strictEqual(result.ok, true, 'حقلٌ له افتراض معلن أوقف التشغيل');
  const keys = result.degrading.map((item) => item.key).sort();
  assert.deepStrictEqual(keys, ['aadt', 'promoter', 'street', 'workExtentM']);
  result.degrading.forEach((item) => {
    assert.ok(item.fallback, `${item.key}: تحفّظ بلا بديل معلن`);
  });
});

test('الخارج عن المدى يُرفض — والعلاقة بين الحقلين مفحوصة', () => {
  const result = Contract.validate(caseOf('خارج المدى'));
  assert.strictEqual(result.ok, false);
  const lanes = result.blocking.find((item) => item.key === 'lanesClosed');
  assert.ok(lanes, 'إغلاق خمسة مسارات في طريق من مسارين مرّ');
  assert.ok(/لا يتجاوز عدد المسارات/.test(lanes.reason),
    `الرفض لا يشرح العلاقة: ${lanes.reason}`);
});

test('كل حقل مانع يُرفض غيابه — واحداً واحداً', () => {
  /* فحصٌ شامل لا عيّنة: حقلٌ يُعلَّم مانعاً ولا يمنع غيابُه تسميةٌ كاذبة. */
  Contract.FIELDS.filter((field) => field.need === 'blocking').forEach((field) => {
    const broken = { ...FULL };
    delete broken[field.key];
    const result = Contract.validate(broken);
    assert.strictEqual(result.ok, false, `غياب «${field.key}» لم يمنع`);
    assert.ok(result.blocking.some((item) => item.key === field.key),
      `غياب «${field.key}» مُنع لسبب آخر`);
  });
});

test('حقل مجهول يُبلَّغ ولا يُسقط السجل', () => {
  /* حقلٌ لا يعرفه العقد قد يكون بيانات مهمة لدى الجهة. إسقاطه صامتاً يخفي،
     وإسقاط السجل بسببه يمنع تشغيلاً ممكناً. */
  const result = Contract.validate({ ...FULL, balady_extra_field: 'قيمة' });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.unknown, ['balady_extra_field']);
});

test('مُدخل ليس كائناً يُرفض بلا انهيار', () => {
  [null, undefined, 'نصّ', 42, []].forEach((value) => {
    const result = Contract.validate(value);
    assert.strictEqual(result.ok, false, `${JSON.stringify(value)} مرّ`);
    assert.ok(result.blocking.length >= 1);
  });
});

// ---- التحويل بلا معادلة موازية ------------------------------------------

test('سجل مطابق يشغّل المحرك، والتحويل نقلٌ لا حساب', () => {
  const input = Contract.toEngineInput(FULL, { fallbackAadt: Engine.DEFAULTS.aadt });
  assert.strictEqual(input.aadt, FULL.aadt);
  assert.strictEqual(input.lanes, FULL.lanes);
  assert.strictEqual(input.lanesClosed, FULL.lanesClosed);
  assert.strictEqual(input.durationHours, FULL.durationHours);
  assert.strictEqual(input.startHour, new Date(FULL.startISO).getUTCHours());
  /* الثوابت من المحرك لا من العقد: نسخُها هنا يخلق مصدرين لسعة الحارة. */
  assert.strictEqual(input.capacityPerLane, Engine.DEFAULTS.capacityPerLane);
  assert.strictEqual(input.freeFlowMin, Engine.DEFAULTS.freeFlowMin);

  const plan = Engine.optimize(input);
  assert.ok(plan.top3.length === 3 && plan.baseline.delayVehHours > 0);
});

test('غياب الحركة يقع على البديل المعلن لا على صفر', () => {
  const partial = caseOf('ينقصه ما يخفض');
  const input = Contract.toEngineInput(partial, { fallbackAadt: Engine.DEFAULTS.aadt });
  assert.strictEqual(input.aadt, Engine.DEFAULTS.aadt,
    'الحركة الغائبة لم تقع على القيمة المعلنة');
  assert.ok(Engine.optimize(input).baseline.delayVehHours > 0);
});

test('التصدير يبنى من السجل نفسه ويجتاز فحص البنية', () => {
  const plan = Engine.optimize(
    Contract.toEngineInput(FULL, { fallbackAadt: Engine.DEFAULTS.aadt }));
  const feed = Engine.wzdx(Contract.toWzdxInput(FULL, plan));
  assert.strictEqual(feed.feed_info.version, Engine.WZDX_VERSION);
  assert.strictEqual(feed.features[0].id.indexOf(FULL.permitRef), 0);
  assert.deepStrictEqual(feed.features[0].geometry.coordinates, FULL.geometry);
  feed.features.forEach((feature) => {
    assert.strictEqual(typeof feature.properties.is_start_date_verified, 'boolean');
  });
});

// ---- العيّنة موسومة، والحدّ محروس ---------------------------------------

test('العيّنة موسومة تركيبية ولا تُقدَّم سجلاً حقيقياً', () => {
  assert.strictEqual(SAMPLE.synthetic, true, 'العيّنة بلا وسم تركيبي');
  assert.ok(/تركيبية بالكامل/.test(SAMPLE.note),
    'الملاحظة لا تقول إن البيانات تركيبية');
  assert.ok(/لا سجل حقيقي/.test(SAMPLE.note));
  assert.strictEqual(SAMPLE.contractVersion, Contract.CONTRACT_VERSION,
    'نسخة العيّنة تخالف نسخة العقد');
});

test('العقد لا يُقرأ تكاملاً منفَّذاً في أي سطح', () => {
  /* **الفحص الحاكم على الحدّ.** وجود عقد ومحقِّق لا يجعل دورة التصريح
     منفَّذة في أثر. رفعُ حالتها في جدول المقارنة بحجة هذا الملف هو بالضبط
     الادعاء الذي بُني الجدول ليمنعه. */
  const permitCycle = Compare.DIMENSIONS.find((dim) => dim.key === 'permit-cycle');
  assert.ok(permitCycle, 'بُعد دورة التصريح غائب من المقارنة');
  assert.strictEqual(permitCycle.athar.state, 'absent',
    'المقارنة ترفع حالة دورة التصريح لأثر — العقد وصفٌ لا تنفيذ');
  assert.ok(permitCycle.betterElsewhere.length >= 3,
    'دورة التصريح لم تعد محسوبة تفوّقاً لغيرنا');

  const header = fs.readFileSync(
    path.join(ROOT, 'athar-permit-contract.js'), 'utf8').slice(0, 1400);
  assert.ok(/ليس تكاملاً/.test(header),
    'الوحدة لا تعلن أنها ليست تكاملاً — عنوانٌ يُقرأ أكبر مما فيه');
});

console.log(`ALL TESTS PASSED (${count})`);
