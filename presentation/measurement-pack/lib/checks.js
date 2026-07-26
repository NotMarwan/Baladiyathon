'use strict';
/**
 * فحوص حزمة القياس الميداني: الاكتمال، والجودة، والاتساق الزمني والمكاني.
 * ---------------------------------------------------------------------------
 * **لماذا ثلاثة فحوص لا واحد.**
 *
 * حزمةٌ ناقصة، وحزمةٌ كاملة الحقول رديئة القيم، وحزمةٌ كاملة جيّدة القيم
 * لكن سلسلتها لا تغطي وقت الإغلاق — ثلاث حالات تُصلَح بثلاثة طلبات مختلفة
 * من الجهة. فحصٌ واحد يقول «غير صالحة» يجعل الجهة ترسل شيئاً عشوائياً.
 *
 * **وما لا تفعله هذه الفحوص.**
 *
 * لا تحكم على الأثر. حزمةٌ تجتاز الثلاثة تصلح **للاستيراد**، والأثر السببي
 * له حارسه المستقل في `counterfactual.js`. الخلط بينهما هو كيف يصير
 * «البيانات وصلت ونظيفة» قراءةً بأن الأثر ثبت.
 */

const MIN_BEFORE_SAMPLES = 24;
const MIN_DURING_SAMPLES = 24;
const MAX_GAP_FACTOR = 3;      // فجوة تتجاوز ثلاثة فواصل = انقطاع لا تباعد
const MIN_COVERAGE = 0.6;
const MIN_QUALITY_SHARE = 0.7;

/** الحقول التي بلا واحد منها لا معنى للحزمة. */
const REQUIRED_PATHS = [
  ['study', 'studyId'],
  ['study', 'permitRef'],
  ['study', 'timezone'],
  ['closure', 'actualStart'],
  ['closure', 'actualEnd'],
  ['closure', 'lanes'],
  ['closure', 'lanesClosed'],
  ['geometry', 'affectedSegment'],
  ['series', 'before'],
  ['series', 'during'],
  ['provenance', 'sources'],
];

function at(object, path) {
  return path.reduce(function (node, key) {
    return (node === null || node === undefined) ? undefined : node[key];
  }, object);
}

/**
 * الاكتمال — هل كل ما يلزم موجود؟
 *
 * `missing` يمنع الاستيراد، و`degraded` يقلّل ما يمكن استنتاجه ولا يمنعه.
 */
function completeness(study) {
  const missing = [];
  const degraded = [];

  REQUIRED_PATHS.forEach((path) => {
    const value = at(study, path);
    if (value === undefined || value === null || value === '') {
      missing.push(path.join('.'));
    }
  });

  if (!at(study, ['series', 'after'])) {
    degraded.push({ what: 'series.after',
      why: 'بلا سلسلة «بعد» لا يُقاس التعافي — ويبقى قياس أثناء العمل ممكناً.' });
  }
  if (!at(study, ['series', 'control']) && !at(study, ['geometry', 'controlCorridor'])) {
    degraded.push({ what: 'الحالة المقابلة',
      why: 'بلا محور مقارنة ولا أيام مماثلة، الفرق المرصود يبقى ارتباطاً زمنياً '
        + 'لا أثراً سببياً.' });
  }
  if (!Array.isArray(study && study.confounders)) {
    degraded.push({ what: 'confounders',
      why: 'سجل العوامل المربكة غائب. وغيابه ليس «لا عوامل» — هو «لم يُسجَّل».' });
  }
  if (!at(study, ['closure', 'workExtentM'])) {
    degraded.push({ what: 'closure.workExtentM',
      why: 'بلا طول موقع العمل لا يُنسَب التأخير إلى طول التعرّض.' });
  }

  return {
    ok: missing.length === 0,
    missing,
    degraded,
    importable: missing.length === 0,
  };
}

function samplesOf(series) {
  return (series && Array.isArray(series.samples)) ? series.samples : [];
}

function hasMetric(sample) {
  return Number.isFinite(sample.speedKph)
    || Number.isFinite(sample.travelTimeSec)
    || Number.isFinite(sample.volumeVehPerHour);
}

/**
 * الجودة — هل القيم صالحة لأن يُبنى عليها فرق؟
 *
 * لا يفحص «هل الرقم صحيح» — لا أحد يستطيع ذلك بلا مرجع. يفحص ما يمكن فحصه:
 * حجم العيّنة، ونصيب القيم الصالحة، والتغطية، والقيم خارج المدى الفيزيائي.
 */
function quality(study) {
  const problems = [];
  const warnings = [];

  [['before', MIN_BEFORE_SAMPLES], ['during', MIN_DURING_SAMPLES]].forEach((entry) => {
    const key = entry[0];
    const minimum = entry[1];
    const samples = samplesOf(at(study, ['series', key]));
    if (samples.length < minimum) {
      problems.push(`series.${key}: ${samples.length} عيّنة — أقل من ${minimum}. `
        + 'سلسلة قصيرة تقيس لحظةً لا نمطاً.');
    }
    const usable = samples.filter((sample) => hasMetric(sample)
      && sample.quality !== 'failed');
    const share = samples.length ? usable.length / samples.length : 0;
    if (samples.length && share < MIN_QUALITY_SHARE) {
      problems.push(`series.${key}: ${Math.round(share * 100)}٪ فقط من العيّنات صالحة `
        + `— دون ${Math.round(MIN_QUALITY_SHARE * 100)}٪.`);
    }
    samples.forEach((sample, index) => {
      if (Number.isFinite(sample.speedKph)
        && (sample.speedKph < 0 || sample.speedKph > 200)) {
        problems.push(`series.${key}[${index}]: سرعة خارج المدى الفيزيائي `
          + `(${sample.speedKph} كم/س)`);
      }
      if (Number.isFinite(sample.volumeVehPerHour) && sample.volumeVehPerHour < 0) {
        problems.push(`series.${key}[${index}]: حجم سالب`);
      }
      if (Number.isFinite(sample.coverage) && sample.coverage < MIN_COVERAGE) {
        warnings.push(`series.${key}[${index}]: تغطية ${sample.coverage} دون ${MIN_COVERAGE}`);
      }
    });
  });

  /* الحجم يحتاج مصدره معلناً في المصادر. حجمٌ في السلسلة بلا مصدر من نوع
     `volume` هو رقمٌ لا أحد يعرف كيف قيس، وعليه ستُبنى `v/c`. */
  const volumeUsed = ['before', 'during', 'after'].some((key) =>
    samplesOf(at(study, ['series', key]))
      .some((sample) => Number.isFinite(sample.volumeVehPerHour)));
  const volumeDeclared = ((at(study, ['provenance', 'sources']) || []) || [])
    .some((source) => source.metric === 'volume');
  if (volumeUsed && !volumeDeclared) {
    problems.push('السلسلة تحمل حجم حركة ولا مصدر من نوع volume معلن في provenance.');
  }

  return { ok: problems.length === 0, problems, warnings };
}

/**
 * الاتساق الزمني والمكاني.
 *
 * أكثر ما يفسد حزمةً وصلت كاملةً ونظيفة: سلسلة «أثناء» لا تقع داخل نافذة
 * الإغلاق الفعلية، أو مقاطع لا تخصّ المقطع المتأثر، أو فواصل زمنية مختلطة.
 * وكلها تُنتج فرقاً يبدو أثراً وهو خطأ محاذاة.
 */
function consistency(study) {
  const problems = [];
  const warnings = [];

  const start = Date.parse(at(study, ['closure', 'actualStart']));
  const end = Date.parse(at(study, ['closure', 'actualEnd']));

  if (Number.isNaN(start) || Number.isNaN(end)) {
    problems.push('توقيت الإغلاق غير صالح');
  } else if (end <= start) {
    problems.push('نهاية الإغلاق ليست بعد بدايته');
  }

  const during = samplesOf(at(study, ['series', 'during']));
  if (!Number.isNaN(start) && !Number.isNaN(end) && during.length) {
    const outside = during.filter((sample) => {
      const stamp = Date.parse(sample.at);
      return Number.isNaN(stamp) || stamp < start || stamp > end;
    });
    if (outside.length) {
      problems.push(`series.during: ${outside.length} عيّنة خارج نافذة الإغلاق الفعلية `
        + '— قياسٌ لطريق مفتوح مصنَّف «أثناء».');
    }
  }

  const before = samplesOf(at(study, ['series', 'before']));
  if (!Number.isNaN(start) && before.length) {
    const late = before.filter((sample) => {
      const stamp = Date.parse(sample.at);
      return !Number.isNaN(stamp) && stamp >= start;
    });
    if (late.length) {
      problems.push(`series.before: ${late.length} عيّنة بعد بدء الإغلاق`);
    }
  }

  ['before', 'during', 'after', 'control'].forEach((key) => {
    const series = at(study, ['series', key]);
    if (!series) return;
    const interval = series.intervalMinutes;
    const samples = samplesOf(series);
    if (!Number.isFinite(interval) || interval <= 0) {
      problems.push(`series.${key}: فاصل زمني غير معلن`);
      return;
    }
    const stamps = samples.map((sample) => Date.parse(sample.at))
      .filter((value) => !Number.isNaN(value)).sort((a, b) => a - b);
    for (let i = 1; i < stamps.length; i += 1) {
      const gapMinutes = (stamps[i] - stamps[i - 1]) / 60000;
      if (gapMinutes > interval * MAX_GAP_FACTOR) {
        warnings.push(`series.${key}: فجوة ${Math.round(gapMinutes)} دقيقة — `
          + `أكثر من ${MAX_GAP_FACTOR}× الفاصل المعلن (${interval})`);
        break;
      }
    }
  });

  /* المكان: كل مقطع في السلسلة يجب أن يُعلن، ومقاطع «أثناء» يجب أن تشمل
     المقطع المتأثر. سلسلةٌ على مقطع مجاور تقيس شيئاً آخر. */
  const segments = {};
  ['before', 'during'].forEach((key) => {
    samplesOf(at(study, ['series', key])).forEach((sample) => {
      if (!sample.segmentId) {
        problems.push(`series.${key}: عيّنة بلا معرّف مقطع`);
        return;
      }
      segments[key] = segments[key] || new Set();
      segments[key].add(sample.segmentId);
    });
  });
  if (segments.before && segments.during) {
    const shared = [...segments.during].filter((id) => segments.before.has(id));
    if (!shared.length) {
      problems.push('لا مقطع مشترك بين «قبل» و«أثناء» — الفرق يقارن مكانين لا حالتين.');
    }
  }

  return { ok: problems.length === 0, problems, warnings };
}

/** يشغّل الثلاثة ويعيد حصيلة واحدة. */
function inspect(study) {
  const parts = {
    completeness: completeness(study),
    quality: quality(study),
    consistency: consistency(study),
  };
  return {
    importable: parts.completeness.importable,
    usable: parts.completeness.ok && parts.quality.ok && parts.consistency.ok,
    parts,
  };
}

module.exports = {
  MIN_BEFORE_SAMPLES,
  MIN_DURING_SAMPLES,
  MAX_GAP_FACTOR,
  MIN_COVERAGE,
  MIN_QUALITY_SHARE,
  REQUIRED_PATHS,
  completeness,
  quality,
  consistency,
  inspect,
};
