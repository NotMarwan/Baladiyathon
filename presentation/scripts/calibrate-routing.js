'use strict';
/**
 * مسار — قياس واقعية التوجيه مقابل محرّك مستقل.
 * ---------------------------------------------------------------------------
 * السؤال المشروع: بأي حقّ نقول إن «دقيقتان مضافتان» رقمٌ واقعي؟
 *
 * الجواب ليس بالإقناع بل بالقياس. نأخذ عيّنة أزواج نقاط في الرياض، ونطلب
 * المسار من محرّكنا ومن OSRM — محرّك توجيه مفتوح المصدر يعمل على بيانات
 * OpenStreetMap نفسها، وهو مرجع الصناعة حين لا يتاح محرّك تجاري. ثم نقارن.
 *
 * ما تقيسه المقارنة وما لا تقيسه:
 *
 *   ✔ **اكتمال الشبكة** تُقاس بالمسافة. المحرّكان يقرآن الخريطة نفسها، فإن
 *     خرجت مسافتنا أطول بكثير فليست هندستنا أسوأ — بل شبكتنا ناقصة، فتضطر
 *     المسار إلى التفافٍ لا يضطر إليه من يملك كل الشوارع. هذا بالضبط عيبُ
 *     شبكة الشرايين وحدها، ويظهر رقماً لا رأياً.
 *
 *   ✘ **زمن الرحلة لا يُقاس به.** ملف السيارة في OSRM يمشي بسرعات حرة تقريباً:
 *     لا إشارات ولا انعطاف ولا ازدحام. فزمنُنا أطول منه بالضرورة والقصد،
 *     ونسبةُ الزيادة نموذجُنا المعلن لا خطأ نصححه. تُطبع لتُقرأ لا لتُصفَّر.
 *
 * ولذلك تُقاس الشبكتان معاً — شرايين وحدها، ثم شرايين وشوارع أحياء — على
 * نفس الأزواج. الفرق بينهما هو أثر الشوارع الجانبية، معبَّراً عنه بعدد.
 *
 *     node scripts/calibrate-routing.js
 *     node scripts/calibrate-routing.js --pairs=60 --graph=<ملف>
 *
 * OSRM العام خدمة تجريبية بلا ضمان: الطلب متسلسل وبمهلة بينه أدباً، والفشل
 * يُسقط الزوج ولا يوقف القياس. لا يُستدعى وقت تشغيل الصفحة إطلاقاً.
 */
const fs = require('fs');
const path = require('path');

const Routing = require('../masar-city-routing.js');

const DATA = path.join(__dirname, '..', 'data');
const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
const PAUSE_MS = 350;

/** نطاق النواة الكثيفة — أزواجٌ خارجها تقيس الصحراء لا المدينة. */
const CORE = { south: 24.585, west: 46.600, north: 24.790, east: 46.790 };

/** رحلاتٌ في رتبة التحويلة: أقصر منها ضجيج إسناد، وأطول منها تقيس الشرايين. */
const MIN_SPAN_M = 1500;
const MAX_SPAN_M = 7000;

const SEED = 20260725;

/** mulberry32 — نفس مولّد النسيج: العيّنة تُعاد كما هي عند كل تشغيل. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadGraph(file) {
  const full = path.isAbsolute(file) ? file : path.join(DATA, file);
  if (!fs.existsSync(full)) return null;
  const previous = global.window;
  global.window = {};
  delete require.cache[require.resolve(full)];
  require(full);
  const graph = global.window.RIYADH_ROUTE_GRAPH;
  global.window = previous;
  return graph;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function osrmRoute(from, to) {
  const url = `${OSRM}${from[0]},${from[1]};${to[0]},${to[1]}?overview=false`;
  let response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': 'masar-calibration' } });
  } catch (err) {
    return null;
  }
  if (!response.ok) return null;
  let body;
  try {
    body = await response.json();
  } catch (err) {
    return null;
  }
  if (body.code !== 'Ok' || !body.routes || !body.routes.length) return null;
  return { distanceM: body.routes[0].distance, seconds: body.routes[0].duration };
}

/** الوسيط — أمتن من المتوسط أمام زوجٍ شاذّ واحد يفسد العيّنة. */
function median(values) {
  if (!values.length) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, p) {
  if (!values.length) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  const at = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[at];
}

function argOf(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function main() {
  const wanted = Number(argOf('pairs', 40));
  const hour = Number(argOf('hour', 3));

  const candidates = [
    { label: 'الشبكة الكاملة (شرايين + أحياء)', file: argOf('graph', 'riyadh-route-graph.js') },
    { label: 'الشرايين وحدها (النسخة السابقة)', file: argOf('before', '') },
  ].filter((entry) => entry.file);

  const graphs = [];
  for (const entry of candidates) {
    const graph = loadGraph(entry.file);
    if (!graph) { console.log(`تخطي ${entry.label} — ${entry.file} مفقود`); continue; }
    graphs.push({
      label: entry.label,
      prepared: Routing.prepare(graph),
      nodes: graph.nodes.length,
      edges: graph.edges.length,
    });
  }
  if (!graphs.length) throw new Error('لا رسم للقياس');

  /* ---- العيّنة: أزواج ثابتة تُسنَد إلى كل شبكة على حدة ---- */

  const random = mulberry32(SEED);
  const pairs = [];
  let guard = 0;
  while (pairs.length < wanted && guard < wanted * 200) {
    guard += 1;
    const from = [
      CORE.west + random() * (CORE.east - CORE.west),
      CORE.south + random() * (CORE.north - CORE.south),
    ];
    const to = [
      CORE.west + random() * (CORE.east - CORE.west),
      CORE.south + random() * (CORE.north - CORE.south),
    ];
    const span = Routing.metresBetween(from, to);
    if (span < MIN_SPAN_M || span > MAX_SPAN_M) continue;
    pairs.push({ from, to, span });
  }
  console.log(`${pairs.length} زوجاً · الساعة ${hour} · مرجع OSRM`);
  console.log('');

  /* ---- القياس ---- */

  const results = graphs.map((g) => ({
    label: g.label, nodes: g.nodes, edges: g.edges,
    distanceRatio: [], timeRatio: [], missed: 0, failed: 0,
  }));

  let osrmFailures = 0;
  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i];
    const reference = await osrmRoute(pair.from, pair.to);
    await sleep(PAUSE_MS);
    if (!reference || !(reference.distanceM > 0)) { osrmFailures += 1; continue; }

    graphs.forEach((g, index) => {
      const a = Routing.nearestNode(g.prepared, pair.from);
      const b = Routing.nearestNode(g.prepared, pair.to);
      if (a === -1 || b === -1) { results[index].missed += 1; return; }
      const route = Routing.shortestPath(g.prepared, a, b, { hour: hour });
      if (!route) { results[index].failed += 1; return; }
      results[index].distanceRatio.push(route.lengthM / reference.distanceM);
      results[index].timeRatio.push(route.minutes / (reference.seconds / 60));
    });

    if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${pairs.length}\n`);
  }

  /* ---- التقرير ---- */

  console.log('');
  for (const row of results) {
    const n = row.distanceRatio.length;
    console.log(row.label);
    console.log(`  ${row.nodes} عقدة · ${row.edges} ضلعاً`);
    if (!n) { console.log('  لا قياس — كل الأزواج سقطت'); console.log(''); continue; }
    console.log(`  المسافة مقابل OSRM: وسيط ×${median(row.distanceRatio).toFixed(3)} · `
      + `المئين التسعون ×${percentile(row.distanceRatio, 90).toFixed(3)}`);
    console.log(`  الزمن مقابل OSRM:   وسيط ×${median(row.timeRatio).toFixed(3)} `
      + `(الفارق نموذجُنا المعلن: إشارات وانعطاف وازدحام)`);
    console.log(`  ${row.missed} زوجاً خارج نطاق الإسناد · ${row.failed} بلا مسار · ${n} مقيساً`);
    console.log('');
  }
  if (osrmFailures) console.log(`${osrmFailures} زوجاً سقط من طرف OSRM`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
