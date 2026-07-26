/**
 * مسار — مقارنة المنافسين (WP-C1).
 * ---------------------------------------------------------------------------
 * كل ما هنا منقول من `research/2026-07-23/masar-competitor-benchmarks/`
 * بمصادره الرسمية وتاريخ مراجعتها. لا منافس مخترع ولا قدرة مستنتجة.
 *
 * ثلاث قواعد تحكم هذا الملف، وكلٌّ منها مفروضة ببوابة:
 *
 * 1) **«غير مثبت علناً» ليست «لا يفعلونه».** المنافسون أنظمة تشغيلية مغلقة،
 *    وغيابُ قدرةٍ عن صفحتهم العامة لا ينفي وجودها داخلها. الصياغة تلتزم
 *    بذلك حرفياً — ونفيُ قدرةٍ عن منافس بلا دليل ادعاءٌ كالذي نمنعه على
 *    أنفسنا.
 *
 * 2) **كل منافس يتفوّق في صفٍّ واحد على الأقل.** مقارنةٌ تربح كل صفوفها
 *    دعاية لا مقارنة، ويقرؤها المحكّم كذلك من أول نظرة.
 *
 * 3) **الفصل بين المنفَّذ اليوم وخارطة الطريق صريح.** «سيفعل» في عمود
 *    المقارنة هو أسوأ أنواع الادعاء: يُقرأ «يفعل».
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarCompare = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** تاريخ مراجعة المصادر — واحدٌ لكل الجدول، وهو تاريخ حزمة البحث. */
  var REVIEWED_ON = '2026-07-23';

  /**
   * حالات القدرة.
   * `implemented` يعني: يعمل اليوم ويمكن إظهاره.
   * `partial` يعني: يعمل بحدود معلنة.
   * `roadmap` يعني: غير منفَّذ، مذكور نيّةً — ولا يُحتسب تفوّقاً.
   * `not-public` يعني: لم يظهر في المصادر الرسمية العامة المراجَعة. **ليس نفياً.**
   * `absent` يعني: غير موجود، ويُقال فقط عن أثر نفسه.
   */
  /* `known` يفصل ما نعرفه عمّا لا نعرفه.
     أول صياغة أعطت «غير مثبت علناً» رتبةً **فوق** «غير موجود»، فصار الجهل
     تفوّقاً: منافسٌ لا نعرف عنه شيئاً يبدو متقدّماً على مسار في بُعدٍ لا
     يملكه أثر. وهو استنتاج لا يحمله الدليل في أي اتجاه.
     المجهول لا يُقارَن: لا يُعدّ تفوّقاً ولا يُعدّ تأخّراً. */
  var STATES = {
    implemented: { label: 'منفَّذ', rank: 3, known: true },
    partial: { label: 'منفَّذ بحدود معلنة', rank: 2, known: true },
    roadmap: { label: 'خارطة طريق — غير منفَّذ', rank: 0, known: true },
    'not-public': { label: 'غير مثبت علناً', rank: 0, known: false },
    absent: { label: 'غير موجود', rank: 0, known: true },
  };

  /**
   * هل الحالة الأولى أعلى من الثانية؟
   *
   * `null` تعني «لا يُقارَن» — وهو جوابٌ ثالث لا بد منه حين يكون أحد
   * الطرفين مجهولاً.
   */
  function outranks(a, b) {
    var first = STATES[a];
    var second = STATES[b];
    if (!first || !second) return null;
    if (!first.known || !second.known) return null;
    return first.rank > second.rank;
  }

  var COMPETITORS = [
    {
      key: 'balady',
      name: 'بلدي — تصاريح أعمال البنية التحتية',
      kind: 'منافس مباشر ومنصة يجب التكامل معها',
      source: 'https://balady.gov.sa/ar/services/11722',
      sourceLabel: 'خدمة الخريطة التفاعلية الرسمية',
      relation: 'أثر طبقة قرار قبل الاعتماد وقياس بعد التنفيذ — لا بديل لمنصة '
        + 'التصريح. أي مسار إنتاجي يمرّ عبر بلدي لا حوله.',
    },
    {
      key: 'one-network',
      name: 'Causeway one.network',
      kind: 'أقوى منافس تجاري مباشر',
      source: 'https://us.one.network/product/traffic-management/',
      sourceLabel: 'صفحة إدارة الحركة الرسمية',
      relation: 'منتج ناضج بقاعدة تشغيل حقيقية. أثر نموذج أوليّ — والمقارنة '
        + 'على القدرات لا على النضج.',
    },
    {
      key: 'lta-prompt',
      name: 'LTA PROMPT — سنغافورة',
      kind: 'منصة حكومية عالمية',
      source: 'https://prompt.lta.gov.sg/WebUIPWAS/',
      sourceLabel: 'بوابة طلبات أعمال الطريق الرسمية',
      relation: 'أقرب مرجع حكومي: بوابة تصاريح بذكاء آلي معلن في وثيقة رسمية.',
    },
  ];

  /**
   * الأبعاد المقارَنة.
   *
   * `betterElsewhere` يسمّي المنافسين الذين يتفوّقون في هذا البعد صراحةً —
   * لا يُستنتج من الرتب. الاستنتاج يجعل تغيير وصفٍ يبدّل خريطة التفوّق بصمت.
   */
  var DIMENSIONS = [
    {
      key: 'permit-cycle',
      title: 'دورة التصريح الرسمية وإصداره',
      masar: { state: 'absent', note: 'أثر لا يُصدر تصريحاً ولا يدّعي ذلك.' },
      competitors: {
        balady: { state: 'implemented', note: 'تقديم وتعديل وإيقاف واستئناف وإنهاء.' },
        'one-network': { state: 'implemented', note: 'دورة منطقة عمل كاملة.' },
        'lta-prompt': { state: 'implemented', note: 'بوابة طلبات رسمية.' },
      },
      betterElsewhere: ['balady', 'one-network', 'lta-prompt'],
      source: 'https://balady.gov.sa/ar/services/%D8%AA%D8%B5%D8%A7%D8%B1%D9%8A%D8%AD-%D8%A3%D8%B9%D9%85%D8%A7%D9%84-%D8%A7%D9%84%D8%A8%D9%86%D9%8A%D8%A9-%D8%A7%D9%84%D8%AA%D8%AD%D8%AA%D9%8A%D8%A9',
    },
    {
      key: 'navigation-publish',
      title: 'النشر المباشر إلى تطبيقات الملاحة',
      masar: {
        state: 'partial',
        note: 'التصدير يجتاز مخطط WZDx 4.2 الرسمي عبر ajv (144 من 150)؛ '
          + 'ولا توجد قناة نشر إلى تطبيقات الملاحة.',
      },
      competitors: {
        balady: { state: 'not-public', note: 'لم تظهر قناة نشر ملاحية في المصادر العامة.' },
        'one-network': { state: 'implemented', note: 'نشر مباشر إلى تطبيقات الملاحة.' },
        'lta-prompt': { state: 'not-public', note: 'لم تظهر في المصادر العامة المراجَعة.' },
      },
      betterElsewhere: ['one-network'],
      source: 'https://us.one.network/',
    },
    {
      key: 'live-devices',
      title: 'ربط أجهزة الطريق والتنبيهات الحية',
      masar: { state: 'absent', note: 'لا مستشعرات ولا تغذية حية. النموذج يعمل على بيانات ثابتة.' },
      competitors: {
        balady: { state: 'not-public', note: 'لم تظهر في المصادر العامة المراجَعة.' },
        'one-network': { state: 'implemented', note: 'ربط أجهزة الطريق وتنبيهات حية.' },
        'lta-prompt': { state: 'not-public', note: 'لم تظهر في المصادر العامة المراجَعة.' },
      },
      betterElsewhere: ['one-network'],
      source: 'https://us.one.network/product/traffic-management/',
    },
    {
      key: 'auto-recommendation',
      title: 'توليد خطة التحكم والتوصية الآلية للطلبات',
      masar: {
        state: 'partial',
        note: 'توصية نافذة وخطة إدارة مرور مولَّدة — على محفظة تمثيلية لا على طلبات حقيقية.',
      },
      competitors: {
        balady: { state: 'not-public', note: 'لم تظهر في المصادر العامة المراجَعة.' },
        'one-network': { state: 'implemented', note: 'رسم التحويلات وإدارة الحركة ومشاركتها.' },
        'lta-prompt': {
          state: 'implemented',
          note: 'توليد خطة تحكم وقراءة وثائق وتوصية آلية للطلبات البسيطة، '
            + 'موثَّق في نشرة ابتكار رسمية.',
        },
      },
      betterElsewhere: ['lta-prompt', 'one-network'],
      source: 'https://www.lta.gov.sg/content/dam/ltagov/industry_innovations/Innovations/land_transport_innovation_portal/Enhancement%20of%20Roadworks%20Application%20Process%20using%20Artificial%20Intelligence.pdf',
    },
    {
      key: 'production-scale',
      title: 'تشغيل إنتاجي وقاعدة مستخدمين',
      masar: { state: 'absent', note: 'نموذج أوليّ على جهاز واحد. لا مستخدمين ولا تشغيل.' },
      competitors: {
        balady: { state: 'implemented', note: 'منصة وطنية عاملة.' },
        'one-network': { state: 'implemented', note: 'منتج تجاري بقاعدة عملاء.' },
        'lta-prompt': { state: 'implemented', note: 'بوابة حكومية عاملة.' },
      },
      betterElsewhere: ['balady', 'one-network', 'lta-prompt'],
      source: 'https://balady.gov.sa/ar/open-data',
    },
    {
      key: 'multi-dig-coordination',
      title: 'تنسيق الحفريات المتعددة',
      masar: {
        state: 'partial',
        note: 'تجميع محسوب بالتجاور والنافذة الزمنية — عدُّ تصاريح لا هندسة نطاقات.',
      },
      competitors: {
        balady: { state: 'implemented', note: 'طلب تنسيق حفريات متعددة رسمي.' },
        'one-network': { state: 'implemented', note: 'كشف تعارضات وتعاون بين الجهات.' },
        'lta-prompt': { state: 'not-public', note: 'لم تظهر في المصادر العامة المراجَعة.' },
      },
      betterElsewhere: ['balady', 'one-network'],
      source: 'https://www.balady.gov.sa/ar/services/%D8%B7%D9%84%D8%A8-%D8%AA%D9%86%D8%B3%D9%8A%D9%82-%D8%AD%D9%81%D8%B1%D9%8A%D8%A7%D8%AA-%D9%85%D8%AA%D8%B9%D8%AF%D8%AF%D8%A9',
    },
    {
      key: 'pre-permit-impact',
      title: 'تقدير الأثر المروري بساعات-مركبة قبل الإصدار',
      masar: {
        state: 'implemented',
        note: 'BPR على شبكة الرياض، بنتيجة لكل تصريح وأسباب مشتقّة.',
      },
      competitors: {
        balady: { state: 'not-public', note: 'لم يظهر توقع شبكي منسوب إلى الحفرية.' },
        'one-network': { state: 'not-public', note: 'لم تظهر ساعات-مركبة منسوبة للتصريح.' },
        'lta-prompt': { state: 'not-public', note: 'لم تظهر في المصادر العامة المراجَعة.' },
      },
      betterElsewhere: [],
      source: 'https://shc.rga.gov.sa/content/dam/roadcodes/assets/road-code-library/203%20EN.pdf',
    },
    {
      key: 'switch-point',
      title: 'تفسير التوصية بنقطة انقلابها',
      masar: {
        state: 'implemented',
        note: 'الوزن الذي تنقلب عنده التوصية محسوب ومعروض — فيُقرأ الوزن بمداه لا كرقم مُنزَل.',
      },
      competitors: {
        balady: { state: 'not-public', note: 'لم يظهر ترتيب نافذة بتفسير رقمي.' },
        'one-network': { state: 'not-public', note: 'لم يظهر تفسير رقمي لترتيب النافذة.' },
        'lta-prompt': { state: 'not-public', note: 'لم تظهر في المصادر العامة المراجَعة.' },
      },
      betterElsewhere: [],
      source: 'https://us.one.network/product/traffic-management/',
    },
    {
      key: 'assumption-sensitivity',
      title: 'تحليل حساسية الرقم لكل افتراض',
      masar: {
        state: 'implemented',
        note: 'جدول يقيس تحرُّك الأثر بين حدَّي كل افتراض — ويُظهر أن ثابتاً واحداً يحمل الرقم.',
      },
      competitors: {
        balady: { state: 'not-public', note: 'لم يظهر في المصادر العامة المراجَعة.' },
        'one-network': { state: 'not-public', note: 'لم يظهر في المصادر العامة المراجَعة.' },
        'lta-prompt': { state: 'not-public', note: 'لم يظهر في المصادر العامة المراجَعة.' },
      },
      betterElsewhere: [],
      source: 'https://shc.rga.gov.sa/content/dam/roadcodes/assets/road-code-library/203%20EN.pdf',
    },
    {
      key: 'post-calibration',
      title: 'معايرة التوقع بالنتيجة المرصودة بعد التنفيذ',
      masar: {
        state: 'roadmap',
        note: 'الآلية مبنية والحقول قائمة، ولا بيانات ميدانية تُعايَر بها. غير منفَّذ.',
      },
      competitors: {
        balady: { state: 'not-public', note: 'لم تظهر معايرة توقع بالنتيجة المرصودة.' },
        'one-network': { state: 'not-public', note: 'لم تظهر في المصادر العامة المراجَعة.' },
        'lta-prompt': { state: 'not-public', note: 'لم تظهر في المصادر العامة المراجَعة.' },
      },
      betterElsewhere: [],
      source: 'https://balady.gov.sa/ar/open-data',
    },
  ];

  /* WP-C1 — حُذف `FORBIDDEN_CLAIMS` من هنا.
     لا مستهلك له، وحزمة الفحص تعرّف نمطها بنفسها عمداً — قائمةٌ تُقرأ من
     المُختبَر تُفرَّغ بتعديله. وبقاؤه كان يسقط بوابته على نفسه: النمط يحوي
     العبارات الممنوعة حرفياً. */

  /** المنافسون الذين يتفوّقون في بعدٍ ما. */
  function betterElsewhere(dimension) {
    return (dimension.betterElsewhere || []).slice();
  }

  /** الأبعاد التي يتفوّق فيها منافس بعينه. */
  function advantagesOf(key) {
    return DIMENSIONS.filter(function (dimension) {
      return betterElsewhere(dimension).indexOf(key) !== -1;
    });
  }

  return {
    REVIEWED_ON: REVIEWED_ON,
    STATES: STATES,
    COMPETITORS: COMPETITORS,
    DIMENSIONS: DIMENSIONS,
    outranks: outranks,
    betterElsewhere: betterElsewhere,
    advantagesOf: advantagesOf,
  };
});
