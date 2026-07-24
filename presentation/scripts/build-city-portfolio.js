'use strict';
/**
 * أثر — إنزال محفظة التصاريح على شبكة الطرق الحقيقية.
 * ---------------------------------------------------------------------------
 * المشكلة التي يحلها: المحفظة (athar-portfolio.js) أرقام بلا مكان — أسماء
 * وهمية مثل «شرياني أ». والخريطة مكان بلا أرقام — ستة عشر سجلاً. الدمج هو ما
 * يجعل الشغل الحقيقي يبان: كل تصريح على مقطع من محور شارع رياض مسمّى، وأثره
 * من المحرك نفسه الذي تستعمله لوحة أثر المدينة.
 *
 * 1) البذرة نفسها في athar-portfolio: الناتج قابل لإعادة الإنتاج حرفياً.
 * 2) كل مقطع يُقتطع من محور متصل — لا خطوط تقطع الأحياء.
 * 3) الأثر من AtharEngine.score لا من رقم مزروع.
 * 4) الحالات من athar-desk-states إن وُجد، وإلا من القائمة المحلية المطابقة.
 *
 * يُشغَّل مرة واحدة محلياً. لا شبكة.
 * بيانات الطرق © مساهمو OpenStreetMap — رخصة ODbL.
 */
const fs = require('fs');
const path = require('path');

const Engine = require('../athar-engine.js');
const Portfolio = require('../athar-portfolio.js');
const { longestChain, section, lengthOf } = require('./lib/centreline.js');

const ROOT = path.join(__dirname, '..');
const roads = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'riyadh-roads.geojson'), 'utf8'));

const PROMOTERS = [
  'شركة المياه الوطنية', 'الشركة السعودية للكهرباء', 'أمانة منطقة الرياض',
  'شركة الاتصالات السعودية', 'هيئة تطوير مدينة الرياض', 'الشركة السعودية للغاز',
];
const CONTRACTORS = [
  'مقاولات الخليج', 'البنية المتقدمة', 'الراجحي للإنشاء',
  'مجموعة الفهد الهندسية', 'دار التنفيذ',
];
const SUBTYPES = ['emergency', 'development', 'maintenance', 'default'];

/* التوزيع مقصود لا عشوائي: أعمال الطرق هي الغالب، ولكل مجموعة تمثيل. */
const GROUPS = [
  'roadworks', 'roadworks', 'roadworks', 'roadworks', 'roadworks',
  'closures', 'closures', 'diversions', 'incidents', 'pois',
];

/* التوزيع منحاز إلى ما ينتظر قراراً: صندوق الأعمال يجب أن يفتح على عمل. */
const STATUSES = [
  'ImpactScreening', 'ImpactScreening', 'ImpactScreening', 'ImpactScreening',
  'StrategyReview', 'StrategyReview', 'StrategyReview',
  'CoordinationRequired', 'CoordinationRequired',
  'CompletenessReview',
  'Approved', 'Scheduled', 'Deployed', 'Completed',
];

const NEXT_ACTION = {
  CompletenessReview: 'أكمل البيانات الناقصة',
  ImpactScreening: 'افحص الأثر',
  CoordinationRequired: 'نسّق مع الجهة المتعارضة',
  StrategyReview: 'اعتمد أو أرجع',
  Approved: 'ثبّت الجدول',
  Scheduled: 'انشر الإغلاق',
  Deployed: 'راقب القياس',
  Completed: 'افحص إعادة الطريق',
};

const SENSITIVITY = ['normal', 'normal', 'normal', 'normal', 'hospital', 'school', 'transit'];

const CLASS_BY_HIGHWAY = {
  motorway: 'arterial', trunk: 'arterial', primary: 'arterial',
  secondary: 'major', tertiary: 'local',
};

/**
 * حدود التصعيد — من بوابات «strategic-decisions.md».
 * فوق هذه الحدود يخرج الفحص السريع عن نطاقه المعلن: BPR يتضخم عندما يتجاوز
 * الطلب السعة لفترة طويلة، فالرقم يصير مؤشر خطورة لا تقديراً. نعرضه بوصفه
 * إحالة إلى محاكاة متخصصة بدل تقديمه رقماً دقيقاً.
 */
const ESCALATE_DELAY_PCT = 150;
const ESCALATE_DURATION_HOURS = 72;

function escalationReason(delayPct, lanes, lanesClosed, durationHours) {
  if (delayPct > ESCALATE_DELAY_PCT) return 'التأخير يتجاوز نطاق الفحص السريع المعلن';
  if (lanesClosed / lanes >= 0.5 && durationHours > ESCALATE_DURATION_HOURS) {
    return 'إغلاق نصف المسارات أو أكثر لمدة طويلة';
  }
  return null;
}

const ARABIC = /[؀-ۿ]/;

/** تحويل تقريبي كافٍ داخل مدينة واحدة: درجة ≈ ١١١ كم. */
const KM_PER_DEGREE = 111;

/**
 * محاور الشوارع المسمّاة بالعربية، مرتّبة أبجدياً كي لا يتغيّر الترتيب بين
 * التشغيلات. الأسماء اللاتينية في OSM تُستبعد: واجهة عربية بأسماء إنجليزية
 * تقرأ كبيانات مستوردة على عجل.
 */
function namedCorridors() {
  const byName = new Map();

  roads.features.forEach((feature) => {
    const properties = feature.properties || {};
    if (!properties.name || !ARABIC.test(properties.name)) return;
    if (feature.geometry.type !== 'LineString') return;
    if (!byName.has(properties.name)) {
      byName.set(properties.name, {
        name: properties.name,
        highway: properties.highway,
        aadt: properties.aadt,
        parts: [],
      });
    }
    byName.get(properties.name).parts.push(feature.geometry.coordinates);
  });

  return Array.from(byName.values())
    .map((road) => ({
      name: road.name,
      highway: road.highway,
      roadClass: CLASS_BY_HIGHWAY[road.highway] || 'local',
      aadt: road.aadt,
      chain: longestChain(road.parts),
    }))
    .filter((road) => road.chain.length >= 2 && lengthOf(road.chain) > 0.009)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

/**
 * توزيع التصاريح على أصناف الطرق بحصص معلنة.
 * الأخذ بالترتيب الأبجدي وحده يضع المحفظة كلها على أول ١٥٠ اسماً — كلها شوارع
 * فرعية تبدأ بألف — فلا تلمس شرياناً واحداً يعرفه القارئ، ويفشل البحث عن
 * «طريق الملك فهد». الخطوة المنتظمة داخل كل صنف تنشر التصاريح على المدينة
 * كلها بدل تكديسها في زاوية من المعجم.
 */
var CLASS_SHARE = [
  { roadClass: 'arterial', share: 0.40 },
  { roadClass: 'major', share: 0.34 },
  { roadClass: 'local', share: 0.26 },
];

function allocateCorridors(corridors, count) {
  var picked = [];

  CLASS_SHARE.forEach(function (slice) {
    var pool = corridors.filter(function (road) { return road.roadClass === slice.roadClass; });
    if (!pool.length) return;
    var want = Math.round(count * slice.share);
    for (var i = 0; i < want; i += 1) {
      picked.push(pool[Math.floor((i * pool.length) / want) % pool.length]);
    }
  });

  // تكملة أي نقص من الدوران على كل المحاور — لا تصريح بلا مكان.
  for (var j = 0; picked.length < count; j += 1) picked.push(corridors[j % corridors.length]);
  return picked.slice(0, count);
}

/** النسبة المئوية للتأخير: مرجّحة بالطلب على ساعات العمل كلها. */
function delayPercent(scored) {
  let base = 0;
  let closed = 0;
  (scored.hourly || []).forEach((hour) => {
    base += hour.demand * hour.baseT;
    closed += hour.demand * hour.closedT;
  });
  if (base <= 0) return 0;
  return ((closed - base) / base) * 100;
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}

/**
 * نافذة العرض تتمركز على أيام التحكيم (٢٧–٢٨ يوليو ٢٠٢٦): البدايات موزّعة
 * على ثلاثة أسابيع قبلها، فيقع عدد معتبر من الأعمال داخل مرشح «اليوم».
 */
const WINDOW_BASE = Date.UTC(2026, 6, 8);
const WINDOW_SPREAD_DAYS = 26;

function isoAt(dayOffset, hour) {
  return new Date(WINDOW_BASE + dayOffset * 86400000 + hour * 3600000).toISOString();
}

function build() {
  const permits = Portfolio.buildPermits();
  const corridors = namedCorridors();
  if (!corridors.length) throw new Error('لا محاور مسمّاة صالحة — تحقق من riyadh-roads.geojson');

  const rand = Portfolio.mulberry32(Portfolio.SEED);
  const assigned = allocateCorridors(corridors, permits.length);
  const features = [];

  permits.forEach((permit, index) => {
    const corridor = assigned[index];

    /**
     * المقطع يُقتطع بطول حقيقي لا بنسبة من المحور: التصريح يغطي امتداداً
     * محدداً من الشارع، والنسبة تُنتج مقاطع بطول مئتي متر على محور قصير فتقرأ
     * على الخريطة نقطةً لا عملاً. المدى ٤٠٠ متر إلى ١٫٦ كم.
     */
    const chainKm = lengthOf(corridor.chain) * KM_PER_DEGREE;
    const targetKm = 0.4 + rand() * 1.2;
    const span = Math.min(targetKm / chainKm, 0.9);
    const from = rand() * (0.96 - span);
    const line = section(corridor.chain, from, from + span);
    if (line.length < 2) return;

    const group = GROUPS[Math.floor(rand() * GROUPS.length)];
    const status = STATUSES[Math.floor(rand() * STATUSES.length)];

    /**
     * مدة التصريح ليست إغلاقاً متصلاً. تصريح ١٤٢ ساعة هو نافذة عمل يومية
     * تتكرر على أيام، لا مئة وأربعين ساعة إغلاق بلا انقطاع. تمرير المدة كاملة
     * إلى BPR يجعل الطلب يتجاوز السعة بلا تصريف فينفجر الرقم. لذا نحسب
     * النافذة اليومية ونضربها في عدد الأيام.
     */
    const permitHours = Math.max(4, Math.min(permit.durationHours, 240));
    const windowHours = Math.min(permitHours, Engine.WORK_WINDOW_HOURS);
    const workDays = Math.max(1, Math.ceil(permitHours / Engine.WORK_WINDOW_HOURS));
    const durationHours = permitHours;

    // حركة الشارع من بيانات الشبكة إن وُجدت — أدق من قيمة المحفظة المولّدة.
    const aadt = Number(corridor.aadt) > 0 ? Number(corridor.aadt) : permit.aadt;

    const daily = Engine.score({
      aadt: aadt,
      lanes: permit.lanes,
      lanesClosed: permit.lanesClosed,
      startHour: permit.startHour,
      durationHours: windowHours,
      capacityPerLane: Engine.DEFAULTS.capacityPerLane,
      freeFlowMin: Engine.DEFAULTS.freeFlowMin,
    });

    const scored = {
      level: daily.level,
      hourly: daily.hourly,
      delayVehHours: daily.delayVehHours * workDays,
    };

    const delayPct = delayPercent(scored);
    const startDay = permit.startDay % WINDOW_SPREAD_DAYS;
    const escalate = escalationReason(delayPct, permit.lanes, permit.lanesClosed, windowHours);

    /**
     * الشدة على مستوى التصريح لا على مستوى الساعة: إغلاق مسار واحد ثماني
     * ساعات يومياً لثلاثة أسابيع على شريان ليس أثراً منخفضاً لمجرد أن كل يوم
     * منه محتمَل. الحدّان مُعلنان ويقابلان ساعات-مركبة تراكمية.
     */
    const severity = (scored.level === 'high' || escalate || scored.delayVehHours >= 40000)
      ? 3
      : (scored.level === 'medium' || scored.delayVehHours >= 8000) ? 2 : 1;

    features.push({
      type: 'Feature',
      geometry: group === 'pois'
        ? { type: 'Point', coordinates: line[Math.floor(line.length / 2)] }
        : { type: 'LineString', coordinates: line },
      properties: {
        id: permit.id,
        permitRef: 'BLD-2026-' + pad(index + 1, 4),
        group: group,
        subtype: SUBTYPES[Math.floor(rand() * SUBTYPES.length)],
        status: status,
        nextAction: NEXT_ACTION[status] || 'راجع',
        title: 'أعمال على ' + corridor.name,
        street: corridor.name,
        roadClass: corridor.roadClass,
        sensitivity: SENSITIVITY[Math.floor(rand() * SENSITIVITY.length)],
        promoter: PROMOTERS[Math.floor(rand() * PROMOTERS.length)],
        contractor: CONTRACTORS[Math.floor(rand() * CONTRACTORS.length)],
        aadt: aadt,
        lanes: permit.lanes,
        lanesClosed: permit.lanesClosed,
        direction: rand() < 0.5 ? 'شمال' : 'جنوب',
        start: isoAt(startDay, permit.startHour),
        end: isoAt(startDay + workDays, permit.startHour + windowHours),
        windowHours: windowHours,
        workDays: workDays,
        severity: severity,
        confidence: escalate ? 'low' : severity === 3 ? 'low' : severity === 2 ? 'medium' : 'high',
        impactVehHours: Math.round(scored.delayVehHours),
        delayPct: Math.round(delayPct * 10) / 10,
        escalate: Boolean(escalate),
        escalateReason: escalate || '',
        inputsVersion: 'v1',
        version: 1,
        description: 'إغلاق ' + permit.lanesClosed + ' من ' + permit.lanes
          + ' مسارات — نافذة ' + windowHours + ' ساعات يومياً على مدى '
          + workDays + ' يوماً (' + durationHours + ' ساعة عمل)',
      },
    });
  });

  return { type: 'FeatureCollection', features: features };
}

const collection = build();
const text = JSON.stringify(collection);

fs.writeFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson'), text);
fs.writeFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson.js'),
  'window.ATHAR_CITY_PORTFOLIO = ' + text + ';');

const streets = new Set(collection.features.map((f) => f.properties.street));
console.log('كُتب ' + collection.features.length + ' تصريحاً على ' + streets.size + ' شارعاً مسمّى');
