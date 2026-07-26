/**
 * أثر — حساسية الأثر للافتراضات (WP-E1).
 * ---------------------------------------------------------------------------
 * السؤال الذي تجيبه هذه الوحدة هو أقسى ما يُسأل عن رقم غير مقيس ميدانياً:
 * **إذا كان مبنياً على افتراضات، فأيّ افتراض يحمله؟ وكم يتحرك إن تحرّك؟**
 *
 * الجواب المعتاد «كل الافتراضات موسومة» جوابٌ عن الشفافية لا عن المتانة.
 * الوسم يقول «هذا افتراض»؛ ولا يقول إن تغييره في نطاقه المعقول يقلب الرقم
 * ضعفين أو لا يحرّكه بواحد بالمئة. الفرق بين الحالتين هو الفرق بين رقم
 * يُبنى عليه قرار ورقمٍ لا يُبنى عليه شيء.
 *
 * ثلاث قواعد تحكم هذا الملف:
 *
 * 1) **لا رقم مخزَّن.** كل قيمة تُحسب عند الاستدعاء بتمرير الافتراض المعدَّل
 *    إلى المحرك الحقيقي. جدول محفوظ يصير خلال أسبوع وصفاً لنسخة ماضية.
 *
 * 2) **لا إعادة كتابة للخوارزمية.** التحليل يمرّ بـ`AtharEngine.score` و
 *    `optimize` أنفسهما. حسابٌ موازٍ داخل أداة التحقق يكرّر خطأ المحرك إن
 *    وُجد ثم يشهد لنفسه بالسلامة.
 *
 * 3) **النطاق معلَّل لا مختار.** لكل افتراض حقل `why` يقول من أين جاء حدّاه.
 *    نطاقٌ ضيّق بلا سبب يصنع متانةً كاذبة، وواسعٌ بلا سبب يصنع هشاشة كاذبة.
 *
 * وما لا تدّعيه: هذا **تحليل حساسية**، لا تحقّق من الصحة. يقول كم يتحرك
 * الرقم إن تحرّك الافتراض؛ ولا يقول إن الافتراض صحيح. الصحة تحتاج قياساً
 * ميدانياً لا يملكه النموذج.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./athar-engine.js'),
      require('./athar-comparable-cases.js'));
  } else {
    root.AtharSensitivity = factory(root.AtharEngine, root.AtharComparableCases);
  }
})(typeof self !== 'undefined' ? self : this, function (Engine, Cases) {
  'use strict';

  /**
   * النطاق المشتقّ من سجل الحالات المقارنة.
   *
   * يُقرأ ولا يُكتب هنا. الرقم الذي يُنسخ من دراسة إلى شيفرة ينفصل عن سنده
   * في أول تعديل، فيبقى في الجدول بلا مصدر يُراجَع.
   */
  var frictionPrior = (Cases && Cases.priorFor
    && Cases.priorFor('capacityPerLaneInWorkZone')) || null;

  /**
   * يعيد تشكيل ملف الطلب الساعي بأسٍّ واحد ثم يُطبّع.
   *
   * `k > 1` يحدّ الذروة، و`k < 1` يفلطحها نحو التوزيع المنتظم، و`k = 1` هو
   * الملف كما هو. الأسّ أنظف من إزاحة الذروات يدوياً: يحفظ ترتيب الساعات
   * (فتبقى الذروة ذروةً والقاع قاعاً) ويغيّر حدّتها وحدها، فما يُقاس هو أثر
   * **حدّة الذروة** لا أثر إعادة ترتيب اليوم.
   *
   * @param {number[]} profile أربع وعشرون كسراً مجموعها واحد
   * @param {number} k الأسّ
   * @returns {number[]} ملف مطبَّع
   */
  function reshapeProfile(profile, k) {
    var raised = profile.map(function (value) { return Math.pow(value, k); });
    var total = raised.reduce(function (sum, value) { return sum + value; }, 0);
    return raised.map(function (value) { return value / total; });
  }

  /** توقيع التوصية: الساعة والمراحل وطول النافذة. */
  function winnerOf(plan) {
    var top = (plan && plan.top3 && plan.top3[0]) || null;
    if (!top) return 'لا توصية';
    return top.startHour + 'p' + top.phases + 'w' + top.windowHours;
  }

  function withCalibration(input, patch) {
    return Object.assign({}, input, {
      calibration: Object.assign({}, input.calibration || {}, patch),
    });
  }

  function withField(input, field, value) {
    var next = Object.assign({}, input);
    next[field] = value;
    return next;
  }

  function withWeight(input, name, value) {
    var weights = Object.assign({}, input.weights || {});
    weights[name] = value;
    return Object.assign({}, input, { weights: weights });
  }

  /**
   * جرد الافتراضات المفحوصة.
   *
   * `kind` يفصل ثلاثة أنواع لا تُخلط:
   *   · `محسوب` — ثابت فيزيائي أو هندسي يدخل معادلة.
   *   · `وزن معلن` — تفضيل لا قياس له، يُرجَّح به بين أهداف.
   *   · `مُدخل غير مقيس` — بيانات موقع لا يملك النموذج قياسها.
   *
   * الأخير هو الأخطر عادةً، وإخراجه من الجرد يجعل التحليل يمدح نفسه:
   * ثوابت المحرك متينة بينما الرقم كله معلّق على حركةٍ مقدَّرة بالعين.
   */
  var ASSUMPTIONS = [
    {
      key: 'aadt',
      label: 'الحركة اليومية للشارع (AADT)',
      kind: 'مُدخل غير مقيس',
      unit: 'مركبة/يوم',
      baseOf: function (input) { return input.aadt; },
      range: function (base) { return { low: base * 0.8, high: base * 1.2 }; },
      apply: function (input, value) { return withField(input, 'aadt', value); },
      why: '±20٪ — لا عدّاد ميداني على المقطع؛ الحركة مقدَّرة من صنف الطريق.',
    },
    {
      key: 'hourlyProfileShape',
      label: 'حدّة ذروة الطلب الساعي',
      kind: 'محسوب',
      unit: 'أسّ التشكيل',
      baseOf: function () { return 1; },
      range: function () { return { low: 0.75, high: 1.35 }; },
      apply: function (input, value) {
        return withCalibration(input, {
          hourlyProfile: reshapeProfile(Engine.HOURLY_PROFILE, value),
        });
      },
      why: 'ملف الطلب افتراض توضيحي لا عدّ سعودي منشور. الحدّان يمثّلان يوماً '
        + 'أفلط ويوماً أحدّ ذروةً مع بقاء ترتيب الساعات.',
    },
    {
      key: 'capacityPerLane',
      label: 'سعة الحارة',
      kind: 'محسوب',
      unit: 'مركبة/ساعة/حارة',
      baseOf: function (input) {
        return input.capacityPerLane || Engine.DEFAULTS.capacityPerLane;
      },
      range: function () { return { low: 1600, high: 2000 }; },
      apply: function (input, value) { return withField(input, 'capacityPerLane', value); },
      why: 'نطاق تدفق التشبّع المعتاد في أدبيات HCM لشريان حضري.',
    },
    {
      key: 'freeFlowMin',
      label: 'زمن السريان الحر عبر المقطع',
      kind: 'مُدخل غير مقيس',
      unit: 'دقيقة',
      baseOf: function (input) {
        return input.freeFlowMin || Engine.DEFAULTS.freeFlowMin;
      },
      range: function (base) { return { low: base * 0.75, high: base * 1.25 }; },
      apply: function (input, value) { return withField(input, 'freeFlowMin', value); },
      why: '±25٪ — مشتق من طول المقطع وسرعته الاسمية، لا من قياس زمن رحلة.',
    },
    {
      key: 'workZoneFriction',
      label: 'احتكاك منطقة العمل',
      kind: 'محسوب',
      unit: 'مضاعِف',
      baseOf: function () { return Engine.CALIBRATION.WORK_ZONE_FRICTION; },
      /* WP-C1 — النطاق كان [1.00 – 1.25] وسنده وصفٌ لا دراسة، ثم دخل سجل
         الحالات المقارنة فأزاحه:
           · تصريف الرتل المقيس في ميزوري 1072 مركبة/ساعة/حارة.
           · سعة الأساس الموصى بها في TTI 1108-5: 1600.
           · سعة المحرك خارج منطقة العمل: 1800.
         فالنسبة تقع بين 1072/1800 = 0.60 و1600/1800 = 0.89، أي أن المضاعِف
         بين 1.12 و1.68.

         والحدّ الأدنى القديم (1.0 = لا احتكاك) **لا تسنده حالة واحدة**،
         والأعلى (1.25) كان دون منتصف المدى المشاهَد. أي أن النموذج كان يحسب
         على تفاؤل لا دليل عليه.

         وتوسيع النطاق يزيد هشاشة التوصية ولا ينقصها. هذه هي النتيجة الصادقة:
         الدليل لم يأتِ ليطمئن. تضييقه ليبدو القرار مستقراً هو تلميع لا معايرة. */
      range: function () {
        if (!frictionPrior) return { low: 1.0, high: 1.25 };
        var base = Engine.DEFAULTS.capacityPerLane;
        return {
          low: Math.round((base / frictionPrior.priorHigh) * 100) / 100,
          high: Math.round((base / frictionPrior.priorLow) * 100) / 100,
        };
      },
      apply: function (input, value) {
        return withCalibration(input, { workZoneFriction: value });
      },
      why: frictionPrior
        ? frictionPrior.consequenceForAthar + ' ' + frictionPrior.doesNotProve
        : 'بلا سجل حالات — النطاق الاحتياطي وصفيّ لا مسنود.',
      source: 'data/comparable-cases.json → derivedPriors.capacityPerLaneInWorkZone',
    },
    {
      key: 'minCapacityFraction',
      label: 'أرضية السعة عند الإغلاق الكامل',
      kind: 'محسوب',
      unit: 'كسر',
      baseOf: function () { return Engine.CALIBRATION.MIN_CAPACITY_FRACTION; },
      range: function () { return { low: 0.15, high: 0.35 }; },
      apply: function (input, value) {
        return withCalibration(input, { minCapacityFraction: value });
      },
      why: 'تمنع القسمة على صفر حين تُغلق كل الحارات. لا أثر لها ما لم يكن '
        + 'الإغلاق كاملاً — وهذا ما يجب أن يُظهره الجدول.',
    },
    {
      key: 'residualCapacityFraction',
      label: 'السعة أثناء وجود الموقع خارج ساعات العمل',
      kind: 'محسوب',
      unit: 'كسر',
      baseOf: function (input) {
        return typeof input.residualCapacityFraction === 'number'
          ? input.residualCapacityFraction
          : Engine.RESIDUAL_CAPACITY_FRACTION;
      },
      range: function () { return { low: 0.85, high: 1.0 }; },
      apply: function (input, value) {
        return withField(input, 'residualCapacityFraction', value);
      },
      why: 'الحد الأعلى (1.0) هو الافتراض القديم: الطريق يعود سليماً تماماً '
        + 'بين النوافذ. وجوده في النطاق يجعل أثر تصحيحه مقروءاً.',
    },
    {
      key: 'weightSensitivity',
      label: 'وزن الجوار الحسّاس',
      kind: 'وزن معلن',
      unit: 'ساعة-مركبة مكافئة/ساعة عمل',
      baseOf: function (input) {
        return (input.weights && input.weights.sensitivity) !== undefined
          ? input.weights.sensitivity
          : Engine.OBJECTIVE_WEIGHTS.sensitivity;
      },
      range: function () { return { low: 0, high: 12 }; },
      apply: function (input, value) { return withWeight(input, 'sensitivity', value); },
      why: 'صفر يعني تجاهل الجوار تماماً، والضِعف يعني ترجيحه بشدة. لا مصدر '
        + 'ميداني للوزن — ولذلك يُعرض مداه كاملاً.',
    },
    {
      key: 'weightNightPremium',
      label: 'علاوة العمل الليلي',
      kind: 'وزن معلن',
      unit: 'ساعة-مركبة مكافئة/ساعة ليل',
      baseOf: function (input) {
        return (input.weights && input.weights.nightPremium) !== undefined
          ? input.weights.nightPremium
          : Engine.OBJECTIVE_WEIGHTS.nightPremium;
      },
      range: function () { return { low: 0, high: 4 }; },
      apply: function (input, value) { return withWeight(input, 'nightPremium', value); },
      why: 'صفر يعني أن الليل بلا كلفة تشغيلية إضافية. لا مصدر للوزن.',
    },
    {
      key: 'scoreCalibration',
      label: 'ثابت معايرة الدرجة',
      kind: 'محسوب',
      unit: 'ثابت',
      baseOf: function () { return Engine.CALIBRATION.SCORE_CALIBRATION; },
      range: function (base) { return { low: base * 0.7, high: base * 1.3 }; },
      apply: function (input, value) {
        return withCalibration(input, { scoreCalibration: value });
      },
      why: 'يحوّل ساعات-المركبة إلى درجة 0–100. **لا يمسّ ساعات-المركبة '
        + 'إطلاقاً** — أثره كله في التصنيف، وهذا ما يجب أن يُقرأ من الجدول.',
    },
  ];

  /**
   * يقيس مُدخلاً واحداً على ثلاثة مقاييس لا واحد.
   *
   * مقياسٌ واحد يكذب في اتجاهين: افتراضٌ لا يمسّ ساعات-المركبة **ويقلب
   * التوصية** يظهر بصفر فيُقرأ «بلا أثر» (وهو حال السعة المتبقية والأوزان)،
   * وافتراضٌ يحرّك ساعات-المركبة بلا أن يغيّر قراراً يظهر كارثةً وهو لا يغيّر
   * ما يفعله المراجع.
   */
  function measure(input) {
    var plan = Engine.optimize(input);
    var scored = Engine.score(input);
    var top = (plan.top3 && plan.top3[0]) || null;
    return {
      impactVehHours: plan.baseline.delayVehHours,
      recommendedEquivalent: top ? top.totalEquivalentVehHours : 0,
      winner: winnerOf(plan),
      level: scored.level,
      score: scored.score,
    };
  }

  /**
   * جدول الحساسية (tornado) لمُدخل تصريح واحد.
   *
   * @param {object} input مُدخل بصيغة `Engine.score`
   * @returns {{base:object, rows:Array, dominant:object|null, notes:string[]}}
   */
  function tornado(input) {
    var base = measure(input);

    var rows = ASSUMPTIONS.map(function (assumption) {
      var baseValue = assumption.baseOf(input);
      var span = assumption.range(baseValue);

      var low = measure(assumption.apply(input, span.low));
      var high = measure(assumption.apply(input, span.high));

      var minImpact = Math.min(low.impactVehHours, high.impactVehHours);
      var maxImpact = Math.max(low.impactVehHours, high.impactVehHours);
      var swing = maxImpact - minImpact;

      var equivalentSwing = Math.abs(
        high.recommendedEquivalent - low.recommendedEquivalent
      );

      return {
        key: assumption.key,
        label: assumption.label,
        kind: assumption.kind,
        unit: assumption.unit,
        why: assumption.why,
        baseValue: baseValue,
        lowValue: span.low,
        highValue: span.high,
        lowImpactVehHours: low.impactVehHours,
        highImpactVehHours: high.impactVehHours,
        swingVehHours: swing,
        /* النسبة إلى الأثر الأساس لا إلى المدى: القارئ يسأل «كم يتحرك الرقم
           الذي أمامي»، لا «كم يتحرك داخل مداه». */
        swingPct: base.impactVehHours > 0 ? (swing / base.impactVehHours) * 100 : 0,
        swingEquivalentVehHours: equivalentSwing,
        swingEquivalentPct: base.recommendedEquivalent > 0
          ? (equivalentSwing / base.recommendedEquivalent) * 100
          : 0,
        changesRecommendation: low.winner !== base.winner || high.winner !== base.winner,
        changesLevel: low.level !== base.level || high.level !== base.level,
        winners: { low: low.winner, high: high.winner },
        levels: { low: low.level, high: high.level },
      };
    }).sort(function (a, b) { return b.swingVehHours - a.swingVehHours; });

    var notes = [];
    var flipping = rows.filter(function (row) { return row.changesRecommendation; });
    if (flipping.length) {
      notes.push('يقلب التوصية داخل نطاقه المعلن: '
        + flipping.map(function (row) { return row.label; }).join('، ') + '.');
    }
    var levelOnly = rows.filter(function (row) {
      return row.changesLevel && row.swingVehHours < 1e-9;
    });
    if (levelOnly.length) {
      notes.push('لا يمسّ ساعات-المركبة ويغيّر التصنيف وحده: '
        + levelOnly.map(function (row) { return row.label; }).join('، ') + '.');
    }
    var unmeasured = rows.filter(function (row) { return row.kind === 'مُدخل غير مقيس'; });
    var unmeasuredSwing = unmeasured.reduce(function (sum, row) {
      return sum + row.swingVehHours;
    }, 0);
    var computedSwing = rows.filter(function (row) { return row.kind === 'محسوب'; })
      .reduce(function (sum, row) { return sum + row.swingVehHours; }, 0);
    if (unmeasuredSwing > computedSwing) {
      notes.push('تحرُّك الرقم من المدخلات غير المقيسة أكبر من تحرّكه من ثوابت '
        + 'المحرك — أي أن دقّة النموذج ليست القيد، بل دقّة بيانات الموقع.');
    }

    return {
      base: base,
      rows: rows,
      dominant: rows.length ? rows[0] : null,
      notes: notes,
    };
  }

  return {
    ASSUMPTIONS: ASSUMPTIONS,
    reshapeProfile: reshapeProfile,
    tornado: tornado,
    measure: measure,
  };
});
