/**
 * مسار — تحليل التصريح: من خصائصه إلى مدخلات المحرك ثم إلى حصيلة القرار.
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
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./masar-stability.js'));
  } else {
    root.MasarDeskAnalysis = factory(root.MasarStability);
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
   *
   * ---------------------------------------------------------------------------
   * **الغائب يُقال غائباً — لا يصير NaN.**
   *
   * كل مدخل هنا له احتياطٌ معلن: الحجم والسعة والمسارات ترجع إلى ثوابت المحرك،
   * وساعة البدء إلى الثامنة. إلا واحداً: **مدة الإغلاق**. لا تواريخ صالحة ولا
   * عدد أيام ولا ساعات معلنة يعني أن أحداً لا يعرف كم يدوم هذا الإغلاق — ولا
   * ثابتَ في المحرك يجيب عن ذلك.
   *
   * وكان الحساب يجيب عنه بـ`NaN`: `Math.ceil((NaN - NaN)/86400000)` يعطي NaN،
   * فيضربه في النافذة فيمرّ إلى `optimize` فيرمي `RangeError` — يقع خارج أي
   * حارس، فيبقى ملف القرار على التصريح **السابق** بينما المخزن حدّد الجديد.
   * المراجع يقرأ ملفاً لتصريح غير الذي اختاره. وذلك أسوأ من شاشة تسقط.
   *
   * فالمدة الآن `null` صريحة حين تغيب، و`evaluate` يمتنع ويسمّي ما ينقص.
   */
  function inputsFor(properties, Engine) {
    var p = properties || {};
    var start = Date.parse(p.start);
    var end = Date.parse(p.end);

    var windowHours = Number(p.windowHours) > 0
      ? Number(p.windowHours) : Engine.WORK_WINDOW_HOURS;

    var spanDays = (isFinite(start) && isFinite(end) && end > start)
      ? Math.max(1, Math.ceil((end - start) / 86400000)) : null;
    var workDays = Number(p.workDays) > 0 ? Number(p.workDays) : spanDays;

    // حين يغيب المجموع يُستنتج من النافذة والأيام، ولا يُفترض رقماً.
    // وحين تغيب الأيام كذلك يبقى `null` — لا صفرٌ ولا واحدٌ ولا NaN.
    var declaredTotal = Number(p.durationHours) > 0
      ? Math.max(MIN_PERMIT_HOURS, Math.min(Number(p.durationHours), MAX_PERMIT_HOURS))
      : null;
    var totalHours = declaredTotal !== null ? declaredTotal
      : (workDays !== null ? windowHours * workDays : null);

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

  /**
   * ما لا يُعوَّض بافتراض معلن — أي ما يوجب الامتناع.
   * ---------------------------------------------------------------------------
   * القاعدة: مدخلٌ له ثابتٌ في المحرك ليس ناقصاً بل **مفترَضاً**، ويُقال ذلك
   * في ذيل البطاقة وفي شريط الثقة. ومدخلٌ بلا ثابت هو الناقص، والقرار عليه
   * محجوب. اليوم واحد فقط بهذا الوصف: مدة الإغلاق.
   *
   * تُصدَّر كي يقرأها الصندوق أيضاً: المراجع يرى الثغرة في الطابور قبل أن
   * يفتح الملف، لا بعده.
   *
   * @param {object} properties خصائص التصريح
   * @returns {Array<{field:string, label:string, needed:string}>} فارغة إن اكتمل
   */
  function missingInputs(properties) {
    var p = properties || {};
    var start = Date.parse(p.start);
    var end = Date.parse(p.end);
    var hasSpan = isFinite(start) && isFinite(end) && end > start;

    if (Number(p.durationHours) > 0 || Number(p.workDays) > 0 || hasSpan) return [];

    return [{
      field: 'durationHours',
      label: 'مدة الإغلاق',
      needed: 'تاريخا البدء والانتهاء، أو عدد أيام العمل، أو مجموع ساعاته',
    }];
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
   * الحصيلة الممتنعة — بالشكل نفسه الذي تتوقّعه كل شاشة تقرؤها.
   * ---------------------------------------------------------------------------
   * `scored` يبقى **كائناً** لا `null`: تبويب القياس في المُقلع يقرأ
   * `analysis.scored.delayVehHours` مباشرة، و`null` هناك يرمي TypeError —
   * أي نُبدل انهياراً بانهيار. فالكائن يبقى وحقلُه `null`: «غير معروف» تُقرأ
   * ولا تُسقط.
   *
   * و`delayPct` و`level` يبقيان محسوبين: هما خاصيتا ساعةٍ من اليوم، والمدة
   * الغائبة لا تمسّهما. حجبُ ما لا يزال معلوماً امتناعٌ زائد.
   */
  function abstain(input, scored, missing, isFailure) {
    return {
      scored: { delayVehHours: null, delayPct: delayPercent(scored), level: scored.level },
      stability: null,
      alternatives: [],
      reasons: [],
      delta: null,
      units: null,
      objective: null,
      switchPoints: [],
      residualSensitivity: [],
      candidateCount: 0,
      tradeOff: null,
      incomplete: { fields: missing, failure: !!isFailure },
      input: input,
    };
  }

  /**
   * حصيلة القرار لتصريح واحد.
   * @param {object} properties خصائص التصريح
   * @param {object} Engine محرك مسار
   * @returns {{scored:object, alternatives:Array, reasons:Array, delta:number|null,
   *            units:object, input:object}}
   */
  function evaluate(properties, Engine) {
    var input = inputsFor(properties, Engine);

    // النافذة اليومية وحدها: الشدة ونسبة تأخير الرحلة خاصيتا ساعةٍ من اليوم
    // لا حصيلةَ تصريح، وقراءتهما من المجموع تخلط الليل بالنهار.
    var scored = Engine.score(input);

    /* الامتناع قبل الحساب لا بعده.
       المدة الغائبة تجعل حصيلة التصريح كلَّها غير معرَّفة: `optimize` يحتاجها،
       وحصيلةُ الأساس هي حصيلةُ النافذة مضروبةً في الأيام. فما يبقى معرَّفاً هو
       ما يخصّ **الساعة** لا التصريح: نسبة تأخير الرحلة والشدة. تُعرض هي،
       ويُقال عن الباقي إنه محجوب. */
    var missing = missingInputs(properties);
    if (missing.length) return abstain(input, scored, missing);

    /* وأي خطأ آخر من المحرك يصير امتناعاً مرئياً كذلك.
       ليس ستراً: الرسالة تُعرض حرفياً على البطاقة تحت عنوانٍ يميّزها عن نقص
       البيانات. المقصود أن **لا مسار في هذه الوحدة يترك الشاشة على ملف تصريحٍ
       آخر**؛ العطل يُقال، ولا يُقرأ الصمت جواباً. */
    var optimized;
    try {
      optimized = Engine.optimize(planInput(input)) || {};
    } catch (err) {
      return abstain(input, scored, [{
        field: 'engine',
        label: 'تعذّر حساب البدائل',
        needed: String((err && err.message) || err),
      }], true);
    }

    var alternatives = (optimized.top3 || []).slice(0, 3);
    var best = alternatives[0];

    /* الاحتياط لا يضرب في `null`: مدةٌ معلنة بلا أيامٍ معروفة تجعل
       `input.workDays` غائباً، وضربُه يعطي صفراً يُقرأ «لا أثر». فحين يغيب
       الأساس **وتغيب الأيام** يمتنع الحساب بدل أن يخترع صفراً. */
    if (!optimized.baseline && !(Number(input.workDays) > 0)) {
      return abstain(input, scored, [{
        field: 'workDays',
        label: 'عدد أيام العمل',
        needed: 'تاريخا البدء والانتهاء، أو عدد أيام العمل صراحةً',
      }]);
    }

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
      /* الحقل موجود دائماً بالقيمتين: `null` هنا و«كائن» في الامتناع. الحقل
         الذي يظهر ويختفي يُقرأ بـ`a.incomplete &&` في مكان وبـ`!a.incomplete`
         في آخر، فيفترق السطحان. */
      incomplete: null,
      input: input,
    };
  }

  return {
    inputsFor: inputsFor,
    missingInputs: missingInputs,
    delayPercent: delayPercent,
    planInput: planInput,
    evaluate: evaluate,
    MIN_PERMIT_HOURS: MIN_PERMIT_HOURS,
    MAX_PERMIT_HOURS: MAX_PERMIT_HOURS,
  };
});
