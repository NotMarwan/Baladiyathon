'use strict';
/**
 * حارس الادعاء السببي.
 * ---------------------------------------------------------------------------
 * **الخطأ الذي يمنعه، وهو أكثر أخطاء قياس الأثر شيوعاً.**
 *
 * تُقاس السرعة قبل الإغلاق وأثناءه، فيظهر فرق، فيُقال «الإغلاق سبّب تأخيراً
 * قدره كذا». والفرق قد يكون الإغلاق، وقد يكون أن «قبل» وقعت في إجازة و«أثناء»
 * في أسبوع دراسي، أو أن الطقس تغيّر، أو أن الطلب ينمو أصلاً.
 *
 * السببية تحتاج جواباً عن سؤال واحد: **ماذا كان سيحدث لو لم يقع الإغلاق؟**
 * ولا يُجاب من بيانات المقطع المتأثر وحده مهما كثرت.
 *
 * **ولذلك القاعدة هنا حارس لا نصيحة.**
 *
 * بلا تصميم مقارنة معلن، الدالة **تمنع** حساب الأثر السببي وتفرض الصياغة
 * البديلة. والصياغة البديلة ليست تحفّظاً لغوياً: «فرق مرصود مرتبط زمنياً
 * بالعمل» جملةٌ صحيحة، و«الإغلاق سبّب» جملةٌ قد تكون خاطئة بالكامل.
 */

/** تصاميم المقارنة المقبولة، ولكلٍّ ما يشترطه. */
const DESIGNS = {
  'matched-days': {
    label: 'أيام مماثلة غير متأثرة',
    requires: ['قاعدة مطابقة معلنة (يوم الأسبوع، الموسم، الطقس)'],
    strength: 'متوسط',
    caveat: 'يفترض أن الطلب لم يتغيّر بين الفترتين لسبب آخر.',
  },
  'control-corridor': {
    label: 'محور مقارنة',
    requires: ['هندسة المحور', 'سلسلة قياس عليه في الفترتين'],
    strength: 'قوي',
    caveat: 'يفترض أن المحور لم يتلقَّ الحركة المحوَّلة — وهو افتراض يُفحص لا يُسلَّم.',
  },
  'historical-period': {
    label: 'فترة تاريخية مماثلة',
    requires: ['سلسلة تاريخية على المقطع نفسه'],
    strength: 'ضعيف إلى متوسط',
    caveat: 'أضعفها: يفترض ثبات الطلب عبر الزمن.',
  },
  'difference-in-differences': {
    label: 'الفروق في الفروق',
    requires: ['محور مقارنة', 'سلسلة قبل وأثناء لكلٍّ من المعالَج والمقارن'],
    strength: 'قوي',
    caveat: 'يفترض اتجاهات متوازية قبل التدخل — ويُفحص على فترة «قبل».',
  },
  matching: {
    label: 'مطابقة معلنة',
    requires: ['قاعدة المطابقة', 'متغيّرات المطابقة'],
    strength: 'متوسط',
    caveat: 'قوّته بقدر ما تُطابَق من متغيّرات، وما لم يُطابَق يبقى منحازاً.',
  },
};

/** الصياغة الوحيدة المسموحة حين لا يوجد تصميم مقارنة. */
const OBSERVED_ONLY = 'فرق مرصود مرتبط زمنياً بالعمل، وليس أثراً سببياً مثبتاً.';

/**
 * هل يجوز حساب أثر سببي من هذه الحزمة؟
 *
 * @param {object} study
 * @returns {{allowed:boolean, design:(string|null), reason:string, phrasing:string,
 *            caveat:string, missing:string[]}}
 */
function canClaimCausal(study) {
  const design = study && study.counterfactual && study.counterfactual.design;
  const missing = [];

  if (study && study.study && study.study.synthetic) {
    return {
      allowed: false, design: null, missing: ['بيانات حقيقية'],
      reason: 'الحزمة تركيبية. المثال التركيبي لاختبار الاستيراد ولا يُحسب '
        + 'منه أثر مهما اكتمل.',
      phrasing: OBSERVED_ONLY, caveat: '',
    };
  }

  if (!design || design === 'none' || !DESIGNS[design]) {
    return {
      allowed: false, design: design || null,
      missing: ['تصميم مقارنة من: ' + Object.keys(DESIGNS).join('، ')],
      reason: 'لا حالة مقابلة. مقارنة «قبل» بـ«أثناء» وحدها لا تفصل أثر '
        + 'الإغلاق عن التغيّر الطبيعي.',
      phrasing: OBSERVED_ONLY, caveat: '',
    };
  }

  const spec = DESIGNS[design];

  /* التصميم المعلن لا يكفي — شروطه تُفحص. حزمةٌ تقول «محور مقارنة» وليس فيها
     سلسلة له تُعلن تصميماً لم يُنفَّذ. */
  if (design === 'control-corridor' || design === 'difference-in-differences') {
    if (!study.geometry || !study.geometry.controlCorridor) {
      missing.push('geometry.controlCorridor');
    }
    if (!study.series || !study.series.control) {
      missing.push('series.control');
    }
  }
  if (design === 'matched-days' || design === 'matching') {
    if (!study.counterfactual.matchingRule) missing.push('counterfactual.matchingRule');
    if (!study.series || !study.series.control) missing.push('series.control');
  }
  if (design === 'historical-period' && (!study.series || !study.series.control)) {
    missing.push('series.control (السلسلة التاريخية)');
  }

  if (missing.length) {
    return {
      allowed: false, design, missing,
      reason: `التصميم «${spec.label}» معلن وشروطه ناقصة: ${missing.join('، ')}. `
        + 'تصميمٌ معلن غير منفَّذ أخطر من غيابه — يوحي بضبطٍ لم يحدث.',
      phrasing: OBSERVED_ONLY, caveat: spec.caveat,
    };
  }

  return {
    allowed: true, design, missing: [],
    reason: `تصميم «${spec.label}» معلن ومكتمل الشروط.`,
    phrasing: `أثر مقدَّر بتصميم ${spec.label} — قوّة التصميم: ${spec.strength}.`,
    caveat: spec.caveat,
  };
}

/**
 * يحرس أي عبارة قبل عرضها.
 *
 * تُستدعى من كل سطح يعرض نتيجة قياس. الفصل بين «يجوز الحساب» و«يجوز القول»
 * مقصود: الحساب قد يجري للتحليل الداخلي، والقول يصل الجهة.
 */
const CAUSAL_WORDS = ['سبّب', 'تسبب', 'أثر الإغلاق', 'أدى إلى', 'نتج عن الإغلاق',
  'أثر مثبت', 'أثبتنا'];

function checkPhrasing(text, verdict) {
  const body = String(text || '');
  if (verdict && verdict.allowed) return { ok: true, violations: [] };
  const violations = CAUSAL_WORDS
    .filter((word) => body.indexOf(word) !== -1)
    .map((word) => `«${word}» ادّعاء سببي بلا حالة مقابلة — الصياغة المسموحة: ${OBSERVED_ONLY}`);
  return { ok: violations.length === 0, violations };
}

module.exports = { DESIGNS, OBSERVED_ONLY, CAUSAL_WORDS, canClaimCausal, checkPhrasing };
