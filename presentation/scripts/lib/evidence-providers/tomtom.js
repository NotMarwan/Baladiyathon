'use strict';
/**
 * محوّل TomTom Traffic — Flow Segment Data.
 * ---------------------------------------------------------------------------
 * قيدٌ يخصّ هذا المزوّد وحده، ويجب أن يظهر في المعمارية لا في حاشية:
 * شروط الاستعمال لا تمنح حقّ تخزين مؤقّت لتوسيع النتائج على مستخدمين
 * متعددين، والمحتوى القابل للتنزيل لا يُحتفظ به أكثر من تسعين يوماً
 * (وستين لمنتج التحليلات) ثم يُحذف من كل الأنظمة.
 *
 * وأثرُه عملي: خط أساس تاريخي بالساعة واليوم يحتاج شهوراً من التراكم. بناؤه
 * على TomTom يصطدم بحدّ الحذف قبل أن يكتمل. فالمحوّل يعلن مدة الاحتفاظ في
 * كل قياس ينتجه — لا كي يُقرأ، بل كي يُفحص آلياً قبل الأرشفة.
 *
 * وثيقة: https://developer.tomtom.com/traffic-api/documentation/tomtom-maps/v1/product-information/introduction
 */

const KEY = 'tomtom-traffic';

const REQUIRED_CREDENTIALS = [
  { env: 'TOMTOM_API_KEY', what: 'مفتاح واجهة TomTom بصلاحية Traffic',
    how: 'من TomTom Developer Portal' },
];

/** حدّ الاحتفاظ المعلن في الشروط — يُفحص لا يُتذكَّر. */
const MAX_RETENTION_DAYS = 90;

function buildRequest(route, options) {
  const settings = options || {};
  if (!settings.apiKey) {
    return { ok: false, reason: 'لا مفتاح TomTom — الاتصال الحيّ غير متاح' };
  }
  const point = route.probePoint;
  if (!Array.isArray(point) || point.length < 2) {
    return { ok: false, reason: 'المسار بلا نقطة استعلام' };
  }
  return {
    ok: true,
    method: 'GET',
    url: 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json',
    query: { point: `${point[1]},${point[0]}`, unit: 'KMPH', key: '(محجوب)' },
    note: 'TomTom يستعلم بنقطة على المقطع لا بصندوق.',
  };
}

/**
 * @param {object} payload استجابة flowSegmentData.
 * @param {object} context
 */
function parse(payload, context) {
  const settings = context || {};
  const segment = payload && payload.flowSegmentData;
  if (!segment) {
    return { measurements: [],
      skipped: [{ segmentId: settings.segmentId || '', reason: 'لا flowSegmentData في الاستجابة' }] };
  }

  const speed = Number.isFinite(segment.currentSpeed) ? segment.currentSpeed : null;
  const freeFlow = Number.isFinite(segment.freeFlowSpeed) ? segment.freeFlowSpeed : null;
  const travelTimeSec = Number.isFinite(segment.currentTravelTime)
    ? segment.currentTravelTime : null;
  const freeTimeSec = Number.isFinite(segment.freeFlowTravelTime)
    ? segment.freeFlowTravelTime : null;

  if (speed === null && travelTimeSec === null) {
    return { measurements: [],
      skipped: [{ segmentId: settings.segmentId || '', reason: 'لا سرعة ولا زمن رحلة' }] };
  }

  return {
    measurements: [{
      routeId: settings.routeId,
      segmentId: settings.segmentId || `${settings.routeId || 'route'}-tomtom`,
      geometryRef: segment.coordinates ? 'tomtom:coordinates' : '',
      provider: KEY,
      sourceType: settings.sourceType || 'probe',
      observedAt: settings.observedAt,
      importedAt: settings.importedAt,
      timezone: 'Asia/Riyadh',
      speedKph: speed,
      freeFlowKph: freeFlow,
      travelTimeSec,
      delaySec: (travelTimeSec !== null && freeTimeSec !== null)
        ? Math.max(0, travelTimeSec - freeTimeSec) : null,
      congestionIndex: null,
      volumeVehPerHour: null,
      volumeSource: '',
      sampleSize: null,
      /* `confidence` عند TomTom قيمة تصف موثوقية التقدير، وسلّمها ليس سلّم
         HERE. تُنقل كما هي ولا تُعاد معايرتها: توحيد سلالم مختلفة اختراعُ
         مقياس ثالث لا يملكه أحد. */
      confidence: Number.isFinite(segment.confidence) ? segment.confidence : null,
      coverage: Number.isFinite(settings.coverage) ? settings.coverage : null,
      status: segment.roadClosure ? 'partial' : 'ok',
      dataMode: settings.dataMode || 'local-route',
      license: settings.license
        || `TomTom — احتفاظ لا يتجاوز ${MAX_RETENTION_DAYS} يوماً، ولا تخزين مؤقّت لخدمة مستخدمين متعددين`,
      knownLimits: 'المزوّد لا ينتج حجم حركة. '
        + `وحدّ الاحتفاظ ${MAX_RETENTION_DAYS} يوماً يمنع بناء أرشيف طويل على هذا المصدر وحده. `
        + (segment.roadClosure ? 'المقطع معلَّم مغلقاً عند المزوّد.' : ''),
      retentionDays: MAX_RETENTION_DAYS,
    }],
    skipped: [],
  };
}

/**
 * هل تجاوز هذا القياس مدة الاحتفاظ المسموحة؟
 *
 * يُستدعى قبل الأرشفة. مخالفة الترخيص عيبٌ لا يظهر في اختبار وظيفي، فيبقى
 * حتى يظهر في مراجعة قانونية — وذلك متأخر جداً.
 */
function retentionExpired(measurement, nowISO) {
  const observed = Date.parse(measurement && measurement.observedAt);
  const now = Date.parse(nowISO);
  if (Number.isNaN(observed) || Number.isNaN(now)) return false;
  const days = (now - observed) / 86400000;
  return days > MAX_RETENTION_DAYS;
}

module.exports = {
  KEY,
  REQUIRED_CREDENTIALS,
  MAX_RETENTION_DAYS,
  name: 'TomTom Traffic API',
  providesVolume: false,
  buildRequest,
  parse,
  retentionExpired,
};
