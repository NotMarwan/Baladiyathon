'use strict';
/**
 * بوابة طبقة المعالم في النمط.
 * ---------------------------------------------------------------------------
 * الطبقة تنجح أو تسقط في تفصيلين لا يُريان بالعين على شاشة المطوّر:
 *   ١) **الترتيب**. `masar-worksmap.js` يُدرج طبقات الأعمال قبل أول طبقة
 *      symbol. فإن سبقت نقاطُ المعالم تلك الطبقة وقعت الأعمال فوقها — وهو
 *      المطلوب. وإن تأخّرت عنها غطّت نقطةُ مقهى خطَّ إغلاقٍ ولا أحد يلاحظ حتى
 *      يقف محكّم أمام الشاشة.
 *   ٢) **عتبات الرتب**. تعبير `interpolate` مركّب، وقلبُ `<=` إلى `>=` فيه
 *      يُظهر كل المعالم عند z11 بدل أن يُظهر الرتبة الأولى. النمط يبقى صالحاً
 *      شكلاً، والخريطة تصير سحابة نقاط.
 * فيُقاس الاثنان هنا في Node بلا متصفح.
 */
const assert = require('assert');
const path = require('path');
const Style = require(path.join(__dirname, '..', 'masar-worksmap-style.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const EMPTY = { type: 'FeatureCollection', features: [] };
const OPTIONS = { glyphsUrl: 'g/{fontstack}/{range}.pbf', spriteUrl: 's/sprite' };

function styleOf(extra) {
  return Style.buildStyle(EMPTY, EMPTY, Object.assign({}, OPTIONS, extra || {}));
}
function layerIndex(style, id) {
  return style.layers.findIndex((layer) => layer.id === id);
}

/**
 * مُقيّم مصغَّر للجزء المستعمَل من لغة تعبيرات MapLibre.
 * يكفي `interpolate/linear` و`case` و`get` و`==`/`<=` — وهي كل ما تحمله
 * تعبيرات هذه الطبقة. الغرض قياس السلوك لا محاكاة المحرك.
 */
function evaluate(expr, props, zoom) {
  if (!Array.isArray(expr)) return expr;
  const [op] = expr;
  if (op === 'get') return props[expr[1]];
  if (op === 'zoom') return zoom;
  if (op === 'to-number') { const v = evaluate(expr[1], props, zoom); return typeof v === 'number' ? v : expr[2]; }
  if (op === '==') return evaluate(expr[1], props, zoom) === evaluate(expr[2], props, zoom);
  if (op === '<=') return evaluate(expr[1], props, zoom) <= evaluate(expr[2], props, zoom);
  if (op === '-') return evaluate(expr[1], props, zoom) - evaluate(expr[2], props, zoom);
  if (op === 'match') {
    const value = evaluate(expr[1], props, zoom);
    for (let i = 2; i < expr.length - 1; i += 2) if (expr[i] === value) return expr[i + 1];
    return expr[expr.length - 1];
  }
  if (op === 'case') {
    for (let i = 1; i < expr.length - 1; i += 2) {
      if (evaluate(expr[i], props, zoom)) return evaluate(expr[i + 1], props, zoom);
    }
    return evaluate(expr[expr.length - 1], props, zoom);
  }
  if (op === 'interpolate') {
    const stops = [];
    for (let i = 3; i < expr.length; i += 2) stops.push([expr[i], expr[i + 1]]);
    const x = evaluate(expr[2], props, zoom);
    if (x <= stops[0][0]) return evaluate(stops[0][1], props, zoom);
    const last = stops[stops.length - 1];
    if (x >= last[0]) return evaluate(last[1], props, zoom);
    for (let i = 0; i < stops.length - 1; i += 1) {
      const [x0, y0] = stops[i];
      const [x1, y1] = stops[i + 1];
      if (x >= x0 && x <= x1) {
        const a = evaluate(y0, props, zoom);
        const b = evaluate(y1, props, zoom);
        return a + ((b - a) * (x - x0)) / (x1 - x0);
      }
    }
  }
  throw new Error('تعبير غير مدعوم في المُقيّم: ' + op);
}

ok('النمط: مصدر المعالم موجود ويبدأ فارغاً', () => {
  const style = styleOf();
  assert.strictEqual(style.sources.poi.type, 'geojson');
  assert.deepStrictEqual(style.sources.poi.data, EMPTY);
  // بلا تجميع: هذه وجهاتٌ تُقرأ بالاسم لا حوادثُ يُعدّ تكرارها.
  assert.ok(!('cluster' in style.sources.poi), 'مصدر المعالم لا يُجمَّع');
});

ok('النمط: المعالم المُمرَّرة تصل إلى المصدر', () => {
  const data = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: null }] };
  assert.strictEqual(styleOf({ poi: data }).sources.poi.data, data);
});

ok('النمط: نقاط المعالم تسبق أول طبقة symbol — فتقع الأعمال فوقها', () => {
  const style = styleOf();
  const dots = layerIndex(style, 'poi-dots');
  const firstSymbol = style.layers.findIndex((layer) => layer.type === 'symbol');
  assert.ok(dots !== -1, 'طبقة النقاط مفقودة');
  assert.ok(dots < firstSymbol,
    'نقاط المعالم بعد أول symbol — طبقات الأعمال ستقع تحتها');
});

ok('النمط: نقاط المعالم فوق الإسفلت لا تحته', () => {
  const style = styleOf();
  assert.ok(layerIndex(style, 'poi-dots') > layerIndex(style, 'roads'),
    'النقاط تحت طبقة الطرق فتُغطّى بها');
});

ok('النمط: أسماء المعالم آخر طبقة — تأخذ ما فضل من المواضع', () => {
  const style = styleOf();
  assert.strictEqual(style.layers[style.layers.length - 1].id, 'poi-labels');
});

ok('النمط: الأكثر تقييماً يفوز بالموضع المتنازع عليه', () => {
  const style = styleOf();
  const labels = style.layers[layerIndex(style, 'poi-labels')];
  const key = labels.layout['symbol-sort-key'];
  const big = evaluate(key, { rev: 37000 }, 14);
  const small = evaluate(key, { rev: 520 }, 14);
  // المفتاح يُرتَّب تصاعدياً والأصغر يُوضَع أولاً.
  assert.ok(big < small, 'الأكثر تقييماً لا يسبق الأقل');
});

ok('النمط: لكل مجموعة لونها، وللمجهول احتياطي', () => {
  const expr = Style.poiColor();
  const seen = new Set();
  Style.POI_KINDS.forEach((kind) => {
    const color = evaluate(expr, { kind }, 14);
    assert.strictEqual(color, Style.POI_COLORS[kind], `لون ${kind} لا يطابق الجدول`);
    assert.ok(!seen.has(color), `لون مكرّر بين مجموعتين: ${color}`);
    seen.add(color);
  });
  assert.strictEqual(evaluate(expr, { kind: 'لا-شيء' }, 14), Style.POI_COLORS.other);
});

ok('النمط: منظر المدينة يُظهر الرتبة الأولى وحدها', () => {
  const style = styleOf();
  const opacity = style.layers[layerIndex(style, 'poi-dots')].paint['circle-opacity'];
  assert.strictEqual(evaluate(opacity, { t: 1 }, 11.6), 1, 'الرتبة الأولى غائبة عند منظر المدينة');
  assert.strictEqual(evaluate(opacity, { t: 2 }, 11.6), 0, 'الرتبة الثانية ظاهرة مبكراً');
  assert.strictEqual(evaluate(opacity, { t: 3 }, 11.6), 0, 'الرتبة الثالثة ظاهرة مبكراً');
});

ok('النمط: الرتب تنضم بالترتيب حتى تكتمل عند منظر الشارع', () => {
  const style = styleOf();
  const opacity = style.layers[layerIndex(style, 'poi-dots')].paint['circle-opacity'];
  assert.strictEqual(evaluate(opacity, { t: 2 }, 13.2), 1, 'الرتبة الثانية غائبة عند الحيّ');
  assert.strictEqual(evaluate(opacity, { t: 3 }, 13.2), 0, 'الرتبة الثالثة سبقت موعدها');
  [1, 2, 3].forEach((t) => {
    assert.strictEqual(evaluate(opacity, { t }, 14.4), 1, `الرتبة ${t} غائبة عند منظر الشارع`);
  });
});

ok('النمط: الظهور تدرّجٌ لا قفز', () => {
  const style = styleOf();
  const opacity = style.layers[layerIndex(style, 'poi-dots')].paint['circle-opacity'];
  const mid = evaluate(opacity, { t: 2 }, 12.4);
  assert.ok(mid > 0 && mid < 1, `الرتبة الثانية تقفز بدل أن تتدرّج (${mid})`);
});

ok('النمط: النقطة الأبرز أكبر من الأخفت عند كل تقريب', () => {
  const style = styleOf();
  const radius = style.layers[layerIndex(style, 'poi-dots')].paint['circle-radius'];
  [11, 14, 17].forEach((z) => {
    assert.ok(evaluate(radius, { t: 1 }, z) > evaluate(radius, { t: 3 }, z),
      `الرتبة الأولى ليست أكبر عند z${z}`);
  });
});

ok('النمط: طبقتا المعالم بلا أيقونة — لا اعتماد على الـ sprite', () => {
  /**
   * الطقم الحالي يحمل ستّ أيقونات `poi-*` صُمّمت لأعمال الطرق لا لوجهات
   * المدينة. الإشارة إلى اسمٍ غير موجود في الـ atlas تُسقط الرمز صامتاً،
   * فتُرسم التسمية بلا شارتها. الدائرة تستغني عن الـ atlas أصلاً.
   */
  const style = styleOf();
  const labels = style.layers[layerIndex(style, 'poi-labels')];
  assert.ok(!('icon-image' in labels.layout), 'طبقة الأسماء تطلب أيقونة غير مضمونة');
  assert.strictEqual(style.layers[layerIndex(style, 'poi-dots')].type, 'circle');
});

ok('النمط: طبقة المعالم لا تكسر قاعدة صفر الطلبات الخارجية', () => {
  const raw = JSON.stringify(styleOf({ poi: EMPTY }));
  assert.ok(!/https?:\/\//.test(raw), 'رابط خارجي داخل النمط');
});

console.log(`\n${passed} فحصاً`);
