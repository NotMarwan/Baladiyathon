/**
 * مسار — تقدير الحمل المروري على مقطع شارع (كم مركبة تمرّ؟)
 * ---------------------------------------------------------------------------
 * السؤال الذي تجيب عنه هذه الوحدة: **كم مركبة تمرّ على هذا الشارع؟** وهو
 * السؤال الذي كان المشروع كله يفترض جوابه ولا يحسبه: `masar-engine.js` يأخذ
 * `aadt` مُدخلاً، ومحفظة العرض تسحبه من نطاقٍ عشوائي بحسب صنف الممر، وملف
 * `data/riyadh-roads.geojson` يحمل حقل `aadt` **فارغاً في ٩٢٧٧ مقطعاً من
 * ٩٢٧٧**. أي أن أدقّ حساب تأخيرٍ في المستودع كان يقف على رقمٍ لم يُقدَّر.
 *
 * وقبل السطر الأول من الشيفرة، الحقيقة التي تحكم التصميم كله:
 *
 *   **لا توجد بيانات أحجام مرور منشورة لشوارع الرياض.**
 *   بُحث في البوابة الوطنية للبيانات المفتوحة، وبوابة الهيئة الملكية لمدينة
 *   الرياض، ونشرات وزارة النقل، وإحصاءات الهيئة العامة للإحصاء، وكود الطرق
 *   السعودي، والأدبيات الأكاديمية. الجهات تملك عدّادات (وزارة النقل على
 *   الشبكة بين المدن، وأمانة الرياض ومرورها داخل المدينة) و**لا تنشرها**.
 *   المنشور إحصاءات وطنية مجمَّعة ومعايير تصميم — لا AADT لشارعٍ بعينه.
 *
 * ولذلك فإن كل رقمٍ تُخرجه هذه الوحدة اليوم **تقدير**، ولا واحد منها مقيس.
 * وهذا ليس عيباً يُخفى بل هو ما يجب أن يُعرض: الوحدة تُرجع مع كل رقم طريقةَ
 * اشتقاقه وصنفَ دليله ومظروفَه، ولا تُرجع رقماً عارياً أبداً.
 *
 * ## سلّم الطرق — الأعلى المتاح يفوز
 *
 *   ١. `observed`     عدّاد أو تغذية مشغّل تحمل AADT مقيساً       → مُثبَت عملياً
 *   ٢. `probe-speed`  سرعة مرصودة + سرعة تدفق حرّ ⇐ عكس BPR      → متوقَّع من تجربة
 *   ٣. `class-model`  صنف الطريق × عدد الحارات                    → افتراض توضيحي معلن
 *
 * الدرجة الأولى فارغة اليوم في الرياض — وبقاؤها في السلّم مقصود: يوم تصل
 * تغذية من الأمانة يدخل الرقم من بابه ويرتفع صنف الدليل تلقائياً، بلا إعادة
 * كتابة الوحدة ولا الخريطة.
 *
 * الدرجة الثانية هي **طريقة جوجل من حيث المبدأ** (الاستدلال من السرعة)، مع
 * فارقٍ يجب أن يُقال: جوجل لا تنشر عدد مركبات أصلاً — تنشر زمن رحلة وحالة
 * ازدحام. وتحويل السرعة إلى حجم يقتضي فرضاً إضافياً معلناً (انظر
 * `MasarEngine.bprVolumeRatio`).
 *
 * ## ما لا تفعله هذه الوحدة
 *
 * لا تُعيد اشتقاق معادلة مرورية. عكس BPR يعيش في `masar-engine.js` مع أصله،
 * والملف الساعي (`HOURLY_PROFILE`) يُقرأ من المحرك لا يُنسخ. ما هنا: سلّم
 * الطرق، وجدول الأصناف، والمظاريف، والتصنيف.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./masar-engine.js'));
  } else {
    root.MasarTrafficLoad = factory(root.MasarEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (Engine) {
  'use strict';

  /**
   * جدول الأصناف — AADT لكل حارة، والسعة، وسرعة التدفق الحرّ.
   * ---------------------------------------------------------------------------
   * **نسخةٌ ثانية من جدولٍ قائم، وهذا مقصود ومحروس.** الجدول الأصلي مولَّد في
   * `data/riyadh-route-graph.js` (ثلاثة عشر ميغابايت) ويقرؤه محرك التوجيه.
   * استيرادُ ملفٍ بهذا الحجم لأجل ثلاثة عشر سطراً يُبطئ كل اختبار وكل صفحة.
   * فالنسخة هنا، و`trafficload-test.js` يقرأ بيانات الرسم الوصفية ويقارن
   * الجدولين حقلاً حقلاً. اختلافُهما يُسقط الحزمة — لا ينحرف الرقمان صامتَين.
   *
   * وقيم الجدول نفسها **افتراضات توضيحية معلنة**، لا قياسات سعودية. رتبتها
   * معقولة لشبكة حضرية (شريان بثلاث حارات ≈ ٤٢ ألف مركبة/يوم)، ومصدرها
   * الوحيد هو أنها كذلك — ولا كود الطرق السعودي ينشر AADT تصميمياً لشارع.
   */
  var CLASS_PROFILES = {
    motorway: { kmh: 100, lanes: 3, capacity: 2000, aadtPerLane: 22000 },
    motorway_link: { kmh: 60, lanes: 1, capacity: 1500, aadtPerLane: 9000 },
    trunk: { kmh: 90, lanes: 3, capacity: 1900, aadtPerLane: 18000 },
    trunk_link: { kmh: 55, lanes: 1, capacity: 1400, aadtPerLane: 8000 },
    primary: { kmh: 70, lanes: 3, capacity: 1900, aadtPerLane: 14000 },
    primary_link: { kmh: 50, lanes: 1, capacity: 1300, aadtPerLane: 7000 },
    secondary: { kmh: 60, lanes: 2, capacity: 1700, aadtPerLane: 10000 },
    secondary_link: { kmh: 45, lanes: 1, capacity: 1200, aadtPerLane: 5000 },
    tertiary: { kmh: 50, lanes: 2, capacity: 1600, aadtPerLane: 7000 },
    tertiary_link: { kmh: 40, lanes: 1, capacity: 1100, aadtPerLane: 3500 },
    unclassified: { kmh: 40, lanes: 2, capacity: 1000, aadtPerLane: 3000 },
    residential: { kmh: 30, lanes: 1, capacity: 600, aadtPerLane: 900 },
    living_street: { kmh: 15, lanes: 1, capacity: 300, aadtPerLane: 200 },
  };

  /** صنفٌ لم يرد في الجدول — يُقدَّر كشارع حيّ لا كصفر. */
  var FALLBACK_CLASS = 'unclassified';

  /**
   * المظاريف — نطاقٌ معلن حول التقدير، لا خطأ مقيس.
   * ---------------------------------------------------------------------------
   * الفرق ليس لفظياً. «±٤٠٪» مقيسةً تعني أن أحداً قارن التقدير بعدّاد. وهذا لم
   * يحدث هنا ولا يمكن أن يحدث بلا بيانات منشورة. فما هذه إلا **إعلان جهل
   * مُقدَّر**: الجدول يعطي وسيطاً لصنفٍ كامل، وشوارع الصنف الواحد تتفاوت
   * تفاوتاً واسعاً — شريانٌ في وسط المدينة وشريانٌ في طرفها صنفهما واحد
   * وحملهما مختلف بأضعاف.
   *
   * ويتّسع المظروف حين يتّسع الجهل: مقطعٌ بلا `lanes` في OpenStreetMap يأخذ
   * عدد حاراتٍ افتراضياً من صنفه، فيصير في التقدير مجهولان لا واحد.
   * (تغطية `lanes` في بيانات الرياض المحمَّلة: ٤٥٪ من المقاطع فقط.)
   */
  /* **مظروف الاستدلال من السرعة أوسع من مظروف نموذج الصنف، لا أضيق.**
     كان 0.75–1.35 — أي أن الوحدة تدّعي أن الاستدلال من السرعة أدقّ من جدول
     الأصناف. ولا شيء يسنده: مظروف معاملَي BPR المنشور وحده يحرّك الناتج بين
     0.6 و1.1 من قيمته، وسرعة التدفق الحرّ نفسها غير مرصودة فترتدّ إلى ثابت
     الصنف، ثم يُقسَم الناتج على ملفٍ ساعي توضيحي. فالطريقة **أفضل سنداً**
     (فيها رصدٌ واحد على الأقل) و**ليست أضيق مظروفاً**. */
  var ENVELOPES = {
    observed: { low: 1, high: 1 },
    probeSpeed: { low: 0.5, high: 2 },
    classModelWithLanes: { low: 0.6, high: 1.6 },
    classModelDefaultLanes: { low: 0.45, high: 2 },
  };

  var METHODS = {
    observed: {
      id: 'observed',
      label: 'عدّاد مرصود',
      evidence: 'مُثبَت عملياً',
      basis: 'رقم مقيس من تغذية المشغّل — لا تقدير فيه.',
    },
    probeSpeed: {
      id: 'probe-speed',
      label: 'استدلال من السرعة',
      evidence: 'متوقَّع من تجربة',
      basis: 'عكس دالة BPR على نسبة الزمن المرصود إلى زمن التدفق الحرّ.',
    },
    classModel: {
      id: 'class-model',
      label: 'نموذج الصنف والحارات',
      evidence: 'افتراض توضيحي معلن',
      basis: 'عدد الحارات × حمل الحارة المفترض لصنف الطريق.',
    },
  };

  /**
   * نطاقات العرض على الخريطة — بالمركبة/اليوم لا بنسبة السعة.
   * ---------------------------------------------------------------------------
   * جُرّبت النسبة إلى السعة أولاً فسقطت لسببٍ حسابي: في نموذج الصنف يكون
   * الحجم = حارات × معدّل الحارة، والسعة = حارات × سعة الحارة، فتُختصر
   * الحارات من الطرفين وتصير النسبة ثابتةً لكل مقاطع الصنف الواحد. أي أن
   * الخريطة كانت ستُعيد تلوين تصنيف الطريق باسم «الحمل المروري» — وذاك
   * تضليلٌ بغلاف كمّي.
   *
   * والعدد المطلق يتفاوت فعلاً: شريانٌ بستّ حارات ضِعف شريانٍ بثلاث. وهو
   * أيضاً ما سأل عنه المستعمل حرفياً — **عدد السيارات المارة**.
   *
   * والألوان تدرّجٌ بنفسجيٌّ أحاديّ الصبغة، لا أخضر-أصفر-أحمر. السبب: طبقات
   * الأعمال على الخريطة نفسها تملك الأخضر والكهرماني والأحمر بمعنى **الشدّة**
   * (حادث، إغلاق، أعمال). تدرّجٌ ثانٍ بالألوان نفسها يُقرأ إنذاراً ثانياً لا
   * كمّية. الأحاديّ يقول «أكثر/أقل» ولا يقول «خطر».
   */
  var BANDS = [
    { id: 'very-low', label: 'أقل من 10 آلاف', max: 10000, color: '#cbc0e8' },
    { id: 'low', label: '10–30 ألفاً', max: 30000, color: '#a78bda' },
    { id: 'medium', label: '30–60 ألفاً', max: 60000, color: '#8055c8' },
    { id: 'high', label: '60–100 ألف', max: 100000, color: '#5b2ea6' },
    { id: 'very-high', label: '100 ألف فأكثر', max: Infinity, color: '#3a136e' },
  ];

  /**
   * نطاقات الازدحام — نسبة الحجم إلى السعة في ساعةٍ بعينها.
   * ---------------------------------------------------------------------------
   * هذه هي القراءة التي يسألها الساكن: «هل الشارع زحمة الآن؟» — لا «كم مركبة
   * تمرّ عليه في اليوم؟». وهما مقياسان مختلفان لا مترادفان: شارعٌ بست حارات
   * يحمل ثمانين ألفاً قد يكون أسلس من شارعٍ بحارتين يحمل عشرين.
   *
   * **ولماذا الأخضر-الأصفر-الأحمر هنا وقد رُفض في نطاقات الحجم؟** لأن المعنى
   * اختلف. الحجم كمّية، والكمّية تُقرأ بتدرّجٍ أحادي («أكثر/أقل»). أما
   * الازدحام فحالةٌ لها لغةُ ألوانٍ عالمية يعرفها كل من فتح خريطة ملاحة —
   * ومخالفتها تكلّف القارئ ترجمةً في رأسه لا مبرر لها.
   *
   * والعتبات من نسبة الحجم/السعة كما تُقرأ في دليل السعة: دون النصف تدفق
   * حرّ، وحول 0.85 يبدأ عدم الاستقرار، وعند الواحد التشبّع. وهي عتبات
   * **معلنة** لا معايرة على قياسٍ سعودي.
   */
  var CONGESTION_BANDS = [
    { id: 'free', label: 'سالك', max: 0.5, color: '#2f9e44' },
    { id: 'light', label: 'حركة خفيفة', max: 0.7, color: '#94d82d' },
    { id: 'moderate', label: 'ازدحام متوسط', max: 0.85, color: '#f59f00' },
    { id: 'heavy', label: 'ازدحام شديد', max: 1, color: '#e8590c' },
    { id: 'jam', label: 'تشبّع', max: Infinity, color: '#c92a2a' },
  ];

  function isPositive(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  /** ملامح الصنف، مع ارتداد معلن لا صامت. */
  function profileOf(highway) {
    return CLASS_PROFILES[highway] || CLASS_PROFILES[FALLBACK_CLASS];
  }

  /**
   * الحارات المستعملة في الحساب، ومن أين جاءت، وباتجاهٍ واحد أم باتجاهين.
   * ---------------------------------------------------------------------------
   * **تصحيحُ خطأ وقع هنا وكاد يمرّ.** كان التعليق يقول إن `lanes` تعدّ
   * الاتجاهين دائماً «فلا تصحيح اتجاهيّ». وهذا خطأ على أكثر البيانات: من
   * 9,277 مقطعاً في `data/riyadh-roads.geojson` يحمل **8,539** الوسم
   * `oneway=1`، وعلى الطريق أحادي الاتجاه تكون `lanes` اتجاهيةً بحتة.
   *
   * فكان الرقم الواحد يعني كمّيتين مختلفتين تحت وسمٍ واحد ولونٍ واحد:
   * «مركبة/يوم في الاتجاهين» على 8٪ من الشبكة، و«مركبة/يوم في اتجاه» على
   * 92٪. وأول سؤال يسأله مهندس نقل عن أي AADT هو هذا بعينه.
   *
   * الآن يُقرأ الوسم ويُنقل مع النتيجة، ونسبة الازدحام تُحسب اتجاهيةً في
   * الحالين — انظر `peakVolumeCapacity`.
   */
  function resolveLanes(segment, profile) {
    var input = segment || {};
    var raw = Number(input.lanes);
    var oneway = input.oneway === 1 || input.oneway === '1'
      || input.oneway === true || input.oneway === 'yes';
    var lanes = (Number.isFinite(raw) && raw >= 1) ? Math.round(raw) : null;
    return {
      lanes: lanes === null ? profile.lanes : lanes,
      source: lanes === null ? 'class-default' : 'osm',
      oneway: oneway,
    };
  }

  /**
   * نصيب الاتجاه الأثقل من حركة الذروة على طريقٍ ثنائي الاتجاه.
   * الممارسة المعيارية تضعه بين 0.55 و0.65؛ الوسط معلن هنا ولا يُعاير على
   * قياسٍ سعودي. على الطريق أحادي الاتجاه لا معنى له — الحركة كلها في اتجاه.
   */
  var DIRECTIONAL_SPLIT = 0.6;

  /**
   * نصيب الزمن الأخضر من دور الإشارة — وهو الفرق بين «تدفق التشبّع» و«السعة».
   * ---------------------------------------------------------------------------
   * جدول الأصناف يعطي 1900 مركبة/ساعة/حارة لشريان رئيسي. وهذا **تدفق تشبّع**
   * لا سعة: هو ما تمرّره الحارة وهي خضراء. أما سعة المقترب الإشاري فهي
   * `تدفق التشبّع × الزمن الأخضر ÷ الدور`. وتجاهل الفرق يقسم الحجم على مقامٍ
   * أكبر من الصحيح بنحو الضعف، فيُقرأ الشريان أسلس مما هو — وهو الاتجاه الذي
   * يُقنع بالموافقة على تصريح حفر.
   *
   * والطرق الحرّة والسريعة تدفّقها غير متقطّع فنصيبها واحد.
   *
   * **فرقٌ معلن مع محرك التوجيه:** `masar-city-routing.js` يستعمل تدفق
   * التشبّع مقاماً بلا هذا التصحيح. الرقمان يصفان شيئين (سعة تشغيلية مقابل
   * تدفق تشبّع)، والتوحيد بينهما بندٌ مفتوح في خطة المرحلة الثالثة.
   */
  var GREEN_FRACTION = {
    motorway: 1, motorway_link: 1, trunk: 1, trunk_link: 1,
    primary: 0.45, primary_link: 0.45,
    secondary: 0.45, secondary_link: 0.45,
    tertiary: 0.45, tertiary_link: 0.45,
    unclassified: 0.5, residential: 0.5, living_street: 0.5,
  };

  function greenFractionOf(highway) {
    var value = GREEN_FRACTION[highway];
    return isPositive(value) ? value : GREEN_FRACTION[FALLBACK_CLASS];
  }

  function bandOf(aadt) {
    for (var i = 0; i < BANDS.length; i += 1) {
      if (aadt < BANDS[i].max) return BANDS[i];
    }
    return BANDS[BANDS.length - 1];
  }

  function congestionBandOf(ratio) {
    for (var i = 0; i < CONGESTION_BANDS.length; i += 1) {
      if (ratio < CONGESTION_BANDS[i].max) return CONGESTION_BANDS[i];
    }
    return CONGESTION_BANDS[CONGESTION_BANDS.length - 1];
  }

  /** حصّة ساعةٍ من اليوم في الملف الساعي — يقرأها تعبير اللون على الخريطة. */
  function shareAt(hour) {
    var index = ((Math.round(hour) % 24) + 24) % 24;
    return Engine.HOURLY_PROFILE[index];
  }

  /** حجم ساعةٍ بعينها من AADT — الملف الساعي من المحرك لا نسخةٌ منه. */
  function hourlyVolume(aadt, hour) {
    // ساعةٌ غير رقمية كانت تُنتج NaN صامتاً عبر الفهرسة بـ NaN. صفرٌ صريح
    // أصدق: الدالة مصدَّرة، ومن ناداها بساعةٍ فاسدة يجب ألّا يتلقّى رقماً.
    if (!isPositive(aadt) || !Number.isFinite(Number(hour))) return 0;
    return aadt * shareAt(hour);
  }

  /** ساعة الذروة في الملف الساعي، وحصّتها. */
  function peakShare() {
    var peak = 0;
    var at = 0;
    Engine.HOURLY_PROFILE.forEach(function (share, hour) {
      if (share > peak) { peak = share; at = hour; }
    });
    return { hour: at, share: peak };
  }

  /**
   * السعة التشغيلية في الاتجاه الأثقل، والحجم الذي يقابلها.
   * ---------------------------------------------------------------------------
   * ثلاثة تصحيحات على ما كان: الاتجاه، ونصيب الأخضر، وقسمة الحارات.
   *
   *   · **الاتجاه.** على طريقٍ ثنائي الاتجاه يُقسَم AADT على اتجاهين، والذروة
   *     ليست متساوية بينهما — فحجم الاتجاه الأثقل = AADT × حصة الساعة ×
   *     `DIRECTIONAL_SPLIT`. وعلى الأحادي الحركة كلها في اتجاه.
   *   · **الحارات.** المقام حارات الاتجاه لا حارات المقطع: على الثنائي نصفها.
   *   · **الأخضر.** السعة = تدفق التشبّع × نصيب الزمن الأخضر.
   *
   * وبلا هذه الثلاثة كانت النسبة تُصغَّر مرتين وتُكبَّر مرة، والمحصّلة تُظهر
   * الشريان الإشاري أسلس مما هو.
   *
   * @param {boolean} oneway هل المقطع أحادي الاتجاه
   * @param {number} greenFraction نصيب الزمن الأخضر من الدور
   */
  function peakVolumeCapacity(aadt, lanes, capacityPerLane, oneway, greenFraction) {
    var green = isPositive(greenFraction) ? greenFraction : 1;
    var directionLanes = oneway ? lanes : Math.max(1, lanes / 2);
    var capacity = directionLanes * capacityPerLane * green;
    if (!isPositive(capacity)) {
      return { hour: 0, volume: 0, capacity: 0, ratio: 0, directionLanes: directionLanes };
    }
    var peak = peakShare();
    var volume = aadt * peak.share * (oneway ? 1 : DIRECTIONAL_SPLIT);
    return {
      hour: peak.hour,
      volume: volume,
      capacity: capacity,
      ratio: volume / capacity,
      directionLanes: directionLanes,
    };
  }

  function envelopeAround(aadt, envelope) {
    return { low: Math.round(aadt * envelope.low), high: Math.round(aadt * envelope.high) };
  }

  /** تقريبٌ إلى عدد أرقام معنوية — الصدق في العرض جزءٌ من صدق الرقم. */
  function roundToSignificant(value, digits) {
    if (!isPositive(value)) return 0;
    var magnitude = Math.pow(10, Math.floor(Math.log(value) / Math.LN10) - (digits - 1));
    return Math.round(value / magnitude) * magnitude;
  }

  /**
   * الدرجة الثانية: من السرعة إلى الحجم.
   * ---------------------------------------------------------------------------
   * نسبة الزمن = سرعة التدفق الحرّ ÷ السرعة المرصودة (الزمن عكس السرعة على
   * مسافةٍ ثابتة). ثم عكس BPR يعطي نسبة الحجم/السعة، وضربُها في السعة يعطي
   * حجم تلك الساعة، وقسمتُه على حصّة الساعة في الملف الساعي يعطي AADT.
   *
   * ثلاثة تحفّظات تُرفَق بالرقم ولا تُفصل عنه، وكلها مشروحة عند
   * `MasarEngine.bprVolumeRatio`: فرع المخطط الأساسي المفترض، وانفجار
   * الحساسية عند السرعة القريبة من الحرّة، وبطلان BPR فوق التشبّع.
   *
   * @returns {object|null} null إن لم تكفِ المدخلات
   */
  /**
   * حدود الصلاحية — بوّابةٌ ترفض، لا تحفّظٌ يُكتب ثم يفوز الرقم.
   * ---------------------------------------------------------------------------
   * كانت الوحدة تكتب «الرقم خارج نطاق صلاحية BPR» في قائمة تحفّظات **ثم
   * تعتمده**. ومثال واقعي: شريان بثلاث حارات، سرعته المرصودة 35 وسرعته
   * الحرّة 70 ⇐ نسبة حجم/سعة 1.6 ⇐ AADT ≈ 101 ألفاً، فيتصدّر أغمق لون على
   * الخريطة ويهزم تقدير الصنف (42 ألفاً) — والوحدة نفسها أعلنت بطلانه.
   *
   * فصار الحدّان بوّابتين:
   *   · فوق التشبّع (v/c > 1): BPR ومعكوسها خارج نطاقهما. وأسوأ من ذلك أن
   *     التدفق الحقيقي في الاختناق **ينخفض** ولا يرتفع، فالعكس يقرأ الاختناق
   *     حِملاً أعلى — وهو مقلوب الواقع في الحالة الوحيدة التي يُسأل فيها.
   *   · قريباً من التدفق الحرّ (t/t0 < 1.1): الجذر الرابع يحوّل خطأ 10٪ في
   *     السرعة الحرّة إلى نحو 27٪ في النسبة.
   *
   * والمرفوض يرتدّ إلى نموذج الصنف بتحفّظٍ يقول لماذا — لا يختفي صامتاً.
   */
  var PROBE_MIN_TIME_RATIO = 1.1;
  var PROBE_MAX_VC = 1;

  function fromObservedSpeed(segment, profile, lanes, capacityPerLane, hour) {
    var observed = Number(segment.observedSpeedKmh);
    var free = Number(segment.freeFlowKmh);
    if (!isPositive(free)) free = profile.kmh;
    if (!isPositive(observed) || !isPositive(free)) return null;

    var timeRatio = free / observed;
    var ratio = Engine.bprVolumeRatio(timeRatio);
    var capacity = lanes * capacityPerLane;
    var share = Number.isFinite(hour)
      ? Engine.HOURLY_PROFILE[((Math.round(hour) % 24) + 24) % 24]
      : peakShare().share;
    if (!isPositive(share) || !isPositive(capacity)) return null;

    if (timeRatio < PROBE_MIN_TIME_RATIO) {
      return {
        rejected: 'الزمن المرصود يكاد يساوي زمن التدفق الحرّ، وعكس BPR هناك '
          + 'شديد الحساسية لخطأ السرعة الحرّة — فلم يُعتمد، ورجع التقدير إلى '
          + 'نموذج الصنف.',
      };
    }
    if (ratio > PROBE_MAX_VC) {
      return {
        rejected: 'السرعة المرصودة تعطي نسبة حجم/سعة فوق الواحد، وهي خارج نطاق '
          + 'صلاحية BPR؛ وفي الاختناق ينخفض التدفق الحقيقي فيقرأ العكس الحِمل '
          + 'أعلى مما هو. لم يُعتمد، ورجع التقدير إلى نموذج الصنف.',
      };
    }

    return {
      aadt: (ratio * capacity) / share,
      ratio: ratio,
      caveats: [
        'المخطط الأساسي للتدفق غير أحادي: السرعة الواحدة تقابل حالتين. الرقم '
          + 'مشروط بأن الطريق على الفرع غير المختنق.',
        'سرعة التدفق الحرّ ' + (isPositive(Number(segment.freeFlowKmh))
          ? 'مأخوذة من المُدخل.'
          : 'غير مرصودة — أُخذت من ثابت صنف الطريق، فجزءٌ من هذا «الرصد» '
            + 'افتراضُ صنفٍ في الحقيقة.'),
        'معاملا BPR (0.15 و4) معياريان لا معايرَين محلياً؛ ومظروفهما المنشور '
          + 'وحده يحرّك هذا الرقم بين نحو 0.6 و1.1 من قيمته.',
      ],
    };
  }

  /**
   * يقدّر الحمل المروري لمقطع واحد.
   *
   * @param {object} segment خصائص المقطع: highway, lanes, maxspeed,
   *   aadt (مرصود إن وُجد), observedSpeedKmh, freeFlowKmh
   * @param {object} [options] {hour} ساعة الاستدلال من السرعة (الافتراضي: الذروة)
   * @returns {object} تقدير موسوم بطريقته وصنف دليله ومظروفه
   */
  function estimate(segment, options) {
    var input = segment || {};
    var opts = options || {};
    var profile = profileOf(input.highway);
    var resolved = resolveLanes(input, profile);
    var lanes = resolved.lanes;
    var capacityPerLane = isPositive(input.capacityPerLane)
      ? input.capacityPerLane
      : profile.capacity;

    var aadt;
    var method;
    var envelope;
    var caveats = [];

    if (isPositive(Number(input.aadt))) {
      aadt = Number(input.aadt);
      method = METHODS.observed;
      envelope = ENVELOPES.observed;
    } else {
      var probe = fromObservedSpeed(input, profile, lanes, capacityPerLane, opts.hour);
      if (probe && isPositive(probe.aadt)) {
        aadt = probe.aadt;
        method = METHODS.probeSpeed;
        envelope = ENVELOPES.probeSpeed;
        caveats = probe.caveats;
      } else {
        aadt = lanes * profile.aadtPerLane;
        method = METHODS.classModel;
        envelope = resolved.source === 'osm'
          ? ENVELOPES.classModelWithLanes
          : ENVELOPES.classModelDefaultLanes;
        if (probe && probe.rejected) caveats.push(probe.rejected);
        if (resolved.source === 'class-default') {
          caveats.push('عدد الحارات غير مسجَّل في بيانات الخريطة لهذا المقطع، '
            + 'فأُخذ افتراضياً من صنف الطريق — والمظروف يتّسع لذلك.');
        }
      }
    }

    aadt = Math.round(aadt);
    var range = envelopeAround(aadt, envelope);
    var green = greenFractionOf(input.highway);

    /* **رقمان لنسبة الحجم/السعة، ولا واحد منهما يُخفى.**
       ---------------------------------------------------------------------
       جدول الأصناف يعطي 1900 مركبة/ساعة/حارة لشريان رئيسي، وهو **تدفق تشبّع**
       لا سعة إشارية. والسعة الإشارية تقارب 45٪ منه. فأيّهما مقاماً؟
       قيس الطرفان على شبكة الرياض المحمَّلة (6,114 مقطعاً، ذروة 18):
         · على تدفق التشبّع: 25٪ سالك، 62٪ خفيف، 12٪ شديد، ~0٪ متشبّع.
         · على السعة الإشارية: **63٪ متشبّع**.
       والقراءتان لا تصفان مدينتين — تصفان **تناقضاً بين افتراضين معلنين في
       هذا المستودع**: جدولُ أحمالِ الحارة أعلى مما تحتمله سعةٌ إشارية. أحدهما
       خاطئ، ولا بيانات منشورة تفصل بينهما.
       فالخريطة تلوّن على تدفق التشبّع — وهو الأساس الذي يستعمله محرك التوجيه
       أيضاً، فيبقى المنتج متسقاً — و**البطاقة تعرض الرقمين معاً** كي لا يُقرأ
       الأخضر براءةً. حسمُ التناقض ببيانات عدّاد بندٌ مفتوح. */
    var vc = peakVolumeCapacity(aadt, lanes, capacityPerLane, resolved.oneway, 1);
    var vcSignal = peakVolumeCapacity(aadt, lanes, capacityPerLane, resolved.oneway, green);

    return {
      aadt: aadt,
      /* الرقم المعروض مقرَّبٌ إلى رقمين معنويين.
         عرضُ «101,772» على كمية مبنية على ملفٍ ساعي توضيحي وجدول أصناف معلن
         يدّعي دقةً بخمس خانات لا يملكها أحد. التقريب يقول رتبة الرقم وهي كل
         ما يُدّعى. والقيمة الكاملة تبقى في `aadt` لمن يحسب عليها. */
      aadtRounded: roundToSignificant(aadt, 2),
      low: range.low,
      high: range.high,
      method: method.id,
      methodLabel: method.label,
      evidence: method.evidence,
      basis: method.basis,
      lanes: lanes,
      lanesSource: resolved.source,
      oneway: resolved.oneway,
      directionLabel: resolved.oneway ? 'اتجاه واحد' : 'الاتجاهان',
      highway: input.highway || FALLBACK_CLASS,
      capacityPerLane: capacityPerLane,
      greenFraction: green,
      peakHour: vc.hour,
      peakVolume: Math.round(vc.volume),
      peakCapacity: Math.round(vc.capacity),
      peakRatio: vc.ratio,
      // المقام الثاني: سعةٌ إشارية مقدَّرة. يُعرض ولا يلوّن.
      peakCapacitySignalized: Math.round(vcSignal.capacity),
      peakRatioSignalized: vcSignal.ratio,
      congestionBand: congestionBandOf(vc.ratio).id,
      congestionLabel: congestionBandOf(vc.ratio).label,
      congestionBandSignalized: congestionBandOf(vcSignal.ratio).id,
      band: bandOf(aadt).id,
      bandLabel: bandOf(aadt).label,
      caveats: caveats,
      envelopeNote: method.id === 'observed'
        ? 'رقم مقيس — بلا مظروف تقدير.'
        : 'المظروف نطاقٌ معلن حول التقدير، لا خطأ مقيس: لا عدّاد منشور في '
          + 'الرياض تُقاس عليه هذه الأرقام.',
    };
  }

  /**
   * يقدّر مجموعة ميزات GeoJSON كاملة، ويُرجع مجموعةً جديدة.
   * لا يُعدَّل المُدخل — الخريطة تحتفظ بمصدر الطرق الأصلي كما هو، وهذه طبقة
   * ثانية فوقه.
   */
  function estimateCollection(collection, options) {
    var features = (collection && collection.features) || [];
    return {
      type: 'FeatureCollection',
      features: features.map(function (feature) {
        var props = feature.properties || {};
        var result = estimate(props, options);
        return {
          type: 'Feature',
          geometry: feature.geometry,
          properties: {
            osmId: props.osmId,
            name: props.name,
            highway: props.highway,
            load_aadt: result.aadt,
            load_low: result.low,
            load_high: result.high,
            load_band: result.band,
            /* السعة ومعامل الاتجاه يُحمَلان مع الميزة كي يحسب تعبير اللون
               نسبةَ الازدحام على الخريطة نفسها:
                 `aadt × حصة الساعة × معامل الاتجاه ÷ السعة الاتجاهية`
               بدونهما يلزم إعادة حساب المجموعة كلها عند كل تغيير ساعة — مئة
               ألف كائن لكل خطوة منزلق. */
            load_capacity: result.peakCapacity,
            load_dir_factor: result.oneway ? 1 : DIRECTIONAL_SPLIT,
            load_oneway: result.oneway ? 1 : 0,
            load_method: result.method,
            load_evidence: result.evidence,
            load_lanes: result.lanes,
            load_lanes_source: result.lanesSource,
            load_peak_ratio: Number(result.peakRatio.toFixed(3)),
            load_peak_hour: result.peakHour,
          },
        };
      }),
    };
  }

  /**
   * حصيلة المجموعة: كم مقطعاً في كل نطاق، وبأي طريقة قُدِّر، وكم منها بحارات
   * مسجَّلة. الرقم الأخير هو صدق التغطية — تُعرض النسبة لا تُخفى.
   */
  function summarize(estimatedCollection) {
    var features = (estimatedCollection && estimatedCollection.features) || [];
    var byBand = {};
    var byMethod = {};
    var lanesFromOsm = 0;
    BANDS.forEach(function (band) { byBand[band.id] = 0; });

    features.forEach(function (feature) {
      var props = feature.properties || {};
      byBand[props.load_band] = (byBand[props.load_band] || 0) + 1;
      byMethod[props.load_method] = (byMethod[props.load_method] || 0) + 1;
      if (props.load_lanes_source === 'osm') lanesFromOsm += 1;
    });

    return {
      segments: features.length,
      byBand: byBand,
      byMethod: byMethod,
      lanesFromOsm: lanesFromOsm,
      lanesCoveragePct: features.length ? (100 * lanesFromOsm) / features.length : 0,
    };
  }

  return {
    CLASS_PROFILES: CLASS_PROFILES,
    FALLBACK_CLASS: FALLBACK_CLASS,
    ENVELOPES: ENVELOPES,
    METHODS: METHODS,
    BANDS: BANDS,
    CONGESTION_BANDS: CONGESTION_BANDS,
    DIRECTIONAL_SPLIT: DIRECTIONAL_SPLIT,
    GREEN_FRACTION: GREEN_FRACTION,
    PROBE_MIN_TIME_RATIO: PROBE_MIN_TIME_RATIO,
    PROBE_MAX_VC: PROBE_MAX_VC,
    roundToSignificant: roundToSignificant,
    greenFractionOf: greenFractionOf,
    profileOf: profileOf,
    resolveLanes: resolveLanes,
    bandOf: bandOf,
    congestionBandOf: congestionBandOf,
    shareAt: shareAt,
    hourlyVolume: hourlyVolume,
    peakShare: peakShare,
    peakVolumeCapacity: peakVolumeCapacity,
    estimate: estimate,
    estimateCollection: estimateCollection,
    summarize: summarize,
  };
});
