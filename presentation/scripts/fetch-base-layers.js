'use strict';
/**
 * يجلب المياه والمساحات الخضراء وأسماء الأحياء داخل نطاق شبكة الطرق نفسها،
 * فتكتسب الخريطة عمقاً بصرياً بلا خادم بلاطات وبلا أي طلب وقت التشغيل.
 * يُشغَّل مرة؛ الناتج يُلتزم في المستودع.
 * بيانات © مساهمو OpenStreetMap — رخصة ODbL.
 */
const fs = require('fs');
const path = require('path');

// نفس نطاق data/riyadh-roads.geojson
const BBOX = { south: 24.5855, west: 46.6355, north: 24.759, east: 46.736 };
// المرآة الرسمية تعيد 504 تحت الحمل — نجرب المرايا بالترتيب بدل الفشل من أول محاولة.
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const QUERY = `[out:json][timeout:90];
(
  way["natural"="water"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["landuse"~"^(grass|forest|recreation_ground|village_green)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["leisure"~"^(park|garden|pitch)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  node["place"~"^(suburb|neighbourhood|quarter)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out geom;`;

function kindOf(element) {
  const tags = element.tags || {};
  if (tags.natural === 'water') return 'water';
  if (tags.place) return 'place';
  return 'green';
}

async function query() {
  let lastError = 'لا مرايا';
  for (const endpoint of OVERPASS_MIRRORS) {
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
  for (const element of body.elements || []) {
    const kind = kindOf(element);

    if (element.type === 'node' && element.tags && element.tags.name) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [element.lon, element.lat] },
        properties: { kind: 'place', name: element.tags.name },
      });
      continue;
    }

    if (element.type === 'way' && Array.isArray(element.geometry) && element.geometry.length >= 4) {
      const ring = element.geometry.map((p) => [
        Number(p.lon.toFixed(5)),
        Number(p.lat.toFixed(5)),
      ]);
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: { kind, name: (element.tags && element.tags.name) || '' },
      });
    }
  }

  const out = { type: 'FeatureCollection', features };
  const file = path.join(__dirname, '..', 'data', 'riyadh-base.geojson');
  fs.writeFileSync(file, `${JSON.stringify(out)}\n`);
  console.log(`base layers: ${features.length} ميزة → data/riyadh-base.geojson`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
