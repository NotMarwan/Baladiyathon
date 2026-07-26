'use strict';
/**
 * أثر — شوارع الأحياء من OpenStreetMap.
 * ---------------------------------------------------------------------------
 * `fetch-roads.js` يقف عند `tertiary`. هذا يكفي لرسم هيكل المدينة، ولا يكفي
 * لتوجيهٍ يشبه الواقع: حين يُغلق شارع، السائق لا يدور حول الحيّ كله — يدخل
 * الشارع الموازي الذي يبعد مئتي متر. ذلك الشارع `residential`، وهو ما ينقصنا.
 *
 * التغطية هنا هي نفس نطاق المباني (WIDE) كي تُغطّى الخارطة المحمَّلة كاملة.
 *
 * ثلاثة قيود تُملي شكل السكربت:
 *
 *   1) استعلام واحد على النطاق كله يرجع 504. جرّبناه: `residential` وحدها
 *      تتجاوز مهلة Overpass. لذلك التقسيم إلى مربعات صغيرة ليس تحسيناً بل
 *      شرط نجاح. المربع الذي يفشل يُقسَّم إلى أربعة ويُعاد.
 *   2) الطريق الذي يعبر حدّ مربعين يرجع مرتين. المفتاح هو معرّف OSM لا الترتيب.
 *   3) أدب Overpass: طلب واحد في كل مرة، ومهلة بينها. التوازي يُحظر المضيف.
 *
 * الوسوم المُلتقطة تتجاوز ما يلتقطه `fetch-roads.js`، لأن التوجيه يحتاجها:
 *   - `oneway`   اتجاه واحد. تجاهله يفتح مسارات لا يسلكها سائق.
 *   - `junction` الدوّار اتجاهٌ واحد ضمناً وإن لم يُوسم.
 *   - `maxspeed` السرعة المعلنة حين تُذكر، أدقّ من الاستنتاج من التصنيف.
 *   - `access`   الخاص والممنوع يُسقطان: ليسا مساراً بديلاً لأحد.
 *
 * تُلتقط كذلك عُقد الإشارات الضوئية. تأخير التقاطع هو نصف واقعية زمن الرحلة
 * داخل المدينة، ولا يُستنتج من هندسة الطريق — يحتاج موقع الإشارة نفسه.
 *
 *     node scripts/fetch-neighbourhood-roads.js
 *     node scripts/fetch-neighbourhood-roads.js --resume   # يكمل ما نقص
 *
 * يُشغَّل مرة؛ الناتج يُلتزم في المستودع. لا طلب شبكة وقت التشغيل.
 * بيانات © مساهمو OpenStreetMap — رخصة ODbL.
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const CACHE = path.join(DATA, '.hood-cache');

/** نفس نطاق المباني: الشوارع تُغطّي ما تُغطّيه الخارطة المحمَّلة. */
const WIDE = { south: 24.545, west: 46.530, north: 24.880, east: 46.855 };

/** عشرة في عشرة ≈ 3.7 × 3.3 كم للمربع — أثقل مربع فيه يعود في أربع ثوانٍ. */
const TILES_X = 10;
const TILES_Y = 10;

/** المربع الفاشل يُقسَّم إلى أربعة، حتى ثلاث مرات. أعمق من ذلك يعني عطلاً لا حجماً. */
const MAX_DEPTH = 3;

const PAUSE_MS = 900;

/**
 * الترتيب مقيس لا مفترض، وقياسٌ ثانٍ نقضَ الأول.
 * ---------------------------------------------------------------------------
 * المرايا الرسمية تكفي لمئات الطلبات لا لآلافها: بعد نحو عشرين مربعاً بدأت
 * `overpass-api.de` تردّ 429، و`kumi` و`private.coffee` 504 و502. وليست
 * المشكلة حجم المربع — قُيس ذلك: المربع نفسه على مرآة غير مثقلة يعود في أربع
 * ثوانٍ. فالحصّة لا الحجم.
 *
 * مربعٌ كثيف في وسط الرياض (3.7 × 3.3 كم · 471 ك.ب) على كل مرآة:
 *   maps.mail.ru          3.8 ث · 200
 *   overpass-api.de       7.5 ث · 429 (بعد الاستهلاك)
 *   kumi.systems         85.2 ث · 504
 *   private.coffee      115.8 ث · 502
 *
 * فالمرآة الأخفّ حِملاً أولاً، والرسمية احتياطاً. والأدب يبقى: طلبٌ واحد في
 * كل مرة ومهلة بينها، فالسرعة هنا هدية المضيف لا حقٌّ نأخذه.
 */
const MIRRORS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/**
 * شوارع الأحياء التي يسلكها سائق فعلاً.
 * `service` مستثنى عمداً: 9,336 مقطعاً معظمها ممرات مواقف ومداخل بيوت،
 * تضخّم الرسم ولا تصلح تحويلة. `track` و`path` ليسا طريق سيارة.
 */
const HOOD = '^(residential|unclassified|living_street)$';

const box = (b) => `${b.south},${b.west},${b.north},${b.east}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tileQuery(b) {
  return `[out:json][timeout:120];
(way["highway"~"${HOOD}"](${box(b)}););
out geom;`;
}

function signalQuery(b) {
  return `[out:json][timeout:120];
(node["highway"~"^(traffic_signals|stop|mini_roundabout)$"](${box(b)}););
out;`;
}

/**
 * انتظار خانة قبل الطلب.
 * ---------------------------------------------------------------------------
 * Overpass يمنح كل عنوان خانتين. تجاوزُهما يردّ 429، وأول ردّ فعل خاطئ هو
 * تقسيم المربع — لأن الرفض ليس عن حجم بل عن عدد، فالتقسيم يضاعف الطلبات
 * ويعمّق الحظر. قيس ذلك: بعامِلَين متوازيين ردّت المرايا الثلاث
 * 429 و504 و502 معاً؛ وبعامل واحد ينتظر خانته تمرّ الطلبات.
 *
 * `/api/status` يقول متى تُفرَج خانة، فيُنتظر ما يقوله لا ما نخمّنه.
 */
/**
 * مهلة لكل طلب.
 * ---------------------------------------------------------------------------
 * `fetch` بلا مهلة ينتظر إلى الأبد. وقع ذلك: مرآةٌ قبلت الاتصال ولم تردّ، فوقف
 * الجلب على مربعٍ واحد ستّ دقائق بلا سطرٍ في السجل — عطلٌ صامت أسوأ من فشلٍ
 * معلن. المهلة تحوّله إلى «تخطِّ هذه المرآة».
 */
const REQUEST_TIMEOUT_MS = 75000;

async function waitForSlot(endpoint) {
  const statusUrl = endpoint.replace(/\/interpreter$/, '/status');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let text;
    try {
      const response = await fetch(statusUrl, {
        headers: { 'User-Agent': 'athar-roads-builder' },
        signal: AbortSignal.timeout(20000),
      });
      text = await response.text();
    } catch (err) {
      return;
    }
    if (/slots? available now/i.test(text)) return;
    const waits = [...text.matchAll(/in (-?\d+) seconds/g)].map((m) => Number(m[1]));
    const soonest = waits.length ? Math.max(1, Math.min(...waits)) : 5;
    await sleep(Math.min(soonest + 1, 60) * 1000);
  }
}

/** حالاتٌ يعالجها الانتظار لا التقسيم: الخانات مشغولة والمضيف متعب. */
const BACKOFF_STATUS = new Set([429, 502, 503, 504]);

async function ask(query) {
  let last = 'لا مرايا';
  for (let round = 0; round < 3; round += 1) {
    for (const endpoint of MIRRORS) {
      if (endpoint.indexOf('overpass-api.de') !== -1) await waitForSlot(endpoint);
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'athar-roads-builder',
          },
          body: new URLSearchParams({ data: query }).toString(),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        last = `${endpoint.split('/')[2]}: ${err.message}`;
        continue;
      }
      if (response.ok) {
        try {
          return await response.json();
        } catch (err) {
          last = `${endpoint}: رد غير صالح`;
          continue;
        }
      }
      last = `HTTP ${response.status}`;
      // تراجعٌ متزايد: 8 ثوانٍ ثم 24 ثم 72 — لا إغراقٌ يعمّق الحظر.
      if (BACKOFF_STATUS.has(response.status)) await sleep(8000 * Math.pow(3, round));
      else await sleep(PAUSE_MS);
    }
  }
  throw new Error(last);
}

/** يجلب مربعاً؛ يقسّمه عند الفشل. يرجع مصفوفة عناصر Overpass. */
async function fetchBox(b, query, depth, label) {
  try {
    const body = await ask(query(b));
    const elements = body.elements || [];
    console.log(`  ${label} · ${elements.length} عنصراً`);
    return elements;
  } catch (err) {
    if (depth >= MAX_DEPTH) {
      console.log(`  ${label} · فشل نهائي — ${err.message}`);
      return [];
    }
    console.log(`  ${label} · يُقسَّم (${err.message})`);
    const midLat = (b.south + b.north) / 2;
    const midLon = (b.west + b.east) / 2;
    const quads = [
      { south: b.south, west: b.west, north: midLat, east: midLon },
      { south: b.south, west: midLon, north: midLat, east: b.east },
      { south: midLat, west: b.west, north: b.north, east: midLon },
      { south: midLat, west: midLon, north: b.north, east: b.east },
    ];
    let out = [];
    for (let i = 0; i < quads.length; i += 1) {
      await sleep(PAUSE_MS);
      out = out.concat(await fetchBox(quads[i], query, depth + 1, `${label}.${i + 1}`));
    }
    return out;
  }
}

function tiles() {
  const out = [];
  const dLat = (WIDE.north - WIDE.south) / TILES_Y;
  const dLon = (WIDE.east - WIDE.west) / TILES_X;
  for (let y = 0; y < TILES_Y; y += 1) {
    for (let x = 0; x < TILES_X; x += 1) {
      out.push({
        // اسم المربع يحمل أبعاد الشبكة: تغييرُها يجعل المخبأ القديم اسماً
        // مختلفاً لا حمولةً خاطئة تحت الاسم نفسه.
        name: `${TILES_Y}x${TILES_X}-${y + 1}-${x + 1}`,
        south: WIDE.south + y * dLat,
        north: WIDE.south + (y + 1) * dLat,
        west: WIDE.west + x * dLon,
        east: WIDE.west + (x + 1) * dLon,
      });
    }
  }
  return out;
}

function toLanes(tags) {
  const value = Number(tags.lanes);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** السرعة المعلنة بالكيلومتر/ساعة، أو null. `30 mph` يُحوَّل. */
function toMaxspeed(tags) {
  const raw = tags.maxspeed;
  if (!raw) return null;
  const mph = /mph/i.test(raw);
  const value = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(mph ? value * 1.609 : value);
}

/**
 * اتجاه السير: 1 مع رسم الطريق، -1 عكسه، 0 مزدوج.
 * الدوّار اتجاهٌ واحد ولو لم يُوسم — قاعدة OSM المعلنة.
 */
function toOneway(tags) {
  const raw = tags.oneway;
  if (raw === 'yes' || raw === '1' || raw === 'true') return 1;
  if (raw === '-1' || raw === 'reverse') return -1;
  if (raw === 'no') return 0;
  if (tags.junction === 'roundabout' || tags.junction === 'circular') return 1;
  return 0;
}

/** الطريق الخاص أو الممنوع ليس تحويلة. */
function isBlocked(tags) {
  const access = tags.access;
  if (access === 'private' || access === 'no' || access === 'customers') return true;
  if (tags.motor_vehicle === 'no' || tags.vehicle === 'no') return true;
  return false;
}

function toFeature(element) {
  const tags = element.tags || {};
  if (isBlocked(tags)) return null;

  const coordinates = element.geometry.map((point) => [
    Number(point.lon.toFixed(5)),
    Number(point.lat.toFixed(5)),
  ]);
  const deduped = coordinates.filter((point, index) => {
    if (index === 0) return true;
    const previous = coordinates[index - 1];
    return point[0] !== previous[0] || point[1] !== previous[1];
  });
  if (deduped.length < 2) return null;

  const properties = { osmId: `w${element.id}`, highway: tags.highway };
  if (tags.name) properties.name = tags.name;
  const lanes = toLanes(tags);
  if (lanes) properties.lanes = lanes;
  const maxspeed = toMaxspeed(tags);
  if (maxspeed) properties.maxspeed = maxspeed;
  const oneway = toOneway(tags);
  if (oneway) properties.oneway = oneway;

  return { type: 'Feature', properties: properties, geometry: { type: 'LineString', coordinates: deduped } };
}

function writePayload(file, name, value) {
  const json = JSON.stringify(value);
  // JSON.parse أسرع من قراءة كائن حرفي بميغابايتات: المحرّك يقرأ نصاً لا شجرة.
  fs.writeFileSync(file, `window.${name} = JSON.parse(${JSON.stringify(json)});\n`);
  return json.length;
}

async function main() {
  const resume = process.argv.includes('--resume');
  /**
   * Overpass يسمح بخانتين متزامنتين لكل عنوان. فالمربعات تُملأ من طرفين:
   * عمليةٌ من الأول وأخرى بـ`--reverse` من الآخر، وكلتاهما تقرأ المخبأ فتتوقف
   * عن إعادة ما مُلئ. `--cache-only` تمنع الثانية من كتابة الناتج نصفَ مملوء.
   */
  const reverse = process.argv.includes('--reverse');
  const cacheOnly = process.argv.includes('--cache-only');
  if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });

  const grid = tiles();
  const walk = reverse ? grid.slice().reverse() : grid;
  const ways = new Map();
  const signals = new Map();

  console.log(`شوارع الأحياء — ${grid.length} مربعاً`);
  for (let i = 0; i < walk.length; i += 1) {
    const tile = walk[i];
    const cacheFile = path.join(CACHE, `hood-${tile.name}.json`);
    let elements;

    if (resume && fs.existsSync(cacheFile)) {
      elements = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      console.log(`  ${tile.name} · من المخبأ (${elements.length})`);
    } else {
      elements = await fetchBox(tile, tileQuery, 0, `${tile.name} [${i + 1}/${walk.length}]`);
      fs.writeFileSync(cacheFile, JSON.stringify(elements));
      await sleep(PAUSE_MS);
    }

    for (const element of elements) {
      if (element.type !== 'way' || !Array.isArray(element.geometry)) continue;
      if (element.geometry.length < 2) continue;
      if (ways.has(element.id)) continue;
      ways.set(element.id, element);
    }
  }

  if (cacheOnly) {
    console.log('المخبأ مملوء — الكتابة متروكة للعملية الأولى.');
    return;
  }

  /**
   * العُقد أخفّ من الأضلاع بمراتب: استعلامٌ واحد على النطاق كله يكفي عادةً،
   * والتقسيم يبقى احتياطاً في `fetchBox` إن ردّ المضيف بمهلة.
   */
  console.log('عُقد التحكّم — النطاق كله');
  const signalCache = path.join(CACHE, 'signals.json');
  let signalElements;
  if (resume && fs.existsSync(signalCache)) {
    signalElements = JSON.parse(fs.readFileSync(signalCache, 'utf8'));
    console.log(`  من المخبأ (${signalElements.length})`);
  } else {
    signalElements = await fetchBox(WIDE, signalQuery, 0, 'إشارات');
    fs.writeFileSync(signalCache, JSON.stringify(signalElements));
  }
  for (const element of signalElements) {
    if (element.type !== 'node') continue;
    signals.set(element.id, element);
  }

  const features = [];
  for (const element of ways.values()) {
    const feature = toFeature(element);
    if (feature) features.push(feature);
  }

  const collection = { type: 'FeatureCollection', features: features };
  const raw = JSON.stringify(collection);
  fs.writeFileSync(path.join(DATA, 'riyadh-roads-neighbourhood.geojson'), `${raw}\n`);
  const size = writePayload(
    path.join(DATA, 'riyadh-roads-neighbourhood.geojson.js'),
    'RIYADH_ROADS_HOOD',
    collection
  );

  const kinds = { traffic_signals: 0, stop: 0, mini_roundabout: 0 };
  const points = [];
  for (const node of signals.values()) {
    const kind = (node.tags || {}).highway;
    if (!(kind in kinds)) continue;
    kinds[kind] += 1;
    points.push([
      Number(node.lon.toFixed(5)),
      Number(node.lat.toFixed(5)),
      kind === 'traffic_signals' ? 2 : kind === 'mini_roundabout' ? 1 : 0,
    ]);
  }
  const signalSize = writePayload(
    path.join(DATA, 'riyadh-traffic-control.js'),
    'RIYADH_TRAFFIC_CONTROL',
    { metadata: { bbox: WIDE, counts: kinds, source: 'OpenStreetMap (ODbL)' }, points: points }
  );

  const named = features.filter((f) => f.properties.name).length;
  const oneway = features.filter((f) => f.properties.oneway).length;
  console.log('');
  console.log(`${features.length} مقطعاً · ${named} مسمّى · ${oneway} باتجاه واحد · `
    + `${(size / 1048576).toFixed(2)} ميغابايت`);
  console.log(`${points.length} عقدة تحكّم (${kinds.traffic_signals} إشارة · `
    + `${kinds.stop} قف · ${kinds.mini_roundabout} دوّار صغير) · `
    + `${(signalSize / 1024).toFixed(0)} كيلوبايت`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
