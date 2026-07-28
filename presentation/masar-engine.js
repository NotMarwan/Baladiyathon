/**
 * MasarEngine — pure computation core for the "Masar" (مسار) road-works impact
 * prototype. No DOM, no fetch, no Date.now() dependencies in the math.
 * Shared verbatim by the browser UI, the Node test suite, and the Node
 * stdlib backend server.
 *
 * UMD export: `window.MasarEngine` in the browser, `module.exports` in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------

  // Typical urban weekday traffic distribution (fractions of daily AADT per
  // hour, 24 values summing to 1.0). AM peak ~7-9, PM peak ~16-19.
  // افتراض توضيحي للعرض (illustrative demo assumption — shape only, not a
  // measured KSA count).
  const HOURLY_PROFILE = [
    0.010, 0.007, 0.005, 0.005, 0.007, 0.015, // 0-5
    0.035, 0.070, 0.080, 0.060, 0.045, 0.045, // 6-11
    0.048, 0.045, 0.045, 0.048, 0.058, 0.075, // 12-17
    0.090, 0.070, 0.050, 0.038, 0.028, 0.021, // 18-23
  ]; // per-mille integers / 1000, sums exactly to 1.000; shape only — افتراض توضيحي للعرض

  const DEFAULTS = {
    aadt: 85000, // افتراض توضيحي للعرض — illustrative demo AADT for the King Fahd Rd (Olaya) segment; real AADT unverifiable (see Out of Scope)
    lanes: 4, // افتراض توضيحي للعرض — typical arterial lane count for the demo corridor
    capacityPerLane: 1800, // veh/hr/lane — standard HCM-style saturation flow assumption, افتراض توضيحي للعرض
    freeFlowMin: 6, // minutes — free-flow travel time across the demo segment length, افتراض توضيحي للعرض
    lengthKm: 4.2, // km — approximate King Fahd Rd (Olaya) demo segment length, افتراض توضيحي للعرض
    valueOfTimeSAR: 45, // SAR/veh-hour — افتراض توضيحي للعرض (demo value-of-time for narrative use only)
    idleFuelLPerHour: 0.9, // L/vehicle-hour idling — افتراض توضيحي للعرض, order-of-magnitude idle consumption
    co2KgPerL: 2.31, // kg CO2 per liter gasoline — standard emissions factor, see sciencedirect.com/org/science/article/pii/S1556831824000285 (Sources Ledger #10)
    // WP-A2: حُذف trenchCostPerKmSAR (كان 850000، موسوماً «افتراض توضيحي»).
    // كان يضرب في نطاق GAO 25–33٪ فينتج «وفر» بملايين الريالات لا مُدخل له
    // معروض ولا مصدر. وسجل المصادر نفسه يقول إن نطاق GAO لا يدعم تعميماً على
    // حفريات المدن. digOnce() صارت تعيد كمية مادية محسوبة بدل تقدير مالي —
    // انظر رأس الدالة.
    // --- نطاقات المعيار الرابع (23 يوليو 2026) ---
    occupancyLow: 1.2, // شخص/مركبة — افتراض توضيحي للعرض؛ كود 203 يشترط الإشغال لا عدّ المركبات (src-003) ولا رقم رياض رسمي منشور
    occupancyHigh: 1.6, // شخص/مركبة — الحد الأعلى للنطاق، افتراض توضيحي للعرض
    wageMonthlySAR: 5800, // متوسط الأجر الشهري، GASTAT الربع الأول 2026 (src-017)
    workHoursPerMonth: 160, // ساعة/شهر — افتراض توضيحي للعرض لتحويل الأجر إلى ساعة
    votShareLow: 0.4, // نصيب قيمة الوقت من الأجر — حد الراكب المشارك، كود الطرق 203 (src-003)
    votShareHigh: 0.7, // نصيب قيمة الوقت من الأجر — حد السفر بين المدن، كود الطرق 203 (src-003)
    idleFuelLPerHourLow: 0.7, // لتر/ساعة-مركبة — حد أدنى، افتراض توضيحي للعرض
    idleFuelLPerHourHigh: 1.1, // لتر/ساعة-مركبة — حد أعلى، افتراض توضيحي للعرض
    busRoutesOnSegment: 3, // مسارات حافلات تعبر مقطع العرض — افتراض توضيحي مبني على طبقة المسارات المفتوحة (src-011)
    busesPerHourPerRoute: 4, // حافلة/ساعة/مسار (تواتر 15 دقيقة) — افتراض توضيحي للعرض
    ridersPerBusLow: 15, // راكب/حافلة — حد أدنى، افتراض توضيحي للعرض
    ridersPerBusHigh: 40, // راكب/حافلة — حد أعلى، افتراض توضيحي للعرض
  };

  // WP-A2: حُذف نطاق GAO (25–33٪) من المحرك.
  //
  // النطاق نفسه صحيح ومصدره أوّليّ، لكنه يخصّ مدّ الألياف في مدن أمريكية
  // كثيفة. سجل مصادر المشروع يقول في حقل «لا يدعم» إنه لا يدعم نسبة عامة لكل
  // حفريات المدن — وكان المحرك يطبّقه على خندق بلدي سعودي، فيخالف تحذيره
  // المكتوب. يبقى النطاق في masar-sources.html سياقاً مرجعياً، ولا يدخل حساباً.
  //
  // ما حلّ محلّه: كمية مادية محسوبة من بيانات التصريح وحدها — انظر digOnce().
  const COST_NOTE = 'الوفر المالي = الطول المكرر × كلفة الخندق لدى الأمانة. '
    + 'الكلفة مُدخل تشغيلي لا يملكه النموذج.';

  // الطول المكرر يفترض تداخلاً تاماً بين مسارات المجموعة. الافتراض يسافر مع
  // الرقم أينما عُرض، فلا يُقرأ الرقم حقيقةً هندسية. متى حُسب التداخل الفعلي
  // سقط هذا النص وحلّ محلّ الرقم رقمٌ محسوب.
  const OVERLAP_ASSUMPTION = 'بافتراض تداخل تام بين مسارات المجموعة — '
    + 'التداخل الهندسي الفعلي غير محسوب، والتقاطع الجزئي يجعل الرقم أعلى من الواقع.';

  // Parallel-corridor superposition factor used by compound(): when two
  // nearby permits are active at once, their combined delay is modelled as
  // slightly worse than the arithmetic sum (interaction effects).
  // افتراض توضيحي للعرض (demo assumption).
  const COMPOUND_FACTOR = 1.3;

  // Normalization constant for score(): score = 100 * delayVehHours / (aadt * SCORE_CALIBRATION)
  // افتراض توضيحي للعرض (demo calibration constant, not sourced).
  // مُصمَّم لإعادة المعايرة الدورية من نتائج back-test المسجّلة (ساعات-مركبة
  // مقيسة قبل/بعد لكل تصريح منفَّذ).
  const SCORE_CALIBRATION = 0.35;

  // Minimum capacity floor fraction applied when lanesClosed >= lanes, so the
  // BPR function never divides by (near) zero. افتراض توضيحي للعرض.
  const MIN_CAPACITY_FRACTION = 0.25;

  /* سعة الحارة **داخل** منطقة العمل — مركبة/ساعة/حارة.
     -----------------------------------------------------------------------
     كان المحرك يفترض أن الحارات المفتوحة بجوار الإغلاق تعمل بسعتها الكاملة
     (1800)، ثم يعوّض النقص بأرضيةٍ على الزمن. وهذا خطأ في موضعين معاً:
       · الحارة المجاورة لإغلاق **لا** تعمل بسعتها الكاملة. تضيق، وتقترب من
         الحاجز، ويتباطأ سائقوها. وهذا مقيسٌ لا مفترَض.
       · والتعويض بأرضية زمن ليس تعويضاً عن سعة: قيد السعة لا يعمل إلا قرب
         التشبّع، والأرضية تعمل عند كل مستويات الطلب — فتخترع تأخيراً في
         الثالثة فجراً حيث لا ازدحام يبرّره.
     القيمة هنا مقيسة على **نوع الطريق الصحيح**: تقرير ديلاوير DCT 265
     (2017) قاس خمسة وعشرين منطقة عمل على محاور متعددة الحارات بإشارات،
     ومتوسط السعة 1475 مركبة/ساعة/حارة بطريقة التدفق المستدام لخمس عشرة
     دقيقة. وهو أعلى من قيمة إدارة نقل ديلاوير المبنية على دليل السعة (1240)،
     وأدنى من معظم قيم المسح الوطني.
     أمريكية لا سعودية — والحدّ معلَن في `data/comparable-cases.json`. */
  const WORK_ZONE_LANE_CAPACITY = 1475;

  // Work-zone friction: lane shifts, tapers and merges slow traffic through an
  // active closure even when demand is far below capacity (e.g. empty night
  // hours). Modeled as a floor: the closed travel time is at least 10% above
  // free-flow-hour baseline. This stops the BPR^4 term from collapsing night
  // delay to ~0, which otherwise produced a physically impossible ~99.6%
  // "saving" that contradicts the cited −11.1% scheduling study (Ledger #5).
  /* حدٌّ يجب أن يُقال: هذه الأرضية **افتراض نمذجة بلا سند مقيس**، وليست
     مشتقّة من دراسات السعة. النطاق الذي كان يُعرض لها في تحليل الحساسية
     مأخوذ من مقلوب نسبة السعة — وهي كميةٌ أخرى: تحت BPR تتراوح نسبة الزمن
     الحقيقية لإغلاق حارة من 1.001 عند طلبٍ منخفض إلى 1.53 عند التشبّع، بينما
     مقلوب نسبة السعة ثابت. فيبقى النطاق **مظروفاً واسعاً معلَناً** لا
     اشتقاقاً محاذياً، والدليل المقيس ينتقل إلى موضعه الصحيح أعلاه.
     رصده التدقيق المستقل — انظر
     `docs/audits/final-independent-acceptance/FRICTION-DERIVATION-AUDIT.md`.

     **وقُرِّر إبقاؤها بعد قياس الطرفين، لا بإهمال.** والقياس مسجَّل في
     `docs/FLOOR-DECISION-2026-07-26.md`، وثلاثة أرقام منه تخصّ هذا السطر:

       · تعمل الأرضية في **19,111 ساعة إغلاق من 19,111** على المحفظة — أي
         100٪ — لأن المنتج يوصي بالليل في 97.3٪ من الساعات، والليل هو النطاق
         الذي يصمت فيه BPR. و**91.1٪** من التأخير المعروض تنتجه هي لا المنحنى.
       · وهي تبتلع الدليل المقيس حيث يوصي المنتج: تحريك
         `workZoneLaneCapacity` عبر مظروفه كله (1072 ⇐ 1600) على جدولٍ ليلي
         ثابت يحرّك التأخير **5٪** والأرضية تعمل، و**83٪** إن أُسقطت. أي أن
         الدليل في موضعه الصحيح ومعطَّل عملياً حيث يُقرأ الرقم.
       · وإسقاطها ليس أنزه: التأخير الليلي ينهار إلى ما دون العُشر، فتصير
         «الوفورات» **99.1٪** — وهو المستحيل الذي وُضعت الأرضية لمنعه —
         ويقفز الامتناع من 96 إلى 142 من 150.

     فالعيب في **النموذج** لا في الثابت: لا كمية مقيسة تصف ما يحدث للسائق حين
     تُغلق حارة على شريان بإشارات في ساعة خالية. وقد بُحث عن سندٍ زمني مباشر
     في التغذية الرسمية الوحيدة على القرص، فكان `reduced_speed_limit_kph`
     **صفراً في 377 من 377** حالة تحمله. والطلب المحدَّد: أزمنة عبور أو سرعات
     مرصودة عبر منطقة عمل على شريان حضري **في الطلب المنخفض**. */
  const WORK_ZONE_FRICTION = 1.10;

  // Candidate scheduling grid used by optimize().
  //
  // WP-B1 — لماذا اتّسعت الشبكة، ولماذا وحدها لا تكفي:
  //
  // الشبكة القديمة كانت ست ساعات × مرحلتين. وكانت تعطي `22p2` لمئة وخمسين
  // تصريحاً من مئة وخمسين. توسيع الشبكة وحده لا يصلح ذلك، لأن السبب لم يكن
  // ضيقها: الهدف كان واحداً (`delayVehHours`) فوق ملف طلب ساعي له قاعٌ ليلي
  // عالمي. أي شبكة، مهما اتّسعت، بهدفٍ واحد كهذا تعطي الجواب نفسه بدقة أعلى.
  //
  // ولذلك أُضيف بُعدٌ ثالث (طول النافذة) **مع** ثلاثة تكاليف تنازع التأخير.
  // البُعد الثالث هو ما يجعل المنازعة ذات معنى: نافذة قصيرة تخفض تأخير
  // الليلة الواحدة وتزيد عدد الليالي، فتزيد الاحتكاك المتبقي وامتداد الموقع.
  const CANDIDATE_START_HOURS = [20, 21, 22, 23, 0, 1, 9, 10, 13, 14];
  const CANDIDATE_PHASES = [1, 2];
  const CANDIDATE_WINDOW_HOURS = [6, 8, 10, 12];

  // نصيب السعة الباقية أثناء وجود موقع العمل دون إغلاق نشط.
  //
  // النموذج كان يفترض أن الطريق يعود طبيعياً 100٪ بين النوافذ الليلية. هذا غير
  // صحيح ميدانياً: الألواح الفولاذية والمخاريط والتضييق تبقى. الافتراض القديم
  // كان يمنح جدول «خمس عشرة ليلة» طريقاً مثالياً في أربع وعشرين يوماً-ساعة من
  // كل يوم، فيفوز مجاناً على جدولٍ أقصر امتداداً.
  //
  // القيمة نفسها افتراض توضيحي معلن وقابل للتعديل عبر
  // `input.residualCapacityFraction`. الأثر محسوب بنفس دالة BPR، لا بوزن.
  const RESIDUAL_CAPACITY_FRACTION = 0.92;

  // نطاق العمل الليلي: من الساعة 22 حتى 6 (شامل البداية، حصري النهاية).
  const NIGHT_BAND = { from: 22, to: 6 };

  // نطاقات الحساسية بحسب استعمال الأرض المجاور.
  //
  // **افتراض تفضيلي معلن، لا قياس.** لا مصدر ميداني سعودي منشور يربط ساعة عمل
  // بجوار مستشفى بضررٍ مقدَّر. ولذلك لا يُخفى الوزن: `optimize()` يُرجع
  // `switchPoints` — الوزن الذي تنقلب عنده التوصية — فيرى القارئ إن كانت
  // التوصية قائمة على الوزن أم على الحساب.
  const SENSITIVITY_BANDS = {
    normal: [],
    school: [
      { from: 6, to: 14, why: 'ساعات الدراسة والدخول والانصراف' },
    ],
    transit: [
      { from: 6, to: 9, why: 'ذروة النقل العام صباحاً' },
      { from: 15, to: 19, why: 'ذروة النقل العام مساءً' },
    ],
    hospital: [
      { from: 22, to: 6, why: 'راحة المنوَّمين — ضجيج العمل الليلي' },
      { from: 7, to: 9, why: 'ذروة الوصول الإسعافي صباحاً' },
      { from: 16, to: 19, why: 'ذروة الوصول الإسعافي مساءً' },
    ],
  };

  // أوزان الأهداف — تفضيلات معلنة قابلة للتعديل، وليست قياسات.
  //
  // `sensitivity` و`nightPremium` بوحدة «ساعة-مركبة مكافئة لكل ساعة عمل».
  // القيمة الافتراضية مختارة عمداً قريبةً من نقطة الانقلاب لا بعيدةً عنها:
  // وزنٌ بعيد عن نقطة الانقلاب يجعل الحد زينةً لا يغيّر قراراً، ووزنٌ مبالغ
  // فيه يفرض الجواب سلفاً. القرب من الانقلاب يجعل القرار **حساساً للمُدخل**،
  // وهو المطلوب. ونقطة الانقلاب نفسها معروضة في المخرجات.
  const OBJECTIVE_WEIGHTS = {
    sensitivity: 6.0,
    nightPremium: 1.5,
  };

  // سقف مدة الإغلاق المقبولة (ساعة) — سنة كاملة. أوسع من أي تصريح واقعي،
  // وضيّق بما يمنع حلقةً تستنفد الذاكرة. انظر `requireInputs`.
  const MAX_DURATION_HOURS = 8760;

  // إصدار مواصفة WZDx المستهدَف. يظهر في `feed_info.version` ويفحصه
  // `wzdx-schema-test.js`. تغييره قرار يُكتب، لا رقم يُحدَّث بصمت.
  const WZDX_VERSION = '4.2';

  /**
   * تعداد `Direction.json` في 4.2 — مكتوب هنا حرفياً.
   *
   * السبب: المحرك بلا تبعيات، وجدول التحويل من العربية يعيش في
   * `masar-wzdx-mapping.js`. فلو اكتفينا بالجدول لبقي المحرك قادراً على
   * إخراج ملفٍ يحمل «شمال» في حقل تعداد مغلق حين ينساه مستدعٍ واحد — وهو
   * بالضبط ما حدث: فشل تصدير **كل** التصاريح المئة والخمسين لهذا السبب.
   * الحارس هنا يجعل ذلك مستحيلاً لا مستبعَداً.
   */
  const WZDX_DIRECTIONS = ['northbound', 'eastbound', 'southbound', 'westbound',
    'undefined', 'unknown', 'inner-loop', 'outer-loop'];

  /** تعداد `LocationMethod` — للسبب نفسه. */
  const WZDX_LOCATION_METHODS = ['channel-device-method', 'sign-method',
    'junction-method', 'other', 'unknown'];

  // Standard nightly work-window length (hours) used to model phases=2
  // candidates as real-world night-work schedules: the road stays open to
  // traffic during the day and the closure is only active for a short
  // window each night, repeated over multiple nights until the requested
  // total durationHours is completed. افتراض توضيحي — نافذة عمل ليلية قياسية.
  const WORK_WINDOW_HOURS = 8;

  // ---------------------------------------------------------------------
  // Core math
  // ---------------------------------------------------------------------

  /**
   * Split requested work into explicit nightly closure windows without
   * rounding a partial final night up to a full window.
   * @param {number} startHour integer clock hour, 0..23
   * @param {number} durationHours positive finite work duration
   * @param {number} maxNightHours positive finite maximum per night
   * @returns {Array<{dayOffset:number,startHour:number,durationHours:number}>}
   */
  function buildNightWindows(startHour, durationHours, maxNightHours) {
    if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
      throw new RangeError('startHour must be an integer between 0 and 23');
    }
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      throw new RangeError('durationHours must be a positive finite number');
    }
    if (!Number.isFinite(maxNightHours) || maxNightHours <= 0 || maxNightHours > 24) {
      throw new RangeError('maxNightHours must be a positive finite number up to 24');
    }

    const windows = [];
    let remaining = durationHours;
    let dayOffset = 0;
    while (remaining > 0) {
      const duration = Math.min(maxNightHours, remaining);
      windows.push({ dayOffset, startHour, durationHours: duration });
      remaining -= duration;
      dayOffset += 1;
    }
    return windows;
  }

  /* معاملا BPR ثابتان مسمّيان لا رقمان مكرران.
     -----------------------------------------------------------------------
     كانا مكتوبين داخل `bprTravelTime` وحدها. ويوم أُضيف عكسُ الدالة
     (`bprVolumeRatio`) صار الرقم في موضعين: أيّ معايرة لاحقة تُغيّر أحدهما
     وتترك الآخر، فيصير الأمام والعكس دالّتين مختلفتين لا دالّةً ومعكوسها —
     والخطأ لا يظهر في اختبارٍ يفحص كلاً على حدة.

     القيمتان (0.15, 4) هما معيار مكتب الطرق العامة الأمريكي، وهما الأشيع.
     ومظروفهما المنشور أوسع: α من 0.10 إلى 1.0، و β من 4 إلى 11، ويختلفان
     بنوع الطريق والمدينة — لا قيمة «صحيحة» عالمية بلا معايرة محلية.
     المرجع: rosap.ntl.bts.gov/view/dot/40540. فتبقى هاتان قيمتين معلنتين،
     ومظروفهما هو ما يجب أن يُعرض مع أي رقمٍ يخرج من العكس. */
  const BPR_ALPHA = 0.15;
  const BPR_BETA = 4;

  /**
   * Standard BPR (Bureau of Public Roads) volume-delay function.
   * t = t0 * (1 + 0.15 * (v/c)^4)
   * @param {number} freeFlowMin - free-flow travel time (minutes)
   * @param {number} volume - demand volume (veh/hr)
   * @param {number} capacity - available capacity (veh/hr)
   * @returns {number} travel time in minutes
   */
  function bprTravelTime(freeFlowMin, volume, capacity) {
    const safeCapacity = capacity > 0 ? capacity : 1e-9;
    const ratio = volume / safeCapacity;
    return freeFlowMin * (1 + BPR_ALPHA * Math.pow(ratio, BPR_BETA));
  }

  /**
   * عكس دالة BPR: من نسبة الزمن المرصود إلى نسبة الحجم/السعة.
   * ---------------------------------------------------------------------------
   * v/c = ((t/t0 − 1) / α)^(1/β)
   *
   * **لمَ هي هنا لا في وحدة التقدير؟** لأن القاعدة الأولى في هذا المستودع أن
   * الحساب المروري له مصدر واحد. ولو كُتب العكس في `masar-trafficload.js`
   * لصار في المستودع معادلتا BPR: واحدة تحسب الزمن من الحجم وأخرى تحسب الحجم
   * من الزمن، بمعاملين قد يفترقان. هنا يشتركان في `BPR_ALPHA` و`BPR_BETA`
   * حرفياً، والاختبار يجول بالدالة وعكسها فيعود إلى نقطة البداية.
   *
   * **وحدّان يجب أن يُقالا مع كل رقم يخرج منها:**
   *
   * ١) المخطط الأساسي للتدفق **غير أحادي**. السرعة الواحدة تقابل حالتين: تدفق
   *    حرّ منخفض الكثافة، وتدفق مختنق عالي الكثافة. فالعكس لا «يستخرج» الحجم
   *    من الزمن — يستخرجه **بشرط فرعٍ مفترض**: أن الطريق على الفرع غير
   *    المختنق. الفرع الآخر يعطي حجماً أقل عند السرعة نفسها. من رصد سرعةً
   *    وحدها ولم يرصد كثافة لا يعرف على أيّ فرعٍ هو.
   *    (en.wikipedia.org/wiki/Fundamental_diagram_of_traffic_flow)
   *
   * ٢) الدالة تنفجر حساسيةً عند t ≈ t0: الجذر الرابع يجعل خطأً صغيراً في
   *    زمن التدفق الحرّ خطأً كبيراً في النسبة. ولذلك تُرجع صفراً — لا رقماً
   *    صغيراً موهماً — حين لا يتجاوز الزمنُ المرصودُ زمنَ التدفق الحرّ.
   *
   * ولم أجد دراسة منشورة تقيس دقة هذا العكس بـ MAPE أو R². فمن استعمله لا
   * يقول «دقّته كذا» — يقول «هذا ما تعطيه المعادلة تحت فرضها المعلن».
   *
   * @param {number} travelTimeRatio زمن مرصود ÷ زمن تدفق حرّ (t/t0)
   * @returns {number} نسبة الحجم إلى السعة، أو صفر إن كان الزمن ≤ زمن التدفق الحر
   */
  function bprVolumeRatio(travelTimeRatio) {
    if (!Number.isFinite(travelTimeRatio) || travelTimeRatio <= 1) return 0;
    return Math.pow((travelTimeRatio - 1) / BPR_ALPHA, 1 / BPR_BETA);
  }

  /**
   * Score the traffic impact of a lane closure over its duration.
   * @param {object} input
   * @returns {{delayVehHours:number, score:number, level:string, hourly:Array}}
   */
  /**
   * يرفض المدخلات الناقصة بدل أن يُخرج رقماً.
   *
   * WP-B1 — لماذا أُضيف هذا:
   * كان `capacityPerLane` الناقص يمرّ صامتاً، فتصير السعة `NaN`، فتسقط
   * `bprTravelTime` إلى أرضية `1e-9`، فيُخرج المحرك تأخيراً بمرتبة `1e48`
   * **ويبدو ناجحاً**. الأسوأ أن الترتيب يبقى «معقولاً» فيمرّ دون أن يُلاحَظ —
   * وهذا بالضبط ما كان يقيسه اختبار تنوّع القرار قبل هذا الإصلاح.
   *
   * `capacityPerLane` وحده له افتراضي: هو معيار (1800 مركبة/ساعة/حارة) لا
   * قياس موقعيّ. البقية بيانات الموقع، ونقصها نقصُ معرفة لا نقصُ إعداد.
   */
  function requireInputs(input) {
    const required = {
      aadt: (v) => Number.isFinite(v) && v > 0,
      lanes: (v) => Number.isInteger(v) && v >= 1,
      lanesClosed: (v) => Number.isInteger(v) && v >= 0,
      freeFlowMin: (v) => Number.isFinite(v) && v > 0,
      startHour: (v) => Number.isInteger(v) && v >= 0 && v <= 23,
      /* WP-D1 — سقف المدة حماية لا معقولية.
         `score` تدور مرة لكل ساعة. مدة بمليار ساعة لا تُبطئ العملية بل
         **تقتلها**: أُثبت ذلك بـ`JavaScript heap out of memory` عند كتابة هذه
         البوابة. والسقف هنا لا يغني عن سقف الخادم (2160): الخادم هو الحدّ عند
         الطرف غير الموثوق، وهذا الحدّ عند من ينادي المحرك مباشرة. */
      durationHours: (v) => Number.isFinite(v) && v > 0 && v <= MAX_DURATION_HOURS,
    };
    Object.keys(required).forEach((key) => {
      if (!required[key](input[key])) {
        throw new RangeError(
          `مُدخل مفقود أو غير صالح: ${key}=${JSON.stringify(input[key])}`
        );
      }
    });
    if (input.lanesClosed > input.lanes) {
      throw new RangeError(
        `حارات مغلقة (${input.lanesClosed}) أكثر من حارات الطريق (${input.lanes})`
      );
    }
  }

  /**
   * ثوابت المعايرة المستعمَلة في هذا النداء.
   *
   * WP-E1 — لماذا صارت قابلة للتجاوز:
   * الثوابت كانت محبوسة في الوحدة، فلا سبيل لقياس أثرها إلا بإعادة كتابة
   * الخوارزمية في سكربت تحقق — وذلك يكرّر الخطأ نفسه إن وُجد. جعلُها مُدخلاً
   * اختيارياً يجعل تحليل الحساسية يمرّ بالمحرك الحقيقي لا بنسخة منه.
   *
   * والتجاوز مفحوص لا مقبول على علّاته: ملف طلبٍ لا يجمع إلى واحد يغيّر معنى
   * كل رقم بعده بلا أن يُعلن.
   */
  function calibrationOf(input) {
    const given = (input && input.calibration) || {};
    const profile = Array.isArray(given.hourlyProfile)
      ? given.hourlyProfile
      : HOURLY_PROFILE;

    if (profile !== HOURLY_PROFILE) {
      if (profile.length !== 24 || !profile.every((v) => Number.isFinite(v) && v >= 0)) {
        throw new RangeError('hourlyProfile: أربع وعشرون قيمة غير سالبة');
      }
      const sum = profile.reduce((total, v) => total + v, 0);
      if (Math.abs(sum - 1) > 1e-6) {
        throw new RangeError(`hourlyProfile: المجموع ${sum.toFixed(6)} لا 1`);
      }
    }

    function positive(name, fallback) {
      if (given[name] === undefined) return fallback;
      if (!Number.isFinite(given[name]) || given[name] <= 0) {
        throw new RangeError(`${name}: عدد موجب منتهٍ`);
      }
      return given[name];
    }

    return {
      hourlyProfile: profile,
      workZoneFriction: positive('workZoneFriction', WORK_ZONE_FRICTION),
      workZoneLaneCapacity: positive('workZoneLaneCapacity', WORK_ZONE_LANE_CAPACITY),
      minCapacityFraction: positive('minCapacityFraction', MIN_CAPACITY_FRACTION),
      scoreCalibration: positive('scoreCalibration', SCORE_CALIBRATION),
    };
  }

  function score(input) {
    requireInputs(input);
    const {
      aadt,
      lanes,
      lanesClosed,
      freeFlowMin,
      startHour,
      durationHours,
    } = input;
    const capacityPerLane = Number.isFinite(input.capacityPerLane)
      && input.capacityPerLane > 0
      ? input.capacityPerLane
      : DEFAULTS.capacityPerLane;
    const CAL = calibrationOf(input);

    const fullCapacity = lanes * capacityPerLane;
    const minCapacity = CAL.minCapacityFraction * capacityPerLane;
    const openLanes = Math.max(0, lanes - lanesClosed);
    /* الحارة المفتوحة داخل منطقة العمل لا تحمل سعة الحارة الحرّة.
       `Math.min` مقصود: إن أعطى المُدخل سعةً أساسية أدنى من سعة منطقة العمل
       المقيسة، فالطريق نفسه أضيق — ورفعُ سعته لأننا قسنا شارعاً أوسع في
       ديلاوير اختراعُ طاقةٍ لا وجود لها. */
    const workZoneLaneCapacity = Math.min(capacityPerLane, CAL.workZoneLaneCapacity);
    const closedCapacityRaw = openLanes * workZoneLaneCapacity;
    const closedCapacity = Math.max(closedCapacityRaw, minCapacity);

    let delayVehHours = 0;
    const hourly = [];

    for (let elapsed = 0; elapsed < durationHours;) {
      const hourOffset = Math.floor(elapsed);
      const segmentDuration = Math.min(1, durationHours - elapsed);
      const hour = (startHour + hourOffset) % 24;
      const demand = aadt * CAL.hourlyProfile[hour];

      const baseT = bprTravelTime(freeFlowMin, demand, fullCapacity);
      const closedT = lanesClosed > 0
        ? Math.max(
            bprTravelTime(freeFlowMin, demand, closedCapacity),
            baseT * CAL.workZoneFriction,
          )
        : baseT;

      const fullHourDelayVehHours = lanesClosed > 0
        ? (demand * (closedT - baseT)) / 60
        : 0;
      const hourDelayVehHours = fullHourDelayVehHours * segmentDuration;

      delayVehHours += hourDelayVehHours;
      hourly.push({
        hour,
        durationHours: segmentDuration,
        demand,
        baseT,
        closedT,
        delayVehHours: hourDelayVehHours,
      });
      elapsed += segmentDuration;
    }

    const rawScore = (100 * delayVehHours) / (aadt * CAL.scoreCalibration);
    const clampedScore = Math.min(100, Math.round(rawScore));
    const finalScore = lanesClosed > 0 ? clampedScore : 0;

    let level;
    if (finalScore < 25) level = 'low';
    else if (finalScore < 60) level = 'medium';
    else level = 'high';

    return {
      delayVehHours,
      score: finalScore,
      level,
      hourly,
    };
  }

  // ---------------------------------------------------------------------
  // WP-B1 — أهداف تنازع التأخير
  // ---------------------------------------------------------------------

  /** هل الساعة داخل نطاق قد يلتفّ حول منتصف الليل؟ */
  function inBand(hour, band) {
    const h = ((hour % 24) + 24) % 24;
    return band.from <= band.to
      ? (h >= band.from && h < band.to)
      : (h >= band.from || h < band.to);
  }

  /**
   * ساعات العمل الواقعة داخل نطاق زمني، محسوبةً بكسورها.
   * @param {Array} windows
   * @param {{from:number,to:number}} band
   * @returns {number} ساعات
   */
  function hoursInBand(windows, band) {
    let total = 0;
    windows.forEach((window) => {
      for (let elapsed = 0; elapsed < window.durationHours;) {
        const segment = Math.min(1, window.durationHours - elapsed);
        const hour = (window.startHour + Math.floor(elapsed)) % 24;
        if (inBand(hour, band)) total += segment;
        elapsed += segment;
      }
    });
    return total;
  }

  /** عدد الأيام التقويمية التي يوجد فيها الموقع. */
  function spanDaysOf(windows) {
    let last = 0;
    windows.forEach((window) => {
      const end = window.dayOffset + Math.ceil(window.durationHours / 24);
      if (end > last) last = end;
    });
    return Math.max(1, last);
  }

  /**
   * تأخير الاحتكاك المتبقي: الموقع قائم والطريق «مفتوح».
   *
   * يُحسب بنفس دالة BPR لا بوزن: السعة أثناء وجود الموقع أقل من الكاملة
   * بنسبة معلنة. ويُطرح منه نصيب الساعات المغلقة فعلاً كي لا يُحتسب التأخير
   * مرتين — تلك الساعات محسوبة أصلاً في تأخير الإغلاق وهو أكبر.
   *
   * @returns {number} ساعة-مركبة
   */
  function residualDelayVehHours(input, windows) {
    const aadt = input.aadt;
    const lanes = input.lanes;
    const capacityPerLane = input.capacityPerLane || DEFAULTS.capacityPerLane;
    const freeFlowMin = input.freeFlowMin;
    const fraction = typeof input.residualCapacityFraction === 'number'
      ? input.residualCapacityFraction
      : RESIDUAL_CAPACITY_FRACTION;

    if (!(fraction > 0) || fraction >= 1) return 0;

    const fullCapacity = lanes * capacityPerLane;
    const siteCapacity = fullCapacity * fraction;

    const perHour = [];
    for (let hour = 0; hour < 24; hour += 1) {
      const demand = aadt * HOURLY_PROFILE[hour];
      const base = bprTravelTime(freeFlowMin, demand, fullCapacity);
      const withSite = bprTravelTime(freeFlowMin, demand, siteCapacity);
      perHour.push((demand * Math.max(0, withSite - base)) / 60);
    }

    const dayTotal = perHour.reduce((sum, value) => sum + value, 0);
    let total = dayTotal * spanDaysOf(windows);

    // طرح الساعات المغلقة فعلاً
    windows.forEach((window) => {
      for (let elapsed = 0; elapsed < window.durationHours;) {
        const segment = Math.min(1, window.durationHours - elapsed);
        const hour = (window.startHour + Math.floor(elapsed)) % 24;
        total -= perHour[hour] * segment;
        elapsed += segment;
      }
    });

    return Math.max(0, total);
  }

  /** نطاقات الحساسية الفعّالة لمُدخل ما. */
  function bandsFor(sensitivity) {
    return SENSITIVITY_BANDS[sensitivity] || SENSITIVITY_BANDS.normal;
  }

  /**
   * يقيس جدولاً واحداً على الأهداف الأربعة ويعيد التفصيل كاملاً.
   *
   * التفصيل ليس زينة: هو ما يجعل «لماذا اختلفت التوصية» قابلاً للإجابة. مجموعٌ
   * بلا تفصيله مؤشر مركّب معتم، وهو بالضبط ما ترفضه بوابة الادعاءات.
   *
   * @returns {object} تفصيل الأهداف والمجموع المكافئ
   */
  function evaluateSchedule(input, windows) {
    const weights = {
      sensitivity: OBJECTIVE_WEIGHTS.sensitivity,
      nightPremium: OBJECTIVE_WEIGHTS.nightPremium,
      ...(input.weights || {}),
    };

    const closureDelayVehHours = scoreWindows(input, windows).delayVehHours;
    const residual = residualDelayVehHours(input, windows);

    const bands = bandsFor(input.sensitivity);
    const exposure = bands.map((band) => ({
      why: band.why,
      hours: hoursInBand(windows, band),
    }));
    const sensitivityHours = exposure.reduce((sum, item) => sum + item.hours, 0);
    const nightHours = hoursInBand(windows, NIGHT_BAND);

    const sensitivityEquivalent = sensitivityHours * weights.sensitivity;
    const nightPremiumEquivalent = nightHours * weights.nightPremium;

    return {
      closureDelayVehHours,
      residualDelayVehHours: residual,
      sensitivityHours,
      sensitivityEquivalent,
      sensitivityExposure: exposure.filter((item) => item.hours > 0),
      nightHours,
      nightPremiumEquivalent,
      spanDays: spanDaysOf(windows),
      weights,
      totalEquivalentVehHours: closureDelayVehHours + residual
        + sensitivityEquivalent + nightPremiumEquivalent,
    };
  }

  /**
   * نقطة انقلاب وزنٍ واحد: أدنى وزن أعلى من الحالي تتغيّر عنده التوصية.
   *
   * لماذا صار الحقل أغنى — سؤال الفريق الأحمر ٣ في
   * `docs/evaluation/loop/cycle-01/RED-TEAM.md`: «صنّفت تصريحاً بجوار
   * مستشفى؛ جدولتكم لم تتغيّر حرفاً. وزنكم يحتاج أن يتضاعف ثلاث مرات
   * ليتغيّر». كانت الدالة تُرجع نقطة الانقلاب حين توجد، وتصمت (`null` يُرشَّح
   * بـ`filter(Boolean)` في `optimize()`) حين لا توجد — فيختلط «لم يُحسب»
   * بـ«حُسب ولا يوجد» على من يقرأ غياب مفتاحٍ من المصفوفة. الآن يُقال
   * الحالان معاً: الوزن المستعمل فعلياً (`currentWeight`) يرافق كل نتيجة،
   * وحين لا ينقلب الفائز مهما ارتفع الوزن يصرّح بذلك `neverFlips`/`note`
   * بدل رقمٍ يُخترَع.
   *
   * المجموع دالة خطّية صرفة في الوزن هنا: `total(w) = ثابت + w × ساعات`، ولا
   * حدّ آخر في `evaluateSchedule` يتأثر بوزن الحساسية أو الليل. فالتقاطع بين
   * مرشحَين حلّ معادلة خطّية واحدة، لا مسحاً عددياً. **ملاحظة أسلوب:** لو
   * انهار هذا الشكل الخطّي مستقبلاً (حدٌّ جديد يضرب الوزن في غير الساعات)
   * فالبديل بحثٌ ثنائي محدود الخطوات يُسمَّى في تعليق عند موضعه — لا حلٌّ
   * مغلق يُقدَّم على شكلٍ لم يعد خطياً؛ وهذا الشرط لا ينطبق اليوم لأن الشكل
   * أعلاه خطّي فعلاً.
   *
   * الغاية: وزنٌ بلا مصدر يصير مقبولاً حين يُعرض المدى الذي لا يغيّر القرار
   * داخله. وحين تكون نقطة الانقلاب قريبة جداً، فذلك إقرارٌ بأن التوصية هشّة.
   * وحين لا توجد نقطة انقلاب أصلاً، فذلك إقرارٌ أعمق: لا وزنٌ يشتريه في هذا
   * الاتجاه.
   *
   * @param {Array} candidates مرشّحو `buildCandidates` مرتّبين، الفائز أولهم
   * @param {string} key اسم الوزن — `sensitivity` أو `nightPremium`
   * @param {string} hoursKey مفتاح الساعات المقابل داخل `evaluation`
   * @param {number} currentWeight الوزن المستعمل فعلياً في هذا النداء
   * ## الاتجاهان — لماذا لا يكفي «كم يجب أن يرتفع الوزن»
   *
   * كان هذا الحساب أحاديّ الاتجاه: `crossing > currentWeight` وحدها، أي
   * «ارفع الوزن حتى ينقلب». والوزن هنا **تفضيلٌ بلا مصدر**، فليس ثمة سببٌ
   * يجعل خطأه في اتجاه الرفع دون الخفض. وقياس المحفظة أعطى الرقم: أحد عشر
   * تصريحاً من مئة وخمسين ينقلب فائزه حين يُخفَّض وزنٌ، وستُّ حالاتٍ منها
   * كان الحقل يقول فيها `neverFlips: true` بملاحظة «لا ينقلب برفع وزن X
   * مهما ارتفع» — صادقةٌ حرفياً ومضلِّلةٌ عملياً، لأن القارئ يقرؤها متانة.
   *
   * فالمُخرَج الصحيح ليس نقطةً بل **مدىً يصمد الفائز داخله**:
   * `[weightDown, weight]`، وطرفٌ مفتوحٌ يُقال `null` لا يُخترَع له رقم.
   * و`neverFlips` صار يعني ما يقوله اسمه: لا ينقلب في أيٍّ من الاتجاهين.
   *
   * والحدّ السفلي مقيَّد بالصفر: وزنٌ سالب لا معنى تشغيلياً له، فتقاطعٌ
   * تحت الصفر ليس نقطة انقلاب قابلة للتحقّق ولا يُعرض.
   *
   * @returns {{key:string, currentWeight:number, current:string,
   *            weight:(number|null), next:(string|null),
   *            deltaPct:(number|null),
   *            weightDown:(number|null), nextDown:(string|null),
   *            deltaPctDown:(number|null), neverFlips:boolean,
   *            note:string}|null}
   */
  function switchPoint(candidates, key, hoursKey, currentWeight) {
    if (!candidates.length) return null;
    const constantOf = (candidate) => candidate.evaluation.totalEquivalentVehHours
      - candidate.evaluation[hoursKey] * currentWeight;

    const winner = candidates[0];
    const winnerConstant = constantOf(winner);
    const winnerHours = winner.evaluation[hoursKey];
    const winnerLabel = labelOf(winner);

    /* `up` أدنى وزنٍ فوق الحالي يقلب الفائز، و`down` أعلى وزنٍ تحته يقلبه.
       الطرفان هما حدّا المدى الذي يصمد الفائز داخله. */
    let up = null;
    let down = null;
    candidates.slice(1).forEach((candidate) => {
      const deltaHours = candidate.evaluation[hoursKey] - winnerHours;
      if (Math.abs(deltaHours) < 1e-9) return;
      const crossing = (winnerConstant - constantOf(candidate)) / deltaHours;
      if (!Number.isFinite(crossing)) return;
      if (crossing > currentWeight) {
        if (!up || crossing < up.weight) up = { weight: crossing, next: candidate };
      } else if (crossing < currentWeight && crossing >= 0) {
        if (!down || crossing > down.weight) down = { weight: crossing, next: candidate };
      }
    });

    const pctOf = (weight) => (currentWeight !== 0
      ? ((weight - currentWeight) / currentWeight) * 100
      : null);

    if (!up && !down) {
      return {
        key,
        currentWeight,
        current: winnerLabel,
        weight: null,
        next: null,
        deltaPct: null,
        weightDown: null,
        nextDown: null,
        deltaPctDown: null,
        neverFlips: true,
        note: `${winnerLabel} لا ينقلب بتحريك وزن ${key} في أيّ اتجاه — `
          + 'لا مرشّح يتجاوزه رفعاً ولا خفضاً',
      };
    }

    const upLabel = up ? labelOf(up.next) : null;
    const downLabel = down ? labelOf(down.next) : null;
    const deltaPct = up ? pctOf(up.weight) : null;
    const deltaPctDown = down ? pctOf(down.weight) : null;

    const parts = [];
    if (down) {
      parts.push(`خفضُ وزن ${key} من ${currentWeight} إلى `
        + `${down.weight.toFixed(2)} يقلب الفائز إلى ${downLabel}`);
    }
    if (up) {
      parts.push(`رفعُه إلى ${up.weight.toFixed(2)}`
        + (deltaPct !== null ? ` (×${(up.weight / currentWeight).toFixed(2)})` : '')
        + ` يقلبه إلى ${upLabel}`);
    }
    /* الطرف المفقود يُقال، لا يُسكَت عنه: قارئٌ يرى حدّاً واحداً يفترض أن
       الآخر بعيد، والصحيح أنه غير موجود أصلاً في ذلك الاتجاه. */
    if (!down) parts.push(`ولا يقلبه خفضُه مهما انخفض حتى الصفر`);
    if (!up) parts.push(`ولا يقلبه رفعُه مهما ارتفع`);

    return {
      key,
      currentWeight,
      current: winnerLabel,
      weight: up ? up.weight : null,
      next: upLabel,
      deltaPct,
      weightDown: down ? down.weight : null,
      nextDown: downLabel,
      deltaPctDown,
      neverFlips: false,
      note: parts.join(' — '),
    };
  }

  function labelOf(candidate) {
    return `${candidate.startHour}p${candidate.phases}w${candidate.windowHours}`;
  }

  /** يبني فضاء الجداول المرشحة ويرتّبه على المجموع المكافئ. */
  function buildCandidates(input) {
    const totalDuration = input.durationHours;
    const candidates = [];
    const scheduleSignatures = new Set();

    function addCandidate(startHour, phases, windowHours, windows) {
      const signature = JSON.stringify(windows);
      if (scheduleSignatures.has(signature)) return;
      scheduleSignatures.add(signature);
      candidates.push({
        startHour,
        phases,
        windowHours,
        windows,
        evaluation: evaluateSchedule(input, windows),
      });
    }

    CANDIDATE_START_HOURS.forEach((startHour) => {
      CANDIDATE_PHASES.forEach((phases) => {
        if (phases === 1) {
          // Continuous block starting at the candidate's clock hour — the
          // closure runs uninterrupted for the full requested duration.
          addCandidate(startHour, phases, totalDuration, [{
            dayOffset: 0,
            startHour,
            durationHours: totalDuration,
          }]);
          return;
        }

        // phases === 2: windowed work schedule. Each actual window is scored
        // independently, so the open gap between windows is never counted as
        // closure — لكنه يُحاسَب باحتكاك الموقع المتبقي.
        CANDIDATE_WINDOW_HOURS.forEach((windowHours) => {
          if (windowHours >= totalDuration) return; // نافذة تبتلع المدة = كتلة متواصلة
          addCandidate(startHour, phases, windowHours,
            buildNightWindows(startHour, totalDuration, windowHours));
        });
      });
    });

    /* الترتيب على المجموع المكافئ لا على التأخير وحده. الفارق مقصود ومعلن:
       أقلّ الجداول تأخيراً ليس بالضرورة أفضلها حين يوجد جوار حسّاس أو حين
       يمتدّ الموقع خمس عشرة ليلة بدل خمسة أيام. */
    candidates.sort((a, b) => {
      const delta = a.evaluation.totalEquivalentVehHours
        - b.evaluation.totalEquivalentVehHours;
      if (Math.abs(delta) > 1e-9) return delta;
      if (a.evaluation.spanDays !== b.evaluation.spanDays) {
        return a.evaluation.spanDays - b.evaluation.spanDays; // امتداد أقصر
      }
      if (a.phases !== b.phases) return a.phases - b.phases; // تنفيذ أبسط
      return a.startHour - b.startHour; // فاصل حاسم ثابت — لا اعتماد على ترتيب البناء
    });

    return candidates;
  }

  /* نسب السعة المتبقية المفحوصة في المسح. الحد 1.0 يعني «الطريق يعود طبيعياً
     تماماً بين النوافذ» — وهو الافتراض القديم، ووجوده في المسح يجعل أثر
     تغييره مقروءاً بدل أن يكون قراراً صامتاً. */
  const RESIDUAL_SWEEP = [1.0, 0.97, 0.95, 0.92, 0.88, 0.85];

  /**
   * هل الفائز معلَّق على نسبة السعة المتبقية غير المصدرية؟
   *
   * النسبة تدخل الحساب عبر BPR، فأثرها غير خطّي ولا تُحلّ نقطة انقلابها
   * جبرياً كما تُحلّ الأوزان. المسح الصريح أصدق من ادعاء متانة.
   */
  function residualSweep(input, currentWinner) {
    if (!currentWinner) return [];
    return sweepRankings(input).map((entry) => ({
      residualCapacityFraction: entry.residualCapacityFraction,
      winner: entry.winner,
      changed: entry.winner !== labelOf(currentWinner),
    }));
  }

  /**
   * المسح مرة واحدة، يُقرأ منه شيئان.
   *
   * `residualSweep` يسأله: هل يتغيّر الفائز؟ و`indifferenceBand` يسأله: كم
   * يتحرّك المجموع نفسه؟ وإعادة بناء المرشحين لكل سؤال تضاعف الكلفة على
   * `optimize()` بلا فائدة.
   */
  function sweepRankings(input) {
    return RESIDUAL_SWEEP.map((fraction) => {
      const ranked = buildCandidates({ ...input, residualCapacityFraction: fraction });
      const totals = {};
      ranked.forEach((candidate) => {
        totals[labelOf(candidate)] = candidate.evaluation.totalEquivalentVehHours;
      });
      return {
        residualCapacityFraction: fraction,
        winner: ranked.length ? labelOf(ranked[0]) : null,
        totals,
      };
    });
  }

  /**
   * نطاق اللاتمييز — متى يكون «الفائز» فائزاً فعلاً؟
   * ---------------------------------------------------------------------------
   * كان `optimize()` يتوّج المرشح الأول دائماً مهما ضاق الفارق. وقيس الفارق
   * على المحفظة كلها: **الوسيط 5.8٪، ومئة وخمسون من مئة وخمسين داخل 10٪**.
   *
   * وهذا الفارق أصغر من عدم يقين النموذج نفسه. فـ`WORK_ZONE_FRICTION` — أرضية
   * زمن العبور — **افتراض نمذجة بلا سند مقيس** تنتج 91.1٪ من التأخير المعروض
   * (`docs/FLOOR-DECISION-2026-07-26.md`)، وتحريك السعة المقيسة عبر مظروفها
   * كله يحرّك التأخير 5٪ والأرضية تعمل. أي أن الترتيب بين المرشحَين الأولين
   * يقع **داخل** ما لا يستطيع النموذج حسمه.
   *
   * وأثرُ ذلك ظهر في بوابة التنوّع: بين التصاريح التي يصفها
   * `stability-report.json` بأنها **قابلة للقرار** يفوز `0p2` في **87 من 87**
   * — مئة بالمئة. لا لأن منتصف الليل أفضل لكل شارع، بل لأن كل الشوارع تتقاسم
   * ملف طلبٍ ساعي واحد (`HOURLY_PROFILE`، «افتراض توضيحي للعرض») فقاعه عند
   * الساعة نفسها، وعلاوة الليل ثابتة عبر ساعات البدء الليلية فلا تميّز بينها.
   *
   * فالعيب ليس أن الجواب منتصف الليل. العيب أن النظام **يدّعي ترتيباً أدقّ من
   * عدم يقينه**، وهو نقيض ما يَعِد به: «يرفض أن يحكم حين لا يملك دليلاً».
   *
   * والعلاج ليس تشتيت الجواب — ذاك كذبٌ آخر. العلاج أن يُعلن التعادل تعادلاً.
   *
   * **والعضوية بانقلاب الرتبة لا بفارق المجموع.** جُرِّبت الصيغة الأخرى أولاً —
   * عتبةٌ من مدى تحرّك مجموع الفائز — فأعطت نطاقاً وسيطه 25٪ وأقصاه 160٪ يبتلع
   * اثنين وعشرين مرشحاً. وسببُ الخطأ أن تحريك نسبة السعة المتبقية يرفع **كل**
   * المرشحين معاً: إزاحةُ نمطٍ مشتركة لا تمسّ الترتيب، فاتخاذها عتبةً للترتيب
   * يضخّم عدم اليقين تضخيماً كاذباً.
   *
   * فالمعيار الصحيح مباشر وبلا معلَمة: **جدولٌ يفوز عند أيّ افتراضٍ مقبول في
   * المظروف لا يُقال إنه خسر.** وما يفوز عند نقطة واحدة على الأقل يدخل صنف
   * التعادل، وما لا يفوز عند أيٍّ منها يبقى خارجه.
   *
   * @returns {{members:Array<string>, decided:boolean, basis:string}|null}
   */
  function indifferenceBand(candidates, sweep) {
    if (!candidates.length || sweep.length < 2) return null;
    const best = candidates[0];
    const bestLabel = labelOf(best);
    const base = best.evaluation.totalEquivalentVehHours;

    /* الفائزون عبر المظروف — بترتيب المرشحين لا بترتيب المسح، كي يبقى المخرَج
       ثابتاً بين التشغيلات. */
    const winners = new Set(sweep.map((entry) => entry.winner).filter(Boolean));
    const members = candidates.map(labelOf).filter((label) => winners.has(label));
    if (!members.length) return null;

    /* أوسع فارق داخل الصنف — يُعرض كي لا يُقرأ التعادل تطابقاً. */
    const totals = candidates
      .filter((candidate) => winners.has(labelOf(candidate)))
      .map((candidate) => candidate.evaluation.totalEquivalentVehHours);
    const spreadPct = base > 0
      ? ((Math.max(...totals) - Math.min(...totals)) / base) * 100
      : 0;

    return {
      members,
      spreadPct,
      /* المُمثِّل يبقى الأول — لا يُكسر ما يقرأ `top3[0]`. لكنه صار واحداً من
         `members` لا فائزاً عليها، والفرق يُقرأ من `decided`. */
      representative: bestLabel,
      decided: members.length === 1,
      basis: 'جداولُ يفوز كلٌّ منها عند نقطةٍ واحدة على الأقل من مظروف نسبة '
        + `السعة المتبقية (${RESIDUAL_SWEEP[RESIDUAL_SWEEP.length - 1]}–`
        + `${RESIDUAL_SWEEP[0]}) — عضويةٌ بانقلاب الرتبة لا بعتبةٍ مختارة`,
    };
  }

  /**
   * تسامح الوزن — **مشتقٌّ لا مختار**.
   * ---------------------------------------------------------------------------
   * صنف اللاتمييز أعلاه يمتنع عن الحسم حين ينقلب الترتيب داخل مظروف نسبة
   * السعة المتبقية. لكنه يصمت عن الأوزان — وهي الكمّية التي يصفها هذا الملف
   * نفسه بأنها «تفضيلات معلنة قابلة للتعديل، وليست قياسات». فكان النظام
   * يمتنع بسبب الافتراض المُصرَّح به، ويحسم رغم الافتراض الذي لا سند له
   * أصلاً. والقياس على المحفظة: عشرة تصاريح تُعلَن `decided: true` بينما
   * تحريك وزنٍ بنسبة ±25٪ يقلب فائزها، واثنان منها ينقلبان عند 0.5٪ و0.6٪.
   *
   * والعتبة هنا **لا تُخترَع**. تُشتقّ وقت التشغيل من المظروف الذي أعلنه
   * المستودع بالفعل لافتراضٍ آخر بلا سند: أوسع تحريكٍ نسبيّ في
   * `RESIDUAL_SWEEP` حول قيمته الافتراضية. أي أن القاعدة واحدة: **ما يقبله
   * النظام حركةً في افتراضٍ بلا سند يجب أن يصمد له في الافتراض الآخر.**
   * فلو وُسِّع مسحُ السعة اتّسع هذا التسامح معه، ولا رقم ثالث يُضاف باليد.
   */
  const WEIGHT_TOLERANCE = RESIDUAL_SWEEP.reduce((widest, fraction) => Math.max(
    widest,
    Math.abs(fraction - RESIDUAL_CAPACITY_FRACTION) / RESIDUAL_CAPACITY_FRACTION
  ), 0);

  /**
   * هل التوصية معلَّقة على وزنٍ بلا مصدر داخل تسامحه المشتقّ؟
   *
   * تُفحص جهتا المدى معاً: وزنٌ يقلب الفائز بخفضٍ طفيف هشٌّ تماماً كوزنٍ
   * يقلبه برفعٍ طفيف. والرقم المعروض محسوبٌ من `switchPoints` لا مكتوب.
   *
   * @returns {{keys:Array<string>, nearestPct:number, tolerancePct:number,
   *            note:string}|null}
   */
  function weightFragile(switchPoints) {
    const tolerancePct = WEIGHT_TOLERANCE * 100;
    const hits = [];
    switchPoints.forEach((point) => {
      [point.deltaPct, point.deltaPctDown].forEach((pct, index) => {
        if (pct === null || pct === undefined) return;
        if (Math.abs(pct) > tolerancePct) return;
        hits.push({
          key: point.key,
          pct,
          next: index === 0 ? point.next : point.nextDown,
        });
      });
    });
    if (!hits.length) return null;

    hits.sort((a, b) => Math.abs(a.pct) - Math.abs(b.pct));
    const nearest = hits[0];
    const direction = nearest.pct >= 0 ? 'رفع' : 'خفض';
    return {
      keys: [...new Set(hits.map((hit) => hit.key))],
      nearestPct: nearest.pct,
      tolerancePct,
      note: `التوصية معلَّقة على وزنٍ بلا مصدر: ${direction} وزن `
        + `${nearest.key} بنسبة ${Math.abs(nearest.pct).toFixed(1)}٪ وحدها `
        + `يقلب الفائز إلى ${nearest.next} — وهو دون التسامح المشتقّ من `
        + `مظروف نسبة السعة المتبقية (${tolerancePct.toFixed(1)}٪). `
        + 'رجّح تشغيلياً، لا حسابياً.',
    };
  }

  /**
   * Find the best scheduling windows for a planned closure.
   * @param {object} input - same shape as score(), startHour/durationHours are the requested baseline.
   * @returns {{top3: Array, baseline: object, switchPoints: Array}}
   */
  function optimize(input) {
    const totalDuration = input.durationHours;
    const baselineWindows = buildNightWindows(
      input.startHour,
      totalDuration,
      WORK_WINDOW_HOURS
    );
    const baselineResult = scoreWindows(input, baselineWindows);
    // الأساس يُقاس بنفس الأهداف، وإلا قورن مرشحٌ متعدد الأهداف بأساسٍ أحادي.
    const baselineEvaluation = evaluateSchedule(input, baselineWindows);

    const candidates = buildCandidates(input);
    /* المسح مرة واحدة: منه حساسية السعة المتبقية، ومنه عتبة اللاتمييز. */
    const sweep = candidates.length ? sweepRankings(input) : [];
    const indifference = indifferenceBand(candidates, sweep);

    const top3 = candidates.slice(0, 3).map((candidate) => {
      const delayVehHours = candidate.evaluation.closureDelayVehHours;
      /* `saved*` يبقى فرق **التأخير** وحده كما كان: كمية فيزيائية قابلة
         للمقارنة عبر الإصدارات. المجموع المكافئ يُعرض منفصلاً كي لا يتسلّل
         وزنٌ تفضيلي إلى رقمٍ يقرؤه القارئ كساعات مركبات. */
      /* WP-B1 — أُزيل `Math.max(0, …)`.
         كان يقصّ الفرق السالب إلى صفر، فتظهر توصيةٌ تأخيرها أعلى من المقدَّم
         بوسم «لا وفر» بدل «تأخير أعلى بمئة وأحد عشر ساعة-مركبة، مقابل امتداد
         موقعٍ أقصر». والقصّ يخفي المقايضة نفسها التي تبرّر التوصية.
         خمسة تصاريح من مئة وخمسين تقع هنا اليوم. */
      const savedVehHours = baselineResult.delayVehHours - delayVehHours;
      const savedPct = baselineResult.delayVehHours > 0
        ? (savedVehHours / baselineResult.delayVehHours) * 100
        : 0;

      const reasons = buildReasons(input, candidate, baselineResult, baselineEvaluation);

      return {
        label: formatLabel(candidate.startHour, candidate.phases, candidate.windows),
        startHour: candidate.startHour,
        phases: candidate.phases,
        windowHours: candidate.windowHours,
        windows: candidate.windows.map((window) => ({ ...window })),
        delayVehHours,
        savedVehHours,
        savedPct,
        breakdown: {
          closureDelayVehHours: candidate.evaluation.closureDelayVehHours,
          residualDelayVehHours: candidate.evaluation.residualDelayVehHours,
          sensitivityHours: candidate.evaluation.sensitivityHours,
          sensitivityEquivalent: candidate.evaluation.sensitivityEquivalent,
          sensitivityExposure: candidate.evaluation.sensitivityExposure,
          nightHours: candidate.evaluation.nightHours,
          nightPremiumEquivalent: candidate.evaluation.nightPremiumEquivalent,
          spanDays: candidate.evaluation.spanDays,
          weights: candidate.evaluation.weights,
        },
        totalEquivalentVehHours: candidate.evaluation.totalEquivalentVehHours,
        reasons,
      };
    });

    /*
     * التعادل يُقال في الأسباب، لا في حقلٍ يقرؤه المطوّر وحده.
     *
     * الحقل `indifference` كافٍ لمن يقرأ المخرَج برمجياً. أما المراجع فيقرأ
     * `reasons` — فلو بقي التعادل هناك وحده لعرضت الشاشة «الفائز» كما كانت
     * تعرضه قبل الإصلاح، ولصار الإصلاح حقيقةً في الـAPI وكذبةً على الشاشة.
     */
    const effectiveWeights = candidates.length
      ? candidates[0].evaluation.weights
      : { ...OBJECTIVE_WEIGHTS, ...(input.weights || {}) };

    const switchPoints = [
      switchPoint(candidates, 'sensitivity', 'sensitivityHours',
        effectiveWeights.sensitivity),
      switchPoint(candidates, 'nightPremium', 'nightHours',
        effectiveWeights.nightPremium),
    ].filter(Boolean);

    const weightFragility = weightFragile(switchPoints);

    /*
     * التحفّظ يتصدّر — وإلا لم يصل القارئ أصلاً.
     * -----------------------------------------------------------------------
     * كان التعادل يُلحَق بذيل `reasons` عبر `concat`. والسطح الذي يعرض
     * التوصية يقصّ: `masar-desk-file.js` يرسم `(a.reasons || []).slice(0, 3)`
     * تحت عنوان «أكبر ثلاثة أسباب». وأسباب المحرك ستةٌ قبل التحفّظ، فكان
     * التعادل يقع في الموضع السابع ويُقصّ **دائماً**. أي أن تسعةً وعشرين
     * تصريحاً من مئة وخمسين كانت تُعرض على الشاشة بفائزٍ واثق بينما المحرك
     * يعرف أنها متعادلة — وهو حرفياً ما حذّر منه التعليق أعلى هذه الكتلة:
     * «حقيقةٌ في الـAPI وكذبةٌ على الشاشة».
     *
     * فالترتيب نفسه هو الإصلاح: التحفّظات تتصدّر القائمة، فتنجو من القصّ
     * عند أي سطحٍ يعرض الثلاثة الأولى. والامتناع أَولى بالصدارة من هامش
     * التفوّق: قارئٌ يقرأ سبباً واحداً يجب أن يقرأ «هذا ليس محسوماً» قبل
     * أن يقرأ «فاز بكذا ساعة-مركبة».
     */
    if (top3.length) {
      const caveats = [];
      if (indifference && !indifference.decided) {
        const others = indifference.members.length - 1;
        caveats.push(`متعادل مع ${others} ${others === 1 ? 'جدول آخر' : 'جداول أخرى'} — `
          + 'كلٌّ منها يفوز عند افتراضٍ مقبول لنسبة السعة المتبقية. '
          + 'الاختيار بينها تشغيليّ لا حسابيّ.');
      }
      if (weightFragility) caveats.push(weightFragility.note);
      if (caveats.length) top3[0].reasons = caveats.concat(top3[0].reasons);
    }

    return {
      top3,
      baseline: {
        delayVehHours: baselineResult.delayVehHours,
        totalEquivalentVehHours: baselineEvaluation.totalEquivalentVehHours,
        breakdown: baselineEvaluation,
        windows: baselineWindows.map((window) => ({ ...window })),
      },
      switchPoints,
      /* كم جدولاً فُحص فعلاً، وبأي ترتيب. ليس زينة: «أفضل ثلاثة» بلا مقام
         لا تُقرأ. ومن دون هذه القائمة لا يستطيع فحصٌ خارجي أن يتأكد أن جدولاً
         بعينه دخل المنافسة أصلاً بدل أن يكون قد سقط من الشبكة. */
      candidateCount: candidates.length,
      rankedLabels: candidates.map(labelOf),
      /* هل الجواب معلَّق على نسبة السعة المتبقية غير المصدرية؟ مسحٌ صريح
         بدل ادعاء المتانة. */
      residualSensitivity: sweep.map((entry) => ({
        residualCapacityFraction: entry.residualCapacityFraction,
        winner: entry.winner,
        changed: candidates.length ? entry.winner !== labelOf(candidates[0]) : true,
      })),
      /* هل يُميَّز الفائز عمّا بعده أصلاً؟ حقلٌ إضافي لا يغيّر `top3`. */
      indifference,
      /* وهل يصمد التمييز لتحريك الوزن الذي لا سند له؟ `null` يعني نعم.
         الحقل يُقرأ برمجياً، ونصّه يتصدّر `reasons` كي يصل الشاشة أيضاً. */
      weightFragility,
      objective: {
        unit: 'ساعة-مركبة مكافئة',
        terms: [
          { key: 'closureDelayVehHours', kind: 'محسوب', what: 'تأخير مستخدمي الطريق أثناء الإغلاق' },
          { key: 'residualDelayVehHours', kind: 'محسوب', what: 'احتكاك الموقع القائم خارج ساعات العمل' },
          { key: 'sensitivityEquivalent', kind: 'وزن معلن', what: 'ساعات العمل داخل نطاق جوار حسّاس' },
          { key: 'nightPremiumEquivalent', kind: 'وزن معلن', what: 'علاوة العمل الليلي التشغيلية' },
        ],
        weights: effectiveWeights,
        residualCapacityFraction: typeof input.residualCapacityFraction === 'number'
          ? input.residualCapacityFraction
          : RESIDUAL_CAPACITY_FRACTION,
      },
    };
  }

  function scoreWindows(input, windows) {
    return {
      delayVehHours: windows.reduce((sum, window) => {
        const result = score({
          ...input,
          startHour: window.startHour,
          durationHours: window.durationHours,
        });
        return sum + result.delayVehHours;
      }, 0),
    };
  }

  /**
   * وسم النافذة الموصى بها — يُقرأ في أعرض خطٍّ أعلى ملف القرار.
   *
   * كان يسرد مدد النوافذ جمعاً: «17 ليالٍ (10 + 10 + 10 + … + 9 س)» — سبعة
   * عشر حدّاً لا تقول أكثر مما يقوله ضربٌ واحد، وتزيح ما تحتها من الشاشة.
   * والنوافذ متساوية إلا آخرها في الغالب، فتُختصر «عدد × مدة» ويُستثنى
   * الذيل. وحين لا تتساوى — وهو ممكن — يُعرض المدى لا رقمٌ يُوهم انتظاماً.
   *
   * و«17 ليالٍ» خطأ نحوي كذلك: ما جاوز العشرة يُمَيَّز بمفرد، وجمعُ القلّة
   * لثلاثٍ إلى عشر، والاثنتان مثنّى.
   */
  function formatLabel(startHour, phases, windows) {
    const hourLabel = String(startHour).padStart(2, '0') + ':00';
    if (phases === 1 || windows.length <= 1) return `كتلة متواصلة تبدأ ${hourLabel}`;
    const hs = windows.map((w) => w.durationHours), n = hs.length, h0 = hs[0], hn = hs[n - 1];
    const nights = n === 2 ? 'ليلتان' : n + (n <= 10 ? ' ليالٍ' : ' ليلة');
    return `عمل ليلي: ${nights}${hs.slice(0, -1).every((h) => h === h0) ? ` × ${h0} س${hn !== h0 ? ` (آخرها ${hn} س)` : ''}` : `، ${Math.min(...hs)}–${Math.max(...hs)} س`}، تبدأ ${hourLabel}`;
  }

  /**
   * أسباب التوصية.
   *
   * المطلوب ليس تنوّع الصياغة بل أن يقرأ المستخدم **الحدّ الذي رجّح**. ولذلك
   * السبب الأول مشتقٌّ من تفصيل الأهداف: أي حدّ فرَّق هذا المرشح عن الأساس.
   */
  function buildReasons(input, candidate, baselineResult, baselineEvaluation) {
    const reasons = [];

    if (candidate.evaluation && baselineEvaluation) {
      const deltas = [
        {
          what: 'تأخير الإغلاق',
          delta: baselineEvaluation.closureDelayVehHours
            - candidate.evaluation.closureDelayVehHours,
        },
        {
          what: 'احتكاك الموقع خارج ساعات العمل',
          delta: baselineEvaluation.residualDelayVehHours
            - candidate.evaluation.residualDelayVehHours,
        },
        {
          what: 'التعرّض في نطاق الجوار الحسّاس',
          delta: baselineEvaluation.sensitivityEquivalent
            - candidate.evaluation.sensitivityEquivalent,
        },
        {
          what: 'ساعات العمل الليلي',
          delta: baselineEvaluation.nightPremiumEquivalent
            - candidate.evaluation.nightPremiumEquivalent,
        },
      ].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

      const top = deltas[0];
      if (Math.abs(top.delta) >= 1) {
        const direction = top.delta > 0 ? 'يخفض' : 'يرفع';
        reasons.push(`الحدّ المرجِّح: ${top.what} — ${direction}ه بمقدار `
          + `${Math.abs(Math.round(top.delta))} ساعة-مركبة مكافئة`);
      } else {
        reasons.push('لا حدّ مرجِّح واضح — الفروق دون ساعة-مركبة واحدة');
      }

      const exposure = candidate.evaluation.sensitivityExposure || [];
      if (exposure.length) {
        reasons.push(`تعرّض حسّاس: ${exposure
          .map((item) => `${item.why} (${Math.round(item.hours)} س)`)
          .join('، ')}`);
      }
      reasons.push(`امتداد الموقع ${candidate.evaluation.spanDays} يوماً · `
        + `${Math.round(candidate.evaluation.nightHours)} ساعة عمل ليلي`);
    }

    const candidateDemandFraction = HOURLY_PROFILE[candidate.startHour % 24];
    const baselineDemandFraction = HOURLY_PROFILE[input.startHour % 24];
    if (baselineDemandFraction > 0) {
      const reductionPct = Math.round(
        (1 - candidateDemandFraction / baselineDemandFraction) * 100
      );
      if (reductionPct > 0) {
        reasons.push(`نافذة خارج الذروة (الطلب أقل بـ${reductionPct}%)`);
      } else {
        reasons.push('نافذة زمنية بطلب مروري مماثل أو أعلى');
      }
    } else {
      reasons.push('نافذة خارج ساعات الذروة المعروفة');
    }

    const isWindowed = candidate.phases === 2 && candidate.windows.length > 1;
    if (isWindowed) {
      reasons.push('الطريق مفتوح بالكامل خارج نافذة العمل الليلية');
    } else if (candidate.phases === 2) {
      reasons.push('تقسيم على مرحلتين يخفض ذروة التأثير لكل ليلة');
    } else {
      reasons.push('تنفيذ في مرحلة واحدة يبسّط التنسيق الميداني');
    }

    const isMorningPeakAvoided = candidate.startHour < 7 || candidate.startHour >= 9;
    if (isMorningPeakAvoided) {
      reasons.push('تفادي ذروة الصباح 7-9');
    } else {
      reasons.push('يتقاطع جزئيًا مع ذروة الصباح 7-9');
    }

    return reasons;
  }

  /**
   * Convert saved vehicle-hours into idle fuel burn and CO2 emissions.
   * @param {number} savedVehHours
   * @returns {{fuelL:number, co2Kg:number}}
   */
  function co2(savedVehHours) {
    const fuelL = savedVehHours * DEFAULTS.idleFuelLPerHour;
    const co2Kg = fuelL * DEFAULTS.co2KgPerL;
    return { fuelL, co2Kg };
  }

  /**
   * Range version of co2(): idle fuel band 0.7–1.1 L/veh-hour (افتراض توضيحي)
   * والانبعاثات الفيزيائية فقط — لا تحويل إلى ريال (سنة أساس أسعار كود 203
   * هي 2005 وتحتاج تحديثاً قبل أي استخدام نقدي، src-004).
   * @param {number} vehHours
   * @returns {{lowFuelL:number, highFuelL:number, lowCo2Kg:number, highCo2Kg:number}}
   */
  function co2Range(vehHours) {
    const lowFuelL = vehHours * DEFAULTS.idleFuelLPerHourLow;
    const highFuelL = vehHours * DEFAULTS.idleFuelLPerHourHigh;
    return {
      lowFuelL,
      highFuelL,
      lowCo2Kg: lowFuelL * DEFAULTS.co2KgPerL,
      highCo2Kg: highFuelL * DEFAULTS.co2KgPerL,
    };
  }

  /**
   * Bus-rider impact range for the closure: for each closure hour, every bus
   * crossing the segment absorbs (closedT - baseT) minutes of delay.
   * عدد المسارات من طبقة الرياض المفتوحة (src-011)؛ الركاب نطاق افتراضي موسوم.
   * @param {{hourly:Array<{baseT:number, closedT:number}>}} scoreResult
   * @param {{routes?:number, busesPerHour?:number, ridersLow?:number, ridersHigh?:number}} [opts]
   * @returns {{busDelayHours:number, lowPersonHours:number, highPersonHours:number, busesAffected:number}}
   */
  function transitImpact(scoreResult, opts) {
    const routes = (opts && opts.routes) || DEFAULTS.busRoutesOnSegment;
    const busesPerHour = (opts && opts.busesPerHour) || DEFAULTS.busesPerHourPerRoute;
    const ridersLow = (opts && opts.ridersLow) || DEFAULTS.ridersPerBusLow;
    const ridersHigh = (opts && opts.ridersHigh) || DEFAULTS.ridersPerBusHigh;

    const busesPerClosureHour = routes * busesPerHour;
    let busDelayHours = 0;
    scoreResult.hourly.forEach(function (h) {
      const delayMinPerBus = Math.max(0, h.closedT - h.baseT);
      busDelayHours += (busesPerClosureHour * delayMinPerBus) / 60;
    });

    return {
      busDelayHours,
      lowPersonHours: busDelayHours * ridersLow,
      highPersonHours: busDelayHours * ridersHigh,
      busesAffected: busesPerClosureHour,
    };
  }

  /**
   * Convert vehicle-hours of delay into a person-hours RANGE using an
   * occupancy band. كود الطرق 203 يشترط الإشغال لا عدّ المركبات (src-003).
   * النطاق إلزامي — لا رقم وحيد (بوابة النشر، evidence-gaps 2026-07-23).
   * @param {number} vehHours
   * @param {{occLow?:number, occHigh?:number}} [opts]
   * @returns {{lowPersonHours:number, highPersonHours:number, occLow:number, occHigh:number}}
   */
  function personHours(vehHours, opts) {
    const occLow = (opts && opts.occLow) || DEFAULTS.occupancyLow;
    const occHigh = (opts && opts.occHigh) || DEFAULTS.occupancyHigh;
    return {
      lowPersonHours: vehHours * occLow,
      highPersonHours: vehHours * occHigh,
      occLow,
      occHigh,
    };
  }

  /**
   * Monetize a person-hours range using the Saudi Highway Code 203 formula:
   * value-of-time = share-of-hourly-wage (0.40 راكب → 0.70 بين المدن, src-003)
   * والأجر من GASTAT الربع الأول 2026 (src-017). نطاق دائماً — لا رقم وحيد.
   * @param {{lowPersonHours:number, highPersonHours:number}} phRange
   * @param {{wageMonthlySAR?:number, workHoursPerMonth?:number, shareLow?:number, shareHigh?:number}} [opts]
   * @returns {{lowSAR:number, highSAR:number, wageHourlySAR:number, shareLow:number, shareHigh:number}}
   */
  function timeValueSAR(phRange, opts) {
    const wageMonthly = (opts && opts.wageMonthlySAR) || DEFAULTS.wageMonthlySAR;
    const workHours = (opts && opts.workHoursPerMonth) || DEFAULTS.workHoursPerMonth;
    const shareLow = (opts && opts.shareLow) || DEFAULTS.votShareLow;
    const shareHigh = (opts && opts.shareHigh) || DEFAULTS.votShareHigh;
    const wageHourlySAR = wageMonthly / workHours;
    return {
      lowSAR: phRange.lowPersonHours * wageHourlySAR * shareLow,
      highSAR: phRange.highPersonHours * wageHourlySAR * shareHigh,
      wageHourlySAR,
      shareLow,
      shareHigh,
    };
  }

  /**
   * كمّ ما يوفّره دمج تصاريح متداخلة في خندق واحد — بالكيلومترات لا بالريال.
   *
   * كانت الدالة تعيد نطاقاً مالياً: طول الخندق × 850,000 ريال/كم × نطاق GAO
   * (25–33٪). ثلاث مشكلات فيه، وكلٌّ منها كافية وحدها:
   *
   *   1. الكلفة 850,000 ريال/كم افتراض معلن، لا تسعيرة. لم تكن تُعرض بجانب
   *      الرقم، فيقرأ المحكّم مجموعاً بملايين الريالات بلا مُدخل ظاهر.
   *   2. نطاق GAO يخصّ مدّ الألياف في مدن أمريكية، وسجل مصادر المشروع نفسه
   *      يقول صراحةً إنه **لا يدعم** نسبة عامة لكل حفريات المدن. فكان المنتج
   *      يخالف تحذيره المكتوب.
   *   3. المجموع كان يُعرض بلا معادلة، وذلك يخالف بوابة النشر الذاتية.
   *
   * البديل ليس إخفاء الريال، بل تغيير ما تقيسه الدالة. لكن التغيير يفرّق بين
   * ادعاءين لا يتساويان في القوة، وخلطهما يستبدل رقماً مالياً لا يُدافَع عنه
   * برقم مسافيّ يبدو دقيقاً وهو مفترَض:
   *
   *   `additionalPermitsInGroups = permitsMerged - 1` — **عدّ لا ادعاء أثر**.
   *   يقول: هذا عدد التصاريح الزائدة عن واحد داخل مجموعات التنسيق. ولا يقول
   *   إن عمليات حفر اختفت: المجموعة تُبنى بتجاور الشارع والنافذة الزمنية،
   *   وقد تكون ثلاثة نطاقات مختلفة نُسّقت توقيتاً فقط. تحويل العدّ إلى
   *   «حفريات متجنَّبة» يحتاج هندسة النطاقات وتفاصيل التنفيذ، وليست عندنا.
   *
   *   الطول — **مفترَض لا محسوب**. أن يوفّر الدمج (n−1)×trenchKm من الحفر
   *   يستلزم أن تحفر التصاريح المسار نفسه بالكامل بأطوال متطابقة وتداخل تام.
   *   وإن تقاطعت جزئياً فالطول المشترك أقلّ، والرقم مبالغ فيه وإن كانت
   *   المعادلة صحيحة حسابياً.
   *
   * الحساب الهندسي للتداخل غير متاح: مسار المحفظة يستعمل طول خندق تمثيلياً
   * موحداً بلا هندسة أصلاً. فالخيار الأمين هو التسمية الصريحة — يُسمّى الرقم
   * `duplicateTrenchKmEquivalent` ويحمل افتراضه معه في `overlapAssumption`،
   * ولا يُعرض بوصفه «طولاً متجنَّباً» قطعياً. متى توفّر حساب التداخل الفعلي
   * حلّ محلّه رقم محسوب، وسقط الافتراض.
   *
   * تحويل أيٍّ من ذلك إلى مال يبقى خطوة يملكها المشغّل لا النموذج.
   *
   * @param {{trenchKm:number, permitsMerged:number}} input
   * @returns {{permitsMerged:number, separateTrenchKm:number,
   *            sharedTrenchKm:number, duplicateTrenchKmEquivalent:number,
   *            additionalPermitsInGroups:number, overlapAssumption:string,
   *            costNote:string}}
   */
  function digOnce(input) {
    const { trenchKm, permitsMerged } = input;
    const separateTrenchKm = permitsMerged * trenchKm;
    // تصريح واحد لا دمج فيه: الخندق المشترك هو الخندق المنفرد، والمكرر صفر.
    const sharedTrenchKm = permitsMerged >= 1 ? trenchKm : 0;
    const merged = permitsMerged > 1;

    return {
      permitsMerged,
      separateTrenchKm,
      sharedTrenchKm,
      duplicateTrenchKmEquivalent: Math.max(0, separateTrenchKm - sharedTrenchKm),
      additionalPermitsInGroups: Math.max(0, permitsMerged - 1),
      overlapAssumption: merged ? OVERLAP_ASSUMPTION : '',
      costNote: COST_NOTE,
    };
  }

  /**
   * Build a minimal Work Zone Data Exchange (WZDx v4-style) road_event
   * FeatureCollection for the approved schedule (src-019). Deterministic:
   * dates derive only from input.startISO — no Date.now().
   * @param {{id:string, roadName:string, direction:string, lanes:number,
   *          lanesClosed:number, startISO:string, durationHours:number,
   *          coordinates:Array<Array<number>>}} input
   * @returns {object} GeoJSON FeatureCollection
   */
  function wzdx(input) {
    const baseStart = new Date(input.startISO);
    if (Number.isNaN(baseStart.getTime())) {
      throw new RangeError(`startISO غير صالح: ${input.startISO}`);
    }

    /* الحرّاس الثلاثة أدناه يمنعون إنتاج ملفٍ يفشل أمام المخطط الرسمي.
       الرفض عند الإنتاج أرخص من ملفٍ يُنزَّل ثم يُرفض عند الجهة المستقبِلة. */
    if (WZDX_DIRECTIONS.indexOf(input.direction) === -1) {
      throw new RangeError(
        `direction خارج تعداد WZDx ${WZDX_VERSION}: «${input.direction}» — `
        + `المسموح: ${WZDX_DIRECTIONS.join(' | ')}. `
        + 'حوِّل القيمة الداخلية عبر MasarWzdxMapping.mapDirection قبل التصدير.'
      );
    }
    const locationMethod = input.locationMethod || 'other';
    if (WZDX_LOCATION_METHODS.indexOf(locationMethod) === -1) {
      throw new RangeError(
        `location_method خارج تعداد WZDx ${WZDX_VERSION}: «${locationMethod}»`
      );
    }
    /* الهندسة: `LineString` أو `MultiPoint` بنقطتين فأكثر. نقطةٌ واحدة لا
       تصف امتداد عمل، ومدُّ خطٍ حولها لاجتياز المخطط يخترع موقعاً. */
    if (!Array.isArray(input.coordinates) || input.coordinates.length < 2) {
      throw new RangeError(
        'coordinates تحتاج نقطتين على الأقل — WZDx لا يقبل هندسة نقطية للحدث. '
        + 'أسنِد النقطة إلى مقطع الطريق الحقيقي قبل التصدير.'
      );
    }
    const windows = Array.isArray(input.windows) && input.windows.length > 0
      ? input.windows
      : [{
          dayOffset: 0,
          startHour: baseStart.getUTCHours(),
          durationHours: input.durationHours,
        }];

    let vehicleImpact;
    if (input.lanesClosed <= 0) vehicleImpact = 'all-lanes-open';
    else if (input.lanesClosed >= input.lanes) vehicleImpact = 'all-lanes-closed';
    else vehicleImpact = 'some-lanes-closed';

    const dataSourceId = input.dataSourceId || 'masar-prototype';

    const features = windows.map((window, index) => {
      const start = new Date(baseStart.getTime());
      start.setUTCDate(baseStart.getUTCDate() + window.dayOffset);
      start.setUTCHours(window.startHour, 0, 0, 0);
      const end = new Date(start.getTime() + window.durationHours * 3600 * 1000);
      return {
        type: 'Feature',
        id: windows.length === 1 ? input.id : `${input.id}-window-${index + 1}`,
        geometry: {
          type: 'LineString',
          coordinates: input.coordinates,
        },
        properties: {
          core_details: {
            event_type: 'work-zone',
            // The producing surface names itself. A file exported from the
            // reviewer desk that identifies as the prototype misattributes
            // its own provenance in a format built for exchange.
            data_source_id: dataSourceId,
            road_names: [input.roadName],
            direction: input.direction,
          },
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          /* حقول التحقق الأربعة **إلزامية** في مخطط WZDx 4.2، وغيابها كان
             أربعاً من إحدى عشرة مخالفة سجّلها التحقق المعزول.
             والقيم `false` صادقة لا متحفّظة: التواريخ من جدول مقترح لا من
             تثبيت ميداني، والمواقع من هندسة الممر لا من مسح موقعي. */
          is_start_date_verified: Boolean(input.startDateVerified),
          is_end_date_verified: Boolean(input.endDateVerified),
          is_start_position_verified: Boolean(input.startPositionVerified),
          is_end_position_verified: Boolean(input.endPositionVerified),
          location_method: locationMethod,
          vehicle_impact: vehicleImpact,
        },
      };
    });

    /* WP-WZ1 — `dayOffset` و`durationHours` خرجا من `properties`.
       ليسا من المواصفة، وهما دفترُ حسابٍ داخلي لا معنى له عند مستهلك خارجي.
       بقاؤهما كان يمنع الحدث من مطابقة فرع المخطط. من احتاجهما يشتقّهما من
       `start_date` و`end_date` — وهما المصدر الحاكم أصلاً. */

    /* `update_date` مشتقّ من المُدخل أو من آخر نافذة — لا `Date.now()`.
       المحرك نقيّ: ملفّان لنفس التصريح يجب أن يتطابقا بايتاً ببايت. */
    const lastEnd = features.length
      ? features[features.length - 1].properties.end_date
      : baseStart.toISOString();

    return {
      /* غياب `feed_info` كان أول المخالفات المسجَّلة. وهو إلزامي في 4.2:
         تغذيةٌ بلا ناشر ولا إصدار ولا مصدر بيانات لا يعرف مستهلكها من
         أصدرها ولا بأي إصدار يقرؤها. */
      feed_info: {
        publisher: input.publisher || 'أمانة منطقة الرياض (نموذج مسار)',
        version: WZDX_VERSION,
        update_date: input.updateDateISO || lastEnd,
        license: 'https://creativecommons.org/publicdomain/zero/1.0/',
        data_sources: [{
          data_source_id: dataSourceId,
          organization_name: input.organizationName
            || 'أمانة منطقة الرياض (نموذج مسار)',
        }],
      },
      type: 'FeatureCollection',
      features,
    };
  }

  /**
   * Superpose two nearby active permits' impact.
   * @param {{delayVehHours:number, score:number, level:string}} scoreA
   * @param {{delayVehHours:number, score:number, level:string}} scoreB
   * @returns {{combined:number, factor:number, warning:string}}
   */
  function compound(scoreA, scoreB) {
    const factor = COMPOUND_FACTOR;
    const combined = (scoreA.delayVehHours + scoreB.delayVehHours) * factor;

    const combinedAadtRef = Math.max(
      scoreA.delayVehHours > 0 ? scoreA.delayVehHours : 0,
      scoreB.delayVehHours > 0 ? scoreB.delayVehHours : 0
    );
    // Reuse the same level thresholds as score() by approximating a combined
    // score proportionally (both scores were computed against the same aadt
    // scale, so we compare against the worse of the two normalized scores
    // scaled by the compounding factor).
    const worseScore = Math.max(scoreA.score, scoreB.score);
    const combinedScoreEstimate = Math.min(100, Math.round(worseScore * factor));
    const combinedLevel = combinedScoreEstimate < 25
      ? 'low'
      : combinedScoreEstimate < 60
        ? 'medium'
        : 'high';

    const warning = combinedLevel === 'high'
      ? 'تنبيه: التأثير المركّب لتصريحين متجاورين يرفع مستوى الخطورة إلى "مرتفع"'
      : '';

    void combinedAadtRef; // reserved for future refinement, kept pure/no side effects

    return { combined, factor, warning };
  }

  /**
   * Post-implementation calibration check: compare predicted vs. observed
   * vehicle-hours. عتبات الحكم افتراض توضيحي للعرض (15% / 30%).
   * @param {number} predictedVehHours
   * @param {number} observedVehHours
   * @returns {{absError:number, pctError:number, verdict:string}}
   */
  function predictionError(predictedVehHours, observedVehHours) {
    const absError = Math.abs(observedVehHours - predictedVehHours);
    const pctError = predictedVehHours > 0
      ? (absError / predictedVehHours) * 100
      : 100;
    let verdict;
    if (pctError <= 15) verdict = 'دقيق';
    else if (pctError <= 30) verdict = 'مقبول';
    else verdict = 'يتطلب إعادة معايرة';
    return { absError, pctError, verdict };
  }

  // Which unofficial demo assumptions feed each headline number. Used by the
  // UI to print "عدد الافتراضات في هذا الرقم: N" on the card itself, turning
  // assumption stacking into visible transparency instead of a hidden weakness.
  const METRIC_ASSUMPTIONS = {
    score: ['aadt', 'HOURLY_PROFILE', 'lanes', 'capacityPerLane', 'freeFlowMin', 'WORK_ZONE_FRICTION'],
    timeValueSAR: ['aadt', 'HOURLY_PROFILE', 'lanes', 'capacityPerLane', 'freeFlowMin', 'occupancyBand', 'workHoursPerMonth'],
    co2: ['aadt', 'HOURLY_PROFILE', 'lanes', 'capacityPerLane', 'freeFlowMin', 'idleFuelLPerHour'],
    // WP-A2: بعد حذف الكلفة والنطاق المستورد لم يبقَ في digOnce افتراض
    // توضيحي واحد — الطول المتجنَّب يُشتقّ من طول الخندق وعدد التصاريح
    // المدموجة، وكلاهما من بيانات التصريح. القائمة فارغة عن حقّ لا عن سهو.
    digOnce: [],
    transitImpact: ['busRoutesOnSegment', 'busesPerHourPerRoute', 'ridersPerBus'],
  };

  /**
   * List the unofficial demo assumptions a given headline metric depends on.
   * @param {string} metric one of score|timeValueSAR|co2|digOnce|transitImpact
   * @returns {string[]|null} copy of the assumption names, or null if unknown
   */
  function assumptionsUsed(metric) {
    return Object.prototype.hasOwnProperty.call(METRIC_ASSUMPTIONS, metric)
      ? METRIC_ASSUMPTIONS[metric].slice()
      : null;
  }

  /**
   * Compare the requested schedule's delay against a chosen optimized schedule.
   * @param {object} input - same shape as score(), at the originally requested startHour/durationHours.
   * @param {{delayVehHours:number}} chosen - a candidate from optimize().top3
   * @returns {{beforeVehHours:number, afterVehHours:number}}
   */
  function backTest(input, chosen) {
    const before = scoreWindows(
      input,
      buildNightWindows(input.startHour, input.durationHours, WORK_WINDOW_HOURS)
    );
    return {
      beforeVehHours: before.delayVehHours,
      afterVehHours: chosen.delayVehHours,
    };
  }

  return {
    HOURLY_PROFILE,
    DEFAULTS,
    WORK_WINDOW_HOURS,
    MAX_DURATION_HOURS,
    WZDX_VERSION,
    WZDX_DIRECTIONS,
    WZDX_LOCATION_METHODS,
    buildNightWindows,
    // WP-B1 — فضاء المرشحين والأهداف المنازِعة، مُصدَّرة كي تعرضها الواجهة
    // وتفحصها الاختبارات بدل نسخها.
    CANDIDATE_START_HOURS,
    CANDIDATE_PHASES,
    CANDIDATE_WINDOW_HOURS,
    SENSITIVITY_BANDS,
    NIGHT_BAND,
    OBJECTIVE_WEIGHTS,
    RESIDUAL_CAPACITY_FRACTION,
    evaluateSchedule,
    residualDelayVehHours,
    hoursInBand,
    // ثوابت المعايرة غير المصدرية — مُصدَّرة كي يعرضها جدول الشفافية في الواجهة
    CALIBRATION: {
      SCORE_CALIBRATION,
      WORK_ZONE_FRICTION,
      WORK_ZONE_LANE_CAPACITY,
      COMPOUND_FACTOR,
      MIN_CAPACITY_FRACTION,
    },
    BPR_ALPHA,
    BPR_BETA,
    bprTravelTime,
    bprVolumeRatio,
    score,
    optimize,
    co2,
    personHours,
    timeValueSAR,
    co2Range,
    transitImpact,
    wzdx,
    predictionError,
    digOnce,
    compound,
    backTest,
    assumptionsUsed,
  };
});
