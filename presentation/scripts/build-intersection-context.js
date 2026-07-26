'use strict';
/**
 * كثافة التقاطعات على مسارات أثر — مؤشر سياق معلَن، لا معامل.
 * ---------------------------------------------------------------------------
 * **السؤال الذي جاء من التحكيم.**
 *
 * سعة الشريان الحضري محكومة بالإشارة لا بالمقطع. ونموذج الحمل في أثر
 * (`edgeLoad` داخل `athar-city-routing.js`) يحسب السعة `عدد الحارات × سعة صنف
 * الطريق` — 1900 مركبة/ساعة/حارة للشريان الرئيسي — **بلا حدّ للأخضر إلى
 * الدورة**. أي أن نسبة الحجم إلى السعة على البديل تُحسب بسعة مقطع، والمقطع
 * ليس ما يقيّد شارعاً بإشارات.
 *
 * فهل تغلق مجموعة تقاطعات الهيئة الملكية هذه الفجوة؟
 *
 * **الجواب: لا. وهذا هو الناتج.**
 *
 * المجموعة تحمل مواقع تقاطعات ولا تحمل نوع تحكّم ولا توقيت إشارة. ونسبة
 * الأخضر إلى الدورة لا تُستنتج من موقع — ومن اخترعها حوّل لقطة مواقع إلى
 * معامل، وهو بالضبط ما يمنعه هذا المستودع. فأقصى ما يُستخرج **مؤشر سياق**:
 * كم تقاطعاً معلوماً على هذا المسار، وكم منها تسمّيه OpenStreetMap محكوماً
 * بإشارة. ويُعرض ليقول أين النموذج خارج نطاقه، لا ليصحّح رقمه.
 *
 * **ولماذا يفيد مؤشر لا يصحّح شيئاً.**
 *
 * لأنه يحدّد **اتجاه الخطأ**. سعة المقطع أعلى من سعة الشريان المحكوم بإشارة
 * (السعة الفعلية = تدفق التشبّع × نسبة الأخضر إلى الدورة، والنسبة أقلّ من
 * واحد دائماً). فحيث يوجد تحكّم بإشارة على المقطع الحاكم، تكون السعة
 * المستعملة **متفائلة**، ويكون حكم «لا يتحمّل» **حدّاً أدنى لا مبالغة**.
 * وهذا شرطيّ لا مثبت: المصدر لا يقول أيّ التقاطعات مفصولة منسوباً بجسر أو
 * نفق، وطريق الملك فهد مليء بالفصل المنسوب. فيُكتب شرطاً ويُطلب ما ينقص.
 *
 * **مصدران مستقلان لا واحد.**
 *
 * الهيئة الملكية تقول «هنا تقاطع»، وOpenStreetMap تقول «هنا إشارة». تطابقهما
 * أقوى من أيٍّ منهما وحده، واختلافهما معلوم المقدار ومكتوب. ولا أحد منهما
 * يقيس مروراً.
 *
 * التشغيل: node presentation/scripts/build-intersection-context.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
global.window = global;

const OUT_JSON = path.join(DATA, 'intersection-context.json');

/** التقاطع «على المسار» إن مرّ ضمن هذه المسافة من خطّه. */
const ON_ROUTE_M = 50;
/** وضمن هذه المسافة يُحسب «قريباً» — قد يكون على شارع متقاطع. */
const NEAR_ROUTE_M = 100;
/**
 * الإشارة عقدةٌ على الطريق نفسه في OSM، فمسافتها من محور الخط قريبة من الصفر.
 * الثلاثون متراً هامشٌ لعرض المقطع وانحراف الرقمنة، لا نطاق بحث.
 */
const SIGNAL_ON_ROUTE_M = 30;
/**
 * تقاطع الهيئة الملكية نقطة مركز، وإشارة OSM عند خط التوقّف على أحد المداخل.
 * فالمسافة بينهما على تقاطع شرياني كبير عشرات الأمتار. والعتبة معلَنة، ومعها
 * حسّاسيتها عند 50 و100 كي لا يُقرأ الرقم مُنتقىً.
 */
const CORROBORATION_M = 75;
const CORROBORATION_SWEEP_M = [50, 75, 100];

const METRES_PER_DEGREE = 110540;
function lonScale(lat) { return Math.cos((lat * Math.PI) / 180) * 111320 / METRES_PER_DEGREE; }

/** أقرب مسافة من نقطة إلى قطعة، بالمتر — الإسقاط نفسه المستعمل في محرك المدينة. */
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
  const dx = (a[0] - b[0]) * METRES_PER_DEGREE * scale;
  const dy = (a[1] - b[1]) * METRES_PER_DEGREE;
  return Math.hypot(dx, dy);
}

/** طول خطّ بالمتر — لا يُقرأ من حقل قد يكون مقرَّباً. */
function lineLengthM(coordinates) {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += metresBetween(coordinates[index - 1], coordinates[index]);
  }
  return total;
}

function bbox(coordinates) {
  let west = Infinity; let east = -Infinity; let south = Infinity; let north = -Infinity;
  coordinates.forEach(([lon, lat]) => {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  });
  return { west, east, south, north };
}

/** تصفية أولية بمستطيل موسَّع — تُسقط 631 نقطة إلى عشرات قبل الحساب الدقيق. */
function withinBox(points, box, marginM) {
  const latMargin = marginM / METRES_PER_DEGREE;
  const lonMargin = latMargin / Math.max(0.1, lonScale((box.south + box.north) / 2));
  return points.filter((point) => point.lon >= box.west - lonMargin
    && point.lon <= box.east + lonMargin
    && point.lat >= box.south - latMargin
    && point.lat <= box.north + latMargin);
}

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** مؤشر السياق لخطٍّ واحد. */
function contextFor(coordinates, intersections, signals) {
  const box = bbox(coordinates);
  const lengthM = lineLengthM(coordinates);
  const km = lengthM / 1000;

  const nearIntersections = withinBox(intersections, box, NEAR_ROUTE_M)
    .map((row) => ({ row, distanceM: distanceToLine([row.lon, row.lat], coordinates) }))
    .filter((entry) => entry.distanceM <= NEAR_ROUTE_M)
    .sort((left, right) => left.distanceM - right.distanceM);

  const onRoute = nearIntersections.filter((entry) => entry.distanceM <= ON_ROUTE_M);

  /* المسح على كل الإشارات لا على المستطيل: المطلوب أقرب إشارة أيضاً، وقد تكون
     خارج المستطيل بكيلومترين — وهذا بذاته نتيجة. */
  const signalDistances = signals
    .map((row) => ({ row, distanceM: distanceToLine([row.lon, row.lat], coordinates) }))
    .sort((left, right) => left.distanceM - right.distanceM);
  const nearSignals = signalDistances.filter((entry) => entry.distanceM <= SIGNAL_ON_ROUTE_M);
  const nearestSignalM = signalDistances.length ? signalDistances[0].distanceM : Infinity;

  /* التطابق: تقاطعٌ مسرود على المسار وإشارة OSM قريبة منه. الاثنان مستقلان،
     فتطابقهما هو ما يرفع «تقاطع مسرود» إلى «تقاطع محكوم بإشارة». */
  const sweep = {};
  CORROBORATION_SWEEP_M.forEach((threshold) => {
    sweep[String(threshold)] = onRoute.filter((entry) => nearSignals
      .some((signal) => metresBetween([entry.row.lon, entry.row.lat],
        [signal.row.lon, signal.row.lat]) <= threshold)).length;
  });

  return {
    lengthM: Math.round(lengthM),
    listedIntersectionsOnRoute: onRoute.length,
    listedIntersectionsNearRoute: nearIntersections.length,
    listedIntersectionsPerKm: km > 0 ? roundTo(onRoute.length / km, 2) : null,
    nearestListedIntersectionM: nearIntersections.length
      ? Math.round(nearIntersections[0].distanceM) : null,
    nearestListedIntersection: nearIntersections.length
      ? nearIntersections[0].row.nameAr : null,
    osmSignalsOnRoute: nearSignals.length,
    osmSignalsPerKm: km > 0 ? roundTo(nearSignals.length / km, 2) : null,
    nearestOsmSignalM: nearestSignalM === Infinity ? null : Math.round(nearestSignalM),
    corroboratedSignalControlled: sweep[String(CORROBORATION_M)],
    corroborationSweep: sweep,
    /* تصنيف ثلاثيّ صريح، وأهمّ ما فيه الحالة الوسطى: «مسرود بلا تأكيد» ليست
       «بلا إشارة». طبقة OSM ناقصة التغطية بمقدار مقيس (انظر `sourceAgreement`)،
       فغياب عقدة إشارة لا يُقرأ نفياً. */
    controlStatus: sweep[String(CORROBORATION_M)] > 0
      ? 'تحكّم بإشارة مؤكَّد من المصدرين'
      : (onRoute.length > 0 ? 'تقاطع مسرود بلا تأكيد تحكّم'
        : 'لا مصدر يذكر تقاطعاً على هذا المسار'),
    absenceIsNotEvidence: sweep[String(CORROBORATION_M)] === 0,
  };
}

/**
 * تطابق المصدرين على مستوى المدينة — وهو النتيجة الحاسمة في هذا الملف.
 *
 * السؤال: هل يمكن أن يُقال «هذا الممر محكوم بإشارات» من هذين المصدرين؟
 * والجواب يخرج من عدد واحد: كم من تقاطعات الهيئة الملكية تحمل عقدة إشارة في
 * OpenStreetMap. والمسح على عتبات متعددة كي يُعرف أن النتيجة ليست أثر عتبة.
 */
function sourceAgreement(intersections, signals, box) {
  const inside = intersections.filter((row) => row.lat >= box.south && row.lat <= box.north
    && row.lon >= box.west && row.lon <= box.east);
  const sweep = [50, 75, 100, 150, 250].map((threshold) => {
    const listedWithSignal = inside.filter((row) => signals
      .some((signal) => metresBetween([row.lon, row.lat], [signal.lon, signal.lat]) <= threshold)).length;
    const signalsAtListed = signals.filter((signal) => inside
      .some((row) => metresBetween([row.lon, row.lat], [signal.lon, signal.lat]) <= threshold)).length;
    return {
      thresholdM: threshold,
      listedIntersectionsWithOsmSignal: listedWithSignal,
      listedIntersectionsWithOsmSignalPct: Math.round((listedWithSignal / inside.length) * 100),
      osmSignalsAtListedIntersection: signalsAtListed,
      osmSignalsAtListedIntersectionPct: Math.round((signalsAtListed / signals.length) * 100),
    };
  });
  return {
    listedIntersectionsTotal: intersections.length,
    listedIntersectionsInsideOsmBox: inside.length,
    osmSignalNodes: signals.length,
    sweep: sweep,
    finding: 'التطابق غير متماثل: أغلب عقد إشارات OpenStreetMap تقع على تقاطع '
      + 'مسرود عند الهيئة الملكية، وخُمس تقاطعات الهيئة الملكية وحده يحمل عقدة '
      + 'إشارة. والنسبتان تستويان بعد 75 متراً، فالنتيجة ليست أثر عتبة.',
    interpretation: 'أحد أمرين، ولا يفصل بينهما أي من المصدرين: إمّا أن طبقة '
      + 'OpenStreetMap ناقصة التغطية للإشارات في الرياض، وإمّا أن أربعة أخماس '
      + 'التقاطعات المسرودة غير محكومة بإشارة فعلاً (فصل منسوب أو أفضلية). '
      + 'وما دام الأمران ممكنين، **فغياب عقدة إشارة ليس دليل غياب إشارة**.',
    consequence: 'لا يُشتقّ من هذين المصدرين مؤشر «كثافة إشارات على الممر» '
      + 'قابل للاعتماد، ولا يُقيَّد به سعة، ولا يُرفع به مستوى ثقة. المستخرج '
      + 'الوحيد الصالح: قائمة تقاطعات مؤكَّدة من مصدرين (وهي أرضية لا حصر)، '
      + 'وطلب بيانات محدَّد.',
  };
}

function loadSignals() {
  require(path.join(DATA, 'riyadh-traffic-control.js'));
  const layer = global.window.RIYADH_TRAFFIC_CONTROL;
  if (!layer || !Array.isArray(layer.points)) {
    throw new Error('طبقة التحكّم المروري غير محمَّلة');
  }
  /* الترميز في الطبقة: 0 توقّف · 1 دوران صغير · 2 إشارة ضوئية — وتحقَّق من
     عدّ الطبقة نفسها كي لا ينقلب المعنى بصمت إن تغيّر المولِّد. */
  const signals = layer.points.filter((point) => point[2] === 2)
    .map((point) => ({ lon: point[0], lat: point[1] }));
  const declared = (layer.metadata && layer.metadata.counts
    && layer.metadata.counts.traffic_signals) || 0;
  if (signals.length !== declared) {
    throw new Error('عدد الإشارات (' + signals.length + ') لا يطابق ما تعلنه '
      + 'الطبقة (' + declared + ') — راجع ترميز المستويات قبل الاعتماد عليه.');
  }
  return { signals, source: layer.metadata.source, bbox: layer.metadata.bbox };
}

function main() {
  /* البصمة تُفحص قبل أي حساب: مؤشرٌ مبنيّ على لقطة تغيّرت بلا علم لا يُصلح
     شيئاً. والفحص بلا شبكة. */
  execFileSync(process.execPath,
    [path.join(__dirname, 'pin-rcrc-intersections.js'), '--check'],
    { stdio: 'pipe' });

  const pinned = JSON.parse(fs.readFileSync(path.join(DATA, 'rcrc-intersections.json'), 'utf8'));
  const intersections = pinned.intersections.map((row) => ({
    code: row.intersectionCode,
    nameAr: row.nameAr,
    lon: row.longitude,
    lat: row.latitude,
  }));

  const control = loadSignals();
  const routes = JSON.parse(fs.readFileSync(path.join(DATA, 'monitored-routes.json'), 'utf8'));
  const portfolio = JSON.parse(fs.readFileSync(path.join(DATA, 'city-portfolio.geojson'), 'utf8'));
  const load = JSON.parse(fs.readFileSync(path.join(DATA, 'alternate-load.json'), 'utf8'));

  /* ---- مقاطع العمل: كل المحفظة ---- */
  const agreement = sourceAgreement(intersections, control.signals, control.bbox);

  const permits = {};
  const permitTally = { withGeometry: 0, pointGeometry: 0, withListedIntersection: 0,
    withOsmSignal: 0, withConfirmedControl: 0 };
  portfolio.features.forEach((feature) => {
    const ref = feature.properties.permitRef;
    if (!feature.geometry || feature.geometry.type !== 'LineString') {
      permits[ref] = { computed: false, reason: 'هندسة نقطية — لا خطّ يُقاس عليه' };
      permitTally.pointGeometry += 1;
      return;
    }
    const context = contextFor(feature.geometry.coordinates, intersections, control.signals);
    permits[ref] = Object.assign({ computed: true }, context);
    permitTally.withGeometry += 1;
    if (context.listedIntersectionsOnRoute > 0) permitTally.withListedIntersection += 1;
    if (context.osmSignalsOnRoute > 0) permitTally.withOsmSignal += 1;
    if (context.corroboratedSignalControlled > 0) permitTally.withConfirmedControl += 1;
  });

  /* ---- المسارات المرصودة: مقطع العمل والبدائل ---- */
  const monitored = routes.groups.map((group) => ({
    groupId: group.groupId,
    street: group.street,
    roadClass: group.roadClass,
    alternateVerdict: (load.permits[group.groupId] || {}).verdict
      ? load.permits[group.groupId].verdict.label : null,
    alternateRatioAfter: (load.permits[group.groupId] || {}).ratioAfter || null,
    routes: group.routes.map((route) => Object.assign({
      routeId: route.routeId,
      role: route.role,
      label: route.label,
    }, contextFor(route.geometry.coordinates, intersections, control.signals))),
  }));

  const alternates = monitored.flatMap((group) => group.routes
    .filter((route) => route.role === 'alternate'));

  const report = {
    generatedFrom: 'presentation/scripts/build-intersection-context.js',
    role: 'مؤشر سياق',
    /* لا درجة من سُلَّم الدليل: السُّلَّم يصنّف دليلاً على معامل، وهذا ليس
       دليلاً على معامل. إسناد درجة له يجعله يبدو مُعايراً وهو ليس كذلك. */
    ladderGrade: null,
    ladderGradeWhyNull: 'سُلَّم الدليل يصنّف ما يُعاير معاملاً أو يضيّق نطاقاً. '
      + 'هذا المؤشر لا يفعل أيّاً منهما — يقول أين نموذج السعة خارج نطاقه.',
    isEvidenceForParameter: false,
    calibratesAnyParameter: false,
    sources: [
      {
        what: 'مواقع التقاطعات',
        publisher: 'الهيئة الملكية لمدينة الرياض',
        recordCount: pinned.intersections.length,
        sha256: pinned._provenance.sha256,
        accessedOn: pinned._provenance.accessedOn,
        absent: pinned._provenance.fieldsAbsent,
      },
      {
        what: 'عقد التحكّم المروري',
        publisher: control.source,
        signalNodes: control.signals.length,
        absent: ['طول الدورة', 'نسبة الأخضر إلى الدورة', 'التنسيق بين الإشارات',
          'الفصل المنسوب'],
      },
    ],
    method: {
      onRouteM: ON_ROUTE_M,
      nearRouteM: NEAR_ROUTE_M,
      signalOnRouteM: SIGNAL_ON_ROUTE_M,
      corroborationM: CORROBORATION_M,
      corroborationSweepM: CORROBORATION_SWEEP_M,
      distance: 'أقرب مسافة إسقاطية من نقطة إلى خطّ المسار، بالمتر',
      note: 'نقطةٌ قريبة من مسار نمذجيّ تسند تخطيط القياس. ولا تتحقّق من اتجاه '
        + 'ولا طوبولوجيا ولا سرعة ولا حجم ولا أثر.',
    },
    capacityModelInProduct: {
      where: 'athar-city-routing.js — edgeLoad',
      formula: 'السعة = عدد الحارات × سعة صنف الطريق (1900 مركبة/ساعة/حارة للشريان الرئيسي)',
      missingTerm: 'نسبة الأخضر إلى الدورة (g/C)',
      consequence: 'حيث يقيّد تقاطعٌ محكوم بإشارة المقطعَ الحاكم، تكون السعة '
        + 'المستعملة أعلى من الفعلية، فتكون نسبة الحجم إلى السعة أقلّ من '
        + 'الفعلية، ويكون حكم «لا يتحمّل» حدّاً أدنى.',
      conditional: 'وهذا شرطيّ لا مثبت: المصدر لا يذكر نوع التحكّم ولا الفصل '
        + 'المنسوب. تقاطعٌ مفصول بجسر لا يقيّد المقطع، وطريق الملك فهد فيه فصل '
        + 'منسوب. فلا يُقلب أي حكم بناءً على هذا المؤشر.',
      whatWouldCloseIt: ['نوع التحكّم لكل تقاطع', 'طول الدورة',
        'نسبة الأخضر إلى الدورة لكل مدخل', 'الفصل المنسوب (جسر/نفق)'],
    },
    scope: {
      permitsInPortfolio: portfolio.features.length,
      permitsMeasured: permitTally.withGeometry,
      permitsPointGeometry: permitTally.pointGeometry,
      monitoredGroups: monitored.length,
      monitoredRoutes: monitored.reduce((sum, group) => sum + group.routes.length, 0),
      limit: 'البدائل تُقاس على المسارات المرصودة وحدها — ' + alternates.length
        + ' بديلاً على ' + monitored.length + ' مجموعة. باقي المحفظة يُقاس '
        + 'مقطعُ عمله لا بدائله، لأن هندسة البدائل غير مخزَّنة.',
    },
    sourceAgreement: agreement,
    verdict: {
      question: 'هل تُقيَّد السعة الفعلية أو تُرفع درجة الثقة بكثافة التقاطعات؟',
      answer: 'لا.',
      why: 'المصدر الرسمي يحمل مواقع لا نوع تحكّم ولا توقيت إشارة، والمصدر '
        + 'المجتمعي يخالفه في أربعة أخماس التقاطعات باتجاه غير معلوم السبب. '
        + 'ونسبة الأخضر إلى الدورة — وهي الكمية الوحيدة التي تقيّد سعة شريان '
        + 'بإشارات — غير موجودة في أيٍّ منهما.',
      whatIsUsableToday: ['تصميم مواقع القياس الميداني على تقاطع معلوم إحداثيّه',
        'تحقّق هندسي من أن المقطع المنمذَج يقع على الشارع المقصود',
        'قائمة تقاطعات مؤكَّدة من مصدرين — أرضية لا حصر'],
      whatIsNotUsable: ['تقييد سعة', 'رفع درجة ثقة', 'كثافة إشارات على ممر',
        'قراءة غياب عقدة إشارة نفياً للإشارة'],
    },
    summary: {
      permitsWithListedIntersectionOnWorkSegment: permitTally.withListedIntersection,
      permitsWithOsmSignalOnWorkSegment: permitTally.withOsmSignal,
      permitsWithConfirmedSignalControl: permitTally.withConfirmedControl,
      alternatesMeasured: alternates.length,
      alternatesWithOsmSignal: alternates.filter((route) => route.osmSignalsOnRoute > 0).length,
      alternatesWithConfirmedSignalControl: alternates
        .filter((route) => route.corroboratedSignalControlled > 0).length,
      /* أقرب إشارة إلى بديلٍ مّا: العدد الذي يقول إن الطبقة ناقصة لا إن الشارع
         خالٍ — أبعد قيمة فيه بالكيلومترات على شرايين شرق الرياض. */
      farthestNearestSignalOnAlternateM: alternates.reduce((max, route) => Math
        .max(max, route.nearestOsmSignalM || 0), 0),
    },
    doesNotProve: 'أي رقم مروري. المصدران يقولان «هنا تقاطع» و«هنا إشارة»، '
      + 'ولا يقول أيّ منهما حجماً ولا سرعة ولا تأخيراً ولا سعة. ولا يجوز أن '
      + 'يُشتقّ من عددٍ هنا معاملٌ في المحرك.',
    monitored: monitored,
    permits: permits,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('مؤشر سياق التقاطعات:');
  console.log('  محفظة: ' + report.scope.permitsMeasured + ' مقطع عمل مقيس · '
    + report.scope.permitsPointGeometry + ' هندسة نقطية');
  console.log('  تصاريح على مقطعها تقاطع مسرود: '
    + report.summary.permitsWithListedIntersectionOnWorkSegment);
  console.log('  تصاريح على مقطعها إشارة OSM: '
    + report.summary.permitsWithOsmSignalOnWorkSegment);
  console.log('  تصاريح بتحكّم إشارة مؤكَّد من مصدرين: '
    + report.summary.permitsWithConfirmedSignalControl);
  console.log('  بدائل مقيسة: ' + report.summary.alternatesMeasured
    + ' · منها بإشارة على المسار: ' + report.summary.alternatesWithOsmSignal
    + ' · بتحكّم مؤكَّد: ' + report.summary.alternatesWithConfirmedSignalControl);
  console.log('  أبعد «أقرب إشارة» على بديل: '
    + report.summary.farthestNearestSignalOnAlternateM + ' م');
  const at75 = report.sourceAgreement.sweep.find((row) => row.thresholdM === 75);
  console.log('  تطابق المصدرين عند 75 م: '
    + at75.listedIntersectionsWithOsmSignalPct + '٪ من تقاطعات الهيئة الملكية تحمل إشارة OSM · '
    + at75.osmSignalsAtListedIntersectionPct + '٪ من إشارات OSM على تقاطع مسرود');
  console.log('\n' + OUT_JSON);
}

main();
