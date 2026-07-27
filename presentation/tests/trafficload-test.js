'use strict';
/**
 * حزمة الحمل المروري.
 *
 * ما تحرسه هذه الحزمة ليس صحّة الأرقام — لا عدّاد منشور في الرياض تُقاس
 * عليه. تحرس ثلاثة أشياء يمكن حراستها فعلاً:
 *
 *   ١) أن عكس دالة BPR هو **عكس** الدالة نفسها، بمعاملَين مشتركين لا نسختين.
 *   ٢) أن جدول الأصناف هنا يطابق الجدول المولَّد في رسم التوجيه حرفاً بحرف.
 *   ٣) أن لا رقم يخرج عارياً: كل تقدير يحمل طريقته وصنف دليله ومظروفه.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Engine = require(path.join(__dirname, '..', 'masar-engine.js'));
const TrafficLoad = require(path.join(__dirname, '..', 'masar-trafficload.js'));
const Layer = require(path.join(__dirname, '..', 'masar-trafficload-layer.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

/* ---- ١) الدالة وعكسها ---- */

ok('عكس BPR يعيد نسبة الحجم/السعة إلى ما كانت', () => {
  const freeFlowMin = 6;
  for (const ratio of [0.2, 0.5, 0.8, 1, 1.3]) {
    const capacity = 7200;
    const volume = ratio * capacity;
    const minutes = Engine.bprTravelTime(freeFlowMin, volume, capacity);
    const back = Engine.bprVolumeRatio(minutes / freeFlowMin);
    assert.ok(Math.abs(back - ratio) < 1e-9,
      `الجولة كسرت عند ${ratio}: عادت ${back}`);
  }
});

ok('عكس BPR يعيد صفراً عند زمنٍ لا يتجاوز التدفق الحرّ', () => {
  // الجذر الرابع ينفجر حساسيةً قرب t=t0؛ الصفر إعلانُ حدٍّ لا قراءةُ خلوّ.
  assert.strictEqual(Engine.bprVolumeRatio(1), 0);
  assert.strictEqual(Engine.bprVolumeRatio(0.8), 0);
  assert.strictEqual(Engine.bprVolumeRatio(NaN), 0);
});

ok('المعاملان مصدرٌ واحد للأمام والعكس', () => {
  // لو انفصلا لصارا دالّتين لا دالّةً ومعكوسها — والاختبار السابق وحده لا
  // يكشفه إن غُيّر الاثنان معاً بقيمتين متوافقتين صدفةً.
  assert.strictEqual(Engine.BPR_ALPHA, 0.15);
  assert.strictEqual(Engine.BPR_BETA, 4);
  const t = Engine.bprTravelTime(10, 900, 1000);
  assert.ok(Math.abs(t - 10 * (1 + Engine.BPR_ALPHA * Math.pow(0.9, Engine.BPR_BETA))) < 1e-12);
});

/* ---- ٢) جدولان لا ينحرفان ---- */

ok('جدول الأصناف يطابق الجدول المولَّد في رسم التوجيه', () => {
  const graphPath = path.join(__dirname, '..', 'data', 'riyadh-route-graph.js');
  const head = fs.readFileSync(graphPath, 'utf8').slice(0, 6000);
  const start = head.indexOf('classes');
  assert.ok(start !== -1, 'الرسم بلا جدول أصناف — تغيّر شكل البيانات الوصفية');
  const raw = head.slice(start, head.indexOf(']', start) + 1).replace(/\\"/g, '"');
  const classes = JSON.parse('{"' + raw.slice(raw.indexOf('classes')) + '}');

  for (const entry of classes.classes) {
    const mine = TrafficLoad.CLASS_PROFILES[entry.name];
    assert.ok(mine, `الصنف ${entry.name} موجود في الرسم ومفقود في وحدة الحمل`);
    assert.strictEqual(mine.aadtPerLane, entry.aadt, `${entry.name}: حمل الحارة انحرف`);
    assert.strictEqual(mine.capacity, entry.capacity, `${entry.name}: السعة انحرفت`);
    assert.strictEqual(mine.lanes, entry.lanes, `${entry.name}: الحارات الافتراضية انحرفت`);
    assert.strictEqual(mine.kmh, entry.kmh, `${entry.name}: السرعة انحرفت`);
  }
  assert.strictEqual(
    Object.keys(TrafficLoad.CLASS_PROFILES).length, classes.classes.length,
    'عدد الأصناف مختلف بين الجدولين'
  );
});

/* ---- ٣) سلّم الطرق ---- */

ok('الدرجة الأولى: عدّاد مرصود يفوز على كل تقدير', () => {
  const result = TrafficLoad.estimate({
    highway: 'primary', lanes: 3, aadt: 61234,
    observedSpeedKmh: 20, freeFlowKmh: 70,
  });
  assert.strictEqual(result.aadt, 61234);
  assert.strictEqual(result.method, 'observed');
  assert.strictEqual(result.evidence, 'مُثبَت عملياً');
  assert.strictEqual(result.low, result.aadt, 'الرقم المقيس لا يحمل مظروف تقدير');
  assert.strictEqual(result.high, result.aadt);
});

ok('الدرجة الثانية: السرعة المرصودة تُستعمل داخل نطاق الصلاحية', () => {
  // t/t0 = 60/53.6 ≈ 1.12 — داخل النافذة الضيّقة، والنسبة الناتجة ≈ 0.95.
  const result = TrafficLoad.estimate({
    highway: 'secondary', lanes: 2, observedSpeedKmh: 53.6, freeFlowKmh: 60,
  });
  assert.strictEqual(result.method, 'probe-speed');
  assert.strictEqual(result.evidence, 'متوقَّع من تجربة');
  assert.ok(result.aadt > 0);
  assert.ok(
    result.caveats.join(' ').includes('غير أحادي'),
    'تحفّظ فرع المخطط الأساسي مفقود — وهو الشرط الذي يقوم عليه الرقم كله'
  );
});

ok('الدرجة الثانية تُرفَض فوق التشبّع ولا تفوز برقمٍ باطل', () => {
  /* هذه كانت العلّة: الوحدة تكتب «خارج نطاق صلاحية BPR» في تحفّظ **ثم تعتمد
     الرقم**، فيتصدّر أغمق لون على الخريطة ويهزم تقدير الصنف. والتحفّظ لا
     يُصدَّر إلى الخريطة أصلاً، فلا شيء يعرف أن المقطع خارج النطاق. */
  const rejected = TrafficLoad.estimate({
    highway: 'primary', lanes: 3, observedSpeedKmh: 8, freeFlowKmh: 70,
  });
  const classOnly = TrafficLoad.estimate({ highway: 'primary', lanes: 3 });

  assert.strictEqual(rejected.method, 'class-model', 'رقمٌ باطل فاز على نموذج الصنف');
  assert.strictEqual(rejected.aadt, classOnly.aadt);
  assert.ok(rejected.caveats.join(' ').includes('خارج نطاق'),
    'الرفض وقع صامتاً بلا سبب مكتوب');
});

ok('الدرجة الثانية تُرفَض قرب التدفق الحرّ', () => {
  // t/t0 = 70/68 ≈ 1.03: الجذر الرابع يضخّم أي خطأ في السرعة الحرّة.
  const result = TrafficLoad.estimate({
    highway: 'primary', lanes: 3, observedSpeedKmh: 68, freeFlowKmh: 70,
  });
  assert.strictEqual(result.method, 'class-model');
  assert.ok(result.caveats.join(' ').includes('شديد الحساسية'));
});

ok('نافذة صلاحية الاستدلال من السرعة ضيّقة — والضيق نتيجة لا عيب تنفيذ', () => {
  /* هذه أهمّ حقيقة تخرج من كل هذا: مع معاملَي BPR المعياريين (0.15, 4)، تكون
     v/c = 1 عند t/t0 = 1.15 بالضبط. وحدّ الحساسية الأدنى 1.10. فالنافذة التي
     يصلح فيها عكس BPR كلها **بين 1.10 و1.15** — أي تباطؤٌ بين 10٪ و15٪ فقط.
     وما دونها ضجيج، وما فوقها خارج نطاق الدالة.
     ومعنى ذلك صريح: «طريقة جوجل» — استنتاج الحمل من السرعة — لا تُنتج رقماً
     صالحاً بلا معايرة محلية لـ α و β. الاختبار يثبّت الحدّ كي لا يُوسَّع
     صامتاً يوماً فيعود الرقم الباطل. */
  const atUnity = Engine.bprVolumeRatio(1 + Engine.BPR_ALPHA);
  assert.ok(Math.abs(atUnity - 1) < 1e-12, 'حدّ التشبّع ليس عند 1 + α');
  assert.strictEqual(TrafficLoad.PROBE_MAX_VC, 1);
  assert.strictEqual(TrafficLoad.PROBE_MIN_TIME_RATIO, 1.1);
  assert.ok(TrafficLoad.PROBE_MIN_TIME_RATIO < 1 + Engine.BPR_ALPHA,
    'النافذة انعدمت: الحدّ الأدنى تجاوز حدّ التشبّع');
});

ok('مظروف الاستدلال من السرعة أوسع من مظروف نموذج الصنف', () => {
  /* الترتيب المقلوب كان ادّعاءً بأن السرعة أدقّ من الجدول. ومظروف معاملَي
     BPR المنشور وحده يحرّك الناتج بين 0.6 و1.1 من قيمته. */
  const probe = TrafficLoad.ENVELOPES.probeSpeed;
  const cls = TrafficLoad.ENVELOPES.classModelWithLanes;
  assert.ok(probe.high - probe.low > cls.high - cls.low,
    'الاستدلال من السرعة يدّعي دقّةً أعلى من جدول الأصناف بلا سند');
});

ok('الدرجة الثالثة: صنف الطريق × حاراته', () => {
  const result = TrafficLoad.estimate({ highway: 'primary', lanes: 3 });
  assert.strictEqual(result.method, 'class-model');
  assert.strictEqual(result.aadt, 3 * 14000);
  assert.strictEqual(result.lanesSource, 'osm');
  assert.strictEqual(result.evidence, 'افتراض توضيحي معلن');
});

ok('حارات غير مسجَّلة: تُؤخذ من الصنف ويتّسع المظروف', () => {
  const known = TrafficLoad.estimate({ highway: 'secondary', lanes: 2 });
  const unknown = TrafficLoad.estimate({ highway: 'secondary' });

  assert.strictEqual(unknown.lanesSource, 'class-default');
  assert.strictEqual(unknown.lanes, TrafficLoad.CLASS_PROFILES.secondary.lanes);
  const knownSpan = (known.high - known.low) / known.aadt;
  const unknownSpan = (unknown.high - unknown.low) / unknown.aadt;
  assert.ok(unknownSpan > knownSpan,
    'مجهولان في التقدير بمظروف مجهولٍ واحد — الجهل لا يُعلن');
  assert.ok(
    unknown.caveats.join(' ').includes('الحارات'),
    'الحارات المفترضة بلا إعلان في التحفّظات'
  );
});

ok('صنف غير معروف يرتدّ إلى الاحتياطي لا إلى صفر', () => {
  const result = TrafficLoad.estimate({ highway: 'service_road_xyz' });
  assert.ok(result.aadt > 0);
  assert.strictEqual(result.lanes, TrafficLoad.CLASS_PROFILES.unclassified.lanes);
});

/* ---- ٤) لا رقم عارٍ ---- */

ok('كل تقدير يحمل طريقته وصنف دليله ومظروفه', () => {
  const cases = [
    { highway: 'motorway', lanes: 4 },
    { highway: 'residential' },
    { highway: 'trunk', lanes: 3, observedSpeedKmh: 40, freeFlowKmh: 90 },
    { highway: 'primary', lanes: 3, aadt: 50000 },
  ];
  for (const input of cases) {
    const result = TrafficLoad.estimate(input);
    assert.ok(result.method, 'تقدير بلا طريقة');
    assert.ok(result.evidence, 'تقدير بلا صنف دليل');
    assert.ok(result.basis && result.basis.length > 10, 'تقدير بلا أساس مكتوب');
    assert.ok(result.envelopeNote && result.envelopeNote.length > 10, 'تقدير بلا نص مظروف');
    assert.ok(result.low <= result.aadt && result.aadt <= result.high, 'المظروف لا يحيط بالرقم');
  }
});

ok('نص المظروف يقول إنه معلن لا مقيس', () => {
  const result = TrafficLoad.estimate({ highway: 'primary', lanes: 3 });
  assert.ok(result.envelopeNote.includes('لا خطأ مقيس'),
    'المظروف يُقدَّم كخطأ مقيس — وهو ليس كذلك، لا عدّاد منشور تُقاس عليه');
});

/* ---- ٤ب) الاتجاه والسعة التشغيلية ---- */

ok('الاتجاه يُقرأ من الوسم ويُنقل مع النتيجة', () => {
  /* 8,539 من 9,277 مقطعاً في بيانات الرياض تحمل oneway=1. الرقم الواحد كان
     يعني «في الاتجاهين» على 8٪ و«في اتجاه» على 92٪ بوسمٍ واحد ولونٍ واحد. */
  const oneWay = TrafficLoad.estimate({ highway: 'primary', lanes: 3, oneway: 1 });
  const twoWay = TrafficLoad.estimate({ highway: 'primary', lanes: 3 });

  assert.strictEqual(oneWay.oneway, true);
  assert.strictEqual(twoWay.oneway, false);
  assert.notStrictEqual(oneWay.directionLabel, twoWay.directionLabel);
  assert.strictEqual(oneWay.aadt, twoWay.aadt, 'الحجم اليومي للمقطع لا يتغيّر بالوسم');
});

ok('نسبة الازدحام اتجاهية: الحارات تُنصَّف والذروة تُوزَّع', () => {
  const oneWay = TrafficLoad.estimate({ highway: 'primary', lanes: 4, oneway: 1 });
  const twoWay = TrafficLoad.estimate({ highway: 'primary', lanes: 4 });
  // نفس الحجم، ونصف الحارات في الاتجاه، ونصيب اتجاهي 0.6 ⇒ نسبة أعلى.
  assert.ok(twoWay.peakRatio > oneWay.peakRatio,
    'الثنائي يُقرأ أسلس من الأحادي رغم أن حاراته موزّعة على اتجاهين');
  assert.strictEqual(twoWay.peakCapacity, oneWay.peakCapacity / 2);
});

ok('النسبة تُعرض بمقامين: تدفق التشبّع والسعة الإشارية', () => {
  /* 1900 مركبة/ساعة/حارة تدفقُ تشبّع لا سعة إشارية. وقياس الطرفين على شبكة
     الرياض أعطى 0٪ تشبّعاً على الأول و63٪ على الثاني — أي أن جدول أحمال
     الحارة وسعةً إشارية **افتراضان متناقضان** في هذا المستودع. فلا يُخفى
     أحدهما: الخريطة تلوّن على الأول (أساس محرك التوجيه نفسه) والبطاقة تعرض
     الاثنين. */
  const arterial = TrafficLoad.estimate({ highway: 'primary', lanes: 3, oneway: 1 });
  const motorway = TrafficLoad.estimate({ highway: 'motorway', lanes: 3, oneway: 1 });

  assert.strictEqual(arterial.greenFraction, 0.45);
  assert.strictEqual(motorway.greenFraction, 1, 'التدفق غير المتقطّع لا إشارة فيه');
  assert.strictEqual(arterial.peakCapacity, 3 * 1900, 'المقام المعروض ليس تدفق التشبّع');
  assert.strictEqual(arterial.peakCapacitySignalized, Math.round(3 * 1900 * 0.45));
  assert.ok(arterial.peakRatioSignalized > arterial.peakRatio,
    'المقام الإشاري لا يرفع النسبة — فُقد التحذير');
  assert.strictEqual(motorway.peakRatioSignalized, motorway.peakRatio,
    'طريقٌ حرّ نُسبت إليه إشارة');
});

ok('البطاقة تعرض المقامين معاً لا الأخف وحده', () => {
  const html = Layer.popupHtml(TrafficLoad.estimate({ highway: 'primary', lanes: 3, oneway: 1 }));
  assert.ok(html.includes('تدفق التشبّع'), 'المقام الأول غائب');
  assert.ok(html.includes('سعة إشارية'), 'المقام الثاني غائب — الأخضر يُقرأ براءةً');
});

ok('الرقم المعروض مقرَّب إلى رقمين معنويين', () => {
  assert.strictEqual(TrafficLoad.roundToSignificant(101772, 2), 100000);
  assert.strictEqual(TrafficLoad.roundToSignificant(42317, 2), 42000);
  assert.strictEqual(TrafficLoad.roundToSignificant(0, 2), 0);
  const result = TrafficLoad.estimate({ highway: 'secondary', lanes: 2 });
  assert.strictEqual(result.aadtRounded, TrafficLoad.roundToSignificant(result.aadt, 2));
});

/* ---- ٥) الساعات والنطاقات ---- */

ok('الملف الساعي من المحرك: مجموع الساعات يعيد اليوم كاملاً', () => {
  let total = 0;
  for (let hour = 0; hour < 24; hour += 1) total += TrafficLoad.hourlyVolume(48000, hour);
  assert.ok(Math.abs(total - 48000) < 1e-6, `المجموع ${total} لا يساوي AADT`);
});

ok('ساعة الذروة هي ذروة ملف المحرك لا رقم منسوخ', () => {
  const peak = TrafficLoad.peakShare();
  assert.strictEqual(peak.share, Math.max(...Engine.HOURLY_PROFILE));
  assert.strictEqual(Engine.HOURLY_PROFILE[peak.hour], peak.share);
});

ok('النطاقات متتابعة وتغطي كل قيمة', () => {
  const values = [0, 9999, 10000, 29999, 30000, 59999, 60000, 99999, 100000, 5e6];
  for (const value of values) {
    const band = TrafficLoad.bandOf(value);
    assert.ok(band && band.id, `قيمة بلا نطاق: ${value}`);
  }
  assert.strictEqual(TrafficLoad.bandOf(9999).id, 'very-low');
  assert.strictEqual(TrafficLoad.bandOf(10000).id, 'low');
  assert.strictEqual(TrafficLoad.bandOf(100000).id, 'very-high');
});

/* ---- ٦) المجموعة ---- */

const SAMPLE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { osmId: 'w1', highway: 'motorway', lanes: 4, name: 'محور' },
      geometry: { type: 'LineString', coordinates: [[46.6, 24.7], [46.7, 24.8]] },
    },
    {
      type: 'Feature',
      properties: { osmId: 'w2', highway: 'tertiary', lanes: null },
      geometry: { type: 'LineString', coordinates: [[46.6, 24.7], [46.61, 24.71]] },
    },
  ],
};

ok('التقدير الجماعي لا يمسّ المُدخل', () => {
  const before = JSON.stringify(SAMPLE);
  TrafficLoad.estimateCollection(SAMPLE);
  assert.strictEqual(JSON.stringify(SAMPLE), before, 'مصدر الطرق الأصلي تغيّر');
});

ok('التقدير الجماعي يحمل الحقول التي ترسمها الخريطة', () => {
  const out = TrafficLoad.estimateCollection(SAMPLE);
  assert.strictEqual(out.features.length, 2);
  for (const feature of out.features) {
    const props = feature.properties;
    for (const key of ['load_aadt', 'load_band', 'load_method', 'load_evidence',
      'load_lanes', 'load_lanes_source', 'load_low', 'load_high']) {
      assert.ok(props[key] !== undefined, `الحقل ${key} مفقود`);
    }
    assert.ok(feature.geometry, 'الميزة بلا هندسة');
  }
});

ok('الحصيلة تعلن تغطية الحارات لا تخفيها', () => {
  const summary = TrafficLoad.summarize(TrafficLoad.estimateCollection(SAMPLE));
  assert.strictEqual(summary.segments, 2);
  assert.strictEqual(summary.lanesFromOsm, 1);
  assert.strictEqual(summary.lanesCoveragePct, 50);
});

/* ---- ٧) الطبقة والبطاقة ---- */

ok('تعبير اللون مبنيّ من النطاقات نفسها', () => {
  const expression = Layer.colorExpression();
  for (const band of TrafficLoad.BANDS) {
    assert.ok(expression.includes(band.id), `النطاق ${band.id} خارج تعبير اللون`);
    assert.ok(expression.includes(band.color), `لون ${band.id} خارج التعبير`);
  }
});

ok('الطبقة مطفأة عند التركيب', () => {
  // الخريطة عند أول نظرة تعرض ما هو مسجَّل؛ التقدير لا يُقدَّم عليه بلا طلب.
  assert.strictEqual(Layer.buildLayer('traffic-load').layout.visibility, 'none');
  assert.strictEqual(Layer.buildWeakLayer('traffic-load').layout.visibility, 'none');
});

ok('الأساس الضعيف مخطّط لا مصمت', () => {
  /* 55٪ من المقاطع بلا `lanes` مسجَّلة، فتقديرها دالةٌ في وسم الطريق وحده.
     رسمُها بنفس الخط المصمت يجعل الشبكة كلها تُقرأ حقلاً مقيساً واحداً. */
  const solid = Layer.buildLayer('traffic-load');
  const weak = Layer.buildWeakLayer('traffic-load');

  assert.ok(!solid.paint['line-dasharray'], 'المقاطع ذات الحارات المسجَّلة مخطّطة');
  assert.ok(weak.paint['line-dasharray'], 'المقاطع ذات الحارات المفترضة مصمتة');
  assert.deepStrictEqual(solid.filter, ['==', ['get', 'load_lanes_source'], 'osm']);
  assert.deepStrictEqual(weak.filter, ['!=', ['get', 'load_lanes_source'], 'osm']);
  assert.notStrictEqual(solid.id, weak.id);
});

ok('وضع الازدحام يحسب النسبة داخل تعبير الخريطة', () => {
  /* الحساب في جافاسكربت يعني إعادة بناء مئة ألف كائن عند كل خطوة منزلق.
     التعبير يقرأ الحجم والسعة ومعامل الاتجاه من الميزة نفسها. */
  const expression = JSON.stringify(Layer.congestionColorExpression(0.09));
  assert.ok(expression.includes('load_aadt'), 'الحجم خارج التعبير');
  assert.ok(expression.includes('load_capacity'), 'السعة خارج التعبير');
  assert.ok(expression.includes('load_dir_factor'), 'معامل الاتجاه خارج التعبير');
  for (const band of TrafficLoad.CONGESTION_BANDS) {
    assert.ok(expression.includes(band.color), `لون ${band.id} خارج تعبير الازدحام`);
  }
});

ok('الوضعان يعطيان تعبيرين مختلفين، والساعة تغيّر تعبير الازدحام', () => {
  const volume = JSON.stringify(Layer.buildLayer('s', 'volume').paint['line-color']);
  const atPeak = JSON.stringify(Layer.buildLayer('s', 'congestion', 18).paint['line-color']);
  const atNight = JSON.stringify(Layer.buildLayer('s', 'congestion', 3).paint['line-color']);

  assert.notStrictEqual(volume, atPeak, 'الوضعان يرسمان اللون نفسه');
  assert.notStrictEqual(atPeak, atNight, 'الساعة لا تغيّر شيئاً — المنزلق زينة');
});

ok('المقبض يبدّل الوضع والساعة بإعادة طلاء لا بإعادة حساب', () => {
  let dataPushes = 0;
  const painted = [];
  const fakeMap = {
    sources: {}, layers: {},
    getSource: function (id) {
      return this.sources[id]
        ? { setData: function () { dataPushes += 1; } }
        : null;
    },
    getLayer: function (id) { return this.layers[id] || null; },
    addSource: function (id, spec) { this.sources[id] = spec; },
    addLayer: function (spec) { this.layers[spec.id] = spec; },
    setLayoutProperty: function () {},
    setPaintProperty: function (id, key) { painted.push(id + ':' + key); },
    on: function () {}, off: function () {},
  };

  const handle = Layer.install(fakeMap, function () { return SAMPLE; });
  handle.setVisible(true);
  const pushesAfterShow = dataPushes;

  assert.strictEqual(handle.setMode('congestion'), 'congestion');
  assert.strictEqual(handle.setHour(3), 3);
  assert.strictEqual(handle.hour(), 3);
  assert.strictEqual(dataPushes, pushesAfterShow, 'تغيير الوضع أعاد دفع البيانات');
  assert.ok(painted.length >= 4, 'الطبقتان لم تُعادا طلاءهما');

  assert.strictEqual(handle.setHour(25), 1, 'الساعة لا تُلفّ حول اليوم');
  assert.strictEqual(handle.setMode('حشو'), 'volume', 'وضعٌ مجهول لا يرتدّ إلى المعلوم');
});

ok('refresh يُعيد الحساب حين تصل حلقة طرقٍ جديدة', () => {
  /* الشبكة تصل على حلقات بعد التشغيل. بلا هذا يبقى الشريط على الشرايين
     وحدها، ويُقرأ فراغُ الشوارع المحلية «لا حركة» لا «لم يُحسب». */
  let roads = SAMPLE;
  const fakeMap = {
    sources: {}, layers: {},
    getSource: function (id) { return this.sources[id] ? { setData: function () {} } : null; },
    getLayer: function (id) { return this.layers[id] || null; },
    addSource: function (id, spec) { this.sources[id] = spec; },
    addLayer: function (spec) { this.layers[spec.id] = spec; },
    setLayoutProperty: function () {}, setPaintProperty: function () {},
    on: function () {}, off: function () {},
  };

  const handle = Layer.install(fakeMap, function () { return roads; });
  assert.strictEqual(handle.refresh(), null, 'حدّث طبقةً مطفأة');

  const first = handle.setVisible(true);
  assert.strictEqual(first.segments, 2);

  roads = {
    type: 'FeatureCollection',
    features: SAMPLE.features.concat([{
      type: 'Feature',
      properties: { osmId: 'w3', highway: 'residential' },
      geometry: { type: 'LineString', coordinates: [[46.6, 24.7], [46.62, 24.72]] },
    }]),
  };
  assert.strictEqual(handle.refresh().segments, 3, 'الحلقة الجديدة لم تدخل التقدير');
});

/* ---- حالات حدّية ---- */

ok('مدخلات فاسدة لا تُنتج رقماً موهماً', () => {
  assert.ok(TrafficLoad.estimate(null).aadt > 0, 'مقطع غائب رمى بدل أن يرتدّ');
  assert.ok(TrafficLoad.estimate(undefined).aadt > 0);

  const profile = TrafficLoad.CLASS_PROFILES.secondary;
  assert.strictEqual(TrafficLoad.resolveLanes({ lanes: 0 }, profile).source, 'class-default');
  assert.strictEqual(TrafficLoad.resolveLanes({ lanes: -2 }, profile).source, 'class-default');
  assert.strictEqual(TrafficLoad.resolveLanes({ lanes: 'حشو' }, profile).source, 'class-default');
  assert.strictEqual(TrafficLoad.resolveLanes({ lanes: '3' }, profile).lanes, 3);

  // ساعة فاسدة كانت تُنتج NaN صامتاً عبر الفهرسة بـ NaN.
  assert.strictEqual(TrafficLoad.hourlyVolume(50000, NaN), 0);
  assert.strictEqual(TrafficLoad.hourlyVolume(50000, undefined), 0);
  assert.ok(TrafficLoad.hourlyVolume(50000, -3) > 0, 'ساعة سالبة تُلفّ حول اليوم');
});

ok('عرض الشريط من دالة عرض الطرق نفسها', () => {
  const Style = require(path.join(__dirname, '..', 'masar-worksmap-style.js'));
  assert.deepStrictEqual(
    Layer.buildLayer('traffic-load').paint['line-width'],
    Style.roadWidth(Layer.WIDTH_SCALE),
    'عرض الشريط نسخةٌ ثانية من منحنى العرض — ينحرف عن الشارع عند أول تعديل'
  );
});

ok('التركيب لا يرمي حين لا يكون النمط جاهزاً', () => {
  /* `onReady` في صفحة الخريطة سلسلةٌ واحدة: رميةٌ من هنا تُسقط السجلات
     والبحث بعدها. وقد وقع هذا فعلاً — `addSource` رمى «Style is not done
     loading» على مسار المهلة، فبقيت الصفحة بلا لوحة ولا قائمة. */
  var listeners = 0;
  var fakeMap = {
    getSource: function () { return null; },
    getLayer: function () { return null; },
    addSource: function () { throw new Error('Style is not done loading.'); },
    addLayer: function () { throw new Error('Style is not done loading.'); },
    setLayoutProperty: function () {},
    on: function () { listeners += 1; },
    off: function () {},
  };

  var handle = Layer.install(fakeMap, function () { return SAMPLE; });
  assert.strictEqual(handle.ensureLayer(), false, 'ادّعى التركيب وهو لم يقع');
  assert.ok(handle.lastError(), 'السبب ابتُلع صامتاً');
  assert.strictEqual(handle.setVisible(true), null, 'أعاد حصيلةً لطبقةٍ غير مركَّبة');
  assert.ok(listeners > 0, 'لا محاولة إعادة عند اكتمال النمط');
});

ok('التركيب يقع حين يقبل النمط', () => {
  var added = [];
  var fakeMap = {
    sources: {}, layers: {},
    getSource: function (id) { return this.sources[id] || null; },
    getLayer: function (id) { return this.layers[id] || null; },
    addSource: function (id, spec) { this.sources[id] = spec; added.push(id); },
    addLayer: function (spec) { this.layers[spec.id] = spec; added.push(spec.id); },
    setLayoutProperty: function (id, key, value) { this.layers[id].layout[key] = value; },
    on: function () {}, off: function () {},
  };

  var handle = Layer.install(fakeMap, function () { return SAMPLE; });
  assert.ok(handle.ensureLayer(), 'لم يُركَّب مع خريطةٍ قابلة');
  assert.deepStrictEqual(added, [Layer.SOURCE_ID, Layer.LAYER_ID, Layer.WEAK_LAYER_ID]);

  var summary = handle.setVisible(true);
  assert.strictEqual(summary.segments, SAMPLE.features.length);
  assert.strictEqual(fakeMap.layers[Layer.LAYER_ID].layout.visibility, 'visible');
  handle.setVisible(false);
  assert.strictEqual(fakeMap.layers[Layer.LAYER_ID].layout.visibility, 'none');
});

ok('الدليل يقول صراحةً إن الأرقام تقديرات', () => {
  const html = Layer.legendHtml(TrafficLoad.summarize(TrafficLoad.estimateCollection(SAMPLE)));
  assert.ok(html.includes('تقدير'), 'الدليل يعرض ألواناً بلا إعلان أنها تقدير');
  assert.ok(html.includes('لا توجد بيانات أحجام مرور منشورة'),
    'غياب البيانات المنشورة غير معلن في الدليل');
});

ok('البطاقة تُرمّز اسم الشارع', () => {
  const estimate = TrafficLoad.estimate({ highway: 'primary', lanes: 3 });
  const html = Layer.roadPopupHtml('<img src=x onerror=alert(1)>', estimate);
  assert.ok(!html.includes('<img'), 'اسم الشارع دخل البطاقة شيفرةً');
  assert.ok(html.includes('&lt;img'), 'الترميز لم يقع');
});

ok('البطاقة تعرض المظروف والطريقة مع الرقم', () => {
  const estimate = TrafficLoad.estimate({ highway: 'secondary' });
  const html = Layer.popupHtml(estimate);
  assert.ok(html.includes('المظروف المعلن'), 'الرقم معروض بلا مظروف');
  assert.ok(html.includes(estimate.methodLabel), 'الرقم معروض بلا طريقته');
  assert.ok(html.includes(estimate.evidence), 'الرقم معروض بلا صنف دليله');
});

console.log(`\n${passed} فحصاً — حزمة الحمل المروري`);
