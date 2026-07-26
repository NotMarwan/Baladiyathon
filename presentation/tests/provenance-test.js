'use strict';
/**
 * WP-T1 — عقد المصدر والثقة.
 *
 * سبع حالات يجب أن تُسقط هذه الحزمة. كلٌّ منها خصمٌ مثبت في تقرير التحكيم،
 * لا احتمالٌ نظري:
 *
 *   1. رقم رئيسي بلا sourceType.
 *   2. قيمة مشتقّة بلا derivedBy.
 *   3. قيمة تقديرية أو اصطناعية بلا assumptions وlimitations.
 *   4. وصف قيمة اصطناعية أو قديمة بأنها حيّة.
 *   5. رقم سنوي بلا مقام موثّق.
 *   6. ادعاء وفر مالي بلا مُدخل ظاهر.
 *   7. عودة أي رقم SAR حُذف من Dig-Once.
 *
 * التشغيل: node presentation/tests/provenance-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'masar-provenance.js'));
const Engine = require(path.join(ROOT, 'masar-engine.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

function throws(fn, pattern, message) {
  let raised = null;
  try { fn(); } catch (error) { raised = error; }
  assert.ok(raised, message + ' — لم يُرفض أصلاً');
  assert.ok(pattern.test(raised.message),
    `${message} — رُفض برسالة لا تشرح السبب: ${raised.message}`);
}

// --- 1. رقم بلا نوع مصدر -----------------------------------------------

test('يُرفض رقم بلا نوع مصدر، ويُسمّى المسموح', () => {
  throws(() => P.value({ value: 1, unit: 'كم' }),
    /نوع مصدر غير معروف/, 'قيمة بلا sourceType');
  throws(() => P.value({ value: 1, unit: 'كم', sourceType: 'وهمي' }),
    /نوع مصدر غير معروف/, 'نوع مصدر مخترع');
});

test('يُرفض رقم بلا وحدة — رقم بلا وحدة لا يُقارَن', () => {
  throws(() => P.value({ value: 1, sourceType: 'derived', derivedBy: 'س' }),
    /بلا وحدة/, 'قيمة بلا unit');
});

// --- 2. مشتقّ بلا طريقة اشتقاق -----------------------------------------

test('يُرفض المشتقّ بلا derivedBy — المعادلة جزء من الرقم', () => {
  throws(() => P.value({ value: 5, unit: 'ساعة-مركبة', sourceType: 'derived' }),
    /derivedBy/, 'قيمة مشتقة بلا معادلة');
});

// --- 3. تقديري واصطناعي بلا افتراضات وحدود -----------------------------

test('يُرفض التقديري بلا assumptions — الافتراض المخفي يُقرأ حقيقة', () => {
  throws(() => P.value({
    value: 1.1, unit: 'معامل', sourceType: 'estimated', limitations: 'حدّ',
  }), /assumptions/, 'تقديري بلا افتراضات');
});

test('يُرفض التقديري بلا limitations — حدود الاستخدام جزء من الرقم', () => {
  throws(() => P.value({
    value: 1.1, unit: 'معامل', sourceType: 'estimated', assumptions: ['ا'],
  }), /limitations/, 'تقديري بلا حدود');
});

test('الاصطناعي يخضع للشرطين نفسيهما — المولَّد ليس أهون من المقدَّر', () => {
  throws(() => P.value({
    value: 392144, unit: 'مضلع', sourceType: 'synthetic', limitations: 'ح',
  }), /assumptions/, 'اصطناعي بلا افتراضات');
});

// --- 4. ادعاء الحياة ----------------------------------------------------

test('لا يُدّعى «حي» على اصطناعي أو تقديري أو مشتق أو مستورَد', () => {
  const synthetic = P.value({
    value: 1, unit: 'رصد', sourceType: 'synthetic',
    assumptions: ['بذرة ثابتة'], limitations: 'عرض فقط',
  });
  assert.strictEqual(P.mayClaimLive(synthetic), false,
    'قيمة اصطناعية جاز وصفها بالحياة');

  const derived = P.value({
    value: 2, unit: 'ساعة-مركبة', sourceType: 'derived', derivedBy: 'BPR',
  });
  assert.strictEqual(P.mayClaimLive(derived), false);

  const imported = P.value({ value: 3, unit: 'ضلع', sourceType: 'imported' });
  assert.strictEqual(P.mayClaimLive(imported), false);
});

test('الرسمي والمرصود لا يُدّعى لهما حياة بلا وقت رصد', () => {
  throws(() => P.value({ value: 2200000, unit: 'عملية', sourceType: 'official' }),
    /observedAt/, 'رسمي بلا وقت رصد');

  const stamped = P.value({
    value: 2200000, unit: 'عملية', sourceType: 'official',
    sourceId: 'src-008', observedAt: '2024-03',
  });
  assert.strictEqual(P.mayClaimLive(stamped), true);
});

// --- 5. الرقم السنوي ----------------------------------------------------

const cityImpact = fs.readFileSync(path.join(ROOT, 'masar-city-impact.html'), 'utf8');

test('لا رقم يُوصف «سنوياً» بلا مقام موثّق', () => {
  /* المحفظة مولَّدة: 150 تصريحاً بتواريخ بدء عشوائية على 365 يوماً ببذرة
     ثابتة. العدد 150 افتراض عرض لا إحصاء، ولا يملك المستودع حجم تصاريح حفر
     سنوياً في الرياض من مصدر رسمي. فالتوسيع إلى سنة ادعاء بمقام مخترع.

     الفحص يسمح بذكر «سنوياً» داخل الشرح الذي ينفي وجود الرقم السنوي، ويمنعه
     وصفاً لقيمة معروضة. */
  /* منطقة واحدة معلَنة يجوز فيها ذكر «سنوياً»: الشرح الذي ينفي وجود الرقم.
     تُجرَّد قبل الفحص بالاستبدال بمسافات — يحفظ أرقام الأسطر في رسالة الفشل.
     استثناء بحدود مرسومة في الترميز، لا قائمة عبارات مسموحة تتمدّد كلما أزعج
     الفحص أحداً. */
  const NOTE_BLOCK = /<div class="denominator-note">[\s\S]*?<\/div>/g;
  const outsideNote = cityImpact.replace(NOTE_BLOCK, (block) =>
    block.replace(/[^\n]/g, ' '));

  const claims = [];
  outsideNote.split('\n').forEach((line, index) => {
    if (/سنوياً/.test(line)) {
      claims.push(`masar-city-impact.html:${index + 1} — ${line.trim().slice(0, 80)}`);
    }
  });
  assert.strictEqual(claims.length, 0,
    `${claims.length} موضعاً يصف قيمة «سنوياً» خارج منطقة الشرح:\n    `
    + claims.join('\n    '));

  assert.ok(/لماذا لا يوجد رقم سنوي/.test(cityImpact),
    'الصفحة لا تشرح سبب غياب الرقم السنوي — الحذف الصامت يُقرأ سهواً');
});

test('النسبة تُسمّى فرقاً نموذجياً لا وفراً محقَّقاً', () => {
  assert.ok(/فرق نموذجي/.test(cityImpact),
    'النسبة معروضة «وفراً» — وهي فرق بين جدولين داخل النموذج، لا قياس ميداني');
  assert.ok(/غير مقيس ميدانياً/.test(cityImpact),
    'لا يُعلن أن النسبة غير مقيسة ميدانياً');
});

// --- 6 و7. المال في Dig-Once -------------------------------------------

test('مخرج digOnce بلا أي حقل مالي — الفحص الحارس', () => {
  const r = Engine.digOnce({ trenchKm: 1.2, permitsMerged: 3 });
  Object.keys(r).forEach((key) => {
    assert.ok(!/SAR|ريال/i.test(key), `عاد حقل مالي إلى digOnce: ${key}`);
  });
  assert.strictEqual(Engine.DEFAULTS.trenchCostPerKmSAR, undefined,
    'كلفة الخندق الافتراضية عادت إلى DEFAULTS');
});

test('كل ادعاء وفر مالي يسمّي مُدخله ومن يملكه', () => {
  const r = Engine.digOnce({ trenchKm: 1.2, permitsMerged: 3 });
  assert.ok(/كلفة الخندق لدى الأمانة/.test(r.costNote),
    'الوفر المالي مذكور بلا تسمية مالك المُدخل');
  assert.ok(/لا يملكه النموذج/.test(r.costNote),
    'لا يُعلن أن الكلفة خارج النموذج');
});

test('الطول المكرر يخرج بافتراضه لا بوصفه هندسة محسوبة', () => {
  const r = Engine.digOnce({ trenchKm: 1.2, permitsMerged: 3 });
  assert.strictEqual(r.avoidedTrenchKm, undefined,
    'الاسم القاطع «طول متجنَّب» عاد — يدّعي تداخلاً هندسياً غير محسوب');
  assert.ok(/تداخل تام/.test(r.overlapAssumption));
  assert.ok(/غير محسوب/.test(r.overlapAssumption));
  assert.ok(/تداخل تام/.test(cityImpact),
    'الصفحة تعرض الطول المكافئ بلا افتراضه');
});

// --- سطح العرض يحمل العقد -----------------------------------------------

test('صفحة الأثر تحمّل وحدة العقد وتعرض سطر مصدر لكل رقم رئيسي', () => {
  assert.ok(cityImpact.indexOf('masar-provenance.js') !== -1,
    'الصفحة لا تحمّل masar-provenance.js');
  const stamps = cityImpact.match(/stamp\('card-/g) || [];
  assert.ok(stamps.length >= 4,
    `${stamps.length} بطاقة موسومة فقط — الأرقام الرئيسية الأربع كلها تُوسَم`);
  assert.ok(/counter-provenance/.test(cityImpact),
    'الرقم الرئيسي في الصدر بلا سطر مصدر');
});

test('violations تكشف القيم الناقصة بدل أن تمرّرها صامتة', () => {
  const bad = P.violations({
    good: P.value({ value: 1, unit: 'كم', sourceType: 'derived', derivedBy: 'س' }),
    naked: { value: 2, unit: 'كم' },
  });
  assert.strictEqual(bad.length, 1);
  assert.ok(/naked/.test(bad[0]) && /sourceType/.test(bad[0]));
});

console.log(`ALL TESTS PASSED (${count})`);
