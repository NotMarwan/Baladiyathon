'use strict';
/**
 * يجلب مبانٍ حقيقية من OpenStreetMap داخل نطاق العرض الأساسي.
 * ---------------------------------------------------------------------------
 * الخريطة بلا مبانٍ تُقرأ ورقةً بيضاء عليها خطوط: لا كتلة عمرانية، ولا فرق بين
 * حي سكني وأرض فضاء. المباني هي ما يعطي القاعدة نسيجها وعمقها.
 *
 * النطاق نطاق شبكة الطرق نفسه، لا نطاقاً أضيق: النسيج يظهر من z11.5، وعند ذلك
 * التقريب يُرى عرض المدينة كاملاً. نطاق أضيق يرسم مستطيلاً من المباني ينتهي
 * بخط مستقيم في وسط الفراغ — وهو أسوأ من غياب المباني كلها.
 *
 * الدقة مقدَّمة على الحجم:
 * - الإحداثيات إلى ٦ منازل (~١٠ سم) — الحواف تُرسم من z13، وعندها يُرى تقريب
 *   المتر الواحد انكساراً في الخط.
 * - لا حدّ أدنى للمساحة يُذكر (٢٠ م² لطرد الفوضى وحدها): الملحق والمظلة جزء
 *   من النسيج، وإسقاطهما يترك ثقوباً في الحي.
 * - الخصائص تُختزل إلى `a`: شريحة المساحة (0..3) تقود درجة اللون.
 * - يُكتب الملف المغلَّف وحده: الخام نسخة ثانية بنفس الحجم لا يقرؤها أحد.
 *
 * يُشغَّل مرة؛ الناتج يُلتزم في المستودع.
 * بيانات © مساهمو OpenStreetMap — رخصة ODbL.
 */
const fs = require('fs');
const path = require('path');

// نفس نطاق scripts/fetch-roads.js — النسيج يجب أن يمتد مع الشبكة لا أن ينقطع.
const BBOX = { south: 24.545, west: 46.530, north: 24.880, east: 46.855 };

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const QUERY = `[out:json][timeout:180];
way["building"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
out geom;`;

const MIN_AREA_M2 = 20;
const COORD_DECIMALS = 6;
const METRES_PER_DEGREE = 111320;

/** مساحة الحلقة بالمتر المربع — صيغة الحذاء مع تصحيح خط العرض. */
function ringArea(ring) {
  const lat = ring[0][1] * (Math.PI / 180);
  const scaleX = METRES_PER_DEGREE * Math.cos(lat);
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x1 * scaleX) * (y2 * METRES_PER_DEGREE) - (x2 * scaleX) * (y1 * METRES_PER_DEGREE);
  }
  return Math.abs(sum) / 2;
}

/**
 * شريحة المساحة لا المساحة نفسها.
 * الفيلا والبرج يفصلهما رقم كبير؛ ما يحتاجه اللون أربع درجات لا مئة، والشريحة
 * تُخزَّن بحرف واحد بدل رقم عشري لكل مبنى.
 */
function areaBucket(area) {
  if (area >= 4000) return 3;
  if (area >= 1200) return 2;
  if (area >= 350) return 1;
  return 0;
}

async function query() {
  let lastError = 'لا مرايا';
  for (const endpoint of OVERPASS_MIRRORS) {
    process.stderr.write(`محاولة ${endpoint}\n`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'athar-basemap-builder',
      },
      body: new URLSearchParams({ data: QUERY }).toString(),
    }).catch((err) => ({ ok: false, status: err.message }));

    if (response.ok) return response.json();
    lastError = `${endpoint}: HTTP ${response.status}`;
    console.error(`تخطي ${lastError}`);
  }
  throw new Error(`كل المرايا فشلت — ${lastError}`);
}

async function main() {
  const body = await query();
  const features = [];
  let dropped = 0;

  for (const element of body.elements || []) {
    if (!Array.isArray(element.geometry) || element.geometry.length < 4) continue;

    const ring = element.geometry.map((p) => [
      Number(p.lon.toFixed(COORD_DECIMALS)),
      Number(p.lat.toFixed(COORD_DECIMALS)),
    ]);
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    if (ring.length < 4) continue;

    const area = ringArea(ring);
    if (area < MIN_AREA_M2) { dropped += 1; continue; }

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { a: areaBucket(area) },
    });
  }

  const out = { type: 'FeatureCollection', features };
  const dir = path.join(__dirname, '..', 'data');
  // المغلَّف وحده: يعمل عبر file:// حيث يمنع fetch قراءة الملفات المحلية، وهو
  // الملف الذي تقرؤه الصفحة فعلاً. نسخة خام بجانبه تعني عشرين ميغابايت لا تُقرأ.
  const file = path.join(dir, 'riyadh-buildings.geojson.js');
  fs.writeFileSync(file, `window.RIYADH_BUILDINGS = ${JSON.stringify(out)};\n`);
  const mb = (fs.statSync(file).size / 1048576).toFixed(1);
  console.log(`buildings: ${features.length} مبنى (${dropped} أصغر من ${MIN_AREA_M2} م² أُسقطت) → ${mb} ميغابايت`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
