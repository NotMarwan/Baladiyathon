'use strict';
/**
 * نسيج المباني: أدوات التوليد النقية، ثم الحمولة المولَّدة نفسها.
 * ---------------------------------------------------------------------------
 * ما يُختبر هنا ليس «هل الشكل جميل» بل الالتزامات التي تجعل المولَّد أميناً:
 * أنه لا يمسّ حقيقياً، ولا يقع في ماء أو حديقة، ولا يخرج عن النطاق، وأنه موسوم
 * فيبقى فرزه ممكناً — وأن التغطية فعلاً سدّت الفجوات التي وُلّد من أجلها.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const F = require('../scripts/lib/fabric.js');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const BBOX = { south: 24.545, west: 46.530, north: 24.880, east: 46.855 };

function loadGlobal(file, name) {
  const previous = global.window;
  global.window = {};
  require(path.join(DATA, file));
  const value = global.window[name];
  global.window = previous;
  return value;
}

/* ---- الأدوات النقية ---- */

ok('البذرة الواحدة تعطي التسلسل نفسه، والبذرتان تختلفان', () => {
  const first = F.mulberry32(7);
  const again = F.mulberry32(7);
  const other = F.mulberry32(8);
  const a = [first(), first(), first()];
  assert.deepStrictEqual(a, [again(), again(), again()]);
  assert.notDeepStrictEqual(a, [other(), other(), other()]);
});

ok('كل قيمة عشوائية داخل [0،1)', () => {
  const random = F.mulberry32(99);
  for (let i = 0; i < 2000; i += 1) {
    const value = random();
    assert.ok(value >= 0 && value < 1, `قيمة خارج المدى: ${value}`);
  }
});

ok('الإسقاط يعود إلى نقطته — الخطأ دون السنتيمتر', () => {
  const project = F.projection({ lon: BBOX.west, lat: BBOX.south });
  const metres = project.toMetres(46.7123, 24.7891);
  const back = project.toLonLat(metres[0], metres[1]);
  assert.ok(Math.abs(back[0] - 46.7123) < 1e-9, 'انزياح في خط الطول');
  assert.ok(Math.abs(back[1] - 24.7891) < 1e-9, 'انزياح في خط العرض');
});

ok('المستطيل حلقة مغلقة بخمس نقاط، ومساحته حاصل ضلعيه', () => {
  const ring = F.rectangle(100, 200, 20, 30, 0);
  assert.strictEqual(ring.length, 5);
  assert.deepStrictEqual(ring[0], ring[4], 'الحلقة غير مغلقة');
  assert.ok(Math.abs(F.ringAreaMetres(ring) - 600) < 1e-6);
});

ok('الدوران يحفظ المساحة ويغيّر الأركان', () => {
  const flat = F.rectangle(0, 0, 20, 30, 0);
  const turned = F.rectangle(0, 0, 20, 30, Math.PI / 5);
  assert.ok(Math.abs(F.ringAreaMetres(flat) - F.ringAreaMetres(turned)) < 1e-6);
  assert.notDeepStrictEqual(flat[0], turned[0]);
});

ok('شريحة المساحة تصعد مع المساحة ولا تتجاوز الثلاثة', () => {
  assert.strictEqual(F.areaBucket(120), 0);
  assert.strictEqual(F.areaBucket(600), 1);
  assert.strictEqual(F.areaBucket(2000), 2);
  assert.strictEqual(F.areaBucket(90000), 3);
});

ok('القرص يختم داخل نصف قطره ولا يتعدّاه', () => {
  const grid = F.makeGrid(400, 400, 10);
  F.stampDisc(grid, 200, 200, 50, 1);
  assert.strictEqual(grid.get(200, 200), 1, 'المركز فارغ');
  assert.strictEqual(grid.get(235, 200), 1, 'داخل القطر فارغ');
  assert.strictEqual(grid.get(300, 200), 0, 'خارج القطر مختوم');
});

ok('ملء المضلع يصيب داخله دون خارجه', () => {
  const grid = F.makeGrid(400, 400, 10);
  F.fillRing(grid, [[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]], 1);
  assert.strictEqual(grid.get(200, 200), 1, 'الداخل فارغ');
  assert.strictEqual(grid.get(350, 200), 0, 'الخارج ممتلئ');
  assert.strictEqual(grid.get(200, 50), 0, 'ما تحت المضلع ممتلئ');
});

/* ---- الحمولة المولَّدة ---- */

const buildings = loadGlobal('riyadh-buildings.geojson.js', 'RIYADH_BUILDINGS');
const real = buildings.features.filter((f) => !f.properties.f);
const made = buildings.features.filter((f) => f.properties.f === 1);

ok('كل مضلع إما حقيقي أو موسوم — لا ثالث', () => {
  assert.strictEqual(real.length + made.length, buildings.features.length);
  made.forEach((f) => assert.strictEqual(f.properties.f, 1));
});

ok('الحقيقي من OSM باقٍ بعدده ولا يحمل وسم التوليد', () => {
  // ٨٥٬٧٣٨ هو كل ما عند OSM في النطاق (out count = 86,056 قبل حدّ المساحة).
  assert.strictEqual(real.length, 85738, `الحقيقي ${real.length} لا 85738`);
});

ok('المولَّد يفوق الحقيقي — وإلا فالفجوات لم تُسدّ', () => {
  assert.ok(made.length > real.length * 2, `مولَّد ${made.length} أمام حقيقي ${real.length}`);
});

ok('كل مضلع مولَّد مستطيل مغلق بمساحة مبنى معقولة', () => {
  const project = F.projection({ lon: BBOX.west, lat: BBOX.south });
  for (let i = 0; i < made.length; i += 997) {
    const ring = made[i].geometry.coordinates[0];
    assert.strictEqual(ring.length, 5, 'حلقة ليست مستطيلاً');
    assert.deepStrictEqual(ring[0], ring[4], 'حلقة غير مغلقة');
    const area = F.ringAreaMetres(ring.map((p) => project.toMetres(p[0], p[1])));
    assert.ok(area > 80 && area < 9000, `مساحة غير معقولة: ${Math.round(area)} م²`);
  }
});

ok('شرائح المساحة الأربع كلها ممثَّلة — التدرّج اللوني حيّ في المولَّد', () => {
  const counts = [0, 0, 0, 0];
  made.forEach((f) => { counts[f.properties.a] += 1; });
  counts.forEach((count, bucket) => assert.ok(count > 0, `شريحة ${bucket} خالية`));
});

ok('لا مضلع خارج نطاق العرض إلا بعرض مبنى', () => {
  // القسيمة تُختار بمركزها داخل النطاق، فقد يتجاوز ركنها الحدَّ بأمتار — كما
  // يتجاوزه مبنى حقيقي على الحافة. الهامش عرض مبنى لا أكثر.
  const MARGIN = 0.0006;
  for (let i = 0; i < made.length; i += 313) {
    made[i].geometry.coordinates[0].forEach((p) => {
      assert.ok(p[0] >= BBOX.west - MARGIN && p[0] <= BBOX.east + MARGIN, `خط طول خارج النطاق: ${p[0]}`);
      assert.ok(p[1] >= BBOX.south - MARGIN && p[1] <= BBOX.north + MARGIN, `خط عرض خارج النطاق: ${p[1]}`);
    });
  }
});

ok('لا مولَّد داخل ماء ولا حديقة — إلا ملامسةَ حافة دون خلية الاستثناء', () => {
  // القناع نقطي بخلية اثني عشر متراً، فركنٌ يغرز مترين داخل حافة حديقة لا
  // يلحظه أي قناع منتهٍ. الالتزام أن لا يقع مبنى *داخل* الحديقة، لا أن تُرسم
  // الحافة بدقة لا نهائية — فالحدّ هو خلية الاستثناء نفسها.
  const TOLERANCE_M = 12;
  const M_PER_LON = 101121;
  const base = loadGlobal('riyadh-base.geojson.js', 'RIYADH_BASE');
  const rings = base.features
    .filter((f) => ['water', 'green'].indexOf(f.properties.kind) !== -1)
    .filter((f) => f.geometry.type === 'Polygon')
    .map((f) => f.geometry.coordinates[0])
    .filter((ring) => ring.length > 8)
    .slice(0, 60);

  function inside(ring, point) {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const yi = ring[i][1];
      const yj = ring[j][1];
      if ((yi > point[1]) === (yj > point[1])) continue;
      const x = ring[i][0] + ((point[1] - yi) / (yj - yi)) * (ring[j][0] - ring[i][0]);
      if (point[0] < x) hit = !hit;
    }
    return hit;
  }

  /** أقرب مسافة بالمتر من نقطة إلى حافة الحلقة. */
  function depth(ring, point) {
    let best = Infinity;
    for (let i = 1; i < ring.length; i += 1) {
      const dx = (ring[i][0] - ring[i - 1][0]) * M_PER_LON;
      const dy = (ring[i][1] - ring[i - 1][1]) * F.M_PER_LAT;
      const px = (point[0] - ring[i - 1][0]) * M_PER_LON;
      const py = (point[1] - ring[i - 1][1]) * F.M_PER_LAT;
      const span = dx * dx + dy * dy;
      const t = span ? Math.max(0, Math.min(1, (px * dx + py * dy) / span)) : 0;
      best = Math.min(best, Math.hypot(px - dx * t, py - dy * t));
    }
    return best;
  }

  rings.forEach((ring) => {
    let west = 180;
    let east = -180;
    let south = 90;
    let north = -90;
    ring.forEach((p) => {
      if (p[0] < west) west = p[0];
      if (p[0] > east) east = p[0];
      if (p[1] < south) south = p[1];
      if (p[1] > north) north = p[1];
    });
    made.forEach((f) => {
      const p = f.geometry.coordinates[0][0];
      if (p[0] < west || p[0] > east || p[1] < south || p[1] > north) return;
      if (!inside(ring, p)) return;
      const inward = depth(ring, p);
      assert.ok(inward <= TOLERANCE_M,
        `مولَّد يغرز ${inward.toFixed(1)} متراً داخل ماء أو حديقة عند ${p}`);
    });
  });
});

ok('التغطية بلا ثقوب: كل ثُمن من النطاق فيه نسيج', () => {
  // ٦٤ خلية على المدينة كلها. قبل التوليد كان أقلّها أربعة مبانٍ — أي فراغاً
  // يُقرأ صحراءَ وسط عمران. المقياس هنا أن أفقر خلية صارت حياً لا خلاء.
  const SIDE = 8;
  const cells = new Array(SIDE * SIDE).fill(0);
  buildings.features.forEach((f) => {
    const p = f.geometry.coordinates[0][0];
    const gx = Math.floor(((p[0] - BBOX.west) / (BBOX.east - BBOX.west)) * SIDE);
    const gy = Math.floor(((p[1] - BBOX.south) / (BBOX.north - BBOX.south)) * SIDE);
    if (gx >= 0 && gx < SIDE && gy >= 0 && gy < SIDE) cells[gy * SIDE + gx] += 1;
  });
  const poorest = Math.min.apply(null, cells);
  assert.ok(poorest >= 1000, `أفقر خلية ${poorest} مبنى — الفجوة باقية`);
});

ok('الحمولة تُقرأ بـ JSON.parse لا ككائن حرفي', () => {
  // كائن حرفي بمئة ميغابايت يمرّ على مترجم المصدر؛ النص يمرّ على محلّل JSON
  // المخصّص. الفرق ثوانٍ يدفعها المتصفح مرة واحدة عند كل زيارة.
  const head = fs.readFileSync(path.join(DATA, 'riyadh-buildings.geojson.js'), 'utf8').slice(0, 60);
  assert.ok(head.indexOf('JSON.parse(') !== -1, `الرأس: ${head}`);
});

ok('التوليد لا يذكر مصدراً خارجياً — الملف يعمل عبر file://', () => {
  const script = fs.readFileSync(path.join(ROOT, 'scripts', 'synthesize-fabric.js'), 'utf8');
  assert.ok(script.indexOf('fetch(') === -1, 'التوليد يطلب من الشبكة');
});

console.log(`\n${passed} اختبارات نجحت`);
