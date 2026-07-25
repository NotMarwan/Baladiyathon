'use strict';
const assert = require('assert');
const path = require('path');

const Recall = require(path.join(__dirname, '..', 'athar-desk-recall.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

function memoryStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

const NOW = '2026-07-25T12:00:00.000Z';
const STATE = {
  query: 'الملك فهد', status: 'ImpactScreening', sort: 'severity',
  selectedId: 'p071', tab: 'impact', decisions: 12, pending: 64,
};

/* ---- الحفظ والقراءة ---- */

ok('ما يُحفظ يُقرأ كما هو', () => {
  const store = memoryStore();
  Recall.write(store, STATE, NOW);
  const back = Recall.read(store);
  Object.keys(STATE).forEach((key) => assert.strictEqual(back[key], STATE[key], key));
  assert.strictEqual(back.at, NOW);
});

ok('مخزن فارغ أو تالف يعيد null لا استثناء', () => {
  assert.strictEqual(Recall.read(memoryStore()), null);
  const broken = memoryStore();
  broken.setItem(Recall.STORAGE_KEY, '{ليس JSON');
  assert.strictEqual(Recall.read(broken), null);
});

ok('إصدار مختلف يُهمَل بدل أن يُقرأ خطأً', () => {
  const store = memoryStore();
  store.setItem(Recall.STORAGE_KEY, JSON.stringify({ schema: 99, at: NOW, decisions: 5 }));
  assert.strictEqual(Recall.read(store), null);
});

ok('مخزن يرفض الكتابة لا يُسقط الصفحة', () => {
  const hostile = { getItem: () => null, setItem: () => { throw new Error('ممتلئ'); } };
  assert.strictEqual(Recall.write(hostile, STATE, NOW), false);
});

ok('المسح يزيل الحالة المحفوظة', () => {
  const store = memoryStore();
  Recall.write(store, STATE, NOW);
  Recall.clear(store);
  assert.strictEqual(Recall.read(store), null);
});

/* ---- متى يُعرض الشريط ومتى يصمت ---- */

function saved(props) {
  const store = memoryStore();
  Recall.write(store, Object.assign({}, STATE, props || {}), (props && props.at) || NOW);
  return Recall.read(store);
}

ok('أول زيارة بلا شريط', () => {
  const first = Recall.resume(null, NOW, { pending: 118 });
  assert.strictEqual(first.show, false);
  assert.strictEqual(first.reason, 'first-visit');
});

ok('جلسة بلا قرار واحد لا تُستأنف — الشريط يصير ضجيجاً يومياً', () => {
  const idle = Recall.resume(saved({ decisions: 0, at: '2026-07-25T09:00:00.000Z' }),
    NOW, { pending: 118 });
  assert.strictEqual(idle.show, false);
  assert.strictEqual(idle.reason, 'nothing-done');
});

ok('جلسة قديمة جداً لا تُستأنف', () => {
  const old = Recall.resume(saved({ at: '2026-06-01T09:00:00.000Z' }), NOW, { pending: 64 });
  assert.strictEqual(old.show, false);
  assert.strictEqual(old.reason, 'stale');
});

ok('ساعة متأخرة عن المحفوظ لا تُنتج مدة سالبة', () => {
  // ساعة الجهاز قد تُعاد إلى الوراء؛ «قبل -3 ساعات» أسوأ من لا شيء.
  const skewed = Recall.resume(saved({ at: '2026-07-25T14:00:00.000Z' }), NOW, { pending: 64 });
  assert.strictEqual(skewed.show, false);
  assert.strictEqual(skewed.reason, 'clock');
});

ok('جلسة أمس بقرارات تُستأنف وتحمل أرقامها', () => {
  const back = Recall.resume(saved({ at: '2026-07-24T12:00:00.000Z' }), NOW, { pending: 64 });
  assert.strictEqual(back.show, true);
  assert.strictEqual(back.ago, 'أمس');
  assert.strictEqual(back.decisions, 12);
  assert.strictEqual(back.pending, 64);
  assert.strictEqual(back.selectedId, 'p071');
});

/* ---- صياغة المدة ---- */

ok('المدة تُقرَّب بما يخدم القارئ لا بالثانية', () => {
  assert.strictEqual(Recall.ago(30 * 1000), 'قبل لحظات');
  assert.strictEqual(Recall.ago(20 * 60000), 'قبل 20 دقيقة');
  assert.strictEqual(Recall.ago(3600000), 'قبل ساعة');
  assert.strictEqual(Recall.ago(2 * 3600000), 'قبل ساعتين');
  assert.strictEqual(Recall.ago(5 * 3600000), 'قبل 5 ساعات');
  assert.strictEqual(Recall.ago(86400000), 'أمس');
  assert.strictEqual(Recall.ago(2 * 86400000), 'قبل يومين');
  assert.strictEqual(Recall.ago(6 * 86400000), 'قبل 6 يوماً');
});

/* ---- العرض ---- */

const shown = Recall.resume(saved({ at: '2026-07-25T09:00:00.000Z' }), NOW, { pending: 64 });
const html = Recall.render(shown, 'BLD-2026-0071');

ok('الشريط يقول متى وكم وماذا بقي', () => {
  assert.ok(html.indexOf('قبل 3 ساعات') !== -1, 'لا مدة');
  assert.ok(html.indexOf('12 عملاً') !== -1, 'لا عدد قرارات');
  assert.ok(html.indexOf('64 عملاً') !== -1, 'لا عدد منتظِر');
});

ok('العدد يُصرَّف بالعربية — واحد واثنان وجمع قلّة', () => {
  const one = Recall.render(Recall.resume(saved({ decisions: 1, at: '2026-07-25T09:00:00.000Z' }),
    NOW, { pending: 2 }), null);
  assert.ok(one.indexOf('عملاً واحداً') !== -1, `لم يُفرد: ${one}`);
  assert.ok(one.indexOf('عملان') !== -1, `لم يُثنِّ المنتظِر: ${one}`);
});

ok('بلا منتظِر يقول ذلك بدل أن يعرض صفراً', () => {
  const done = Recall.render(Recall.resume(saved({ at: '2026-07-25T09:00:00.000Z' }),
    NOW, { pending: 0 }), null);
  assert.ok(done.indexOf('لا عمل ينتظر قراراً') !== -1);
  assert.ok(done.indexOf('0') === -1, 'عرض صفراً بلا معنى');
});

ok('زرّ المتابعة يظهر بمرجع ويغيب بدونه', () => {
  assert.ok(html.indexOf('deskResumeGo') !== -1);
  assert.ok(Recall.render(shown, null).indexOf('deskResumeGo') === -1);
});

ok('الشريط يمكن إخفاؤه — استئنافٌ لا يُغلق يصير إزعاجاً', () => {
  assert.ok(html.indexOf('deskResumeClose') !== -1);
  assert.ok(html.indexOf('aria-label') !== -1, 'زرّ بلا اسم لقارئ الشاشة');
});

ok('لا شريط حين لا يُعرض — لا هيكل فارغ في الشجرة', () => {
  assert.strictEqual(Recall.render({ show: false }, 'BLD-1'), '');
});

ok('المرجع مرمَّز والأرقام لاتينية', () => {
  assert.ok(Recall.render(shown, '<script>x</script>').indexOf('<script>x') === -1);
  assert.ok(!/[٠-٩]/.test(html));
});

console.log(`\n${passed} اختبارات نجحت`);
