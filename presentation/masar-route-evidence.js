/**
 * مسار — عقد قياس المسارات ودرجات الدليل.
 * ---------------------------------------------------------------------------
 * **المشكلة التي يعالجها.**
 *
 * كل رقم في «مسار» اليوم مشتقٌّ من نموذج. والنموذج معايَر على لا شيء محلي:
 * لا سرعة مرصودة على المسار، ولا زمن رحلة، ولا خط أساس بالساعة واليوم. فحين
 * يقول المنتج «التأخير 4014 ساعة-مركبة» فهو يقول ناتج معادلة، ويقرؤه المحكّم
 * قياساً. الفرق بينهما ليس تفصيلاً لغوياً: أحدهما يمكن أن يكون خاطئاً بمرتبة،
 * والآخر خطؤه محدود بدقة القياس.
 *
 * هذا الملف يبني الطبقة الناقصة: **عقدٌ موحّد لقياس فعلي فوق مسار حقيقي**،
 * ودرجاتُ دليلٍ تمنع أن يُقرأ المشتَقّ مرصوداً.
 *
 * **وما لا يفعله.**
 *
 * لا يثبت أثر إغلاق. قياسُ الطريق في ظرفه العادي يبني خط أساس ويضيّق نطاقات،
 * ولا يقول ما الذي كان سيحدث لو أُغلق. إثبات الأثر يحتاج إغلاقاً فعلياً وحالة
 * مقابلة — وهما في `measurement-pack/`، لا هنا.
 *
 * UMD.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarRouteEvidence = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONTRACT_VERSION = '1.0';

  /**
   * درجات الدليل — مرتَّبة بقوّتها، ولكلٍّ ما يدعمه وما لا يدعمه.
   *
   * `rank` ليس زينة: الواجهة تعرضه، والبوابات تمنع أن يُعرض `global-analog`
   * بلغةِ `local-field`. وأي درجة تدّعي أكثر من `proves` كذبٌ يُلتقَط بفحص.
   */
  /* لماذا اتّسع السُّلَّم من سبع درجات إلى تسع.
     كان `global-analog` دلواً واحداً يبتلع شيئين لا يستويان:
       · توصية تصميم في دليل (TTI: 1600 مركبة/ساعة/حارة) — ورقة.
       · قياس فعلي من أرشيف كواشف على منطقة عمل حقيقية (ميزوري: 1072) —
         بيانات ميدانية، أجنبية.
     الثاني أقوى من الأول بمراتب، والسُّلَّم كان يسوّي بينهما. وهذا ظلمٌ
     للمشروع نفسه: يجعل قياساً حقيقياً يبدو كتوصية منقولة، فتُقرأ المحفظة
     أفقر دليلاً مما هي.
     وأُضيفت معها `external-official`: أن يقبل محققنا **إنتاج جهة رسمية
     أجنبية حقيقية** ليس قياساً مرورياً، لكنه ليس نموذجاً أيضاً — هو دليل
     تبادلية، ويستحق موضعاً بين الاثنين.
     والسقف لم يتحرك: `local-field` تبقى وحدها ما يفتح كلمة «مسار»، وتبقى
     `calibrates: true` حكراً عليها. اتّساع السُّلَّم لا يقرّب أحداً منها. */
  var EVIDENCE_GRADES = [
    {
      key: 'local-field',
      rank: 8,
      label: 'دليل ميداني محلي',
      what: 'قياس قبل/أثناء/بعد على الحالة نفسها مع حالة مقابلة مناسبة.',
      narrows: true,
      calibrates: true,
      proves: 'أثراً سببياً لهذه الحالة — ضمن حدود تصميم المقارنة.',
      notProves: 'تعميماً على تصاريح أخرى بلا عيّنة.',
    },
    {
      key: 'local-route',
      rank: 7,
      label: 'رصد محلي فوق المسار',
      what: 'قياس فعلي فوق المسارات نفسها، بلا الإغلاق محل القرار.',
      narrows: true,
      calibrates: false,
      proves: 'سرعة وزمن رحلة فعليين على الطريق في ظرفه القائم.',
      notProves: 'أثر الإغلاق. الطريق بلا إغلاق لا يقول ماذا يحدث معه.',
    },
    {
      key: 'local-historical',
      rank: 6,
      label: 'سجل محلي تاريخي',
      what: 'سلسلة زمنية للطريق نفسه بالساعة واليوم.',
      narrows: true,
      calibrates: false,
      proves: 'خط أساس يقارَن به، وتمييز المعتاد من الشاذّ.',
      notProves: 'سببية. الفرق عن الخط قد يكون طقساً أو فعالية.',
    },
    {
      key: 'local-comparable',
      rank: 5,
      label: 'حالة محلية مشابهة',
      what: 'إغلاق سعودي موثَّق بخصائص معلنة.',
      narrows: true,
      calibrates: false,
      proves: 'نطاقاً مرجعياً أقرب إلى ظرفنا من العالمي.',
      notProves: 'قيمة معامل لهذا الطريق.',
    },
    {
      key: 'global-field-measured',
      rank: 4,
      label: 'قياس ميداني أجنبي',
      what: 'قياس فعلي قبل/أثناء على منطقة عمل حقيقية خارج السعودية، بطريقة '
        + 'قياس معلنة (أرشيف كواشف، عدّ يدوي، زمن رحلة مقيس).',
      narrows: true,
      calibrates: false,
      proves: 'أن الظاهرة قيست فعلاً لا استُنتجت، وأن حجمها في سياقٍ معلوم.',
      notProves: 'قيمة محلية. سلوك السائق والشبكة والإنفاذ يختلف — والفرق '
        + 'غير معروف المقدار لأنه لم يُقَس هنا.',
    },
    {
      key: 'external-official',
      rank: 3,
      label: 'تبادلية مع إنتاج رسمي أجنبي',
      what: 'تغذية تشغيلية حقيقية تنشرها جهة حكومية، مثبَّتة ببصمتها، '
        + 'مُمرَّرة على المخطط الرسمي نفسه الذي يُمرَّر عليه مُخرَجنا.',
      narrows: false,
      calibrates: false,
      proves: 'أن العقد الذي نصدّر عليه هو العقد الذي تنشر عليه جهة حقيقية — '
        + 'أي أن المحقق ليس مفصَّلاً على مخرجاتنا وحدها.',
      notProves: 'أي رقم مروري. البنية ليست القياس، وتغذيةُ ولايةٍ أخرى لا '
        + 'تقول شيئاً عن الرياض.',
    },
    {
      key: 'global-analog',
      rank: 2,
      label: 'نظير عالمي',
      what: 'حالة أو توصية تصميم من مصدر أجنبي بدرجة تشابه معلنة — بلا قياس '
        + 'مباشر على منطقة عمل، أو بطريقة قياس غير معلنة.',
      narrows: true,
      calibrates: false,
      proves: 'نطاقاً أولياً واسعاً، واتجاه الأثر المتوقَّع.',
      notProves: 'أي رقم محلي. سلوك السائق والشبكة والإنفاذ يختلف.',
    },
    {
      key: 'model-derived',
      rank: 1,
      label: 'مشتقّ من النموذج',
      what: 'ناتج محرك مسار من مدخلات وافتراضات معلنة.',
      narrows: false,
      calibrates: false,
      proves: 'ترتيباً داخلياً متسقاً بين بدائل تحت الافتراضات نفسها.',
      notProves: 'قيمة مطلقة. الافتراض غير المعاير يحملها.',
    },
    {
      key: 'synthetic',
      rank: 0,
      label: 'تركيبي',
      what: 'بيانات مولَّدة للاختبار.',
      narrows: false,
      calibrates: false,
      proves: 'أن الشيفرة تعمل.',
      notProves: 'أي شيء عن الرياض.',
    },
  ];

  function gradeOf(key) {
    for (var i = 0; i < EVIDENCE_GRADES.length; i += 1) {
      if (EVIDENCE_GRADES[i].key === key) return EVIDENCE_GRADES[i];
    }
    return null;
  }

  /**
   * المفردات الممنوعة على كل درجة.
   *
   * «مرصود» لناتج نموذج، و«محلي» لحالة عالمية، و«ميداني» لقياس مزوّد لم يُجمع
   * أثناء الإغلاق — ثلاث كلمات تحوّل الدليل الضعيف إلى قوي بلا بيانات جديدة.
   * وهي أرخص طريقة لرفع درجة الأثر، ولذلك تُمنع بفحص لا بعُرف.
   */
  var FORBIDDEN_WORDS = {
    'model-derived': ['مرصود', 'مقيس', 'ميداني', 'مُقاس'],
    synthetic: ['مرصود', 'مقيس', 'ميداني', 'محلي', 'مُقاس'],
    'global-analog': ['محلي', 'ميداني', 'مرصود في الرياض'],
    /* «ميداني» مسموحة هنا وحدها بين الدرجات الأجنبية — لأنها صادقة: القياس
       ميداني فعلاً. الممنوع أن يُقرأ محلياً. */
    'global-field-measured': ['محلي', 'مرصود في الرياض', 'أثر مثبت في الرياض'],
    /* تبادليةٌ ليست قياساً. أخطر التباسٍ ممكن هنا أن يُقرأ «اجتاز المخطط»
       على أنه «صحيح مرورياً»، فتُمنع كل مفردة قياس. */
    'external-official': ['مرصود', 'مقيس', 'ميداني', 'محلي', 'مُقاس'],
    'local-comparable': ['ميداني على هذا الطريق'],
    'local-route': ['أثر الإغلاق', 'أثر مثبت'],
    'local-historical': ['أثر مثبت'],
  };

  /**
   * @param {string} gradeKey
   * @param {string} text نصّ العرض المرافق للرقم.
   * @returns {{ok:boolean, violations:string[]}}
   */
  function checkLanguage(gradeKey, text) {
    var banned = FORBIDDEN_WORDS[gradeKey] || [];
    var body = String(text || '');
    var violations = [];
    banned.forEach(function (word) {
      if (body.indexOf(word) !== -1) {
        violations.push('«' + word + '» ممنوعة على درجة ' + gradeKey);
      }
    });
    return { ok: violations.length === 0, violations: violations };
  }

  /**
   * حقول القياس الواحد.
   *
   * `need` كما في عقد التصريح: `blocking` يمنع قبول القياس، و`degrading` يقبله
   * بثقة أقل، و`optional` يُثري.
   *
   * الفصل الحاكم هنا بين مجموعتين:
   *   · السرعة والزمن — يعطيهما كل مزوّد حركة.
   *   · الحجم والسعة — **لا يعطيهما أحد منهم**. تحقّقنا: HERE يعيد
   *     `speed`/`freeFlow`/`jamFactor`/`confidence` ولا يعيد عدّ مركبات.
   * وعلى هذا الفصل تقوم قاعدة `v/c`: نسبةٌ مقامها سعة وبسطها حجم، وكلاهما
   * غائب. حسابها من السرعة وحدها اختراعُ بسطٍ لا وجود له.
   */
  var FIELDS = [
    { key: 'routeId', need: 'blocking', type: 'string', unit: 'معرّف',
      why: 'المسار الذي يخصّه القياس — أساسي والبديل ونقاط المغادرة والعودة.' },
    { key: 'segmentId', need: 'blocking', type: 'string', unit: 'معرّف',
      why: 'المقطع داخل المسار. القياس على مستوى المسار وحده يخفي اختناقاً في مقطع.' },
    { key: 'geometryRef', need: 'degrading', type: 'string', unit: 'مرجع',
      why: 'مرجع هندسة المقطع أو معرّفه عند المزوّد — به يُعاد الإسناد لاحقاً.' },
    { key: 'provider', need: 'blocking', type: 'string', unit: 'اسم',
      why: 'من أنتج القيمة. قياسان من مزوّدين مختلفين لا يُجمعان بلا تصريح.' },
    { key: 'sourceType', need: 'blocking', type: 'enum', unit: 'تصنيف',
      values: ['probe', 'sensor', 'camera', 'manual-count', 'derived', 'provider-sample'],
      why: 'مسبار غير عدّاد. الأول يقدّر السرعة من عيّنة مركبات، والثاني يعدّ.' },
    { key: 'observedAt', need: 'blocking', type: 'date-time', unit: 'ISO 8601',
      why: 'لحظة الرصد. مقارنة مسارين قيسا في لحظتين مختلفتين تفضّل الأهدأ ساعةً.' },
    { key: 'importedAt', need: 'blocking', type: 'date-time', unit: 'ISO 8601',
      why: 'لحظة الاستيراد. الفرق عن الرصد يكشف تأخّر السلسلة.' },
    { key: 'timezone', need: 'blocking', type: 'string', unit: 'IANA',
      why: 'الرياض +03 بلا توقيت صيفي؛ الخلط يزيح ساعة الذروة.' },
    { key: 'speedKph', need: 'degrading', type: 'number', unit: 'كم/س',
      why: 'السرعة الحالية على المقطع.' },
    { key: 'freeFlowKph', need: 'degrading', type: 'number', unit: 'كم/س',
      why: 'سرعة الانسياب الحر المرجعية عند المزوّد — لا تُخلط بحدّ السرعة.' },
    { key: 'travelTimeSec', need: 'degrading', type: 'number', unit: 'ثانية',
      why: 'زمن اجتياز المقطع.' },
    { key: 'delaySec', need: 'degrading', type: 'number', unit: 'ثانية',
      why: 'الفرق عن زمن الانسياب الحر.' },
    { key: 'congestionIndex', need: 'optional', type: 'number', unit: 'مؤشر',
      why: 'مؤشر ازدحام المزوّد (مثل jamFactor 0–10). مقياسه مزوّدي لا معياري.' },
    { key: 'volumeVehPerHour', need: 'optional', type: 'number', unit: 'مركبة/ساعة',
      why: 'حجم الحركة. **غيابه لا يساوي صفراً** — ومزوّدو المسبار لا يعطونه.' },
    { key: 'volumeSource', need: 'optional', type: 'string', unit: 'اسم',
      why: 'من أين جاء الحجم. حجمٌ بلا مصدر لا يُحسب عليه شيء.' },
    { key: 'sampleSize', need: 'optional', type: 'number', unit: 'عدد',
      why: 'حجم العيّنة خلف القيمة، إن أعلنه المزوّد.' },
    { key: 'confidence', need: 'degrading', type: 'number', unit: '0–1',
      why: 'ثقة المزوّد. عند HERE: أقل من 0.7 يعني أن القيمة تاريخية لا آنية.' },
    { key: 'coverage', need: 'degrading', type: 'number', unit: '0–1',
      why: 'نسبة طول المقطع التي غطّاها القياس فعلاً.' },
    { key: 'status', need: 'blocking', type: 'enum', unit: 'تصنيف',
      values: ['ok', 'partial', 'stale', 'failed'],
      why: 'حالة القياس. الفاشل يُحفظ ولا يُحذف — انقطاعُ سلسلةٍ معلومةٌ.' },
    { key: 'dataMode', need: 'blocking', type: 'enum', unit: 'درجة دليل',
      values: EVIDENCE_GRADES.map(function (grade) { return grade.key; }),
      why: 'درجة الدليل. بدونها يُقرأ التركيبي والمرصود سواء.' },
    { key: 'license', need: 'blocking', type: 'string', unit: 'مرجع',
      why: 'شرط الاستعمال. تخزينٌ يخالف الشرط عيبٌ قانوني لا تقني.' },
    { key: 'knownLimits', need: 'degrading', type: 'string', unit: 'نصّ',
      why: 'ما لا يقوله هذا القياس — يُكتب مرة عند المصدر لا يُستنتج كل مرة.' },
  ];

  function fieldOf(key) {
    for (var i = 0; i < FIELDS.length; i += 1) {
      if (FIELDS[i].key === key) return FIELDS[i];
    }
    return null;
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function checkField(field, value) {
    if (field.type === 'string') return typeof value === 'string' && value.length > 0;
    if (field.type === 'number') return isFiniteNumber(value);
    if (field.type === 'enum') return field.values.indexOf(value) !== -1;
    if (field.type === 'date-time') {
      return typeof value === 'string' && !Number.isNaN(Date.parse(value));
    }
    return true;
  }

  /**
   * يفحص قياساً واحداً ويقول ما الذي يمنع قبوله وما الذي يخفض ثقته.
   *
   * @returns {{ok:boolean, blocking:Array, degrading:Array, unknown:string[]}}
   */
  function validateMeasurement(record) {
    var blocking = [];
    var degrading = [];
    var unknown = [];

    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return { ok: false, blocking: [{ key: '(السجل)', reason: 'ليس كائناً' }],
        degrading: [], unknown: [] };
    }

    FIELDS.forEach(function (field) {
      var value = record[field.key];
      var present = value !== undefined && value !== null && value !== '';
      var problem = null;
      if (!present) {
        problem = { key: field.key, reason: 'مفقود' };
      } else if (!checkField(field, value)) {
        problem = { key: field.key, reason: 'نوع أو قيمة غير مقبولة', got: value };
      }
      if (!problem) return;
      if (field.need === 'blocking') blocking.push(problem);
      else if (field.need === 'degrading') degrading.push(problem);
      else if (present) degrading.push(problem);
    });

    Object.keys(record).forEach(function (key) {
      if (!fieldOf(key)) unknown.push(key);
    });

    /* لا قياس بلا مقياس: سجلٌّ فيه توقيت ومزوّد وبلا سرعة ولا زمن ولا حجم
       ليس قياساً — هو سجل محاولة. قبوله يملأ السلسلة بصفوف فارغة تبدو تغطية. */
    var hasMetric = isFiniteNumber(record.speedKph)
      || isFiniteNumber(record.travelTimeSec)
      || isFiniteNumber(record.volumeVehPerHour);
    if (!hasMetric && record.status === 'ok') {
      blocking.push({ key: '(المقاييس)',
        reason: 'حالة «ok» بلا سرعة ولا زمن ولا حجم — سجلُّ محاولة لا قياس' });
    }

    /* الحجم إن وُجد يحتاج مصدراً يُسمّى. رقمٌ بلا مصدر يصير لاحقاً بسط v/c. */
    if (isFiniteNumber(record.volumeVehPerHour) && !record.volumeSource) {
      blocking.push({ key: 'volumeSource',
        reason: 'حجم بلا مصدر — لا يُبنى عليه v/c ولا سعة' });
    }

    return { ok: blocking.length === 0, blocking: blocking,
      degrading: degrading, unknown: unknown };
  }

  /**
   * هل يجوز حساب v/c من هذا القياس؟
   *
   * القاعدة صريحة لأن الإغراء صريح: السرعة موجودة دائماً، و`v/c` يبدو مشتقّاً
   * منها عبر منحنى. وهو ليس كذلك — المنحنى يعطي سرعةً من `v/c`، لا العكس،
   * وعكسه يحتاج فرع الازدحام وقد لا يكون وحيداً.
   *
   * @returns {{allowed:boolean, reason:string}}
   */
  function canComputeVolumeCapacity(record, capacity) {
    if (!isFiniteNumber(record && record.volumeVehPerHour)) {
      return { allowed: false,
        reason: 'لا حجم حركة في القياس — ومزوّدو المسبار لا ينتجونه. '
          + 'غياب الحجم ليس صفراً، و v/c بلا بسط ليس نسبة.' };
    }
    if (!record.volumeSource) {
      return { allowed: false, reason: 'حجم بلا مصدر معلن' };
    }
    if (!capacity || !isFiniteNumber(capacity.value) || capacity.value <= 0) {
      return { allowed: false, reason: 'لا سعة صالحة للمقطع' };
    }
    if (!capacity.source) {
      return { allowed: false,
        reason: 'سعة بلا مصدر — قيمة الصنف الافتراضية ليست قياس سعة' };
    }
    return { allowed: true, reason: 'حجم ومصدره وسعة ومصدرها — النسبة قابلة للحساب' };
  }

  /**
   * هل القياسان قابلان للمقارنة؟
   *
   * الشرط الحاكم: نافذة زمنية واحدة. مقارنة مسار أساسي قيس في السابعة صباحاً
   * ببديل قيس في العاشرة تفضّل البديل لأنه قيس بعد الذروة — لا لأنه أسرع.
   *
   * @param {number} windowSeconds أوسع فارق مقبول.
   */
  function comparable(a, b, windowSeconds) {
    var limit = isFiniteNumber(windowSeconds) ? windowSeconds : 300;
    if (!a || !b) return { ok: false, reason: 'قياس ناقص' };
    var ta = Date.parse(a.observedAt);
    var tb = Date.parse(b.observedAt);
    if (Number.isNaN(ta) || Number.isNaN(tb)) {
      return { ok: false, reason: 'توقيت رصد غير صالح' };
    }
    var gap = Math.abs(ta - tb) / 1000;
    if (gap > limit) {
      return { ok: false,
        reason: 'فارق الرصد ' + Math.round(gap) + ' ث يتجاوز النافذة ' + limit + ' ث '
          + '— الفرق قد يكون ساعةً لا مساراً' };
    }
    if (a.provider !== b.provider) {
      return { ok: false,
        reason: 'مزوّدان مختلفان (' + a.provider + ' مقابل ' + b.provider + ') '
          + '— مرجع الانسياب الحر وطريقة التقدير يختلفان' };
    }
    if (a.dataMode !== b.dataMode) {
      return { ok: false,
        reason: 'درجتا دليل مختلفتان (' + a.dataMode + ' مقابل ' + b.dataMode + ')' };
    }
    return { ok: true, reason: 'نافذة واحدة، مزوّد واحد، درجة واحدة' };
  }

  return {
    CONTRACT_VERSION: CONTRACT_VERSION,
    EVIDENCE_GRADES: EVIDENCE_GRADES,
    FORBIDDEN_WORDS: FORBIDDEN_WORDS,
    FIELDS: FIELDS,
    gradeOf: gradeOf,
    fieldOf: fieldOf,
    checkLanguage: checkLanguage,
    validateMeasurement: validateMeasurement,
    canComputeVolumeCapacity: canComputeVolumeCapacity,
    comparable: comparable,
  };
});
