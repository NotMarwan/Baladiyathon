/**
 * أثر — عقد المصدر والثقة (WP-T1).
 * ---------------------------------------------------------------------------
 * المحكّم ينظر إلى رقم فلا يعرف من أين جاء. صفحة المصادر ممتازة، لكنها صفحة
 * منفصلة: تُقرأ إن قُصدت، ولا تُقرأ مع الرقم. فيقع الخلط بين ما هو رسمي وما
 * هو مولَّد — وفي هذا المشروع الخلط ليس نظرياً: 82٪ من مضلعات المباني
 * تركيبية، و96٪ من مواقع الإشارات مستنتجة، وأرصاد القياس التسعة عشر
 * اصطناعية كلها.
 *
 * هذه الوحدة تلصق بالرقم أصله. وهي **عقد صغير مقصود**، لا منصة حوكمة بيانات:
 *
 *   • لا حاسبة ثقة رقمية. «ثقة ٨٧٪» تحوّل الشك إلى دقة زائفة، وهي أخطر من
 *     الجهل بالمصدر لأنها تبدو معرفة.
 *   • لا محرك سياسات يمنع القرار. المنع مكان آخر (WP-T2).
 *   • لا لوحة إدارة مصادر ولا تتبّع لكل قيمة ثانوية.
 *   • النطاق: الأرقام التي يراها المحكّم ويقرأها في العرض والتصدير فقط.
 *
 * الحقول الثمانية عقدٌ لا اقتراح. `assert()` تفرضها، والاختبارات تفشل عند
 * أي رقم رئيسي بلا نوع مصدر، أو مشتقٍّ بلا طريقة اشتقاق، أو تقديريٍّ بلا
 * افتراضات وحدود.
 *
 * UMD بنفس نمط athar-engine.js. بلا DOM وبلا شبكة وبلا Date.now — تُختبر في
 * Node، وتعطي المخرج نفسه في المتصفح.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharProvenance = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * أنواع المصادر الستة، مرتّبةً من الأقوى إلى الأضعف.
   *
   * الترتيب ليس تجميلاً: الواجهة تعرض النوع نصّاً لا لوناً وحده، والاختبارات
   * تمنع وصف الأضعف بلغة الأقوى — تحديداً منع كلمة «حي» على أي شيء دون
   * `observed`.
   */
  var SOURCE_TYPES = {
    official: {
      key: 'official',
      label: 'رسمي',
      note: 'من جهة رسمية منشورة بتاريخ ومرجع',
      live: true,
    },
    observed: {
      key: 'observed',
      label: 'مرصود',
      note: 'قياس ميداني أو عدّاد بوقت رصد',
      live: true,
    },
    imported: {
      key: 'imported',
      label: 'مستورَد',
      note: 'من مصدر خارجي مفتوح — يحمل ترخيصه وتاريخه',
      live: false,
    },
    derived: {
      key: 'derived',
      label: 'مشتق',
      note: 'محسوب بمعادلة معلنة من قيم أخرى',
      live: false,
    },
    estimated: {
      key: 'estimated',
      label: 'تقديري',
      note: 'افتراض معلن — لا مصدر له، ويُعاير ببيانات المشغّل',
      live: false,
    },
    synthetic: {
      key: 'synthetic',
      label: 'اصطناعي',
      note: 'مولَّد ببذرة ثابتة لغرض العرض — ليس بياناً واقعياً',
      live: false,
    },
  };

  var ORDER = ['official', 'observed', 'imported', 'derived', 'estimated', 'synthetic'];

  function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === '';
  }

  /**
   * يبني قيمة موسومة بمصدرها، ويرفض العقد الناقص عند البناء لا عند العرض.
   *
   * الرفض المبكر مقصود: قيمة تصل الواجهة بلا نوع مصدر ستُعرض بلا شارة، وذلك
   * أسوأ من انهيار — لأن غياب الشارة يُقرأ «لا مشكلة».
   *
   * @param {object} spec
   * @param {number|string} spec.value القيمة كما تُعرض
   * @param {string} spec.unit الوحدة — «ساعة-مركبة»، «كم»، «﷼»…
   * @param {string} spec.sourceType أحد الستة أعلاه
   * @param {string} [spec.sourceId] معرّف السطر في سجل المصادر — src-0NN
   * @param {string} [spec.observedAt] وقت الرصد أو التوليد، ISO أو نصّ تاريخ
   * @param {string} [spec.derivedBy] المعادلة أو الوحدة التي اشتقّت القيمة
   * @param {string[]} [spec.assumptions] الافتراضات الداخلة في الرقم
   * @param {string} [spec.limitations] ما لا يصلح هذا الرقم له
   * @returns {object} قيمة مختومة
   */
  function value(spec) {
    var input = spec || {};
    var type = SOURCE_TYPES[input.sourceType];

    if (!type) {
      throw new Error('نوع مصدر غير معروف: ' + String(input.sourceType)
        + ' — المسموح: ' + ORDER.join('، '));
    }
    if (isBlank(input.unit)) {
      throw new Error('قيمة بلا وحدة: رقم بلا وحدة لا يُقرأ ولا يُقارن');
    }

    // المشتق بلا طريقة اشتقاق ادعاء حساب لا يمكن مراجعته.
    if (type.key === 'derived' && isBlank(input.derivedBy)) {
      throw new Error('قيمة مشتقة بلا derivedBy — المعادلة جزء من الرقم');
    }

    // التقديري والاصطناعي بلا افتراضات وحدود يُقرآن حقيقةً. وهذا بالضبط ما
    // خفّض درجة المشروع: ثابت غير مصدري يحرّك الرقم الرئيسي ثمانية أضعاف
    // ولا يظهر منه شيء.
    if (type.key === 'estimated' || type.key === 'synthetic') {
      if (!Array.isArray(input.assumptions) || input.assumptions.length === 0) {
        throw new Error('قيمة ' + type.label + ' بلا assumptions — الافتراض المخفي يُقرأ حقيقة');
      }
      if (isBlank(input.limitations)) {
        throw new Error('قيمة ' + type.label + ' بلا limitations — حدود الاستخدام جزء من الرقم');
      }
    }

    // الرسمي والمرصود يدّعيان زمناً. ادعاء الحداثة بلا وقت رصد لا يُتحقّق منه.
    if (type.live && isBlank(input.observedAt)) {
      throw new Error('قيمة ' + type.label + ' بلا observedAt — لا يُدّعى حداثة بلا وقت');
    }

    return {
      value: input.value,
      unit: String(input.unit),
      sourceType: type.key,
      sourceLabel: type.label,
      sourceId: isBlank(input.sourceId) ? null : String(input.sourceId),
      observedAt: isBlank(input.observedAt) ? null : String(input.observedAt),
      derivedBy: isBlank(input.derivedBy) ? null : String(input.derivedBy),
      assumptions: Array.isArray(input.assumptions) ? input.assumptions.slice() : [],
      limitations: isBlank(input.limitations) ? null : String(input.limitations),
    };
  }

  /**
   * هل يجوز وصف هذه القيمة بأنها «حية»؟
   *
   * الفكرة 016 في سجل أفكار البحث التنافسي، وقاعدة حمراء في رُبرك التحكيم:
   * بيانات اصطناعية أو قديمة توصف حيةً خداعٌ لا خطأ عرض.
   */
  function mayClaimLive(sealed) {
    if (!sealed || !SOURCE_TYPES[sealed.sourceType]) return false;
    return SOURCE_TYPES[sealed.sourceType].live === true && !!sealed.observedAt;
  }

  /**
   * صياغة سطر مصدر للعرض بجانب الرقم.
   * نصّ لا لون: قارئ الشاشة وضعيف تمييز الألوان يقرآن الحالة نفسها.
   */
  function caption(sealed) {
    if (!sealed) return '';
    var parts = [SOURCE_TYPES[sealed.sourceType].label];
    if (sealed.sourceId) parts.push(sealed.sourceId);
    if (sealed.observedAt) parts.push('رُصد ' + sealed.observedAt);
    if (sealed.derivedBy) parts.push(sealed.derivedBy);
    if (sealed.assumptions.length) {
      parts.push('افتراضات: ' + sealed.assumptions.join('، '));
    }
    if (sealed.limitations) parts.push('لا يصلح لـ: ' + sealed.limitations);
    return parts.join(' · ');
  }

  /**
   * يفحص مجموعة قيم معروضة ويعيد المخالفات.
   * تستعملها البوابة والواجهة معاً: البوابة لتفشل، والواجهة لتمتنع عن العرض.
   */
  function violations(sealedByKey) {
    var out = [];
    Object.keys(sealedByKey || {}).forEach(function (key) {
      var sealed = sealedByKey[key];
      if (!sealed || !sealed.sourceType) {
        out.push(key + ': بلا sourceType');
        return;
      }
      if (!SOURCE_TYPES[sealed.sourceType]) {
        out.push(key + ': نوع مصدر غير معروف — ' + sealed.sourceType);
      }
      if (isBlank(sealed.unit)) out.push(key + ': بلا وحدة');
    });
    return out;
  }

  return {
    SOURCE_TYPES: SOURCE_TYPES,
    ORDER: ORDER,
    value: value,
    mayClaimLive: mayClaimLive,
    caption: caption,
    violations: violations,
  };
});
