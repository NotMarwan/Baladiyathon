'use strict';
/**
 * بوابة توصيل طبقة المعالم.
 * ---------------------------------------------------------------------------
 * النمط قد يكون سليماً والبيانات نظيفة والطبقة لا تُرسم — لأن أحداً لم يستدعِ
 * `setPoi`. وهذا العطل صامت تماماً: لا خطأ في وحدة التحكم، ولا مصدر ناقص، بل
 * مصدرٌ صحيح فارغ. لا يُكتشف إلا بالعين على شاشة، وشاشة المحكّم أسوأ مكان
 * لاكتشافه.
 *
 * فيُقاس هنا في Node بخريطةٍ مزيّفة: هل يمرّر `init` المعالم إلى النمط؟ هل
 * يكتب `setPoi` في المصدر الصحيح؟ وهل يستدعيه السطحان اللذان يعرضانه فعلاً؟
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const WorksMap = require(path.join(__dirname, '..', 'masar-worksmap.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const EMPTY = { type: 'FeatureCollection', features: [] };

/** أدنى خريطة تحقق ما يلمسه `init` — بلا WebGL ولا DOM. */
function fakeMaplibre(captured) {
  function FakeMap(config) {
    captured.style = config.style;
    // المحرك الحقيقي ينشئ مصادر النمط عند التركيب، لا عند `addSource`. بدون
    // هذا السطر يقيس الفحص عيباً في الخريطة المزيّفة ويسمّيه عيباً في المنتج.
    this.sources = Object.assign({}, config.style.sources);
    this.layers = [];
    this.handlers = {};
  }
  FakeMap.prototype.on = function (event, a, b) {
    var cb = typeof a === 'function' ? a : b;
    (this.handlers[event] = this.handlers[event] || []).push(cb);
    if (event === 'load') cb();
  };
  FakeMap.prototype.addSource = function (id, def) { this.sources[id] = def; };
  FakeMap.prototype.addLayer = function (layer) { this.layers.push(layer); };
  FakeMap.prototype.getSource = function (id) {
    var self = this;
    if (!this.sources[id]) return undefined;
    return { setData: function (data) { self.sources[id] = { type: 'geojson', data: data }; } };
  };
  FakeMap.prototype.getCanvas = function () { return { style: {} }; };
  FakeMap.prototype.addControl = function () {};
  return {
    Map: FakeMap,
    getRTLTextPluginStatus: function () { return 'loaded'; },
    setRTLTextPlugin: function () {},
  };
}

function boot(options) {
  const captured = {};
  const GL = WorksMap.init({}, EMPTY, Object.assign(
    { maplibregl: fakeMaplibre(captured) }, options || {}
  ));
  return { GL: GL, style: captured.style };
}

ok('التوصيل: النمط يُبنى بمصدر معالم حتى بلا بيانات', () => {
  const { style } = boot();
  assert.ok(style.sources.poi, 'مصدر المعالم غائب عن النمط');
  assert.deepStrictEqual(style.sources.poi.data.features, []);
});

ok('التوصيل: المعالم المُمرَّرة عند التركيب تصل إلى النمط', () => {
  const poi = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { t: 1 }, geometry: null }] };
  const { style } = boot({ poi: poi });
  assert.strictEqual(style.sources.poi.data, poi);
});

ok('التوصيل: setPoi يكتب في مصدر المعالم لا في غيره', () => {
  const { GL } = boot();
  const poi = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: null }] };
  assert.strictEqual(typeof GL.setPoi, 'function', 'setPoi غير معروضة');
  assert.strictEqual(GL.setPoi(poi), true, 'setPoi لم تجد المصدر');
  assert.strictEqual(GL.map.sources.poi.data, poi);
  // مصادر الأعمال لا تُمَس — الخلط بينها يمحو المحفظة عند تحميل المعالم.
  assert.deepStrictEqual(GL.map.sources.works.data.features, []);
});

ok('التوصيل: setPoi بلا حجّة تُفرغ الطبقة ولا تُسقط الصفحة', () => {
  const { GL } = boot();
  assert.strictEqual(GL.setPoi(), true);
  assert.deepStrictEqual(GL.map.sources.poi.data.features, []);
});

ok('التوصيل: طبقات الأعمال فوق نقاط المعالم', () => {
  /**
   * `init` يُدرج طبقات الأعمال قبل أول symbol، والنقاط قبلها في النمط. هذا
   * الفحص يقيس النتيجة لا النية: لو نُقلت `poi-dots` بعد `road-labels` يوماً
   * لسقط هنا قبل أن يراه أحد على شاشة.
   */
  const { style } = boot();
  const ids = style.layers.map((l) => l.id);
  const firstSymbol = style.layers.findIndex((l) => l.type === 'symbol');
  assert.ok(ids.indexOf('poi-dots') < firstSymbol, 'النقاط ستعلو طبقات الأعمال');
});

ok('التوصيل: السطحان يستدعيان المحمِّل، والمحمِّل يعرف الملف', () => {
  /**
   * المنطق في `masar-roads-lazy.js` والصفحة تنادي بسطر.
   * ---------------------------------------------------------------------------
   * ليس تجميلاً: `masar-desk-boot.js` فوق ميزانيته في `file-budget-test`،
   * والقاعدة أن المتجاوز لا يُزاد عليه. فالفحص يقيس الطرفين معاً — نداءً في
   * الصفحة، ومساراً ومتغيّراً عاماً في الوحدة — لأن أحدهما بلا الآخر طبقةٌ صامتة.
   */
  const Lazy = require(path.join(ROOT, 'masar-roads-lazy.js'));
  assert.strictEqual(Lazy.POI.src, 'data/riyadh-poi.geojson.js');
  assert.strictEqual(Lazy.POI.globalName, 'RIYADH_POI');
  assert.strictEqual(typeof Lazy.attachPoi, 'function');

  /**
   * سطحان لا ثلاثة، وهذا قرارٌ لا سهو.
   * ---------------------------------------------------------------------------
   * `masar-prototype.html` فوق ميزانيته بـ1,804 سطر، والسقّاطة تمنع الزيادة ولو
   * سطراً. وهو ديمو الممر المكتوب — مشهدٌ واحد على طريق الملك فهد لا خريطة مدينة
   * تُستكشف، والمعالم فيه زينةٌ بلا وظيفة. فالسطحان اللذان تُقرأ فيهما المدينة
   * — الخريطة العامة ومكتب المراجع — يحملانها، والنموذج لا. أُعلن هنا كي لا
   * يُقرأ نقصاً يُسدّ لاحقاً بلا انتباه للميزانية.
   */
  for (const page of ['masar-map.html', 'masar-desk-boot.js']) {
    const text = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(/MasarRoadsLazy\.attachPoi\(/.test(text), `${page} لا يستدعي attachPoi`);
  }
  const proto = fs.readFileSync(path.join(ROOT, 'masar-prototype.html'), 'utf8');
  assert.ok(!/attachPoi/.test(proto),
    'النموذج صار يحمل المعالم — راجع ميزانية الملف قبل إبقائها');
});

ok('التوصيل: المحمِّل يصمت أمام خريطة لم تُقلع بدل أن يُسقط الصفحة', () => {
  /**
   * `onReady` تُطلق من ثلاثة أبواب، واثنان منها بلا نمطٍ محمَّل — فلا `setPoi`.
   * طبقةُ سياقٍ ترمي هناك تُسقط ما بعدها في السلسلة: السجلات والبحث والعدّاد.
   * فالحارس هو ما يجعل غياب المعالم غياباً لا عطلاً.
   */
  const Lazy = require(path.join(ROOT, 'masar-roads-lazy.js'));
  [null, undefined, {}, { setPoi: 'ليست دالة' }].forEach((GL) => {
    assert.doesNotThrow(() => Lazy.attachPoi(GL),
      `attachPoi رمت على ${JSON.stringify(GL)}`);
  });
});

ok('التوصيل: التحميل مؤجَّل — المعالم لا تسبق أول رسم', () => {
  /**
   * وسم `<script src="data/riyadh-poi…">` في رأس الصفحة يعيد الملف إلى المسار
   * الحرج ويؤخّر أول إطار بقدر تحليله. الطلب يجب أن يبقى داخل شيفرة التأجيل.
   */
  const text = fs.readFileSync(path.join(ROOT, 'masar-map.html'), 'utf8');
  assert.ok(!/<script[^>]*riyadh-poi/.test(text),
    'صفحة الخريطة تحمّل المعالم بوسم script — أعِدها إلى التأجيل');
});

ok('التوصيل: الدليل يذكر المعالم بلونها الفعلي', () => {
  const Panel = require(path.join(ROOT, 'masar-worksmap-panel.js'));
  const Style = require(path.join(ROOT, 'masar-worksmap-style.js'));
  // في Node لا وجود للمتغيّر العام، فيصمت الدليل — وهو السلوك المقصود.
  assert.ok(Panel.renderLegend([]).indexOf('wm-legend-dot') === -1,
    'الدليل يعد بطبقة قد لا تكون محمّلة');
  global.MasarWorksMapStyle = Style;
  try {
    const html = Panel.renderLegend([]);
    Style.POI_KINDS.forEach((kind) => {
      assert.ok(html.indexOf(Style.POI_COLORS[kind]) !== -1, `لون ${kind} غائب عن الدليل`);
      assert.ok(html.indexOf(Style.POI_LABELS[kind]) !== -1, `اسم ${kind} غائب عن الدليل`);
    });
  } finally {
    delete global.MasarWorksMapStyle;
  }
});

console.log(`\n${passed} فحصاً`);
