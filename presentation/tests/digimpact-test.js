'use strict';
/**
 * حزمة أثر الحفر.
 *
 * ما تحرسه: أن الرقم المرسوم على الخريطة ناتجُ **المحرك** لا معادلةٍ ثانية،
 * وأن الأثر يتحرّك بما يجب أن يحرّكه (الساعة، الإغلاق، الحمل) ولا يتحرّك بما
 * لا يجب، وأن ما لا يُحسب لا يُرسم.
 */
const assert = require('assert');
const path = require('path');

const Engine = require(path.join(__dirname, '..', 'masar-engine.js'));
const TrafficLoad = require(path.join(__dirname, '..', 'masar-trafficload.js'));
const DigImpact = require(path.join(__dirname, '..', 'masar-digimpact.js'));
const Layer = require(path.join(__dirname, '..', 'masar-digimpact-layer.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const PERMIT = { id: 'p001', aadt: 72000, lanes: 4, lanesClosed: 1, street: 'شارع' };
const PEAK = TrafficLoad.peakShare().hour;

/* ---- الحساب من المحرك ---- */

ok('المضاعف يساوي نسبة زمنَي BPR — لا معادلة ثانية', () => {
  const impact = DigImpact.impactOf(PERMIT, PEAK);
  const volume = PERMIT.aadt * TrafficLoad.shareAt(PEAK);
  const full = PERMIT.lanes * Engine.DEFAULTS.capacityPerLane;
  const during = Math.max(
    (PERMIT.lanes - PERMIT.lanesClosed) * Engine.CALIBRATION.WORK_ZONE_LANE_CAPACITY,
    full * Engine.CALIBRATION.MIN_CAPACITY_FRACTION
  );
  const before = Engine.bprTravelTime(Engine.DEFAULTS.freeFlowMin, volume, full);
  const after = Math.max(
    Engine.bprTravelTime(Engine.DEFAULTS.freeFlowMin, volume, during),
    before * Engine.CALIBRATION.WORK_ZONE_FRICTION
  );

  assert.ok(Math.abs(impact.factor - after / before) < 1e-12,
    'المضاعف لا يطابق ناتج المحرك — اشتُقّت معادلة ثانية');
  assert.ok(Math.abs(impact.capacityDuring - Math.round(during)) < 1e-6);
});

ok('سعة منطقة العمل من ثابت المحرك لا من رقم منسوخ', () => {
  const impact = DigImpact.impactOf({ aadt: 40000, lanes: 4, lanesClosed: 2 }, PEAK);
  assert.strictEqual(impact.capacityDuring,
    Math.round(2 * Engine.CALIBRATION.WORK_ZONE_LANE_CAPACITY));
});

ok('إغلاق كل الحارات يقف عند أرضية المحرك لا عند الصفر', () => {
  const impact = DigImpact.impactOf({ aadt: 40000, lanes: 3, lanesClosed: 3 }, PEAK);
  assert.strictEqual(impact.lanesOpen, 0);
  assert.strictEqual(impact.capacityDuring,
    Math.round(3 * Engine.DEFAULTS.capacityPerLane * Engine.CALIBRATION.MIN_CAPACITY_FRACTION));
  assert.ok(Number.isFinite(impact.factor), 'القسمة على صفر تسرّبت');
});

ok('احتكاك منطقة العمل يمنع انهيار الأثر ليلاً', () => {
  /* في الثالثة فجراً يصمت حدّ BPR: بلا الأرضية يصير المضاعف واحداً بالضبط،
     فتُقرأ الخريطة «الحفر ليلاً بلا أثر» — وهو المستحيل الذي وُضعت له. */
  const night = DigImpact.impactOf(PERMIT, 3);
  assert.ok(night.factor >= Engine.CALIBRATION.WORK_ZONE_FRICTION - 1e-9,
    `المضاعف الليلي ${night.factor} دون أرضية الاحتكاك`);
});

/* ---- ما يجب أن يحرّك الأثر ---- */

ok('الأثر يتبع الساعة: الذروة أشدّ من الليل', () => {
  const peak = DigImpact.impactOf(PERMIT, PEAK);
  const night = DigImpact.impactOf(PERMIT, 3);
  assert.ok(peak.factor > night.factor,
    'الإغلاق نفسه بالأثر نفسه ليلاً ونهاراً — التوصية كلها تسقط');
});

ok('الأثر يتبع عدد الحارات المغلقة', () => {
  const one = DigImpact.impactOf({ aadt: 72000, lanes: 4, lanesClosed: 1 }, PEAK);
  const two = DigImpact.impactOf({ aadt: 72000, lanes: 4, lanesClosed: 2 }, PEAK);
  assert.ok(two.factor > one.factor);
});

ok('الأثر يتبع حمل الشارع', () => {
  const light = DigImpact.impactOf({ aadt: 20000, lanes: 4, lanesClosed: 1 }, PEAK);
  const heavy = DigImpact.impactOf({ aadt: 90000, lanes: 4, lanesClosed: 1 }, PEAK);
  assert.ok(heavy.factor > light.factor,
    'شارعان بحملين مختلفين بأثرٍ واحد — الحمل لا يدخل الحساب');
});

/* ---- ما لا يُحسب لا يُرسم ---- */

ok('مدخل ناقص يعيد null لا رقماً من فراغ', () => {
  assert.strictEqual(DigImpact.impactOf({ lanes: 4, lanesClosed: 1 }, PEAK), null);
  assert.strictEqual(DigImpact.impactOf({ aadt: 40000 }, PEAK), null);
  assert.strictEqual(DigImpact.impactOf(null, PEAK), null);
  assert.strictEqual(DigImpact.impactOf({ aadt: 0, lanes: 4 }, PEAK), null);
});

ok('النقاط تُستبعد من الرسم — لا زمن عبور لنقطة', () => {
  const works = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature', properties: PERMIT,
        geometry: { type: 'LineString', coordinates: [[46.6, 24.7], [46.7, 24.8]] },
      },
      {
        type: 'Feature', properties: PERMIT,
        geometry: { type: 'Point', coordinates: [46.6, 24.7] },
      },
      {
        type: 'Feature', properties: { id: 'x' },
        geometry: { type: 'LineString', coordinates: [[46.6, 24.7], [46.7, 24.8]] },
      },
    ],
  };
  const out = DigImpact.buildCollection(works, PEAK);
  assert.strictEqual(out.features.length, 1, 'نقطةٌ أو سجلٌ بلا حمل دخل الرسم');
  assert.strictEqual(out.features[0].geometry.type, 'LineString');
  assert.ok(out.features[0].properties.dig_factor > 1);
});

ok('التقدير الجماعي لا يمسّ المُدخل', () => {
  const works = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature', properties: PERMIT,
      geometry: { type: 'LineString', coordinates: [[46.6, 24.7], [46.7, 24.8]] },
    }],
  };
  const before = JSON.stringify(works);
  DigImpact.buildCollection(works, PEAK);
  assert.strictEqual(JSON.stringify(works), before);
});

/* ---- النطاقات والطبقة ---- */

ok('النطاقات متتابعة وتغطي كل مضاعف', () => {
  assert.strictEqual(DigImpact.bandOf(1).id, 'none');
  assert.strictEqual(DigImpact.bandOf(1.2).id, 'slight');
  assert.strictEqual(DigImpact.bandOf(1.4).id, 'noticeable');
  assert.strictEqual(DigImpact.bandOf(1.9).id, 'heavy');
  assert.strictEqual(DigImpact.bandOf(12).id, 'severe');
});

ok('اللون والعرض مبنيان من النطاقات نفسها', () => {
  const color = JSON.stringify(Layer.colorExpression());
  DigImpact.BANDS.forEach((band) => {
    assert.ok(color.includes(band.id), `${band.id} خارج تعبير اللون`);
    assert.ok(color.includes(band.color), `لون ${band.id} خارج التعبير`);
  });
  assert.ok(JSON.stringify(Layer.widthExpression()).includes('dig_factor'),
    'العرض لا يتبع شدّة الأثر');
});

ok('الطبقة مطفأة عند التركيب وتُدرَج تحت خطوط الأعمال', () => {
  const added = [];
  const fakeMap = {
    sources: {}, layers: { 'roadworks-realtime-lines-casing': {} },
    getSource: function (id) { return this.sources[id] ? { setData: function () {} } : null; },
    getLayer: function (id) { return this.layers[id] || null; },
    addSource: function (id, spec) { this.sources[id] = spec; },
    addLayer: function (spec, before) { this.layers[spec.id] = spec; added.push(before); },
    setLayoutProperty: function (id, key, value) { this.layers[id].layout[key] = value; },
    on: function () {}, off: function () {},
  };

  const works = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature', properties: PERMIT,
      geometry: { type: 'LineString', coordinates: [[46.6, 24.7], [46.7, 24.8]] },
    }],
  };
  const handle = Layer.install(fakeMap, function () { return works; }, { hour: PEAK });

  assert.strictEqual(fakeMap.layers[Layer.LAYER_ID].layout.visibility, 'none');
  assert.strictEqual(added[0], 'roadworks-realtime-lines-casing',
    'الهالة فوق خط العمل فتمحو رمزه');

  const summary = handle.setVisible(true);
  assert.strictEqual(summary.segments, 1);
  assert.strictEqual(fakeMap.layers[Layer.LAYER_ID].layout.visibility, 'visible');

  const night = handle.setHour(3);
  assert.strictEqual(handle.hour(), 3);
  assert.notDeepStrictEqual(night.byBand, summary.byBand,
    'تغيير الساعة لم يغيّر التوزيع — المنزلق زينة');
});

ok('التركيب لا يرمي حين لا يكون النمط جاهزاً', () => {
  const fakeMap = {
    getSource: function () { return null; },
    getLayer: function () { return null; },
    addSource: function () { throw new Error('Style is not done loading.'); },
    addLayer: function () { throw new Error('Style is not done loading.'); },
    setLayoutProperty: function () {},
    on: function () {}, off: function () {},
  };
  const handle = Layer.install(fakeMap, function () {
    return { type: 'FeatureCollection', features: [] };
  });
  assert.strictEqual(handle.ensureLayer(), false);
  assert.ok(handle.lastError(), 'السبب ابتُلع صامتاً');
  assert.strictEqual(handle.setVisible(true), null);
});

ok('ما فوق حدّ الفحص السريع يُعلَن مؤشّر خطورة لا تقديراً', () => {
  /* قياس المحفظة الحقيقية: 16× على طريق الملك خالد في ذروة المساء. رقمٌ
     كهذا معروضاً عارياً ادّعاءٌ لا يصمد — BPR يتضخّم فوق التشبّع. */
  const extreme = DigImpact.impactOf({ aadt: 110000, lanes: 4, lanesClosed: 3 }, PEAK);
  assert.strictEqual(extreme.beyondScreening, true);
  assert.ok(Layer.popupHtml(extreme).includes('مؤشّر خطورة'),
    'رقمٌ خارج نطاق الفحص معروضٌ بلا إعلان');

  const mild = DigImpact.impactOf({ aadt: 20000, lanes: 4, lanesClosed: 1 }, 3);
  assert.strictEqual(mild.beyondScreening, false);
  assert.ok(!Layer.popupHtml(mild).includes('مؤشّر خطورة'));
});

ok('البطاقة والدليل يُرمّزان ولا يعرضان رقماً بلا أساس', () => {
  const impact = DigImpact.impactOf(PERMIT, PEAK);
  const html = Layer.popupHtml(impact);
  assert.ok(html.includes('زمن العبور'), 'المضاعف بلا وحدة مقروءة');
  assert.ok(html.includes('حجم/سعة'), 'النسبة قبل وبعد غائبة');
  assert.ok(html.includes('1475'), 'مصدر سعة منطقة العمل غير معلن');
  assert.strictEqual(Layer.popupHtml(null), '', 'بطاقة بلا حساب تعرض هيكلاً فارغاً');

  const legend = Layer.legendHtml(DigImpact.summarize({ features: [] }), 18);
  assert.ok(legend.includes('18:00'), 'الدليل بلا ساعة — يُقرأ حكماً دائماً');
  assert.ok(legend.includes('BPR'), 'الدليل بلا مصدر الحساب');
});

console.log(`\n${passed} فحصاً — حزمة أثر الحفر`);
