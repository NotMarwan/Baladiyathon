/**
 * مسار — سجل الحالات المقارنة، ودرجة التشابه، والنطاق المشتقّ منها.
 * ---------------------------------------------------------------------------
 * **لماذا سجلٌّ لا قائمة مراجع.**
 *
 * قائمة المراجع تُقرأ ولا تُفحص. والسجل هنا يُقرأ منه **نطاق** يدخل تحليل
 * الحساسية، فيجب أن يُفحص: أي حالة تدخل، وأي حالة تبقى مرجعاً سياقياً، وكيف
 * صار الحدّان اللذان يحملان الاستنتاج.
 *
 * **والنتيجة التي لم نكن نريدها.**
 *
 * الحالات الموثَّقة لم تضيّق نطاق احتكاك منطقة العمل — **وسّعته وأزاحته
 * لأعلى**. النطاق كان [1.00 – 1.25]، والدليل يضعه بين 1.12 و1.68. أي أن
 * التوصيات كانت تُحسب على افتراض أكثر تفاؤلاً مما تسنده أي دراسة.
 *
 * وهذا هو الفرق بين معايرة وتلميع: المعايرة تقبل أن يزيد الدليل من الهشاشة.
 *
 * UMD.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./data/comparable-cases.json'));
  } else {
    root.MasarComparableCases = factory(root.MASAR_COMPARABLE_CASES);
  }
})(typeof self !== 'undefined' ? self : this, function (ledger) {
  'use strict';

  var LEDGER = ledger || { cases: [], derivedPriors: [] };

  /**
   * أبعاد التشابه ووزنها.
   *
   * الأوزان معلنة لا مخفية، وليست دقيقة: هي ترتيبُ أهمية مكتوبٌ رقماً كي
   * يُناقَش. ودرجة التشابه الناتجة **ليست احتمالاً** ولا تُعرض بمنزلتين
   * عشريتين — تلك دقة زائفة على حكمٍ تقديري.
   */
  var DIMENSIONS = [
    { key: 'roadType', weight: 3, label: 'صنف الطريق' },
    { key: 'urbanContext', weight: 2, label: 'السياق الحضري' },
    { key: 'closureType', weight: 2, label: 'نوع الإغلاق' },
    { key: 'closedLaneShare', weight: 2, label: 'نسبة الحارات المغلقة' },
    { key: 'timeOfDay', weight: 1, label: 'وقت اليوم' },
    { key: 'duration', weight: 1, label: 'المدة' },
    { key: 'detourType', weight: 1, label: 'نوع التحويلة' },
  ];

  /* درجات الدليل المسموحة في السجل، بترتيب القوة.
     `global-field-measured` أُضيفت حين قُرئ تقرير ديلاوير 265: خمسة وعشرون
     موقعاً مقيساً بكواشف على شرايين بإشارات ليسا كتوصيةٍ في دليل تصميم،
     وجمعُهما في `global-analog` كان يُخفي أقوى ما في السجل. والقائمة هنا
     مرآةٌ لسُلَّم `masar-route-evidence.js` — من أضاف درجة هناك يضيفها هنا،
     وحزمةٌ تربط الاثنين كي لا ينفصلا. */
  var LEVELS = ['local-field', 'local-comparable', 'global-field-measured',
    'global-analog', 'context-only'];

  function cases() { return LEDGER.cases || []; }

  /** الحالات التي تحمل قياساً فعلياً يمكن أن يدخل نطاقاً. */
  function measuredCases() {
    return cases().filter(function (item) {
      return item.metric && Object.keys(item.metric).length > 0
        && item.evidenceLevel !== 'context-only';
    });
  }

  /**
   * هل هذه الحالة مؤهَّلة لمجموعة المعايرة؟
   *
   * الشرط عدد خصائص لا انطباع. والحالة الناقصة **لا تُرفض** — تُخفَّض إلى
   * «مرجع سياقي»، لأن رفضها يخفيها ويخفي معها ما تعرفه.
   */
  function eligibility(item) {
    var rule = LEDGER.acceptanceRule || { requiredAttributes: [], minimumForCalibrationSet: 8 };
    var present = rule.requiredAttributes.filter(function (key) {
      var value = item[key];
      return value !== undefined && value !== null && value !== ''
        || (item.metric && item.metric[key] !== undefined);
    });
    var enough = present.length >= rule.minimumForCalibrationSet;
    return {
      eligible: enough && item.evidenceLevel !== 'context-only',
      attributesPresent: present.length,
      attributesRequired: rule.minimumForCalibrationSet,
      demotedTo: enough ? null : (rule.belowMinimum || 'مرجع سياقي فقط'),
    };
  }

  /**
   * درجة تشابه معلنة بين حالة وسياق أثر.
   *
   * @param {object} item الحالة.
   * @param {object} context خصائص حالة أثر المقابلة.
   * @returns {{score:number, band:string, matched:string[], missing:string[]}}
   */
  function similarity(item, context) {
    var target = context || {};
    var total = 0;
    var gained = 0;
    var matched = [];
    var missing = [];

    DIMENSIONS.forEach(function (dimension) {
      total += dimension.weight;
      var mine = item[dimension.key];
      var theirs = target[dimension.key];
      if (mine === undefined || theirs === undefined) {
        missing.push(dimension.label);
        return;
      }
      if (String(mine) === String(theirs)) {
        gained += dimension.weight;
        matched.push(dimension.label);
      }
    });

    var score = total ? gained / total : 0;
    /* ثلاث فئات لا رقم: «0.43» يوحي بقياس، و«ضعيف» يقول ما يعنيه بالضبط. */
    var band = score >= 0.7 ? 'قوي' : (score >= 0.4 ? 'متوسط' : 'ضعيف');
    return { score: Math.round(score * 100) / 100, band: band,
      matched: matched, missing: missing };
  }

  /** النطاق المشتقّ لمعامل بعينه، مع سنده وحكمه على النطاق القائم. */
  function priorFor(parameter) {
    return (LEDGER.derivedPriors || []).filter(function (prior) {
      return prior.parameter === parameter;
    })[0] || null;
  }

  /**
   * كل نطاق مكتوب بين قوسين معقوفين داخل نصّ.
   *
   * السجل يكتب أحكامه ووصفاته للبشر: «نطاق `workZoneFriction` الحالي
   * [1.00 – 1.25] أضيق من الدليل»، و«يُوسَّع النطاق إلى [1.13 – 1.68]».
   * وهي أرقامٌ حاكمة مدفونة في جملة، لا يقارنها شيء بالنطاق الحيّ في الشيفرة.
   *
   * والفاصل بين الحدّين قد يكون شرطة عربية طويلة أو قصيرة أو سالباً — تُقبل
   * الثلاثة، لأن الحارس يجب أن يمسك النصّ كما يكتبه من يعدّل السجل لا كما
   * نتمنّاه.
   *
   * `lowText`/`highText` تحفظان الصياغة كما كُتبت: «1.00» تُقرأ نطاقاً
   * بمنزلتين، و`Number('1.00')` تعيدها «1» فتُعرض في المصالحة بصورة لا يجدها
   * القارئ في السجل حين يرجع إليه.
   *
   * @param {string} text نصّ عربي أو إنجليزي.
   * @returns {Array<{low:number, high:number, lowText:string, highText:string}>}
   */
  function parseRanges(text) {
    var body = String(text || '');
    var pattern = /\[\s*(-?\d+(?:\.\d+)?)\s*[–—−-]\s*(-?\d+(?:\.\d+)?)\s*\]/g;
    var found = [];
    var hit = pattern.exec(body);
    while (hit) {
      found.push({
        low: Number(hit[1]), high: Number(hit[2]),
        lowText: hit[1], highText: hit[2],
      });
      hit = pattern.exec(body);
    }
    return found;
  }

  /**
   * مصالحة نطاقٍ حيّ في الشيفرة مع ما يصفه السجل ويوصي به.
   * ---------------------------------------------------------------------------
   * **الفجوة التي تسدّها.** حكم السجل على محور أرضية الزمن نصٌّ مخزَّن:
   * يذكر نطاقاً «حالياً» ويوصي بنطاقٍ أوسع. وحين يتغيّر النطاق في الشيفرة —
   * لأي سبب، ولو كان سبباً وجيهاً — يبقى نصّ السجل على حاله. فيقرأ المحكّم
   * وصفةً معلنة بتوسيع النطاق، ويرى في الشيفرة نطاقاً **أضيق** منها ومن
   * «الحالي» المذكور، بلا سطرٍ واحد يصالح بينهما. وهذا هو شكل التضييق
   * التجميلي بالضبط، سواء أكان تضييقاً تجميلياً أم لم يكن.
   *
   * فالمصالحة **تُحسب وقت التشغيل** ولا تُخزَّن: تُقارَن الحدود العددية،
   * ويوصف الفرق بكلمة واحدة، ويُعرض النصّ المرجعي كما هو في السجل كي يُراجَع.
   *
   * @param {string} parameter مفتاح الأولوية في `derivedPriors`.
   * @param {{low:number, high:number}} live النطاق الحيّ المستعمل في الشيفرة.
   * @param {'verdictOnCurrentRange'|'action'} [field] الحقل المقروء.
   * @returns {{status:string, ledger:object|null, live:object,
   *            text:string, sentence:string}|null}
   */
  function reconcileRange(parameter, live, field) {
    var prior = priorFor(parameter);
    if (!prior || !live || !Number.isFinite(live.low) || !Number.isFinite(live.high)) {
      return null;
    }
    var key = field || 'verdictOnCurrentRange';
    var text = prior[key] || '';
    var quoted = parseRanges(text)[0] || null;
    if (!quoted) {
      return { status: 'بلا نطاق مذكور', ledger: null, live: live,
        text: text, sentence: '' };
    }

    var status;
    if (quoted.low === live.low && quoted.high === live.high) {
      status = 'مطابق';
    } else if (live.low >= quoted.low && live.high <= quoted.high) {
      status = 'أضيق';
    } else if (live.low <= quoted.low && live.high >= quoted.high) {
      status = 'أوسع';
    } else {
      status = 'مزاح';
    }

    return {
      status: status,
      ledger: quoted,
      live: live,
      text: text,
      sentence: status === 'مطابق' ? ''
        : 'وسجلّ الحالات يذكر لهذا المحور نطاق [' + quoted.lowText + ' – '
          + quoted.highText + '] والنطاق الحيّ [' + live.low + ' – ' + live.high
          + '] ' + status + ' منه.',
    };
  }

  /**
   * الصياغة المسموحة عند عرض أي نطاق مشتقّ من هذا السجل.
   *
   * تُقرأ من مكان واحد كي لا تُعاد كتابتها في كل سطح بصيغة أضعف.
   */
  function permittedPhrasing(parameter) {
    var prior = priorFor(parameter);
    if (!prior) return '';
    return 'النطاق الأولي [' + prior.priorLow + ' – ' + prior.priorHigh + '] '
      + prior.unit + ' مستند إلى حالات مشابهة عالمياً، ولم يُعاير بعد على '
      + 'إغلاق ميداني مماثل في الرياض.';
  }

  /**
   * هل هذه الصياغة مخالفة لقواعد السجل؟
   *
   * تُستدعى من بوابة الأسطح. النصّ الذي يذكر السجل ويستعمل عبارة ممنوعة
   * يُلتقَط قبل أن يصل شريحةً.
   */
  function checkClaim(text) {
    var body = String(text || '');
    var violations = [];
    (LEDGER.forbiddenUses || []).forEach(function (rule) {
      /* المطابقة على كلمات دالّة لا على الجملة كاملة: القاعدة مكتوبة للبشر
         والنصّ المخالف يُعاد صوغه دائماً. */
      var keys = rule.split(' ').filter(function (word) { return word.length > 3; });
      var hits = keys.filter(function (word) { return body.indexOf(word) !== -1; });
      if (hits.length >= Math.max(2, Math.ceil(keys.length * 0.6))) {
        violations.push(rule);
      }
    });
    return { ok: violations.length === 0, violations: violations };
  }

  /** حصيلة السجل — للعرض ولفحص الاتساق. */
  function summary() {
    var all = cases();
    var byLevel = {};
    all.forEach(function (item) {
      byLevel[item.evidenceLevel] = (byLevel[item.evidenceLevel] || 0) + 1;
    });
    return {
      total: all.length,
      measured: measuredCases().length,
      byLevel: byLevel,
      localMeasured: all.filter(function (item) {
        return item.country === 'السعودية' && item.evidenceLevel !== 'context-only';
      }).length,
      priors: (LEDGER.derivedPriors || []).length,
      pending: all.filter(function (item) { return item.status; }).length,
    };
  }

  return {
    LEDGER: LEDGER,
    DIMENSIONS: DIMENSIONS,
    LEVELS: LEVELS,
    cases: cases,
    measuredCases: measuredCases,
    eligibility: eligibility,
    similarity: similarity,
    priorFor: priorFor,
    parseRanges: parseRanges,
    reconcileRange: reconcileRange,
    permittedPhrasing: permittedPhrasing,
    checkClaim: checkClaim,
    summary: summary,
  };
});
