'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const base = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'data', 'riyadh-base.geojson'), 'utf8'));

ok('FeatureCollection صالح وغير فارغ', () => {
  assert.strictEqual(base.type, 'FeatureCollection');
  assert.ok(base.features.length > 50, `عدد الميزات ${base.features.length} أقل من المتوقع`);
});

ok('كل ميزة تحمل kind من المجموعة المعروفة', () => {
  const allowed = new Set(['water', 'green', 'place']);
  for (const feature of base.features) {
    assert.ok(allowed.has(feature.properties.kind), `kind غير معروف: ${feature.properties.kind}`);
  }
});

ok('المضلعات مغلقة', () => {
  const polygons = base.features.filter((f) => f.geometry.type === 'Polygon');
  assert.ok(polygons.length > 0, 'لا مضلعات');
  for (const polygon of polygons) {
    const ring = polygon.geometry.coordinates[0];
    assert.deepStrictEqual(ring[0], ring[ring.length - 1], 'حلقة غير مغلقة');
  }
});

ok('نقاط الأحياء تحمل أسماء', () => {
  const places = base.features.filter((f) => f.properties.kind === 'place');
  assert.ok(places.length > 0, 'لا أسماء أحياء');
  for (const place of places) {
    assert.ok(place.properties.name.length > 0, 'اسم حي فارغ');
  }
});

console.log(`\n${passed} اختبارات نجحت`);
