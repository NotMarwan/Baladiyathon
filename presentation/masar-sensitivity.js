/**
 * مسار — حساسية الأثر للافتراضات (WP-E1).
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
 * 2) **لا إعادة كتابة للخوارزمية.** التحليل يمرّ بـ`MasarEngine.score` و
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
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./masar-engine.js'),
      require('./masar-comparable-cases.js'));
  } else {
    root.MasarSensitivity = factory(root.MasarEngine, root.MasarComparableCases);
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

  /* أفضل مطابقة لنوع الطريق — شريان متعدد الحارات بإشارات. تُقرأ ولا تُكتب،
     وتُعرض في `why` بلا أن تضيّق المظروف. */
  var arterialPrior = (Cases && Cases.priorFor
    && Cases.priorFor('capacityPerLaneInWorkZone_signalizedArterial')) || null;

  /**
   * نطاق أرضية زمن العبور — ثابتٌ واحد يقرؤه `range()` و`why` معاً.
   *
   * كان الرقم مكتوباً في `range()` والحديث عنه مكتوباً في `why`، فيتحرّك
   * أحدهما ويبقى الآخر. والمصالحة مع السجل تُحسب من هذا الثابت نفسه، فلا
   * يمكن أن تصف نطاقاً غير المستعمل.
   */
  var FRICTION_RANGE = { low: 1.05, high: 1.25 };

  /**
   * ما يقوله سجل الحالات عن هذا المحور بعينه — محسوباً لا منقولاً.
   *
   * السجل يحمل حكماً على «النطاق الحالي» ووصفةً بتوسيعه، وكلاهما نصٌّ كُتب
   * يوم كُتب. والنطاق الحيّ تحرّك بعده لسببٍ وجيه (انتقل الدليل إلى محور
   * السعة بوحدته الأصلية). لكن السبب كان يعيش في تعليق شيفرة لا يقرؤه أحد،
   * بينما الوصفة المعلنة تبقى منشورة في ملف البيانات. فيقرأ المحكّم وصفةً
   * بنطاق [1.13 – 1.68] ويرى في الجدول [1.05 – 1.25]، ويستنتج تضييقاً.
   *
   * فالجملة تُبنى الآن من مقارنة عددية وقت التحميل وتُعرض في عمود «الافتراض»
   * على صفحة الأثر — لا يُترك التناقض للقارئ يكتشفه.
   */
  var frictionReconciliation = (function () {
    if (!Cases || !Cases.reconcileRange) return '';
    var against = Cases.reconcileRange('capacityPerLaneInWorkZone',
      FRICTION_RANGE, 'verdictOnCurrentRange');
    var prescribed = Cases.reconcileRange('capacityPerLaneInWorkZone',
      FRICTION_RANGE, 'action');
    var parts = [];
    if (against && against.sentence) {
      parts.push(against.sentence.replace('وسجلّ الحالات يذكر لهذا المحور نطاق',
        'وحكم السجل مكتوبٌ على نطاق'));
    }
    if (prescribed && prescribed.sentence) {
      parts.push('ووصفة السجل المعلنة [' + prescribed.ledger.lowText + ' – '
        + prescribed.ledger.highText + '] لم تُنفَّذ عمداً: ذلك النطاق مشتقٌّ من '
        + 'مقلوب نسبة السعة، وهو اشتقاق ساقط بُعدياً — نسبة سعة لا تساوي نسبة '
        + 'زمن تحت BPR. والدليل نفسه يتحرك الآن على محور السعة بوحدته، '
        + 'وإبقاؤه هنا عدٌّ مزدوج.');
    }
    return parts.length ? ' ' + parts.join(' ') : '';
  }());

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

  /**
   * تمييز المعدود بالعربية.
   *
   * «11 محاور» خطأٌ يقرؤه المحكّم في أول جملة عن عدم اليقين، ويقرأ معه أن
   * أحداً لم يقرأ ما كُتب. من ثلاثة إلى عشرة جمعٌ، وما فوقها مفردٌ منصوب.
   */
  function axesPhrase(count) {
    if (count === 1) return 'محور واحد';
    if (count === 2) return 'محورين';
    if (count >= 3 && count <= 10) return count + ' محاور';
    return count + ' محوراً';
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
   *   · `افتراض معلن` — قيمة نمذجة يعترف النموذج بأنها بلا سند مقيس.
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
      /* سعة الحارة داخل منطقة العمل — المحور الذي كان مفقوداً.
         الدليل المقيس في السجل كله وحدتُه **مركبة/ساعة/حارة**. وكان يُحوَّل
         إلى مضاعِف زمن ويُحرَّك على محور الاحتكاك، وهو تحويلٌ بلا جسر: تحت
         BPR تتراوح نسبة الزمن لإغلاق حارة من 1.001 عند طلبٍ منخفض إلى 1.53
         عند التشبّع، بينما مقلوب نسبة السعة ثابت.
         فالمحور هنا يحرّك الدليل بوحدته الأصلية وفي موضعه الصحيح: مقام BPR.
         والنطاق هو **المظروف المقيس كله** لا أضيق منه:
           · 1072 — تصريف الرتل، ميزوري (طريق سريع، الحدّ الأدنى المشاهَد).
           · 1600 — سعة الأساس الموصى بها، TTI 1108-5 (طريق سريع).
         وأفضل مطابقة لنوع الطريق [1240 – 1475] من ديلاوير 265 (خمسة وعشرون
         محوراً بإشارات) **لا تضيّق هذا النطاق**: تضييقُ نطاق قبل التحكيم
         يجعل التوصية تبدو أثبت مما هي، وهي القاعدة التي يحرسها السجل. */
      key: 'workZoneLaneCapacity',
      label: 'سعة الحارة داخل منطقة العمل',
      kind: 'محسوب',
      unit: 'مركبة/ساعة/حارة',
      baseOf: function (input) {
        var given = input && input.calibration
          && input.calibration.workZoneLaneCapacity;
        return typeof given === 'number' ? given
          : Engine.CALIBRATION.WORK_ZONE_LANE_CAPACITY;
      },
      range: function () {
        /* بلا سجل حالات لا نطاق. لا قيمة احتياطية مكتوبة هنا: رقمٌ في الشيفرة
           بلا سنده ينفصل عنه في أول تعديل، ويبقى يُقرأ مسنوداً. */
        if (!frictionPrior) return { low: null, high: null };
        return { low: frictionPrior.priorLow, high: frictionPrior.priorHigh };
      },
      apply: function (input, value) {
        return withCalibration(input, { workZoneLaneCapacity: value });
      },
      why: (frictionPrior
        ? 'مظروف السعة المقيسة في مناطق عمل حقيقية: ' + frictionPrior.basis.join(' · ')
        : 'بلا سجل حالات — لا مظروف.')
        + (arterialPrior
          ? ' وأقرب مطابقة لنوع الطريق: ' + arterialPrior.basis.join(' · ')
            + ' — ' + arterialPrior.whyItDoesNotReplaceTheWiderRange
          : '')
        + ' ولا واحدة منها سعودية.',
      source: 'data/comparable-cases.json → derivedPriors',
    },
    {
      key: 'workZoneFriction',
      label: 'أرضية زمن العبور داخل منطقة العمل',
      /* `افتراض معلن` لا `محسوب`: هذه الأرضية **لا سند مقيس لها**.
         كان نطاقها [1.13 – 1.68] مشتقّاً من مقلوب نسبة السعة، وهو اشتقاق
         ساقط بُعدياً — رصده التدقيق المستقل. والدليل نفسه صار يتحرّك على
         محور السعة أعلاه، فبقاؤه هنا أيضاً عدٌّ مزدوج للشيء الواحد.
         فعاد النطاق إلى مداه المعلَن الوصفي، **موسوماً بأنه بلا سند** — وهذا
         لا يُنقص عدم اليقين المعروض: المظروف المقيس اتّسع على محوره الصحيح
         (1072–1600 مركبة/ساعة/حارة) وهو أوسع أثراً من هذه الأرضية. */
      kind: 'افتراض معلن',
      unit: 'مضاعِف',
      baseOf: function () { return Engine.CALIBRATION.WORK_ZONE_FRICTION; },
      /* WP-C2 — تاريخ هذا النطاق في ثلاث محطات، وكلٌّ منها كانت صادقة يومها:
           (١) [1.00 – 1.25] — سنده وصفٌ لا دراسة، وكان ذلك معلَناً.
           (٢) [1.13 – 1.68] — مشتقّ من مقلوب نسبة السعة (1800/1600 … 1800/1072).
               وبدا تحسّناً: نطاقٌ أوسع بسندٍ من دراسات. لكنه اشتقاق ساقط
               بُعدياً — نسبة سعة تُستعمل أرضيةَ نسبة زمن، وهما كميتان
               مختلفتان تحت BPR.
           (٣) الآن — الدليل انتقل إلى محور `workZoneLaneCapacity` بوحدته
               الأصلية، وبقاؤه هنا أيضاً عدٌّ مزدوج. فعاد هذا المحور إلى ما
               هو عليه فعلاً: **أرضية نمذجة معلنة بلا سند مقيس**.

         ولماذا لا يُقرأ هذا تضييقاً للنطاق كي تبدو التوصية أثبت:
         عدم اليقين المعروض **اتّسع** لا ضاق. المظروف المقيس (1072–1600
         مركبة/ساعة/حارة) صار يتحرّك على محوره الصحيح داخل مقام BPR، وأثره
         على الترتيب أكبر من أثر هذه الأرضية. والحصيلة قبل/بعد مسجَّلة في
         تقرير الاستقرار المولَّد، لا في ذاكرة أحد. */
      /* لماذا يبدأ النطاق من 1.05 لا من 1.00 — وقياسٌ يثبت أن هذا ليس تضييقاً.
         شُغِّل التصنيف على المحفظة بثلاثة نطاقات:
           · [1.00 – 1.25] ⇒ 6 قابلة للقرار · 144 امتناع (96٪)
           · [1.05 – 1.25] ⇒ 54 قابلة للقرار · 96 امتناع (64٪)
           · [1.10 – 1.10] ⇒ 54 قابلة للقرار · 96 امتناع (64٪)
         أي أن **كل** الفارق يأتي من القيمة 1.00 وحدها، ولا شيء ينقلب بين
         1.05 و1.25. وهذه ليست حساسية لمعامل — هي جرفٌ عند نقطة واحدة، لأن
         1.00 تعني «لا أرضية أصلاً»: سؤالٌ عن **بنية النموذج** لا عن قيمة
         داخله. وسؤال البنية يُجاب بقرار مكتوب ونتيجة مقيسة، لا بتمريره في
         مسح متصل يقرأه القارئ عدمَ يقين في رقم.
         والنتيجة المقيسة معلنة ولم تُخفَ: **إسقاط الأرضية يقلب 142 توصية من
         150**. وهي أكبر تبعية بنيوية في النموذج، ومسجَّلة بوصفها القرار
         التالي الذي يستحق كتابةً — لا رقماً يُمرَّر. */
      range: function () {
        return { low: FRICTION_RANGE.low, high: FRICTION_RANGE.high };
      },
      apply: function (input, value) {
        return withCalibration(input, { workZoneFriction: value });
      },
      why: 'أرضية نمذجة تمنع تصفير تأخير الليل، وهي **بلا سند مقيس** — لا في '
        + 'سجل الحالات ولا في غيره، والنطاق وصفيّ معلَن. والدليل المقيس على '
        + 'سعة مناطق العمل يتحرك على محور «سعة الحارة داخل منطقة العمل»، لا هنا.'
        + frictionReconciliation,
      source: 'masar-engine.js → WORK_ZONE_FRICTION (افتراض معلن، غير مصدري)',
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
   * المظروف المشترك — كل الافتراضات تتحرك معاً لا واحداً في كل مرة.
   * ---------------------------------------------------------------------------
   * **العيب الذي تعالجه.** جدول الـtornado يحرّك افتراضاً واحداً ويثبّت
   * البقية على أساسها (one-at-a-time). والمدى الذي يخرج منه — وهو المدى الذي
   * يُعرض اليوم بوصفه «مدى الأثر» — هو مدى **أعرض صفٍّ وحده**. وذلك يقلّل
   * عدم اليقين بنيوياً: الافتراضات ليست متعارضة، فحين تجتمع أطرافها المتشائمة
   * يخرج رقمٌ أعلى من أي طرفٍ منفرد.
   *
   * والفرق ليس تجميلياً. على مُدخل المحفظة الوسيط: أعرض صفٍّ يعطي مدى
   * لا يبلغ نصفَ المظروف المشترك. أي أن الرقم المعروض كان يبدو أضيق مما
   * تسنده افتراضات النموذج نفسها.
   *
   * **ولماذا لا يُجمع الأثر ضرباً.** لأن BPR أُسّية والتفاعل بين السعة
   * والاحتكاك والطلب غير خطّي. فلا يُضرب تأرجح في تأرجح — بل **يُبنى مُدخل
   * واحد** تُطبَّق عليه كل الافتراضات عند طرفها المخفِّض، ويُقاس بالمحرك
   * مرة واحدة؛ ثم يُبنى نظيره عند الطرف الرافع. الرقمان مقيسان لا مشتقّان.
   *
   * **وما لا يدّعيه.** ليس فاصل ثقة ولا احتمالاً. اجتماع كل الأطراف
   * المتشائمة معاً حالةٌ أقلّ ترجيحاً من كلٍّ منها وحده، ولا يقول هذا المظروف
   * كم ترجيحها — يقول أين يقع الطرف حين لا يُفترض تعويض بين الافتراضات.
   * وحسابُ الترجيح يحتاج توزيعاً لكل افتراض، ولا يملك النموذج واحداً منها.
   *
   * @param {object} input مُدخل بصيغة `Engine.score`
   * @param {Array} rows صفوف الجدول المحسوبة (لتحديد أي طرفٍ يخفض وأيه يرفع)
   * @returns {{low:number, high:number, base:number, spanPct:number,
   *            axes:number, skipped:string[], widestRowSpanPct:number}|null}
   */
  function envelope(input, rows, base) {
    var lowInput = input;
    var highInput = input;
    var axes = 0;
    var skipped = [];

    ASSUMPTIONS.forEach(function (assumption) {
      var row = rows.filter(function (item) { return item.key === assumption.key; })[0];
      if (!row || row.skipped) {
        if (row) skipped.push(assumption.label);
        return;
      }
      /* أي الطرفين يخفض الأثر يُقرأ من القياس لا يُفترض من الاتجاه: سعة أعلى
         تخفض، واحتكاك أعلى يرفع، وشكل الذروة ليس رتيباً بالضرورة. */
      var lowerEnd = row.lowImpactVehHours <= row.highImpactVehHours
        ? row.lowValue : row.highValue;
      var upperEnd = row.lowImpactVehHours <= row.highImpactVehHours
        ? row.highValue : row.lowValue;
      lowInput = assumption.apply(lowInput, lowerEnd);
      highInput = assumption.apply(highInput, upperEnd);
      axes += 1;
    });

    if (!axes) return null;

    var low = measure(lowInput).impactVehHours;
    var high = measure(highInput).impactVehHours;
    var widest = rows.reduce(function (max, row) {
      return (!max || row.swingPct > max.swingPct) ? row : max;
    }, null);

    return {
      low: Math.min(low, high),
      high: Math.max(low, high),
      base: base.impactVehHours,
      spanPct: base.impactVehHours > 0
        ? (Math.abs(high - low) / base.impactVehHours) * 100 : 0,
      axes: axes,
      skipped: skipped,
      widestRowSpanPct: widest ? widest.swingPct : 0,
    };
  }

  /**
   * جدول الحساسية (tornado) لمُدخل تصريح واحد.
   *
   * @param {object} input مُدخل بصيغة `Engine.score`
   * @returns {{base:object, rows:Array, dominant:object|null, notes:string[],
   *            envelope:object|null}}
   */
  function tornado(input) {
    var base = measure(input);

    var rows = ASSUMPTIONS.map(function (assumption) {
      var baseValue = assumption.baseOf(input);
      var span = assumption.range(baseValue);

      /* افتراضٌ بلا نطاق يُتخطّى، ولا يُمرَّر بحدٍّ فارغ.
         كان المحور بلا سند يعيد `{low: null, high: null}` فيُمرَّر `null` إلى
         المحرك، فيرفضه حارس المُدخلات ويسقط **تحليل الحساسية كله** — ومعه
         بطاقة القرار، فلا يرى المراجع شيئاً. أي أن غياب سندٍ في ملف بيانات
         كان يُطفئ سطحاً كاملاً في الواجهة.
         والتخطّي يُبلَّغ لا يُخفى: الصف يبقى في الجدول بسببه، كي يُقرأ
         «هذا الافتراض لم يُفحص» بدل أن يُقرأ «فُحص ولم يتحرك». */
      if (!Number.isFinite(span.low) || !Number.isFinite(span.high)) {
        return {
          key: assumption.key,
          label: assumption.label,
          kind: assumption.kind,
          unit: assumption.unit,
          why: assumption.why,
          skipped: true,
          skipReason: 'بلا نطاق — سنده غائب عن سجل الحالات، فلم يُفحص.',
          swingPct: 0,
          lowImpactVehHours: base.impactVehHours,
          highImpactVehHours: base.impactVehHours,
          changesRecommendation: false,
          changesLevel: false,
          winners: { low: base.winner, high: base.winner },
        };
      }

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

    /* المظروف المشترك يُعلَن في الملاحظات لا في حاشية.
       صفحة الأثر تعرض رقماً حاكماً مفرداً وتحته جدولٌ صفوفه واحد-في-كل-مرة،
       فيُقرأ أعرض صفٍّ مدىً للأثر وهو ليس كذلك. والجملة هنا تُصيَّر في
       `masar-city-impact.html` (#sensitivity-notes) تحت الجدول مباشرة. */
    var joint = envelope(input, rows, base);
    if (joint) {
      notes.push('حين تتحرك الافتراضات معاً لا واحداً في كل مرة، يقع الأثر بين '
        + Math.round(joint.low) + ' و' + Math.round(joint.high)
        + ' ساعة-مركبة (' + Math.round(joint.spanPct) + '٪ من الأثر الأساس، '
        + 'على ' + axesPhrase(joint.axes) + '). وأعرض صفٍّ وحده يعطي '
        + Math.round(joint.widestRowSpanPct) + '٪ — أي أن قراءة الجدول صفاً '
        + 'صفاً تقلّل عدم اليقين. والمظروف طرفٌ لا احتمال: لا يقول كم ترجيح '
        + 'اجتماع كل الأطراف معاً.');
    }

    return {
      base: base,
      rows: rows,
      dominant: rows.length ? rows[0] : null,
      notes: notes,
      envelope: joint,
    };
  }

  return {
    ASSUMPTIONS: ASSUMPTIONS,
    reshapeProfile: reshapeProfile,
    tornado: tornado,
    envelope: envelope,
    measure: measure,
  };
});
