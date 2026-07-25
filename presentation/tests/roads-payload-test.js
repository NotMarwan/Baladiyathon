'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Lazy = require('../athar-roads-lazy.js');
const { simplify, slimProperties, TOLERANCE_M, ARTERIAL } = require('../scripts/slim-roads.js');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

function loadGlobal(file, name) {
  const previous = global.window;
  global.window = {};
  delete require.cache[require.resolve(path.join(DATA, file))];
  require(path.join(DATA, file));
  const value = global.window[name];
  global.window = previous;
  return value;
}

/* ---- التبسيط: يحفظ الشكل ولا يقصّ الطرفين ---- */

ok('التبسيط يبقي نقطتي البداية والنهاية دائماً', () => {
  const line = [[0, 0], [0.0001, 0.00001], [0.0002, 0], [0.0003, 0.00001], [0.0004, 0]];
  const out = simplify(line, 0.001);
  assert.deepStrictEqual(out[0], line[0]);
  assert.deepStrictEqual(out[out.length - 1], line[line.length - 1]);
});

ok('التبسيط لا يمسّ خطاً من نقطتين', () => {
  const line = [[46.7, 24.6], [46.8, 24.7]];
  assert.deepStrictEqual(simplify(line, 0.01), line);
});

ok('نقطة خارج التفاوت تبقى، ونقطة داخله تسقط', () => {
  const withinTolerance = [[0, 0], [0.5, 0.0000001], [1, 0]];
  assert.strictEqual(simplify(withinTolerance, 0.001).length, 2);

  const beyondTolerance = [[0, 0], [0.5, 0.5], [1, 0]];
  assert.strictEqual(simplify(beyondTolerance, 0.001).length, 3);
});

ok('التبسيط لا ينفجر على سلسلة طويلة — تكراري لا تعاودي', () => {
  const long = [];
  for (let i = 0; i < 40000; i += 1) long.push([i * 0.00001, Math.sin(i) * 0.00002]);
  assert.ok(simplify(long, 0.000001).length > 2);
});

ok('التفاوت أصغر من عرض حارة — الانحراف غير مرئي بالبناء', () => {
  assert.ok(TOLERANCE_M <= 3.5, `تفاوت ${TOLERANCE_M} م يقارب عرض الحارة`);
});

ok('الخصائص الفارغة تسقط والقيم تبقى كما هي', () => {
  const out = slimProperties({ osmId: 'w1', highway: 'primary', lanes: null, aadt: undefined, name: '' });
  assert.deepStrictEqual(out, { osmId: 'w1', highway: 'primary' });
});

ok('الخاصية ذات القيمة صفر لا تسقط — صفر رقم لا غياب', () => {
  assert.deepStrictEqual(slimProperties({ lanes: 0 }), { lanes: 0 });
});

/* ---- الحلقتان: قسمة كاملة بلا فقد ولا تكرار ---- */

const arterial = loadGlobal('riyadh-roads.geojson.js', 'RIYADH_ROADS');
const local = loadGlobal('riyadh-roads-local.geojson.js', 'RIYADH_ROADS_LOCAL');
const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'riyadh-roads.geojson'), 'utf8'));

ok('القسمة لا تفقد مقطعاً ولا تكرّره', () => {
  assert.strictEqual(arterial.features.length + local.features.length, raw.features.length);
  const ids = new Set();
  arterial.features.concat(local.features).forEach((f) => ids.add(f.properties.osmId));
  assert.strictEqual(ids.size, raw.features.length, 'تكرار بين الحلقتين');
});

ok('الحلقة الأولى شرايين فقط والثانية بلا شريان', () => {
  arterial.features.forEach((f) => assert.ok(ARTERIAL.has(f.properties.highway),
    `طريق فرعي في الحلقة الأولى: ${f.properties.highway}`));
  local.features.forEach((f) => assert.ok(!ARTERIAL.has(f.properties.highway),
    `شريان في الحلقة الثانية: ${f.properties.highway}`));
});

ok('الحلقة الأولى أخفّ من نصف الخام — وإلا فالقسمة بلا معنى', () => {
  const rawKb = fs.statSync(path.join(DATA, 'riyadh-roads.geojson')).size / 1024;
  const firstKb = fs.statSync(path.join(DATA, 'riyadh-roads.geojson.js')).size / 1024;
  assert.ok(firstKb < rawKb * 0.5,
    `الحلقة الأولى ${Math.round(firstKb)} ك.ب من ${Math.round(rawKb)} — الوفر دون النصف`);
});

ok('كل مقطع يحتفظ باسمه وتصنيفه بعد التنحيف', () => {
  const named = raw.features.filter((f) => f.properties.name).length;
  const keptNames = arterial.features.concat(local.features)
    .filter((f) => f.properties.name).length;
  assert.strictEqual(keptNames, named, 'أسماء ضاعت في التنحيف');
});

ok('لا مقطع فقد هندسته — لكل خط نقطتان على الأقل', () => {
  arterial.features.concat(local.features).forEach((f) => {
    assert.ok(f.geometry.coordinates.length >= 2, `مقطع بلا خط: ${f.properties.osmId}`);
  });
});

/* ---- وحدة التحميل المؤجَّل ---- */

ok('الدمج ينتج مجموعة ثالثة ولا يحوّر أياً من الاثنتين', () => {
  const first = { type: 'FeatureCollection', features: [{ id: 1 }] };
  const second = { type: 'FeatureCollection', features: [{ id: 2 }] };
  const merged = Lazy.merge(first, second);

  assert.strictEqual(merged.features.length, 2);
  assert.strictEqual(first.features.length, 1, 'الأولى حُوّرت');
  assert.strictEqual(second.features.length, 1, 'الثانية حُوّرت');
});

ok('واجهة بلا appendRoads تُبلَّغ ولا تُسقط الصفحة', () => {
  let reported = null;
  Lazy.attach({}, { onDone: (err) => { reported = err; } });
  assert.ok(reported instanceof Error, 'الفشل مرّ صامتاً بلا إبلاغ');
});

ok('المسار الافتراضي محلي — لا مصدر خارجي في التحميل المؤجَّل', () => {
  assert.ok(Lazy.DEFAULT_SRC.indexOf('://') === -1, 'مصدر خارجي');
  assert.ok(fs.existsSync(path.join(ROOT, Lazy.DEFAULT_SRC)), 'الملف المؤجَّل مفقود');
});

/* ---- الوصل: كل صفحة خريطة تحمّل الحلقتين ---- */

ok('كل صفحة خريطة توصل الحلقة الثانية', () => {
  // سلوك المكتب في مُقلعه لا في صفحته — والوصل يُقاس حيث يقع.
  const SURFACES = {
    'athar-desk.html': ['athar-desk.html', 'athar-desk-boot.js'],
    'athar-map.html': ['athar-map.html'],
    'athar-prototype.html': ['athar-prototype.html'],
  };

  Object.keys(SURFACES).forEach((page) => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(html.indexOf('athar-roads-lazy.js') !== -1, `${page} بلا حلقة ثانية`);

    const surface = SURFACES[page]
      .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
    assert.ok(surface.indexOf('AtharRoadsLazy.attach') !== -1,
      `${page} يحمّل الوحدة ولا يستدعيها`);
  });
});

ok('الإلحاق تراكمي: نداءان يتراكمان ولا يستبدل الثاني الأول', () => {
  // محاكاة الواجهة كما يستعملها attach — الحالة داخلية والاستبدال لا التحوير.
  let roads = { type: 'FeatureCollection', features: [{ id: 'a' }] };
  const api = {
    appendRoads(collection) {
      roads = { type: 'FeatureCollection', features: roads.features.concat(collection.features) };
      return roads.features.length;
    },
  };
  assert.strictEqual(api.appendRoads({ features: [{ id: 'b' }] }), 2);
  assert.strictEqual(api.appendRoads({ features: [{ id: 'c' }] }), 3);
});

console.log(`\n${passed} اختبارات نجحت`);
