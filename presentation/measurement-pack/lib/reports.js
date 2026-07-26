'use strict';
/**
 * تقريرا الحزمة: قبل/أثناء/بعد، والمتوقَّع مقابل المرصود.
 * ---------------------------------------------------------------------------
 * الأول يصف ما حدث. والثاني يقارن ما حدث بما قاله النموذج — وهو التقرير الذي
 * يعاير أثر، ولا يوجد له اليوم مُدخل واحد.
 *
 * ولذلك كلاهما مكتوب بحيث **يشتغل على حزمة تركيبية للاختبار، ويرفض أن يُنتج
 * حكماً منها**. البنية جاهزة، والحكم ينتظر بيانات.
 */

const { canClaimCausal } = require('./counterfactual.js');

function samples(series) {
  return (series && Array.isArray(series.samples)) ? series.samples : [];
}

function mean(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function summarise(series) {
  const rows = samples(series);
  const usable = rows.filter((row) => row.quality !== 'failed');
  return {
    samples: rows.length,
    usable: usable.length,
    meanSpeedKph: mean(usable.map((row) => row.speedKph)),
    meanTravelTimeSec: mean(usable.map((row) => row.travelTimeSec)),
    /* الحجم يبقى `null` حين يغيب. المتوسط على مصفوفة فارغة صفرٌ في كثير من
       اللغات، والصفر هنا يعني «لا مركبات» — أسوأ قيمة يمكن أن تُخترع. */
    meanVolumeVehPerHour: mean(usable.map((row) => row.volumeVehPerHour)),
    from: rows.length ? rows[0].at : null,
    to: rows.length ? rows[rows.length - 1].at : null,
  };
}

function delta(before, during, key) {
  if (!Number.isFinite(before[key]) || !Number.isFinite(during[key])) return null;
  return {
    absolute: during[key] - before[key],
    pct: before[key] === 0 ? null
      : ((during[key] - before[key]) / before[key]) * 100,
  };
}

/**
 * تقرير قبل/أثناء/بعد.
 *
 * يعرض الفرق دائماً، ويصفه بحسب ما يجيزه تصميم المقارنة. الفرق حقيقة رصد،
 * ونسبته إلى الإغلاق حكمٌ يحتاج سنداً.
 */
function beforeDuringAfter(study) {
  const verdict = canClaimCausal(study);
  const before = summarise(study && study.series && study.series.before);
  const during = summarise(study && study.series && study.series.during);
  const after = summarise(study && study.series && study.series.after);
  const control = summarise(study && study.series && study.series.control);

  const observed = {
    speed: delta(before, during, 'meanSpeedKph'),
    travelTime: delta(before, during, 'meanTravelTimeSec'),
    volume: delta(before, during, 'meanVolumeVehPerHour'),
  };

  /* الفرق في الفروق يُحسب حين توجد سلسلة مقارنة: فرق المعالَج ناقص فرق
     المقارن. وهو ما يعزل التغيّر الطبيعي عن أثر التدخل. */
  let differenceInDifferences = null;
  if (control.samples && Number.isFinite(control.meanSpeedKph)
    && Number.isFinite(before.meanSpeedKph) && Number.isFinite(during.meanSpeedKph)) {
    differenceInDifferences = {
      treatmentDelta: during.meanSpeedKph - before.meanSpeedKph,
      controlDelta: control.meanSpeedKph - before.meanSpeedKph,
      note: 'الفرق في الفروق على السرعة — يحتاج أن تكون سلسلة المقارنة مقيسة '
        + 'في الفترتين نفسيهما.',
    };
  }

  return {
    periods: { before, during, after, control },
    observed,
    differenceInDifferences,
    causal: verdict,
    /* الجملة تُولَّد من الحكم لا تُكتب في الواجهة: صياغتان لنتيجة واحدة
       تختلفان بين سطحين هي كيف يتسرّب الادعاء. */
    statement: verdict.allowed
      ? verdict.phrasing
      : verdict.reason + ' — ' + verdict.phrasing,
    recovery: after.samples && Number.isFinite(after.meanSpeedKph)
      && Number.isFinite(before.meanSpeedKph)
      ? {
        gapKph: after.meanSpeedKph - before.meanSpeedKph,
        note: 'فرق «بعد» عن «قبل». قربه من الصفر يشير إلى تعافٍ، ولا يثبته '
          + 'بلا الحالة المقابلة نفسها.',
      }
      : null,
  };
}

/**
 * المتوقَّع مقابل المرصود — تقرير المعايرة.
 *
 * @param {object} study حزمة ميدانية.
 * @param {object} predicted `{ delayVehHours, source }` من محرك مسار.
 */
function expectedVsObserved(study, predicted) {
  const report = beforeDuringAfter(study);
  const verdict = report.causal;

  const base = {
    predicted: predicted || null,
    observed: report.observed,
    periods: report.periods,
    causal: verdict,
  };

  if (!predicted || !Number.isFinite(predicted.delayVehHours)) {
    return Object.assign(base, {
      comparable: false,
      reason: 'لا توقّع من النموذج على هذه الحالة — لا شيء يُقارن به.',
      calibrationAllowed: false,
    });
  }

  /* الوحدة: النموذج يخرج ساعات-مركبة، والقياس الميداني يعطي سرعة وزمناً
     وربما حجماً. تحويل الملاحظة إلى ساعات-مركبة يحتاج الحجم — وهو أكثر ما
     يغيب. فالمقارنة تُمنع بسبب معلن بدل أن تُجرى على وحدتين مختلفتين. */
  const volumeAvailable = Number.isFinite(report.periods.during.meanVolumeVehPerHour);
  if (!volumeAvailable) {
    return Object.assign(base, {
      comparable: false,
      reason: 'المرصود سرعة وزمن، والمتوقَّع ساعات-مركبة. تحويل الأول إلى '
        + 'الثاني يحتاج حجم حركة، وهو غائب. المقارنة على وحدتين مختلفتين '
        + 'تُنتج رقم معايرة بلا معنى.',
      calibrationAllowed: false,
      whatWouldFixIt: 'مصدر حجم على المقطع بدقة الفاصل الزمني نفسه — عدّاد '
        + 'الجهة أو بيانات وزارة النقل إن كانت بهذه الدقة.',
    });
  }

  const observedVehHours = observedDelayVehHours(report);
  const error = observedVehHours === null ? null : {
    absolute: predicted.delayVehHours - observedVehHours,
    pct: observedVehHours === 0 ? null
      : ((predicted.delayVehHours - observedVehHours) / observedVehHours) * 100,
  };

  return Object.assign(base, {
    comparable: true,
    observedVehHours,
    error,
    /* المعايرة من حالة واحدة ممنوعة. حالةٌ واحدة تعطي نقطة، والنقطة لا
       تعطي معاملاً — وتعديل ثابت النموذج عليها يجعله يصف تلك الحالة وحدها. */
    calibrationAllowed: false,
    calibrationRule: 'لا تُعدَّل معاملات النموذج من حالة واحدة. المعايرة تبدأ '
      + 'بعيّنة صالحة من عدة حالات، وتمرّ بحوكمة تُسجّل ما تغيّر ولماذا.',
    causalNote: verdict.allowed ? verdict.caveat : verdict.phrasing,
  });
}

/**
 * ساعات-المركبة المرصودة = فرق زمن الرحلة × الحجم × مدة الفترة.
 *
 * تُعاد `null` إن نقص أي عنصر. الحساب التقريبي هنا معلن التقريب: يفترض ثبات
 * الحجم داخل الفترة، وهو تبسيطٌ يُذكر لا يُخفى.
 */
function observedDelayVehHours(report) {
  const during = report.periods.during;
  const before = report.periods.before;
  if (!Number.isFinite(during.meanTravelTimeSec)
    || !Number.isFinite(before.meanTravelTimeSec)
    || !Number.isFinite(during.meanVolumeVehPerHour)) return null;

  const from = Date.parse(during.from);
  const to = Date.parse(during.to);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return null;

  const hours = (to - from) / 3600000;
  const extraSecPerVehicle = during.meanTravelTimeSec - before.meanTravelTimeSec;
  return (extraSecPerVehicle / 3600) * during.meanVolumeVehPerHour * hours;
}

module.exports = { summarise, beforeDuringAfter, expectedVsObserved, observedDelayVehHours };
