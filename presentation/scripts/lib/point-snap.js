'use strict';
/**
 * إسناد نقطة إلى مقطع طريق حقيقي من شبكة الطرق.
 * ---------------------------------------------------------------------------
 * **المشكلة.**
 *
 * ستّ عشرة حالة في المحفظة هندستها نقطة واحدة. و`WZDx 4.2` لا يقبل `Point`
 * للحدث: الهندسة `LineString` أو `MultiPoint` بنقطتين فأكثر. فالحالات الستّ
 * عشرة تفشل أمام المخطط الرسمي مهما صحّت بقية حقولها.
 *
 * **الحل الممنوع.**
 *
 * أن يُمدّ خطٌّ قصير حول النقطة فيجتاز المخطط. هذا يخترع موقعاً: المستهلك
 * سيقرأ امتداد عملٍ لم يقله أحد، ويغلق شارعاً بطوله على ورق.
 *
 * **الحل المتَّبع هنا.**
 *
 * تُسنَد النقطة إلى **مقطع شبكة حقيقي** من `riyadh-roads.geojson` (ومن ملف
 * الأحياء للشوارع المحلية)، وتُستعمل هندسة ذلك المقطع كما هي. ويُحتفَظ بدليل
 * الإسناد كاملاً: اسم الطريق المطابق، ومعرّف OSM، والمسافة بالأمتار بين
 * النقطة والمقطع، وطول المقطع.
 *
 * **وحدوده.**
 *
 * ثلاثة أسباب ترفض الإسناد، وكلها تُنتج «غير قابل للنشر المعياري» لا هندسة
 * مخترعة:
 *   · المسافة تتجاوز `MAX_SNAP_M` — النقطة ليست على هذا الطريق.
 *   · لا تطابق في الاسم والمسافة ليست ضيّقة جداً — أقرب طريق ليس بالضرورة
 *     الطريق الصحيح؛ نقطة على تقاطع تقع بين ثلاثة.
 *   · المقطع أطول من `MAX_SEGMENT_M` — نشرُ منطقة عمل بطول كيلومترات انطلاقاً
 *     من نقطة واحدة يبالغ في التعرّض بقدر ما يبالغ الخط المخترع.
 *
 * وفي كل الأحوال يبقى `is_start_position_verified` و`is_end_position_verified`
 * على `false`: هندسةٌ مشتقّة من شبكة ليست مسحاً ميدانياً.
 *
 * بيانات الطرق © مساهمو OpenStreetMap — رخصة ODbL.
 */

const EARTH_R = 6371008.8;

/** حدود الإسناد — معلنة رقماً لا مدفونة في شرط. */
const MAX_SNAP_M = 30;          // أبعد مسافة مقبولة بين النقطة والمحور
const MAX_SNAP_NO_NAME_M = 10;  // إن لم يطابق الاسم، الشرط أضيق
const MAX_SEGMENT_M = 2000;     // أطول مقطع يُقبل تمثيلاً لموقع عمل
const MIN_SEGMENT_M = 20;       // أقصر مقطع مفيد

function toRad(deg) { return (deg * Math.PI) / 180; }

/** مسافة بالأمتار بين إحداثيين. */
function haversine(a, b) {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** طول خط بالأمتار. */
function lineLengthM(line) {
  let total = 0;
  for (let i = 1; i < line.length; i += 1) total += haversine(line[i - 1], line[i]);
  return total;
}

/**
 * أقرب مسافة بالأمتار من نقطة إلى قطعة مستقيمة، مع نسبة الإسقاط عليها.
 * الإسقاط في مستوٍ محلي — كافٍ داخل مدينة واحدة، والخطأ دون المتر.
 */
function pointToSegmentM(point, a, b) {
  const latRef = toRad((a[1] + b[1]) / 2);
  const mx = Math.cos(latRef) * (Math.PI / 180) * EARTH_R;
  const my = (Math.PI / 180) * EARTH_R;

  const px = (point[0] - a[0]) * mx;
  const py = (point[1] - a[1]) * my;
  const bx = (b[0] - a[0]) * mx;
  const by = (b[1] - a[1]) * my;

  const len2 = bx * bx + by * by;
  if (len2 === 0) return { distanceM: Math.hypot(px, py), t: 0 };

  let t = (px * bx + py * by) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - t * bx;
  const dy = py - t * by;
  return { distanceM: Math.hypot(dx, dy), t };
}

/** أقرب مسافة من نقطة إلى خط كامل. */
function pointToLineM(point, line) {
  let best = { distanceM: Infinity, index: -1, t: 0 };
  for (let i = 1; i < line.length; i += 1) {
    const hit = pointToSegmentM(point, line[i - 1], line[i]);
    if (hit.distanceM < best.distanceM) {
      best = { distanceM: hit.distanceM, index: i - 1, t: hit.t };
    }
  }
  return best;
}

/** تطبيع اسم شارع للمقارنة — يزيل «شارع/طريق» والتشكيل وصور الألف والياء. */
function normaliseName(name) {
  if (typeof name !== 'string') return '';
  return name
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/^(شارع|طريق|الطريق)\s+/u, '')
    .replace(/[()\-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** هل الاسمان لنفس الطريق؟ تطابق كامل أو احتواء أحدهما للآخر بطول معتبر. */
function namesMatch(a, b) {
  const x = normaliseName(a);
  const y = normaliseName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 6 && y.indexOf(x) !== -1) return true;
  if (y.length >= 6 && x.indexOf(y) !== -1) return true;
  return false;
}

/**
 * يُسند نقطة إلى مقطع شبكة.
 *
 * @param {[number,number]} point
 * @param {string} streetName اسم الشارع كما في التصريح.
 * @param {Array<{name:string, osmId:string, coordinates:Array}>} network
 * @returns {{resolved:boolean, reason:string, evidence:object, coordinates:(Array|null)}}
 */
function snapPointToNetwork(point, streetName, network) {
  let byName = null;
  let byDistance = null;

  for (const segment of network) {
    const line = segment.coordinates;
    if (!Array.isArray(line) || line.length < 2) continue;
    const hit = pointToLineM(point, line);
    const candidate = {
      name: segment.name || '',
      osmId: segment.osmId || '',
      source: segment.source || '',
      distanceM: hit.distanceM,
      lengthM: lineLengthM(line),
      coordinates: line,
    };
    if (!byDistance || candidate.distanceM < byDistance.distanceM) byDistance = candidate;
    if (namesMatch(segment.name, streetName)
      && (!byName || candidate.distanceM < byName.distanceM)) {
      byName = candidate;
    }
  }

  /* المرشّح المفضَّل هو المطابق بالاسم إن كان قريباً بما يكفي. أقرب طريق بلا
     اسم مطابق يُقبل فقط ضمن حدٍّ أضيق: النقطة على تقاطع تقع قريبة من ثلاثة
     شوارع، فالاسم هو ما يفرّق. */
  let pick = null;
  let via = '';
  if (byName && byName.distanceM <= MAX_SNAP_M) {
    pick = byName;
    via = 'تطابق الاسم';
  } else if (byDistance && byDistance.distanceM <= MAX_SNAP_NO_NAME_M) {
    pick = byDistance;
    via = 'أقرب محور — بلا تطابق اسم، ضمن حدّ ضيّق';
  }

  const evidence = {
    permitStreet: streetName,
    nearestName: byDistance ? byDistance.name : '',
    nearestDistanceM: byDistance ? round(byDistance.distanceM) : null,
    nameMatchDistanceM: byName ? round(byName.distanceM) : null,
    thresholds: {
      maxSnapM: MAX_SNAP_M,
      maxSnapNoNameM: MAX_SNAP_NO_NAME_M,
      maxSegmentM: MAX_SEGMENT_M,
      minSegmentM: MIN_SEGMENT_M,
    },
  };

  if (!pick) {
    return {
      resolved: false,
      code: 'no-match',
      coordinates: null,
      reason: byDistance
        ? `أقرب محور «${byDistance.name || 'بلا اسم'}» على ${round(byDistance.distanceM)} م `
          + `— لا تطابق اسم، والحدّ بلا اسم ${MAX_SNAP_NO_NAME_M} م`
        : 'لا محاور في نطاق البحث',
      evidence,
    };
  }

  if (pick.lengthM > MAX_SEGMENT_M) {
    return {
      resolved: false,
      code: 'segment-too-long',
      coordinates: null,
      reason: `مقطع الشبكة المطابق طوله ${Math.round(pick.lengthM)} م — أطول من `
        + `${MAX_SEGMENT_M} م. نشر منطقة عمل بهذا الطول من نقطة واحدة يبالغ في التعرّض.`,
      evidence: Object.assign(evidence, {
        matchedName: pick.name, matchedOsmId: pick.osmId,
        matchedLengthM: Math.round(pick.lengthM),
      }),
    };
  }

  if (pick.lengthM < MIN_SEGMENT_M) {
    return {
      resolved: false,
      code: 'segment-too-short',
      coordinates: null,
      reason: `مقطع الشبكة المطابق طوله ${Math.round(pick.lengthM)} م — أقصر من `
        + `${MIN_SEGMENT_M} م، ولا يصف موقع عمل.`,
      evidence,
    };
  }

  return {
    resolved: true,
    code: 'snapped',
    coordinates: pick.coordinates,
    reason: `مُسنَد إلى مقطع شبكة حقيقي عبر ${via}`,
    evidence: Object.assign(evidence, {
      via,
      matchedName: pick.name,
      matchedOsmId: pick.osmId,
      matchedSource: pick.source,
      matchedDistanceM: round(pick.distanceM),
      matchedLengthM: Math.round(pick.lengthM),
      extentSource: 'network-segment',
      extentNote: 'الامتداد هو طول مقطع الشبكة المطابق — التصريح لا يصرّح بامتداد. '
        + 'وهو مشتقّ لا مقيس، ولذلك يبقى تحقق الموضع false.',
      positionVerified: false,
    }),
  };
}

function round(value) { return Math.round(value * 10) / 10; }

module.exports = {
  MAX_SNAP_M,
  MAX_SNAP_NO_NAME_M,
  MAX_SEGMENT_M,
  MIN_SEGMENT_M,
  haversine,
  lineLengthM,
  pointToSegmentM,
  pointToLineM,
  normaliseName,
  namesMatch,
  snapPointToNetwork,
};
