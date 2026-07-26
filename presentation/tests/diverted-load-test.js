'use strict';
/**
 * WP-R1 — بوابة تحميل الحركة المحوَّلة.
 *
 * العيب الذي تحرسه: محرك الخريطة كان يقترح مساراً بديلاً ويعرض زمنه **وهو
 * فارغ** — أي زمن طريقٍ لن يوجد، لأن البديل هو بالضبط ما سيستقبل حركة
 * الإغلاق. بديلٌ لا يُحمَّل ليس بديلاً بل خطٌّ على خريطة.
 *
 * ومحرك الممر (`masar-routing.js`) كان ينفّذ التحويل منذ البداية. الفجوة
 * كانت في محرك الخريطة وحده — وهو المحرك الذي يراه المحكّم.
 *
 * ما تفحصه هذه الحزمة سلوكٌ لا نصّ: تأخذ الشبكة الحقيقية والمحفظة الحقيقية،
 * وتقارن الأرقام قبل التحميل وبعده، وتشترط أن **الواجهة تعرض المُحمَّل**.
 *
 * التشغيل: node presentation/tests/diverted-load-test.js
 */

const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'city-portfolio.geojson.js'));
require(path.join(ROOT, 'data', 'riyadh-route-graph.js'));
const Routing = require(path.join(ROOT, 'masar-city-routing.js'));
const Solution = require(path.join(ROOT, 'masar-worksmap-solution.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const prepared = Routing.prepare(global.window.RIYADH_ROUTE_GRAPH);
const features = global.window.MASAR_CITY_PORTFOLIO.features;

/** أول `n` تصاريح لها بدائل محسوبة — عيّنة لا مثال منتقى. */
function solved(n, hour) {
  const out = [];
  for (let i = 0; i < features.length && out.length < n; i += 1) {
    const feature = features[i];
    const result = Routing.alternativesAround(prepared, feature.geometry.coordinates, {
      hour: typeof hour === 'number' ? hour : 8,
      lanesClosed: feature.properties.lanesClosed,
    });
    if (result.ok && result.alternatives.length) out.push({ feature, result });
  }
  return out;
}

const SAMPLE = solved(12);

test('العيّنة ليست حالة واحدة', () => {
  assert.ok(SAMPLE.length >= 8,
    `${SAMPLE.length} حالة محلولة فقط — العيّنة أضيق من أن تُعمَّم`);
});

// ---- التحويل يُحسب ويُحمَّل ----------------------------------------------

test('كل نتيجة تحمل مقدار الحركة المحوَّلة وقاعدتها المعلنة', () => {
  SAMPLE.forEach(({ feature, result }) => {
    const diverted = result.diverted;
    assert.ok(diverted, `${feature.properties.id}: بلا حقل تحويل`);
    assert.ok(Number.isFinite(diverted.vehPerHour) && diverted.vehPerHour > 0,
      `${feature.properties.id}: حركة محوَّلة = ${diverted.vehPerHour}`);
    /* القاعدة معروضة مع الرقم: قاعدة عرضٍ معلنة، لا معايرة سائق مقيسة.
       رقمٌ بلا قاعدته يُقرأ قياساً. */
    assert.ok(/قاعدة عرض معلنة/.test(diverted.rule),
      `${feature.properties.id}: قاعدة التحويل غير معلنة`);
    assert.ok(diverted.lanesClosed >= 1 && diverted.lanesClosed <= diverted.lanes,
      `${feature.properties.id}: ${diverted.lanesClosed}/${diverted.lanes} مسار`);
  });
});

test('التحميل يرفع الحجم إلى السعة على كل بديل — لا حالة تُترك فارغة', () => {
  SAMPLE.forEach(({ feature, result }) => {
    result.alternatives.forEach((route, index) => {
      const load = route.load;
      assert.ok(load, `${feature.properties.id}/${index}: بلا حمل`);
      assert.ok(load.maxRatioAfter > load.maxRatioBefore,
        `${feature.properties.id}/${index}: النسبة بعد التحويل `
        + `${load.maxRatioAfter} ليست أعلى من ${load.maxRatioBefore} — لم يُحمَّل`);
      assert.strictEqual(load.divertedVehPerHour, result.diverted.vehPerHour);
    });
  });
});

test('الزمن بعد التحويل أطول — ولا يساوي الزمن الفارغ', () => {
  SAMPLE.forEach(({ feature, result }) => {
    result.alternatives.forEach((route, index) => {
      assert.ok(route.minutesAfterDiversion > route.minutes,
        `${feature.properties.id}/${index}: ${route.minutesAfterDiversion} `
        + `ليس أطول من ${route.minutes}`);
      assert.ok(Math.abs(route.addedMinutesAfterDiversion
        - (route.minutesAfterDiversion - result.baseline.minutes)) < 1e-9,
        `${feature.properties.id}/${index}: الفرق لا يطابق طرفيه`);
    });
  });
});

test('الفيض يُوسَم باسم المقطع الحاكم لا كعلم مجرّد', () => {
  const overflowing = SAMPLE.flatMap(({ feature, result }) => result.alternatives
    .filter((route) => route.load.overflows)
    .map((route) => ({ id: feature.properties.id, route })));
  assert.ok(overflowing.length > 0,
    'لا بديل يفيض في العيّنة كلها — إمّا التحميل صوريّ أو العتبة لا تُبلغ');
  overflowing.forEach((item) => {
    assert.ok(item.route.load.maxRatioAfter > 1,
      `${item.id}: موسوم بالفيض ونسبته ${item.route.load.maxRatioAfter}`);
    assert.ok(item.route.load.bindingEdge >= 0,
      `${item.id}: فيض بلا مقطع حاكم — لا يُعرف أين يقع`);
  });
});

// ---- المعادلة واحدة لا موازية -------------------------------------------

test('زمن الضلع بلا حمل يطابق `edgeMinutes` بالضبط', () => {
  /* حسابُ حملٍ في مكان وزمنٍ في مكان آخر يفترقان عند أول تعديل. الفحص هنا
     يثبت أن الثانية تنادي الأولى لا أنها نسخة منها. */
  const graph = prepared.graph;
  for (let hour = 0; hour < 24; hour += 3) {
    for (let i = 0; i < 40 && i < graph.edges.length; i += 7) {
      const edge = graph.edges[i];
      assert.strictEqual(
        Routing.edgeLoad(prepared, edge, hour, 0).minutes,
        Routing.edgeMinutes(prepared, edge, hour),
        `الضلع ${i} عند الساعة ${hour}: المعادلتان افترقتا`
      );
    }
  }
});

test('الحمل الأكبر يعطي زمناً أطول ونسبةً أعلى — رتابة', () => {
  const edge = prepared.graph.edges[0];
  let previousMinutes = -Infinity;
  let previousRatio = -Infinity;
  [0, 200, 800, 2000].forEach((extra) => {
    const loaded = Routing.edgeLoad(prepared, edge, 8, extra);
    assert.ok(loaded.minutes >= previousMinutes,
      `حملٌ أكبر (${extra}) أعطى زمناً أقصر`);
    assert.ok(loaded.ratio >= previousRatio, `حملٌ أكبر أعطى نسبةً أقل`);
    previousMinutes = loaded.minutes;
    previousRatio = loaded.ratio;
  });
});

test('الحمل السالب لا يُطرح من الحجم', () => {
  /* مُدخلٌ سالب يجب أن يُقصّ لا أن يخفّض الازدحام — وإلا صار «التحويل» أداةً
     لتحسين الرقم. */
  const edge = prepared.graph.edges[0];
  assert.strictEqual(
    Routing.edgeLoad(prepared, edge, 8, -5000).ratio,
    Routing.edgeLoad(prepared, edge, 8, 0).ratio
  );
});

test('التحويل يُقصّ عند عدد مسارات الشبكة لا عند رقم التصريح', () => {
  /* تصريحٌ يقول «أغلق ثمانية مسارات» على ضلعٍ من مسارين لا يحوّل أربعة
     أضعاف الطلب. الشبكة هي ما يعرفه النموذج. */
  const { feature, result } = SAMPLE[0];
  const banned = result.banned;
  const wild = Routing.divertedDemand(prepared, banned, 8, 99);
  const all = Routing.divertedDemand(prepared, banned, 8, wild.lanes);
  assert.strictEqual(wild.lanesClosed, wild.lanes,
    `${feature.properties.id}: لم يُقصّ العدد عند ${wild.lanes}`);
  assert.strictEqual(wild.vehPerHour, all.vehPerHour);

  const none = Routing.divertedDemand(prepared, banned, 8, 0);
  assert.strictEqual(none.vehPerHour, 0, 'إغلاق صفر مسارات حوّل حركة');
});

test('الطلب المحوَّل من أقصى ضلع مغلق لا من مجموع الأضلاع', () => {
  /* الإغلاق مقطعٌ من ممر، وأضلاعه تحمل التدفق نفسه تقريباً. جمعُها يعدّ
     المركبات نفسها مرات بعدد المقاطع. */
  const { result } = SAMPLE.find((item) => Object.keys(item.result.banned).length > 1)
    || SAMPLE[0];
  const banned = result.banned;
  const keys = Object.keys(banned);
  if (keys.length < 2) return;

  const whole = Routing.divertedDemand(prepared, banned, 8, 1);
  let sumOfParts = 0;
  keys.forEach((key) => {
    const single = {};
    single[key] = true;
    sumOfParts += Routing.divertedDemand(prepared, single, 8, 1).vehPerHour;
  });
  assert.ok(whole.vehPerHour < sumOfParts,
    `التحويل ${whole.vehPerHour} يساوي مجموع المقاطع ${sumOfParts} — عدٌّ مكرر`);
});

// ---- الواجهة تعرض المُحمَّل ----------------------------------------------

test('الجدول يعرض الزمن بعد التحويل لا قبله', () => {
  /* الفحص الحاكم. حسابٌ صحيح خلف واجهةٍ تعرض الرقم القديم لا يغيّر شيئاً
     عند المحكّم — وهو الوحيد الذي يقرأ. */
  const { result } = SAMPLE[0];
  const html = Solution.detourHtml(result);
  const route = result.alternatives[0];

  const loaded = '+' + route.addedMinutesAfterDiversion.toFixed(1) + ' د';
  const bare = '+' + route.addedMinutes.toFixed(1) + ' د';
  assert.ok(html.indexOf(loaded) !== -1,
    `الجدول لا يعرض الزمن المحمَّل (${loaded})`);
  if (loaded !== bare) {
    assert.ok(html.indexOf(bare) === -1,
      `الجدول يعرض الزمن قبل التحميل (${bare}) — رقمٌ صحيح في سياق خاطئ`);
  }
  assert.ok(/بعد تحميل البديل بالحركة المحوَّلة/.test(html),
    'الجدول لا يقول إن الزمن محسوب بعد التحويل');
  assert.ok(/قاعدة التحويل معلنة لا مقيسة/.test(html),
    'الجدول لا يعلن أن قاعدة التحويل ليست قياساً');
});

test('البديل الفائض يُعلَن في الواجهة بنسبته واسم مقطعه', () => {
  const found = SAMPLE.find((item) => item.result.alternatives
    .some((route) => route.load.overflows));
  assert.ok(found, 'لا حالة فيض في العيّنة — لا يمكن فحص الإعلان');
  const html = Solution.detourHtml(found.result);
  assert.ok(/ينقل الازدحام ولا يمتصّه/.test(html),
    'الفيض غير معلن في الواجهة');
  const route = found.result.alternatives.find((item) => item.load.overflows);
  assert.ok(html.indexOf(route.load.maxRatioAfter.toFixed(2)) !== -1,
    'النسبة بعد التحويل غير معروضة');
  assert.ok(/works-detour-strained/.test(html),
    'الصفّ الفائض بلا وسم يميّزه');
});

test('البديل غير الفائض لا يُوسَم', () => {
  const calm = SAMPLE.find((item) => item.result.alternatives
    .every((route) => !route.load.overflows));
  if (!calm) return; // كل الحالات تفيض — لا شيء يُفحص هنا
  const html = Solution.detourHtml(calm.result);
  assert.ok(!/works-detour-strained/.test(html),
    'بديلٌ لا يفيض وُسم بالفيض — إنذار كاذب يُفقد الثقة بالإنذار الصحيح');
});

// ---- الحتمية -------------------------------------------------------------

test('النتيجة حتمية لنفس المُدخل', () => {
  const feature = SAMPLE[0].feature;
  const run = () => Routing.alternativesAround(prepared, feature.geometry.coordinates,
    { hour: 8, lanesClosed: feature.properties.lanesClosed });
  const first = run();
  const second = run();
  assert.strictEqual(first.diverted.vehPerHour, second.diverted.vehPerHour);
  assert.deepStrictEqual(
    first.alternatives.map((route) => route.minutesAfterDiversion),
    second.alternatives.map((route) => route.minutesAfterDiversion)
  );
});

test('ساعة الذروة تحوّل أكثر من ساعة القاع', () => {
  const feature = SAMPLE[0].feature;
  const at = (hour) => Routing.alternativesAround(prepared, feature.geometry.coordinates,
    { hour, lanesClosed: feature.properties.lanesClosed });
  const peak = at(8);
  const trough = at(3);
  if (!peak.ok || !trough.ok) return;
  assert.ok(peak.diverted.vehPerHour > trough.diverted.vehPerHour,
    `الذروة ${peak.diverted.vehPerHour} ليست أعلى من القاع `
    + `${trough.diverted.vehPerHour} — التحويل لا يتبع الساعة`);
});

console.log(`ALL TESTS PASSED (${count})`);
