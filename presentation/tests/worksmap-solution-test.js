'use strict';
/**
 * الحل على الخريطة — البطاقة والشريط.
 * ما يُختبر: أن الحل يظهر بأرقامه، وأن غيابه يُعلن بدل أن يُترك فراغاً، وأن
 * حصيلة المعروض تُحسب على ما يُعرض فعلاً لا على المحفظة كلها ولا مضاعفةً.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const Solution = require(path.join(ROOT, 'masar-worksmap-solution.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const SAMPLE = {
  id: 'p001',
  impactVehHours: 7025,
  bestVehHours: 1383,
  savedPct: 80.3,
  asIsWindow: '08:00–16:00 · 18 يوماً',
  bestWindow: '22:00–06:00 · 18 ليلة',
  bestReason: 'نافذة خارج الذروة (الطلب أقل بـ65%)',
};

/* ---- البطاقة ---- */

ok('البطاقة تعرض الطرفين والوفر والسبب', () => {
  const html = Solution.solutionHtml(SAMPLE);
  assert.ok(html.indexOf('كما قُدّم') !== -1);
  assert.ok(html.indexOf('الموصى به') !== -1);
  assert.ok(html.indexOf('7,025') !== -1, 'رقم المقدَّم غائب');
  assert.ok(html.indexOf('1,383') !== -1, 'رقم التوصية غائب');
  assert.ok(html.indexOf('وفر 80٪') !== -1, 'الوفر غائب');
  assert.ok(html.indexOf('نافذة خارج الذروة') !== -1, 'السبب غائب');
});

ok('النافذتان تظهران بنصهما القصير', () => {
  const html = Solution.solutionHtml(SAMPLE);
  assert.ok(html.indexOf('08:00–16:00') !== -1);
  assert.ok(html.indexOf('22:00–06:00') !== -1);
});

ok('وفر تافه يُعلن جدولاً أفضلَ متاحاً لا وفراً', () => {
  const html = Solution.solutionHtml(Object.assign({}, SAMPLE, {
    bestVehHours: 6900, savedPct: 1.8,
  }));
  assert.ok(html.indexOf('الأفضل المتاح') !== -1, 'الحالة غير معلنة');
  assert.ok(html.indexOf('وفر') === -1, 'وفر داخل خطأ النموذج معروض مكسباً');
});

ok('سجل بلا حقول توصية لا يكسر البطاقة', () => {
  assert.strictEqual(Solution.solutionHtml({ id: 'x' }), '');
  assert.strictEqual(Solution.solutionHtml(null), '');
});

ok('كل قيمة نصية مُرمَّزة — البيانات نص لا شيفرة', () => {
  const html = Solution.solutionHtml(Object.assign({}, SAMPLE, {
    bestReason: '<img src=x onerror=alert(1)>',
    bestWindow: '"><script>bad()</script>',
  }));
  assert.ok(html.indexOf('<img') === -1, 'وسم مُرِّر كما هو');
  assert.ok(html.indexOf('<script') === -1, 'سكربت مُرِّر كما هو');
  assert.ok(html.indexOf('&lt;img') !== -1, 'الترميز لم يقع');
});

ok('الوفر يُحسب عند غياب النسبة المكتوبة', () => {
  const solution = Solution.readSolution({ impactVehHours: 1000, bestVehHours: 250 });
  assert.ok(Math.abs(solution.savedPct - 75) < 0.001);
});

/* ---- الشريط ---- */

ok('الحصيلة تجمع الطرفين وتحسب النسبة', () => {
  const summary = Solution.summarize([
    { properties: { id: 'a', impactVehHours: 1000, bestVehHours: 200 } },
    { properties: { id: 'b', impactVehHours: 3000, bestVehHours: 800 } },
  ]);
  assert.strictEqual(summary.count, 2);
  assert.strictEqual(summary.asIsVehHours, 4000);
  assert.strictEqual(summary.bestVehHours, 1000);
  assert.strictEqual(summary.savedVehHours, 3000);
  assert.ok(Math.abs(summary.savedPct - 75) < 0.001);
});

ok('المرساة لا تُضاعف سجلها — الخط ونقطته سجل واحد', () => {
  // كل خط يولّد مرساة نقطية تحمل خصائصه؛ عدّ المجموعتين معاً يضاعف كل سجل خطّي.
  const record = { id: 'a', impactVehHours: 1000, bestVehHours: 200 };
  const summary = Solution.summarize([
    { geometry: { type: 'LineString' }, properties: record },
    { geometry: { type: 'Point' }, properties: record },
  ]);
  assert.strictEqual(summary.count, 1, 'السجل عُدّ مرتين');
  assert.strictEqual(summary.asIsVehHours, 1000);
});

ok('السجل بلا توصية لا يدخل الحصيلة ولا يفسدها', () => {
  const summary = Solution.summarize([
    { properties: { id: 'a', impactVehHours: 1000, bestVehHours: 200 } },
    { properties: { id: 'b' } },
    { properties: {} },
    null,
  ]);
  assert.strictEqual(summary.count, 1);
  assert.strictEqual(summary.asIsVehHours, 1000);
});

ok('حصيلة فارغة تُعلن ولا تعرض صفراً بلا معنى', () => {
  const html = Solution.barHtml(Solution.summarize([]));
  assert.ok(html.indexOf('لا سجل معروض') !== -1);
});

ok('الشريط يذكر الوفر والطرفين وعدد السجلات', () => {
  const html = Solution.barHtml(Solution.summarize([
    { properties: { id: 'a', impactVehHours: 1000, bestVehHours: 200 } },
  ]));
  assert.ok(html.indexOf('800') !== -1, 'الوفر غائب');
  assert.ok(html.indexOf('1,000') !== -1, 'المقدَّم غائب');
  assert.ok(html.indexOf('وفر 80٪') !== -1, 'النسبة غائبة');
  assert.ok(html.indexOf('1 سجلاً') !== -1, 'العدد غائب');
});

/* ---- على البيانات الحقيقية ---- */

ok('محفظة المدينة كلها تمرّ في الحصيلة بلا سجل ساقط', () => {
  const collection = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8')
  );
  const summary = Solution.summarize(collection.features);
  assert.strictEqual(summary.count, collection.features.length,
    `${summary.count} من ${collection.features.length} سجلاً حملت توصية`);
  assert.ok(summary.savedPct > 40 && summary.savedPct < 90,
    `وفر المحفظة ${summary.savedPct.toFixed(1)}٪ خارج النطاق`);
});

ok('كل سجل في المحفظة يعطي بطاقة غير فارغة', () => {
  const collection = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8')
  );
  collection.features.forEach((feature) => {
    const html = Solution.solutionHtml(feature.properties);
    assert.ok(html.length > 0, `${feature.properties.id}: بطاقة بلا كتلة حل`);
  });
});

/* ---- الوصل: الحل موصول بالسطح لا مبنيّ بجانبه ---- */

const mapPage = fs.readFileSync(path.join(ROOT, 'masar-map.html'), 'utf8');

ok('صفحة الخريطة تحمّل وحدة الحل قبل التفاعل', () => {
  const solutionAt = mapPage.indexOf('masar-worksmap-solution.js');
  const interactionsAt = mapPage.indexOf('masar-worksmap-interactions.js');
  assert.ok(solutionAt !== -1, 'الوحدة غير محمَّلة');
  assert.ok(solutionAt < interactionsAt, 'التفاعل يُحمَّل قبل الوحدة التي يقرؤها');
});

ok('الشريط موجود ويُحدَّث مع كل تغيّر في المعروض', () => {
  assert.ok(mapPage.indexOf('id="wmHero"') !== -1, 'لا شريط في الصفحة');
  // التحديث داخل refresh() نفسها: أي مسار آخر يترك الرقم متخلفاً عن الخريطة.
  const refreshAt = mapPage.indexOf('function refresh()');
  const heroAt = mapPage.indexOf('MasarWorksMapSolution.barHtml');
  assert.ok(refreshAt !== -1 && heroAt > refreshAt, 'الشريط يُحدَّث خارج دورة العرض');
});

ok('الشريط منطقةُ حالة معلنة — تغيّره يُنطق لا يمرّ صامتاً', () => {
  const tag = mapPage.slice(mapPage.indexOf('id="wmHero"') - 60, mapPage.indexOf('id="wmHero"') + 80);
  assert.ok(tag.indexOf('aria-live') !== -1, 'لا إعلان لتغيّر الرقم');
});

ok('البطاقة تستدعي كتلة الحل', () => {
  const interactions = fs.readFileSync(path.join(ROOT, 'masar-worksmap-interactions.js'), 'utf8');
  assert.ok(interactions.indexOf('Solution.solutionHtml') !== -1, 'البطاقة بلا كتلة حل');
});

ok('التطبيع ينقل حقول التوصية — بلاها تصل البطاقة فارغة', () => {
  const Data = require(path.join(ROOT, 'masar-worksmap-data.js'));
  const source = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8')
  );
  const canonical = Data.normalizeWorks(source).features[0].properties;
  ['impactVehHours', 'bestVehHours', 'savedPct', 'asIsWindow', 'bestWindow', 'bestReason']
    .forEach((key) => assert.ok(canonical[key] !== undefined && canonical[key] !== '',
      `التطبيع أسقط ${key}`));
  assert.ok(Solution.solutionHtml(canonical).indexOf('الحل الموصى به') !== -1,
    'البطاقة بعد التطبيع بلا حل');
});

/* ---- رسم المسارات: الأفضلية تُقرأ من الشكل ---- */

const routeLayers = Solution.buildRouteLayers('routes');
const layerAt = (id) => routeLayers.find((layer) => layer.id === id);
const widthAt = (layer, zoom) => {
  const stops = layer.paint['line-width'].slice(3);
  for (let i = 0; i + 3 < stops.length; i += 2) {
    if (zoom >= stops[i] && zoom <= stops[i + 2]) return stops[i + 1];
  }
  return stops[1];
};

ok('طبقة لكل رتبة — طبقةٌ واحدة تعني سماكةً وعتامةً واحدة', () => {
  ['second', 'first', 'closed'].forEach((kind) => {
    assert.ok(layerAt('route-' + kind), `لا طبقة لـ ${kind}`);
    assert.ok(layerAt('route-' + kind + '-casing'), `لا حاشية لـ ${kind}`);
    assert.deepStrictEqual(layerAt('route-' + kind).filter, ['==', ['get', 'kind'], kind]);
  });
});

ok('الترتيب من الأدنى أفضليةً إلى الأعلى — الموصى به فوق المطروح', () => {
  const order = routeLayers.map((layer) => layer.id);
  assert.ok(order.indexOf('route-second') < order.indexOf('route-first'), 'المطروح فوق الموصى به');
  assert.ok(order.indexOf('route-first') < order.indexOf('route-closed'), 'المغلق تحت البديل');
});

ok('الموصى به أعرض وأصمت من المطروح، ومختلفٌ عنه لوناً', () => {
  const first = layerAt('route-first');
  const second = layerAt('route-second');
  assert.ok(widthAt(first, 13) > widthAt(second, 13), 'المطروح ليس أرفع');
  assert.ok(first.paint['line-opacity'] > second.paint['line-opacity'], 'المطروح ليس أشفّ');
  /**
   * الأفضلية تُحمل باللون أولاً لا بالشفافية.
   * خفضُ العتامة إلى النصف يجعل المطروح يتلوّن بما تحته — يمرّ فوق مبنى فيخضرّ
   * وفوق طريق فيرمدّ، فيُقرأ وسخاً لا خياراً. والاصطلاح في عارضات الملاحة
   * لونان مختلفان بعتامةٍ عالية: أزرقُ الموصى به ورماديُّ المطروح.
   */
  assert.notStrictEqual(first.paint['line-color'], second.paint['line-color'],
    'الرتبتان بلون واحد — الفرق شفافية وحدها');
  assert.ok(second.paint['line-opacity'] >= 0.6, 'المطروح شفّافٌ فيتلوّن بما تحته');
});

ok('السماكة تحت نصف ما كان — الخط لا يبتلع الشبكة تحته', () => {
  // كان 12 بكسلاً عند z18 فبدا المسار لطخةً لا طريقاً.
  routeLayers.filter((layer) => /^route-(first|second|closed)$/.test(layer.id))
    .forEach((layer) => {
      assert.ok(widthAt(layer, 16) <= 7, `${layer.id}: ${widthAt(layer, 16)} بكسل عند z16`);
    });
});

ok('كل مسار مصمت اللون — لا تدرّج يجعله شريط دهان', () => {
  ['first', 'second', 'closed'].forEach((kind) => {
    const paint = layerAt('route-' + kind).paint;
    assert.ok(paint['line-color'], `${kind}: بلا لون`);
    assert.ok(!paint['line-gradient'], `${kind}: تدرّجٌ يُميّع الطرفين`);
  });
});

ok('المغلق يختلف بالنمط لا باللون وحده', () => {
  const closed = layerAt('route-closed').paint;
  assert.ok(Array.isArray(closed['line-dasharray']), 'المغلق مصمت — عمى الألوان لا يقرأه');
  ['first', 'second'].forEach((kind) => {
    assert.ok(!layerAt('route-' + kind).paint['line-dasharray'],
      `${kind}: مشروطٌ فيلتبس بالمغلق`);
  });
});

ok('الانعطافات ناعمة — لا شوكة عند الزاوية الحادة', () => {
  ['first', 'second', 'closed'].forEach((kind) => {
    assert.strictEqual(layerAt('route-' + kind).layout['line-join'], 'round',
      `${kind}: وصلٌ حادّ`);
  });
});

ok('طرفا التحويلة معلَّمان — «اخرج هنا» و«عُد هنا»', () => {
  const ends = layerAt('route-ends');
  assert.ok(ends, 'لا طبقة لطرفي التحويلة');
  assert.strictEqual(ends.type, 'circle');
  assert.deepStrictEqual(ends.filter, ['==', ['get', 'kind'], 'end']);
  const labels = layerAt('route-ends-labels');
  assert.ok(labels, 'الطرفان بلا نص — نقطتان لا تقولان اخرج وعُد');
  assert.deepStrictEqual(labels.layout['text-field'], ['get', 'label']);

  // والمجموعة تُنتجهما فعلاً من هندسة الموصى به.
  const collection = Solution.routeCollection(
    {
      ok: true,
      banned: {},
      baseline: { states: [], edges: [] },
      alternatives: [{ states: [0, 1], addedMinutes: 4 }],
    },
    () => [[46.7, 24.7], [46.71, 24.71], [46.72, 24.72]]
  );
  const points = collection.features.filter((f) => f.properties.kind === 'end');
  assert.strictEqual(points.length, 2, 'الطرفان غير مرسومين');
  assert.deepStrictEqual(points.map((f) => f.properties.role), ['exit', 'rejoin']);
  assert.deepStrictEqual(points[0].geometry.coordinates, [46.7, 24.7]);
  assert.deepStrictEqual(points[1].geometry.coordinates, [46.72, 24.72]);
});

ok('الوسم نقطةٌ واحدة لا وسمٌ لكل بلاطة', () => {
  const labels = layerAt('route-labels');
  assert.ok(!labels.layout['symbol-placement'], '`line-center` يكرّر الوسم لكل بلاطة');
  assert.ok(labels.layout['text-offset'][1] < 0, 'الوسم على الخط لا فوقه');
  assert.strictEqual(labels.layout['text-allow-overlap'], true);
  assert.ok(labels.paint['text-halo-width'] >= 2, 'هالة رفيعة — النص على خط ملوّن');
  assert.deepStrictEqual(labels.filter, ['==', ['get', 'kind'], 'tag']);

  const collection = Solution.routeCollection(
    {
      ok: true,
      banned: {},
      baseline: { states: [], edges: [] },
      alternatives: [
        { states: [0, 1], addedMinutes: 4 },
        { states: [2, 3], addedMinutes: 9 },
      ],
    },
    () => [[46.7, 24.7], [46.71, 24.71], [46.72, 24.72]]
  );
  const tags = collection.features.filter((f) => f.properties.kind === 'tag');
  assert.strictEqual(tags.length, 1, 'أكثر من وسم — الرقم يتكرّر على الخريطة');
  assert.strictEqual(tags[0].geometry.type, 'Point');
  assert.strictEqual(tags[0].properties.addedMinutes, 4, 'الوسم يحمل زمن غير الموصى به');
});

ok('حاشية المغلق مشروطة كخطها — المصمتة تملأ الفجوات', () => {
  const line = layerAt('route-closed').paint['line-dasharray'];
  const casing = layerAt('route-closed-casing').paint['line-dasharray'];
  assert.ok(Array.isArray(casing), 'الحاشية مصمتة فيُقرأ المغلق مصمتاً');
  const width = Solution.ROUTE_RANK.closed.width;
  // طول الشرطة بالبكسل = المعامل × العرض؛ يجب أن يتطابق عند الخط وحاشيته.
  [1, 3, 5, 7].forEach((i) => {
    const w = width[i];
    const wc = w + Solution.CASING_EXTRA[(i - 1) / 2];
    assert.ok(Math.abs(line[0] * w - casing[0] * wc) <= 0.8,
      `عند عرض ${w}: شرطة الخط ${(line[0] * w).toFixed(1)} والحاشية ${(casing[0] * wc).toFixed(1)}`);
  });
});

ok('كل خط تحته حاشية أعرض منه', () => {
  ['second', 'first', 'closed'].forEach((kind) => {
    assert.ok(widthAt(layerAt('route-' + kind + '-casing'), 13)
      > widthAt(layerAt('route-' + kind), 13), `${kind}: حاشية أضيق من خطها`);
  });
});

ok('الحاشية أغمق من خطها لا بيضاء — البياض هالةٌ تجعله ملصقاً', () => {
  ['second', 'first', 'closed'].forEach((kind) => {
    const casing = layerAt('route-' + kind + '-casing').paint['line-color'];
    assert.notStrictEqual(String(casing).toUpperCase(), '#FFFFFF', `${kind}: حاشية بيضاء`);
    assert.strictEqual(casing, Solution.ROUTE_CASING_COLORS[kind]);
  });
});

console.log(`\n${passed} اختبارات نجحت`);
