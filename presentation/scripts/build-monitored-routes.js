'use strict';
/**
 * يبني قائمة المسارات المطلوب رصدها فعلياً فوق شبكة الرياض.
 * ---------------------------------------------------------------------------
 * **ما الذي يُرصد ولماذا هذه المسارات بالذات.**
 *
 * نصّ التكليف يسمّي ستة أشياء: المسار الأساسي، والمقطع المتأثر، والبدائل،
 * ونقاط المغادرة، والشوارع الفرعية المستعملة، ونقطة العودة. وهي ليست ستّ
 * قوائم — هي بنية واحدة: البديل يبدأ من نقطة مغادرة على الأساسي، ويمرّ بشوارع
 * فرعية، ويعود إلى نقطة عودة عليه. فمن يرصد البديل بلا نقطتيه لا يستطيع أن
 * يقول أين ذهب الحمل.
 *
 * والبدائل هنا **ليست مخترعة**: تُحسب بمحرك التوجيه نفسه الذي يعرضه المنتج
 * (`athar-city-routing.js`) على الرسم الكامل. أي أن ما نرصده هو ما نوصي به —
 * ولو رصدنا مساراً آخر لقِسنا شيئاً لا يخصّ قرارنا.
 *
 * ولماذا الرصد يبدأ قبل وجود إغلاق: لأن خط الأساس لا يُبنى بأثر رجعي. ساعةُ
 * الذروة على هذا الشارع في يوليو لا تُستنتج في سبتمبر.
 *
 * التشغيل: node presentation/scripts/build-monitored-routes.js [عدد]
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(DATA, 'monitored-routes.json');

/** عدد التصاريح المرصودة افتراضياً — الأعلى أثراً أولاً. */
const DEFAULT_COUNT = 6;

/** ساعة الحساب المرجعية للبدائل — الذروة الصباحية. */
const REFERENCE_HOUR = 8;

function loadGlobal(file, name) {
  const previous = global.window;
  global.window = {};
  require(path.join(DATA, file));
  const value = global.window[name];
  global.window = previous;
  return value;
}

function bboxOf(coordinates) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  coordinates.forEach((pair) => {
    if (pair[0] < west) west = pair[0];
    if (pair[0] > east) east = pair[0];
    if (pair[1] < south) south = pair[1];
    if (pair[1] > north) north = pair[1];
  });
  return [west, south, east, north];
}

function midpoint(line) {
  return line[Math.floor(line.length / 2)];
}

function main() {
  const wanted = Number(process.argv[2]) || DEFAULT_COUNT;

  const Routing = require(path.join(ROOT, 'athar-city-routing.js'));
  const graph = loadGlobal('riyadh-route-graph.js', 'RIYADH_ROUTE_GRAPH');
  const portfolio = JSON.parse(fs.readFileSync(
    path.join(DATA, 'city-portfolio.geojson'), 'utf8'));

  const prepared = Routing.prepare(graph);
  /* الهندسة تُبنى من **الحالات** لا الأضلاع: الضلع لا يعرف جهة عبوره،
     وهندسته تُقلب بالجهة. استعمال الأضلاع يُنتج خطاً يتعرّج ذهاباً وإياباً. */
  const lineOf = (route) => Routing.pathGeometry(prepared, route.states || route.edges);

  const candidates = portfolio.features
    .filter((feature) => feature.geometry.type === 'LineString')
    .sort((a, b) => (b.properties.impactVehHours || 0) - (a.properties.impactVehHours || 0));

  const routes = [];
  const rejected = [];

  for (const feature of candidates) {
    if (routes.length >= wanted) break;
    const properties = feature.properties;
    const line = feature.geometry.coordinates;

    let result;
    try {
      result = Routing.alternativesAround(prepared, line,
        { hour: REFERENCE_HOUR, count: 2 });
    } catch (error) {
      rejected.push({ permitRef: properties.permitRef, reason: 'خطأ توجيه: ' + error.message });
      continue;
    }
    if (!result || !result.ok) {
      rejected.push({ permitRef: properties.permitRef,
        reason: 'لا بديل محسوب: ' + ((result && result.reason) || 'غير معروف') });
      continue;
    }

    const baseline = result.baseline;
    const alternatives = result.alternatives || [];
    if (!baseline || !alternatives.length) {
      rejected.push({ permitRef: properties.permitRef, reason: 'بلا خطّ أساس أو بدائل' });
      continue;
    }

    const baselineLine = lineOf(baseline);
    if (!baselineLine || baselineLine.length < 2) {
      rejected.push({ permitRef: properties.permitRef, reason: 'خطّ أساس بلا هندسة' });
      continue;
    }
    const departure = baselineLine[0];
    const rejoin = baselineLine[baselineLine.length - 1];

    const group = {
      groupId: properties.permitRef,
      street: properties.street,
      roadClass: properties.roadClass,
      /* نقطتا المغادرة والعودة تخصّان المجموعة لا مساراً بعينه: كل البدائل
         تشترك فيهما، وهما ما يجعل القياسات قابلة للطرح. */
      departurePoint: departure,
      rejoinPoint: rejoin,
      referenceHour: REFERENCE_HOUR,
      routes: [],
    };

    group.routes.push(buildRoute({
      routeId: `${properties.permitRef}-أساسي`,
      role: 'primary',
      label: 'المسار الأساسي عبر موقع العمل',
      line: baselineLine,
      minutes: baseline.minutes,
      lengthM: baseline.lengthM,
    }));

    group.routes.push(buildRoute({
      routeId: `${properties.permitRef}-مقطع-العمل`,
      role: 'work-segment',
      label: 'المقطع المتأثر — هندسة التصريح',
      line,
      minutes: null,
      lengthM: null,
    }));

    alternatives.forEach((alternative, index) => {
      group.routes.push(buildRoute({
        routeId: `${properties.permitRef}-بديل-${index + 1}`,
        role: 'alternate',
        label: alternative.label || `بديل ${index + 1}`,
        line: lineOf(alternative),
        minutes: alternative.minutes,
        lengthM: alternative.lengthM,
        /* «نصيب شوارع الأحياء» يقول إن كان البديل يمرّ داخل حيّ سكني. وهو
           سبب رصده منفصلاً: تحويلُ حمل شريان إلى شوارع فرعية هو الأثر الذي
           لا يظهر في زمن الرحلة. */
        neighbourhoodShare: alternative.neighbourhoodShare,
        excursionM: alternative.excursionM,
      }));
    });

    routes.push(group);
  }

  const payload = {
    generatedFrom: 'presentation/scripts/build-monitored-routes.js',
    note: 'المسارات محسوبة بمحرك التوجيه نفسه الذي يعرضه المنتج، على الرسم '
      + 'الكامل (شرايين + شوارع أحياء). هذه قائمة **ما يجب رصده**، وليست '
      + 'قياسات. لا رقم حركة واحد هنا.',
    referenceHour: REFERENCE_HOUR,
    groups: routes,
    rejected,
    counts: {
      groups: routes.length,
      routes: routes.reduce((sum, group) => sum + group.routes.length, 0),
      rejected: rejected.length,
    },
  };

  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`${payload.counts.groups} مجموعة · ${payload.counts.routes} مسار `
    + `· ${payload.counts.rejected} مرفوض`);
  routes.forEach((group) => {
    console.log(`  ${group.groupId} — ${group.street}: ${group.routes.length} مسار`);
  });
  console.log(OUT);
}

function buildRoute(input) {
  const line = input.line || [];
  return {
    routeId: input.routeId,
    role: input.role,
    label: input.label,
    geometry: { type: 'LineString', coordinates: line },
    bbox: line.length ? bboxOf(line) : null,
    origin: line.length ? line[0] : null,
    destination: line.length ? line[line.length - 1] : null,
    /* نقطة الاستعلام لمزوّد يستعلم بنقطة (TomTom) — منتصف المسار لا طرفه:
       الطرف يقع على تقاطع فيُعيد المزوّد مقطعاً غير المقصود. */
    probePoint: line.length ? midpoint(line) : null,
    modelMinutes: input.minutes === undefined ? null : input.minutes,
    modelLengthM: input.lengthM === undefined ? null : input.lengthM,
    neighbourhoodShare: input.neighbourhoodShare === undefined
      ? null : input.neighbourhoodShare,
    excursionM: input.excursionM === undefined ? null : input.excursionM,
    /* الحقلان أعلاه من النموذج لا من قياس. التسمية `model*` مقصودة كي لا
       يُقرأ زمنٌ محسوب زمناً مرصوداً حين يجاوره في الجدول نفسه. */
    measurementStatus: 'لم يُرصد بعد — لا مفاتيح مزوّدين',
  };
}

main();
