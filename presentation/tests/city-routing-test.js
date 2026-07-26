'use strict';
/**
 * المسارات البديلة على شبكة الرياض كاملة.
 * ---------------------------------------------------------------------------
 * ما يُختبر: أن الرسم قابل للتوجيه فعلاً (لا مجموعةَ كسرات)، وأن الالتفاف
 * التفافٌ حقيقي حول المغلق لا مسارٌ يساوي الأصل، وأن الفشل يُسمّى ولا يُبتلع.
 *
 * وأربعة حرّاس أُضيفت حين صار الرسم يشمل شوارع الأحياء، لأن كلاً منها كان
 * خطأً وقع فعلاً وكلفته أن الزمن المعروض غير قابل للتصديق:
 *
 *   - **الاتجاه.** 8,539 من 9,277 مقطعاً شريانياً في الرياض باتجاه واحد
 *     (الازدواجية مرسومة مسارين منفصلين). موجّهٌ يتجاهلها يسير عكس السير
 *     ويخرج بزمنٍ أقصر من أي زمن ممكن.
 *   - **الانعطاف.** بلا عقوبته يخترق المسار الأحياء مجاناً.
 *   - **اليسار أغلى من اليمين.** السعودية تسير يميناً؛ عكسُها يقلب التفضيل.
 *   - **الإشارة.** تأخير التقاطع لا يُستنتج من الهندسة.
 *
 * والرقم الحارس الأقدم يبقى: «الإغلاق واقعٌ على المسار الأساس». أول صياغة
 * أسندت طرفَي خط العمل إلى أقرب عقدتين فوقع الإسناد على شارع موازٍ، وخرج
 * «بديل» يساوي الأصل في 46 من 73 حالة.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

function loadGlobal(file, name) {
  const previous = global.window;
  global.window = {};
  require(path.join(DATA, file));
  const value = global.window[name];
  global.window = previous;
  return value;
}

const Routing = require(path.join(ROOT, 'athar-city-routing.js'));
const Solution = require(path.join(ROOT, 'athar-worksmap-solution.js'));
const graph = loadGlobal('riyadh-route-graph.js', 'RIYADH_ROUTE_GRAPH');
const portfolio = JSON.parse(fs.readFileSync(path.join(DATA, 'city-portfolio.geojson'), 'utf8'));

const prepared = Routing.prepare(graph);
const lines = portfolio.features.filter((f) => f.geometry.type === 'LineString');

/* ---- الرسم ---- */

ok('الرسم مبنيّ من الشبكة الحقيقية الخام لا من طبقة عرض مبسَّطة', () => {
  assert.ok(graph.edges.length > 15000, `${graph.edges.length} ضلعاً فقط`);
  assert.ok(graph.nodes.length > 10000, `${graph.nodes.length} عقدة فقط`);
  // الخام لا المُنحَّف: التبسيط يزيح الأطراف فتنفصل التقاطعات.
  graph.metadata.builtFrom.forEach((file) => {
    assert.ok(!/\.geojson\.js$/.test(file), `مصدر مُنحَّف: ${file}`);
  });
});

ok('كل ضلع يحمل هندسته فلا يتعلّق بملف عرضٍ قد يُبسَّط بعده', () => {
  for (let i = 0; i < graph.edges.length; i += 97) {
    const edge = graph.edges[i];
    assert.ok(Array.isArray(edge[10]), `ضلع ${i} بلا مصفوفة رؤوس`);
    edge[10].forEach((point) => {
      assert.strictEqual(point.length, 2, 'رأس ليس زوج إحداثيات');
      assert.ok(point[0] > 46 && point[0] < 47.5, `خط طول خارج الرياض: ${point[0]}`);
      assert.ok(point[1] > 24 && point[1] < 25.5, `خط عرض خارج الرياض: ${point[1]}`);
    });
  }
});

ok('المكوّن الرئيس مترابط ترابطاً قوياً ومُعلَّم في الملف', () => {
  const main = graph.inMain.reduce((sum, flag) => sum + flag, 0);
  assert.strictEqual(main, graph.metadata.largestComponent);
  const share = (100 * main) / graph.nodes.length;
  // الضعيف لا يكفي مع الاتجاه الواحد: عقدةٌ تُبلَغ ولا يُرجَع منها تعطي «لا مسار».
  assert.ok(share > 85, `المكوّن الرئيس ${share.toFixed(1)}٪ فقط`);
});

ok('الاتجاه الواحد محفوظ في الرسم — الازدواجية مساران لا مسار', () => {
  const oneway = graph.edges.filter((e) => e[5] !== 0).length;
  const share = (100 * oneway) / graph.edges.length;
  assert.ok(share > 20, `${share.toFixed(0)}٪ فقط باتجاه واحد — الوسم ضائع`);
  graph.edges.forEach((edge, i) => {
    assert.ok(edge[5] === 0 || edge[5] === 1 || edge[5] === -1,
      `اتجاه غير صالح في الضلع ${i}: ${edge[5]}`);
  });
});

ok('العقد ملحومة: لا عقدتان أقرب من متر', () => {
  const tolerance = graph.metadata.weldToleranceM;
  // ٢٥ متراً على شبكةٍ سكنية تلحم شارعين متوازيين في واحد، فيقفز المسار
  // خلال مربعٍ سكني قفزاً لا وجود له. التفاوت يجب أن يبقى دون نصف المربع.
  assert.ok(tolerance <= 10, `تفاوت اللحام ${tolerance} متراً — يلحم شوارع متوازية`);
  const cell = tolerance / (111320 * Math.cos((24.71 * Math.PI) / 180));
  const buckets = new Map();
  graph.nodes.forEach((node, index) => {
    const key = Math.floor(node[0] / cell) + ':' + Math.floor(node[1] / cell);
    const list = buckets.get(key) || [];
    list.push(index);
    buckets.set(key, list);
  });
  buckets.forEach((list) => {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const gap = Routing.metresBetween(graph.nodes[list[i]], graph.nodes[list[j]]);
        assert.ok(gap >= 1, `عقدتان متطابقتان: ${list[i]} و${list[j]}`);
      }
    }
  });
});

/* ---- الأوزان ---- */

ok('زمن الضلع يرتفع في الذروة عنه في الفجر', () => {
  const edge = graph.edges.find((e) => e[6] <= 6 && e[2] > 300);
  assert.ok(Routing.edgeMinutes(prepared, edge, 8) > Routing.edgeMinutes(prepared, edge, 3),
    'الذروة لا تكلّف أكثر من الفجر — BPR معطّل');
});

ok('الشارع السكني أبطأ من الشريان لكل متر', () => {
  const classes = graph.metadata.classes;
  const arterial = classes.find((c) => c.name === 'primary');
  const residential = classes.find((c) => c.name === 'residential');
  assert.ok(residential.kmh < arterial.kmh, 'السكني ليس أبطأ');
  // المطبّات والسيارات المتوقّفة وأولويةٌ غير محكومة: سعته جزءٌ من سعة الشريان.
  assert.ok(residential.capacity < arterial.capacity / 2, 'سعة السكني ليست أقل بوضوح');
});

ok('اليسار يكلّف أضعاف اليمين — السعودية تسير يميناً', () => {
  const turn = graph.metadata.turn;
  assert.ok(turn.leftSec > turn.rightSec * 2, 'اليسار لا يقطع الحركة المقابلة');
  assert.ok(turn.uTurnSec > turn.leftSec, 'الدوران الكامل ليس الأغلى');
  assert.strictEqual(turn.straightDeg > 0 && turn.straightDeg < 45, true);
});

ok('فرق الاتجاه يُطوى إلى نصف دورة بإشارة صحيحة', () => {
  assert.strictEqual(Routing.angleDelta(90, 0), 90);
  assert.strictEqual(Routing.angleDelta(0, 90), -90);
  assert.strictEqual(Routing.angleDelta(10, 350), 20);
  assert.strictEqual(Routing.angleDelta(350, 10), -20);
});

ok('الإشارة الضوئية أغلى من علامة القف، والخالي مجاني', () => {
  const seconds = graph.metadata.controlSeconds;
  assert.strictEqual(seconds[0], 0);
  assert.ok(seconds[2] > seconds[1], 'الإشارة ليست أغلى من القف');
  assert.ok(seconds[2] >= 15 && seconds[2] <= 40, `تأخير الإشارة ${seconds[2]} ثانية`);
});

ok('الكومة تُخرج الأصغر أولاً مهما كان ترتيب الإدخال', () => {
  const heap = new Routing.Heap();
  const input = [7, 2, 9, 1, 5, 5, 3, 8, 0, 4];
  input.forEach((value) => heap.push(value, value));
  const out = [];
  while (heap.size()) out.push(heap.pop());
  assert.deepStrictEqual(out, input.slice().sort((a, b) => a - b));
});

/* ---- التوجيه ---- */

ok('الإسناد يقع داخل المكوّن الرئيس دائماً', () => {
  for (let i = 0; i < lines.length; i += 11) {
    const node = Routing.nearestNode(prepared, lines[i].geometry.coordinates[0]);
    if (node === -1) continue;
    assert.strictEqual(graph.inMain[node], 1, `إسناد إلى عقدة خارج الرئيس: ${node}`);
  }
});

ok('المسار متصل ويسير مع اتجاه كل ضلع لا عكسه', () => {
  const from = Routing.nearestNode(prepared, lines[0].geometry.coordinates[0]);
  const to = Routing.nearestNode(prepared, lines[3].geometry.coordinates[0]);
  const route = Routing.shortestPath(prepared, from, to, { hour: 8 });
  assert.ok(route, 'لا مسار بين سجلين في الرئيس');
  let at = from;
  route.states.forEach((state) => {
    const edge = graph.edges[state >> 1];
    const forward = (state & 1) === 0;
    assert.strictEqual(forward ? edge[0] : edge[1], at, 'انقطاع في سلسلة الأضلاع');
    // الاتجاه الواحد: 1 يعني a→b فقط، و-1 يعني b→a فقط.
    if (edge[5] === 1) assert.ok(forward, 'عبور عكس اتجاه واحد');
    if (edge[5] === -1) assert.ok(!forward, 'عبور عكس اتجاه واحد');
    at = forward ? edge[1] : edge[0];
  });
  assert.strictEqual(at, to, 'المسار لا ينتهي عند الوجهة');
});

ok('زمن المسار مجموع القيادة والانعطاف والتقاطعات', () => {
  const from = Routing.nearestNode(prepared, lines[0].geometry.coordinates[0]);
  const to = Routing.nearestNode(prepared, lines[5].geometry.coordinates[0]);
  const route = Routing.shortestPath(prepared, from, to, { hour: 8 });
  assert.ok(route, 'لا مسار');
  const sum = route.driveMinutes + route.turnMinutes + route.controlMinutes;
  assert.ok(Math.abs(route.minutes - sum) < 1e-9, 'الزمن لا يساوي مكوّناته');
  assert.ok(route.turnMinutes >= 0 && route.controlMinutes >= 0, 'مكوّن سالب');
});

ok('الانعطاف يكلّف فعلاً في مسارٍ حقيقي لا في الجدول وحده', () => {
  // الحارس: جدولٌ فيه أرقام لا يعني أن البحث يقرأها.
  let withTurns = 0;
  for (let i = 0; i + 7 < lines.length && withTurns < 3; i += 7) {
    const from = Routing.nearestNode(prepared, lines[i].geometry.coordinates[0]);
    const to = Routing.nearestNode(prepared, lines[i + 7].geometry.coordinates[0]);
    if (from === -1 || to === -1 || from === to) continue;
    const route = Routing.shortestPath(prepared, from, to, { hour: 8 });
    if (route && route.turnMinutes > 0) withTurns += 1;
  }
  assert.ok(withTurns >= 1, 'لا مسار يحمل كلفة انعطاف — العقوبة غير مقروءة');
});

/* ---- الالتفاف ---- */

const results = lines.map((f) => ({
  record: f.properties,
  result: Routing.alternativesAround(prepared, f.geometry.coordinates, { hour: 8, count: 2 }),
}));
const solved = results.filter((row) => row.result.ok);

ok('أغلب السجلات الخطية تعطي بديلاً محسوباً', () => {
  const share = (100 * solved.length) / lines.length;
  assert.ok(share > 50, `${solved.length} من ${lines.length} (${share.toFixed(0)}٪) فقط`);
});

ok('الإغلاق واقعٌ على المسار الأساس — البديل التفافٌ حقيقي', () => {
  const onPath = solved.filter((row) =>
    row.result.baseline.edges.some((id) => row.result.banned[id]));
  const share = (100 * onPath.length) / solved.length;
  assert.ok(share > 75, `الإغلاق على الأساس في ${share.toFixed(0)}٪ فقط من الحالات`);
});

ok('البديل لا يكون أسرع من المرور عبر المغلق', () => {
  solved.forEach((row) => {
    row.result.alternatives.forEach((route) => {
      assert.ok(route.minutes >= row.result.baseline.minutes - 1e-9,
        `${row.record.permitRef}: بديل أسرع من الأصل`);
    });
  });
});

/**
 * الترتيب صار بالتوصية لا بالزمن وحده.
 * الأوّل هو الموصى به: إمّا الأسرع، وإمّا أقصرُ منه بفارقٍ يُقرأ مقابل تأخّرٍ
 * داخل حدّ التسامح المعلن. وما بعده مرتّبٌ بالزمن. وأي انقلابٍ خارج هذا الشرط
 * يعني أن السياسة انفلتت من حدودها.
 */
ok('الموصى به أوّلاً ضمن حدّ التسامح، وما بعده بالزمن، ولا تكرار', () => {
  solved.forEach((row) => {
    const routes = row.result.alternatives;
    const quickest = routes.reduce((min, one) => (one.minutes < min.minutes ? one : min), routes[0]);
    const tolerance = Math.max(Routing.TOLERANCE_MIN, quickest.minutes * Routing.TOLERANCE_PCT);
    assert.ok(routes[0].minutes <= quickest.minutes + tolerance + 1e-9,
      `${row.record.permitRef}: الموصى به أبطأ من حدّ التسامح`);
    if (routes[0] !== quickest) {
      assert.ok(routes[0].lengthM < quickest.lengthM,
        `${row.record.permitRef}: الموصى به أبطأ ولا أقصر — بلا مبرّر`);
    }
    for (let i = 2; i < routes.length; i += 1) {
      assert.ok(routes[i].minutes >= routes[i - 1].minutes,
        `${row.record.permitRef}: بديل أفضل بعد أسوأ`);
    }
    for (let i = 1; i < routes.length; i += 1) {
      assert.notDeepStrictEqual(routes[i].edges, routes[i - 1].edges,
        `${row.record.permitRef}: بديلان متطابقان`);
    }
  });
});

ok('البديل يتجنّب كل ضلع مغلق', () => {
  solved.forEach((row) => {
    row.result.alternatives.forEach((route) => {
      route.edges.forEach((id) => {
        assert.ok(!row.result.banned[id],
          `${row.record.permitRef}: البديل يمرّ في مقطع مغلق`);
      });
    });
  });
});

ok('الفشل يُسمّى بسببٍ معروف لا يُبتلع', () => {
  const failed = results.filter((row) => !row.result.ok);
  failed.forEach((row) => {
    assert.ok(Solution.DETOUR_REASONS[row.result.reason],
      `سبب غير معروف: ${row.result.reason}`);
  });
});

/* ---- الهندسة والعرض ---- */

ok('هندسة المسار متصلة ولا تقفز', () => {
  const row = solved[0];
  const coordinates = Routing.pathGeometry(prepared, row.result.alternatives[0].states);
  assert.ok(coordinates.length > 2, 'هندسة بلا نقاط');
  for (let i = 1; i < coordinates.length; i += 1) {
    const gap = Routing.metresBetween(coordinates[i - 1], coordinates[i]);
    assert.ok(gap < 2000, `قفزة ${Math.round(gap)} متراً في هندسة المسار`);
  }
});

ok('الهندسة تتبع اتجاه السير لا اتجاه رسم الطريق', () => {
  const row = solved[0];
  const states = row.result.alternatives[0].states;
  const coordinates = Routing.pathGeometry(prepared, states);
  const first = graph.nodes[Routing.tailOf(graph, states[0])];
  const last = graph.nodes[Routing.headOf(graph, states[states.length - 1])];
  assert.ok(Routing.metresBetween(coordinates[0], first) < 1, 'البداية ليست ذيل أول ضلع');
  assert.ok(Routing.metresBetween(coordinates[coordinates.length - 1], last) < 1,
    'النهاية ليست رأس آخر ضلع');
});

ok('مجموعة الرسم تحمل المغلق والبدائل بترتيبها', () => {
  const row = solved.find((entry) =>
    entry.result.baseline.edges.some((id) => entry.result.banned[id]));
  const collection = Solution.routeCollection(row.result, (states) =>
    Routing.pathGeometry(prepared, states));
  const kinds = collection.features.map((f) => f.properties.kind);
  assert.ok(kinds.indexOf('closed') !== -1, 'المغلق غير مرسوم');
  assert.ok(kinds.indexOf('first') !== -1, 'البديل الأول غير مرسوم');
  assert.strictEqual(kinds.filter((k) => k === 'end').length, 2, 'طرفا التحويلة غير معلَّمين');
  collection.features.forEach((f) => {
    if (f.properties.kind === 'end' || f.properties.kind === 'tag') {
      assert.strictEqual(f.geometry.type, 'Point');
      assert.strictEqual(f.geometry.coordinates.length, 2);
      return;
    }
    assert.strictEqual(f.geometry.type, 'LineString');
    assert.ok(f.geometry.coordinates.length >= 2);
  });

  // الطرفان على المسار الموصى به نفسه — لا على عقدتين تُقرآن من الرسم فتنزلقان.
  const first = collection.features.find((f) => f.properties.kind === 'first');
  const ends = collection.features.filter((f) => f.properties.kind === 'end');
  assert.deepStrictEqual(ends[0].geometry.coordinates, first.geometry.coordinates[0]);
  assert.deepStrictEqual(ends[1].geometry.coordinates,
    first.geometry.coordinates[first.geometry.coordinates.length - 1]);
});

ok('الكتلة تعرض الدقائق المضافة لا نسبتها', () => {
  // مقطعٌ يُقطع في دقيقة والالتفاف ثلاث: «+200٪» تُقرأ كارثةً و«+٢ د» قراراً.
  // المنع على *نسبة الزمن* لا على كل علامة مئوية: حصة الشوارع الفرعية نسبةٌ
  // تصف المسار ولا تضخّم شيئاً، وحذفُها يخفي ما يريد القارئ معرفته.
  const html = Solution.detourHtml(solved[0].result);
  assert.ok(html.indexOf('المسار البديل') !== -1);
  assert.ok(/\+\d/.test(html), 'لا دقائق مضافة');
  assert.ok(!/\+\s*\d+(\.\d+)?\s*٪/.test(html), 'الزمن المضاف معروض نسبةً');
});

ok('الكتلة تعرض مقاييس محسوبة: حصة الفرعية والانعطافات والإشارات', () => {
  const html = Solution.detourHtml(solved[0].result);
  assert.ok(html.indexOf('شوارع فرعية') !== -1, 'لا حصة للشوارع الفرعية');
  assert.ok(html.indexOf('انعطافاً') !== -1, 'لا عدد انعطافات');
  assert.ok(html.indexOf('إشارة') !== -1, 'لا عدد إشارات');
});

ok('ما لا يُحسب يُقال إنه لم يُحسب — لا رقم يملأ الجدول', () => {
  const bare = {
    ok: true, hour: 8, closedEdges: 3,
    baseline: { minutes: 4 },
    alternatives: [{ lengthM: 1200, addedMinutes: 2, reasons: [] }],
  };
  const html = Solution.detourHtml(bare);
  assert.ok(html.indexOf('غير محسوب') !== -1, `الفراغ مُلئ برقم: ${html}`);
});

ok('حالة «لا التفاف» تُعرض خبراً لا فراغاً', () => {
  const html = Solution.detourHtml({ ok: false, reason: 'no-detour' });
  assert.ok(html.indexOf('لا التفاف') !== -1, `الكتلة: ${html}`);
});

ok('الأداء يحتمل الحساب عند فتح البطاقة', () => {
  const started = Date.now();
  for (let i = 0; i < 10; i += 1) {
    Routing.alternativesAround(prepared, lines[i].geometry.coordinates, { hour: 8, count: 2 });
  }
  const each = (Date.now() - started) / 10;
  // A\* بكومة ثنائية: الحدّ يبقى كما كان رغم تضاعف الشبكة عشر مرات.
  assert.ok(each < 250, `${each.toFixed(0)} مللي لكل سجل — يُحسّ عند الفتح`);
});

/* ---- الشوارع الفرعية داخل المحرك لا على الخريطة وحدها ---- */

ok('تصنيفات الشوارع الفرعية موجودة في الرسم بأضلاعٍ صالحة للسير', () => {
  const classes = graph.metadata.classes;
  ['residential', 'unclassified', 'living_street'].forEach((name) => {
    const at = classes.findIndex((c) => c.name === name);
    assert.ok(at !== -1, `تصنيف مفقود من الرسم: ${name}`);
    const count = graph.edges.filter((e) => e[6] === at).length;
    assert.ok(count > 0, `لا ضلع من نوع ${name}`);
  });
  const minorAt = classes.findIndex((c) => c.name === 'residential');
  const minorEdges = graph.edges.filter((e) => e[6] === minorAt).length;
  // الأغلبية الساحقة سكنية — لو كانت أقلية لكان الرسم شرايينَ بزينة.
  assert.ok(minorEdges > graph.edges.length * 0.4,
    `${minorEdges} ضلعاً سكنياً من ${graph.edges.length} — الشبكة ما زالت شرايين`);
});

ok('الشوارع الفرعية موصولة فعلاً: عقدها داخل المكوّن الرئيس', () => {
  const minorAt = graph.metadata.classes.findIndex((c) => c.name === 'residential');
  let inMain = 0;
  let total = 0;
  for (let i = 0; i < graph.edges.length; i += 37) {
    if (graph.edges[i][6] !== minorAt) continue;
    total += 1;
    if (graph.inMain[graph.edges[i][0]] && graph.inMain[graph.edges[i][1]]) inMain += 1;
  }
  // شارعٌ مرسوم غير موصول زينةٌ لا شبكة — الاختبار يمنع عودة ذلك صامتاً.
  assert.ok(inMain / total > 0.8,
    `${((100 * inMain) / total).toFixed(0)}٪ فقط من الشوارع السكنية موصولة`);
});

ok('الإسناد يقع على أقرب مقطع صالح ولو كان شارعاً فرعياً', () => {
  // نقطةٌ داخل حيّ يجب أن تُسنَد إلى شارع الحيّ لا أن تقفز إلى شريان بعيد.
  const minorAt = graph.metadata.classes.findIndex((c) => c.name === 'residential');
  const sample = graph.edges.find((e) =>
    e[6] === minorAt && graph.inMain[e[0]] && graph.inMain[e[1]] && e[2] > 60);
  const a = graph.nodes[sample[0]];
  const b = graph.nodes[sample[1]];
  const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const node = Routing.nearestNode(prepared, middle);
  assert.notStrictEqual(node, -1, 'نقطة داخل حيّ بلا إسناد');
  const gap = Routing.metresBetween(middle, graph.nodes[node]);
  assert.ok(gap < 120, `الإسناد قفز ${Math.round(gap)} متراً — غالباً إلى شريان`);
});

ok('رحلة داخل حيّ تُحسب على الشارع الفعلي لا خطاً مستقيماً', () => {
  const minorAt = graph.metadata.classes.findIndex((c) => c.name === 'residential');
  const minor = graph.edges.filter((e) =>
    e[6] === minorAt && graph.inMain[e[0]] && graph.inMain[e[1]]);
  const from = minor[40][0];
  const to = minor[900][1];
  const route = Routing.shortestPath(prepared, from, to, { hour: 8 });
  assert.ok(route, 'لا مسار بين نقطتين داخل الأحياء');
  const straight = Routing.metresBetween(graph.nodes[from], graph.nodes[to]);
  // المسار على شبكة مربّعات أطول من الوتر دائماً؛ مساواتُه له تعني خطاً مرسوماً.
  assert.ok(route.lengthM >= straight,
    `الطول ${Math.round(route.lengthM)} م دون الخط المستقيم ${Math.round(straight)} م`);
  assert.ok(route.lengthM > 0 && route.minutes > 0, 'مسار بلا طول أو زمن');
});

ok('البديل يستعمل الشوارع الفرعية حين تكون هي الحل', () => {
  const usable = solved.filter((row) =>
    row.result.alternatives.some((route) => route.minorShare > 0.15));
  const share = (100 * usable.length) / solved.length;
  assert.ok(share > 60,
    `${share.toFixed(0)}٪ فقط من الحالات لها بديل يمرّ في شوارع فرعية`);
});

ok('كل مقياس يُعرض محسوبٌ من هندسة المسار', () => {
  solved.slice(0, 20).forEach((row) => {
    row.result.alternatives.forEach((route) => {
      assert.ok(route.minorShare >= 0 && route.minorShare <= 1,
        `حصة خارج النطاق: ${route.minorShare}`);
      assert.ok(Math.abs(route.minorMetres + (route.lengthM - route.minorMetres)
        - route.lengthM) < 1e-6, 'الطول لا يساوي مجموع شطريه');
      assert.strictEqual(route.turns, route.turns | 0, 'عدد الانعطافات ليس صحيحاً');
      assert.ok(route.turns <= route.edges.length, 'انعطافات أكثر من الأضلاع');
      assert.ok(route.signals <= route.edges.length, 'إشارات أكثر من الأضلاع');
    });
  });
});

/* ---- منع الانعطاف ---- */

ok('قيود الانعطاف محلولة إلى أضلاع في الرسم', () => {
  assert.ok(Array.isArray(graph.restrictions), 'لا جدول قيود');
  assert.ok(graph.metadata.restrictionRules > 0, 'لا قيد حُلّ');
  graph.restrictions.forEach((rule) => {
    const [fromEdge, via, toEdge] = rule;
    const a = graph.edges[fromEdge];
    const b = graph.edges[toEdge];
    assert.ok(a && b, 'قيد يشير إلى ضلع غير موجود');
    assert.ok(a[0] === via || a[1] === via, 'ضلع الدخول لا يمسّ عقدة التقاطع');
    assert.ok(b[0] === via || b[1] === via, 'ضلع الخروج لا يمسّ عقدة التقاطع');
  });
});

ok('المحرك لا يسلك انتقالاً ممنوعاً', () => {
  // الحارس المباشر: قيدٌ مفروضٌ في الجدول يجب ألا يظهر في أي مسار محسوب.
  const forbidden = {};
  graph.restrictions.forEach((r) => { forbidden[r[0] + ':' + r[1] + ':' + r[2]] = 1; });
  let checked = 0;
  solved.forEach((row) => {
    row.result.alternatives.forEach((route) => {
      for (let i = 1; i < route.states.length; i += 1) {
        const junction = Routing.tailOf(graph, route.states[i]);
        const key = (route.states[i - 1] >> 1) + ':' + junction + ':' + (route.states[i] >> 1);
        assert.ok(!forbidden[key], `مسار يسلك انتقالاً ممنوعاً عند ${junction}`);
        checked += 1;
      }
    });
  });
  assert.ok(checked > 1000, `${checked} انتقالاً فقط فُحص`);
});

/* ---- الطرق المستثناة ---- */

ok('ممرات الخدمة والطرق الخاصة خارج الرسم', () => {
  const names = graph.metadata.classes.map((c) => c.name);
  ['service', 'track', 'path', 'footway', 'driveway'].forEach((name) => {
    assert.strictEqual(names.indexOf(name), -1, `تصنيف غير صالح للسيارات: ${name}`);
  });
  const hood = JSON.parse(fs.readFileSync(
    path.join(DATA, 'riyadh-roads-neighbourhood.geojson'), 'utf8'
  ));
  hood.features.forEach((f) => {
    const p = f.properties;
    assert.ok(p.access !== 'private' && p.access !== 'no',
      `طريق خاص في المصدر: ${p.osmId}`);
  });
});

/* ---- تنوّع البدائل ---- */

ok('البدائل مختلفة فعلاً لا نسخٌ بانحرافٍ في آخر أمتار', () => {
  const multi = solved.filter((row) => row.result.alternatives.length > 1);
  assert.ok(multi.length > 20, `${multi.length} حالة فقط بأكثر من بديل`);
  multi.forEach((row) => {
    const routes = row.result.alternatives;
    for (let i = 1; i < routes.length; i += 1) {
      const overlap = Routing.overlapShare(prepared, routes[i - 1], routes[i]);
      assert.ok(overlap < Routing.SAME_ROUTE_OVERLAP,
        `${row.record.permitRef}: بديلان متطابقان بنسبة ${(100 * overlap).toFixed(0)}٪`);
    }
  });
});

ok('لكل بديل سببٌ مشتقٌّ من قياسه لا عبارةٌ مكتوبة سلفاً', () => {
  let withReason = 0;
  solved.slice(0, 40).forEach((row) => {
    row.result.alternatives.forEach((route) => {
      assert.ok(Array.isArray(route.reasons), 'لا مصفوفة أسباب');
      if (route.reasons.length) withReason += 1;
      // السبب الذي يذكر حصةً يجب أن يطابق الحصة المقيسة.
      route.reasons.forEach((text) => {
        const match = text.match(/(\d+)٪ من طوله شوارع فرعية/);
        if (!match) return;
        assert.strictEqual(Number(match[1]), Math.round(100 * route.minorShare),
          `السبب يذكر حصة لا تطابق القياس: ${text}`);
      });
    });
  });
  assert.ok(withReason > 20, `${withReason} بديلاً فقط له سبب`);
});

ok('المتطابقون يُسقَطون: المرشحون أكثر من المعروضين', () => {
  const trimmed = solved.filter((row) =>
    row.result.considered > row.result.alternatives.length);
  assert.ok(trimmed.length > 0, 'لم يُسقَط أي مرشح متطابق — الغربلة معطّلة');
});

/* ---- الوصل ---- */

ok('صفحة الخريطة تحمّل التوجيه وترسم مسارات', () => {
  const page = fs.readFileSync(path.join(ROOT, 'athar-map.html'), 'utf8');
  assert.ok(page.indexOf('athar-city-routing.js') !== -1, 'الوحدة غير محمَّلة');
  assert.ok(page.indexOf('riyadh-route-graph.js') !== -1, 'الرسم غير مؤجَّل التحميل');
  assert.ok(page.indexOf('buildRouteLayers') !== -1, 'لا طبقات مسارات');
  assert.ok(page.indexOf('decorate') !== -1, 'البطاقة لا تتلقى كتلة البديل');
  assert.ok(page.indexOf('indexWays') === -1, 'ما زالت تربط الهندسة بطبقة العرض');
});

ok('الرسم محلي ولا يذكر مصدراً خارجياً', () => {
  const script = fs.readFileSync(path.join(ROOT, 'scripts', 'build-route-graph.js'), 'utf8');
  assert.ok(script.indexOf('fetch(') === -1, 'البناء يطلب من الشبكة');
  assert.ok(/ODbL/.test(graph.metadata.source), 'الرخصة غير مذكورة في الرسم');
});

console.log(`\n${passed} اختبارات نجحت`);
