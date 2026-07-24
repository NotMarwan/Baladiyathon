'use strict';
const assert = require('assert');
const path = require('path');
const Store = require(path.join(__dirname, '..', 'athar-desk-store.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

function feature(id, props) {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[46.68, 24.71], [46.69, 24.72]] },
    properties: Object.assign({
      id: id, permitRef: 'BLD-' + id, status: 'ImpactScreening', street: 'طريق أ',
      severity: 2, impactVehHours: 100, start: '2026-07-22T06:00:00Z',
      end: '2026-07-24T06:00:00Z', group: 'roadworks',
    }, props || {}),
  };
}

const sample = [
  feature('a', { severity: 3, impactVehHours: 900, street: 'طريق الملك فهد' }),
  feature('b', { severity: 1, impactVehHours: 50, status: 'Approved' }),
  feature('c', { severity: 2, impactVehHours: 400, status: 'CoordinationRequired' }),
];

ok('المخزن يبدأ بلا تحديد ويرى كل السجلات', () => {
  const store = Store.createStore(sample);
  assert.strictEqual(store.getState().selectedId, null);
  assert.strictEqual(store.getVisible().length, 3);
});

ok('التحديد يغيّر الحالة ويعيد السجل نفسه', () => {
  const store = Store.createStore(sample);
  store.select('c');
  assert.strictEqual(store.getState().selectedId, 'c');
  assert.strictEqual(store.getSelected().properties.status, 'CoordinationRequired');
});

ok('تحديد معرّف غير موجود لا يكسر المخزن', () => {
  const store = Store.createStore(sample);
  store.select('zzz');
  assert.strictEqual(store.getSelected(), null);
});

ok('المشتركون يُستدعون مرة واحدة لكل تغيير', () => {
  const store = Store.createStore(sample);
  let calls = 0;
  store.subscribe(function () { calls += 1; });
  store.select('a');
  store.setFilter('status', 'Approved');
  assert.strictEqual(calls, 2);
});

ok('إلغاء الاشتراك يوقف الاستدعاء', () => {
  const store = Store.createStore(sample);
  let calls = 0;
  const off = store.subscribe(function () { calls += 1; });
  off();
  store.select('a');
  assert.strictEqual(calls, 0);
});

ok('مرشح الحالة يقلّص القائمة', () => {
  const store = Store.createStore(sample);
  store.setFilter('status', 'Approved');
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['b']);
});

ok('البحث النصي يطابق الشارع والمرجع', () => {
  const store = Store.createStore(sample);
  store.setFilter('query', 'الملك فهد');
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['a']);
  store.setFilter('query', 'BLD-b');
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['b']);
});

ok('البحث الفارغ لا يُخفي شيئاً', () => {
  const store = Store.createStore(sample);
  store.setFilter('query', '   ');
  assert.strictEqual(store.getVisible().length, 3);
});

ok('المرشحات تتراكم ولا يمحو أحدها الآخر', () => {
  const store = Store.createStore(sample);
  store.setFilter('status', 'ImpactScreening');
  store.setFilter('severity', 3);
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['a']);
});

ok('إزالة مرشح تعيد ما أخفاه وحده', () => {
  const store = Store.createStore(sample);
  store.setFilter('status', 'Approved');
  store.setFilter('severity', 1);
  store.clearFilter('status');
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['b']);
});

ok('الفرز الافتراضي بالأثر تنازلياً — الأخطر أولاً', () => {
  const store = Store.createStore(sample);
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['a', 'c', 'b']);
});

ok('ما ينتظر قراراً يتقدّم على ما لا ينتظر مهما علا أثره', () => {
  const store = Store.createStore([
    feature('done', { status: 'Completed', impactVehHours: 999999 }),
    feature('wait', { status: 'StrategyReview', impactVehHours: 10 }),
  ]);
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['wait', 'done']);
});

ok('الفرز بتاريخ البدء يعمل ولا يسقط سجلاً', () => {
  const store = Store.createStore(sample);
  store.setSort('start');
  assert.strictEqual(store.getVisible().length, 3);
});

ok('مفتاح فرز مجهول يعود إلى الافتراضي بدل أن يكسر', () => {
  const store = Store.createStore(sample);
  store.setSort('لا-يوجد');
  assert.strictEqual(store.getState().sort, 'impact');
});

ok('العدّادات تفصل المرئي عن الكلي وتعدّ ما ينتظر قراراً', () => {
  const store = Store.createStore(sample);
  store.setFilter('status', 'Approved');
  const counts = store.counts();
  assert.strictEqual(counts.total, 3);
  assert.strictEqual(counts.visible, 1);
  assert.strictEqual(counts.needsDecision, 2);
  assert.strictEqual(counts.byStatus.ImpactScreening, 1);
});

ok('استبدال السجل يحفظ التحديد ويطلق التحديث', () => {
  const store = Store.createStore(sample);
  store.select('a');
  let calls = 0;
  store.subscribe(function () { calls += 1; });
  const updated = feature('a', { severity: 3, impactVehHours: 900, status: 'Approved' });
  store.replace(updated);
  assert.strictEqual(calls, 1);
  assert.strictEqual(store.getSelected().properties.status, 'Approved');
  assert.strictEqual(store.getState().features.length, 3);
});

ok('استبدال سجل غير موجود لا يضيفه', () => {
  const store = Store.createStore(sample);
  store.replace(feature('zzz'));
  assert.strictEqual(store.getState().features.length, 3);
});

ok('المخزن لا يعدّل المصفوفة الأصلية', () => {
  const original = sample.map((f) => JSON.stringify(f));
  const store = Store.createStore(sample);
  store.setSort('start');
  store.getVisible();
  store.replace(feature('a', { status: 'Rejected' }));
  assert.deepStrictEqual(sample.map((f) => JSON.stringify(f)), original);
});

ok('المرشحات المعادة نسخة — تعديلها من الخارج لا يمس المخزن', () => {
  const store = Store.createStore(sample);
  store.setFilter('status', 'Approved');
  const state = store.getState();
  state.filters.status = 'Rejected';
  assert.strictEqual(store.getVisible().length, 1);
});

console.log(`\n${passed} اختبارات نجحت`);
