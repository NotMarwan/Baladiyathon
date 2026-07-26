'use strict';
/**
 * محوّل Google Routes API — زمن رحلة على مسار كامل.
 * ---------------------------------------------------------------------------
 * **لماذا هذا المزوّد مختلف عن الاثنين الآخرين.**
 *
 * HERE وTomTom يعطيان سرعةً على **مقطع** شبكة. وGoogle يعطي زمناً على
 * **مسار** بين نقطتين. والفرق يحدّد ما يصلح له:
 *   · هو الأنسب لسؤال «كم يكلّف البديل مقارنةً بالأساسي **الآن**» — لأن
 *     السؤال عن مسار كامل، وهو ما يعطيه بالضبط.
 *   · وهو غير صالح لسؤال «أين الاختناق» — لأن الزمن الكلي لا يقول أي مقطع
 *     أكله.
 *
 * والقيد الثاني: الشروط تقيّد التخزين المؤقّت، والاستثناءات محدودة بمدد
 * قصيرة. فهو مصدر **مقارنة آنية** لا مصدر أرشيف.
 *
 * شروط: https://cloud.google.com/maps-platform/terms/maps-service-terms
 */

const KEY = 'google-routes';

const REQUIRED_CREDENTIALS = [
  { env: 'GOOGLE_ROUTES_API_KEY', what: 'مفتاح Google Maps Platform بصلاحية Routes API',
    how: 'من Google Cloud Console بعد تفعيل Routes API وربط الفوترة' },
];

function buildRequest(route, options) {
  const settings = options || {};
  if (!settings.apiKey) {
    return { ok: false, reason: 'لا مفتاح Google Routes — الاتصال الحيّ غير متاح' };
  }
  if (!route.origin || !route.destination) {
    return { ok: false, reason: 'المسار بلا نقطة بداية أو نهاية' };
  }
  return {
    ok: true,
    method: 'POST',
    url: 'https://routes.googleapis.com/directions/v2:computeRoutes',
    headers: {
      'X-Goog-Api-Key': '(محجوب)',
      'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters',
    },
    body: {
      origin: { location: { latLng: { latitude: route.origin[1], longitude: route.origin[0] } } },
      destination: { location: { latLng: { latitude: route.destination[1], longitude: route.destination[0] } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    },
    note: 'قناع الحقول مقصود ضيّق: كل حقل زائد تكلفة وبيانات لا تُستعمل.',
  };
}

/** يحوّل «120s» إلى 120. */
function seconds(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

function parse(payload, context) {
  const settings = context || {};
  const routes = (payload && payload.routes) || [];
  if (!routes.length) {
    return { measurements: [],
      skipped: [{ segmentId: settings.routeId || '', reason: 'لا مسارات في الاستجابة' }] };
  }

  const best = routes[0];
  const travelTimeSec = seconds(best.duration);
  const freeTimeSec = seconds(best.staticDuration);
  const distanceM = Number.isFinite(best.distanceMeters) ? best.distanceMeters : null;

  if (travelTimeSec === null) {
    return { measurements: [],
      skipped: [{ segmentId: settings.routeId || '', reason: 'لا زمن رحلة في المسار الأول' }] };
  }

  return {
    measurements: [{
      routeId: settings.routeId,
      /* المعرّف يقول «كامل» صراحةً: قياسٌ على مسار كامل مخزَّن بمعرّف مقطع
         يُقرأ لاحقاً قياسَ مقطع، فيُنسب اختناقٌ إلى موضع لم يُقس. */
      segmentId: `${settings.routeId || 'route'}-كامل`,
      geometryRef: 'google:route',
      provider: KEY,
      sourceType: settings.sourceType || 'derived',
      observedAt: settings.observedAt,
      importedAt: settings.importedAt,
      timezone: 'Asia/Riyadh',
      speedKph: (distanceM && travelTimeSec)
        ? Math.round((distanceM / travelTimeSec) * 3.6 * 10) / 10 : null,
      freeFlowKph: (distanceM && freeTimeSec)
        ? Math.round((distanceM / freeTimeSec) * 3.6 * 10) / 10 : null,
      travelTimeSec,
      delaySec: freeTimeSec === null ? null : Math.max(0, travelTimeSec - freeTimeSec),
      congestionIndex: null,
      volumeVehPerHour: null,
      volumeSource: '',
      sampleSize: null,
      confidence: null,
      coverage: 1,
      status: 'ok',
      dataMode: settings.dataMode || 'local-route',
      license: settings.license
        || 'Google Maps Platform — التخزين المؤقّت مقيَّد؛ تُراجع شروط الخدمة قبل أي أرشفة',
      knownLimits: 'زمن على مسار كامل لا على مقطع — لا يحدّد موضع الاختناق. '
        + 'ولا حجم حركة. والسرعة هنا **متوسط مشتقّ** من المسافة والزمن، لا سرعة مقيسة.',
    }],
    skipped: [],
  };
}

module.exports = {
  KEY,
  REQUIRED_CREDENTIALS,
  name: 'Google Routes API',
  providesVolume: false,
  buildRequest,
  parse,
  seconds,
};
