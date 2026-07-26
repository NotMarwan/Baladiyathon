'use strict';
/**
 * أثر — يبني رسماً قابلاً للتوجيه من شبكة طرق الرياض الحقيقية.
 * ---------------------------------------------------------------------------
 * النسخة الأولى وقفت عند `tertiary`: 9,105 عقدة و10,269 ضلعاً. صحيحة، وغير
 * واقعية — لأن السائق حين يُغلق شارعه لا يدور حول الحيّ، بل يدخل الشارع
 * الموازي على بعد مئتي متر. ذلك الشارع `residential`، ولم يكن في الرسم، فكان
 * «البديل» التفافاً واسعاً وزمناً مضافاً لا يصدّقه من يعرف المدينة.
 *
 * هذه النسخة تضمّ شوارع الأحياء، وتضيف ثلاثة أشياء لا يستقيم الزمن بدونها:
 *
 *   ١) **الاتجاه.** الضلع ذو الاتجاه الواحد يُعبر في جهة واحدة. تجاهله يفتح
 *      مساراتٍ لا يسلكها سائق، ويعطي زمناً أقصر من أي زمن ممكن.
 *   ٢) **زوايا الانعطاف.** يُخزَّن اتجاه السير عند طرفَي كل ضلع، فيحسب التوجيه
 *      عقوبةَ الانعطاف من فرق الاتجاهين. بلا هذا يخترق المسار خمسين مربعاً
 *      سكنياً «مجاناً» ويخرج بزمنٍ مستحيل.
 *   ٣) **عقد التحكّم.** الإشارة الضوئية تأخير ثابت لا يُستنتج من الهندسة.
 *      موقعها من OSM، وتُسقط على أقرب عقدة في الرسم.
 *
 * وتغييران في البناء نفسه:
 *
 *   - **المصدر خام لا مُنحَّف.** النسخة الأولى بنت على `*.geojson.js` بعد تبسيط
 *     دوغلاس–بويكر، والتبسيط يزيح الأطراف فتنفصل التقاطعات: مكوّنٌ عملاق بنسبة
 *     ٥٨.٩٪ رُقّع بلحامٍ عند ٢٥ متراً. والخام يحمل رؤوس OSM كما هي، فالتقاطع
 *     تطابقٌ لا تقريب. اللحام يبقى لسدّ أثر التقريب إلى خمس منازل وأطراف
 *     المنحدرات — لكن عند ٨ أمتار. وهذا شرط سلامة لا تحسين: ٢٥ متراً على شبكة
 *     سكنية تلحم شارعين متوازيين في شارع واحد، فيقفز المسار خلال مربعٍ سكني
 *     قفزاً لا وجود له.
 *   - **الرسم يحمل هندسته.** كان الضلع يشير إلى مدى رؤوس في طريق العرض، فيلزم
 *     أن يكون ملف العرض هو نفسه ملف البناء حرفاً بحرف. الآن يحمل الضلع رؤوسه
 *     الوسيطة، فيستقلّ الرسم عن أي تبسيطٍ لاحق في طبقة العرض.
 *
 * المكوّن الرئيس يُقاس ترابطاً قوياً لا ضعيفاً: مع الاتجاه الواحد، عقدةٌ تُبلَغ
 * ولا يُرجَع منها تعطي «لا مسار» بلا سبب مفهوم.
 *
 *     node scripts/build-route-graph.js
 *
 * بيانات © مساهمو OpenStreetMap — رخصة ODbL.
 * السرعة والسعة والحركة المفترضة افتراضات توضيحية معلنة في صفحة المصادر.
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');

/** لحامٌ يسدّ أثر التقريب وأطراف المنحدرات، ويبقى دون نصف عرض المربع السكني. */
const WELD_TOLERANCE_M = 8;

const KEY_DECIMALS = 6;
const METRES_PER_DEGREE = 111320;
const RIYADH_LAT = 24.71;
const LON_SCALE = Math.cos((RIYADH_LAT * Math.PI) / 180);

/**
 * ملامح التصنيفات.
 * ---------------------------------------------------------------------------
 * `kmh` سرعة حرة، `lanes` عدد المسارات حين لا تذكرها OSM، `capacity` سعة
 * المسار الواحد بالمركبة/ساعة، `aadt` حركة يومية مفترضة لكل مسار.
 *
 * الأرقام السكنية ليست مصغّرات للشرايين: الشارع السكني يحمل مطبّات وسياراتٍ
 * متوقفة على جانبيه وأولوية غير محكومة، فسرعته الفعلية ثلاثون لا أربعون،
 * وسعته ستمئة لا ألف وثمانمئة. هذا ما يمنع المسار من اتخاذ الأحياء طريقاً
 * سريعاً موازياً.
 *
 * الترتيب هنا هو ترتيب `klass` في الأضلاع — لا يُغيَّر دون إعادة البناء.
 */
const CLASSES = [
  { name: 'motorway', kmh: 100, lanes: 3, capacity: 2000, aadt: 22000 },
  { name: 'motorway_link', kmh: 60, lanes: 1, capacity: 1500, aadt: 9000 },
  { name: 'trunk', kmh: 90, lanes: 3, capacity: 1900, aadt: 18000 },
  { name: 'trunk_link', kmh: 55, lanes: 1, capacity: 1400, aadt: 8000 },
  { name: 'primary', kmh: 70, lanes: 3, capacity: 1900, aadt: 14000 },
  { name: 'primary_link', kmh: 50, lanes: 1, capacity: 1300, aadt: 7000 },
  { name: 'secondary', kmh: 60, lanes: 2, capacity: 1700, aadt: 10000 },
  { name: 'secondary_link', kmh: 45, lanes: 1, capacity: 1200, aadt: 5000 },
  { name: 'tertiary', kmh: 50, lanes: 2, capacity: 1600, aadt: 7000 },
  { name: 'tertiary_link', kmh: 40, lanes: 1, capacity: 1100, aadt: 3500 },
  { name: 'unclassified', kmh: 40, lanes: 2, capacity: 1000, aadt: 3000 },
  { name: 'residential', kmh: 30, lanes: 1, capacity: 600, aadt: 900 },
  { name: 'living_street', kmh: 15, lanes: 1, capacity: 300, aadt: 200 },
];
const CLASS_INDEX = {};
CLASSES.forEach((entry, index) => { CLASS_INDEX[entry.name] = index; });
const DEFAULT_CLASS = CLASS_INDEX.residential;

/**
 * عقوبة الانعطاف بالثواني.
 * ---------------------------------------------------------------------------
 * السعودية تسير يميناً، فاليسار يقطع الحركة المقابلة ويكلّف أضعاف اليمين.
 * الأرقام من رتبة تأخير التقاطع في دليل سعة الطرق (HCM) — توضيحية معلنة،
 * تُعاير ببيانات المشغل حين تتوفر.
 */
const TURN = { straightDeg: 25, uTurnDeg: 135, rightSec: 4, leftSec: 11, uTurnSec: 25 };

/** تأخير عقدة التحكّم بالثواني: 2 إشارة، 1 قف أو دوّار صغير، 0 لا شيء. */
const CONTROL_SEC = [0, 6, 22];

/** أبعد من هذا لا تُنسب عقدة التحكّم إلى عقدة الرسم. */
const CONTROL_SNAP_M = 25;

function keyOf(point) {
  return point[0].toFixed(KEY_DECIMALS) + ',' + point[1].toFixed(KEY_DECIMALS);
}

function metresBetween(a, b) {
  const dx = (a[0] - b[0]) * METRES_PER_DEGREE * LON_SCALE;
  const dy = (a[1] - b[1]) * METRES_PER_DEGREE;
  return Math.sqrt(dx * dx + dy * dy);
}

/** اتجاه البوصلة من a إلى b بالدرجات: صفر شمالاً، ويزيد مع عقارب الساعة. */
function bearing(a, b) {
  const dx = (b[0] - a[0]) * LON_SCALE;
  const dy = b[1] - a[1];
  return Math.round(((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360);
}

function readCollection(file) {
  const full = path.join(DATA, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function main() {
  /**
   * المصدر خام: هذان الملفان ينزلان من Overpass بلا تبسيط، فرؤوس التقاطع
   * مشتركة حرفياً بين الطرق المتقاطعة.
   */
  const arterial = readCollection('riyadh-roads.geojson');
  if (!arterial) throw new Error('data/riyadh-roads.geojson مفقود — شغّل scripts/fetch-roads.js');
  const hood = readCollection('riyadh-roads-neighbourhood.geojson');
  if (!hood) console.log('تنبيه: شوارع الأحياء مفقودة — شغّل scripts/fetch-neighbourhood-roads.js');

  const roads = arterial.features.concat(hood ? hood.features : []);
  console.log(`${arterial.features.length} مقطعاً شريانياً + `
    + `${hood ? hood.features.length : 0} مقطعاً سكنياً`);

  /* ---- ١) التقاطعات: رأسٌ يظهر في طريقين فأكثر ---- */

  const wayCountAt = new Map();
  roads.forEach((road, index) => {
    const seen = new Set();
    for (const point of road.geometry.coordinates) {
      const key = keyOf(point);
      if (seen.has(key)) continue;
      seen.add(key);
      const holders = wayCountAt.get(key) || new Set();
      holders.add(index);
      wayCountAt.set(key, holders);
    }
  });

  /**
   * ١·ب) الطرف الذي ينتهي قرب جسد طريق آخر ولا يمسّه.
   * يبقى بعد الخام لسببين: التقريب إلى خمس منازل يزيح الرأس حتى متر، وأطراف
   * المنحدرات ترسم أحياناً منفصلة عن الطريق الذي تصبّ فيه.
   */
  const vertexCell = WELD_TOLERANCE_M / (METRES_PER_DEGREE * LON_SCALE);
  const vertexBuckets = new Map();
  roads.forEach((road, index) => {
    road.geometry.coordinates.forEach((point, at) => {
      const key = Math.floor(point[0] / vertexCell) + ':' + Math.floor(point[1] / vertexCell);
      const list = vertexBuckets.get(key) || [];
      list.push([index, at]);
      vertexBuckets.set(key, list);
    });
  });

  const forcedCuts = new Map();
  let welded = 0;

  roads.forEach((road, index) => {
    const line = road.geometry.coordinates;
    if (line.length < 2) return;

    for (const at of [0, line.length - 1]) {
      const point = line[at];
      const holders = wayCountAt.get(keyOf(point));
      if (holders && holders.size >= 2) continue;

      const gx = Math.floor(point[0] / vertexCell);
      const gy = Math.floor(point[1] / vertexCell);
      let bestWay = -1;
      let bestVertex = -1;
      let bestDistance = WELD_TOLERANCE_M;

      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const list = vertexBuckets.get((gx + dx) + ':' + (gy + dy));
          if (!list) continue;
          for (const [otherWay, otherAt] of list) {
            if (otherWay === index) continue;
            const distance = metresBetween(point, roads[otherWay].geometry.coordinates[otherAt]);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestWay = otherWay;
              bestVertex = otherAt;
            }
          }
        }
      }

      if (bestWay === -1) continue;
      const cuts = forcedCuts.get(bestWay) || new Set();
      cuts.add(bestVertex);
      forcedCuts.set(bestWay, cuts);
      welded += 1;
    }
  });

  /* ---- ٢) اللحام: العقد المتقاربة عقدة واحدة ---- */

  const buckets = new Map();
  const nodes = [];
  const nodeAtKey = new Map();

  function nodeFor(point) {
    const key = keyOf(point);
    const existing = nodeAtKey.get(key);
    if (existing !== undefined) return existing;

    const gx = Math.floor(point[0] / vertexCell);
    const gy = Math.floor(point[1] / vertexCell);
    let best = -1;
    let bestDistance = WELD_TOLERANCE_M;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const list = buckets.get((gx + dx) + ':' + (gy + dy));
        if (!list) continue;
        for (const candidate of list) {
          const distance = metresBetween(point, nodes[candidate]);
          if (distance < bestDistance) { bestDistance = distance; best = candidate; }
        }
      }
    }

    if (best === -1) {
      best = nodes.length;
      nodes.push([Number(point[0].toFixed(KEY_DECIMALS)), Number(point[1].toFixed(KEY_DECIMALS))]);
      const bucketKey = gx + ':' + gy;
      const list = buckets.get(bucketKey) || [];
      list.push(best);
      buckets.set(bucketKey, list);
    }
    nodeAtKey.set(key, best);
    return best;
  }

  /* ---- ٣) القصّ: ضلعٌ بين كل تقاطعين متتاليين، يحمل رؤوسه ---- */

  const names = [];
  const nameRefs = new Map();
  function nameFor(value) {
    if (!value) return -1;
    let ref = nameRefs.get(value);
    if (ref === undefined) { ref = names.length; names.push(value); nameRefs.set(value, ref); }
    return ref;
  }

  const edges = [];
  /** أضلاع كل طريق بمعرّف OSM — يلزم لحلّ قيود الانعطاف إلى أضلاع. */
  const edgesOfWay = new Map();
  let skippedShort = 0;
  let onewayEdges = 0;

  roads.forEach((road, index) => {
    const line = road.geometry.coordinates;
    if (line.length < 2) return;

    const forced = forcedCuts.get(index);
    const cutSet = new Set([0, line.length - 1]);
    for (let i = 1; i < line.length - 1; i += 1) {
      const holders = wayCountAt.get(keyOf(line[i]));
      if (holders && holders.size >= 2) cutSet.add(i);
    }
    if (forced) forced.forEach((at) => { if (at > 0 && at < line.length - 1) cutSet.add(at); });
    const cuts = Array.from(cutSet).sort((a, b) => a - b);

    const named = CLASS_INDEX[road.properties.highway];
    const klass = named === undefined ? DEFAULT_CLASS : named;
    const profile = CLASSES[klass];
    const lanes = Number(road.properties.lanes) > 0
      ? Number(road.properties.lanes)
      : profile.lanes;
    // السرعة المعلنة تسبق استنتاج التصنيف حين تذكرها OSM.
    const kmh = Number(road.properties.maxspeed) > 0
      ? Number(road.properties.maxspeed)
      : profile.kmh;
    const direction = Number(road.properties.oneway) || 0;
    const nameRef = nameFor(road.properties.name);

    for (let c = 0; c + 1 < cuts.length; c += 1) {
      const from = cuts[c];
      const to = cuts[c + 1];
      let length = 0;
      for (let i = from + 1; i <= to; i += 1) length += metresBetween(line[i - 1], line[i]);
      // مقطعٌ دون المتر أثرُ تقريبٍ لا طريق: يوصل عقدتين ملحومتين أصلاً.
      if (length < 1) { skippedShort += 1; continue; }

      const a = nodeFor(line[from]);
      const b = nodeFor(line[to]);
      if (a === b) { skippedShort += 1; continue; }

      /**
       * الاتجاه عند الطرفين يُقاس من الرأسين المجاورين لا من طرفَي الضلع:
       * منعطفٌ يبدأ شمالاً وينتهي شرقاً زاويةُ دخوله شمالية، وخطُّ الطرفين
       * يقول شمالاً شرقياً — والفرق هو الانعطاف نفسه الذي نحاسب عليه.
       */
      const bearA = bearing(line[from], line[from + 1]);
      const bearB = bearing(line[to], line[to - 1]);

      // الرؤوس الوسيطة وحدها: الطرفان عقدتان يحملهما الرسم أصلاً.
      const shape = [];
      for (let i = from + 1; i < to; i += 1) shape.push(line[i]);

      if (direction) onewayEdges += 1;
      const list = edgesOfWay.get(road.properties.osmId) || [];
      list.push(edges.length);
      edgesOfWay.set(road.properties.osmId, list);
      edges.push([
        a, b,
        Math.round(length * 10) / 10,
        Math.round(((length / 1000) / kmh) * 60 * 1000) / 1000,
        lanes,
        direction,
        klass,
        bearA, bearB,
        nameRef,
        shape,
      ]);
    }
  });

  /* ---- ٤) عقد التحكّم: الإشارة تأخيرٌ لا هندسة ---- */

  const control = new Uint8Array(nodes.length);
  let controlSnapped = 0;
  const trafficFile = path.join(DATA, 'riyadh-traffic-control.js');
  if (fs.existsSync(trafficFile)) {
    const previous = global.window;
    global.window = {};
    require(trafficFile);
    const payload = global.window.RIYADH_TRAFFIC_CONTROL;
    global.window = previous;

    const snapCell = CONTROL_SNAP_M / (METRES_PER_DEGREE * LON_SCALE);
    const snapBuckets = new Map();
    nodes.forEach((node, index) => {
      const key = Math.floor(node[0] / snapCell) + ':' + Math.floor(node[1] / snapCell);
      const list = snapBuckets.get(key) || [];
      list.push(index);
      snapBuckets.set(key, list);
    });

    for (const point of (payload && payload.points) || []) {
      const gx = Math.floor(point[0] / snapCell);
      const gy = Math.floor(point[1] / snapCell);
      let best = -1;
      let bestDistance = CONTROL_SNAP_M;
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const list = snapBuckets.get((gx + dx) + ':' + (gy + dy));
          if (!list) continue;
          for (const candidate of list) {
            const distance = metresBetween(point, nodes[candidate]);
            if (distance < bestDistance) { bestDistance = distance; best = candidate; }
          }
        }
      }
      if (best === -1) continue;
      // الأشدّ يبقى: تقاطعٌ عليه إشارة وعلامة قف يحكمه الإشارة.
      if (point[2] > control[best]) control[best] = point[2];
      controlSnapped += 1;
    }
  } else {
    console.log('تنبيه: عقد التحكّم مفقودة — التأخير عند التقاطعات صفر');
  }

  /**
   * ٤·ب) استنتاج التقاطعات المحكومة — مُعلَن لا مُخفى.
   * ---------------------------------------------------------------------------
   * OSM يوثّق 544 إشارة ضوئية في نطاق الرياض كله. والرقم على الأرض بالآلاف:
   * الوسم تطوّعي، والإشارة أقلّ ما يهتمّ المتطوّع برسمه. وقيس أثر النقص: زمن
   * الذروة خرج مساوياً لزمن الثالثة فجراً تقريباً (×0.930 مقابل ×0.916 من
   * مرجع مستقل) — أي أن النموذج لا يعرف الازدحام أصلاً.
   *
   * والسبب أن تأخير المدينة يقع في التقاطعات لا على الوصلات: معادلة BPR بمعامل
   * β=4 لا تعطي إلا كسوراً مئوية ما لم يبلغ الحمل السعة، وهو نادرٌ على الوصلة
   * وشائعٌ عند التقاطع.
   *
   * فيُستنتج ما لم يُوثَّق، بقاعدة هندسية لا بتخمين: تقاطعُ شريانين مُحكَمٌ
   * بإشارة (هكذا الرياض)، وملتقى شريانٍ بشارع حيّ محكومٌ بأولوية. والمعلوم من
   * OSM يسبق المستنتج دائماً، والمستنتج معلنٌ في البيانات الوصفية وفي صفحة
   * المصادر — استنتاجٌ مكتوب أمانةٌ، واستنتاجٌ صامت تزوير.
   *
   * تقاطعات الطرق السريعة ووصلاتها تُستثنى: مفصولة المستويات فلا تأخير فيها.
   */
  const ARTERIAL_CLASSES = new Set(['trunk', 'primary', 'secondary']
    .map((name) => CLASS_INDEX[name]));
  const GRADE_SEPARATED = new Set(['motorway', 'motorway_link', 'trunk_link',
    'primary_link', 'secondary_link', 'tertiary_link'].map((name) => CLASS_INDEX[name]));
  const COLLECTOR_CLASSES = new Set(['tertiary', 'unclassified']
    .map((name) => CLASS_INDEX[name]));

  const atNode = [];
  for (let i = 0; i < nodes.length; i += 1) atNode.push([]);
  edges.forEach((edge) => { atNode[edge[0]].push(edge[6]); atNode[edge[1]].push(edge[6]); });

  let inferredSignals = 0;
  let inferredStops = 0;
  for (let node = 0; node < nodes.length; node += 1) {
    if (control[node]) continue;
    const classes = atNode[node];
    if (classes.length < 3) continue;
    if (classes.some((klass) => GRADE_SEPARATED.has(klass))) continue;

    const arterials = classes.filter((klass) => ARTERIAL_CLASSES.has(klass)).length;
    const collectors = classes.filter((klass) => COLLECTOR_CLASSES.has(klass)).length;
    // الضلع الواحد يظهر مرتين حين يمرّ التقاطع خلاله، فالعتبة على الأضلاع لا الطرق.
    if (arterials >= 3) { control[node] = 2; inferredSignals += 1; continue; }
    if (arterials >= 1 || collectors >= 3) { control[node] = 1; inferredStops += 1; }
  }
  console.log(`استُنتج ${inferredSignals} تقاطعاً بإشارة و${inferredStops} بأولوية `
    + '(معلن — وسم OSM ناقص)');

  /* ---- ٤·ج) قيود الانعطاف: تُحلّ إلى أضلاع هنا لا في المتصفح ---- */

  /**
   * القيد في OSM ثلاثة معرّفات: طريقٌ داخل، وعقدةُ تقاطع، وطريقٌ خارج.
   * والمحرك لا يعرف معرّفات OSM — يعرف أضلاعاً مرقّمة وعقداً ملحومة. فالحلّ
   * يقع هنا مرة: الطريقان يُترجمان إلى أضلاعهما، والعقدة إلى أقرب عقدة رسم.
   *
   * ويُشترط أن يمسّ الضلعان العقدةَ نفسها — طريقٌ طويل مقصوصٌ إلى عشرة أضلاع
   * ليس منها عند التقاطع إلا واحد، ومنعُ العشرة يغلق انعطافاتٍ مسموحة.
   *
   * `only_*` يُوسَّع هنا أيضاً: «الإلزامي» يعني منعَ كل خروجٍ آخر من ذلك الضلع
   * عند تلك العقدة، وتوسيعه إلى منوعاتٍ صريحة يجعل المحرك يقرأ جدولاً واحداً.
   */
  const restrictions = [];
  let restrictionRules = 0;
  let restrictionUnresolved = 0;
  const restrictionFile = path.join(DATA, 'riyadh-turn-restrictions.js');
  if (fs.existsSync(restrictionFile)) {
    const previous = global.window;
    global.window = {};
    require(restrictionFile);
    const payload = global.window.RIYADH_TURN_RESTRICTIONS;
    global.window = previous;

    const nodeCell = 20 / (METRES_PER_DEGREE * LON_SCALE);
    const nodeBuckets = new Map();
    nodes.forEach((node, index) => {
      const key = Math.floor(node[0] / nodeCell) + ':' + Math.floor(node[1] / nodeCell);
      const list = nodeBuckets.get(key) || [];
      list.push(index);
      nodeBuckets.set(key, list);
    });
    const nodeAt = (point) => {
      const gx = Math.floor(point[0] / nodeCell);
      const gy = Math.floor(point[1] / nodeCell);
      let best = -1;
      let bestDistance = 20;
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (const candidate of nodeBuckets.get((gx + dx) + ':' + (gy + dy)) || []) {
            const distance = metresBetween(point, nodes[candidate]);
            if (distance < bestDistance) { bestDistance = distance; best = candidate; }
          }
        }
      }
      return best;
    };

    const touches = (edgeIndex, node) =>
      edges[edgeIndex][0] === node || edges[edgeIndex][1] === node;

    for (const rule of (payload && payload.rules) || []) {
      const via = nodeAt(rule[1]);
      const fromEdges = (edgesOfWay.get(rule[0]) || []).filter((e) => touches(e, via));
      const toEdges = (edgesOfWay.get(rule[2]) || []).filter((e) => touches(e, via));
      if (via === -1 || !fromEdges.length || !toEdges.length) {
        restrictionUnresolved += 1;
        continue;
      }
      restrictionRules += 1;

      if (rule[3] === 0) {
        fromEdges.forEach((f) => toEdges.forEach((t) => restrictions.push([f, via, t])));
        continue;
      }
      // إلزامي: كل خروجٍ من `from` عند العقدة غيرِ `to` ممنوع.
      const allowed = new Set(toEdges);
      const exits = [];
      edges.forEach((edge, index) => {
        if (edge[0] === via || edge[1] === via) exits.push(index);
      });
      fromEdges.forEach((f) => {
        exits.forEach((t) => {
          if (t === f || allowed.has(t)) return;
          restrictions.push([f, via, t]);
        });
      });
    }
  } else {
    console.log('تنبيه: قيود الانعطاف مفقودة — شغّل scripts/fetch-turn-restrictions.js');
  }

  /* ---- ٥) القياس: أكبر مكوّن مترابط ترابطاً قوياً ---- */

  /**
   * الترابط القوي لا الضعيف.
   * مع الاتجاه الواحد يمكن أن تُبلَغ عقدةٌ ولا يُرجَع منها. إسنادُ موقعٍ إليها
   * يعطي «لا مسار» في نصف الاستعلامات بلا سبب يُفهم. كوساراجو بمرورين، كلاهما
   * تكراري — العمق هنا بعشرات الآلاف ويكسر أي صياغة عودية.
   */
  const outAdj = [];
  const inAdj = [];
  for (let i = 0; i < nodes.length; i += 1) { outAdj.push([]); inAdj.push([]); }
  edges.forEach((edge) => {
    const a = edge[0];
    const b = edge[1];
    const direction = edge[5];
    if (direction >= 0) { outAdj[a].push(b); inAdj[b].push(a); }
    if (direction <= 0) { outAdj[b].push(a); inAdj[a].push(b); }
  });

  const order = [];
  const visited = new Uint8Array(nodes.length);
  for (let start = 0; start < nodes.length; start += 1) {
    if (visited[start]) continue;
    const stack = [[start, 0]];
    visited[start] = 1;
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const list = outAdj[frame[0]];
      if (frame[1] < list.length) {
        const next = list[frame[1]];
        frame[1] += 1;
        if (!visited[next]) { visited[next] = 1; stack.push([next, 0]); }
      } else {
        order.push(frame[0]);
        stack.pop();
      }
    }
  }

  const component = new Int32Array(nodes.length).fill(-1);
  const sizes = [];
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const start = order[i];
    if (component[start] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [start];
    component[start] = id;
    while (stack.length) {
      const node = stack.pop();
      size += 1;
      for (const other of inAdj[node]) {
        if (component[other] === -1) { component[other] = id; stack.push(other); }
      }
    }
    sizes.push(size);
  }

  let largest = 0;
  for (let i = 1; i < sizes.length; i += 1) if (sizes[i] > sizes[largest]) largest = i;
  /**
   * المكوّن الرئيس مُعلَّم في الملف لا محسوباً في المتصفح: القرار يُتّخذ مرة
   * عند البناء لا عند كل فتح صفحة، والإسناد يقع على أقرب عقدة *داخله*.
   */
  const inMain = Array.from(component, (id) => (id === largest ? 1 : 0));
  const mainSize = sizes[largest];

  /* ---- ٦) الكتابة ---- */

  const graph = {
    metadata: {
      source: 'OpenStreetMap contributors — ODbL 1.0',
      note: 'الهندسة من OSM؛ السرعة والسعة والحركة المفترضة وعقوبات الانعطاف افتراضات توضيحية معلنة — تُعاير ببيانات المشغل',
      builtFrom: ['riyadh-roads.geojson', 'riyadh-roads-neighbourhood.geojson', 'riyadh-traffic-control.js'],
      weldToleranceM: WELD_TOLERANCE_M,
      classes: CLASSES,
      turn: TURN,
      controlSeconds: CONTROL_SEC,
      largestComponent: mainSize,
      controlFromOsm: controlSnapped,
      controlInferred: inferredSignals + inferredStops,
      controlNote: 'الإشارات الموثّقة في OSM قليلة؛ ما زاد عليها مستنتج من '
        + 'هندسة التقاطع (تقاطع شريانين = إشارة، ملتقى شريان بشارع حيّ = أولوية).',
      restrictionRules: restrictionRules,
      restrictionPairs: restrictions.length,
      restrictionUnresolved: restrictionUnresolved,
    },
    nodes,
    // 1 إن كانت العقدة في المكوّن الرئيس — إليه وحده يُسنَد أي طلب توجيه.
    inMain,
    // 0 لا تحكّم · 1 قف أو دوّار صغير · 2 إشارة ضوئية
    control: Array.from(control),
    names,
    // [a, b, lengthM, freeFlowMin, lanes, dir, klass, bearA, bearB, nameRef, shape]
    edges,
    // [ضلع الدخول، عقدة التقاطع، ضلع الخروج] — انتقالٌ ممنوع
    restrictions,
  };

  const json = JSON.stringify(graph);
  const file = path.join(DATA, 'riyadh-route-graph.js');
  fs.writeFileSync(file, 'window.RIYADH_ROUTE_GRAPH = JSON.parse(' + JSON.stringify(json) + ');\n');

  const controlled = graph.control.filter(Boolean).length;
  console.log(
    `route-graph: ${nodes.length} عقدة · ${edges.length} ضلعاً من ${roads.length} مقطعاً\n`
    + `             ${onewayEdges} ضلعاً باتجاه واحد · ${welded} طرفاً لُحم ضمن ${WELD_TOLERANCE_M} أمتار\n`
    + `             ${controlled} عقدة تحكّم (من ${controlSnapped} محاولة إسناد)\n`
    + `             ${restrictionRules} قيد انعطاف حُلّ إلى ${restrictions.length} انتقالاً ممنوعاً `
    + `(${restrictionUnresolved} تعذّر حلّه)\n`
    + `             أكبر مكوّن مترابط قوياً ${mainSize} عقدة `
    + `(${((100 * mainSize) / nodes.length).toFixed(1)}٪ من ${sizes.length} مكوّناً)\n`
    + `             ${skippedShort} ضلعاً قصيراً أُسقط → ${(json.length / 1048576).toFixed(2)} م.ب`
  );
}

main();
