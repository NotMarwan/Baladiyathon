'use strict';
/**
 * محوّل HERE Traffic API v7 — flow.
 * ---------------------------------------------------------------------------
 * **ما يفعله المحوّل ولماذا يوجد قبل المفتاح.**
 *
 * لا مفتاح HERE في هذا المستودع، فلا اتصال حيّ. ومع ذلك يوجد المحوّل، لأن
 * الشيء الذي يتأخّر عادةً ليس الاتصال بل **فهم ما يعطيه المزوّد وما لا
 * يعطيه**. وهذا الفهم مكتوبٌ هنا وقابل للفحص: الحقول التي تُقرأ، والحقول التي
 * لا وجود لها، وما يُترك فارغاً بدل أن يُملأ بصفر.
 *
 * والاكتشاف الحاكم: **لا حجم حركة في استجابة flow**. `speed` و`freeFlow`
 * و`jamFactor` و`confidence` — ولا عدّ مركبات. فكل ما يبنيه أثر على `v/c`
 * لا يُعاير من هنا مهما طال الرصد.
 *
 * وثيقة الحقول: https://docs.here.com/traffic-api/docs/flow
 */

const KEY = 'here-traffic-v7';

/**
 * ما يلزم لتشغيل الاتصال الحيّ — مكتوبٌ كي لا يُكتشف عند أول محاولة.
 */
const REQUIRED_CREDENTIALS = [
  { env: 'HERE_API_KEY', what: 'مفتاح واجهة HERE بصلاحية Traffic API',
    how: 'من حساب HERE Developer بعد إنشاء مشروع' },
];

/**
 * `confidence` عند HERE ليست «جودة» بل **نسبة البيانات الآنية في الحساب**.
 * القيمة 0.70 تعني تاريخيةً بحتة. من يقرؤها جودةً يقبل قيمةً تاريخية
 * على أنها رصدٌ للحظة — وهو الخطأ الذي يجعل خط الأساس يقيس نفسه.
 */
const REALTIME_CONFIDENCE_FLOOR = 0.71;

/**
 * يبني وصف الطلب. لا يُرسله — الإرسال مسؤولية المُجمِّع، والفصل يجعل
 * المحوّل قابلاً للفحص بلا شبكة.
 */
function buildRequest(route, options) {
  const settings = options || {};
  if (!settings.apiKey) {
    return { ok: false, reason: 'لا مفتاح HERE — الاتصال الحيّ غير متاح' };
  }
  const box = route.bbox;
  if (!box || box.length !== 4) {
    return { ok: false, reason: 'المسار بلا صندوق إحاطة' };
  }
  return {
    ok: true,
    method: 'GET',
    url: 'https://data.traffic.hereapi.com/v7/flow',
    query: {
      in: `bbox:${box[0]},${box[1]},${box[2]},${box[3]}`,
      locationReferencing: 'shape',
      apiKey: '(محجوب)',
    },
    note: 'المفتاح لا يُطبع ولا يُسجَّل — يُحقن عند الإرسال فقط.',
  };
}

/**
 * يحوّل استجابة flow إلى قياسات بعقد `athar-route-evidence`.
 *
 * @param {object} payload استجابة المزوّد.
 * @param {object} context `{ routeId, observedAt, importedAt, dataMode, license }`
 * @returns {{measurements:Array, skipped:Array}}
 */
function parse(payload, context) {
  const settings = context || {};
  const measurements = [];
  const skipped = [];

  const results = (payload && payload.results) || [];
  results.forEach((item, index) => {
    const flow = item.currentFlow || {};
    const location = item.location || {};
    const segmentId = settings.segmentId
      || location.description
      || `${settings.routeId || 'route'}-seg-${index + 1}`;

    /* لا سرعة ولا زمن = لا قياس. يُسجَّل التخطّي بسببه بدل الحذف الصامت:
       سلسلةٌ تُنقص صفوفها بلا أثر تبدو تغطيةً كاملة وهي ليست كذلك. */
    if (!Number.isFinite(flow.speed) && !Number.isFinite(flow.freeFlow)) {
      skipped.push({ segmentId, reason: 'لا سرعة ولا انسياب حر في العنصر' });
      return;
    }

    const speed = Number.isFinite(flow.speed) ? flow.speed : null;
    const freeFlow = Number.isFinite(flow.freeFlow) ? flow.freeFlow : null;
    const lengthM = Number.isFinite(location.length) ? location.length : null;

    /* زمن الرحلة يُشتقّ من الطول والسرعة حين يعطي المزوّد الطول. وهو اشتقاق
       لا قياس، ولذلك يُترك `null` إن غاب الطول بدل تقديره. */
    const travelTimeSec = (speed && lengthM) ? (lengthM / (speed / 3.6)) : null;
    const freeTimeSec = (freeFlow && lengthM) ? (lengthM / (freeFlow / 3.6)) : null;

    measurements.push({
      routeId: settings.routeId,
      segmentId,
      geometryRef: location.shape ? 'here:shape' : '',
      provider: KEY,
      sourceType: settings.sourceType || 'probe',
      observedAt: settings.observedAt,
      importedAt: settings.importedAt,
      timezone: 'Asia/Riyadh',
      speedKph: speed,
      freeFlowKph: freeFlow,
      travelTimeSec: travelTimeSec === null ? null : Math.round(travelTimeSec),
      delaySec: (travelTimeSec !== null && freeTimeSec !== null)
        ? Math.max(0, Math.round(travelTimeSec - freeTimeSec)) : null,
      congestionIndex: Number.isFinite(flow.jamFactor) ? flow.jamFactor : null,
      /* الحجم غائب عند المصدر. `null` لا `0`: الصفر يعني «لا مركبات مرّت»
         وهو ادّعاء قياس، والغياب يعني «لا نعرف». */
      volumeVehPerHour: null,
      volumeSource: '',
      sampleSize: null,
      confidence: Number.isFinite(flow.confidence) ? flow.confidence : null,
      coverage: Number.isFinite(settings.coverage) ? settings.coverage : null,
      status: statusOf(flow),
      dataMode: settings.dataMode || 'local-route',
      license: settings.license || 'HERE — يُراجع عقد الترخيص قبل التخزين',
      knownLimits: limitsOf(flow),
    });
  });

  return { measurements, skipped };
}

function statusOf(flow) {
  if (!Number.isFinite(flow.speed)) return 'partial';
  if (Number.isFinite(flow.confidence) && flow.confidence < REALTIME_CONFIDENCE_FLOOR) {
    /* قيمةٌ تاريخية ليست فاشلة ولا آنية. `stale` هي التسمية الصادقة، وهي
       تمنع أن تدخل خط الأساس بوصفها رصداً للحظة. */
    return 'stale';
  }
  return 'ok';
}

function limitsOf(flow) {
  const notes = ['المزوّد لا ينتج حجم حركة — v/c غير قابل للحساب من هذا القياس.'];
  if (Number.isFinite(flow.confidence) && flow.confidence < REALTIME_CONFIDENCE_FLOOR) {
    notes.push(`الثقة ${flow.confidence} دون ${REALTIME_CONFIDENCE_FLOOR} — `
      + 'القيمة مشتقّة من سرعات تاريخية لا من رصد آني.');
  }
  notes.push('مرجع الانسياب الحر مرجع المزوّد لا حدّ السرعة النظامي.');
  return notes.join(' ');
}

module.exports = {
  KEY,
  REQUIRED_CREDENTIALS,
  REALTIME_CONFIDENCE_FLOOR,
  name: 'HERE Traffic API v7',
  providesVolume: false,
  buildRequest,
  parse,
};
