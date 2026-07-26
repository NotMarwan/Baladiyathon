'use strict';
const assert = require('assert');
const fs = require('fs');
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

ok('الثلاثية: لا شرط تجميع ميت في فلتر الرموز', () => {
  // `point_count` لا يوجد على أي ميزة بعد `cluster: false`، فالشرط كان يُقيَّم
  // على كل رمز في كل إطار ليعيد true دائماً. حذفه ثابت هنا كي لا يعود.
  const symbol = Layers.buildTriple({
    name: 'x', group: 'roadworks', source: 'works',
    lineColor: '#f0a020', casingColor: '#ffffff', iconImage: 'roadworks',
  })[2];
  assert.ok(!JSON.stringify(symbol.filter).includes('point_count'),
    'شرط استبعاد التجميعات عاد إلى فلتر الرموز');
  assert.ok(JSON.stringify(symbol.filter).includes('"roadworks"'), 'شرط المجموعة سقط');
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

ok('بلا تجميع: كل سجل يبقى رمزه على الخريطة', () => {
  assert.strictEqual(Layers.POINT_SOURCE_OPTIONS.cluster, false);
  assert.strictEqual(Layers.buildClusterLayers, undefined, 'طبقات دوائر العدّاد ما زالت مُصدَّرة');
});

ok('الازدحام يُحل بالتصادم: تراكب مسموح عند التقريب فقط', () => {
  const symbol = Layers.buildWorksLayers(BINDING).filter((l) => l.type === 'symbol')[0];
  const overlap = symbol.layout['icon-allow-overlap'];
  assert.strictEqual(overlap[0], 'step', 'التراكب ثابت — سيتكدس الرموز عند التقريب البعيد');
  assert.strictEqual(overlap[2], false, 'الرموز تتراكب تحت العتبة بدل أن تتصادم');
  assert.strictEqual(overlap[4], true, 'الرموز تُخفى فوق العتبة رغم اتساع المكان');
});

ok('الأشد يفوز بالتصادم', () => {
  const symbol = Layers.buildWorksLayers(BINDING).filter((l) => l.type === 'symbol')[0];
  // symbol-sort-key: الأدنى قيمةً يُرسم أولاً ويبقى. شدة 3 ← 7، شدة 0 ← 10.
  assert.deepStrictEqual(
    symbol.layout['symbol-sort-key'],
    ['-', 10, ['to-number', ['get', 'severity'], 0]]
  );
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
  const base = ['all', ['==', ['get', 'group'], 'closures']];
  const merged = Layers.composeFilter(base, ['<', ['get', 'start_ts'], 200]);
  assert.ok(JSON.stringify(merged).includes('"closures"'));
});

ok('لا طبقة بلا بيانات تسندها', () => {
  // `bus-routes` كانت ترسم صفر ميزة لأن لا سجل يحمل `subtype: 'bus'`، واللوحة
  // مع ذلك تقول «والحافلات». الحارس: كل شرط نوعٍ في السجل يقابله نوع في البيانات.
  const portfolio = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'data', 'city-portfolio.geojson'), 'utf8'));
  const present = new Set(portfolio.features.map((f) => f.properties.subtype));

  for (const group of Layers.LAYER_GROUPS) {
    for (const config of group.configs) {
      if (!config.subtype) continue;
      assert.ok(present.has(config.subtype),
        `${config.name} مقيدة بنوع «${config.subtype}» ولا سجل يحمله`);
    }
  }
});

ok('عنوان مجموعة التحويلات لا يَعِد بالحافلات', () => {
  const diversions = Layers.LAYER_GROUPS.filter((g) => g.id === 'diversions')[0];
  assert.ok(diversions, 'مجموعة التحويلات مفقودة');
  assert.strictEqual(diversions.label.indexOf('حافلات'), -1,
    'اللوحة ما زالت تَعِد بطبقة حافلات بلا بيانات');
  assert.strictEqual(diversions.configs.length, 1, 'الشقّ الميت عاد');
});

ok('baseFilters يغطي كل طبقة', () => {
  const filters = Layers.baseFilters();
  for (const layer of Layers.buildWorksLayers(BINDING)) {
    if (layer.id.indexOf('cluster') !== -1) continue;
    assert.ok(filters[layer.id], `لا فلتر أساسي لـ ${layer.id}`);
  }
});

/* ---- السماكة: العلامة لا تبتلع الطريق الذي تعلّمه ---- */

const Style = require(path.join(__dirname, '..', 'athar-worksmap-style.js'));
const Solution = require(path.join(__dirname, '..', 'athar-worksmap-solution.js'));

/**
 * يقيّم تعبير `interpolate` عند تقريبٍ معيّن.
 * الاختبار يسأل عن قيمةٍ يراها المستعمل، والقيمة بين التوقّفات لا عليها —
 * فقراءة التوقّفات وحدها تترك z14 وz18 بلا حارس، وهما ما اشتُكي منهما.
 */
function evaluateAtZoom(expression, zoom) {
  const kind = expression[1];
  const base = Array.isArray(kind) && kind[0] === 'exponential' ? kind[1] : 1;
  const stops = expression.slice(3);
  let lowZ = null; let lowV = null; let highZ = null; let highV = null;
  for (let i = 0; i < stops.length; i += 2) {
    if (stops[i] <= zoom) { lowZ = stops[i]; lowV = stops[i + 1]; }
    if (stops[i] >= zoom && highZ === null) { highZ = stops[i]; highV = stops[i + 1]; }
  }
  if (lowZ === null) return highV;
  if (highZ === null || highZ === lowZ) return lowV;
  const span = highZ - lowZ;
  const at = zoom - lowZ;
  const t = base === 1 ? at / span : (Math.pow(base, at) - 1) / (Math.pow(base, span) - 1);
  return lowV + t * (highV - lowV);
}

ok('layers: عرض العلامة يبقى دون عرض الشارع الذي تعلّمه', () => {
  // الشكوى الأصلية بالأرقام: عند z15 كانت العلامة 8.5 والحاشية 12.5 بينما
  // الشارع الرئيسي تحتها 7 — فتُقرأ العلامة طريقاً مستقلاً أعرض من الطريق.
  // عرض `roads` تعبيرٌ يتفرّع على التصنيف، فتُقرأ منه رتبة الشارع الرئيسي.
  const roadStops = Style.roadWidth(1).slice(3);
  const primaryAt = (zoom) => {
    const plain = ['interpolate', ['exponential', 1.6], ['zoom']];
    for (let i = 0; i < roadStops.length; i += 2) {
      const branch = roadStops[i + 1];
      // بنية `match`: [match, get, MAJOR, v, PRIMARY, v, LOCAL, v, احتياطي]
      plain.push(roadStops[i], branch[5]);
    }
    return evaluateAtZoom(plain, zoom);
  };

  [12, 14, 15, 16, 18].forEach((zoom) => {
    const mark = evaluateAtZoom(Layers.LINE_WIDTH, zoom);
    const casing = evaluateAtZoom(Layers.CASING_WIDTH, zoom);
    assert.ok(casing <= mark + 1.5,
      `z${zoom}: الحاشية ${casing.toFixed(1)} تزيد أكثر من بكسل ونصف على ${mark.toFixed(1)}`);

    /**
     * الشرط نسبيّ فوق تقريب الحيّ ومطلقٌ دونه.
     * عند تقريب المدينة يكون الشارع الرئيسي نفسه شعرةً بعرض 1.8 بكسل، وعلامةٌ
     * أرفع منه لا تُرى أصلاً — فاشتراط «أرفع من الطريق» هناك يعني حذف العلامة.
     * الذي يُشترط هناك ألا تتضخّم: سقفٌ مطلق. وفوق z14 يصير الطريق عريضاً
     * فيُشترط أن تبقى العلامة داخله.
     */
    if (zoom >= 14) {
      assert.ok(casing < primaryAt(zoom),
        `z${zoom}: العلامة بحاشيتها ${casing.toFixed(1)} أعرض من الشارع الرئيسي `
        + `${primaryAt(zoom).toFixed(1)} — تبتلع الطريق`);
    } else {
      assert.ok(casing <= 3.5,
        `z${zoom}: الحاشية ${casing.toFixed(1)} بكسل عند تقريب المدينة`);
    }
  });
});

ok('layers: السماكة تتبع التقريب ضمن الحدود المطلوبة', () => {
  const bounds = {
    12: [1.2, 2.6], 14: [2.4, 3.5], 15: [2.8, 3.6], 16: [3.2, 4.2], 18: [4.0, 5.6],
  };
  Object.keys(bounds).forEach((zoom) => {
    const value = evaluateAtZoom(Layers.LINE_WIDTH, Number(zoom));
    const [low, high] = bounds[zoom];
    assert.ok(value >= low && value <= high,
      `z${zoom}: ${value.toFixed(2)} خارج [${low}, ${high}]`);
  });
});

ok('layers: الشرطة تترك فجوةً يظهر منها الطريق', () => {
  const dash = Layers.DASH_PATTERN;
  assert.ok(dash[1] >= dash[0] * 0.65,
    `الفجوة ${dash[1]} ضيّقة أمام شرطة ${dash[0]} — يُقرأ الخط سادّاً`);
  // بوحدة عرض الخط: عند 3.2 بكسل تعطي [2.6, 2.0] شرطةً 8.3 وفجوةً 6.4.
  const width = evaluateAtZoom(Layers.LINE_WIDTH, 15);
  assert.ok(dash[0] * width >= 6 && dash[0] * width <= 11,
    `طول الشرطة ${(dash[0] * width).toFixed(1)} بكسل خارج المدى المقروء`);
});

ok('layers: حجم الشارة يتبع التقريب ولا يغطي التقاطع', () => {
  const raw = Layers.buildWorksLayers(BINDING)
    .find((layer) => /-symbols$/.test(layer.id));
  const size = raw.layout['icon-size'];
  assert.ok(Array.isArray(size) && size[0] === 'interpolate',
    'حجم الشارة ثابت — يغطي تقاطعاً كاملاً عند تقريب المدينة');
  assert.ok(evaluateAtZoom(size, 12) < evaluateAtZoom(size, 17),
    'الشارة لا تكبر مع التقريب');
});

ok('solution: عرض المسارات ضمن الحدود، والموصى به أعرض من المطروح', () => {
  const rank = Solution.ROUTE_RANK;
  const at = (kind, zoom) => {
    const stops = rank[kind].width;
    return evaluateAtZoom(['interpolate', ['linear'], ['zoom']].concat(stops), zoom);
  };
  const bounds = {
    first: { 12: [1.5, 2.5], 14: [3, 4], 16: [4, 5.5], 18: [4, 5.5] },
    closed: { 12: [2, 2.6], 14: [3, 3.5], 16: [3.5, 4.5], 18: [3.5, 4.5] },
  };
  Object.keys(bounds).forEach((kind) => {
    Object.keys(bounds[kind]).forEach((zoom) => {
      const value = at(kind, Number(zoom));
      const [low, high] = bounds[kind][zoom];
      assert.ok(value >= low && value <= high,
        `${kind} عند z${zoom}: ${value.toFixed(2)} خارج [${low}, ${high}]`);
    });
  });
  [12, 14, 16, 18].forEach((zoom) => {
    assert.ok(at('first', zoom) > at('second', zoom),
      `z${zoom}: الموصى به ليس أعرض من المطروح`);
  });
  assert.ok(rank.first.opacity > rank.second.opacity, 'المطروح ليس أشفّ');
  assert.ok(rank.first.opacity <= 0.9, 'الموصى به معتم تماماً — يخفي الطريق تحته');
  /**
   * الحدّ ليس رقماً مطلقاً بل علاقةً بالطريق.
   * الحاشية غلّظت عمداً كي تُقرأ حدّاً لا شعرة — وهي التي تُبقي الدرجة الفاتحة
   * من المطروح مرئية. والشرط الذي يمنع «ابتلاع الطريق» هو أن يبقى المسار
   * بحاشيته أرفع من الشارع الذي يعلّمه، من التقريب الرابع عشر فصاعداً.
   */
  const roadStops = Style.roadWidth(1).slice(3);
  const primaryAt = (zoom) => {
    const plain = ['interpolate', ['exponential', 1.6], ['zoom']];
    for (let i = 0; i < roadStops.length; i += 2) plain.push(roadStops[i], roadStops[i + 1][5]);
    return evaluateAtZoom(plain, zoom);
  };
  [14, 15, 16, 18].forEach((zoom) => {
    const road = primaryAt(zoom);
    const extra = evaluateAtZoom(
      ['interpolate', ['linear'], ['zoom'], 12, Solution.CASING_EXTRA[0],
        14, Solution.CASING_EXTRA[1], 16, Solution.CASING_EXTRA[2],
        18, Solution.CASING_EXTRA[3]], zoom);
    const marked = at('first', zoom) + extra;
    assert.ok(marked < road,
      `z${zoom}: المسار بحاشيته ${marked.toFixed(1)} والشارع تحته ${road.toFixed(1)}`);
  });
});

console.log(`\n${passed} اختبارات نجحت`);
