'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Data = require(path.join(__dirname, '..', 'athar-worksmap-data.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const raw = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[46.68, 24.71], [46.69, 24.72]] },
    properties: {
      id: 'WORK-2026-0142',
      road: 'طريق الملك فهد (مقطع العليا)',
      status: 'قيد التنفيذ',
      impactLevel: 'high',
      closureCountThisYear: 1,
      from: 'تقاطع طريق العروبة',
      to: 'تقاطع طريق التخصصي',
      start: '2026-07-22T06:00:00Z',
      end: '2026-07-30T18:00:00Z',
    },
  }],
};

ok('impactLevel=high يصبح شدة 3 ونوع طوارئ', () => {
  const props = Data.normalizeWorks(raw).features[0].properties;
  assert.strictEqual(props.severity, 3);
  assert.strictEqual(props.subtype, 'emergency');
});

ok('المجموعة الافتراضية أعمال طرق', () => {
  assert.strictEqual(Data.normalizeWorks(raw).features[0].properties.group, 'roadworks');
});

ok('التواريخ تتحول إلى epoch بالمللي ثانية', () => {
  const props = Data.normalizeWorks(raw).features[0].properties;
  assert.strictEqual(props.start_ts, Date.parse('2026-07-22T06:00:00Z'));
  assert.strictEqual(props.end_ts, Date.parse('2026-07-30T18:00:00Z'));
});

ok('العنوان يجمع الطريق والمقطع', () => {
  const props = Data.normalizeWorks(raw).features[0].properties;
  assert.ok(props.title.indexOf('طريق الملك فهد') !== -1);
  assert.ok(props.description.indexOf('تقاطع طريق العروبة') !== -1);
});

ok('الحالة «مغلق» تنقل الميزة إلى مجموعة الإغلاقات', () => {
  const closed = JSON.parse(JSON.stringify(raw));
  closed.features[0].properties.status = 'مغلق';
  assert.strictEqual(Data.normalizeWorks(closed).features[0].properties.group, 'closures');
});

ok('الهندسة تبقى كما هي', () => {
  assert.deepStrictEqual(
    Data.normalizeWorks(raw).features[0].geometry,
    raw.features[0].geometry
  );
});

ok('الميزات بلا هندسة تُسقط بلا استثناء', () => {
  const broken = { type: 'FeatureCollection', features: raw.features.concat([
    { type: 'Feature', geometry: null, properties: { id: 'X' } },
  ]) };
  assert.strictEqual(Data.normalizeWorks(broken).features.length, 1);
});

ok('مدخل تالف يعطي مجموعة فارغة لا انهياراً', () => {
  assert.deepStrictEqual(Data.normalizeWorks(null).features, []);
  assert.deepStrictEqual(Data.normalizeWorks({ features: 'nope' }).features, []);
});

ok('الفصل حسب الهندسة: النقاط والخطوط مصدران', () => {
  const mixed = { type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [46.6, 24.7] }, properties: {} },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[46.6, 24.7], [46.7, 24.8]] }, properties: {} },
  ] };
  const split = Data.splitByGeometry(mixed);
  assert.strictEqual(split.points.features.length, 1);
  assert.strictEqual(split.lines.features.length, 1);
});

ok('ملف البيانات الفعلي يمر بالتطبيع كاملاً', () => {
  const file = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'data', 'works.geojson'), 'utf8'));
  const normalized = Data.normalizeWorks(file);
  assert.strictEqual(normalized.features.length, file.features.length);
  for (const feature of normalized.features) {
    assert.ok(feature.properties.start_ts > 0, `${feature.properties.id} بلا تاريخ بداية`);
    assert.ok(feature.properties.end_ts > feature.properties.start_ts, 'نهاية قبل البداية');
  }
});

ok('هندسة الأعمال تتبع محور الشارع لا خطاً مستقيماً عبر الخريطة', () => {
  // العيب الذي كسر العرض سابقاً: خط من نقطتين يقطع الأحياء بدل أن يبتلع الشارع.
  const works = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'data', 'works.geojson'), 'utf8'));
  for (const feature of works.features) {
    assert.ok(
      feature.geometry.coordinates.length >= 8,
      `${feature.properties.id}: ${feature.geometry.coordinates.length} نقاط فقط — الهندسة ليست محور شارع`
    );
  }
});

console.log(`\n${passed} اختبارات نجحت`);
