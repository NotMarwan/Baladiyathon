'use strict';
/**
 * WP-H4 — صدق القرار.
 *
 * كانت هذه الحزمة تفحص «تنوّع» التوصية. والتقصّي أثبت أن التنوّع ليس بيد
 * الشيفرة: `HOURLY_PROFILE` ملفُّ طلبٍ **واحد لكل شوارع الرياض** وموصوف في
 * المحرك بأنه افتراض توضيحي، فقاعُه عند الساعة نفسها لكل شارع، فالجواب واحد.
 * وتنويعه يحتاج قياساً محلياً غير موجود — والتفصيل في كتلة العتبات أدناه.
 *
 * فتحوّلت الحزمة من فحص تنوّعٍ إلى فحص **صدق ادّعاء**:
 *   · أن يُعلن المحرك صنف اللاتمييز حين لا يستطيع الترتيب.
 *   · ألّا يُقدَّم تعادلٌ على أنه حسم.
 *   · وأن يبقى التركّز مقيساً ومطبوعاً وغير متدهور.
 *
 * والفحص الحاكم يبقى كما كان: التنوّع — أينما وُجد — **مشتقٌّ من اختلاف
 * المدخلات**، فتصريحان متطابقا المدخلات يأخذان التوصية نفسها. عشوائيةٌ تُضاف
 * لكسر عدّادٍ تمرّ الفحوص الأولى وتسقط في ذاك.
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
 * التركّز — ما قيس فعلاً، ولماذا لا يُصلَح بتشتيت الجواب.
 * ---------------------------------------------------------------------------
 * `MIN_WINNERS` و`MIN_SIGNATURES` عدّادا **تمايز** لا مقياسا **توزيع**: ستّة
 * فائزين متمايزين يعبران `MIN_WINNERS = 3` بينما ثمانٍ وتسعون حالة من مئة
 * وخمسين تأخذ الفائز نفسه.
 *
 * ثم رُبطت المحفظة بـ`masar-trafficload.js` فصار الحمل مقدَّراً من صنف الطريق
 * الحقيقي وعدد حاراته بدل نطاقٍ مكتوب باليد، وهبطت الأحمال إلى نحو النصف.
 * فارتفع نصيب الفائز الأوحد من 65.3٪ إلى **82.0٪**.
 *
 * **والتقصّي أعطى رقماً أسوأ:** بين التصاريح التي يصفها
 * `data/stability-report.json` بأنها **قابلة للقرار** يفوز `0p2` في **87 من
 * 87** — مئة بالمئة. أي أن التنوّع الظاهر كلّه يأتي من تصاريح يمتنع النظام
 * عن الحكم فيها أصلاً.
 *
 * ## الآلية — مقيسة لا مستنتَجة
 *
 * تفكيك الهدف على ثلاثة أحمال يعطي السبب مباشرة:
 *
 *   حمل عالٍ (88 ألفاً)  الاحتكاك المتبقي 1,473 يغلب تأخير الإغلاق 576،
 *                        فتتنازع الامتدادات ويتنوّع الفائز.
 *   حمل وسيط (28 ألفاً)  التأخير 466 والمتبقي 23، وعلاوة الليل **306 لكل
 *                        المرشحين الليليين بالتساوي** فلا تميّز بينها.
 *   حمل منخفض (14 ألفاً) العلاوة تغلب فرقاً ضئيلاً في التأخير، فيفوز النهار.
 *
 * فالنطاق الأوسط — وهو أغلب المحفظة — لا يبقى فيه مميِّزٌ إلا تأخير الإغلاق،
 * وأدناه عند قاع الطلب. وقاعُ الطلب **واحد لكل شوارع الرياض** لأن
 * `HOURLY_PROFILE` ملفٌّ عالمي واحد موصوف في المحرك بأنه «افتراض توضيحي
 * للعرض». شارعٌ واحد وقاعٌ واحد ⟵ جوابٌ واحد.
 *
 * ## لماذا لا تُرفع البوابة ولا يُشتَّت الجواب
 *
 * تشتيت الجواب بعشوائية يُسقط الفحص الأخير في هذا الملف (متطابقا المدخلات
 * يتطابقان). وإصلاحه الحقيقي يحتاج ملف طلبٍ يختلف بصنف الطريق أو بالشارع —
 * وهو **قياس غير موجود**: `comparable-cases.json` يسجّل صفر حالة سعودية
 * بقياسات، والحالتان السعوديتان فيه `context-only` وممنوعتان من المعايرة
 * بنصّهما. فاختراع منحنى طلبٍ لتحسين رقمٍ في بوابة هو بالضبط ما تمنعه قاعدة
 * الأدلة.
 *
 * ## فماذا تفحص هذه البوابة الآن
 *
 * لا «تنوّعاً» — ذاك ليس بيد الشيفرة اليوم. بل **صدق الادّعاء**:
 *   1. أن يُعلن النظام صنف اللاتمييز حين لا يستطيع الترتيب (`indifference`).
 *   2. ألّا يُقدَّم تعادلٌ على أنه حسم.
 *   3. وأن يبقى التركّز **مقيساً ومطبوعاً وغير متدهور** — سقّاطة لا هدف.
 *
 * والسقوف أدناه مقيسة عند كتابة هذا النصّ، لا مختارة.
 */
const MAX_WINNER_SHARE = 0.86;
const MAX_DECIDED_WINNER_SHARE = 0.97;
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

/* ---- صدق الادّعاء: ما يُعلَن حسماً يجب أن يكون حسماً ---- */

const bands = results.map(({ result }) => result.indifference).filter(Boolean);
const decidedBands = bands.filter((band) => band.decided);
const decidedWinners = new Map();
decidedBands.forEach((band) => {
  decidedWinners.set(band.representative,
    (decidedWinners.get(band.representative) || 0) + 1);
});
const topDecided = [...decidedWinners.entries()].sort((a, b) => b[1] - a[1])[0];
const decidedShare = topDecided ? topDecided[1] / decidedBands.length : 0;

console.log(`  · محسوم ${decidedBands.length}/${bands.length}`
  + ` · متعادل ${bands.length - decidedBands.length}`);
console.log(`  · أعلى فائز بين المحسوم: ${topDecided ? topDecided[0] : '—'} `
  + `${(decidedShare * 100).toFixed(1)}٪ (السقف ${MAX_DECIDED_WINNER_SHARE * 100}٪)`);

test('كل تصريح يحمل صنف لاتمييزه — لا ترتيب بلا إعلان قابليته', () => {
  assert.strictEqual(bands.length, results.length,
    `${results.length - bands.length} تصريحاً بلا صنف لاتمييز — `
    + 'المحرك يرتّب ولا يقول إن كان الترتيب مُميَّزاً أصلاً.');
});

test('التعادل لا يُقدَّم حسماً — `decided` يطابق حجم الصنف', () => {
  const lying = bands.filter((band) => band.decided !== (band.members.length === 1));
  assert.strictEqual(lying.length, 0,
    `${lying.length} صنفاً يعلن حسماً وفيه أكثر من عضو — أسوأ من التركّز نفسه: `
    + 'تركّزٌ معلَن يُقرأ حدّاً، وحسمٌ كاذب يُقرأ قدرة.');
});

/*
 * سقّاطة على المحسوم وحده.
 * التركّز الإجمالي (82٪) يخفّفه امتناعُ النظام؛ والرقم الذي يهمّ هو: حين
 * **يحسم**، كم مرة يقول الشيء نفسه؟ قيس 93.4٪ — وهو الرقم الذي يجب ألّا
 * يتدهور، ولا يُرفع إلا بقياسٍ محلي يفرّق ملفات الطلب.
 */
test('التركّز بين المحسوم مقيس ولا يتدهور — سقّاطة لا هدف', () => {
  assert.ok(decidedBands.length > 0, 'لا تصريح محسوم أصلاً');
  assert.ok(decidedShare <= MAX_DECIDED_WINNER_SHARE,
    `${(decidedShare * 100).toFixed(1)}٪ من التصاريح المحسومة تأخذ `
    + `${topDecided[0]} — السقف ${MAX_DECIDED_WINNER_SHARE * 100}٪.\n`
    + `    التوزيع: ${distribution(decidedWinners)}\n`
    + '    الإصلاح في ملف الطلب لا في البوابة: انظر كتلة العتبات في رأس الملف.');
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
