'use strict';
/*
 * مسار التدهور — ماذا ترى الصفحة حين لا تُقلع الخريطة؟
 * ---------------------------------------------------------------------------
 * كان الجواب: لا شيء، وإلى الأبد. كل ما على `masar-map.html` معلَّق على
 * `map.on('load')` وحده — لا مستمع خطأ ولا مهلة ولا مسار بديل. وقيست الحالة
 * فعلاً: النمط لا يكتمل (`isStyleLoaded() === false`)، فتبقى «جارٍ التحميل…»
 * بصفر سجل و**صفر خطأ في الـconsole**، والمئة والخمسون معلماً محمَّلة في
 * الذاكرة وغير معروضة. كل طلبات الشبكة 200، وWebGL متاح.
 *
 * وهذه صفحة السكان — طبقة الشفافية العامة، وهي «تجاوز التوقعات» في معيار
 * معالجة التحدي. تعليقها الصامت أسوأ من سقوطها.
 *
 * تفحص هذه الحزمة الأبواب الثلاثة: السليم، والخطأ، والمهلة. ولا تفحص أن
 * الخريطة تُرسم — ذاك يحتاج WebGL؛ تفحص أن **الصفحة تعمل بدونها وتقول ذلك**.
 */
const assert = require('assert');
const path = require('path');
const WorksMap = require(path.join(__dirname, '..', 'masar-worksmap.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

function emptyFC() { return { type: 'FeatureCollection', features: [] }; }

/*
 * خريطة مزيّفة تحاكي maplibre بالقدر الذي يحتاجه `init`.
 * `fireLoad` و`fireError` بيد الاختبار: هكذا نمثّل خريطةً لا تُقلع أبداً —
 * وهي الحالة التي لم يكن في الشيفرة مخرجٌ منها.
 */
function makeFakeMap() {
  const handlers = {};
  const layers = {};
  const sources = {};
  return {
    _handlers: handlers,
    on(type, arg2, arg3) {
      const cb = typeof arg2 === 'function' ? arg2 : arg3;
      (handlers[type] = handlers[type] || []).push(cb);
    },
    fire(type, event) { (handlers[type] || []).forEach((cb) => cb(event)); },
    addSource(id, def) { sources[id] = def; },
    addLayer(def) { layers[def.id] = def; },
    getSource(id) { return sources[id]; },
    getLayer(id) { return layers[id]; },
    setFilter() {}, setLayoutProperty() {}, setPaintProperty() {},
    getCanvas() { return { style: {} }; },
    addControl() {}, fitBounds() {}, flyTo() {},
    getStyle() { return { layers: [] }; },
  };
}

/*
 * `init` يقبل `opts.maplibregl` صراحةً، فيُحقن المزيَّف من الباب لا من العالمي.
 * و`document` مزيَّف بأدنى قدر يحتاجه الإعلان — الغرض فحص منطق الإقلاع لا
 * محرك الرسم.
 */
function bootstrap() {
  const fake = makeFakeMap();
  const appended = [];
  const container = {
    style: {},
    appendChild(node) { appended.push(node); },
  };
  const hadDocument = Object.prototype.hasOwnProperty.call(global, 'document');
  if (!hadDocument) {
    global.document = {
      createElement() {
        const attrs = {};
        return {
          style: {}, dataset: {}, textContent: '',
          setAttribute(key, value) { attrs[key] = value; },
          getAttribute(key) { return attrs[key]; },
          appendChild() {},
        };
      },
    };
  }
  const GL = WorksMap.init(container, emptyFC(), {
    baseGeoJSON: emptyFC(),
    maplibregl: {
      Map: function () { return fake; },
      getRTLTextPluginStatus() { return 'loaded'; },
      setRTLTextPlugin() {},
      NavigationControl: function () {}, ScaleControl: function () {},
    },
  });
  return { GL, fake, container, appended };
}

ok('الوحدة تعلن عقد التدهور', () => {
  ['isDegraded', 'degradedReason'].forEach((name) => {
    assert.ok(WorksMap.API_METHODS.indexOf(name) !== -1, `مفقود من العقد: ${name}`);
  });
});

ok('الإقلاع السليم يُطلق onReady بلا تدهور', () => {
  const { GL, fake } = bootstrap();
  let fired = 0;
  GL.api.onReady(() => { fired += 1; });
  fake.fire('load');
  assert.strictEqual(fired, 1, 'onReady لم تُطلق عند الإقلاع السليم');
  assert.strictEqual(GL.api.isDegraded(), false, 'خريطة سليمة أُعلنت متدهورة');
  assert.strictEqual(GL.api.degradedReason(), null);
});

ok('خطأ قبل الإقلاع يُطلق onReady متدهورة — لا شاشة معلَّقة', () => {
  const { GL, fake, appended } = bootstrap();
  let fired = 0;
  GL.api.onReady(() => { fired += 1; });
  fake.fire('error', { error: { message: 'WebGL context lost' } });
  assert.strictEqual(fired, 1, 'onReady لم تُطلق عند خطأ الإقلاع — الصفحة تبقى فارغة');
  assert.strictEqual(GL.api.isDegraded(), true, 'الخريطة أخطأت ولم تُعلن متدهورة');
  assert.ok(/WebGL context lost/.test(GL.api.degradedReason()),
    `السبب لا يحمل نص الخطأ: ${GL.api.degradedReason()}`);
  assert.strictEqual(appended.length, 1, 'لا إعلان مرئي في الحاوية');
  assert.ok(/السجلات معروضة كاملةً/.test(appended[0].textContent),
    'الإعلان لا يدلّ القارئ على القائمة البديلة');
});

ok('الإقلاع بعد خطأ لا يُطلق onReady مرتين', () => {
  const { GL, fake } = bootstrap();
  let fired = 0;
  GL.api.onReady(() => { fired += 1; });
  fake.fire('error', { error: { message: 'boom' } });
  fake.fire('load');
  assert.strictEqual(fired, 1, `onReady أُطلقت ${fired} مرة — تركيب مزدوج للقائمة`);
});

ok('خطأ بعد الإقلاع السليم لا يقلب الصفحة إلى متدهورة', () => {
  const { GL, fake } = bootstrap();
  GL.api.onReady(() => {});
  fake.fire('load');
  fake.fire('error', { error: { message: 'بلاطة ناقصة' } });
  assert.strictEqual(GL.api.isDegraded(), false,
    'خطأ تشغيلي بعد الإقلاع أُعلن فشل إقلاع');
});

/*
 * المهلة تُفحص بساعة مزيّفة.
 * الانتظار ثماني ثوانٍ في حزمة اختبار ثمنٌ لا يُدفع كل تشغيل، واستبدال المهلة
 * بقيمة صغيرة يجعل الاختبار يفحص غير ما يعمل في الإنتاج. فتُستبدل `setTimeout`
 * نفسها: الشيفرة تطلب مهلتها الحقيقية، والاختبار يقرّر متى تنقضي.
 */
ok('المهلة تُطلق onReady متدهورة، ونصّها يحمل مدّتها', () => {
  const realSetTimeout = global.setTimeout;
  const realClearTimeout = global.clearTimeout;
  let scheduled = null;
  let scheduledMs = null;
  global.setTimeout = function (cb, ms) { scheduled = cb; scheduledMs = ms; return { unref() {} }; };
  global.clearTimeout = function () { scheduled = null; };
  try {
    const { GL, appended } = bootstrap();
    let fired = 0;
    GL.api.onReady(() => { fired += 1; });
    assert.strictEqual(typeof scheduled, 'function', 'لا مهلة مجدولة أصلاً');
    assert.strictEqual(scheduledMs, 8000, `المهلة ${scheduledMs} لا 8000`);
    assert.strictEqual(fired, 0, 'أُطلقت قبل انقضاء المهلة');
    scheduled();
    assert.strictEqual(fired, 1, 'المهلة انقضت ولم تُطلق onReady — الشاشة تبقى معلَّقة');
    assert.strictEqual(GL.api.isDegraded(), true);
    assert.ok(/مهلة/.test(GL.api.degradedReason()),
      `السبب لا يسمّي المهلة: ${GL.api.degradedReason()}`);
    assert.strictEqual(appended.length, 1, 'لا إعلان مرئي عند انقضاء المهلة');
  } finally {
    global.setTimeout = realSetTimeout;
    global.clearTimeout = realClearTimeout;
  }
});

ok('الإقلاع السليم يلغي المهلة — لا إعلان متأخر على خريطة تعمل', () => {
  const realSetTimeout = global.setTimeout;
  const realClearTimeout = global.clearTimeout;
  let scheduled = null;
  let cleared = false;
  global.setTimeout = function (cb) { scheduled = cb; return { unref() {} }; };
  global.clearTimeout = function () { cleared = true; scheduled = null; };
  try {
    const { GL, fake, appended } = bootstrap();
    GL.api.onReady(() => {});
    fake.fire('load');
    assert.strictEqual(cleared, true, 'المهلة لم تُلغَ بعد الإقلاع');
    assert.strictEqual(appended.length, 0, 'إعلان تدهور على خريطة أقلعت سليمة');
  } finally {
    global.setTimeout = realSetTimeout;
    global.clearTimeout = realClearTimeout;
  }
});

/*
 * الحاجز حول ردّات النداء.
 * الحلقة العارية كانت تعني أن ردّةً واحدة تُلقي خطأً تُسقط ما بعدها — وهذا
 * وارد جداً في الوضع المتدهور حيث تلمس الردّات طبقاتٍ غير موجودة. فنتيجة
 * الخطأ الواحد كانت صفحةً فارغة، وهي عين ما نُصلحه.
 */
ok('ردّة نداء ساقطة لا تُسقط ما بعدها، والخطأ يُبلَّغ لا يُبتلع', () => {
  const { GL, fake } = bootstrap();
  const order = [];
  const realError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.join(' '));
  try {
    GL.api.onReady(() => { order.push('a'); });
    GL.api.onReady(() => { order.push('b'); throw new Error('طبقة غير موجودة'); });
    GL.api.onReady(() => { order.push('c'); });
    fake.fire('load');
  } finally {
    console.error = realError;
  }
  assert.deepStrictEqual(order, ['a', 'b', 'c'],
    'ردّة ساقطة أسقطت ما بعدها — القائمة والبحث والعدّاد لا تُركَّب');
  assert.ok(logged.some((line) => /onReady#1/.test(line)),
    'الخطأ ابتُلع بلا بلاغ');
});

ok('البيانات تبقى مقروءة في الوضع المتدهور — القائمة تجد سجلاتها', () => {
  const { GL, fake } = bootstrap();
  let features = null;
  GL.api.onReady(() => {
    GL.api.setWorks({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [46.6, 24.7] },
          properties: { id: 'BLD-2026-0001', name: 'طريق الملك فهد' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [46.7, 24.8] },
          properties: { id: 'BLD-2026-0002', name: 'طريق العليا' } },
      ],
    });
    features = GL.api.getData().works.features;
  });
  fake.fire('error', { error: { message: 'no webgl' } });
  assert.strictEqual(GL.api.isDegraded(), true);
  assert.strictEqual(features.length, 2,
    'setWorks لم تحفظ السجلات بلا مصادر خريطة — القائمة ستُعرض فارغة');
  assert.strictEqual(features[0].properties.id, 'BLD-2026-0001');
});

console.log(`\n${passed} اختبارات نجحت`);
