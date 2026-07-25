/**
 * أثر — تنحيف شبكة الطرق.
 * ---------------------------------------------------------------------------
 * 3.43 م.ب تُفكّ كسكربت متزامن قبل أول إطار. هذا الملف يقصّها بثلاث عمليات
 * كلها عكوسة المعنى — لا تُسقط طريقاً ولا تغيّر تصنيفاً:
 *
 *   1) إسقاط الخصائص الفارغة. `"lanes":null,"aadt":null` تتكرر آلاف المرات
 *      وتعني ما يعنيه غيابها تماماً.
 *   2) تبسيط Douglas–Peucker بتفاوت أصغر من عرض حارة. عند أقصى تقريب تسمح
 *      به الصفحة يقع الانحراف دون نصف بكسل، فهو غير مرئي بالبناء لا بالأمل.
 *   3) الفصل إلى حلقتين: شرايين تُحمَّل فوراً، وفرعية تُحمَّل بعد أول إطار.
 *      الشرايين هي ما يُقرأ عند تقريب المدينة؛ الفرعية زينة حتى يقترب المراجع.
 *
 * التفاوت يُعلن في صفحة المصادر — تبسيط غير معلن تزوير صامت.
 *
 *     node scripts/slim-roads.js            # يكتب الملفات
 *     node scripts/slim-roads.js --dry      # يطبع الوفر ولا يكتب
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');

/**
 * المصدر هو GeoJSON الخام لا غلاف المتصفح.
 * ---------------------------------------------------------------------------
 * الخام يبقى كما نزل من Overpass: عليه يُبنى المحفظة وتُقاس الاختبارات، فلا
 * يمسّه التنحيف. المُنحَّف حمولة عرض تُشتقّ منه في كل مرة — فالعملية معيدة
 * لنفسها، وتشغيلها مرتين لا يُنحّف المُنحَّف.
 */
const SOURCE = path.join(DATA, 'riyadh-roads.geojson');

/** درجة عرض ≈ 111,320 م. التفاوت بالأمتار يتحوّل إلى درجات بهذا. */
const METERS_PER_DEGREE = 111320;
const TOLERANCE_M = 3;
const TOLERANCE_DEG = TOLERANCE_M / METERS_PER_DEGREE;

/** الشرايين: ما يجب أن يُرى لحظة فتح الصفحة عند تقريب المدينة. */
const ARTERIAL = new Set([
  'motorway', 'trunk', 'primary', 'secondary',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link',
]);

const PRECISION = 5;

/** المسافة العمودية من نقطة إلى المستقيم الواصل بين طرفين، بالدرجات. */
function perpendicular(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];

  if (dx === 0 && dy === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }

  const t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(
    point[0] - (start[0] + clamped * dx),
    point[1] - (start[1] + clamped * dy)
  );
}

/**
 * Douglas–Peucker تكراري لا تعاودي: بعض السلاسل هنا تتجاوز ألف نقطة،
 * والتعاود عليها يخاطر بعمق المكدس على أجهزة متواضعة.
 */
function simplify(points, tolerance) {
  if (points.length <= 2) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop();
    let worst = 0;
    let at = -1;

    for (let i = first + 1; i < last; i += 1) {
      const distance = perpendicular(points[i], points[first], points[last]);
      if (distance > worst) { worst = distance; at = i; }
    }

    if (at !== -1 && worst > tolerance) {
      keep[at] = 1;
      stack.push([first, at], [at, last]);
    }
  }

  const out = [];
  for (let i = 0; i < points.length; i += 1) if (keep[i]) out.push(points[i]);
  return out;
}

function round(value) {
  return Number(value.toFixed(PRECISION));
}

/** الخصائص الفارغة تُسقط: غيابها يقول ما يقوله null، بلا بايتات. */
function slimProperties(properties) {
  const out = {};
  Object.keys(properties).forEach((key) => {
    const value = properties[key];
    if (value === null || value === undefined || value === '') return;
    out[key] = value;
  });
  return out;
}

function slimFeature(feature) {
  const coordinates = feature.geometry.coordinates.map((point) => [round(point[0]), round(point[1])]);
  return {
    type: 'Feature',
    properties: slimProperties(feature.properties),
    geometry: { type: 'LineString', coordinates: simplify(coordinates, TOLERANCE_DEG) },
  };
}

function collection(features) {
  return { type: 'FeatureCollection', features };
}

function pointsIn(features) {
  return features.reduce((sum, feature) => sum + feature.geometry.coordinates.length, 0);
}

function main() {
  const dry = process.argv.indexOf('--dry') !== -1;

  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));

  const before = {
    bytes: fs.statSync(SOURCE).size,
    features: source.features.length,
    points: pointsIn(source.features),
  };

  const slimmed = source.features.map(slimFeature);
  const arterial = slimmed.filter((f) => ARTERIAL.has(f.properties.highway));
  const local = slimmed.filter((f) => !ARTERIAL.has(f.properties.highway));

  const arterialText = 'window.RIYADH_ROADS = ' + JSON.stringify(collection(arterial)) + ';\n';
  const localText = 'window.RIYADH_ROADS_LOCAL = ' + JSON.stringify(collection(local)) + ';\n';

  const after = {
    arterialBytes: Buffer.byteLength(arterialText),
    localBytes: Buffer.byteLength(localText),
    arterialFeatures: arterial.length,
    localFeatures: local.length,
    points: pointsIn(slimmed),
  };

  const kb = (bytes) => Math.round(bytes / 1024);
  console.log('قبل   : ' + kb(before.bytes) + ' ك.ب · ' + before.features + ' مقطعاً · '
    + before.points + ' نقطة');
  console.log('شرايين: ' + kb(after.arterialBytes) + ' ك.ب · ' + after.arterialFeatures + ' مقطعاً');
  console.log('فرعية : ' + kb(after.localBytes) + ' ك.ب · ' + after.localFeatures + ' مقطعاً');
  console.log('النقاط: ' + after.points + ' ('
    + Math.round((1 - after.points / before.points) * 100) + '٪ أقل)');
  console.log('الحلقة الأولى أخفّ بـ '
    + Math.round((1 - after.arterialBytes / before.bytes) * 100) + '٪');

  if (dry) return;

  fs.writeFileSync(path.join(DATA, 'riyadh-roads.geojson.js'), arterialText);
  fs.writeFileSync(path.join(DATA, 'riyadh-roads-local.geojson.js'), localText);
  console.log('كُتبت data/riyadh-roads.geojson.js و data/riyadh-roads-local.geojson.js');
}

if (require.main === module) main();

module.exports = { simplify, slimProperties, TOLERANCE_M, ARTERIAL };
