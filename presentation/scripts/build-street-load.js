'use strict';
/**
 * مسار — بناء مِنسَب: منسوب الحِمل على مقاطع المحفظة.
 * ---------------------------------------------------------------------------
 * **ما يفعله.** يجمع أربعة مدخلات، كلُّها من داخل المستودع وبلا شبكة، ويمرّرها
 * على نموذج `masar-street-load.js` فيخرج لكل تصريح منسوبٌ نسبيّ ومدىً مطلق.
 *
 *   ١) **السعة** — عدد الحارات من وسوم OSM في رسم التوجيه × سعة الحارة
 *      (١٨٠٠ مركبة/ساعة/حارة، من `masar-engine.js`).
 *   ٢) **المركزية البنيوية** — حصة المسارات المحسوبة التي تعبر المقطع، من
 *      عيّنة أزواج مبدأ/مقصد على رسم `riyadh-route-graph.js` بموجِّه
 *      `masar-city-routing.js` نفسه.
 *   ٣) **قرب الطلب** — كثافة المباني حول المقطع من `buildings-index.json`.
 *   ٤) **صنف الطريق** — من وسوم OSM.
 *
 * **ولماذا العيّنة لا الحساب الكامل.** المركزية البَينيّة التامة على رسمٍ فيه
 * ١٧٤ ألف ضلع تعني مسارات أقصر من كل عقدة إلى كل عقدة — أي مئات الملايين من
 * عمليات البحث. والعيّنة المعلنة تعطي التقدير نفسه بخطأ معلوم الاتجاه، ولذلك
 * تُنشر بذرتها وحجمها وتوزيعها، ويُقاس أثر التوزيع بمقارنة نطاقات طول الرحلة
 * بعضها ببعض في مخرَج الحساسية.
 *
 * **وما لا يفعله.** لا يبدّل `aadt` ولا يقترب من `masar-engine.js`. تقرير الظلّ
 * (`docs/STREET-LOAD-SHADOW.md`) يصف ما كان سيتغيّر؛ التغيير نفسه قرارٌ إنسانيّ.
 *
 * التشغيل: node presentation/scripts/build-street-load.js
 * بيانات الطرق والمباني © مساهمو OpenStreetMap — رخصة ODbL.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
global.window = global;

const Engine = require(path.join(ROOT, 'masar-engine.js'));
const Portfolio = require(path.join(ROOT, 'masar-portfolio.js'));
const Model = require(path.join(ROOT, 'masar-street-load.js'));
const Evidence = require(path.join(ROOT, 'masar-route-evidence.js'));

const OUT_JSON = path.join(DATA, 'street-load.json');
const OUT_JS = path.join(DATA, 'street-load.js');

/** الساعة المرجعية — الثامنة، نفسها التي يستعملها `build-alternate-load.js`. */
const REFERENCE_HOUR = 8;

/**
 * حجم العيّنة وبذرتها.
 * ---------------------------------------------------------------------------
 * البذرة بذرة المحفظة نفسها: الناتج قابل لإعادة الإنتاج حرفياً، ولا يتحرّك رقمٌ
 * منشور بين تشغيلين بلا تغيير في المدخلات.
 *
 * والحجم موازنةٌ معلنة: ألفٌ وخمسمئة مسار تستغرق دقائق، وتعطي لكل مقطع من
 * مقاطع المحفظة عدّاً يُعتدّ به. ورفعه يضيّق ضجيج العيّنة ولا يغيّر بنية
 * النتيجة — وهذا يُقاس ولا يُدّعى: مخرَج `sampleStability` يقارن نصف العيّنة
 * بنصفها الآخر.
 */
const ROUTE_SAMPLE = 1500;
const SAMPLE_SEED = Portfolio.SEED;

/**
 * توزيع أطوال الرحلة في العيّنة — **افتراض معلن**، وهذا موضعه الوحيد.
 * ---------------------------------------------------------------------------
 * أزواجٌ منتقاة بانتظام تام من عقد الرسم تعطي رحلاتٍ طويلة في غالبها، لأن
 * عقدتين عشوائيتين في مدينة بحجم الرياض تبعدان عادةً عشرات الكيلومترات. وذلك
 * يحابي الطرق السريعة والدوائر ويُخفي شرايين الداخل.
 *
 * فالتوزيع هنا يخلط ثلاثة نطاقات بحصص معلنة. والحصص **ليست مأخوذة من مسح
 * رحلات** — لا مسح رحلات للرياض في متناولنا. ولذلك لا يُكتفى بإعلانها: تُحسب
 * المركزية لكل نطاق على حدة، وتُنشر معاملات ارتباط الرتب بين النطاقات في
 * `sensitivity.tripMix`. فإن كان الترتيب واحداً في النطاقات الثلاثة فالنتيجة لا
 * تعتمد على هذا الافتراض أصلاً، وإن اختلف فالقارئ يعرف بكم.
 */
const TRIP_MIX = [
  { key: 'short', minKm: 0.5, maxKm: 3, share: 0.40,
    why: 'الرحلة القصيرة داخل الحيّ وبين الأحياء المتجاورة — وهي التي تكشف '
      + 'الشرايين الداخلية التي تُخفيها الرحلات الطويلة.' },
  { key: 'medium', minKm: 3, maxKm: 8, share: 0.35,
    why: 'الرحلة المتوسطة عبر المدينة — البيت إلى العمل في الغالب.' },
  { key: 'long', minKm: 8, maxKm: 60, share: 0.25,
    why: 'الرحلة الطويلة من طرف إلى طرف — تحمّل الدوائر والطرق السريعة.' },
];

/** محاولات انتقاء زوجٍ داخل نطاق الطول قبل التسليم بتعذّره. */
const PAIR_TRIES = 400;

const METRES_PER_DEGREE = 111320;
const RIYADH_LAT = 24.71;
const LON_SCALE = Math.cos((RIYADH_LAT * Math.PI) / 180);

/**
 * جوار المباني: مربّع ثلاثة في ثلاثة حول مربّع المنتصف.
 * ---------------------------------------------------------------------------
 * المربّع الواحد ضلعه نحو ١٫٣ كم، ومقطع التصريح ٤٠٠ متراً إلى ١٫٦ كم — فمربّعٌ
 * واحد يقتطع الطلب عند حدٍّ لا يعرفه المقطع. والجوار يوسّعه إلى نحو أربعة
 * كيلومترات في كل اتجاه، وهي مسافة مشي ورحلة قصيرة معاً.
 *
 * والمقام مساحةُ المربّعات **الحاضرة** وحدها: مربّعٌ غائب عن الفهرس لا يُحسب
 * صفراً في البسط ولا في المقام. وإن غاب مربّع المنتصف نفسه فالمدخل كله يخرج
 * `null` — والنموذج يُسقطه ويعيد قسمة الأوزان.
 */
const BUILDING_NEIGHBOURHOOD = 1;

/** ترجمة وسم OSM إلى صنف مسار — نفس جدول `build-city-portfolio.js`. */
const CLASS_BY_OSM = {
  motorway: 'arterial', motorway_link: 'arterial',
  trunk: 'arterial', trunk_link: 'arterial',
  primary: 'arterial', primary_link: 'arterial',
  secondary: 'major', secondary_link: 'major',
  tertiary: 'local', tertiary_link: 'local',
  unclassified: 'local', residential: 'local', living_street: 'local',
};

/* ------------------------------------------------------------------ أدوات */

function median(list) {
  if (!list.length) return null;
  const sorted = list.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

/** رتبٌ بمتوسط المتعادلين — لازمة لارتباط سبيرمان على مدخلٍ فيه تعادل كثير. */
function averageRanks(values) {
  const order = values.map((value, at) => ({ value, at }))
    .sort((a, b) => a.value - b.value);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j += 1;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[order[k].at] = rank;
    i = j + 1;
  }
  return ranks;
}

/** ارتباط رتب سبيرمان، محسوباً بمعامل بيرسون على الرتب — يحتمل التعادل. */
function spearman(a, b) {
  if (a.length !== b.length || a.length < 2) return null;
  const ra = averageRanks(a);
  const rb = averageRanks(b);
  const n = ra.length;
  const meanA = ra.reduce((sum, one) => sum + one, 0) / n;
  const meanB = rb.reduce((sum, one) => sum + one, 0) / n;
  let cov = 0; let varA = 0; let varB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = ra[i] - meanA;
    const db = rb[i] - meanB;
    cov += da * db; varA += da * da; varB += db * db;
  }
  if (varA <= 0 || varB <= 0) return null;
  return round3(cov / Math.sqrt(varA * varB));
}

/* ------------------------------------------------- ١) عيّنة المسارات */

/**
 * ينتقي زوج عقدتين داخل نطاق طولٍ معطى ويوجّه بينهما.
 * الأزواج تُنتقى من المكوّن الرئيس وحده: عقدةٌ خارجه تعطي «لا مسار» بلا سبب
 * مفهوم، فتُفسد العيّنة بأصفارٍ ليست عن الشبكة.
 */
function sampleRoutes(Routing, prepared, mainNodes, rand) {
  const graph = prepared.graph;
  const routes = [];
  const perBand = {};
  TRIP_MIX.forEach((band) => { perBand[band.key] = []; });
  let failed = 0;

  const kmBetween = (a, b) => Routing.metresBetween(graph.nodes[a], graph.nodes[b]) / 1000;

  TRIP_MIX.forEach((band) => {
    const want = Math.round(ROUTE_SAMPLE * band.share);
    for (let i = 0; i < want; i += 1) {
      let from = -1; let to = -1; let tries = 0;
      do {
        from = mainNodes[Math.floor(rand() * mainNodes.length)];
        to = mainNodes[Math.floor(rand() * mainNodes.length)];
        tries += 1;
      } while (tries < PAIR_TRIES
        && (from === to
          || kmBetween(from, to) < band.minKm
          || kmBetween(from, to) > band.maxKm));

      const route = Routing.shortestPath(prepared, from, to, { hour: REFERENCE_HOUR });
      if (!route || !route.edges || !route.edges.length) { failed += 1; continue; }
      const record = { band: band.key, edges: route.edges };
      routes.push(record);
      perBand[band.key].push(record);
    }
  });

  return { routes, perBand, failed };
}

/** عدد المسارات في مجموعةٍ تعبر ضلعاً واحداً على الأقل من أضلاع المقطع. */
function routesThrough(routeList, edgeSet) {
  let hits = 0;
  for (let i = 0; i < routeList.length; i += 1) {
    const edges = routeList[i].edges;
    for (let j = 0; j < edges.length; j += 1) {
      if (edgeSet[edges[j]]) { hits += 1; break; }
    }
  }
  return hits;
}

/* ------------------------------------------------- ٢) المباني حول المقطع */

function buildingDensity(index, point) {
  const col = Math.floor((point[0] - index.origin[0]) / index.cell);
  const row = Math.floor((point[1] - index.origin[1]) / index.cell);
  if (col < 0 || col >= index.cols || row < 0 || row >= index.rows) return null;
  if (index.tiles[`${col}-${row}`] === undefined) return null;

  const latKm = index.cell * (METRES_PER_DEGREE / 1000);
  const lonKm = index.cell * (METRES_PER_DEGREE / 1000) * LON_SCALE;
  const tileAreaKm2 = latKm * lonKm;

  let buildings = 0;
  let tiles = 0;
  for (let c = col - BUILDING_NEIGHBOURHOOD; c <= col + BUILDING_NEIGHBOURHOOD; c += 1) {
    for (let r = row - BUILDING_NEIGHBOURHOOD; r <= row + BUILDING_NEIGHBOURHOOD; r += 1) {
      if (c < 0 || c >= index.cols || r < 0 || r >= index.rows) continue;
      const count = index.tiles[`${c}-${r}`];
      if (count === undefined) continue;
      buildings += count;
      tiles += 1;
    }
  }
  if (!tiles) return null;
  return {
    perKm2: Math.round(buildings / (tiles * tileAreaKm2)),
    buildings,
    tiles,
    areaKm2: round2(tiles * tileAreaKm2),
  };
}

/* ------------------------------------------------- ٣) صفة المقطع من الرسم */

/**
 * صفة المقطع من أضلاعه: عدد الحارات وصنف الطريق واسمه.
 * الحارات **أعلى قيمة** لا متوسطها: التصريح يُغلق حارات من المقطع الأعرض في
 * امتداده، ومتوسطٌ يجرّه فرعٌ قصير يُنقص السعة عن الواقع. والصنف بأطول حصة من
 * الطول، فمقطعٌ يمسّ شارعاً سكنياً في طرفه لا يصير سكنياً.
 */
function segmentTraits(graph, edgeSet) {
  const lengthByClass = {};
  const lengthByName = {};
  let lanes = 0;
  let lengthM = 0;
  let edges = 0;

  Object.keys(edgeSet).forEach((key) => {
    const edge = graph.edges[Number(key)];
    if (!edge) return;
    edges += 1;
    lengthM += edge[2];
    if (edge[4] > lanes) lanes = edge[4];
    const profile = graph.metadata.classes[edge[6]];
    const roadClass = profile ? CLASS_BY_OSM[profile.name] : null;
    if (roadClass) lengthByClass[roadClass] = (lengthByClass[roadClass] || 0) + edge[2];
    const name = graph.names[edge[9]];
    if (name) lengthByName[name] = (lengthByName[name] || 0) + edge[2];
  });

  const pick = (table) => Object.keys(table)
    .sort((a, b) => table[b] - table[a])[0] || null;

  return {
    edges,
    lengthM: Math.round(lengthM),
    lanes: lanes || null,
    roadClass: pick(lengthByClass),
    dominantName: pick(lengthByName),
  };
}

/* ------------------------------------------------- ٤) الحساسية وخطّ الأساس */

/** يعيد ترتيباً من قيم، بحيث ١ هو الأثقل. */
function rankOf(values) {
  const order = values.map((value, at) => ({ value, at }))
    .sort((a, b) => b.value - a.value);
  const ranks = new Array(values.length);
  order.forEach((entry, at) => { ranks[entry.at] = at + 1; });
  return ranks;
}

/**
 * حساسية النتيجة للأوزان.
 * ---------------------------------------------------------------------------
 * ثلاث عائلات من البدائل، كلٌّ منها يجيب سؤالاً مختلفاً:
 *   · **رفع وخفض كل وزن بالنصف** — كم يتحرّك الترتيب إن كان حكمي على أهمية
 *     مدخلٍ بعينه خاطئاً بمقدار النصف؟
 *   · **أوزان متساوية** — هل الترتيب من البيانات أم من ترجيحي لها؟
 *   · **حذف كل مدخل بدوره** — أيّ مدخلٍ يحمل النتيجة وحده؟ إن أعطى الحذفُ
 *     الترتيبَ نفسه فذلك المدخل زينة.
 *
 * والمقياس المنشور ليس معامل الارتباط وحده: **عدد الشوارع التي تتحرّك أكثر من
 * عشر مراتب** أصدق، لأن ارتباطاً ٠٫٩٨ قد يخفي انقلاب رأس الترتيب — وهو موضع
 * القرار.
 */
const BIG_MOVE = 10;

function sensitivityOf(rows) {
  const base = rows.map((row) => row.loadIndex);
  const baseRanks = rankOf(base);

  const variantOf = (weights) => rows.map((row) => {
    const combined = Model.combine(row.normalized, weights);
    return combined.loadIndex === null ? -1 : combined.loadIndex;
  });

  const compare = (label, why, weights) => {
    const values = variantOf(weights);
    const ranks = rankOf(values);
    let moved = 0;
    let worst = 0;
    for (let i = 0; i < ranks.length; i += 1) {
      const shift = Math.abs(ranks[i] - baseRanks[i]);
      if (shift > BIG_MOVE) moved += 1;
      if (shift > worst) worst = shift;
    }
    /* رأس الترتيب وحده: من دخل العشرة الأوائل ومن خرج منهم. */
    const topBase = baseRanks.map((rank, at) => ({ rank, at }))
      .filter((one) => one.rank <= 10).map((one) => one.at);
    const topNow = ranks.map((rank, at) => ({ rank, at }))
      .filter((one) => one.rank <= 10).map((one) => one.at);
    const kept = topBase.filter((at) => topNow.indexOf(at) !== -1).length;
    return {
      label,
      why,
      weights: weights.map((one) => ({ key: one.key, weight: round2(one.weight) })),
      spearman: spearman(base, values),
      movedMoreThan: BIG_MOVE,
      moved,
      movedPct: round2((100 * moved) / rows.length),
      worstShift: worst,
      topTenKept: kept,
    };
  };

  const scaled = (key, factor) => Model.WEIGHTS.map((one) => ({
    key: one.key,
    weight: one.key === key ? one.weight * factor : one.weight,
  }));
  const dropped = (key) => Model.WEIGHTS
    .filter((one) => one.key !== key)
    .map((one) => ({ key: one.key, weight: one.weight }));
  const equal = Model.WEIGHTS.map((one) => ({ key: one.key, weight: 1 / Model.WEIGHTS.length }));

  const variants = [compare('أوزان متساوية',
    'هل الترتيب من البيانات أم من ترجيحي لها؟', equal)];

  Model.WEIGHTS.forEach((one) => {
    variants.push(compare(one.label + ' ×1.5',
      'وزن «' + one.label + '» أعلى بالنصف مما أعلنّاه.', scaled(one.key, 1.5)));
    variants.push(compare(one.label + ' ×0.5',
      'وزن «' + one.label + '» أدنى بالنصف مما أعلنّاه.', scaled(one.key, 0.5)));
    variants.push(compare('بلا «' + one.label + '»',
      'حذف المدخل كلياً — إن لم يتحرّك الترتيب فالمدخل زينة.', dropped(one.key)));
  });

  return variants;
}

/**
 * المقارنة بخطّ الأساس الساذج: «صنف الطريق وحده».
 * ---------------------------------------------------------------------------
 * السؤال ليس «هل يتفق مِنسَب مع الصنف» — لا بدّ أن يتفق، فالصنف أحد مدخلاته
 * بوزن ١٥٪. السؤال: **هل يضيف شيئاً؟** وثلاثة أرقام تجيب:
 *
 *   · `varianceExplainedByClass` — كم من تشتّت مِنسَب يفسّره الصنف وحده. قربُه
 *     من الواحد يعني أن مِنسَب هو الصنف بأسماء أخرى، والنتيجة السلبية تُكتب.
 *   · `pairsClassCannotOrder` — حصة الأزواج المتعادلة عند خطّ الأساس (شارعان
 *     من صنفٍ واحد)، وهي بالضبط ما يفصله مِنسَب ولا يفصله الصنف.
 *   · `classInversions` — أزواجٌ يرفع فيها مِنسَب الأدنى صنفاً فوق الأعلى. هنا
 *     يختلف الاثنان فعلاً، ولا معنى للمؤشّر بلا ذلك: مؤشّرٌ لا يخالف خطّ أساسه
 *     أبداً ليس إلا خطّ الأساس.
 */
function baselineComparison(rows) {
  const withClass = rows.filter((row) => Model.classScore(row.roadClass) !== null);
  const index = withClass.map((row) => row.loadIndex);
  const classOnly = withClass.map((row) => Model.classScore(row.roadClass));

  const grand = index.reduce((sum, one) => sum + one, 0) / index.length;
  const totalVar = index.reduce((sum, one) => sum + (one - grand) * (one - grand), 0);
  const byClass = {};
  withClass.forEach((row) => {
    if (!byClass[row.roadClass]) byClass[row.roadClass] = [];
    byClass[row.roadClass].push(row.loadIndex);
  });
  let betweenVar = 0;
  Object.keys(byClass).forEach((key) => {
    const list = byClass[key];
    const mean = list.reduce((sum, one) => sum + one, 0) / list.length;
    betweenVar += list.length * (mean - grand) * (mean - grand);
  });

  let tiedPairs = 0;
  let inversions = 0;
  let totalPairs = 0;
  for (let i = 0; i < withClass.length; i += 1) {
    for (let j = i + 1; j < withClass.length; j += 1) {
      totalPairs += 1;
      const classGap = classOnly[i] - classOnly[j];
      if (classGap === 0) { tiedPairs += 1; continue; }
      const indexGap = index[i] - index[j];
      if (classGap * indexGap < 0) inversions += 1;
    }
  }

  const perClass = {};
  Object.keys(byClass).forEach((key) => {
    const list = byClass[key].slice().sort((a, b) => a - b);
    perClass[key] = {
      count: list.length,
      lowest: round3(list[0]),
      median: round3(median(list)),
      highest: round3(list[list.length - 1]),
      spread: round3(list[list.length - 1] - list[0]),
    };
  });

  return {
    note: 'خطّ الأساس الساذج: ترتيب الشوارع بصنف الطريق وحده — شرياني فوق '
      + 'رئيسي فوق فرعي، وداخل الصنف تعادلٌ تام.',
    segments: withClass.length,
    spearmanWithClassOnly: spearman(index, classOnly),
    varianceExplainedByClass: totalVar > 0 ? round3(betweenVar / totalVar) : null,
    pairsTotal: totalPairs,
    pairsClassCannotOrder: tiedPairs,
    pairsClassCannotOrderPct: round2((100 * tiedPairs) / totalPairs),
    classInversions: inversions,
    classInversionsPct: round2((100 * inversions) / Math.max(1, totalPairs - tiedPairs)),
    perClass,
  };
}

/**
 * فحص معقولية على مرساة وزارة النقل — حدٌّ سفلي لا معايرة.
 * ---------------------------------------------------------------------------
 * محطات العدّ الاثنتان والثلاثون على طرق مرقَّمة بين المدن بدقّة سنوية، ولا
 * واحدة منها على شارع من شوارع المحفظة. فلا تصلح لضبط قيمة، وتصلح لسؤال واحد:
 * **هل مدياتنا في مرتبةٍ معقولة؟** شريانٌ حضري في الرياض يجب أن يعلو أعلى محطة
 * على طريقٍ صحراوي؛ ولو خرجت مدياتنا كلها تحتها لكان في النموذج خلل ظاهر.
 *
 * التحويل من يومي إلى ساعة الذروة بأعلى قيمة في `HOURLY_PROFILE` — وهو ملمح
 * افتراضي معلن في المحرك، فالمقارنة تقريبية بحدود مرتبتها لا أكثر.
 */
function reasonablenessAnchor(rows) {
  const snapshot = JSON.parse(fs.readFileSync(
    path.join(DATA, 'mot-count-stations.json'), 'utf8'));
  const peakShare = Math.max.apply(null, Engine.HOURLY_PROFILE);
  const stationPeaks = snapshot.rows.map((one) => Math.round(one.dailyTotal * peakShare));
  const highestStation = Math.max.apply(null, stationPeaks);

  const bands = rows.filter((row) => row.vphBand).map((row) => row.vphBand);
  const lowestBandLow = Math.min.apply(null, bands.map((one) => one.low));
  const highestBandHigh = Math.max.apply(null, bands.map((one) => one.high));
  const belowStation = bands.filter((one) => one.high < highestStation).length;

  return {
    role: 'حدّ سفلي للمعقولية — لا معايرة. السبب مكتوب في '
      + 'presentation/data/mot-count-stations.json.',
    source: snapshot.source.portal,
    stations: snapshot.rows.length,
    peakShareUsed: peakShare,
    peakShareNote: 'أعلى قيمة في HOURLY_PROFILE داخل masar-engine.js — ملمح '
      + 'افتراضي معلن، فالتحويل تقريبيّ بحدود المرتبة.',
    highestStationPeakVph: highestStation,
    lowestPortfolioBandLow: lowestBandLow,
    highestPortfolioBandHigh: highestBandHigh,
    segmentsWholeBandBelowHighestStation: belowStation,
    verdict: highestBandHigh > highestStation
      ? 'مدياتنا العليا تعلو أعلى محطة عدّ على طريق بين المدن — وهذا هو '
        + 'المتوقَّع لشريان حضري، ولا يزيد عليه.'
      : 'كل مدياتنا دون أعلى محطة عدّ بين المدن — إشارةُ خللٍ تستوجب مراجعة '
        + 'السعة أو نسبة الإشغال المفترضة.',
    doesNotProve: 'لا يثبت قيمة أي مدى. المحطة على طريقٍ آخر وبدقّةٍ أخرى، '
      + 'والمقارنة تقول «في مرتبةٍ معقولة» ولا تقول أكثر.',
  };
}

/**
 * استقرار العيّنة: نصفها الأول مقابل نصفها الثاني.
 * إن اختلف الترتيبان فالعدد قليل والمؤشّر يقرأ ضجيج العيّنة لا الشبكة.
 */
function sampleStability(rows) {
  const first = rows.map((row) => row.split.firstHalf);
  const second = rows.map((row) => row.split.secondHalf);
  const rho = spearman(first, second);
  return {
    note: 'المركزية محسوبة مرّتين على نصفَي العيّنة المستقلّين، والمقارنة '
      + 'بينهما تقيس ضجيج العيّنة لا الشبكة.',
    spearmanHalfVsHalf: rho,
    /* الرقم يُفسَّر هنا لا يُترك للقارئ: نصفان يتفقان تماماً يعنيان أن العيّنة
       أكبر من حاجتها، ونصفان يختلفان يعنيان أن الترتيب الدقيق ضجيج. والمنطقة
       بينهما هي الحال المعتاد، وحكمها: الشرائح تُقرأ والرتب الفردية لا. */
    reading: rho === null ? 'غير محسوب'
      : rho >= 0.9 ? 'الترتيب مستقرّ — الرتبة الفردية تُقرأ.'
        : rho >= 0.6 ? 'الترتيب مستقرّ في شرائحه ومهتزّ في رتبه الفردية. '
          + 'فتُقرأ الشريحة («من أثقل 10٪») ولا تُقرأ الرتبة («الثالث عشر») '
          + 'فرقاً ذا معنى عن جارتها.'
          : 'الترتيب غير مستقرّ — العيّنة أصغر من أن تحمل ترتيباً، '
            + 'ورفع حجمها شرطٌ قبل قراءة أي رتبة.',
  };
}

/* ------------------------------------------------------------------ البناء */

function main() {
  require(path.join(DATA, 'riyadh-route-graph.js'));
  const Routing = require(path.join(ROOT, 'masar-city-routing.js'));
  const graph = global.RIYADH_ROUTE_GRAPH;
  if (!graph) throw new Error('رسم التوجيه غير محمَّل');
  if (!graph.metadata || !graph.metadata.classes) {
    throw new Error('جدول الأصناف غائب عن الرسم — لا صنف طريق بلا مصدر');
  }

  const prepared = Routing.prepare(graph);
  const portfolio = JSON.parse(fs.readFileSync(
    path.join(DATA, 'city-portfolio.geojson'), 'utf8'));
  const buildingsIndex = JSON.parse(fs.readFileSync(
    path.join(DATA, 'buildings-index.json'), 'utf8'));

  const mainNodes = [];
  for (let i = 0; i < graph.inMain.length; i += 1) if (graph.inMain[i]) mainNodes.push(i);
  if (!mainNodes.length) throw new Error('لا عقد في المكوّن الرئيس');

  process.stdout.write(`عيّنة المسارات: ${ROUTE_SAMPLE} مساراً…\n`);
  const started = Date.now();
  const rand = Portfolio.mulberry32(SAMPLE_SEED);
  const sample = sampleRoutes(Routing, prepared, mainNodes, rand);
  process.stdout.write(`  ${sample.routes.length} مساراً في `
    + `${Math.round((Date.now() - started) / 1000)} ث · تعذّر ${sample.failed}\n`);

  const half = Math.floor(sample.routes.length / 2);
  const firstHalf = sample.routes.slice(0, half);
  const secondHalf = sample.routes.slice(half);

  /* ---- المدخلات الخام لكل تصريح ---- */

  const raw = [];
  portfolio.features.forEach((feature) => {
    const properties = feature.properties;
    const line = feature.geometry && feature.geometry.type === 'LineString'
      ? feature.geometry.coordinates : null;

    /* التصريح النقطي بلا خطّ: لا أضلاع تحته، فلا مقطع يُقاس. يُسجَّل بسببه
       ولا يُسقط — الإسقاط يجعل النسب تُقرأ على محفظة أصغر مما هي. */
    if (!line || line.length < 2) {
      raw.push({
        permitRef: properties.permitRef,
        street: properties.street,
        roadClass: properties.roadClass,
        reason: 'هندسة نقطية — لا مقطع خطّي تُقاس أضلاعه',
        traits: null,
      });
      return;
    }

    const edgeSet = Routing.edgesUnderClosure(prepared, line);
    const traits = segmentTraits(graph, edgeSet);
    if (!traits.edges) {
      raw.push({
        permitRef: properties.permitRef,
        street: properties.street,
        roadClass: properties.roadClass,
        reason: 'لا ضلع من الرسم تحت خطّ العمل',
        traits: null,
      });
      return;
    }

    const mid = line[Math.floor(line.length / 2)];
    const density = buildingDensity(buildingsIndex, mid);

    raw.push({
      permitRef: properties.permitRef,
      street: properties.street,
      /* الصنف من الرسم لا من خصائص التصريح: مصدرٌ واحد للحقيقة، ووسوم OSM
         هي التي بُنيت عليها السعة والحارات كذلك. */
      roadClass: traits.roadClass || properties.roadClass,
      reason: '',
      traits,
      lanes: traits.lanes,
      capacityVph: traits.lanes
        ? traits.lanes * Engine.DEFAULTS.capacityPerLane : null,
      through: routesThrough(sample.routes, edgeSet),
      throughByBand: TRIP_MIX.reduce((table, band) => {
        table[band.key] = routesThrough(sample.perBand[band.key], edgeSet);
        return table;
      }, {}),
      split: {
        firstHalf: routesThrough(firstHalf, edgeSet),
        secondHalf: routesThrough(secondHalf, edgeSet),
      },
      density,
    });
  });

  const scored = raw.filter((one) => one.traits);
  if (!scored.length) throw new Error('لا مقطع صالح في المحفظة');

  /* ---- التسوية والتركيب ---- */

  const centralityShare = scored.map((one) => one.through / sample.routes.length);
  const normalizedCentrality = Model.percentileRanks(centralityShare);
  const normalizedCapacity = Model.percentileRanks(scored.map((one) => one.capacityVph));
  const normalizedBuildings = Model.percentileRanks(
    scored.map((one) => (one.density ? one.density.perKm2 : null)));

  const rows = scored.map((one, at) => {
    const normalized = {
      centrality: normalizedCentrality[at],
      capacity: normalizedCapacity[at],
      buildings: normalizedBuildings[at],
      roadClass: Model.classScore(one.roadClass),
    };
    const combined = Model.combine(normalized);
    return {
      permitRef: one.permitRef,
      street: one.street,
      roadClass: one.roadClass,
      lanes: one.lanes,
      capacityVph: one.capacityVph,
      lengthM: one.traits.lengthM,
      graphEdges: one.traits.edges,
      centralityShare: round3(centralityShare[at]),
      routesThrough: one.through,
      routesThroughByBand: one.throughByBand,
      split: one.split,
      buildingsPerKm2: one.density ? one.density.perKm2 : null,
      buildingsSampleKm2: one.density ? one.density.areaKm2 : null,
      normalized,
      loadIndex: combined.loadIndex,
      inputsUsed: combined.used,
      inputsMissing: combined.missing,
      weightSumUsed: combined.weightSum,
    };
  });

  const ranks = rankOf(rows.map((row) => row.loadIndex));
  rows.forEach((row, at) => {
    row.rank = ranks[at];
    row.rankOf = rows.length;
    const tier = Model.tierOf(row.rank, rows.length);
    row.tier = tier.key;
    row.tierLabel = tier.label;
    row.vphBand = Model.vphBandFor(row.loadIndex, row.capacityVph);
  });

  /* ---- تجميع على مستوى الشارع ---- */

  const streetRows = {};
  rows.forEach((row) => {
    if (!streetRows[row.street]) streetRows[row.street] = [];
    streetRows[row.street].push(row);
  });
  const streets = {};
  Object.keys(streetRows).sort((a, b) => a.localeCompare(b, 'ar')).forEach((name) => {
    const list = streetRows[name];
    const values = list.map((one) => one.loadIndex);
    streets[name] = {
      segments: list.length,
      roadClass: list[0].roadClass,
      medianLoadIndex: round3(median(values)),
      lowestLoadIndex: round3(Math.min.apply(null, values)),
      highestLoadIndex: round3(Math.max.apply(null, values)),
      /* المدى داخل الشارع الواحد ليس عيباً: مقاطع الشارع تختلف مركزيةً
         ومحيطاً. وهو الفرق الجوهري عن AADT العشوائي — هناك اختلافٌ بلا سبب،
         وهنا اختلافٌ له مدخلٌ يُقرأ. */
      spread: round3(Math.max.apply(null, values) - Math.min.apply(null, values)),
      permits: list.map((one) => one.permitRef),
    };
  });
  const streetNames = Object.keys(streets);
  const streetRanks = rankOf(streetNames.map((name) => streets[name].medianLoadIndex));
  streetNames.forEach((name, at) => {
    streets[name].rank = streetRanks[at];
    streets[name].rankOf = streetNames.length;
    const tier = Model.tierOf(streetRanks[at], streetNames.length);
    streets[name].tier = tier.key;
    streets[name].tierLabel = tier.label;
  });

  /* ---- كل تصريح يجد جواباً أو سبباً ---- */

  /**
   * التصريح الذي لا مقطع له يأخذ منسوب شارعه — موسوماً بأنه عن الشارع لا عن
   * المقطع.
   * ---------------------------------------------------------------------------
   * ستة عشر تصريحاً في المحفظة هندستها نقطة لا خطّاً (مجموعة `pois`)، وخمسة
   * على طرقٍ لا يبلغها رسم التوجيه أصلاً. وتركُها بلا قيمة يترك البطاقة صامتة
   * على سُبع المحفظة.
   *
   * والبديل ليس اختراع رقم: منسوب الشارع محسوبٌ من مقاطع أخرى حقيقية على
   * الشارع نفسه، وهو أضعف من منسوب المقطع لأنه لا يعرف أين وقع العمل من
   * الشارع. فيُعطى بوسمه: `basis: 'street'`، والبطاقة تقول ذلك بلفظها.
   *
   * وحيث لا مقطع ولا شارع مسجَّل، يبقى الحقل **فارغاً لا صفراً**، ومعه سببه.
   */
  const permits = {};
  rows.forEach((row) => {
    permits[row.permitRef] = {
      basis: 'segment',
      loadIndex: row.loadIndex,
      rank: row.rank,
      rankOf: row.rankOf,
      tier: row.tier,
      tierLabel: row.tierLabel,
      vphBand: row.vphBand,
      street: row.street,
      roadClass: row.roadClass,
      reason: '',
    };
  });
  raw.filter((one) => !one.traits).forEach((one) => {
    const street = streets[one.street];
    if (!street) {
      permits[one.permitRef] = {
        basis: 'none',
        loadIndex: null,
        rank: null,
        rankOf: streetNames.length,
        tier: 'unknown',
        tierLabel: Model.tierOf(null, null).label,
        vphBand: null,
        street: one.street,
        roadClass: one.roadClass,
        reason: one.reason + ' — ولا مقطع آخر محسوب على الشارع نفسه',
      };
      return;
    }
    permits[one.permitRef] = {
      basis: 'street',
      loadIndex: street.medianLoadIndex,
      rank: street.rank,
      rankOf: street.rankOf,
      tier: street.tier,
      tierLabel: street.tierLabel,
      vphBand: null,
      street: one.street,
      roadClass: one.roadClass,
      reason: one.reason + ' — فالمنسوب عن الشارع كله (وسيط '
        + street.segments + ' مقطعاً محسوباً عليه) لا عن موضع العمل منه',
    };
  });

  /* ---- الحساسية، وخطّ الأساس، والمعقولية ---- */

  const bandCorrelations = [];
  for (let i = 0; i < TRIP_MIX.length; i += 1) {
    for (let j = i + 1; j < TRIP_MIX.length; j += 1) {
      bandCorrelations.push({
        between: TRIP_MIX[i].key + ' ↔ ' + TRIP_MIX[j].key,
        spearman: spearman(
          rows.map((row) => row.routesThroughByBand[TRIP_MIX[i].key]),
          rows.map((row) => row.routesThroughByBand[TRIP_MIX[j].key])),
      });
    }
  }

  Model.assertGrade(Model.GRADE);

  const report = {
    generatedFrom: 'presentation/scripts/build-street-load.js',
    model: 'presentation/masar-street-load.js',
    modelVersion: Model.MODEL_VERSION,
    name: 'مِنسَب',
    what: 'منسوب الحِمل على مقطع الشارع — منزلةٌ نسبية داخل المحفظة، من صفر '
      + 'إلى واحد.',
    grade: Model.GRADE,
    gradeIsFixed: 'الدرجة لا ترتفع. assertGrade في النموذج تُلقي على أي قيمة '
      + 'أخرى، وحزمة الاختبار تستدعيها على كل درجة في السُّلَّم.',
    limit: Model.LIMIT_TEXT,
    derivedFrom: Model.DERIVED_FROM,
    doesNotProve: 'لا يقيس مركبةً واحدة، ولا يُشتقّ من سرعة، ولا يُسمّى AADT، '
      + 'ولا يحلّ محلّه. تبديل مدخل المحرك قرارٌ إنسانيّ يسبقه تقرير الظلّ في '
      + 'docs/STREET-LOAD-SHADOW.md.',
    referenceHour: REFERENCE_HOUR,
    /**
     * ما هو «المقطع» في هذا الملف.
     * -----------------------------------------------------------------------
     * أضلاع الرسم الواقعة ضمن مسافة القرب من خطّ العمل — وهي **التعريف نفسه**
     * الذي يستعمله `edgesUnderClosure` في محرك التوجيه لتحديد ما يُغلقه
     * التصريح. ولذلك يبلغ مجموع أطوال الأضلاع أضعافَ طول خطّ العمل: يدخل فيه
     * الاتجاه المقابل، والطريق الموازي الخدمي، والشوارع المتقاطعة القريبة.
     *
     * وهذا مقصود لا عرَض: المؤشّر يقيس ثقل **ما يمسّه هذا العمل** لا ثقل خطٍّ
     * هندسي. وعملٌ عند تقاطع مزدحم يمسّ شبكةً أثقل من عملٍ في منتصف مقطع
     * مستقيم، وهذا فرقٌ يجب أن يظهر. والأهم: أن يُقاس المؤشّر على البصمة
     * نفسها التي يُقاس عليها الإغلاق — وإلا وصف كلٌّ منهما شيئاً آخر.
     */
    segmentFootprint: 'أضلاع الرسم ضمن مسافة القرب من خطّ العمل — تعريف '
      + 'edgesUnderClosure نفسه في masar-city-routing.js. يشمل الاتجاه '
      + 'المقابل والطرق الموازية والمتقاطعات القريبة، فطول الأضلاع يتجاوز '
      + 'طول خطّ العمل عادةً.',
    capacityPerLane: Engine.DEFAULTS.capacityPerLane,
    capacityPerLaneSource: 'masar-engine.js — افتراض إشباع على نمط دليل سعة '
      + 'الطرق (HCM)، معلن في المحرك.',
    weights: Model.WEIGHTS,
    vcAssumption: {
      atLoadIndexZero: Model.VC_AT_ZERO,
      atLoadIndexOne: Model.VC_AT_ONE,
      note: 'نسبة الحجم إلى السعة المفترضة عند طرفَي السُّلَّم — منها يُشتقّ '
        + 'vphBand بضربها في السعة. **افتراض معلن لا قيمة مأخوذة من عدّ.** '
        + 'وعرض المدى مدى جهلٍ لا فاصل ثقة: لا توزيع خلفه ولا عيّنة.',
    },
    sample: {
      routes: sample.routes.length,
      requested: ROUTE_SAMPLE,
      failedPairs: sample.failed,
      seed: SAMPLE_SEED,
      hour: REFERENCE_HOUR,
      tripMix: TRIP_MIX,
      graph: {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        mainComponentNodes: mainNodes.length,
      },
    },
    coverage: {
      permitsInPortfolio: portfolio.features.length,
      segmentsScored: rows.length,
      segmentsSkipped: raw.length - rows.length,
      skipReasons: raw.filter((one) => !one.traits)
        .map((one) => ({ permitRef: one.permitRef, reason: one.reason })),
      /* المدخل الغائب يبقى فارغاً ولا يصير صفراً — والعدد منشور كي لا يمرّ
         الغياب صامتاً. */
      segmentsMissingBuildings: rows.filter((row) => row.inputsMissing.indexOf('buildings') !== -1)
        .length,
      segmentsMissingAnyInput: rows.filter((row) => row.inputsMissing.length).length,
      permitsByBasis: Object.keys(permits).reduce((table, ref) => {
        table[permits[ref].basis] = (table[permits[ref].basis] || 0) + 1;
        return table;
      }, {}),
      basisNote: 'segment — منسوب مقطع العمل نفسه. street — منسوب الشارع كله '
        + 'لتصريحٍ لا مقطع خطّياً له، وهو أضعف لأنه لا يعرف أين وقع العمل من '
        + 'الشارع. none — لا هذا ولا ذاك، والحقل فارغ لا صفر.',
      streetBandNote: 'التصريح على أساس الشارع بلا vphBand: المدى يُشتقّ من '
        + 'سعة المقطع، ولا سعة واحدة لشارعٍ تختلف حاراته على امتداده. '
        + 'الامتناع هنا أصدق من متوسّط.',
    },
    sampleStability: sampleStability(rows),
    sensitivity: {
      note: 'الأوزان حكمٌ هندسي لا معايرة — ولا شيء نعاير عليه. فتُنشر حساسية '
        + 'الترتيب لها بدل الاكتفاء بإعلانها.',
      bigMoveThreshold: BIG_MOVE,
      tripMix: {
        note: 'المركزية محسوبة لكل نطاق طولٍ على حدة. ارتباطٌ عالٍ بين '
          + 'النطاقات يعني أن الترتيب لا يعتمد على حصص التوزيع المفترضة.',
        between: bandCorrelations,
      },
      weights: sensitivityOf(rows),
    },
    baseline: baselineComparison(rows),
    reasonableness: reasonablenessAnchor(rows),
    streets,
    permits,
    segments: rows,
  };

  /* الحدّ المعروض يمرّ على بوابة اللغة نفسها التي تحرس بقية المنتج: كلمة
     «مرصود» أو «مقيس» على رقمٍ مشتقّ ترفع درجته بلا بيانات. */
  const guarded = [report.what, report.limit, report.derivedFrom, report.doesNotProve];
  guarded.forEach((text) => {
    const check = Evidence.checkLanguage(Model.GRADE, text);
    if (!check.ok) {
      throw new Error('نصّ العرض يخالف بوابة اللغة: ' + check.violations.join(' · '));
    }
  });

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_JS, `window.MASAR_STREET_LOAD = ${JSON.stringify(report)};\n`, 'utf8');

  const top = rows.slice().sort((a, b) => a.rank - b.rank).slice(0, 5);
  process.stdout.write(`\nمِنسَب — ${rows.length} مقطعاً على `
    + `${Object.keys(streets).length} شارعاً\n`);
  top.forEach((row) => {
    process.stdout.write(`  ${row.rank}. ${row.street} (${row.permitRef}) `
      + `${row.loadIndex} · ${row.tierLabel} · `
      + `${row.vphBand ? row.vphBand.low + '–' + row.vphBand.high + ' مركبة/ساعة' : 'بلا مدى'}\n`);
  });
  process.stdout.write(`\nخطّ الأساس الساذج (صنف الطريق وحده):\n`);
  process.stdout.write(`  ارتباط الرتب: ${report.baseline.spearmanWithClassOnly}\n`);
  process.stdout.write(`  حصة تشتّت مِنسَب التي يفسّرها الصنف وحده: `
    + `${report.baseline.varianceExplainedByClass}\n`);
  process.stdout.write(`  أزواج لا يرتّبها الصنف: ${report.baseline.pairsClassCannotOrder}`
    + ` من ${report.baseline.pairsTotal} (${report.baseline.pairsClassCannotOrderPct}٪)\n`);
  process.stdout.write(`  انقلابات الصنف: ${report.baseline.classInversions}`
    + ` (${report.baseline.classInversionsPct}٪ من الأزواج المرتَّبة)\n`);
  process.stdout.write(`\nاستقرار العيّنة (نصف مقابل نصف): `
    + `${report.sampleStability.spearmanHalfVsHalf}\n`);
  process.stdout.write(`مقاطع بلا مدخل مبانٍ: ${report.coverage.segmentsMissingBuildings}\n`);
  process.stdout.write(`\n${OUT_JSON}\n`);
}

main();
