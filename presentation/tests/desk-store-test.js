'use strict';
const assert = require('assert');
const path = require('path');
const Store = require(path.join(__dirname, '..', 'masar-desk-store.js'));

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

/**
 * بحثٌ واحد في المنتج، لا بحثان.
 * ---------------------------------------------------------------------------
 * الصفحة العامة تطبّع الإملاء قبل المقارنة، والمكتب كان يقارن النص خاماً:
 * «ابو عبيده» يعيد ثلاثة سجلات هناك وصفراً هنا، و«bld-2026-0001» كذلك.
 * فالمراجع الذي لا يجد ما يعرف أنه موجود يفقد ثقته في الأداة قبل الرقم.
 */
ok('بحث الصندوق يطابق إملاء الساكن كبحث الصفحة العامة', () => {
  const store = Store.createStore([
    feature('x', { street: 'أبو عبيدة عامر بن الجراح', permitRef: 'BLD-2026-0001' }),
    feature('y', { street: 'طريق الملك فهد', permitRef: 'BLD-2026-0002' }),
  ]);

  store.setFilter('query', 'ابو عبيده');
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['x'],
    'الإملاء الشائع بلا همزة ولا تاء مربوطة لا يطابق');

  store.setFilter('query', 'bld-2026-0002');
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['y'],
    'المرجع بأحرف صغيرة لا يطابق');
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

/* ---- التنقّل في الطابور: العطب الذي يُخفي العمل ---- */

function queue() {
  return Store.createStore([
    feature('a', { status: 'ImpactScreening', impactVehHours: 900 }),
    feature('b', { status: 'StrategyReview', impactVehHours: 800 }),
    feature('c', { status: 'Approved', impactVehHours: 700 }),
    feature('d', { status: 'CompletenessReview', impactVehHours: 600 }),
  ]);
}

ok('التالي يتخطّى ما لا ينتظر قراراً', () => {
  const found = queue().nextPending('b');
  assert.strictEqual(found.feature.properties.id, 'd', 'لم يتخطَّ المعتمد');
  assert.strictEqual(found.wrapped, false);
});

ok('التالي يلتفّ من آخر القائمة إلى أولها ويُبلّغ بالالتفاف', () => {
  const found = queue().nextPending('d');
  assert.strictEqual(found.feature.properties.id, 'a');
  assert.strictEqual(found.wrapped, true, 'الالتفاف وقع صامتاً');
});

ok('العمل الذي يُقرَّر لا يحبس المراجع في قاع القائمة', () => {
  // العطب الحقيقي: الفرز يضع المنتظِر أولاً، فالمعتمد يهبط فوراً؛ وبحث أمامي
  // من القاع كان يقول «فرغ الطابور» وفيه أعمال تنتظر.
  const store = queue();
  store.replace(feature('a', { status: 'Approved', impactVehHours: 900 }));

  const found = store.nextPending('a');
  assert.ok(found, 'الطابور بدا فارغاً وفيه عملان ينتظران');
  assert.ok(['b', 'd'].indexOf(found.feature.properties.id) !== -1);
});

ok('التالي لا يعيد العمل نفسه ولو كان الوحيد المنتظِر', () => {
  const store = Store.createStore([
    feature('only', { status: 'ImpactScreening' }),
    feature('done', { status: 'Approved' }),
  ]);
  assert.strictEqual(store.nextPending('only'), null,
    'أعاد العمل نفسه — فتكرّر «التالي» على مكانه');
});

ok('قائمة بلا منتظِر ولا قائمة أصلاً تعيدان لا شيء بلا استثناء', () => {
  assert.strictEqual(Store.createStore([]).nextPending(null), null);
  assert.strictEqual(
    Store.createStore([feature('x', { status: 'Closed' })]).nextPending(null), null);
});

ok('بلا تحديد سابق يبدأ من أول منتظِر لا من الوسط', () => {
  const found = queue().nextPending(null);
  assert.strictEqual(found.feature.properties.id, 'a');
  assert.strictEqual(found.wrapped, false, 'بداية أُبلغت كالتفاف');
});

ok('التنقّل يحترم الترشيح — لا يقفز خارج ما يراه المراجع', () => {
  const store = queue();
  store.setFilter('status', 'StrategyReview');
  const found = store.nextPending(null);
  assert.strictEqual(found.feature.properties.id, 'b');
  assert.strictEqual(store.nextPending('b'), null, 'خرج من نطاق الترشيح');
});

console.log(`\n${passed} اختبارات نجحت`);
