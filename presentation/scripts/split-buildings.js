'use strict';
/**
 * مسار — تقسيم المباني إلى بلاطات مكانية ونظرةٍ عامة خفيفة.
 * ---------------------------------------------------------------------------
 * الملف الواحد `data/riyadh-buildings.geojson.js` يحمل 456,252 مبنى في 101
 * ميغابايت، ويُسلَّم إلى MapLibre مصدراً واحداً. وقيس أثر ذلك على متصفح نظيف:
 *
 *   عند تقريب 500 متر: 123 ميغابايت مُنزَّلة، ولا مبنى مرسوم حتى **40 ثانية**.
 *   عند تقريب 100 متر: نفس الحمولة، والرسم عند **10 ثوانٍ**.
 *
 * والفرق ليس عتبةَ تكبير في الشيفرة — لا وجود لها — بل كلفةُ التبليط: شاشةٌ
 * عريضة تُدخل خمسة عشر ألف مضلع في الإطار فيقضي العامل عشرين ثانية يقسّمها،
 * وشاشةٌ ضيّقة تُدخل مئتين وستّين فيظهر فوراً. فمن نزل إلى مئة متر رأى المباني
 * ثم بقيت معه صاعداً، ومن فتح الخريطة على خمسمئة ظنّها بلا تفاصيل.
 *
 * الحلّ طبقتان لا حمولة واحدة:
 *
 * ١) **نظرة عامة** لكل المدينة: شبكةُ خلايا بمقدار تغطيةٍ مبنية لكل خلية، لا
 *    مضلعات. 456 ألف مضلع تُقرأ عند تقريب المدينة كثافةً لا مبانيَ — وهو ما
 *    يقوله تعليق الطبقة نفسه — فالكثافة تُرسل كثافةً. مئاتُ الكيلوبايتات بدل
 *    مئة ميغابايت.
 *
 * ٢) **بلاطات تفصيلية** بمضلعاتها الحقيقية، تُطلب حسب نطاق العرض الحالي وحده.
 *
 *     node scripts/split-buildings.js
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const SOURCE = path.join(DATA, 'riyadh-buildings.geojson.js');
const TILE_DIR = path.join(DATA, 'buildings');

/**
 * أصلٌ وخطوةٌ بأرقام مستديرة لا بحدود البيانات.
 * حدودُ البيانات تتغيّر مع كل جلب، ومفتاحُ البلاطة المحسوب منها يتغيّر معها —
 * فتسقط كل بلاطة مخزّنة عند المستعمل. الأصل الثابت يجعل المفتاح ثابتاً.
 */
const ORIGIN = [46.52, 24.54];
const CELL = 0.0125;
const COLS = 28;
const ROWS = 28;

/** خلية النظرة العامة: ثُمن البلاطة — نحو 160 متراً، بكسلٌ ونصف عند تقريب المدينة. */
const OVERVIEW_SPLIT = 8;

/** دقّة الإحداثيات: خمس خانات ≈ متر واحد. أكثر منها بايتاتٌ لا تُرى. */
const DECIMALS = 5;

function round(value) {
  return Number(value.toFixed(DECIMALS));
}

function readBuildings() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  const sandbox = {};
  new Function('window', 'JSON', source)(sandbox, JSON);
  const collection = sandbox.RIYADH_BUILDINGS;
  if (!collection || !collection.features) throw new Error('الملف بلا RIYADH_BUILDINGS');
  return collection.features;
}

/** صندوق المضلع — يُحسب مرة ويُستعمل في الإسناد وفي التغطية. */
function boxOf(feature) {
  const ring = feature.geometry.coordinates[0] || [];
  let west = Infinity; let south = Infinity; let east = -Infinity; let north = -Infinity;
  for (let i = 0; i < ring.length; i += 1) {
    const point = ring[i];
    if (point[0] < west) west = point[0];
    if (point[0] > east) east = point[0];
    if (point[1] < south) south = point[1];
    if (point[1] > north) north = point[1];
  }
  return [west, south, east, north];
}

function main() {
  const features = readBuildings();
  console.log('مبانٍ:', features.length.toLocaleString('en'));

  const tiles = new Map();
  const overview = new Map();
  const overviewCell = CELL / OVERVIEW_SPLIT;
  let outside = 0;

  features.forEach((feature) => {
    const box = boxOf(feature);
    const midLon = (box[0] + box[2]) / 2;
    const midLat = (box[1] + box[3]) / 2;
    const col = Math.floor((midLon - ORIGIN[0]) / CELL);
    const row = Math.floor((midLat - ORIGIN[1]) / CELL);
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) { outside += 1; return; }

    // البلاطة تملك المبنى بمركزه، فلا يتكرّر مبنى بين بلاطتين ولا يسقط بينهما.
    const key = col + '-' + row;
    let bucket = tiles.get(key);
    if (!bucket) { bucket = []; tiles.set(key, bucket); }
    bucket.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: feature.geometry.coordinates.map(
          (ring) => ring.map((point) => [round(point[0]), round(point[1])])
        ),
      },
      properties: { a: feature.properties.a },
    });

    // التغطية: نصيب صندوق المبنى من مساحة خلية النظرة العامة.
    const ocol = Math.floor((midLon - ORIGIN[0]) / overviewCell);
    const orow = Math.floor((midLat - ORIGIN[1]) / overviewCell);
    const okey = ocol + ',' + orow;
    const area = Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1]);
    overview.set(okey, (overview.get(okey) || 0) + area);
  });

  if (outside) console.log('خارج الشبكة (مُسقَطة):', outside);

  if (fs.existsSync(TILE_DIR)) {
    fs.readdirSync(TILE_DIR).forEach((name) => fs.unlinkSync(path.join(TILE_DIR, name)));
  } else {
    fs.mkdirSync(TILE_DIR, { recursive: true });
  }

  const index = {};
  let biggest = 0;
  let total = 0;
  tiles.forEach((bucket, key) => {
    const json = JSON.stringify({ type: 'FeatureCollection', features: bucket });
    fs.writeFileSync(path.join(TILE_DIR, key + '.json'), json);
    index[key] = bucket.length;
    total += json.length;
    if (json.length > biggest) biggest = json.length;
  });

  fs.writeFileSync(path.join(DATA, 'buildings-index.json'), JSON.stringify({
    origin: ORIGIN, cell: CELL, cols: COLS, rows: ROWS,
    dir: 'data/buildings/', tiles: index,
  }));

  /**
   * النظرة العامة مضغوطة بالشبكة لا بالهندسة.
   * الشبكة منتظمة، فإرسال مستطيلٍ كامل لكل خلية إعادةٌ لما يُشتقّ حساباً. ثلاثة
   * أعداد لكل خلية — عمود وصف وتغطية — والعميل يبني المضلعات مرة واحدة.
   */
  const cellArea = overviewCell * overviewCell;
  const cells = [];
  overview.forEach((area, okey) => {
    const parts = okey.split(',');
    const share = Math.min(1, area / cellArea);
    cells.push([Number(parts[0]), Number(parts[1]), Math.max(1, Math.round(share * 100))]);
  });
  cells.sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));

  const overviewJson = 'window.RIYADH_BUILDINGS_OVERVIEW = '
    + JSON.stringify({
      origin: ORIGIN, cell: overviewCell, tile: CELL, split: OVERVIEW_SPLIT, cells: cells,
    }) + ';\n';
  fs.writeFileSync(path.join(DATA, 'buildings-overview.js'), overviewJson);

  console.log('بلاطات:', tiles.size,
    '· وسيط المبنى/بلاطة:', Math.round(features.length / tiles.size),
    '· أكبر بلاطة:', (biggest / 1048576).toFixed(2) + 'MB',
    '· المجموع:', (total / 1048576).toFixed(1) + 'MB');
  console.log('النظرة العامة:', cells.length, 'خلية ·',
    (overviewJson.length / 1024).toFixed(0) + 'KB');
}

main();
