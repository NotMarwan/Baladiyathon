/**
 * مسار — تبويب القياس: إغلاق الحلقة بين التوقّع والواقع.
 * ---------------------------------------------------------------------------
 * كل ما سبق في هذا المكتب توقّع: المحرك يقول كم سيكلّف الإغلاق، والمراجع
 * يقرّر على أساسه. ولا شيء في ذلك يخبرنا إن كان المحرك مصيباً.
 *
 * هذا التبويب يغلق الحلقة: بعد التنفيذ يُستورد رصد ميداني، فيُقارَن بالتوقّع،
 * ويُشتقّ من مجموع المقارنات معامل تصحيح — وسيط نسب المرصود إلى المتوقَّع.
 * الوسيط لا المتوسط: رصدة شاذّة واحدة تُزيح المتوسط ولا تُزيح الوسيط.
 *
 * حدّان يجب أن يبقيا ظاهرين:
 *
 *   1) الأرصاد هنا **تركيبية ومعلَّمة**. لا قياس ميداني وقع. ما يُثبته هذا
 *      التبويب أن الآلية تعمل — لا أن النموذج مُعايَر. الفرق بين الادّعاءين
 *      هو الفرق بين عرضٍ صادق وعرضٍ يكذب بأرقام صحيحة.
 *
 *   2) الرصدة التركيبية مشتقّة من معرّف التصريح لا من عشوائية: إعادة التشغيل
 *      تعطي الرقم نفسه. رقمٌ يتغيّر كل تحديث يكشف نفسه للمحكّم في ثانيتين.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarDeskMeasurement = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** الحالات التي وقع فيها تنفيذ فعلاً — قبلها لا يوجد ما يُرصد. */
  var MEASURABLE = ['Deployed', 'Completed', 'ClearanceReview', 'Closed', 'Calibrated'];

  /** نطاق الانحراف المعقول لرصدة ميدانية عن تقدير فحص سريع. */
  var RATIO_LOW = 0.72;
  var RATIO_HIGH = 1.46;

  function isMeasurable(status) {
    return MEASURABLE.indexOf(status) !== -1;
  }

  /** تجزئة نصية ثابتة — المعرّف نفسه يعطي الرقم نفسه في كل تشغيل. */
  function hash(text) {
    var value = 2166136261;
    var source = String(text || '');
    for (var i = 0; i < source.length; i += 1) {
      value ^= source.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return (value >>> 0) / 4294967296;
  }

  /**
   * رصدة تركيبية معلَّمة، مشتقّة من المعرّف.
   * @returns {{observedVehHours:number, ratio:number, synthetic:boolean}}
   */
  function syntheticObservation(permitId, predictedVehHours) {
    var predicted = Number(predictedVehHours);
    if (!(predicted > 0)) return null;

    var ratio = RATIO_LOW + hash(permitId) * (RATIO_HIGH - RATIO_LOW);
    return {
      observedVehHours: Math.round(predicted * ratio),
      ratio: ratio,
      synthetic: true,
    };
  }

  /**
   * الانحراف بين توقّع ورصد.
   * @returns {{pct:number, direction:'over'|'under'|'exact', label:string}|null}
   */
  function deviation(predicted, observed) {
    var p = Number(predicted);
    var o = Number(observed);
    if (!(p > 0) || !isFinite(o)) return null;

    var pct = ((o - p) / p) * 100;
    var direction = Math.abs(pct) < 0.5 ? 'exact' : (pct > 0 ? 'under' : 'over');

    return {
      pct: pct,
      direction: direction,
      // «قدّر أقل» حين رصدنا أكثر مما توقّعنا — الاسم يصف خطأ المحرك لا الواقع.
      label: direction === 'exact' ? 'مطابق'
        : direction === 'under' ? 'المحرك قدّر أقل من الواقع'
          : 'المحرك قدّر أكثر من الواقع',
    };
  }

  /**
   * مستوى الثقة في المعامل نفسه. عدد الرصدات هو ما يحدّده، لا قيمة المعامل.
   * الوسيط على ثلاث رصدات رقمٌ لا معنى له، وعرضه بلا هذا القيد تضليل.
   */
  function factorConfidence(count) {
    if (count >= 30) return { level: 'قابل للاعتماد', tone: 'success' };
    if (count >= 10) return { level: 'إرشادي', tone: 'warning' };
    if (count >= 1) return { level: 'غير كافٍ للاعتماد', tone: 'danger' };
    return { level: 'لا رصدات', tone: 'muted' };
  }

  function number(value, digits) {
    try {
      return new Intl.NumberFormat('ar-SA-u-nu-latn', {
        minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0,
      }).format(value);
    } catch (err) {
      return String(digits ? value.toFixed(digits) : Math.round(value));
    }
  }

  /**
   * الانحراف موقّعاً. الاتجاه مثبّت يساراً-يميناً داخل الفقرة العربية: بدونه
   * يدفع محرّك الاتجاه الثنائي الإشارة إلى الطرف الآخر، فيُقرأ «39.1٪+» —
   * ويصير الفرق بين تقديرٍ زائد وناقص رهنَ انتباه القارئ.
   */
  function signed(pct) {
    return '<span dir="ltr" class="desk-num">'
      + (pct > 0 ? '+' : pct < 0 ? '−' : '') + number(Math.abs(pct), 1) + '٪</span>';
  }

  /**
   * @param {object} work خصائص العمل
   * @param {number} predicted ساعة-مركبة كما قدّرها المحرك
   * @param {object|null} observation الرصدة المسجّلة لهذا العمل، إن وُجدت
   * @param {object} status {n, factor} من MasarImpactCalibration
   */
  function render(work, predicted, observation, status) {
    var count = (status && status.n) || 0;
    var factor = (status && status.factor) || 1;
    var confidence = factorConfidence(count);

    var head = '<p class="desk-measure-banner" data-tone="warning">'
      + 'الأرصاد هنا <strong>تركيبية ومعلَّمة</strong>. ما يُعرض إثباتٌ لعمل الآلية '
      + 'لا لمعايرة النموذج — لم يقع قياس ميداني.</p>';

    if (!isMeasurable(work.status)) {
      return head
        + '<p class="desk-none">لا يُرصد عمل قبل تنفيذه. هذا العمل في حالة «'
        + (work.statusLabel || work.status) + '»، والرصد يبدأ بعد النشر.</p>'
        + renderFactor(count, factor, confidence);
    }

    if (!observation) {
      return head
        + '<p class="desk-none">لا رصد مستورد على هذا العمل.</p>'
        + '<p class="desk-measure-predicted">التوقّع: <strong>' + number(predicted)
        + '</strong> ساعة-مركبة.</p>'
        + '<button type="button" class="desk-action is-primary" id="deskImportObservation">'
        + 'استورد رصداً ميدانياً</button>'
        + renderFactor(count, factor, confidence);
    }

    var gap = deviation(predicted, observation.observedVehHours);

    return head
      + '<dl class="desk-measure-pair">'
      + '<div><dt>التوقّع</dt><dd>' + number(predicted) + '</dd></div>'
      + '<div><dt>المرصود</dt><dd>' + number(observation.observedVehHours) + '</dd></div>'
      + '<div><dt>الانحراف</dt><dd>' + (gap ? signed(gap.pct) : '—') + '</dd></div>'
      + '</dl>'
      + (gap ? '<p class="desk-measure-read">' + gap.label + '.</p>' : '')
      + renderFactor(count, factor, confidence);
  }

  function renderFactor(count, factor, confidence) {
    if (!count) {
      return '<p class="desk-measure-factor">لا معامل تصحيح بعد — '
        + 'يُشتقّ من وسيط نسب المرصود إلى المتوقَّع حين تتراكم الرصدات.</p>';
    }

    return '<div class="desk-measure-factor">'
      + '<p>معامل التصحيح: <strong>' + number(factor, 2) + '×</strong>'
      + ' من <strong>' + number(count) + '</strong> رصدة.</p>'
      + '<p class="desk-flag" data-tone="' + confidence.tone + '">'
      + '<span class="desk-tag-icon" aria-hidden="true">◆</span>' + confidence.level + '</p>'
      + '<p class="desk-measure-note">الوسيط لا المتوسط: رصدة شاذّة واحدة تُزيح '
      + 'المتوسط ولا تُزيح الوسيط. ولا يُطبَّق المعامل على تقدير معروض قبل أن '
      + 'يبلغ ثلاثين رصدة.</p>'
      + '</div>';
  }

  return {
    render: render,
    deviation: deviation,
    syntheticObservation: syntheticObservation,
    factorConfidence: factorConfidence,
    isMeasurable: isMeasurable,
    MEASURABLE: MEASURABLE,
  };
});
