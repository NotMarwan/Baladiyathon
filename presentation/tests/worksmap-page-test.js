'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Interactions = require(path.join(__dirname, '..', 'athar-worksmap-interactions.js'));
const Data = require(path.join(__dirname, '..', 'athar-worksmap-data.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'athar-map.html'), 'utf8');

ok('الصفحة تحمّل وحدات الخريطة والبيانات المحلية', () => {
  for (const file of [
    'athar-worksmap-style.js', 'athar-worksmap-layers.js', 'athar-worksmap-data.js',
    'athar-worksmap.js', 'athar-worksmap-panel.js', 'athar-worksmap-interactions.js',
    'data/riyadh-roads.geojson.js', 'data/riyadh-base.geojson.js', 'data/city-portfolio.geojson.js',
  ]) {
    assert.ok(html.indexOf(file) !== -1, `غير محمّل: ${file}`);
  }
});

ok('الصفحة بلا أي مورد خارجي', () => {
  const tags = html.match(/<(script|link|img)[^>]*>/g) || [];
  for (const tag of tags) {
    assert.ok(!/https?:\/\//.test(tag), `مورد خارجي: ${tag}`);
  }
});

ok('كل ملف تشير إليه الصفحة موجود فعلاً', () => {
  const refs = html.match(/(?:src|href)="([^"]+)"/g) || [];
  for (const ref of refs) {
    const file = ref.match(/"([^"]+)"/)[1];
    if (file.indexOf('://') !== -1 || file.startsWith('#')) continue;
    assert.ok(fs.existsSync(path.join(ROOT, file)), `ملف مفقود: ${file}`);
  }
});

ok('الصفحة تعلن شريط التنقل وحاوية اللوحة والدليل', () => {
  assert.ok(html.indexOf('src="athar-nav.js"') !== -1, 'شريط التنقل غير محمّل');
  assert.ok(html.indexOf('id="control-panel"') !== -1, 'حاوية اللوحة مفقودة');
  assert.ok(html.indexOf('wm-legend') !== -1, 'الدليل مفقود');
});

ok('شارة الصدق باقية على الصفحة', () => {
  assert.ok(html.indexOf('بيانات توضيحية للعرض') !== -1);
});

ok('الصفحة لا تشارك تنسيق النموذج — تنسيقها مستقل', () => {
  assert.ok(html.indexOf('athar-worksmap-page.css') !== -1, 'تنسيق الصفحة غير محمّل');
  assert.ok(html.indexOf('athar-map.css') === -1, 'تنسيق النموذج يسرّب إلى الصفحة');
});

ok('الخريطة تُغذّى من المحفظة الكاملة لا من عيّنة', () => {
  assert.ok(html.indexOf('ATHAR_CITY_PORTFOLIO') !== -1, 'الصفحة ما زالت على العيّنة');
  assert.ok(html.indexOf('ATHAR_WORKS_CITY') === -1, 'مرجع العيّنة القديمة باقٍ');

  const raw = fs.readFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8');
  const collection = JSON.parse(raw);
  assert.ok(collection.features.length >= 120, 'محفظة أصغر من أن تملأ المدينة');

  const normalized = Data.normalizeWorks(collection);
  assert.strictEqual(normalized.features.length, collection.features.length);

  const groups = new Set(normalized.features.map((f) => f.properties.group));
  for (const group of ['roadworks', 'closures', 'incidents', 'diversions', 'pois']) {
    assert.ok(groups.has(group), `مجموعة غير ممثَّلة في البيانات: ${group}`);
  }

  const split = Data.splitByGeometry(normalized);
  assert.ok(split.points.features.length > 0, 'لا نقاط — التجميع بلا معنى');
  assert.ok(split.lines.features.length > 50, 'مقاطع قليلة على الشوارع');
});

// فوق ١٢٫٥ يملأ حيّ العليا الإطار وتختفي بقية المحفظة؛ تحت ١٢ تظهر حواف بيضاء
// خارج تغطية بيانات الطرق. الحد الأعلى هو ما يهم: ألا تُقدَّم المحفظة كحي واحد.
ok('التقريب الافتتاحي يعرض المدينة لا الحي', () => {
  const match = html.match(/zoom:\s*([\d.]+)/);
  assert.ok(match, 'لا تقريب افتتاحي معلن');
  assert.ok(Number(match[1]) <= 12.5, `تقريب ضيّق على محفظة مدينة: ${match[1]}`);
});

ok('الشدة الصريحة في البيانات تُحترم ولا تُستبدل', () => {
  const one = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [46.68, 24.71] },
      properties: { id: 'X', group: 'incidents', severity: 3, title: 'حادث' },
    }],
  };
  assert.strictEqual(Data.normalizeWorks(one).features[0].properties.severity, 3);
});

ok('بطاقة التفاصيل تعرض العنوان والتواريخ والجهة', () => {
  const out = Interactions.popupHtml({
    group: 'roadworks', severity: 3, title: 'إصلاح خط مياه',
    description: 'إغلاق مسارين', start_ts: Date.UTC(2026, 6, 22),
    end_ts: Date.UTC(2026, 6, 30), promoter: 'شركة المياه الوطنية', id: 'W-1',
  });
  assert.ok(out.indexOf('إصلاح خط مياه') !== -1);
  assert.ok(out.indexOf('شركة المياه الوطنية') !== -1);
  assert.ok(out.indexOf('W-1') !== -1);
  assert.ok(out.indexOf('أعمال طرق') !== -1, 'اسم المجموعة غير معروض');
});

ok('بطاقة التفاصيل لا تحقن HTML من البيانات', () => {
  const out = Interactions.popupHtml({ title: '<img src=x onerror=alert(1)>', promoter: '"onmouseover="x' });
  assert.ok(out.indexOf('<img') === -1, 'تسرب HTML من العنوان');
  assert.ok(out.indexOf('onmouseover="x') === -1, 'تسرب سمة من الجهة');
});

ok('بطاقة التفاصيل تتحمل الحقول الناقصة', () => {
  const out = Interactions.popupHtml({});
  assert.ok(out.indexOf('—') !== -1, 'لا بديل للحقول الفارغة');
  assert.ok(out.indexOf('undefined') === -1, 'قيمة غير معرّفة تسربت للعرض');
});

console.log(`\n${passed} اختبارات نجحت`);
