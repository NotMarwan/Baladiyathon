/**
 * أثر — تحليل التصريح: من خصائصه إلى مدخلات المحرك ثم إلى حصيلة القرار.
 * ---------------------------------------------------------------------------
 * كان هذا داخل مُقلع المكتب، فلم يكن قابلاً للاختبار إلا عبر متصفح — وهناك
 * تسلّل الخلل: المكتب كان يعرض للتصريح رقماً وبطاقةُ الخريطة رقماً آخر، في
 * ١٣٢ من ١٥٠ سجلاً. السبب أن الأول كان يضرب نافذة يوم كامل في عدد الأيام،
 * والثاني يقرأ ما حسبه `scripts/build-city-portfolio.js` من `optimize` —
 * وهو يبني نوافذه من المدة الكلية فتكون الأخيرة ناقصةً حين لا تنتهي المدة
 * على حدّ اليوم. الفارق تحت ١٪، وهو أسوأ من فارق كبير: لا يُرى ويُقرأ تناقضاً
 * حين يُرى.
 *
 * فالحساب خرج إلى وحدة نقية:
 *
 *   1) `inputsFor` تشتقّ المدخلات بقواعد بناء المحفظة نفسها — النافذة اليومية
 *      والمجموع وسقفهما — فلا تفترق عنها.
 *   2) `evaluate` تأخذ الحصيلة من `optimize` مباشرة: `baseline` للمطلوب،
 *      و`top3[0]` للموصى به. كلاهما مجموعٌ على أيام التصريح فلا يُضرب بعده.
 *   3) نقية بالكامل — لا DOM ولا مخزن ولا ساعة. التعارض يُضاف من المستدعي،
 *      فهو خاصية المحفظة لا خاصية التصريح.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./athar-stability.js'));
  } else {
    root.AtharDeskAnalysis = factory(root.AtharStability);
  }
})(typeof self !== 'undefined' ? self : this, function (Stability) {
  'use strict';

  /** حدّا مدة التصريح كما في `scripts/build-city-portfolio.js` — لا رقمان. */
  var MIN_PERMIT_HOURS = 4;
  var MAX_PERMIT_HOURS = 240;

  /**
   * مدخلات المحرك من خصائص التصريح.
   * `durationHours` النافذة اليومية، و`totalHours` مجموع ساعات العمل عليها.
   * الخلط بينهما هو الخلل الذي أنتج رقمين لكمية واحدة.
   */
  function inputsFor(properties, Engine) {
    var p = properties || {};
    var start = Date.parse(p.start);
    var end = Date.parse(p.end);

    var windowHours = Number(p.windowHours) > 0
      ? Number(p.windowHours) : Engine.WORK_WINDOW_HOURS;
    var workDays = Number(p.workDays) > 0 ? Number(p.workDays)
      : Math.max(1, Math.ceil((end - start) / 86400000));

    // حين يغيب المجموع يُستنتج من النافذة والأيام، ولا يُفترض رقماً.
    var totalHours = Number(p.durationHours) > 0
      ? Math.max(MIN_PERMIT_HOURS, Math.min(Number(p.durationHours), MAX_PERMIT_HOURS))
      : windowHours * workDays;

    return {
      aadt: Number(p.aadt) > 0 ? Number(p.aadt) : Engine.DEFAULTS.aadt,
      lanes: Number(p.lanes) || Engine.DEFAULTS.lanes,
      lanesClosed: Number(p.lanesClosed) || 1,
      // التاريخ مكتوب بحساب UTC في بناء المحفظة، فتُقرأ الساعة منه بحسابه.
      startHour: isNaN(start) ? 8 : new Date(start).getUTCHours(),
      durationHours: windowHours,
      capacityPerLane: Engine.DEFAULTS.capacityPerLane,
      freeFlowMin: Engine.DEFAULTS.freeFlowMin,
      workDays: workDays,
      totalHours: totalHours,
      /* WP-B1: الحساسية تسافر مع المُدخل. من دونها يحسب المكتب توصيةً تجهل
         الجوار الحسّاس بينما البطاقة تعرض «مستشفى» — رقمان لكمية واحدة. */
      sensitivity: p.sensitivity,
    };
  }

  /** نسبة تأخير الرحلة على النافذة اليومية — موزونةً بالطلب لا بالساعات. */
  function delayPercent(scored) {
    var base = 0;
    var closed = 0;
    ((scored && scored.hourly) || []).forEach(function (hour) {
      base += hour.demand * hour.baseT;
      closed += hour.demand * hour.closedT;
    });
    return base > 0 ? ((closed - base) / base) * 100 : 0;
  }

  /** ما يُمرَّر إلى `optimize`: المدة الكلية لا النافذة. */
  function planInput(input) {
    return {
      aadt: input.aadt,
      lanes: input.lanes,
      lanesClosed: input.lanesClosed,
      startHour: input.startHour,
      durationHours: input.totalHours,
      capacityPerLane: input.capacityPerLane,
      freeFlowMin: input.freeFlowMin,
      sensitivity: input.sensitivity,
    };
  }

  /**
   * ذاكرة تصنيف الاستقرار.
   *
   * التصنيف يستدعي `optimize` عشرين مرة، وقياسه هنا ربع ثانية للتصريح
   * الواحد. والمكتب يُفرز بلوحة المفاتيح — تصريح كل ثانية أو أقل — فربعُ
   * ثانية عند كل تحديد يُشعر بالبطء. المفتاح رقم التصريح ونسخة مدخلاته معاً:
   * تعديل المدخلات يبطل الذاكرة، وإعادة التحديد لا تبطلها.
   */
  var stabilityCache = {};

  function classifyCached(properties, input) {
    if (!Stability || !Stability.classify) return null;
    var key = (properties.permitRef || properties.id || '?')
      + '|' + (properties.inputsVersion || '') + '|' + (properties.version || '');
    if (Object.prototype.hasOwnProperty.call(stabilityCache, key)) {
      return stabilityCache[key];
    }
    var verdict = Stability.classify(input);
    stabilityCache[key] = verdict;
    return verdict;
  }

  /**
   * حصيلة القرار لتصريح واحد.
   * @param {object} properties خصائص التصريح
   * @param {object} Engine محرك أثر
   * @returns {{scored:object, alternatives:Array, reasons:Array, delta:number|null,
   *            units:object, input:object}}
   */
  function evaluate(properties, Engine) {
    var input = inputsFor(properties, Engine);

    // النافذة اليومية وحدها: الشدة ونسبة تأخير الرحلة خاصيتا ساعةٍ من اليوم
    // لا حصيلةَ تصريح، وقراءتهما من المجموع تخلط الليل بالنهار.
    var scored = Engine.score(input);
    var optimized = Engine.optimize(planInput(input)) || {};

    var alternatives = (optimized.top3 || []).slice(0, 3);
    var best = alternatives[0];

    var asked = optimized.baseline ? optimized.baseline.delayVehHours
      : scored.delayVehHours * input.workDays;
    var bestTotal = best ? best.delayVehHours : null;

    // الأثر بوحدات القرار: ساعات الناس والريال والكربون بنطاقاتها المعلنة.
    var ph = Engine.personHours(asked);
    var vot = Engine.timeValueSAR(ph);
    var carbon = Engine.co2Range(asked);

    /* استقرار التوصية يُحسب هنا لا في الواجهة: الشاشة التي تعرض توصيةً
       دون أن تعرف هل تنقلب بافتراض واحد تعرض ثقةً لا تملكها. وغياب الوحدة
       (صفحة لم تحمّلها) يعطي `null` — والواجهة تعرض «غير مفحوص» لا
       «مستقرّة». الافتراض الصامت هنا كان سيكون أسوأ صمت في المنتج. */
    var stability = classifyCached(properties, planInput(input));

    return {
      scored: { delayVehHours: asked, delayPct: delayPercent(scored), level: scored.level },
      stability: stability,
      alternatives: alternatives,
      reasons: (best && best.reasons) || [],
      delta: bestTotal !== null && asked > 0 ? ((bestTotal - asked) / asked) * 100 : null,
      units: {
        personHoursLow: ph.lowPersonHours,
        personHoursHigh: ph.highPersonHours,
        occLow: ph.occLow,
        occHigh: ph.occHigh,
        sarLow: vot.lowSAR,
        sarHigh: vot.highSAR,
        wageHourlySAR: vot.wageHourlySAR,
        shareLow: vot.shareLow,
        shareHigh: vot.shareHigh,
        co2Low: carbon.lowCo2Kg,
        co2High: carbon.highCo2Kg,
      },
      /* WP-B1 — ما يجعل التوصية قابلة للمساءلة لا للقبول فقط:
         · `objective` أي الحدود دخلت وأيها وزن معلن لا قياس.
         · `switchPoints` عند أي وزن تنقلب التوصية — فيُقرأ الوزن بمداه لا
           كرقم مُنزَل. نقطة انقلاب قريبة جداً إقرارٌ بهشاشة التوصية.
         · `residualSensitivity` هل الجواب معلَّق على نسبة السعة المتبقية.
         · `tradeOff` حين يكون تأخير التوصية أعلى من المقدَّم. */
      objective: optimized.objective || null,
      switchPoints: optimized.switchPoints || [],
      residualSensitivity: optimized.residualSensitivity || [],
      candidateCount: optimized.candidateCount || 0,
      tradeOff: best && optimized.baseline
        && best.delayVehHours > optimized.baseline.delayVehHours
        ? {
          extraDelayVehHours: best.delayVehHours - optimized.baseline.delayVehHours,
          totalGain: optimized.baseline.totalEquivalentVehHours
            - best.totalEquivalentVehHours,
        }
        : null,
      input: input,
    };
  }

  return {
    inputsFor: inputsFor,
    delayPercent: delayPercent,
    planInput: planInput,
    evaluate: evaluate,
    MIN_PERMIT_HOURS: MIN_PERMIT_HOURS,
    MAX_PERMIT_HOURS: MAX_PERMIT_HOURS,
  };
});
