'use strict';
/**
 * WP-H4 — تنوّع القرار.
 *
 * هذه الحزمة **تفشل عمداً اليوم**. هي تعريف «تمّ» لحزمة B1، لا فحص انحدار.
 *
 * الحقيقة التي تقيسها: `Engine.optimize()` يعطي اليوم الفائز نفسه
 * (22:00 · مرحلتان) لمئة وخمسين تصريحاً من مئة وخمسين، وتوقيع البدائل
 * الثلاثة واحد للمحفظة كلها. محرك قرار يخرج جواباً واحداً ليس محرك قرار.
 *
 * السبب الجذري ليس ضيق فضاء المرشحين وحده، بل أن الهدف واحد: تقليل
 * `delayVehHours` المشتق من ملف طلب ساعي له قاع ليلي عالمي. أي شبكة أوسع
 * بالهدف نفسه ستعطي الجواب نفسه بدقة أعلى.
 *
 * ولذلك لا يكفي عدّاد التوقيعات. الفحص الأخير هنا هو الحاكم: التنوّع يجب
 * أن يكون **مشتقاً من اختلاف المدخلات**، فتصريحان متطابقا المدخلات يأخذان
 * التوصية نفسها. عشوائيةٌ تُضاف لكسر العدّاد ستمرّ الفحص الأول وتسقط في هذا.
 *
 * عتبة القبول: خمسة توقيعات متمايزة على الأقل — شرط ضروري لا كافٍ.
 * الكافي أن يشرح النظام **لماذا** اختلفت التوصية.
 *
 * التشغيل: node presentation/tests/decision-diversity-test.js
 */

const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'city-portfolio.geojson.js'));
const Engine = require(path.join(ROOT, 'masar-engine.js'));

const MIN_SIGNATURES = 5;
const MIN_WINNERS = 3;

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

function inputOf(properties) {
  return {
    aadt: properties.aadt,
    lanes: properties.lanes,
    lanesClosed: properties.lanesClosed,
    startHour: new Date(properties.start).getUTCHours(),
    durationHours: properties.durationHours,
    freeFlowMin: properties.freeFlowMin || Engine.DEFAULTS.freeFlowMin,
    sensitivity: properties.sensitivity,
    roadClass: properties.roadClass,
  };
}

/* التوقيع يمثّل الترتيب لا الفائز وحده: محسّن يبدّل الفائز ويبقي البدائل
   الثلاثة كما هي لم يتغيّر فعلاً — بدّل ترتيباً داخل جواب واحد. */
function signatureOf(result) {
  return (result.top3 || [])
    .map((candidate) => `${candidate.startHour}p${candidate.phases}`)
    .join(',');
}

const permits = global.window.MASAR_CITY_PORTFOLIO.features
  .map((feature) => feature.properties)
  .filter((p) => p.aadt && p.lanes);

const results = permits.map((p) => ({ permit: p, result: Engine.optimize(inputOf(p)) }));

const winners = new Map();
const signatures = new Map();
results.forEach(({ result }) => {
  const top = (result.top3 || [])[0];
  const winner = top ? `${top.startHour}p${top.phases}` : 'none';
  winners.set(winner, (winners.get(winner) || 0) + 1);
  const signature = signatureOf(result);
  signatures.set(signature, (signatures.get(signature) || 0) + 1);
});

function distribution(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => `${key || '(فارغ)'}×${n}`)
    .join(' · ');
}

test('المحفظة كاملة تمرّ بالمحسّن — لا عيّنة منتقاة', () => {
  assert.strictEqual(permits.length, 150,
    `${permits.length} تصريحاً بمدخلات مرورية لا 150`);
  const empty = results.filter(({ result }) => !result.top3 || !result.top3.length);
  assert.strictEqual(empty.length, 0, `${empty.length} تصريحاً بلا بدائل`);
});

test('الفائز يختلف بين الحالات — لا ساعة واحدة تحكم المحفظة', () => {
  assert.ok(winners.size >= MIN_WINNERS,
    `${winners.size} فائز من ${permits.length} تصريحاً — القرار ثابت.\n`
    + `    التوزيع: ${distribution(winners)}\n`
    + `    المطلوب ${MIN_WINNERS} فائزين مختلفين على الأقل (WP-B1).`);
});

test('ترتيب البدائل يختلف بين الحالات — لا توقيع واحد للمحفظة', () => {
  assert.ok(signatures.size >= MIN_SIGNATURES,
    `${signatures.size} توقيع من ${permits.length} تصريحاً — القرار ثابت.\n`
    + `    التوزيع: ${distribution(signatures)}\n`
    + `    المطلوب ${MIN_SIGNATURES} توقيعات متمايزة على الأقل (WP-B1).`);
});

test('لكل توصية سبب مشتقّ لا عبارة ثابتة', () => {
  const reasons = new Set();
  results.forEach(({ result }) => {
    const top = (result.top3 || [])[0];
    (top && top.reasons ? top.reasons : []).forEach((r) => reasons.add(String(r)));
  });
  assert.ok(reasons.size >= MIN_SIGNATURES,
    `${reasons.size} صيغة سبب فقط — الأسباب لا تتبع الحالة.`);
});

test('التنوّع مشتقٌّ من المدخلات لا ضجيج: متطابقو المدخلات يتطابقون', () => {
  /* الفحص الحاكم. عشوائية تُضاف لكسر العدّادات أعلاه ستمرّها وتسقط هنا:
     تصريحان بمدخلات متطابقة يجب أن يأخذا التوصية نفسها، دائماً. */
  const byInput = new Map();
  results.forEach(({ permit, result }) => {
    const input = inputOf(permit);
    const key = JSON.stringify(input);
    const signature = signatureOf(result);
    if (byInput.has(key) && byInput.get(key).signature !== signature) {
      byInput.get(key).conflicts.push(permit.permitRef);
    } else if (!byInput.has(key)) {
      byInput.set(key, { signature, ref: permit.permitRef, conflicts: [] });
    }
  });
  const unstable = [...byInput.values()].filter((v) => v.conflicts.length);
  assert.strictEqual(unstable.length, 0,
    `${unstable.length} مجموعة مدخلات متطابقة أعطت توصيات مختلفة — التنوّع ضجيج لا اشتقاق:\n    `
    + unstable.slice(0, 5).map((v) => `${v.ref} ≠ ${v.conflicts.join(', ')}`).join('\n    '));
});

test('التوصية تتغيّر مع الحساسية — مستشفى وشارع عادي لا يتساويان', () => {
  /* المحفظة تحمل `sensitivity` على ثلاثة وستين تصريحاً من مئة وخمسين ولا
     يدخل الحساب اليوم. هذا الفحص يثبت دخوله بعد B1. */
  const base = {
    aadt: 45000, lanes: 3, lanesClosed: 1, startHour: 9,
    durationHours: 120, freeFlowMin: Engine.DEFAULTS.freeFlowMin,
  };
  const normal = signatureOf(Engine.optimize({ ...base, sensitivity: 'normal' }));
  const hospital = signatureOf(Engine.optimize({ ...base, sensitivity: 'hospital' }));
  assert.notStrictEqual(normal, hospital,
    `الحساسية لا تؤثر: شارع عادي ومستشفى أعطيا ${normal} كلاهما.\n`
    + '    الحقل موجود على 63 من 150 تصريحاً ولا يدخل الحساب (WP-B1 · WP-T2).');
});

console.log(`ALL TESTS PASSED (${count})`);
