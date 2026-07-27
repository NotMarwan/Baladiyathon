'use strict';
/**
 * طور الإشارة عند إغلاق مدخل — كشفٌ وتوصية تنسيق، لا حساب توقيت.
 * ---------------------------------------------------------------------------
 * **الفكرة.**
 *
 * تقاطعٌ محكوم بإشارة أربعةُ مداخل. يصدر تصريح حفر يغلق أحدها. والإشارة تبقى
 * تعمل بخطتها الثابتة، فتمنح أخضرَ لمدخلٍ لا تأتي منه مركبة. وذلك الأخضر أحمرُ
 * إضافيّ على المداخل الباقية: ينتظر السائق أطول **لا بسبب الحفر، بل بسبب خطة
 * توقيت لم يعدّلها أحد**. وهذا تأخيرٌ لا يظهر في أي نموذج وصلات — لأنه ليس في
 * الوصلة أصلاً بل في التقاطع.
 *
 * **وما يستطيع هذا الملف قوله، وما لا يستطيع.**
 *
 * يستطيع أن يقول: هذا التصريح يقع على تقاطع يقول عنه **مصدران مستقلان** إنه
 * محكوم بإشارة، وعنده كذا ضلعاً ملتقياً، وبديله المحسوب لا يمرّ عبره — فيُرفع
 * بلاغ تنسيق إعادة توقيت إلى إدارة المرور.
 *
 * ولا يستطيع أن يقول **كم ثانية تُحرَّر**. طول الدورة ونسبة الأخضر إلى الدورة
 * غير موجودين في أيٍّ من المصدرين — وهما الكميتان الوحيدتان اللتان يُحسب منهما
 * ذلك. فالمُخرَج مظروفٌ معلَن الافتراض لا رقم: أدناه صفر (الخطة ثابتة ولا أحد
 * يعدّل، وهو الوضع القائم)، وأعلاه حصة مدخلٍ واحد من الدورة بافتراض توزيعٍ
 * متساوٍ على الأضلاع — **افتراض صريح لا قياس**.
 *
 * **ثلاثة حدود قيست هنا ولم تكن متوقَّعة، وكلها تُضيّق ما يُقال:**
 *
 * ١) `graph.control` في محرك التوجيه **ليس مصدر تأكيد**: 569 عقدة تحكّم مسندة
 *    من OSM مقابل 14,293 مستنتَجة من عدد الشرايين الملتقية. فتأكيد التحكّم
 *    يُؤخذ من الطبقة الخام (`riyadh-traffic-control.js`) وسجل الهيئة الملكية،
 *    لا من الرسم — وإلا صار الاستنتاج تأكيداً لنفسه.
 *
 * ٢) **أيُّ المداخل مغلق غير مشتَقّ من البيانات.** `edgesUnderClosure` يمنع كل
 *    ضلع ضمن 45 متراً من خط العمل، فيمنع عند تقاطعٍ على الخط **كل** أضلاعه لا
 *    ضلع المدخل. وجُرِّبت طريقة ثانية — بُعد الطرف البعيد لكل ضلع عن خط العمل —
 *    فلم تفصل: الأضلاع المتقاطعة قصيرة عند التقاطع (7–37 م) فأطرافها تبقى
 *    قريبة. فيُعرض عدد الأضلاع وتفصيلها، ولا يُدّعى تسميةُ المدخل المغلق.
 *
 * ٣) **صفر `blocked` بنيويّ لا عارض.** ما دام كل ضلع عند التقاطع ممنوعاً، فلا
 *    بديل يستطيع عبوره أصلاً. فالصفر يقول «القاعدة غير قابلة للاختبار على
 *    تمثيل الإغلاق الحالي»، لا «تحقّقنا أن البدائل سليمة». وهذا مكتوب في
 *    المُخرَج كي لا يُقرأ الصفر طمأنينة.
 *
 * **بوابة الصحة.** الحصيلة تُقارَن بما قاسه `build-intersection-context.js`
 * (17 تصريحاً بتحكّم مؤكَّد). حسابان مستقلان يجب أن يعطيا العدد نفسه؛ فإن
 * اختلفا سقط التوليد — لأن أحدهما يقيس شيئاً آخر ولا يُعرف أيّهما.
 *
 * التشغيل: node presentation/scripts/build-signal-phase-impact.js
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const LAB_SOURCE = path.join(REPO, 'research', 'evidence-intelligence', 'lab',
  'official-data', 'rcrc-traffic-intersections-2025.json');
const DATA = path.join(ROOT, 'data');
global.window = global;

const OUT_JSON = path.join(DATA, 'signal-phase-impact.json');
const OUT_JS = path.join(DATA, 'signal-phase-impact.js');

/* العتبات الثلاث الأولى منقولة حرفياً من `build-intersection-context.js` كي
   يبقى «مؤكَّد» هنا هو «مؤكَّد» هناك. تغييرها في أحد الملفين دون الآخر يُسقط
   بوابة الصحة أدناه، وهذا مقصود. */
const ON_ROUTE_M = 50;
const SIGNAL_ON_ROUTE_M = 30;
const CORROBORATION_M = 75;

/**
 * إسناد عقدة الإشارة إلى الرسم.
 *
 * الطبقتان من OSM نفسه، فعقدة الإشارة يُفترض أن تقع على الشبكة. والقياس:
 * نصف الإشارات على صفر متر، و90٪ دون عشرين. فما بَعُد عن ملتقىً في الرسم
 * يعني أن مُستخرَجنا للطرق أسقط الشارع المتقاطع، لا أن الإشارة في الفراغ.
 *
 * والسقف 50 م هو `ON_ROUTE_M` نفسه — مسافةٌ معلنة في المستودع لمعنى «هذه
 * النقطة على هذا المسار»، لا رقمٌ اختير هنا. والمسح منشور كي يُقرأ أن النتيجة
 * ليست أثر عتبة.
 */
const NODE_SNAP_M = 50;
const NODE_SNAP_SWEEP_M = [25, 50, 75];
/** الإشارة عند ملتقى: عقدةٌ بضلعين ليست تقاطعاً بل نقطة على شارع. */
const NODE_MIN_DEGREE = 3;

/** الساعة المرجعية نفسها المستعملة في `build-alternate-load.js`. */
const REFERENCE_HOUR = 8;

/** ما يعلنه `intersection-context.json`، ويجب أن يُعاد إنتاجه هنا. */
const EXPECTED_CONFIRMED = 17;

const METRES_PER_DEGREE = 110540;
function lonScale(lat) { return Math.cos((lat * Math.PI) / 180) * 111320 / METRES_PER_DEGREE; }

function distanceToSegment(point, a, b, scale) {
  const px = (point[0] - a[0]) * METRES_PER_DEGREE * scale;
  const py = (point[1] - a[1]) * METRES_PER_DEGREE;
  const dx = (b[0] - a[0]) * METRES_PER_DEGREE * scale;
  const dy = (b[1] - a[1]) * METRES_PER_DEGREE;
  const span = dx * dx + dy * dy;
  const t = span > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / span)) : 0;
  return Math.hypot(px - dx * t, py - dy * t);
}

function distanceToLine(point, coordinates) {
  const scale = lonScale(point[1]);
  let minimum = Infinity;
  for (let index = 1; index < coordinates.length; index += 1) {
    const distance = distanceToSegment(point, coordinates[index - 1],
      coordinates[index], scale);
    if (distance < minimum) minimum = distance;
  }
  return minimum;
}

function metresBetween(a, b) {
  const scale = lonScale(a[1]);
  return Math.hypot((a[0] - b[0]) * METRES_PER_DEGREE * scale,
    (a[1] - b[1]) * METRES_PER_DEGREE);
}

/** شبكةٌ مكانية على عقد الرسم — الإسناد بلا مسح 118 ألف عقدة لكل إشارة. */
function nodeIndex(graph) {
  const cell = 0.002;
  const buckets = new Map();
  for (let node = 0; node < graph.nodes.length; node += 1) {
    const key = Math.floor(graph.nodes[node][0] / cell) + ':'
      + Math.floor(graph.nodes[node][1] / cell);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(node);
  }
  return { cell, buckets };
}

/** أقرب ملتقى في الرسم إلى نقطة، مع بُعده — بلا سقف، السقف يُطبَّق فوق. */
function nearestJunction(index, prepared, point) {
  const gx = Math.floor(point[0] / index.cell);
  const gy = Math.floor(point[1] / index.cell);
  let best = -1;
  let bestDistance = Infinity;
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const list = index.buckets.get((gx + dx) + ':' + (gy + dy));
      if (!list) continue;
      for (const node of list) {
        if (prepared.adjacency[node].length < NODE_MIN_DEGREE) continue;
        const distance = metresBetween(point, prepared.graph.nodes[node]);
        if (distance < bestDistance) { bestDistance = distance; best = node; }
      }
    }
  }
  return { node: best, distanceM: bestDistance };
}

/**
 * أزواج التطابق على مقطع عمل واحد: تقاطعٌ مسرود على الخط، وعقدة إشارة OSM
 * قريبةٌ منه. التطابق وحده يرفع «تقاطع مسرود» إلى «محكوم بإشارة».
 */
function corroboratedPairs(line, intersections, signals) {
  const onRoute = intersections
    .map((row) => ({ row, distanceM: distanceToLine([row.lon, row.lat], line) }))
    .filter((entry) => entry.distanceM <= ON_ROUTE_M)
    .sort((left, right) => left.distanceM - right.distanceM);
  const onRouteSignals = signals
    .map((row) => ({ row, distanceM: distanceToLine([row.lon, row.lat], line) }))
    .filter((entry) => entry.distanceM <= SIGNAL_ON_ROUTE_M);

  const pairs = [];
  onRoute.forEach((entry) => {
    const match = onRouteSignals
      .map((signal) => ({
        signal,
        pairM: metresBetween([entry.row.lon, entry.row.lat],
          [signal.row.lon, signal.row.lat]),
      }))
      .filter((one) => one.pairM <= CORROBORATION_M)
      .sort((left, right) => left.pairM - right.pairM)[0];
    if (match) {
      pairs.push({
        code: entry.row.code,
        name: entry.row.nameAr,
        intersectionToWorkM: Math.round(entry.distanceM),
        signalToWorkM: Math.round(match.signal.distanceM),
        pairM: Math.round(match.pairM),
        signalPoint: [match.signal.row.lon, match.signal.row.lat],
      });
    }
  });
  return { pairs, listedOnRoute: onRoute.length, signalsOnRoute: onRouteSignals.length };
}

/**
 * تفصيل الأضلاع الملتقية عند العقدة.
 *
 * يُعرض خاماً — رقم الضلع واسمه وطوله وبُعد طرفه البعيد عن خط العمل — لأن
 * **لا قاعدة تفصل المدخل المغلق عن غيره** على هذه البيانات: الأضلاع المتقاطعة
 * قصيرة عند التقاطع فتبقى أطرافها ضمن مدى الإغلاق. فالقارئ يرى ما رأيناه،
 * ولا يُقدَّم له تصنيفٌ لم يصمد.
 */
function legsAt(prepared, node, line, banned) {
  const graph = prepared.graph;
  return prepared.adjacency[node].map((edgeIndex) => {
    const edge = graph.edges[edgeIndex];
    const far = graph.nodes[edge[0] === node ? edge[1] : edge[0]];
    const nameRef = edge[9];
    return {
      edge: edgeIndex,
      street: (nameRef === undefined || nameRef < 0)
        ? '' : ((graph.names || [])[nameRef] || ''),
      lengthM: Math.round(edge[2]),
      farEndToWorkM: Math.round(distanceToLine(far, line)),
      underClosure: !!banned[edgeIndex],
    };
  }).sort((left, right) => left.farEndToWorkM - right.farEndToWorkM);
}

/**
 * المظروف: ما بين لا تعديل، وحصةِ مدخلٍ واحد من الدورة.
 *
 * لا ثوانيَ هنا ولا تستطيع أن تكون: طول الدورة غير معلوم. النسبة وحدها
 * تُعرض، وهي `1/عدد الأضلاع` بافتراض توزيعٍ متساوٍ — والتوزيع المتساوي
 * **افتراض صريح**، والواقع أن الشريان يأخذ أكثر من الفرعي.
 */
function legsPhrase(legs) {
  if (legs === 2) return 'ضلعين ملتقيين';
  if (legs >= 3 && legs <= 10) return legs + ' أضلاع ملتقية';
  return legs + ' ضلعاً ملتقياً';
}

function envelopeFor(legs) {
  return {
    lowPct: 0,
    lowMeans: 'لا أحد يعدّل الخطة — الوضع القائم.',
    highPct: legs > 0 ? Math.round(100 / legs) : null,
    highMeans: 'حصة مدخلٍ واحد من الدورة بافتراض توزيع متساوٍ على '
      + legsPhrase(legs) + '.',
    assumption: 'التوزيع المتساوي افتراض لا قياس: خطط التوقيت تعطي الشريان '
      + 'أكثر من الفرعي. وعدد المداخل المغلقة غير مشتَقّ من المصادر، '
      + 'فالنسبة لمدخلٍ واحد لا للإغلاق كله.',
    unit: '٪ من الدورة',
    notSeconds: 'لا تُحوَّل إلى ثوانٍ: طول الدورة غير موجود في أي مصدر متاح.',
    evidenceLevel: 'model-derived',
  };
}

/** حالة قاعدة الاستثناء لتصريح مؤكَّد. */
function exceptionRule(prepared, graph, line, nodes) {
  let result = null;
  try {
    result = Routing.alternativesAround(prepared, line,
      { hour: REFERENCE_HOUR, count: 2 });
  } catch (error) {
    return { state: 'unmeasurable', why: 'خطأ توجيه: ' + error.message,
      alternativesConsidered: 0, alternativesThroughNode: 0 };
  }
  if (!result || !result.ok) {
    return {
      state: 'unmeasurable',
      why: 'لا بديل محسوب: ' + ((result && result.reason) || 'غير معروف'),
      alternativesConsidered: 0,
      alternativesThroughNode: 0,
    };
  }

  const visited = new Set();
  result.alternatives.forEach((alternative) => {
    alternative.states.forEach((state) => {
      const edge = graph.edges[state >> 1];
      visited.add(edge[0]);
      visited.add(edge[1]);
    });
  });
  const through = nodes.filter((node) => visited.has(node));

  return {
    state: through.length ? 'blocked' : 'eligible',
    alternativesConsidered: result.alternatives.length,
    alternativesThroughNode: through.length,
    why: through.length
      ? 'بديلٌ محسوب يمرّ بالتقاطع نفسه — إسقاط الطور يضرّ البديل، فتسقط التوصية.'
      : 'لا بديل محسوب يمرّ بالتقاطع — إعادة التوقيت لا تضرّ مساراً بديلاً.',
  };
}

/** يقرأ عقد الإشارات من الطبقة الخام، ويتحقّق من ترميزها قبل الاعتماد. */
function loadSignals() {
  require(path.join(DATA, 'riyadh-traffic-control.js'));
  const layer = global.window.RIYADH_TRAFFIC_CONTROL;
  if (!layer || !Array.isArray(layer.points)) {
    throw new Error('طبقة التحكّم المروري غير محمَّلة');
  }
  const signals = layer.points.filter((point) => point[2] === 2)
    .map((point) => ({ lon: point[0], lat: point[1] }));
  const declared = (layer.metadata && layer.metadata.counts
    && layer.metadata.counts.traffic_signals) || 0;
  if (signals.length !== declared) {
    throw new Error('عدد الإشارات (' + signals.length + ') لا يطابق ما تعلنه '
      + 'الطبقة (' + declared + ')');
  }
  return { signals, source: layer.metadata.source };
}

let Routing = null;

/** يبني مدخل تصريح واحد. */
function permitEntry(context, feature) {
  const line = feature.geometry.coordinates;
  const found = corroboratedPairs(line, context.intersections, context.signals);

  if (!found.pairs.length) {
    return {
      control: found.listedOnRoute > 0 || found.signalsOnRoute > 0
        ? 'single-source' : 'none',
      controlLabel: found.listedOnRoute > 0 || found.signalsOnRoute > 0
        ? 'مصدر واحد يذكر تحكّماً — غير مؤكَّد'
        : 'لا مصدر يذكر تقاطعاً على مقطع العمل',
      listedOnRoute: found.listedOnRoute,
      signalsOnRoute: found.signalsOnRoute,
      absenceIsNotEvidence: true,
      intersections: [],
      rule: { state: 'not-applicable', why: 'التحكّم غير مؤكَّد من مصدرين.',
        alternativesConsidered: 0, alternativesThroughNode: 0 },
      recommendation: null,
    };
  }

  const banned = Routing.edgesUnderClosure(context.prepared, line);
  const intersections = found.pairs.map((pair) => {
    const snap = nearestJunction(context.index, context.prepared, pair.signalPoint);
    const resolved = snap.node >= 0 && snap.distanceM <= NODE_SNAP_M;
    const legs = resolved ? legsAt(context.prepared, snap.node, line, banned) : [];
    return Object.assign({}, pair, {
      signalPoint: undefined,
      node: resolved ? snap.node : null,
      nodeSnapM: snap.node >= 0 ? Math.round(snap.distanceM) : null,
      nodeStatus: resolved ? 'resolved' : 'unresolved',
      nodeUnresolvedWhy: resolved ? null
        : 'أقرب ملتقى في الرسم على ' + Math.round(snap.distanceM) + ' م — '
          + 'فوق سقف ' + NODE_SNAP_M + ' م. مُستخرَج الطرق أسقط الشارع المتقاطع.',
      legs: legs.length,
      legsUnderClosure: legs.filter((leg) => leg.underClosure).length,
      legDetail: legs,
      envelope: legs.length ? envelopeFor(legs.length) : null,
    });
  });

  const nodes = intersections.filter((one) => one.node !== null)
    .map((one) => one.node);
  const rule = nodes.length
    ? exceptionRule(context.prepared, context.prepared.graph, line, nodes)
    : { state: 'unmeasurable', why: 'لم تُسنَد عقدة تقاطع في الرسم.',
      alternativesConsidered: 0, alternativesThroughNode: 0 };

  return {
    control: 'confirmed',
    controlLabel: 'تحكّم بإشارة مؤكَّد من المصدرين',
    listedOnRoute: found.listedOnRoute,
    signalsOnRoute: found.signalsOnRoute,
    absenceIsNotEvidence: false,
    intersections: intersections,
    rule: rule,
    recommendation: rule.state === 'eligible'
      ? {
        action: 'coordinate-retiming',
        label: 'تنسيق إعادة توقيت مع إدارة المرور قبل بدء العمل',
        plain: 'هذا العمل يغلق مدخلاً على تقاطع بإشارة. الإشارة ستبقى تمنح '
          + 'أخضرَ لمدخلٍ مغلق ما لم تُعدَّل خطتها — فالانتظار على المداخل '
          + 'الباقية يزيد بلا سبب.',
      }
      : null,
  };
}

/** مسح سقف الإسناد — يُنشر كي تُقرأ النتيجة غير مرهونة بعتبة مُنتقاة. */
function snapSweep(entries) {
  const sweep = {};
  NODE_SNAP_SWEEP_M.forEach((threshold) => {
    sweep[String(threshold)] = entries.filter((entry) => entry.control === 'confirmed'
      && entry.intersections.some((one) => one.nodeSnapM !== null
        && one.nodeSnapM <= threshold)).length;
  });
  return sweep;
}

/**
 * سلامة اللقطة قبل الحساب — ولماذا لا تُستدعى البوابة القائمة.
 * ---------------------------------------------------------------------------
 * `pin-rcrc-intersections.js --check` **يسقط اليوم على `main`** قبل أي عمل في
 * هذا الفرع: الحقل `_provenance.sha256` المعلَن
 * (`9f625c…`) لا يطابق بصمة حمولته المحسوبة (`bdbb3d…`). وقيس السبب: حمولة
 * اللقطة **مطابقة بايتاً ببايت** لنسخة المخبر التي سُحبت منها، فالخلل في
 * البصمة المخزَّنة وحدها لا في البيانات.
 *
 * ولم تُعَد كتابة البصمة هنا: هي منشورة في
 * `research/evidence-intelligence/RCRC-INTERSECTION-DECISION.md` وفي
 * `intersection-context.json`، وتصحيحها بصمتٍ يمحو الأثر الذي يجعل الخلل
 * قابلاً للاكتشاف. فيُبلَّغ ويُترك للمالك.
 *
 * وما يُفحص بدلاً منها أقوى لا أضعف: أن حمولة اللقطة **هي نفسها** نسخة المخبر
 * المسحوبة من الواجهة العامة، وأن عدد السجلات يطابق ما تعلنه. هذا يثبت أن ما
 * نحسب عليه لم يُحرَّر، وهو ما كانت البصمة تحرسه.
 */
function checkSnapshot(pinned) {
  const compact = (records) => crypto.createHash('sha256')
    .update(JSON.stringify(records), 'utf8').digest('hex');

  if (pinned.intersections.length !== pinned._provenance.recordCount) {
    throw new Error('عدد سجلات اللقطة لا يطابق ما تعلنه.');
  }
  const lab = JSON.parse(fs.readFileSync(LAB_SOURCE, 'utf8'));
  const payloadHash = compact(pinned.intersections);
  if (payloadHash !== compact(lab)) {
    throw new Error('حمولة اللقطة لا تطابق نسخة المخبر — اللقطة حُرِّرت.\n'
      + '  اللقطة: ' + payloadHash + '\n  المخبر: ' + compact(lab));
  }
  return {
    payloadMatchesLabCopy: true,
    payloadSha256: payloadHash,
    declaredSha256: pinned._provenance.sha256,
    declaredFingerprintStale: pinned._provenance.sha256 !== payloadHash,
    note: 'البصمة المعلَنة في اللقطة لا تطابق حمولتها، و'
      + '`pin-rcrc-intersections.js --check` يسقط عليها على `main` — خللٌ سابق '
      + 'لهذا العمل. والحمولة نفسها سليمة: مطابقة لنسخة المخبر بايتاً ببايت. '
      + 'لم تُصحَّح البصمة هنا لأنها منشورة في قرارٍ ووثائق، وتصحيحها بصمتٍ '
      + 'يمحو أثر الخلل.',
  };
}

function main() {
  require(path.join(DATA, 'riyadh-route-graph.js'));
  Routing = require(path.join(ROOT, 'masar-city-routing.js'));
  const graph = global.RIYADH_ROUTE_GRAPH;
  if (!graph) throw new Error('رسم التوجيه غير محمَّل');
  const prepared = Routing.prepare(graph);

  const control = loadSignals();
  const pinned = JSON.parse(fs.readFileSync(
    path.join(DATA, 'rcrc-intersections.json'), 'utf8'));
  const snapshot = checkSnapshot(pinned);
  const portfolio = JSON.parse(fs.readFileSync(
    path.join(DATA, 'city-portfolio.geojson'), 'utf8'));

  const context = {
    prepared: prepared,
    index: nodeIndex(graph),
    signals: control.signals,
    intersections: pinned.intersections.map((row) => ({
      code: row.intersectionCode,
      nameAr: row.nameAr,
      lon: row.longitude,
      lat: row.latitude,
    })),
  };

  const permits = {};
  portfolio.features.forEach((feature) => {
    const ref = feature.properties.permitRef;
    if (!feature.geometry || feature.geometry.type !== 'LineString') {
      permits[ref] = {
        control: 'unmeasurable',
        controlLabel: 'هندسة نقطية — لا خطّ يُقاس عليه',
        listedOnRoute: 0,
        signalsOnRoute: 0,
        absenceIsNotEvidence: true,
        intersections: [],
        rule: { state: 'not-applicable', why: 'لا خطّ عمل يُقاس عليه.',
          alternativesConsidered: 0, alternativesThroughNode: 0 },
        recommendation: null,
      };
      return;
    }
    permits[ref] = permitEntry(context, feature);
  });

  const entries = Object.values(permits);
  const confirmed = entries.filter((entry) => entry.control === 'confirmed');
  const tally = {
    confirmed: confirmed.length,
    singleSource: entries.filter((entry) => entry.control === 'single-source').length,
    none: entries.filter((entry) => entry.control === 'none').length,
    unmeasurable: entries.filter((entry) => entry.control === 'unmeasurable').length,
    eligible: confirmed.filter((entry) => entry.rule.state === 'eligible').length,
    blocked: confirmed.filter((entry) => entry.rule.state === 'blocked').length,
    ruleUnmeasurable: confirmed.filter((entry) => entry.rule.state === 'unmeasurable').length,
  };

  /* بوابة الصحة — حسابان مستقلان على العتبات نفسها يجب أن يتفقا. */
  if (tally.confirmed !== EXPECTED_CONFIRMED) {
    throw new Error('التحكّم المؤكَّد ' + tally.confirmed + ' لا يطابق '
      + EXPECTED_CONFIRMED + ' المقيسة في intersection-context.json.\n'
      + '  حسابان على العتبات نفسها اختلفا — أحدهما يقيس شيئاً آخر، ولا يُعرف '
      + 'أيّهما. راجع قبل أن تكمل.');
  }

  const report = {
    generatedFrom: 'presentation/scripts/build-signal-phase-impact.js',
    role: 'كشف تصاريح على تقاطعات محكومة بإشارة، وتوصية تنسيق إعادة توقيت',
    grade: 'model-derived',
    referenceHour: REFERENCE_HOUR,
    sources: [
      {
        what: 'مواقع التقاطعات',
        publisher: 'الهيئة الملكية لمدينة الرياض',
        recordCount: pinned.intersections.length,
        sha256: snapshot.payloadSha256,
        accessedOn: pinned._provenance.accessedOn,
        integrity: snapshot,
      },
      { what: 'عقد الإشارات', publisher: control.source,
        signalNodes: control.signals.length },
      { what: 'هندسة الشبكة وعدد الأضلاع والبدائل',
        publisher: 'رسم توجيه مسار من OpenStreetMap',
        nodes: graph.nodes.length, edges: graph.edges.length },
    ],
    method: {
      onRouteM: ON_ROUTE_M,
      signalOnRouteM: SIGNAL_ON_ROUTE_M,
      corroborationM: CORROBORATION_M,
      nodeSnapM: NODE_SNAP_M,
      nodeSnapSweepM: NODE_SNAP_SWEEP_M,
      nodeSnapSweep: snapSweep(entries),
      nodeMinDegree: NODE_MIN_DEGREE,
      confirmedMeans: 'تقاطعٌ يسرده مصدر رسمي وعقدةُ إشارة من مصدر مجتمعي '
        + 'مستقل تبعد عنه ' + CORROBORATION_M + ' متراً أو أقل.',
    },
    /* ثلاثة حدود قيست، ولولا كتابتها لقُرئ المُخرَج أقوى مما هو. */
    limits: {
      engineControlIsMostlyInferred: {
        fromOsm: graph.metadata.controlFromOsm,
        inferred: graph.metadata.controlInferred,
        why: 'عقد التحكّم في رسم التوجيه أغلبها مستنتَج من عدد الشرايين '
          + 'الملتقية لا مسند من OSM. فلا تُقرأ عقدة تحكّم في الرسم تأكيداً — '
          + 'التأكيد من الطبقة الخام وسجل الهيئة الملكية وحدهما.',
      },
      closedApproachNotDerivable: {
        why: 'تمثيل الإغلاق في المحرك يمنع كل ضلع ضمن 45 متراً من خط العمل، '
          + 'فيمنع عند تقاطعٍ على الخط كل أضلاعه لا ضلع المدخل. وطريقةٌ ثانية '
          + '— بُعد الطرف البعيد عن خط العمل — لم تفصل لأن الأضلاع المتقاطعة '
          + 'قصيرة عند التقاطع. فعدد الأضلاع معروض، وتسميةُ المدخل المغلق لا.',
        consequence: 'المظروف الأعلى محسوب لمدخلٍ واحد، لا لمجموع المداخل '
          + 'المغلقة — وعددها غير معلوم.',
      },
      pinnedFingerprintStale: {
        why: snapshot.note,
        blocks: 'presentation/scripts/build-intersection-context.js — يستدعي '
          + 'البوابة نفسها، فلا يمكن إعادة توليده حتى تُصحَّح.',
        payloadIsIntact: snapshot.payloadMatchesLabCopy,
      },
      zeroBlockedIsStructural: {
        why: 'ما دام كل ضلع عند التقاطع ممنوعاً، فلا بديل يعبره أصلاً. '
          + 'فصفرُ blocked يقول إن القاعدة غير قابلة للاختبار على تمثيل '
          + 'الإغلاق الحالي، لا إن البدائل فُحصت وسلمت.',
        wouldBecomeTestableWhen: 'يصير الإغلاق على مستوى المدخل والمسار بدل '
          + 'نطاق 45 متراً حول الخط.',
      },
    },
    doesNotProve: 'أي ثانية محرَّرة. طول الدورة ونسبة الأخضر إلى الدورة غير '
      + 'موجودتين في أي مصدر متاح، وهما الكميتان اللتان يُحسب منهما ذلك. '
      + 'والمظروف المعروض نسبةٌ من دورةٍ مجهولة الطول، تحت افتراض توزيع '
      + 'متساوٍ معلن.',
    crossCheck: {
      against: 'presentation/data/intersection-context.json',
      field: 'summary.permitsWithConfirmedSignalControl',
      expected: EXPECTED_CONFIRMED,
      measured: tally.confirmed,
      matched: true,
    },
    total: portfolio.features.length,
    tally: tally,
    permits: permits,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_JS,
    `window.MASAR_SIGNAL_PHASE = ${JSON.stringify(report)};\n`, 'utf8');

  console.log(report.total + ' تصريحاً — طور الإشارة:');
  console.log('  تحكّم مؤكَّد من مصدرين: ' + tally.confirmed
    + ' (يطابق ' + EXPECTED_CONFIRMED + ' المقيسة سابقاً)');
  console.log('  مصدر واحد: ' + tally.singleSource + ' · لا مصدر: ' + tally.none
    + ' · هندسة نقطية: ' + tally.unmeasurable);
  console.log('  قاعدة الاستثناء — مرشَّح: ' + tally.eligible
    + ' · محجوب: ' + tally.blocked
    + ' · غير قابل للقياس: ' + tally.ruleUnmeasurable);
  console.log('  مسح سقف الإسناد: ' + JSON.stringify(report.method.nodeSnapSweep));
  console.log('\n' + OUT_JSON);
}

main();
