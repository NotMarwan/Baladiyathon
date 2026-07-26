'use strict';
/**
 * المباني حسب النطاق المعروض لا حسب تاريخ الكاميرا.
 * ما يُختبر: أن اختيار البلاطات يتبع الحدود الحالية وحدها، وأن الطلب لا يتكرر،
 * وأن القديم يُلغى، وأن الذاكرة محدودة، وأن المعروض لا يُسقَط — والأهم: أن
 * الصفحة تقرأ حالة الكاميرا عند التركيب لا عند أول حركة.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const Lazy = require(path.join(ROOT, 'athar-buildings-lazy.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'buildings-index.json'), 'utf8'));

/** نطاق تقريبي حول مركزٍ بعرضٍ بالدرجات. */
function boundsAround(lon, lat, span) {
  return { west: lon - span / 2, east: lon + span / 2, south: lat - span / 2, north: lat + span / 2 };
}

/* ---- الفهرس والبيانات ---- */

ok('الفهرس يصف شبكةً بأصلٍ ثابت لا بحدود البيانات', () => {
  // مفتاح البلاطة مشتقٌّ من الأصل؛ أصلٌ يتبع البيانات يغيّر كل المفاتيح مع كل جلب.
  assert.deepStrictEqual(INDEX.origin, [46.52, 24.54]);
  assert.strictEqual(INDEX.cell, 0.0125);
  assert.ok(INDEX.cols > 0 && INDEX.rows > 0);
  assert.ok(Object.keys(INDEX.tiles).length > 300, 'بلاطات أقل من أن تكون تقسيماً');
});

ok('كل بلاطة في الفهرس لها ملف، ولا ملف بلا فهرس', () => {
  const dir = path.join(ROOT, 'data', 'buildings');
  const files = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
  const keys = Object.keys(INDEX.tiles);
  assert.strictEqual(files.length, keys.length, 'عدد الملفات لا يطابق الفهرس');
  keys.forEach((key) => {
    assert.ok(fs.existsSync(path.join(dir, key + '.json')), `بلاطة ${key} بلا ملف`);
  });
});

ok('البلاطات صغيرة — لا واحدة تعيد مشكلة الحمولة الواحدة', () => {
  const dir = path.join(ROOT, 'data', 'buildings');
  let biggest = 0;
  let total = 0;
  Object.keys(INDEX.tiles).forEach((key) => {
    const size = fs.statSync(path.join(dir, key + '.json')).size;
    total += size;
    if (size > biggest) biggest = size;
  });
  assert.ok(biggest < 1.5 * 1048576, `أكبر بلاطة ${(biggest / 1048576).toFixed(2)}MB`);
  // المجموع أكبر من الملف الواحد ولا يُنزَّل منه إلا ما يُرى.
  assert.ok(total > 0);
});

ok('المبنى لبلاطةٍ واحدة — لا تكرار ولا فجوة', () => {
  const counted = Object.keys(INDEX.tiles)
    .reduce((sum, key) => sum + INDEX.tiles[key], 0);
  assert.ok(counted > 450000, `عُدّ ${counted} مبنى فقط`);
  assert.ok(counted <= 456252, 'مبانٍ مكرّرة بين البلاطات');
});

/* ---- اختيار البلاطات: يتبع النطاق لا التاريخ ---- */

ok('النطاق الضيّق يختار بلاطةً أو اثنتين، والواسع يختار أكثر', () => {
  const tight = Lazy.keysForBounds(INDEX, boundsAround(46.687, 24.69, 0.004));
  const wide = Lazy.keysForBounds(INDEX, boundsAround(46.687, 24.69, 0.05));
  assert.ok(tight.length >= 1, 'نطاقٌ داخل المدينة بلا بلاطة');
  assert.ok(wide.length > tight.length, 'الواسع لا يطلب أكثر من الضيّق');
});

ok('الاختيار تابعٌ للحدود وحدها — لا حالة ولا تاريخ', () => {
  const bounds = boundsAround(46.687, 24.69, 0.02);
  const first = Lazy.keysForBounds(INDEX, bounds);
  // نداءٌ بعد نداءٍ على نطاقٍ آخر ثم العودة يجب أن يعطي النتيجة نفسها حرفياً.
  Lazy.keysForBounds(INDEX, boundsAround(46.80, 24.80, 0.02));
  const again = Lazy.keysForBounds(INDEX, bounds);
  assert.deepStrictEqual(again, first, 'النتيجة تغيّرت بتغيّر التاريخ');
});

ok('الأقرب إلى مركز الشاشة يُطلب أولاً', () => {
  const keys = Lazy.keysForBounds(INDEX, boundsAround(46.687, 24.69, 0.05));
  const centreCol = Math.floor((46.687 - INDEX.origin[0]) / INDEX.cell);
  const centreRow = Math.floor((24.69 - INDEX.origin[1]) / INDEX.cell);
  const far = (key) => {
    const p = key.split('-');
    return Math.abs(Number(p[0]) - centreCol) + Math.abs(Number(p[1]) - centreRow);
  };
  assert.ok(far(keys[0]) <= far(keys[keys.length - 1]), 'الأبعد يُطلب قبل الأقرب');
});

ok('سقف البلاطات يُحترم مهما اتّسع النطاق', () => {
  const huge = Lazy.keysForBounds(INDEX, boundsAround(46.69, 24.71, 0.4));
  assert.ok(huge.length <= Lazy.MAX_TILES_IN_VIEW,
    `${huge.length} بلاطة في طلب واحد — الحارس لا يعمل`);
});

ok('التحميل المسبق محدود — هامشٌ حول الشاشة لا ضعفها', () => {
  const bounds = boundsAround(46.687, 24.69, 0.02);
  const none = Lazy.keysForBounds(INDEX, bounds, 0);
  const some = Lazy.keysForBounds(INDEX, bounds, Lazy.PREFETCH_RATIO);
  assert.ok(some.length >= none.length, 'الهامش لا يضيف شيئاً');
  assert.ok(some.length <= none.length * 3, 'الهامش يضاعف الحمولة أضعافاً');
});

ok('نطاقٌ خارج المدينة لا يطلب شيئاً', () => {
  assert.deepStrictEqual(Lazy.keysForBounds(INDEX, boundsAround(40, 20, 0.02)), []);
});

/* ---- خطة الدورة ---- */

const emptyState = () => ({ cache: {}, inflight: {}, order: [] });

ok('لا يُطلب ما هو مخزَّن ولا ما هو جارٍ — منع التكرار', () => {
  const state = emptyState();
  state.cache['10-11'] = true;
  state.order.push('10-11');
  state.inflight['10-12'] = true;
  const plan = Lazy.planTiles(state, ['10-11', '10-12', '10-13']);
  assert.deepStrictEqual(plan.fetch, ['10-13']);
});

ok('الجاري خارج النطاق يُلغى — تحريكٌ سريع لا يخنق الشبكة', () => {
  const state = emptyState();
  state.inflight['5-5'] = true;
  state.inflight['9-9'] = true;
  const plan = Lazy.planTiles(state, ['9-9']);
  assert.deepStrictEqual(plan.abort, ['5-5']);
});

ok('الذاكرة محدودة، والمعروض محميّ من الإسقاط', () => {
  const state = emptyState();
  for (let i = 0; i < 12; i += 1) {
    const key = '1-' + i;
    state.cache[key] = true;
    state.order.push(key);
  }
  // النطاق يريد أقدم بلاطتين؛ يجب أن يُسقَط ما وراءهما لا هما.
  const plan = Lazy.planTiles(state, ['1-0', '1-1'], 10);
  assert.strictEqual(plan.evict.length, 2, 'الحدّ غير محترم');
  assert.ok(plan.evict.indexOf('1-0') === -1, 'أُسقطت بلاطةٌ معروضة — وميض');
  assert.ok(plan.evict.indexOf('1-1') === -1, 'أُسقطت بلاطةٌ معروضة — وميض');
  assert.deepStrictEqual(plan.evict, ['1-2', '1-3'], 'الإسقاط ليس بالأقدم');
});

ok('تحت الحدّ لا يُسقَط شيء', () => {
  const state = emptyState();
  state.cache['1-1'] = true;
  state.order.push('1-1');
  assert.deepStrictEqual(Lazy.planTiles(state, ['1-1'], 10).evict, []);
});

/* ---- النظرة العامة ---- */

const overviewSrc = fs.readFileSync(path.join(ROOT, 'data', 'buildings-overview.js'), 'utf8');
const overviewPayload = (() => {
  const box = {};
  new Function('window', overviewSrc)(box);
  return box.RIYADH_BUILDINGS_OVERVIEW;
})();

ok('النظرة العامة خفيفة — مئات الكيلوبايتات لا مئة ميغابايت', () => {
  const size = fs.statSync(path.join(ROOT, 'data', 'buildings-overview.js')).size;
  assert.ok(size < 1.5 * 1048576, `${(size / 1048576).toFixed(2)}MB — ليست نظرةً عامة`);
  assert.ok(overviewPayload.cells.length > 10000, 'خلايا أقل من أن تصف مدينة');
});

ok('كل خلية تصير مستطيلاً يحمل كثافته ومفتاح بلاطته', () => {
  const collection = Lazy.expandOverview(overviewPayload);
  assert.strictEqual(collection.features.length, overviewPayload.cells.length);
  const sample = collection.features[0];
  assert.strictEqual(sample.geometry.type, 'Polygon');
  assert.strictEqual(sample.geometry.coordinates[0].length, 5);
  assert.ok(sample.properties.d > 0 && sample.properties.d <= 1, 'الكثافة خارج [0,1]');
  assert.ok(/^\d+-\d+$/.test(sample.properties.t), 'الخلية بلا مفتاح بلاطة');
});

ok('مفتاح الخلية يطابق البلاطة التي تغطّيها', () => {
  const collection = Lazy.expandOverview(overviewPayload);
  collection.features.slice(0, 400).forEach((feature) => {
    const west = feature.geometry.coordinates[0][0][0];
    const south = feature.geometry.coordinates[0][0][1];
    const col = Math.floor((west - INDEX.origin[0]) / INDEX.cell + 1e-9);
    const row = Math.floor((south - INDEX.origin[1]) / INDEX.cell + 1e-9);
    assert.strictEqual(feature.properties.t, col + '-' + row,
      'الخشن لن ينسحب أمام الدقيق — المفاتيح لا تلتقي');
  });
});

ok('النظرة العامة تنسحب بمرشّح لا بحذف — لا لحظةَ فراغ', () => {
  assert.strictEqual(Lazy.overviewFilter([]), null, 'مرشّحٌ بلا بلاطات محمَّلة');
  const filter = Lazy.overviewFilter(['3-4', '5-6']);
  assert.strictEqual(filter[0], '!');
  assert.deepStrictEqual(filter[1], ['in', ['get', 't'], ['literal', ['3-4', '5-6']]]);
});

ok('حمولة فاسدة لا تكسر شيئاً', () => {
  assert.deepStrictEqual(Lazy.expandOverview(null).features, []);
  assert.deepStrictEqual(Lazy.expandOverview({}).features, []);
});

/* ---- المعرّفات: التحديث تفاضلي لا إعادة بناء ---- */

ok('معرّفات البلاطات لا تتصادم', () => {
  const seen = {};
  Object.keys(INDEX.tiles).forEach((key) => {
    const base = Lazy.ordinalOf(INDEX, key);
    assert.ok(seen[base] === undefined, `تصادم عند ${key}`);
    seen[base] = key;
    assert.ok(INDEX.tiles[key] < 100000, `بلاطة ${key} تتجاوز مدى معرّفاتها`);
    assert.ok(Number.isSafeInteger(base + INDEX.tiles[key]), 'المعرّف خارج المدى الآمن');
  });
});

/* ---- الوصل بالصفحة ---- */

const page = fs.readFileSync(path.join(ROOT, 'athar-map.html'), 'utf8');
const module_ = fs.readFileSync(path.join(ROOT, 'athar-buildings-lazy.js'), 'utf8');

ok('الصفحة تحمّل الوحدة وتركّبها على الخريطة', () => {
  assert.ok(page.indexOf('athar-buildings-lazy.js') !== -1, 'الوحدة غير محمَّلة');
  assert.ok(page.indexOf('AtharBuildingsLazy.install(GL.map)') !== -1, 'الوحدة غير مركَّبة');
});

ok('المدينة كلها لم تعد تُحمَّل دفعةً واحدة', () => {
  assert.strictEqual(page.indexOf('attachBuildings'), -1, '`attachBuildings` ما زال في الصفحة');
  assert.strictEqual(page.indexOf('riyadh-buildings.geojson.js'), -1,
    'ملف المئة ميغابايت ما زال مطلوباً من الصفحة');
});

ok('القراءة تقع فور التركيب لا عند أول حركة — أصل العطب', () => {
  /**
   * هذا هو الحارس على السبب الجذري: `ready()` تنادي `refresh()` مباشرةً بعد
   * ربط `moveend`. لو حُذف النداء المباشر عاد العطب: خريطةٌ تفتح على 500 متر
   * ولا تحمّل شيئاً حتى يحرّكها المستعمل.
   */
  const readyAt = module_.indexOf('function ready()');
  assert.ok(readyAt !== -1, 'لا تهيئة');
  const body = module_.slice(readyAt, readyAt + 260);
  assert.ok(/map\.on\('moveend', refresh\)/.test(body), 'لا استماع للاستقرار');
  assert.ok(/\n\s*refresh\(\);/.test(body), 'لا قراءة مباشرة لحالة الكاميرا');
});

ok('العتبة تشمل كل الارتفاعات المشتكى منها', () => {
  // مقياس 600 متر ≈ z13.5، و100 متر ≈ z16. العتبة يجب أن تقع تحتها كلها.
  assert.ok(Lazy.DETAIL_MIN_ZOOM < 13.5,
    `العتبة ${Lazy.DETAIL_MIN_ZOOM} فوق تقريب 600 متر — الشكوى تعود`);
});

ok('الفشل لا يُعلَّم نجاحاً ولا يترك حالة معلّقة', () => {
  // الالتقاط يمسح الجاري دائماً، ولا يضع البلاطة في المخزَّن — فتبقى النظرة
  // العامة مرسومة وتُطلب البلاطة ثانيةً عند العودة.
  const catchAt = module_.indexOf('.catch(function (err)');
  assert.ok(catchAt !== -1, 'لا معالجة فشل');
  const body = module_.slice(catchAt, catchAt + 700);
  assert.ok(body.indexOf('delete state.inflight[key]') !== -1, 'الجاري يبقى معلّقاً بعد الفشل');
  assert.ok(body.indexOf('state.cache[key]') === -1, 'البلاطة الفاشلة تُعلَّم محمَّلة');
  assert.ok(body.indexOf('console.warn') !== -1, 'الفشل صامت تماماً');
});

ok('الابتعاد لا يُسقط ما رُسم', () => {
  const refreshAt = module_.indexOf('function refresh()');
  const body = module_.slice(refreshAt, module_.indexOf('function stats()'));
  const guard = body.slice(0, body.indexOf('var wanted'));
  assert.ok(guard.indexOf('DETAIL_MIN_ZOOM') !== -1, 'لا حارس على التقريب');
  assert.ok(guard.indexOf('state.cache') === -1, 'المخزَّن يُمسح عند الابتعاد — وميض');
});

/* ---- الطبقة الخشنة في النمط ---- */

const Style = require(path.join(ROOT, 'athar-worksmap-style.js'));

ok('النمط يحمل مصدرين وطبقةً خشنة تحت الدقيقة', () => {
  const style = Style.buildStyle({ type: 'FeatureCollection', features: [] },
    { type: 'FeatureCollection', features: [] }, {});
  assert.ok(style.sources['buildings-overview'], 'لا مصدر للنظرة العامة');
  assert.ok(style.sources.buildings, 'لا مصدر للتفاصيل');
  const ids = style.layers.map((l) => l.id);
  assert.ok(ids.indexOf('buildings-overview') !== -1, 'لا طبقة خشنة');
  assert.ok(ids.indexOf('buildings-overview') < ids.indexOf('buildings'),
    'الخشن فوق الدقيق');
});

ok('شفافية الخشن تتبع كثافته — الحيّ المكتظّ أدكن', () => {
  const style = Style.buildStyle({ type: 'FeatureCollection', features: [] },
    { type: 'FeatureCollection', features: [] }, {});
  const layer = style.layers.filter((l) => l.id === 'buildings-overview')[0];
  const opacity = layer.paint['fill-opacity'];
  /**
   * `zoom` لا يُقبل إلا مُدخلاً لـ`interpolate` أو `step` في الأعلى. وضربُ
   * تعبيرِ تقريبٍ في تعبير خاصية يُبطل النمط كلَّه فتسقط الخريطة قبل أن تجهز
   * — وقع ذلك فعلاً، ولم يظهر إلا في سجل المتصفح. الحارس هنا كي لا يعود.
   */
  assert.strictEqual(opacity[0], 'interpolate', 'التقريب ليس في أعلى التعبير — النمط باطل');
  assert.deepStrictEqual(opacity[2], ['zoom']);
  assert.ok(JSON.stringify(opacity).indexOf('"d"') !== -1, 'الشفافية لا تقرأ الكثافة');
});

ok('صفحة المكتب تحمّل الوحدة وتركّبها كصفحة الخريطة', () => {
  const desk = fs.readFileSync(path.join(ROOT, 'athar-desk.html'), 'utf8');
  const boot = fs.readFileSync(path.join(ROOT, 'athar-desk-boot.js'), 'utf8');
  assert.ok(desk.indexOf('athar-buildings-lazy.js') !== -1, 'الوحدة غير محمَّلة في المكتب');
  assert.ok(boot.indexOf('AtharBuildingsLazy.install') !== -1, 'المكتب بلا تركيب');
  assert.strictEqual(boot.indexOf('attachBuildings'), -1,
    'المكتب ما زال يُنزّل المدينة كلها دفعةً واحدة');
});

console.log(`\n${passed} اختبارات نجحت`);
