/**
 * أثر — استقرار التوصية، والامتناع حين لا تستقرّ.
 * ---------------------------------------------------------------------------
 * **الحقيقة التي تفرض وجود هذا الملف.**
 *
 * تحليل الحساسية على المحفظة أعطى نتيجةً لا تُجمَّل: التوصية تتغيّر في 149 من
 * 150 حالة عند تحريك افتراض داخل نطاقه المعقول، ومعامل احتكاك منطقة العمل
 * وحده يقلب 148. أي أن المنتج كان يعرض توصيةً واحدة بثقة، بينما ترتيب البدائل
 * لا ينجو من تحريك ثابت غير معاير.
 *
 * **والطرق الخاطئة لمعالجتها — كلها مغلقة هنا عمداً.**
 *
 * تضييق النطاق حتى تستقرّ التوصية، أو تغيير الأوزان حتى يفوز مرشّح واحد، أو
 * حذف السيناريو المحرج، أو عرض الحالة المستقرة الوحيدة. كلها تُنتج استقراراً
 * على الشاشة بلا استقرار في الواقع، وهو أسوأ من الهشاشة المعلَنة: الهشاشة
 * المعلنة تدفع إلى طلب بيانات، والاستقرار الكاذب يوقف الطلب.
 *
 * **الطريق المتَّبع.**
 *
 * تُصنَّف التوصية بحالة واحدة من أربع، وتُعرض الحالة مع القرار لا بعده. وحالة
 * «غير مستقرة» ليست فشلاً تقنياً — هي **نتيجة صالحة** تقول للمراجع: لا تقرّر
 * على هذا، اطلب هذه البيانات بعينها.
 *
 * UMD.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./athar-sensitivity.js'));
  } else {
    root.AtharStability = factory(root.AtharSensitivity);
  }
})(typeof self !== 'undefined' ? self : this, function (Sensitivity) {
  'use strict';

  /**
   * الحالات الأربع.
   *
   * `decidable` هو الحقل الحاكم: هو ما تقرؤه الواجهة لتقرّر أن تعرض توصية أو
   * تعرض امتناعاً. جعله مشتقّاً من التصنيف لا مكتوباً في كل موضع يمنع أن
   * تُعرض توصية هشّة على سطح نسي القاعدة.
   */
  var STATES = {
    stable: {
      key: 'stable',
      label: 'مستقرّة',
      decidable: true,
      meaning: 'التوصية نفسها تفوز عبر معظم نطاقات الافتراضات المعقولة.',
      action: 'يجوز القرار على التوصية كما هي.',
    },
    conditional: {
      key: 'conditional',
      label: 'مستقرّة بشرط',
      decidable: true,
      meaning: 'التوصية تصمد ضمن شرط أو نطاق بيانات معلَن، وتتغيّر خارجه.',
      action: 'يجوز القرار مع ذكر الشرط في السجل — ومن يقرأ القرار لاحقاً '
        + 'يعرف حدوده.',
    },
    fragile: {
      key: 'fragile',
      label: 'هشّة',
      decidable: false,
      meaning: 'التوصية تتغيّر تحت افتراض واحد أو أكثر داخل نطاقه المعقول.',
      action: 'لا يُبنى قرار على الترتيب. تُطلب البيانات التي تضيّق الافتراض '
        + 'المهيمن، أو يُصعَّد إلى مهندس مرور.',
    },
    insufficient: {
      key: 'insufficient',
      label: 'أدلة غير كافية',
      decidable: false,
      meaning: 'البيانات لا تكفي لترتيب البدائل بثقة أصلاً.',
      action: 'الامتناع. والامتناع نتيجة مقبولة لا عطل.',
    },
  };

  /** رسالة الامتناع — نصّ واحد لا يُعاد صوغه في كل سطح. */
  var ABSTENTION = 'التوصية غير مستقرة عبر نطاق الافتراضات — '
    + 'تحتاج بيانات إضافية أو مراجعة خبير.';

  /**
   * العتبات — معلنة رقماً لا مدفونة في شروط.
   *
   * `fragileFlips`: افتراضٌ واحد يقلب الترتيب يعني أن الترتيب ليس خاصية
   * للعالم بل للافتراض. الواحد كافٍ.
   *
   * **والفصل الذي بُنيت عليه العتبات.**
   *
   * التصنيف يقوم على **ترتيب البدائل** لا على حجم الرقم. والسبب من القياس
   * نفسه: تأرجح حجم الأثر عبر المحفظة يقع بين 212٪ و550٪، أي أن رقم
   * ساعات-المركبة غير قابل للدفاع عنه في أي حالة تقريباً. ولو صنّفنا بالحجم
   * لامتنع النظام في مئة وخمسين حالة من مئة وخمسين، ولما قال شيئاً.
   *
   * لكن الترتيب أمتن من الحجم: حين ترتفع سعة الحارة ترتفع لكل البدائل معاً،
   * فقد ينجو الترتيب من افتراضٍ يقلب الرقم. والقياس يؤكد ذلك — قرابة أربعين
   * بالمئة من الحالات لا يقلب توصيتَها أي افتراض.
   *
   * فالمنتج يقول ما يستطيع: **أي نافذة أفضل**، لا **كم تكلّف بالضبط**.
   * وحجم عدم اليقين يبقى معروضاً مع كل حالة بوصفه مدىً لا رقماً.
   */
  var THRESHOLDS = {
    fragileFlips: 1,
    insufficientFlips: 3,
    conditionalSwingPct: 50,
  };

  /**
   * تمييز العدد بالعربية.
   *
   * «4 افتراضاً» خطأ نحوي يقرؤه المراجع في أول سطر من بطاقته، ويقرأ معه أن
   * أحداً لم يقرأ ما كتبه. الواحد والاثنان لهما صيغتاهما، ومن ثلاثة إلى عشرة
   * جمعٌ، وما فوقها مفردٌ منصوب.
   *
   * @param {number} value العدد.
   * @param {string} [adjective] نعتٌ يتبع المعدود، مثل «مستقلّ».
   */
  function countPhrase(value, adjective) {
    var suffixOne = adjective ? ' ' + adjective : '';
    var suffixTwo = adjective ? ' ' + adjective + 'ان' : '';
    var suffixMany = adjective ? ' ' + adjective + 'ة' : '';
    if (value === 1) return 'افتراض واحد' + suffixOne;
    if (value === 2) return 'افتراضان' + suffixTwo;
    if (value >= 3 && value <= 10) return value + ' افتراضات' + suffixMany;
    return value + ' افتراضاً' + (adjective ? ' ' + adjective + 'اً' : '');
  }

  /**
   * يصنّف استقرار توصية تصريح واحد.
   *
   * @param {object} input مُدخل بصيغة `Engine.score`.
   * @param {object} [options] `{ tornado }` لتمرير جدول محسوب مسبقاً.
   * @returns {object}
   */
  function classify(input, options) {
    var settings = options || {};
    var table = settings.tornado || Sensitivity.tornado(input);
    var rows = table.rows || [];

    var flipping = rows.filter(function (row) { return row.changesRecommendation; });
    var levelFlipping = rows.filter(function (row) { return row.changesLevel; });
    var widest = rows.reduce(function (max, row) {
      return (!max || row.swingPct > max.swingPct) ? row : max;
    }, null);

    var state;
    var reason;

    if (!rows.length) {
      state = STATES.insufficient;
      reason = 'لا افتراضات مفحوصة — لا حكم على الاستقرار';
    } else if (flipping.length >= THRESHOLDS.insufficientFlips) {
      /* ثلاثة افتراضات مستقلة يقلب كلٌّ منها التوصية وحده تعني أن الفائز
         يتبدّل مع أيٍّ منها. هذا ليس ترتيباً هشّاً — هو غياب ترتيب. */
      state = STATES.insufficient;
      reason = countPhrase(flipping.length, 'مستقلّ')
        + ' يقلب كلٌّ منها التوصية وحده — لا ترتيب ينجو: '
        + flipping.map(function (row) { return row.label; }).join('، ');
    } else if (flipping.length >= THRESHOLDS.fragileFlips) {
      state = STATES.fragile;
      reason = countPhrase(flipping.length)
        + ' يقلب التوصية داخل نطاقه المعقول: '
        + flipping.map(function (row) { return row.label; }).join('، ');
    } else if (widest && widest.swingPct >= THRESHOLDS.conditionalSwingPct) {
      /* الترتيب صمد والحجم لم يصمد. وهذه أصدق حالة في المنتج كله:
         «هذه النافذة أفضل» قابلة للدفاع، و«توفّر 3352 ساعة-مركبة» ليست. */
      state = STATES.conditional;
      reason = 'الترتيب ثابت عبر كل الافتراضات، وحجم الأثر يتحرك '
        + Math.round(widest.swingPct) + '٪ مع «' + widest.label + '» — '
        + 'يُعرض مدىً لا رقماً';
    } else if (levelFlipping.length) {
      state = STATES.conditional;
      reason = 'التوصية ثابتة وتصنيف الشدّة يتغيّر مع: '
        + levelFlipping.map(function (row) { return row.label; }).join('، ');
    } else {
      state = STATES.stable;
      reason = 'لا افتراض يقلب التوصية ولا التصنيف داخل النطاقات المعلنة';
    }

    return {
      state: state.key,
      label: state.label,
      decidable: state.decidable,
      meaning: state.meaning,
      action: state.action,
      reason: reason,
      abstention: state.decidable ? '' : ABSTENTION,
      dominant: widest ? {
        key: widest.key, label: widest.label,
        swingPct: Math.round(widest.swingPct),
        why: widest.why,
      } : null,
      /* حجم عدم اليقين يُعرض دائماً، حتى مع توصية مستقرة. الترتيب الصامد
         لا يجعل الرقم صامداً، ومن يقرأ «مستقرّة» بجوار رقمٍ مفرد سيصدّق
         الرقم. المدى هو ما يُعرض، والمصدر الذي يضيّقه معه. */
      magnitude: widest ? {
        worstSwingPct: Math.round(widest.swingPct),
        drivenBy: widest.label,
        lowVehHours: Math.round(Math.min(widest.lowImpactVehHours,
          widest.highImpactVehHours)),
        highVehHours: Math.round(Math.max(widest.lowImpactVehHours,
          widest.highImpactVehHours)),
        defensible: widest.swingPct < THRESHOLDS.conditionalSwingPct,
        note: widest.swingPct >= THRESHOLDS.conditionalSwingPct
          ? 'رقم ساعات-المركبة غير قابل للدفاع عنه مفرداً — يُعرض مدىً.'
          : 'المدى ضيّق بما يسمح بعرض رقم مع حدّيه.',
        dataNeeded: dataNeededFor(widest.key),
      } : null,
      flippingAssumptions: flipping.map(function (row) {
        return { key: row.key, label: row.label, kind: row.kind,
          winners: row.winners, dataNeeded: dataNeededFor(row.key) };
      }),
      levelFlipping: levelFlipping.map(function (row) { return row.key; }),
      thresholds: THRESHOLDS,
    };
  }

  /**
   * أي بيانات تضيّق هذا الافتراض بالضبط.
   *
   * الجدول هو الفرق بين «التوصية هشّة» و«التوصية هشّة، وهذا ما يُطلب». الأولى
   * تُقرأ عجزاً، والثانية أمرُ عملٍ لجهة تملك البيانات.
   */
  var DATA_NEEDED = {
    aadt: 'عدّاد حركة على المقطع بدقة الساعة — من الأمانة أو مركز إدارة الحركة. '
      + 'مزوّدو المسبار لا ينتجون حجماً.',
    hourlyProfileShape: 'ملف طلب ساعي سعودي منشور، أو سلسلة عدّ محلية لأربعة '
      + 'أسابيع تغطي أيام العمل والعطلة.',
    capacityPerLane: 'قياس تدفق تشبّع على شريان رياض مماثل عند إشارة.',
    freeFlowMin: 'زمن رحلة مقيس عبر المقطع في ساعة انسياب حر — متاح من مزوّد '
      + 'حركة اليوم بلا انتظار جهة.',
    workZoneFriction: 'قياس سعة داخل منطقة عمل فعلية في الرياض: تدفق مقيس على '
      + 'الحارات المفتوحة أثناء الإغلاق. هذا هو الافتراض الأول الذي يستحق '
      + 'حالةً ميدانية واحدة.',
    minCapacityFraction: 'حالة إغلاق كامل موثَّقة بتدفق متبقٍّ مقيس.',
    residualCapacityFraction: 'قياس تدفق على الحارات المفتوحة أثناء إغلاق جزئي.',
    valueOfTimeSAR: 'قيمة زمن سعودية معتمدة من جهة تخطيط — قرار سياسة لا قياس.',
    idleFuelLPerHour: 'استهلاك تباطؤ لأسطول سعودي نموذجي.',
    /* الأوزان صنفٌ مختلف: لا بيانات تضيّقها لأنها ليست قياساً أصلاً. وإخفاء
       ذلك خلف «تحتاج بيانات» يوهم بأن جمع الأرقام سيحسمها، فيؤجَّل قرارٌ
       ملكه الجهة لا النموذج. الطلب هنا **اعتماد** لا قياس. */
    weightSensitivity: 'اعتماد وزن حساسية الجوار من الجهة — تفضيل سياسة لا '
      + 'قياس. لا بيانات ميدانية تحسمه، والقرار يبقى معلَّقاً حتى يُعتمد.',
    weightNightPremium: 'اعتماد علاوة العمل الليلي من الجهة — تكلفة تشغيل '
      + 'وسياسة إزعاج، لا معامل مروري يُقاس.',
    scoreCalibration: 'حدود تصنيف الشدّة (منخفض/متوسط/عالٍ) تُعتمد من الجهة، '
      + 'ويُفضَّل إسنادها إلى توزيع أثر مقيس محلياً حين يتوفر.',
    weights: 'قرار سياسة معلن من الجهة — لا يُقاس ولا يُعاير.',
  };

  function dataNeededFor(key) {
    return DATA_NEEDED[key] || 'غير محدَّد — يُضاف إلى الجدول قبل الاعتماد عليه';
  }

  /**
   * حصيلة الاستقرار عبر محفظة كاملة.
   *
   * @param {Array} inputs مُدخلات جاهزة للمحرك.
   */
  function portfolio(inputs) {
    var counts = { stable: 0, conditional: 0, fragile: 0, insufficient: 0 };
    var dominance = {};
    var rows = [];

    (inputs || []).forEach(function (entry) {
      var verdict = classify(entry.input, entry.options);
      counts[verdict.state] += 1;
      verdict.flippingAssumptions.forEach(function (item) {
        dominance[item.key] = (dominance[item.key] || 0) + 1;
      });
      rows.push({ id: entry.id, state: verdict.state, reason: verdict.reason,
        decidable: verdict.decidable });
    });

    var total = rows.length;
    return {
      total: total,
      counts: counts,
      decidable: counts.stable + counts.conditional,
      abstained: counts.fragile + counts.insufficient,
      dominance: dominance,
      rows: rows,
      /* الحصيلة تُقرأ حكماً على المنتج لا على المحفظة: نسبةُ امتناعٍ عالية
         تعني أن النموذج غير معاير، لا أن التصاريح صعبة. */
      verdict: total === 0 ? 'لا حالات'
        : (counts.fragile + counts.insufficient) / total >= 0.5
          ? 'أغلب التوصيات لا يُبنى عليها قرار — النموذج يحتاج معايرة ميدانية '
            + 'قبل أن يُقرأ ترتيبه'
          : 'أغلب التوصيات قابلة للقرار ضمن حدودها المعلنة',
    };
  }

  return {
    STATES: STATES,
    THRESHOLDS: THRESHOLDS,
    ABSTENTION: ABSTENTION,
    DATA_NEEDED: DATA_NEEDED,
    dataNeededFor: dataNeededFor,
    classify: classify,
    portfolio: portfolio,
  };
});
