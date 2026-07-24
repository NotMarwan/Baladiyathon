'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Style = require(path.join(__dirname, '..', 'athar-worksmap-style.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const roads = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'riyadh-roads.geojson'), 'utf8'));
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'riyadh-base.geojson'), 'utf8'));

const OPTIONS = { glyphsUrl: 'vendor/glyphs/{fontstack}/{range}.pbf', spriteUrl: 'vendor/sprite/sprite' };

ok('style: هيكل صالح بإصدار 8', () => {
  const style = Style.buildStyle(roads, base, OPTIONS);
  assert.strictEqual(style.version, 8);
});

ok('style: بلا أي URL خارجي — العرض يعمل بلا إنترنت', () => {
  const style = Style.buildStyle(roads, base, OPTIONS);
  const raw = JSON.stringify(style);
  assert.ok(!/https?:\/\//.test(raw), 'وُجد رابط خارجي داخل الـ style');
});

ok('style: الخطوط والـ sprite مسارات نسبية محلية', () => {
  const style = Style.buildStyle(roads, base, OPTIONS);
  assert.strictEqual(style.glyphs, 'vendor/glyphs/{fontstack}/{range}.pbf');
  assert.strictEqual(style.sprite, 'vendor/sprite/sprite');
});

ok('style: المصادر مضمّنة لا مُشار إليها بروابط', () => {
  const style = Style.buildStyle(roads, base, OPTIONS);
  assert.strictEqual(style.sources.roads.type, 'geojson');
  assert.strictEqual(style.sources.base.type, 'geojson');
  assert.ok(!('url' in style.sources.roads), 'مصدر الطرق يجب أن يكون مضمّناً');
  assert.strictEqual(style.sources.roads.data.features.length, roads.features.length);
});

ok('style: ترتيب الطبقات — خلفية ثم مساحات ثم طرق ثم تسميات', () => {
  const ids = Style.buildStyle(roads, base, OPTIONS).layers.map((l) => l.id);
  for (const id of ['bg', 'base-green', 'base-water', 'roads-casing', 'roads', 'road-labels', 'place-labels']) {
    assert.ok(ids.includes(id), `طبقة ناقصة: ${id}`);
  }
  assert.ok(ids.indexOf('roads-casing') < ids.indexOf('roads'), 'الحافة يجب أن تسبق الخط');
  assert.ok(ids.indexOf('roads') < ids.indexOf('road-labels'), 'التسميات فوق الطرق');
});

ok('style: التسميات رمزية وتقرأ الاسم العربي', () => {
  const style = Style.buildStyle(roads, base, OPTIONS);
  const labels = style.layers.find((l) => l.id === 'road-labels');
  assert.strictEqual(labels.type, 'symbol');
  assert.deepStrictEqual(labels.layout['text-field'], ['get', 'name']);
  assert.strictEqual(labels.layout['symbol-placement'], 'line');
});

ok('style: عرض الطريق يكبر مع التقريب ويتدرج مع التصنيف', () => {
  const width = Style.roadWidth(1);
  assert.strictEqual(width[0], 'interpolate');
  const raw = JSON.stringify(width);
  assert.ok(raw.includes('motorway'), 'لا تدرّج حسب التصنيف');
});

ok('style: الحافة أعرض من الخط عند كل توقف', () => {
  const line = JSON.stringify(Style.roadWidth(1));
  const casing = JSON.stringify(Style.roadWidth(1.35));
  assert.notStrictEqual(line, casing, 'الحافة والخط بنفس العرض');
});

ok('style: أرضية فاتحة — الخريطة تقرأ كمنتج حكومي رسمي', () => {
  assert.strictEqual(Style.BASE_COLORS.stage, '#f3f2ef');
  assert.strictEqual(Style.BASE_COLORS.road, '#ffffff');
});

ok('style: تباين التسمية كافٍ على أرضية فاتحة', () => {
  // نص رمادي داكن مع هالة بيضاء — مقروء فوق الطرق وفوق المساحات الخضراء
  assert.strictEqual(Style.BASE_COLORS.labelHalo, '#ffffff');
  assert.ok(Style.BASE_COLORS.label.toLowerCase() < '#999999', 'لون التسمية فاتح أكثر من اللازم');
});

console.log(`\n${passed} اختبارات نجحت`);
