/**
 * مسار — المؤشرات الحاكمة (WP-A5).
 * ---------------------------------------------------------------------------
 * عشرة تناقضات في تقرير التحكيم، وسببها واحد: كل سطح يحمل نسخته من الرقم.
 * 2.5M مقابل 2.2 مليون، و12 ممراً مقابل 114 شارعاً، و16 خاصية مقابل 42،
 * و177 اختباراً مقابل 46. لا أحد كذب؛ لا أحد كان يفحص.
 *
 * الحلّ ليس مقارنة الصفحات ببعضها — تلك تُثبت الاتساق ولا تُثبت الصحة، وصفحتان
 * متطابقتان على رقم خاطئ تمرّان. الحلّ **مصدر حاكم واحد** تُقارَن به الأسطح.
 *
 * والخطر المقابل: أن يصير هذا الملف مكاناً جديداً لزرع أرقام غير محسوبة. لذلك
 * **لا يحمل رقماً مكتوباً يدوياً**. كل قيمة تُحسب من بيانات المحفظة عند
 * الاستدعاء، والاختبار يقارن المستهلكين بالناتج لا بثابت مخزَّن.
 *
 * ما يدخل هنا: المؤشرات التي تظهر في أكثر من سطح. ما لا يظهر إلا في مكان
 * واحد لا يحتاج توحيداً.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./masar-portfolio.js'),
      require('./masar-engine.js'),
      require('./data/wzdx-conformance-summary.json'),
      require('./data/delta-decomposition.json')
    );
  } else {
    root.MasarCanonical = factory(root.MasarPortfolio, root.MasarEngine,
      root.MASAR_WZDX_CONFORMANCE, root.MASAR_DELTA_DECOMPOSITION);
  }
})(typeof self !== 'undefined' ? self : this, function (Portfolio, Engine, wzdx, delta) {
  'use strict';

  /**
   * حصيلة المطابقة المعيارية — مقروءة من تقرير مولَّد، لا مكتوبة هنا.
   *
   * الفرق ليس شكلياً: عبارةٌ فيها «144 من 150» مكتوبةً في هذا الملف تصير
   * كذباً في اللحظة التي تتغير فيها المحفظة أو تُصلَح حالة ممنوعة، ولا شيء
   * ينبّه. مقروءةً من التقرير، تتقادم البيانات ويتقادم النصّ معها.
   */
  var conformance = wzdx || { total: null, passed: null, failed: null };

  /**
   * يحسب المؤشرات الحاكمة من بيانات المحفظة.
   *
   * لا قيمة هنا مكتوبة يدوياً. لو تغيّرت المحفظة أو تغيّر المحرك تغيّرت
   * المؤشرات معهما، ولا يبقى ثابتٌ يكذب على مصدره.
   *
   * @returns {object} مؤشرات، كلٌّ منها {value, unit, meaning}
   */
  function metrics() {
    var portfolio = Portfolio.buildPortfolio(Portfolio.SEED);
    var dig = portfolio.digOnceMerged;
    /* التفكيك مولَّد لا محسوب هنا: يتطلب تشغيل المحرك بثوابت مستبدَلة، وهو
       عمل توليدٍ لا عمل استدعاء. غيابه يسقط صراحةً بدل أن يُعرض الرقم عارياً
       من قيوده — وهو الوضع الذي وُجدت هذه القيود لمنعه. */
    if (!delta || !delta.hourShift || !delta.envelope) {
      throw new Error('تفكيك الدلتا غير محمَّل — شغّل '
        + 'presentation/scripts/build-delta-decomposition.js');
    }
    var dec = delta;

    return {
      portfolioPermitCount: {
        value: portfolio.permitCount,
        unit: 'تصريح',
        meaning: 'حجم المحفظة التمثيلية',
      },
      portfolioMode: {
        value: 'synthetic',
        unit: 'وضع',
        meaning: 'المحفظة مولَّدة ببذرة ثابتة — ليست بيانات رسمية',
      },
      portfolioSeed: {
        value: Portfolio.SEED,
        unit: 'بذرة',
        meaning: 'بذرة التوليد الثابتة — شرط إعادة الإنتاج',
      },
      corridorCount: {
        value: Portfolio.CORRIDORS.length,
        unit: 'ممر',
        meaning: 'ممرات المحفظة التجريدية',
      },
      coordinationGroupCount: {
        value: dig.groups,
        unit: 'مجموعة',
        meaning: 'مجموعات التنسيق المكتشفة',
      },
      groupedPermitCount: {
        value: dig.permits,
        unit: 'تصريح',
        meaning: 'التصاريح الواقعة داخل مجموعات تنسيق',
      },
      additionalPermitsInGroups: {
        value: dig.additionalPermitsInGroups,
        unit: 'تصريح',
        /* الدلالة مقيَّدة عمداً: عدٌّ لا ادعاء أثر. «حفريات متجنَّبة» يحتاج
           هندسة النطاقات وتفاصيل التنفيذ. */
        meaning: 'التصاريح الزائدة عن واحد داخل المجموعات — عدّ لا أثر',
      },
      duplicateTrenchKmEquivalent: {
        value: dig.duplicateTrenchKmEquivalent,
        unit: 'كم',
        meaning: 'طول حفر مكرر مكافئ بافتراض تداخل تام — لا هندسة محسوبة',
      },
      portfolioDeltaVehHours: {
        value: portfolio.totals.savedVehHours,
        unit: 'ساعة-مركبة',
        meaning: 'فرق نموذجي بين الجدول المقدَّم والأمثل — لا قياس ميداني',
      },
      portfolioDeltaPct: {
        value: portfolio.totals.savedPct,
        unit: '٪',
        meaning: 'فرق نموذجي بالنسبة — لا وفر مثبت',
      },
      /* الحدّ «لا وفر مثبت» أعلاه صحيح ولا يكفي: القارئ يرى رقماً كبيراً
         فيقرأه إنجازاً. القيود الثلاثة التالية تُولَّد مع الرقم من المحرك
         نفسه (`scripts/build-delta-decomposition.js`) كي تسافر معه إلى أي
         سطح، فلا يُعرض مفرداً. */
      deltaHourShareLowPct: {
        value: dec.hourShift.lowPct,
        unit: '٪',
        meaning: 'أدنى حصة لإزاحة ساعة البدء من الخفض',
      },
      deltaHourShareHighPct: {
        value: dec.hourShift.highPct,
        unit: '٪',
        /* يتجاوز المئة، وهذا قياس لا خطأ: بنية النوافذ وحدها بلا إزاحة
           الساعة تزيد التأخير، فالساعة تفسّر الخفض كله وزيادة. */
        meaning: 'أعلى حصة لإزاحة ساعة البدء من الخفض — الإسناد يعتمد على ترتيب العوامل',
      },
      deltaEnvelopeLowPct: {
        value: dec.envelope.lowPct,
        unit: '٪',
        meaning: 'أدنى الدلتا عبر افتراضَي الأرضية وأسّ المنحنى — كلاهما بلا سند',
      },
      deltaEnvelopeHighPct: {
        value: dec.envelope.highPct,
        unit: '٪',
        meaning: 'أعلى الدلتا عبر الافتراضين نفسيهما',
      },
      baselineDaytimeStartSharePct: {
        value: dec.baselineRealism.daytimeStartSharePct,
        unit: '٪',
        meaning: 'حصة تصاريح الأساس ببدء نهاري — الدلتا تقيس رداءة الأساس أيضاً',
      },
    };
  }

  /** ما لا يجوز ادعاؤه على أي سطح، مع بديله الصحيح. */
  var BANNED_CLAIMS = [
    {
      pattern: /متوافق مع WZDx|تصدير معياري معتمد|جاهز للنشر/,
      /* WP-WZ2 — الحظر باقٍ، وسببه تغيّر مرةً أخرى.
         كان (WZ1): المحقق الرسمي لم يُشغَّل أصلاً.
         صار: شُغِّل. `WorkZoneFeed.json` من وسم `v4.2` بالتزام مثبَّت، عبر
         `ajv@8`، على مُخرَج المنتج الفعلي لا على عيّنة اختبار.
         ولماذا يبقى الحظر رغم ذلك: **ستّ حالات من مئة وخمسين ممنوعة** لنقص
         امتداد العمل في المصدر. «متوافق» بإطلاق تعني الكل، وهي ليست الكل.
         وحين تُصفَّر الحالات الممنوعة، هذا البند هو ما يُحذَف — لا الرقم
         الذي يُجمَّل. */
      why: 'المحقق الرسمي شُغِّل واجتاز ' + conformance.passed + ' من '
        + conformance.total + '، و' + conformance.failed + ' حالة ممنوعة لنقص '
        + 'امتداد العمل. «متوافق» بإطلاق تشمل الممنوعة وهي ليست منها.',
      instead: conformance.passed + ' من ' + conformance.total + ' تصريحاً اجتازت '
        + 'مخطط WZDx 4.2 الرسمي (ajv، التزام مثبَّت)، و' + conformance.failed
        + ' حالات مُنعت لنقص امتداد العمل في بيانات المصدر.',
    },
    {
      pattern: /حفريات? متجنَّبة|عمليات حفر متجنَّبة|إغلاقان أُلغيا/,
      why: 'العدّ يقول كم تصريحاً زاد عن واحد داخل المجموعة، لا كم حفرة اختفت.',
      instead: 'تصاريح إضافية داخل مجموعات التنسيق.',
    },
    {
      pattern: /طول متجنَّب|مسافة موفَّرة/,
      why: 'الطول مكافئ بافتراض تداخل تام؛ التداخل الهندسي غير محسوب.',
      instead: 'طول حفر مكرر مكافئ (بافتراض تداخل تام).',
    },
    {
      /* الرقم الأخطر في المنتج، لأنه الوحيد الذي يُقرأ إنجازاً بلا وسيط.
         التفكيك المولَّد أثبت ثلاثة أشياء عنه، كلها تنقض قراءته مفرداً:
         جُلّه من إزاحة ساعة البدء وحدها، وموضعه داخل مداه يحدده افتراضان
         بلا سند، وأساسه شبه كلّه بدء نهاري. */
      /* لا يُدرَج «وفر مثبت» هنا رغم كونه الادعاء المقصود حرفياً: لا يرد في
         المستودع إلا داخل نفيه — «لا وفر مثبت» — وهو التحفّظ نفسه. فحظره
         يُسقط البوابةَ على التحفّظات ويترك الادعاءات. */
      pattern: /وفر(?:ت|نا)? \d|توفير \d|خفض(?:نا)? التأخير بنسبة/,
      why: 'الدلتا فرق بين جدولين داخل نموذج، لا وفر مقيس ميدانياً. و'
        + Math.round(delta.hourShift.lowPct) + '٪ إلى '
        + Math.round(delta.hourShift.highPct) + '٪ منها من نقل ساعة العمل '
        + 'إلى الليل وحدها.',
      instead: 'فرق نموذجي بين الجدول المقدَّم والأمثل: '
        + delta.governing.deltaPct.toFixed(1) + '٪ ضمن مدى '
        + delta.envelope.lowPct.toFixed(1) + '–' + delta.envelope.highPct.toFixed(1)
        + '٪ بحسب افتراضين بلا سند، مقابل أساسٍ '
        + Math.round(delta.baselineRealism.daytimeStartSharePct)
        + '٪ منه بدء نهاري. لم يُقَس ميدانياً في الرياض.',
    },
  ];

  return {
    metrics: metrics,
    BANNED_CLAIMS: BANNED_CLAIMS,
  };
});
