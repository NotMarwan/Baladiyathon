'use strict';
/**
 * أثر — شبكة طرق الرياض من OpenStreetMap.
 * ---------------------------------------------------------------------------
 * التغطية على حلقتين كي يبقى الملف قابلاً للتحميل داخل الصفحة:
 *   - الحلقة الواسعة: الشرايين فقط (motorway/trunk/primary/secondary + وصلاتها).
 *   - النواة: تضاف إليها الشوارع الفرعية (tertiary + وصلاتها).
 * بهذا تمتد المدينة بصرياً بلا تضخيم حجم الملف بشوارع فرعية في الأطراف.
 *
 * الإحداثيات تُقرَّب إلى خمس منازل (≈ متر واحد) — الدقة الأعلى تضخّم الملف
 * بلا فرق مرئي عند أي تقريب تعرضه الخريطة.
 *
 * يُشغَّل مرة؛ الناتج يُلتزم في المستودع. لا طلب شبكة وقت التشغيل.
 * بيانات © مساهمو OpenStreetMap — رخصة ODbL.
 */
const fs = require('fs');
const path = require('path');

const WIDE = { south: 24.545, west: 46.530, north: 24.880, east: 46.855 };
const CORE = { south: 24.560, west: 46.585, north: 24.800, east: 46.790 };

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const ARTERIAL = '^(motorway|trunk|primary|secondary|motorway_link|trunk_link|primary_link|secondary_link)$';
const LOCAL = '^(tertiary|tertiary_link)$';

const box = (b) => `${b.south},${b.west},${b.north},${b.east}`;

const QUERY = `[out:json][timeout:180];
(
  way["highway"~"${ARTERIAL}"](${box(WIDE)});
  way["highway"~"${LOCAL}"](${box(CORE)});
);
out geom;`;

async function query() {
  let lastError = 'لا مرايا';
  for (const endpoint of OVERPASS_MIRRORS) {
    process.stdout.write(`محاولة ${endpoint} … `);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'athar-roads-builder',
      },
      body: new URLSearchParams({ data: QUERY }).toString(),
    }).catch((err) => ({ ok: false, status: err.message }));

    if (response.ok) {
      console.log('نجحت');
      return response.json();
    }
    lastError = `${endpoint}: HTTP ${response.status}`;
    console.log(`تخطي — ${lastError}`);
  }
  throw new Error(`كل المرايا فشلت — ${lastError}`);
}

function toLanes(tags) {
  const value = Number(tags.lanes);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function main() {
  const body = await query();
  const features = [];

  for (const element of body.elements || []) {
    if (element.type !== 'way' || !Array.isArray(element.geometry)) continue;
    if (element.geometry.length < 2) continue;

    const tags = element.tags || {};
    const coordinates = element.geometry.map((point) => [
      Number(point.lon.toFixed(5)),
      Number(point.lat.toFixed(5)),
    ]);

    // نقاط متطابقة بعد التقريب تُدمج — مقطع بنقطة واحدة يكسر حساب المحور.
    const deduped = coordinates.filter((point, index) => {
      if (index === 0) return true;
      const previous = coordinates[index - 1];
      return point[0] !== previous[0] || point[1] !== previous[1];
    });
    if (deduped.length < 2) continue;

    features.push({
      type: 'Feature',
      properties: {
        osmId: `w${element.id}`,
        highway: tags.highway,
        name: tags.name || null,
        lanes: toLanes(tags),
        aadt: null,
      },
      geometry: { type: 'LineString', coordinates: deduped },
    });
  }

  const collection = { type: 'FeatureCollection', features: features };
  const text = JSON.stringify(collection);
  const dir = path.join(__dirname, '..', 'data');

  fs.writeFileSync(path.join(dir, 'riyadh-roads.geojson'), `${text}\n`);
  fs.writeFileSync(path.join(dir, 'riyadh-roads.geojson.js'), `window.RIYADH_ROADS = ${text};\n`);

  const named = new Set(features.filter((f) => f.properties.name).map((f) => f.properties.name));
  const arabic = new Set([...named].filter((name) => /[؀-ۿ]/.test(name)));
  console.log(`${features.length} مقطعاً · ${named.size} اسماً (${arabic.size} عربي) · `
    + `${(text.length / 1048576).toFixed(2)} ميغابايت`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
