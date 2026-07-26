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
  assert.strictEqual(Style.BASE_COLORS.stage, '#eeece8');
  assert.strictEqual(Style.BASE_COLORS.road, '#ffffff');
});

ok('style: الأرض أدكن من الشارع — بلا ذلك تختفي الشبكة', () => {
  const grey = (hex) => parseInt(hex.slice(1, 3), 16);
  assert.ok(
    grey(Style.BASE_COLORS.stage) < grey(Style.BASE_COLORS.road) - 8,
    'الأرض قريبة من بياض الشارع فلا تُقرأ الشبكة'
  );
});

ok('style: نسيج المدينة أربع درجات متصاعدة', () => {
  const grey = (hex) => parseInt(hex.slice(1, 3), 16);
  const C = Style.BASE_COLORS;
  assert.ok(grey(C.urban) < grey(C.stage), 'الحي السكني ليس أدكن من الأرض الفضاء');
  assert.ok(grey(C.building) < grey(C.urban), 'المبنى ليس أدكن من الحي');
  assert.ok(grey(C.buildingLarge) < grey(C.building), 'المبنى الكبير ليس أثقل من الصغير');
});

ok('style: طبقات المباني موجودة ومرتبة تحت الطرق', () => {
  const ids = Style.buildStyle(roads, base, OPTIONS).layers.map((l) => l.id);
  for (const id of ['base-urban', 'base-work', 'base-sand', 'buildings-shadow', 'buildings', 'buildings-edge']) {
    assert.ok(ids.includes(id), `طبقة ناقصة: ${id}`);
  }
  assert.ok(ids.indexOf('buildings-shadow') < ids.indexOf('buildings'), 'الظل فوق المبنى');
  assert.ok(ids.indexOf('buildings') < ids.indexOf('roads-casing'), 'المباني تغطي الطرق');
});

ok('style: مصدر المباني مضمّن ويقبل الوصول المتأخر', () => {
  const empty = Style.buildStyle(roads, base, OPTIONS);
  assert.strictEqual(empty.sources.buildings.data.features.length, 0, 'المباني تُنتظر قبل أول إطار');

  const fabric = { type: 'FeatureCollection', features: [{
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[46.6, 24.7], [46.601, 24.7], [46.601, 24.701], [46.6, 24.7]]] },
    properties: { a: 2 },
  }] };
  const filled = Style.buildStyle(roads, base, Object.assign({ buildings: fabric }, OPTIONS));
  assert.strictEqual(filled.sources.buildings.data.features.length, 1);
});

ok('style: لون المبنى يتدرّج مع شريحة مساحته', () => {
  const color = JSON.stringify(Style.buildingColor());
  assert.ok(color.includes('"a"'), 'اللون لا يقرأ شريحة المساحة');
  assert.ok(color.includes('interpolate'), 'اللون قفزة لا تدرّج');
});

ok('style: تباين التسمية كافٍ على أرضية فاتحة', () => {
  // نص رمادي داكن مع هالة بيضاء — مقروء فوق الطرق وفوق المساحات الخضراء
  assert.strictEqual(Style.BASE_COLORS.labelHalo, '#ffffff');
  assert.ok(Style.BASE_COLORS.label.toLowerCase() < '#999999', 'لون التسمية فاتح أكثر من اللازم');
});

/* ---- رتب الطرق: شوارع الأحياء تظهر عند الحيّ لا عند المدينة ---- */

/** يقرأ عرض تصنيف عند تقريب معيّن من تعبير `roadWidth`. */
function widthOf(expression, zoom, highway) {
  const stops = expression.slice(3);
  for (let i = 0; i < stops.length; i += 2) {
    if (stops[i] !== zoom) continue;
    const match = stops[i + 1];
    const body = match.slice(2);
    for (let j = 0; j + 1 < body.length; j += 2) {
      if (Array.isArray(body[j]) && body[j].indexOf(highway) !== -1) return body[j + 1];
    }
    return body[body.length - 1];
  }
  throw new Error(`لا توقّف عند التقريب ${zoom}`);
}

ok('style: الشارع السكني معدوم العرض عند تقريب المدينة', () => {
  // 52,845 مقطعاً سكنياً برسمٍ بعرضٍ ولو رفيع تملأ المدينة شبكةً رمادية
  // متساوية تخفي الشرايين التي جاء القارئ يقرأها.
  const width = Style.roadWidth(1);
  assert.strictEqual(widthOf(width, 10, 'residential'), 0);
  assert.strictEqual(widthOf(width, 13, 'residential'), 0);
  assert.ok(widthOf(width, 15, 'residential') > 0, 'لا يظهر السكني عند الحيّ');
});

ok('style: أربع رتب لا ثلاث — المحلي أعرض من السكني وأرقّ من الشرياني', () => {
  const width = Style.roadWidth(1);
  const major = widthOf(width, 15, 'motorway');
  const primary = widthOf(width, 15, 'primary');
  const local = widthOf(width, 15, 'tertiary');
  const minor = widthOf(width, 15, 'residential');
  assert.ok(major > primary && primary > local && local > minor,
    `الرتب غير متدرّجة: ${major} · ${primary} · ${local} · ${minor}`);
});

ok('style: أسماء شوارع الأحياء طبقةٌ على حدة بعتبة تقريب أعلى', () => {
  // عشرات آلاف الأسماء السكنية تنافس أسماء الشرايين على المواضع فتُزيحها.
  const style = Style.buildStyle(roads, base, OPTIONS);
  const main = style.layers.find((l) => l.id === 'road-labels');
  const minor = style.layers.find((l) => l.id === 'road-labels-minor');
  assert.ok(minor, 'لا طبقة أسماء للأحياء');
  assert.ok(minor.minzoom > main.minzoom,
    `عتبة الأحياء ${minor.minzoom} ليست أعلى من ${main.minzoom}`);
  assert.ok(JSON.stringify(main.filter).indexOf('residential') !== -1,
    'الطبقة الرئيسة لا تستثني السكني');
});

console.log(`\n${passed} اختبارات نجحت`);
