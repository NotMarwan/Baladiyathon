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

/*
 * عتبات التركّز — والعلّة التي وُضعت لها.
 * ---------------------------------------------------------------------------
 * `MIN_WINNERS` و`MIN_SIGNATURES` عدّادا **تمايز**، لا مقياسا **توزيع**. وستّة
 * فائزين متمايزين يعبران `MIN_WINNERS = 3` بينما ثمانٍ وتسعون حالة من مئة
 * وخمسين تأخذ الفائز نفسه. أي أن البوابة تمرّ على الحالة التي وُضعت لكشفها:
 * «محرك قرار يخرج جواباً واحداً ليس محرك قرار» — وهو نصّ رأس هذا الملف.
 *
 * والقيَم أدناه **مقيسة لا مختارة**، على المحفظة عند التزام كتابتها:
 *   · أعلى فائز `0p2` — 98 من 150 = **65.3٪**
 *   · نطاق الليل (20–01) — 147 من 150 = **98.0٪**
 *   · توقيعات متمايزة 21، أعلاها 30.7٪
 *
 * والهامش ضيّق عمداً: بوابة بسقف 90٪ على واقعٍ عند 65٪ لا تكشف انحداراً حتى
 * ينهار التنوّع تماماً.
 *
 * وسقف الليل 99٪ لا 98٪ رغم أن المقيس 98٪ بالضبط: الثلاث حالات النهارية
 * (الساعة العاشرة) هي **كل** الدليل على أن البحث غير منحلّ. سقفٌ يساوي المقيس
 * يسقط على تغيّرٍ في تصريح واحد فيُعطَّل؛ وسقف 99٪ يسقط حين تختفي الثلاث —
 * وهو الانحدار الذي يستحق السقوط.
 *
 * **وليست هذه دعوة لتشتيت الجواب.** التركّز ناتجُ الهدف لا عيبٌ في الشيفرة:
 * هدفٌ واحد (`delayVehHours`) فوق ملف طلب ساعي له قاعٌ ليلي عالمي يعطي الليل
 * لأغلب الحالات، وهذا هو الجواب الصحيح تحت هذه الافتراضات — الشرح في
 * `masar-engine.js` عند `CANDIDATE_START_HOURS`. من يكسر هذه البوابة بعشوائية
 * يُسقط الفحص الأخير في هذا الملف: تصريحان متطابقا المدخلات يأخذان التوصية
 * نفسها.
 *
 * فوظيفة هذه العتبات **الإعلان**: أن يكون الرقم مقيساً ومكتوباً، فلا يُقال في
 * عرضٍ إن النظام «يبحث في فضاء سيناريوهات» بلا ذكر أنه يخرج بجوابٍ واحد في
 * ثلثي الحالات. الرقم الذي لا يُقاس يُبالَغ فيه.
 */
const MAX_WINNER_SHARE = 0.70;
const MAX_NIGHT_SHARE = 0.99;
const NIGHT_HOURS = [20, 21, 22, 23, 0, 1];

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

/* التوزيع مطبوع في كل تشغيل.
   رقمٌ يُقاس في حزمة ولا يُطبع رقمٌ لا يعرفه أحد. */
const topWinner = [...winners.entries()].sort((a, b) => b[1] - a[1])[0];
const topWinnerShare = topWinner[1] / permits.length;
const nightCount = results.filter(({ result }) => {
  const top = (result.top3 || [])[0];
  return top && NIGHT_HOURS.indexOf(top.startHour) !== -1;
}).length;
const nightShare = nightCount / permits.length;

console.log(`  · أعلى فائز ${topWinner[0]}: ${topWinner[1]}/${permits.length}`
  + ` = ${(topWinnerShare * 100).toFixed(1)}٪ (السقف ${MAX_WINNER_SHARE * 100}٪)`);
console.log(`  · نطاق الليل: ${nightCount}/${permits.length}`
  + ` = ${(nightShare * 100).toFixed(1)}٪ (السقف ${MAX_NIGHT_SHARE * 100}٪)`);

test('لا فائز واحد يبتلع المحفظة — التمايز يُقاس بالحصة لا بالعدّ', () => {
  assert.ok(topWinnerShare <= MAX_WINNER_SHARE,
    `الفائز ${topWinner[0]} يأخذ ${(topWinnerShare * 100).toFixed(1)}٪ `
    + `من المحفظة (${topWinner[1]}/${permits.length}) — السقف `
    + `${MAX_WINNER_SHARE * 100}٪.\n`
    + `    التوزيع: ${distribution(winners)}\n`
    + '    عدّ الفائزين وحده يمرّ على هذه الحالة — ولذلك تُقاس الحصة.');
});

test('حصة الليل معلَنة ومحدودة — «بحث في فضاء سيناريوهات» له مقام', () => {
  assert.ok(nightShare <= MAX_NIGHT_SHARE,
    `${(nightShare * 100).toFixed(1)}٪ من التوصيات في نطاق الليل `
    + `(${NIGHT_HOURS.join('،')}) — السقف ${MAX_NIGHT_SHARE * 100}٪.\n`
    + '    فوق ذلك لا يبقى «بحثاً»: الجواب واحد والبحث يزيّنه.');
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
