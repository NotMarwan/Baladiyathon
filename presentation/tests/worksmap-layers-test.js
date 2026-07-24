'use strict';
const assert = require('assert');
const path = require('path');
const Layers = require(path.join(__dirname, '..', 'athar-worksmap-layers.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const BINDING = { points: 'works', lines: 'works-lines' };

ok('الثلاثية: ثلاث طبقات بأسماء one.network', () => {
  const ids = Layers.buildTriple({
    name: 'roadworks-realtime', group: 'roadworks', source: 'works',
    lineColor: '#f0a020', casingColor: '#ffffff', iconImage: 'roadworks',
  }).map((l) => l.id);
  assert.deepStrictEqual(ids, [
    'roadworks-realtime-lines-casing',
    'roadworks-realtime-lines',
    'roadworks-realtime-symbols',
  ]);
});

ok('الثلاثية: كل طبقة مقيدة بمجموعتها', () => {
  const layers = Layers.buildTriple({
    name: 'closures-restrictions-realtime', group: 'closures', source: 'works',
    lineColor: '#c92a2a', casingColor: '#ffffff', iconImage: 'closure',
  });
  for (const layer of layers) {
    assert.ok(
      JSON.stringify(layer.filter).includes('"closures"'),
      `${layer.id} بلا شرط مجموعة — سترسم كل الميزات`
    );
  }
});

ok('الثلاثية: طبقة الرموز تستبعد التجميعات', () => {
  const symbol = Layers.buildTriple({
    name: 'x', group: 'roadworks', source: 'works',
    lineColor: '#f0a020', casingColor: '#ffffff', iconImage: 'roadworks',
  })[2];
  assert.ok(JSON.stringify(symbol.filter).includes('point_count'));
});

ok('الثلاثية: الخطوط على المصدر غير المجمَّع والرموز على المجمَّع', () => {
  const layers = Layers.buildTriple({
    name: 'x', group: 'roadworks', source: 'works', lineSource: 'works-lines',
    lineColor: '#f0a020', casingColor: '#ffffff', iconImage: 'roadworks',
  });
  assert.strictEqual(layers[0].source, 'works-lines');
  assert.strictEqual(layers[1].source, 'works-lines');
  assert.strictEqual(layers[2].source, 'works');
});

ok('كل الطبقات متقطعة بحاشية بيضاء', () => {
  const layers = Layers.buildWorksLayers(BINDING).filter((l) => l.type === 'line');
  const bodies = layers.filter((l) => l.id.endsWith('-lines'));
  const casings = layers.filter((l) => l.id.endsWith('-lines-casing'));
  for (const layer of bodies) {
    assert.ok(layer.paint['line-dasharray'], `${layer.id} ليس متقطعاً`);
  }
  for (const layer of casings) {
    assert.strictEqual(
      layer.paint['line-color'], Layers.WORKS_COLORS.dashCasing,
      `${layer.id} حاشيته داكنة — ستظهر من فجوات الشرطات`
    );
  }
});

ok('نمط الشرطات يشتد عند التقريب البعيد', () => {
  const dash = Layers.dashByZoom([1.6, 2.2]);
  assert.strictEqual(dash[0], 'step', 'line-dasharray لا يقبل interpolate');
  assert.ok(JSON.stringify(dash).includes('literal'));
});

ok('معرّفات الطبقات فريدة', () => {
  const ids = Layers.buildWorksLayers(BINDING).map((l) => l.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

ok('التجميع: نفس إعدادات one.network', () => {
  assert.strictEqual(Layers.CLUSTER_OPTIONS.cluster, true);
  assert.strictEqual(Layers.CLUSTER_OPTIONS.clusterRadius, 50);
  assert.strictEqual(Layers.CLUSTER_OPTIONS.clusterMaxZoom, 14);
});

ok('التجميع: دائرة وعدّاد يقرآن الميزات المجمَّعة فقط', () => {
  const layers = Layers.buildClusterLayers('works');
  assert.deepStrictEqual(layers.map((l) => l.id), ['works-clusters', 'works-cluster-count']);
  for (const layer of layers) {
    assert.deepStrictEqual(layer.filter, ['has', 'point_count']);
  }
});

ok('فلتر التاريخ: تداخل لا احتواء', () => {
  assert.deepStrictEqual(Layers.buildDateFilter({ from: 100, to: 200 }), [
    'all',
    ['<', ['get', 'start_ts'], 200],
    ['>', ['get', 'end_ts'], 100],
  ]);
  assert.strictEqual(Layers.buildDateFilter(null), null);
});

ok('دمج الفلاتر لا يسقط شرط المجموعة', () => {
  const base = ['all', ['!', ['has', 'point_count']], ['==', ['get', 'group'], 'closures']];
  const merged = Layers.composeFilter(base, ['<', ['get', 'start_ts'], 200]);
  assert.ok(JSON.stringify(merged).includes('"closures"'));
});

ok('baseFilters يغطي كل طبقة', () => {
  const filters = Layers.baseFilters();
  for (const layer of Layers.buildWorksLayers(BINDING)) {
    if (layer.id.indexOf('cluster') !== -1) continue;
    assert.ok(filters[layer.id], `لا فلتر أساسي لـ ${layer.id}`);
  }
});

console.log(`\n${passed} اختبارات نجحت`);
