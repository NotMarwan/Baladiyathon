'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const WorksMap = require(path.join(__dirname, '..', 'masar-worksmap.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

// عقد الـ API كما يستدعيه masar-prototype.html اليوم. كسره يكسر النموذج.
const REQUIRED = [
  'onReady', 'setCorridor', 'onCorridorClick', 'setCorridorState',
  'setAllCorridorStates', 'setCorridorColors', 'setCorridorColor',
  'setDigSite', 'setAlternatives', 'sweepUnlock', 'setPhase',
  'updateRoad', 'onRoadClick', 'getData',
];

// ما يضيفه مكتب المراجع فوق العقد الأصلي — إضافة لا استبدال.
const DESK_ADDITIONS = ['setWorks', 'setDateRange', 'toggleGroup', 'highlightWork', 'onWorkClick'];

ok('العقد معلن في الوحدة', () => {
  for (const name of REQUIRED) {
    assert.ok(WorksMap.API_METHODS.indexOf(name) !== -1, `مفقود من العقد: ${name}`);
  }
});

ok('عقد المكتب مضاف بلا كسر العقد الأصلي', () => {
  for (const name of DESK_ADDITIONS) {
    assert.ok(WorksMap.API_METHODS.indexOf(name) !== -1, `مفقود من عقد المكتب: ${name}`);
  }
  assert.strictEqual(WorksMap.API_METHODS.length, REQUIRED.length + DESK_ADDITIONS.length,
    'العقد يحمل دوالّ غير معلنة في أي من القائمتين');
});

ok('الوحدة تعمل في Node بلا maplibregl', () => {
  assert.strictEqual(typeof WorksMap.init, 'function');
});

ok('النموذج لا يستدعي دالة خارج العقد', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'masar-prototype.html'), 'utf8');
  const called = new Set();
  const pattern = /GL\.api\.([a-zA-Z]+)\(/g;
  let match;
  while ((match = pattern.exec(html)) !== null) called.add(match[1]);
  for (const name of called) {
    assert.ok(
      WorksMap.API_METHODS.indexOf(name) !== -1,
      `النموذج يستدعي GL.api.${name} وهي غير معلنة في العقد`
    );
  }
});

ok('كل دوال العقد موجودة فعلياً على الكائن المُعاد', () => {
  const api = WorksMap._buildApi(makeFakeMap(), { roads: emptyFC(), works: emptyFC() });
  for (const name of REQUIRED) {
    assert.strictEqual(typeof api[name], 'function', `${name} ليست دالة`);
  }
});

ok('setCorridor يخزن المقاطع و getData يعيدها', () => {
  const api = WorksMap._buildApi(makeFakeMap(), { roads: emptyFC(), works: emptyFC() });
  api.setCorridor([[[46.6, 24.7], [46.7, 24.8]]]);
  assert.strictEqual(api.getData().corridor.length, 1);
});

ok('setCorridorState يغيّر حالة المقطع فقط', () => {
  const api = WorksMap._buildApi(makeFakeMap(), { roads: emptyFC(), works: emptyFC() });
  api.setCorridor([[[46.6, 24.7], [46.7, 24.8]], [[46.7, 24.8], [46.8, 24.9]]]);
  api.setCorridorState(1, 'closed');
  const states = api.getData().corridor.map((s) => s.state);
  assert.strictEqual(states[1], 'closed');
  assert.notStrictEqual(states[0], 'closed');
});

ok('updateRoad يعدّل خصائص الطريق بالـ osmId', () => {
  const roads = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[46.6, 24.7], [46.7, 24.8]] },
      properties: { osmId: 'w1', highway: 'primary', name: 'طريق', lanes: null, aadt: null },
    }],
  };
  const api = WorksMap._buildApi(makeFakeMap(), { roads: roads, works: emptyFC() });
  api.updateRoad('w1', { aadt: 42000, lanes: 3 });
  assert.strictEqual(api.getData().roads.features[0].properties.aadt, 42000);
  assert.strictEqual(api.getData().roads.features[0].properties.lanes, 3);
});

ok('updateRoad على معرّف غير موجود لا يرمي استثناءً', () => {
  const api = WorksMap._buildApi(makeFakeMap(), { roads: emptyFC(), works: emptyFC() });
  api.updateRoad('لا-يوجد', { aadt: 1 });
});

ok('setDateRange يبني فلتراً يحفظ شرط المجموعة', () => {
  const map = makeFakeMap();
  const api = WorksMap._buildApi(map, { roads: emptyFC(), works: emptyFC() });
  api.setDateRange({ from: 100, to: 200 });
  const applied = map._filters['roadworks-realtime-symbols'];
  assert.ok(JSON.stringify(applied).includes('"roadworks"'), 'شرط المجموعة سقط');
  assert.ok(JSON.stringify(applied).includes('start_ts'), 'شرط التاريخ لم يُطبق');
});

ok('toggleGroup يخفي كل طبقات المجموعة', () => {
  const map = makeFakeMap();
  const api = WorksMap._buildApi(map, { roads: emptyFC(), works: emptyFC() });
  api.toggleGroup('closures', false);
  assert.strictEqual(map._visibility['closures-restrictions-realtime-symbols'], 'none');
});

// --- أدوات الاختبار: أدنى بديل لـ maplibregl.Map ---
function emptyFC() { return { type: 'FeatureCollection', features: [] }; }

function makeFakeMap() {
  const layers = {};
  ['roadworks-realtime', 'closures-restrictions-realtime', 'incidents-realtime',
   'diversion-routes', 'events-poi'].forEach((name) => {
    ['-lines-casing', '-lines', '-symbols'].forEach((suffix) => {
      layers[name + suffix] = true;
    });
  });

  return {
    _filters: {},
    _visibility: {},
    _sources: {},
    getLayer(id) { return layers[id] ? { id } : undefined; },
    setFilter(id, filter) { this._filters[id] = filter; },
    setLayoutProperty(id, prop, value) {
      if (prop === 'visibility') this._visibility[id] = value;
    },
    getSource(id) { return this._sources[id] || null; },
    addSource(id, spec) { this._sources[id] = { spec, setData(data) { spec.data = data; } }; },
    addLayer() {},
    on() {},
    once() {},
    getCanvas() { return { style: {} }; },
    isStyleLoaded() { return true; },
  };
}

console.log(`\n${passed} اختبارات نجحت`);
