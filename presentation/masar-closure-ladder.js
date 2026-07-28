/**
 * مسار — سلّم استمرارية الخدمة.
 * ---------------------------------------------------------------------------
 * السؤال الذي يجيب عنه هذا الملف جاء نصاً من مراجعة النموذج: «المقصد أن
 * الحلول البديلة تغطي مكان هذا الشارع، وليس بالضرورة أن أخرج من الطرف
 * الثاني». النموذج كان يعرف حالتين: الشارع مفتوح، أو ممنوعٌ بالكامل والحل
 * التفافٌ حوله. والواقع الهندسي سلّمٌ بينهما: حفرُ جهةٍ وإبقاء جهة، حارةٌ
 * واحدة مغلقة، إبقاءُ حارةٍ سالكة — **الشارع يواصل خدمة مكانه** والإغلاق
 * الكامل آخر الدرجات لا أولها.
 *
 * والمفارقة أن التسعير كان موجوداً من اليوم الأول: `MasarEngine.score`
 * يقبل `lanesClosed` أقل من `lanes` ويحسب أثره. ما غاب هو **عرضُ الدرجات
 * قراراً**: كم يكلّف كل مستوى إغلاق، وما شروطه التشغيلية، ومتى يُسمح
 * بالكامل. هذه الوحدة تبني ذلك العرض ولا تحسب رقماً مرورياً واحداً بنفسها —
 * كل تأخير يخرج من نداء `score()` (قاعدة «الحساب له مصدر واحد»)، وافتراضات
 * المحرك تسافر مع أرقامه.
 *
 * وقفل القوس مع بوابات السلامة: `recommend()` لا يجيز الإغلاق الكامل إلا
 * ببديلٍ مرّ بوابات `masar-detour-policy`. **البديل يقيّد التصريح، لا
 * العكس** — حين لا بديل مقبولاً، تهبط التوصية درجةً على السلّم بدل أن يهبط
 * الحمل داخل حيّ.
 *
 * البُعد هنا مكاني (كم حارة تُغلق). البُعد الزمني (متى) عند
 * `MasarEngine.optimize` ولا يُكرَّر — والدرجة التي لا تنجو مكانياً تُحال
 * إليه (`schedule-only`).
 *
 * UMD بنمط المحرك. نقية: مُدخل تصريح، مُخرج سلّم وتوصية.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(function () { return require('./masar-engine.js'); });
  } else {
    root.MasarClosureLadder = factory(function () { return root.MasarEngine; });
  }
})(typeof self !== 'undefined' ? self : this, function (loadEngine) {
  'use strict';

  /** التبعية تُحلّ عند الاستعمال — لا فرضَ ترتيبِ وسوم على الصفحات. */
  var Engine = null;
  function engine() {
    if (!Engine) Engine = loadEngine();
    return Engine;
  }

  /**
   * شروط تشغيلية معلنة، لا أرقام: ما يجب أن يبقى قائماً كي «يغطي البديل
   * مكان الشارع». مصدرها متطلبات خدمة الشارع نفسها — مشاة، عقارات مطلّة،
   * إسعاف — وهي قائمة فحصٍ للتصريح لا كمياتٌ تُحسب.
   */
  var BASE_CONDITIONS = [
    'ممر مشاة متصل ومحمي على طول الموقع — لا يُقطع في أي مرحلة',
    'منفذ إسعاف وطوارئ مضمون طوال نافذة العمل',
  ];
  var SINGLE_OPEN_LANE_CONDITION =
    'تشغيل الحارة المتبقية بالتناوب (إشارة مؤقتة أو مُنظِّم) أو باتجاه واحد معلَن';
  var FULL_CLOSURE_CONDITIONS = [
    'وصول العقارات المطلّة من نقاط دوران محلية داخل المقطع — الساكن يدخل ويخرج من طرفه',
    'بديل مروري يمرّ بوابات السلامة (masar-detour-policy) قبل إصدار التصريح',
  ];

  /** مفاتيح الدرجات — ثابتة كي تُختبر وتُترجم من موضع واحد. */
  var STEPS = {
    SINGLE_LANE: 'single-lane',
    HALF_WIDTH: 'half-width',
    KEEP_ONE_LANE: 'keep-one-lane',
    FULL: 'full',
  };

  var LABELS = {};
  LABELS[STEPS.SINGLE_LANE] = 'إغلاق حارة واحدة';
  LABELS[STEPS.HALF_WIDTH] = 'إغلاق نصف العرض';
  LABELS[STEPS.KEEP_ONE_LANE] = 'إبقاء حارة واحدة سالكة';
  LABELS[STEPS.FULL] = 'إغلاق كامل';

  /**
   * درجات السلّم لعدد حارات: مجموعة `lanesClosed` المرشحة، تصاعدياً.
   * الدرجات الأربع تتطابق أحياناً (طريق بحارتين: نصف العرض هو إبقاء حارة هو
   * حارة واحدة) فتُدمج بمفاتيحها معاً — درجةٌ واحدة بأسمائها كلها أصدقُ من
   * ثلاث درجات برقمٍ واحد.
   */
  function candidateSteps(lanes) {
    var byClosed = {};
    function add(key, closed) {
      if (closed < 1 || closed > lanes) return;
      if (!byClosed[closed]) byClosed[closed] = [];
      byClosed[closed].push(key);
    }
    add(STEPS.SINGLE_LANE, 1);
    add(STEPS.HALF_WIDTH, Math.ceil(lanes / 2));
    if (lanes > 1) add(STEPS.KEEP_ONE_LANE, lanes - 1);
    add(STEPS.FULL, lanes);
    return Object.keys(byClosed)
      .map(Number)
      .sort(function (a, b) { return a - b; })
      .map(function (closed) { return { lanesClosed: closed, keys: byClosed[closed] }; });
  }

  /** شروط درجةٍ بعدد حاراتها المفتوحة. */
  function conditionsFor(lanesOpen) {
    var out = BASE_CONDITIONS.slice();
    if (lanesOpen === 1) out.push(SINGLE_OPEN_LANE_CONDITION);
    if (lanesOpen === 0) out = out.concat(FULL_CLOSURE_CONDITIONS);
    return out;
  }

  /**
   * بناء السلّم: كل درجة مسعَّرة بنداء `score()` نفسه الذي تشترك فيه الواجهة
   * والخادم والاختبارات. لا معادلة هنا — نداءٌ وعرض.
   *
   * @param {object} permit {aadt, lanes, freeFlowMin, startHour,
   *   durationHours, capacityPerLane?, calibration?} — نفس شكل مُدخل score
   *   بلا lanesClosed؛ والتحقق من الصحة عند المحرك لا هنا (مصدر واحد للرفض).
   * @returns {{steps:Array, assumptions:Array<string>}}
   */
  function buildLadder(permit) {
    if (!permit || !Number.isInteger(permit.lanes) || permit.lanes < 1) {
      throw new RangeError('lanes: عدد حارات صحيح موجب مطلوب لبناء السلّم');
    }

    var steps = candidateSteps(permit.lanes).map(function (candidate) {
      var scored = engine().score(shallowWith(permit, candidate.lanesClosed));
      var lanesOpen = permit.lanes - candidate.lanesClosed;
      return {
        keys: candidate.keys,
        label: candidate.keys.map(function (key) { return LABELS[key]; }).join(' = '),
        lanesClosed: candidate.lanesClosed,
        lanesOpen: lanesOpen,
        delayVehHours: scored.delayVehHours,
        score: scored.score,
        level: scored.level,
        conditions: conditionsFor(lanesOpen),
        /* الجدوى الإنشائية (عرض الخندق مقابل عرض الحارات المتبقية) قرارٌ
           ميداني لا يملك النموذج بياناته — يُقال ذلك بدل ادّعائه. */
        requiresFieldCheck: lanesOpen > 0,
      };
    });

    return {
      steps: steps,
      assumptions: [
        'التأخير لكل درجة من MasarEngine.score بافتراضاته المعلنة — لا حساب مستقل هنا',
        'جدوى الحفر مع إبقاء حارات (عرض الخندق مقابل عرض الطريق) غير ممثَّلة — '
          + 'فحص ميداني يسبق اعتماد أي درجة جزئية',
        'البُعد الزمني (نوافذ الليل) عند MasarEngine.optimize — السلّم مكانيّ فقط',
      ],
    };
  }

  function shallowWith(permit, lanesClosed) {
    var out = {};
    Object.keys(permit).forEach(function (key) { out[key] = permit[key]; });
    out.lanesClosed = lanesClosed;
    return out;
  }

  /** هل في ناتج بوابات السلامة بديلٌ غير مرفوض؟ */
  function hasPassingAlternative(audit) {
    if (!audit || audit.ok === false || !Array.isArray(audit.alternatives)) return false;
    return audit.alternatives.some(function (route) {
      return route.policy && route.policy.verdict !== 'fail';
    });
  }

  /**
   * التوصية: أعلى درجةٍ مسموحة للطلب المقدَّم.
   * ---------------------------------------------------------------------------
   * ثلاثة أحكام لا رابع لها، وكلها معلَّلة في المخرج:
   *
   * ١) طلبٌ جزئي (`lanesClosed < lanes`): الشارع يواصل خدمة مكانه — يُجاز
   *    كما طُلب بشروط درجته.
   * ٢) طلبٌ كامل وبديلٌ مرّ البوابات: يُجاز الكامل مشروطاً بذلك البديل.
   * ٣) طلبٌ كامل ولا بديل يمرّ: تهبط التوصية إلى أعلى درجة جزئية، ويُعرض
   *    فرق التأخير ثمناً معلناً للهبوط. وطريقٌ بحارةٍ واحدة لا جزئيّ له،
   *    فيُحال إلى الجدولة الزمنية (`schedule-only`) — أو تعديل نطاق التصريح.
   *
   * @param {{steps:Array}} ladder ناتج buildLadder
   * @param {number} requestedLanesClosed ما طلبه مقدّم التصريح
   * @param {object|null} detourAudit ناتج MasarDetourPolicy.audit (للكامل)
   */
  function recommend(ladder, requestedLanesClosed, detourAudit) {
    var steps = ladder.steps;
    var last = steps[steps.length - 1];
    var lanes = last.lanesClosed + last.lanesOpen;
    if (!Number.isInteger(requestedLanesClosed)
      || requestedLanesClosed < 1 || requestedLanesClosed > lanes) {
      throw new RangeError('requestedLanesClosed: بين 1 وعدد حارات الطريق');
    }

    var requested = nearestStep(steps, requestedLanesClosed);

    if (requestedLanesClosed < lanes) {
      return {
        mode: 'as-requested',
        step: requested,
        reason: 'إغلاق جزئي — الشارع يواصل خدمة مكانه، والشروط شروط درجته',
      };
    }

    if (hasPassingAlternative(detourAudit)) {
      return {
        mode: 'as-requested',
        step: requested,
        reason: 'إغلاق كامل مُجاز: يوجد بديل مرّ بوابات السلامة، وهو شرط الإصدار',
      };
    }

    var partials = steps.filter(function (step) { return step.lanesOpen > 0; });
    if (!partials.length) {
      return {
        mode: 'schedule-only',
        step: null,
        reason: 'طريق بحارة واحدة ولا بديل يمرّ البوابات — لا درجة جزئية تُنزَل '
          + 'إليها؛ الجواب نافذة زمنية (MasarEngine.optimize) أو تعديل نطاق التصريح',
      };
    }

    var fallback = partials[partials.length - 1];
    return {
      mode: 'stepped-down',
      step: fallback,
      reason: 'لا بديل يمرّ بوابات السلامة — البديل يقيّد التصريح: تهبط التوصية '
        + 'إلى «' + fallback.label + '» ويبقى الشارع يخدم مكانه',
      /* ثمن الهبوط معلَن: فرق تأخير الدرجتين بوحدة المحرك نفسها. الجزئي
         أقل تأخيراً تعريفاً (سعة أكبر)، فالفرق ≥ صفر ويُقرأ وفراً. */
      savedVehHours: requested.delayVehHours - fallback.delayVehHours,
    };
  }

  /** الدرجة التي تطابق عدد الحارات المطلوب، أو الأقرب فوقه. */
  function nearestStep(steps, lanesClosed) {
    for (var i = 0; i < steps.length; i += 1) {
      if (steps[i].lanesClosed >= lanesClosed) return steps[i];
    }
    return steps[steps.length - 1];
  }

  return {
    STEPS: STEPS,
    LABELS: LABELS,
    BASE_CONDITIONS: BASE_CONDITIONS,
    FULL_CLOSURE_CONDITIONS: FULL_CLOSURE_CONDITIONS,
    candidateSteps: candidateSteps,
    buildLadder: buildLadder,
    recommend: recommend,
    hasPassingAlternative: hasPassingAlternative,
  };
});
