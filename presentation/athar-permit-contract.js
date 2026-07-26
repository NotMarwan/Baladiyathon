/**
 * أثر — عقد بيانات التصريح (WP-I1).
 * ---------------------------------------------------------------------------
 * **ما هذا الملف، وما ليس.**
 *
 * هو **وصفٌ ومحقِّق**: يقول ما الذي يحتاجه محرك أثر من منصة التصريح ليعمل،
 * وبأي وحدات ومدى، ويرفض ما ينقص أو يخرج عن المدى.
 *
 * وهو **ليس تكاملاً**. لا اتصال بمنصة بلدي، ولا مفتاح، ولا عقد موقَّع، ولا
 * تحقّق من أن أسماء الحقول هنا تطابق أسماءها هناك. الأسماء **من عندنا**
 * مشتقّةً ممّا تعرضه الخدمات العامة، وأي ربط فعلي يبدأ بمطابقتها مع الجهة.
 *
 * ولماذا يستحق العقد أن يوجد قبل التكامل: النموذج اليوم يقرأ محفظة مولَّدة
 * بأسماء حقول اختارها هو. فحين يأتي ملف حقيقي لا أحد يعرف **أي حقل مفقود
 * يمنع التشغيل، وأيّه يقلّل الثقة فقط**. العقد يجيب هذا السؤال قبل أن يُطرح،
 * ويجعل الجواب مفحوصاً لا مذكوراً.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./athar-engine.js'));
  } else {
    root.AtharPermitContract = factory(root.AtharEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (Engine) {
  'use strict';

  var CONTRACT_VERSION = '1.0';

  /**
   * الحقول.
   *
   * `need` ثلاث درجات لا اثنتان:
   *   · `blocking`  — بدونه لا يعمل المحرك إطلاقاً. غيابه يوقف.
   *   · `degrading` — بدونه يعمل المحرك على افتراض معلن، وتنخفض الثقة.
   *   · `optional`  — يُثري العرض ولا يمسّ الحساب.
   *
   * الدرجة الوسطى هي المهمة: ثنائيةُ «إلزامي/اختياري» تدفع إلى تعليم كل شيء
   * إلزامياً خوفاً، فيُرفض ملفٌ كامل لغياب حقلٍ له افتراض معلن.
   *
   * `derivedFrom` يسمّي ما تعرضه خدمة بلدي العامة حين يكون الحقل مأخوذاً
   * منها؛ و`ours` يعني أن الاسم من عندنا ولا يُدَّعى له مقابل هناك.
   */
  var FIELDS = [
    {
      key: 'permitRef',
      label: 'رقم التصريح',
      need: 'blocking',
      type: 'string',
      unit: 'معرّف',
      derivedFrom: 'خدمة تصاريح أعمال البنية التحتية — رقم الطلب',
      why: 'مفتاح الربط بين قرار أثر وسجل الجهة. بدونه لا يُنسب قرار إلى طلب.',
      check: function (value) {
        return typeof value === 'string' && /^[A-Za-z0-9؀-ۿ_-]{3,64}$/.test(value);
      },
      expects: 'نصّ من 3 إلى 64 محرفاً، بلا مسافات',
    },
    {
      key: 'geometry',
      label: 'هندسة موقع العمل',
      need: 'blocking',
      type: 'LineString',
      unit: 'إحداثيات WGS84',
      derivedFrom: 'خدمة الخريطة التفاعلية — مسار الحفرية المرخصة',
      why: 'عليها يقع الإسناد إلى الشبكة، ومنها تُحسب البدائل والحركة المحوَّلة.',
      check: function (value) {
        if (!Array.isArray(value) || value.length < 2) return false;
        return value.every(function (pair) {
          return Array.isArray(pair) && pair.length >= 2
            && isFinite(pair[0]) && isFinite(pair[1])
            && pair[0] >= -180 && pair[0] <= 180
            && pair[1] >= -90 && pair[1] <= 90;
        });
      },
      expects: 'نقطتان على الأقل، كل نقطة [طول، عرض] داخل المدى',
    },
    {
      key: 'lanes',
      label: 'عدد مسارات الطريق',
      need: 'blocking',
      type: 'integer',
      unit: 'مسار',
      derivedFrom: 'ours',
      why: 'مقام نسبة الإغلاق. بدونه لا يُعرف أثر إغلاق مسارين.',
      check: function (value) { return Number.isInteger(value) && value >= 1 && value <= 12; },
      expects: 'عدد صحيح بين 1 و12',
    },
    {
      key: 'lanesClosed',
      label: 'عدد المسارات المغلقة',
      need: 'blocking',
      type: 'integer',
      unit: 'مسار',
      derivedFrom: 'خدمة التصاريح — طريقة التنفيذ ونطاق الإغلاق',
      why: 'المُدخل المباشر لحساب السعة بعد الإغلاق.',
      check: function (value, record) {
        if (!Number.isInteger(value) || value < 0) return false;
        return !Number.isInteger(record.lanes) || value <= record.lanes;
      },
      expects: 'عدد صحيح ≥ 0 ولا يتجاوز عدد المسارات',
    },
    {
      key: 'startISO',
      label: 'بداية النافذة الزمنية',
      need: 'blocking',
      type: 'date-time',
      unit: 'ISO 8601',
      derivedFrom: 'خدمة التصاريح — تاريخ بدء العمل',
      why: 'ساعة البدء تحدّد الطلب المروري، وهي أقوى مُدخل في نتيجة الجدولة.',
      check: function (value) {
        return typeof value === 'string' && !Number.isNaN(Date.parse(value));
      },
      expects: 'تاريخ ووقت ISO 8601',
    },
    {
      key: 'durationHours',
      label: 'مدة العمل',
      need: 'blocking',
      type: 'number',
      unit: 'ساعة',
      derivedFrom: 'خدمة التصاريح — المدة',
      why: 'طول التعرّض. عليه يُبنى امتداد الموقع وعدد النوافذ.',
      check: function (value) {
        return typeof value === 'number' && isFinite(value)
          && value > 0 && value <= Engine.MAX_DURATION_HOURS;
      },
      expects: 'عدد موجب لا يتجاوز ' + Engine.MAX_DURATION_HOURS + ' ساعة',
    },
    {
      key: 'workExtentM',
      label: 'طول موقع العمل',
      need: 'degrading',
      type: 'number',
      unit: 'متر',
      derivedFrom: 'ours',
      /* أُضيف بعد تشغيل المحقق الرسمي على المحفظة: ستّ حالات هندستها نقطة،
         وأُسنِدت النقطة إلى الطريق الصحيح، ثم مُنع نشرها لأن لا أحد يعرف كم
         متراً يمتدّ العمل على ذلك الطريق. مقطع الشبكة طوله كيلومترات فلا ينوب
         عن الجواب. فالحقل الناقص ليس الهندسة بل **الامتداد**، والفرق يحدّد ما
         يُطلب من الجهة: إحداثيات أدقّ لا تحلّ شيئاً. */
      why: 'حين تصل الهندسة نقطةً لا خطاً، الامتداد هو ما يحوّلها إلى موقع عمل '
        + 'قابل للنشر المعياري. غيابه يمنع تصدير WZDx لتلك الحالة ولا يمنع '
        + 'حساب الأثر.',
      fallback: 'يُحسب الأثر من صنف الطريق؛ ويُمنع التصدير المعياري لهذه الحالة',
      check: function (value) {
        return typeof value === 'number' && isFinite(value) && value > 0 && value <= 20000;
      },
      expects: 'عدد موجب بالمتر لا يتجاوز 20000',
    },
    {
      key: 'aadt',
      label: 'الحركة اليومية للشارع',
      need: 'degrading',
      type: 'number',
      unit: 'مركبة/يوم',
      derivedFrom: 'ours',
      why: 'غير منشور في خدمات التصريح. بدونه يقع الحساب على قيمة صنف الطريق '
        + 'المعلنة في المحرك، وتنخفض ثقة الرقم — ولا يتوقف التشغيل.',
      fallback: 'قيمة الصنف المعلنة في athar-engine',
      check: function (value) {
        return typeof value === 'number' && isFinite(value) && value > 0 && value <= 500000;
      },
      expects: 'عدد موجب لا يتجاوز 500000',
    },
    {
      key: 'street',
      label: 'اسم الشارع',
      need: 'degrading',
      type: 'string',
      unit: 'نصّ',
      derivedFrom: 'خدمة الخريطة التفاعلية — اسم الطريق',
      why: 'يُستعمل في العرض والتقارير. غيابه يترك التصريح بلا اسم مقروء '
        + 'ولا يمنع الحساب.',
      fallback: 'اسم مشتقّ من أقرب محور في الشبكة',
      check: function (value) { return typeof value === 'string' && value.trim().length > 0; },
      expects: 'نصّ غير فارغ',
    },
    {
      key: 'promoter',
      label: 'الجهة الطالبة',
      need: 'degrading',
      type: 'string',
      unit: 'نصّ',
      derivedFrom: 'خدمة التصاريح — مقدّم الخدمة',
      why: 'شرط تجميع «الحفر مرة واحدة»: بلا جهة لا يُعرف من يُنسَّق مع من.',
      fallback: 'يُعامَل التصريح فرداً لا عضواً في مجموعة تنسيق',
      check: function (value) { return typeof value === 'string' && value.trim().length > 0; },
      expects: 'نصّ غير فارغ',
    },
    {
      key: 'subtype',
      label: 'نوع العمل',
      need: 'optional',
      type: 'enum',
      unit: 'تصنيف',
      derivedFrom: 'خدمة التصاريح — نوع الخدمة',
      why: 'يُثري التصنيف والعرض ولا يدخل الحساب.',
      values: ['emergency', 'development', 'maintenance', 'default'],
      check: function (value) {
        return ['emergency', 'development', 'maintenance', 'default'].indexOf(value) !== -1;
      },
      expects: 'أحد: emergency, development, maintenance, default',
    },
    {
      key: 'sensitivity',
      label: 'حساسية الجوار',
      need: 'optional',
      type: 'enum',
      unit: 'تصنيف',
      derivedFrom: 'ours',
      why: 'يرجّح بين الجداول (WP-B1). غيابه يجعل التصريح عادياً — وهو '
        + 'الافتراض الأسلم لا الأخطر.',
      values: Object.keys(Engine.SENSITIVITY_BANDS),
      check: function (value) {
        return Object.keys(Engine.SENSITIVITY_BANDS).indexOf(value) !== -1;
      },
      expects: 'أحد: ' + Object.keys(Engine.SENSITIVITY_BANDS).join(', '),
    },
  ];

  function fieldOf(key) {
    for (var i = 0; i < FIELDS.length; i += 1) {
      if (FIELDS[i].key === key) return FIELDS[i];
    }
    return null;
  }

  /**
   * يفحص سجلاً واحداً.
   *
   * لا يعيد صحّة/خطأ: يعيد **ما الذي يمنع التشغيل، وما الذي يخفض الثقة**.
   * «غير صالح» وحدها لا تقول للجهة المرسِلة ما تصلحه.
   *
   * @returns {{ok:boolean, blocking:Array, degrading:Array, unknown:Array}}
   */
  function validate(record) {
    var blocking = [];
    var degrading = [];
    var unknown = [];

    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return {
        ok: false,
        blocking: [{ key: '(السجل)', reason: 'السجل ليس كائناً' }],
        degrading: [],
        unknown: [],
      };
    }

    FIELDS.forEach(function (field) {
      var present = Object.prototype.hasOwnProperty.call(record, field.key)
        && record[field.key] !== null && record[field.key] !== undefined
        && record[field.key] !== '';
      var problem = null;

      if (!present) {
        problem = { key: field.key, label: field.label, reason: 'مفقود' };
      } else if (!field.check(record[field.key], record)) {
        problem = {
          key: field.key,
          label: field.label,
          reason: 'خارج المدى أو النوع — المتوقَّع: ' + field.expects,
          got: record[field.key],
        };
      }

      if (!problem) return;
      if (field.need === 'blocking') {
        blocking.push(problem);
      } else if (field.need === 'degrading') {
        problem.fallback = field.fallback || '';
        degrading.push(problem);
      }
      /* الاختياري الغائب ليس مشكلة أصلاً؛ والاختياري **الخاطئ** يُبلَّغ:
         قيمةٌ خارج التعداد بيانات فاسدة لا حقل ناقص. */
      if (field.need === 'optional' && present) {
        degrading.push(problem);
      }
    });

    Object.keys(record).forEach(function (key) {
      if (!fieldOf(key)) unknown.push(key);
    });

    return {
      ok: blocking.length === 0,
      blocking: blocking,
      degrading: degrading,
      unknown: unknown,
    };
  }

  /**
   * يحوّل سجل العقد إلى مُدخل `athar-engine`.
   *
   * ولا يحسب شيئاً: كل ما هنا نقلٌ وإعادة تسمية. حسابُ ساعةِ البدء من التاريخ
   * هو الاستثناء الوحيد، وهو الاستخراج نفسه المستعمل في بقية المشروع — لا
   * معادلة موازية.
   */
  function toEngineInput(record, options) {
    var settings = options || {};
    var start = new Date(record.startISO);
    return {
      aadt: typeof record.aadt === 'number' ? record.aadt : settings.fallbackAadt,
      lanes: record.lanes,
      lanesClosed: record.lanesClosed,
      startHour: start.getUTCHours(),
      durationHours: record.durationHours,
      capacityPerLane: Engine.DEFAULTS.capacityPerLane,
      freeFlowMin: Engine.DEFAULTS.freeFlowMin,
      sensitivity: record.sensitivity || 'normal',
    };
  }

  /** يحوّل سجل العقد إلى مُدخل تصدير WZDx — بلا حساب كذلك. */
  function toWzdxInput(record, plan) {
    return {
      id: record.permitRef,
      roadName: record.street || 'غير مسمّى',
      direction: record.direction || 'unknown',
      lanes: record.lanes,
      lanesClosed: record.lanesClosed,
      startISO: record.startISO,
      durationHours: record.durationHours,
      coordinates: record.geometry,
      windows: plan && plan.top3 && plan.top3[0] ? plan.top3[0].windows : undefined,
      dataSourceId: 'athar-reviewer-desk',
    };
  }

  return {
    CONTRACT_VERSION: CONTRACT_VERSION,
    FIELDS: FIELDS,
    fieldOf: fieldOf,
    validate: validate,
    toEngineInput: toEngineInput,
    toWzdxInput: toWzdxInput,
  };
});
