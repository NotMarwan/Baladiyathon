'use strict';
/**
 * نقل الأخضر إلى مدخل البديل — حين يمرّ البديل بالإشارة نفسها.
 * ---------------------------------------------------------------------------
 * **الخطأ الذي يصلحه هذا الملف.**
 *
 * الطور السابق (`build-signal-phase-impact.js`) سأل: هل يمرّ بديلٌ عبر التقاطع
 * نفسه؟ وسمّى الجواب `blocked` — أي تسقط التوصية، لأن إسقاط الطور يضرّ البديل.
 *
 * **والتسمية مقلوبة.** حين يمرّ البديل بالإشارة نفسها فتلك أثمن حالة لا حالة
 * تُرفض: المدخل المغلق يأخذ أخضرَ لا تستعمله مركبة، والمدخل الذي يسلكه البديل
 * يستقبل حركةً محوَّلة زائدة بأخضرٍ لم يزد. فالإجراء ليس «أسقِط الطور» بل
 * **انقل أخضر المدخل المغلق إلى مدخل البديل** — زوجٌ مسمّى من أين وإلى أين.
 *
 * **ولماذا كان الجواب صفراً، وهو مصطنَع بالكامل.**
 *
 * `edgesUnderClosure` يمنع كل ضلع ضمن `CLOSURE_NEAR_M` (45 م) من خط العمل.
 * وعند تقاطعٍ يقع على الخط تُمنع أضلاعه كلها — **بما فيها الشارع المتقاطع الذي
 * لم يغلقه التصريح أصلاً**. فقيس: **صفرٌ** من خمس عشرة عقدة لها ضلعٌ مفتوح
 * واحد، بينما تمرّ بدائل ثلاث عشرة منها ضمن أربعمئة متر من العقدة. البديل
 * يلتفّ ملاصقاً للإشارة ولا يستطيع لمسها.
 *
 * أي أن التصريح يغلق **شارعاً** والنموذج يغلق **تقاطعاً بشوارعه**.
 *
 * **والإصلاح هنا لا في المحرك.**
 *
 * تعديل `edgesUnderClosure` يحرّك كل رقم منشور: البدائل وأحمالها والدلتا وأرقام
 * العرض. فيُبنى هنا إغلاقٌ خاصٌّ بتحليل الطور يمنع ما كان **على الشارع المغلق
 * وحده** — اختباراً بالاتجاه — ويُقاس الفرق بينه وبين الإنتاج ويُكتب فاتورةً
 * لصاحب القرار. والقرار في تعديل المحرك ليس لهذا الدور.
 *
 * **وما لا يقوله هذا الملف: ثانيةً واحدة.**
 *
 * لا طول دورة ولا نسبة أخضر إلى دورة في أي مصدر متاح. فالمقدار نسبةٌ من دورةٍ
 * مجهولة الطول، وحركةٌ محوَّلة بالمركبة/الساعة. وضربُ نسبةٍ في دورةٍ مفترضة
 * يحوّل افتراضاً إلى اثنين ويُخرج رقماً يبدو قياساً.
 *
 * التشغيل: node presentation/scripts/build-signal-reallocation.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
global.window = global;

const OUT_JSON = path.join(DATA, 'signal-reallocation.json');
const OUT_JS = path.join(DATA, 'signal-reallocation.js');

/**
 * زاوية موافقة الضلع لخط العمل.
 *
 * الضلع «على الشارع المغلق» إن وافق اتجاهُه اتجاهَ خط العمل محلياً ضمن هذه
 * الزاوية — أو عاكسه ضمنها، فالشارع اتجاهان. وما عداه ضلعٌ متقاطع لم يغلقه
 * التصريح.
 *
 * والثلاثون درجة اختيار **محافظ**: كل درجة تُزاد تُبقي أضلاعاً أكثر مغلقةً،
 * فتُنقص الحالات المكتشفة لا تزيدها. والمسح منشور في المُخرَج كي يُقرأ أن
 * الرقم ليس أثر عتبة، ولم تُختَر الأوسع لأنها تعطي حالات أكثر.
 */
const THETA_DEG = 30;
const THETA_SWEEP_DEG = [20, 30, 45];

/** الساعة المرجعية نفسها في `build-alternate-load.js` و`build-signal-phase-impact.js`. */
const REFERENCE_HOUR = 8;

const METRES_PER_DEGREE = 110540;
function lonScale(lat) { return Math.cos((lat * Math.PI) / 180) * 111320 / METRES_PER_DEGREE; }

let Routing = null;

function distanceToSegment(point, a, b, scale) {
  const px = (point[0] - a[0]) * METRES_PER_DEGREE * scale;
  const py = (point[1] - a[1]) * METRES_PER_DEGREE;
  const dx = (b[0] - a[0]) * METRES_PER_DEGREE * scale;
  const dy = (b[1] - a[1]) * METRES_PER_DEGREE;
  const span = dx * dx + dy * dy;
  const t = span > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / span)) : 0;
  return Math.hypot(px - dx * t, py - dy * t);
}

/** اتجاه القطعة بالدرجات من الشمال — الاصطلاح نفسه المستعمل في الرسم. */
function bearingOf(a, b) {
  const scale = lonScale(a[1]);
  const dx = (b[0] - a[0]) * METRES_PER_DEGREE * scale;
  const dy = (b[1] - a[1]) * METRES_PER_DEGREE;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/** اتجاه خط العمل عند أقرب قطعة إلى نقطة. */
function workLineBearingNear(line, point) {
  const scale = lonScale(point[1]);
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 1; index < line.length; index += 1) {
    const distance = distanceToSegment(point, line[index - 1], line[index], scale);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = bearingOf(line[index - 1], line[index]);
    }
  }
  return best;
}

/** الفرق الاتجاهي مطويّاً على 180 — الشارع اتجاهان، فالعكس موافقةٌ لا مخالفة. */
function foldedDelta(first, second) {
  const raw = Math.abs(Routing.angleDelta(first, second));
  return Math.min(raw, 180 - raw);
}

/**
 * هل يقع الضلع على الشارع الذي أغلقه التصريح؟
 *
 * يُقاس الاتجاه عند طرفَي الضلع كليهما (`edge[7]` عند a و`edge[8]` عند b،
 * كلاهما لاتجاه a→b) — والضلع موافقٌ إن وافق **أيُّ** طرفيه. والمنطق محافظ
 * عمداً: الشكّ يُبقي الضلع مغلقاً، فلا تُفتح حالةٌ بالتساهل.
 */
function edgeOnClosedStreet(prepared, edgeIndex, line, theta) {
  const graph = prepared.graph;
  const edge = graph.edges[edgeIndex];
  const middle = [
    (graph.nodes[edge[0]][0] + graph.nodes[edge[1]][0]) / 2,
    (graph.nodes[edge[0]][1] + graph.nodes[edge[1]][1]) / 2,
  ];
  const reference = workLineBearingNear(line, middle);
  return foldedDelta(edge[7], reference) <= theta
    || foldedDelta(edge[8], reference) <= theta;
}

/**
 * إغلاقٌ يحترم ما أغلقه التصريح فعلاً.
 *
 * يبدأ من إغلاق الإنتاج ثم **يفتح** منه ما ليس على الشارع المغلق. فهو مجموعة
 * جزئية منه دائماً — لا يغلق ضلعاً لم يغلقه الإنتاج.
 */
function phaseClosure(prepared, line, production, theta) {
  const kept = {};
  Object.keys(production).forEach((key) => {
    const edgeIndex = Number(key);
    if (edgeOnClosedStreet(prepared, edgeIndex, line, theta)) kept[edgeIndex] = true;
  });
  return kept;
}

/**
 * نسخةٌ من `alternativesAround` تقبل مجموعة إغلاق مُمرَّرة.
 *
 * المحرك يحسب `banned` داخلياً ولا يقبل حقنه، وتعديله ممنوع هنا. فتُعاد الخطوات
 * نفسها بمكوّناتها المصدَّرة — وفحصٌ في الحزمة يثبت أن هذه النسخة تعطي نتيجة
 * المحرك حرفياً حين تُمرَّر مجموعةُ الإنتاج، وإلا كانت قد انحرفت عنه بصمت.
 */
function alternativesWith(prepared, line, banned, options) {
  const hour = options.hour;
  if (!Object.keys(banned).length) return { ok: false, reason: 'off-network' };

  const corridor = Routing.corridorField(prepared, line);
  const ends = Routing.solveBoundary(prepared, banned, hour, line, corridor);
  if (!ends) return { ok: false, reason: 'no-boundary' };
  if (!ends.baseline) return { ok: false, reason: 'no-baseline' };

  const window = Routing.windowFor(ends.span);
  const objectives = Routing.OBJECTIVES;
  const seeds = [objectives.fastest, objectives.local, objectives.minor,
    objectives.shortest, objectives.major];
  const candidates = [];
  seeds.forEach((seed) => {
    let ready = null;
    if (seed === objectives.local && ends.local) ready = ends.local;
    if (seed === objectives.fastest && ends.probe) ready = ends.probe;
    const route = ready || Routing.shortestPath(prepared, ends.from, ends.to,
      { hour: hour, banned: banned, objective: seed, corridor: corridor, window: window });
    if (!route) return;
    route.objective = seed.key;
    candidates.push(route);
  });
  if (!candidates.length) return { ok: false, reason: 'no-detour' };

  const kept = Routing.chooseAlternatives(prepared, candidates, options.count || 2);
  const diverted = Routing.divertedDemand(prepared, banned, hour, options.lanesClosed || 1);
  return {
    ok: true,
    from: ends.from,
    to: ends.to,
    banned: banned,
    diverted: diverted,
    alternatives: kept.map((route) => ({
      states: route.states,
      objective: route.objective,
      lengthM: route.lengthM,
      load: Routing.loadRoute(prepared, route, diverted.vehPerHour, hour),
    })),
  };
}

function streetOf(graph, edgeIndex) {
  const reference = graph.edges[edgeIndex][9];
  if (reference === undefined || reference < 0) return '';
  return (graph.names || [])[reference] || '';
}

/**
 * مدخل البديل إلى العقدة: الحالة المتجهة التي رأسُها العقدة، والحالة بعدها.
 *
 * الحالة ضلعٌ متجه لا عقدة: `2*e` عبورٌ من a إلى b و`2*e+1` عكسه. فالمدخل هو
 * الضلع الذي دخل به البديل، والمخرج ما غادر به — وبهما يُسمّى الانعطاف.
 */
function approachInto(prepared, states, node) {
  const graph = prepared.graph;
  for (let index = 0; index < states.length; index += 1) {
    if (Routing.headOf(graph, states[index]) !== node) continue;
    const arrive = states[index] >> 1;
    const leaveState = index + 1 < states.length ? states[index + 1] : null;
    const leave = leaveState === null ? null : leaveState >> 1;
    return {
      arriveEdge: arrive,
      arriveStreet: streetOf(graph, arrive),
      leaveEdge: leave,
      leaveStreet: leave === null ? '' : streetOf(graph, leave),
      isTerminal: leaveState === null,
      turnForbidden: leave === null ? false
        : !!prepared.forbidden[arrive + ':' + node + ':' + leave],
    };
  }
  return null;
}

/** أضلاع العقدة موصوفةً: على الشارع المغلق أم متقاطعة، ومفتوحة أم ممنوعة. */
function legsAt(prepared, node, line, theta, production, phase) {
  return prepared.adjacency[node].map((edgeIndex) => ({
    edge: edgeIndex,
    street: streetOf(prepared.graph, edgeIndex),
    onClosedStreet: edgeOnClosedStreet(prepared, edgeIndex, line, theta),
    closedInProduction: !!production[edgeIndex],
    closedInPhase: !!phase[edgeIndex],
  }));
}

/**
 * المظروف — نسبةٌ من دورةٍ مجهولة الطول، لا ثوانٍ.
 *
 * أدناه صفر: الخطة ثابتة ولا أحد يعدّل، وهو الوضع القائم لا فرضية. وأعلاه حصة
 * المدخل المغلق بافتراض توزيع متساوٍ على الأضلاع — وهو افتراض صريح، والواقع
 * أن الشريان يأخذ أكثر من الفرعي.
 */
function envelopeFor(legs, closedApproaches) {
  const share = legs > 0 ? Math.round((100 * closedApproaches) / legs) : null;
  return {
    lowPct: 0,
    highPct: share,
    unit: '٪ من الدورة',
    means: 'حصة ' + closedApproaches + ' من ' + legs
      + ' مدخلاً بافتراض توزيع متساوٍ على الأضلاع الملتقية.',
    assumption: 'التوزيع المتساوي افتراض لا قياس: خطط التوقيت تعطي الشريان '
      + 'أكثر من الفرعي.',
    notSeconds: 'لا تُحوَّل إلى ثوانٍ: طول الدورة غير موجود في أي مصدر متاح.',
    evidenceLevel: 'model-derived',
  };
}

/** حالة الإجراء عند تقاطع واحد. */
function classify(junction, approach) {
  if (!junction.closedApproaches) {
    return {
      state: 'no-waste',
      why: 'لا ضلع على الشارع المغلق ممنوعٌ عند التقاطع — الإغلاق ليس ملاصقاً '
        + 'لخط التوقّف. المركبات تخرج من الإشارة وتصطفّ عند العمل، فالمسألة '
        + 'تخزين طابور لا أخضرٌ مهدور.',
    };
  }
  if (approach) {
    return {
      state: 'reallocate',
      why: 'البديل المحسوب يدخل التقاطع نفسه من مدخل آخر — فالأخضر المهدور على '
        + 'المدخل المغلق يُنقل إلى المدخل الذي يستقبل الحركة المحوَّلة.',
    };
  }
  return {
    state: 'redistribute',
    why: 'لا بديل محسوب يدخل التقاطع — فطور المدخل المغلق يُسقط ويُوزَّع على '
      + 'المداخل الباقية.',
  };
}

/** يبني تقاطعاً واحداً لتصريح مؤكَّد. */
function junctionEntry(prepared, line, node, name, theta) {
  const production = Routing.edgesUnderClosure(prepared, line);
  const phase = phaseClosure(prepared, line, production, theta);
  const legs = legsAt(prepared, node, line, theta, production, phase);

  const result = alternativesWith(prepared, line, phase,
    { hour: REFERENCE_HOUR, count: 2 });
  const control = alternativesWith(prepared, line, production,
    { hour: REFERENCE_HOUR, count: 2 });

  const approach = result.ok
    ? result.alternatives.map((one) => approachInto(prepared, one.states, node))
      .filter(Boolean)[0] || null
    : null;
  const controlApproach = control.ok
    ? control.alternatives.map((one) => approachInto(prepared, one.states, node))
      .filter(Boolean)[0] || null
    : null;

  const closedApproaches = legs.filter((leg) => leg.onClosedStreet && leg.closedInPhase).length;
  const junction = {
    node: node,
    name: name,
    legs: legs.length,
    legsOnClosedStreet: legs.filter((leg) => leg.onClosedStreet).length,
    closedApproaches: closedApproaches,
    openLegsInProduction: legs.filter((leg) => !leg.closedInProduction).length,
    openLegsInPhase: legs.filter((leg) => !leg.closedInPhase).length,
    legDetail: legs,
  };

  const action = classify(junction, approach);
  return Object.assign(junction, {
    action: action.state,
    why: action.why,
    alternativesComputed: result.ok ? result.alternatives.length : 0,
    alternativeEntersJunction: !!approach,
    alternativeEntersJunctionInProduction: !!controlApproach,
    approach: approach,
    divertedVehPerHour: result.ok ? Math.round(result.diverted.vehPerHour) : null,
    envelope: closedApproaches ? envelopeFor(legs.length, closedApproaches) : null,
    recommendation: buildRecommendation(action.state, legs, approach),
  });
}

/**
 * التوصية — وزوجُ المدخلين مسمّىً.
 *
 * **بلاغٌ بلا اسمَي مدخلين لا يُنفَّذ.** من يستلمه لا يعرف أيَّ طورٍ يمسّ.
 * وأسماء الشوارع من OpenStreetMap وفيها فجوات مقيسة — فحين يغيب الاسم تُمنع
 * التوصية **بسببٍ مكتوب** لا تُترك فارغة بصمت: الاكتشاف صحيح، والإجراء وحده
 * هو المعطَّل، والفرق بينهما يقرّره من يقرأ.
 */
function buildRecommendation(state, legs, approach) {
  const from = legs.filter((leg) => leg.onClosedStreet && leg.closedInPhase && leg.street)[0];
  const blocked = (reason) => ({ action: null, fromApproach: from ? from.street : null,
    toApproach: null, label: null, blockedBy: reason });

  if (state === 'reallocate') {
    if (!from) return blocked('اسم الشارع المغلق غير مسرود في المصدر');
    if (!approach || !approach.arriveStreet) {
      return blocked('البديل يدخل التقاطع، لكن اسم مدخله غير مسرود في المصدر — '
        + 'الاكتشاف قائم والتوصية تحتاج تسمية ميدانية للمدخل');
    }
    return {
      action: 'reallocate-green',
      fromApproach: from.street,
      toApproach: approach.arriveStreet,
      blockedBy: null,
      label: 'نقل زمن الأخضر من «' + from.street + '» إلى «'
        + approach.arriveStreet + '» بالتنسيق مع إدارة المرور قبل بدء العمل',
    };
  }
  if (state === 'redistribute') {
    if (!from) return blocked('اسم الشارع المغلق غير مسرود في المصدر');
    return {
      action: 'drop-phase',
      fromApproach: from.street,
      toApproach: null,
      blockedBy: null,
      label: 'إسقاط طور «' + from.street + '» وتوزيع زمنه على المداخل الباقية، '
        + 'بالتنسيق مع إدارة المرور قبل بدء العمل',
    };
  }
  return null;
}

/** مسح الزاوية — يُنشر كي تُقرأ النتيجة غير مرهونة بعتبة مُنتقاة. */
function thetaSweep(prepared, targets) {
  const sweep = {};
  THETA_SWEEP_DEG.forEach((theta) => {
    let entering = 0;
    let openLegs = 0;
    targets.forEach((target) => {
      const production = Routing.edgesUnderClosure(prepared, target.line);
      const phase = phaseClosure(prepared, target.line, production, theta);
      const open = prepared.adjacency[target.node].filter((edge) => !phase[edge]).length;
      if (open > 0) openLegs += 1;
      const result = alternativesWith(prepared, target.line, phase,
        { hour: REFERENCE_HOUR, count: 2 });
      if (result.ok && result.alternatives
        .some((one) => approachInto(prepared, one.states, target.node))) entering += 1;
    });
    sweep[String(theta)] = { junctionsWithOpenLeg: openLegs, alternativeEntersJunction: entering };
  });
  return sweep;
}

function main() {
  require(path.join(DATA, 'riyadh-route-graph.js'));
  Routing = require(path.join(ROOT, 'masar-city-routing.js'));
  const graph = global.RIYADH_ROUTE_GRAPH;
  if (!graph) throw new Error('رسم التوجيه غير محمَّل');
  const prepared = Routing.prepare(graph);

  const detection = JSON.parse(fs.readFileSync(
    path.join(DATA, 'signal-phase-impact.json'), 'utf8'));
  const portfolio = JSON.parse(fs.readFileSync(
    path.join(DATA, 'city-portfolio.geojson'), 'utf8'));
  const geometry = new Map(portfolio.features
    .filter((one) => one.geometry && one.geometry.type === 'LineString')
    .map((one) => [one.properties.permitRef, one.geometry.coordinates]));

  const permits = {};
  const targets = [];
  Object.entries(detection.permits).forEach(([ref, entry]) => {
    if (entry.control !== 'confirmed') return;
    const line = geometry.get(ref);
    const resolved = entry.intersections.filter((one) => one.nodeStatus === 'resolved');
    if (!line || !resolved.length) {
      permits[ref] = { control: entry.control, junctions: [],
        action: 'unmeasurable',
        why: 'لم تُسنَد عقدة تقاطع في الرسم — لا هندسة تُقاس عليها الأضلاع.' };
      return;
    }
    const junctions = resolved.map((one) => junctionEntry(prepared, line, one.node,
      one.name, THETA_DEG));
    resolved.forEach((one) => targets.push({ line: line, node: one.node }));
    /* حالة التصريح أقوى حالات تقاطعاته: تقاطعٌ يستحقّ نقلاً يحكم البلاغ. */
    const order = ['reallocate', 'redistribute', 'no-waste', 'unmeasurable'];
    const governing = junctions.slice()
      .sort((a, b) => order.indexOf(a.action) - order.indexOf(b.action))[0];
    permits[ref] = {
      control: entry.control,
      action: governing.action,
      why: governing.why,
      junctions: junctions,
    };
  });

  const entries = Object.values(permits);
  const tally = {};
  ['reallocate', 'redistribute', 'no-waste', 'unmeasurable'].forEach((state) => {
    tally[state] = entries.filter((one) => one.action === state).length;
  });

  const allJunctions = entries.flatMap((one) => one.junctions);
  tally.recommendationBlockedByMissingName = allJunctions
    .filter((one) => one.recommendation && one.recommendation.blockedBy).length;
  const cost = {
    junctionsExamined: allJunctions.length,
    openLegInProduction: allJunctions.filter((one) => one.openLegsInProduction > 0).length,
    openLegInPhase: allJunctions.filter((one) => one.openLegsInPhase > 0).length,
    alternativeEntersInProduction: allJunctions
      .filter((one) => one.alternativeEntersJunctionInProduction).length,
    alternativeEntersInPhase: allJunctions.filter((one) => one.alternativeEntersJunction).length,
  };
  cost.casesHiddenByProductionClosure = cost.alternativeEntersInPhase
    - cost.alternativeEntersInProduction;

  /* بوابة صحة: تحت إغلاق الإنتاج لا عقدةَ لها ضلعٌ مفتوح — وهو العيب المقيس.
     فإن لم يعد صفراً فقد تغيّر المحرك، ولا يصحّ أن تُنسب الحالات إلى إصلاحنا. */
  if (cost.openLegInProduction !== 0) {
    throw new Error('عقدٌ لها ضلع مفتوح تحت إغلاق الإنتاج: '
      + cost.openLegInProduction + '. العيب المقيس كان صفراً — تغيّر المحرك، '
      + 'فأعد قياس الفاتورة قبل أن تُنسب الحالات إلى هذا الإصلاح.');
  }
  if (cost.openLegInPhase === 0) {
    throw new Error('إغلاق الطور لم يفتح ضلعاً واحداً — اختبار الاتجاه لم يعمل.');
  }

  const report = {
    generatedFrom: 'presentation/scripts/build-signal-reallocation.js',
    role: 'نقل زمن الأخضر من المدخل المغلق إلى مدخل البديل',
    grade: 'model-derived',
    referenceHour: REFERENCE_HOUR,
    builtOn: {
      detection: 'presentation/data/signal-phase-impact.json',
      confirmedPermits: detection.tally.confirmed,
      note: 'الكشف لا يُعاد هنا — يُقرأ من مُخرَج الطور السابق، فيبقى تعريف '
        + '«مؤكَّد» واحداً في المستودع.',
    },
    method: {
      thetaDeg: THETA_DEG,
      thetaSweepDeg: THETA_SWEEP_DEG,
      thetaSweep: thetaSweep(prepared, targets),
      onClosedStreet: 'الضلع على الشارع المغلق إن وافق اتجاهُه عند أحد طرفيه '
        + 'اتجاهَ خط العمل محلياً ضمن ' + THETA_DEG + ' درجة، مطويّاً على 180 '
        + '(فالشارع اتجاهان). وما عداه ضلعٌ متقاطع لم يغلقه التصريح.',
      phaseClosureIsSubset: 'إغلاق الطور مجموعة جزئية من إغلاق الإنتاج دائماً — '
        + 'يفتح منه ولا يغلق ضلعاً لم يغلقه.',
      conservative: 'زيادة الزاوية تُبقي أضلاعاً أكثر مغلقةً فتُنقص الحالات '
        + 'المكتشفة. فالاختيار لا يُوسَّع لالتقاط حالات.',
    },
    /* الفاتورة: ما يكلّفه `CLOSURE_NEAR_M = 45` من حالات لا يراها المنتج. */
    closureModelCost: Object.assign({
      constant: 'CLOSURE_NEAR_M = ' + Routing.CLOSURE_NEAR_M + ' م في masar-city-routing.js',
      defect: 'يمنع كل ضلع ضمن هذا النطاق من خط العمل، فيمنع عند تقاطعٍ على '
        + 'الخط أضلاعه كلها — بما فيها الشارع المتقاطع الذي لم يغلقه التصريح. '
        + 'أي أن التصريح يغلق شارعاً والنموذج يغلق تقاطعاً بشوارعه.',
      recommendation: 'يُستبدل نطاق المسافة وحده باختبار مسافة واتجاه معاً، '
        + 'كما هنا. وهذا يمسّ كل رقم منشور (البدائل وأحمالها والدلتا وأرقام '
        + 'العرض)، فقراره لصاحب المحرك — ولم يُنفَّذ في هذا الدور.',
    }, cost),
    doesNotProve: 'أي ثانية. طول الدورة ونسبة الأخضر إلى الدورة غير موجودتين '
      + 'في أي مصدر متاح. والمعروض نسبةٌ من دورةٍ مجهولة الطول تحت افتراض '
      + 'توزيع متساوٍ معلن، وحركةٌ محوَّلة مشتقّة من النموذج.',
    singleGreenNotTwo: 'في حالة النقل الأخضرُ المنقول واحد: ما يخسره المدخل '
      + 'المغلق هو عينه ما يكسبه مدخل البديل. ولا يُعرضان مكسبين.',
    total: detection.tally.confirmed,
    tally: tally,
    permits: permits,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_JS,
    `window.MASAR_SIGNAL_REALLOCATION = ${JSON.stringify(report)};\n`, 'utf8');

  console.log(report.total + ' تصريحاً مؤكَّداً — نقل الأخضر:');
  console.log('  نقل إلى مدخل البديل: ' + tally.reallocate);
  console.log('  إسقاط وتوزيع: ' + tally.redistribute);
  console.log('  لا أخضر مهدور: ' + tally['no-waste']);
  console.log('  غير قابل للقياس: ' + tally.unmeasurable);
  console.log('  فاتورة الإغلاق: عقد بضلع مفتوح ' + cost.openLegInProduction
    + ' (إنتاج) ← ' + cost.openLegInPhase + ' (طور) · بدائل تدخل التقاطع '
    + cost.alternativeEntersInProduction + ' ← ' + cost.alternativeEntersInPhase);
  console.log('  مسح الزاوية: ' + JSON.stringify(report.method.thetaSweep));
  console.log('\n' + OUT_JSON);
}

main();
