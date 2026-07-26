/**
 * مسار — جدول التحويل بين القيم الداخلية وقيم WZDx 4.2 المعيارية.
 * ---------------------------------------------------------------------------
 * **العيب الذي يعالجه هذا الملف.**
 *
 * المحفظة تخزّن الاتجاه بالعربية (`شمال` / `جنوب`) لأن الواجهة عربية والمراجع
 * يقرأ عربية. و`Direction.json` في مخطط 4.2 تعدادٌ مغلق بثمانِ قيم إنجليزية.
 * فمرّر النصّ العربي كما هو إلى `core_details.direction`، وفشل التصدير المعياري
 * **لكل التصاريح المئة والخمسين** — لا لبعضها.
 *
 * الفصل الذي يفرضه الملف: العرض عربي، والنموذج الداخلي عربي، وملفُ التبادل
 * معياري، وبينهما جدولٌ **صريح ومختبَر** لا تحويل ضمني في موضع الاستعمال.
 *
 * **ولماذا لا افتراض صامت.**
 *
 * أسهل إصلاح: `DIRECTION[value] || 'unknown'`. وهو أسوأها — يجعل كل قيمة لم
 * يفكّر فيها أحد تخرج «مجهولة» في ملفٍ يقرؤه غيرنا، فيبدو النظام كأنه لا يعرف
 * اتجاه أعماله. الغياب المعلن أصدق من قيمة صحيحة نحوياً كاذبة دلالياً: القيمة
 * غير القابلة للتحويل **تُفشل تصدير حالتها** وتذكر سببها.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarWzdxMapping = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** نسخة المخطط التي بُني عليها هذا الجدول. تغييرها قرار يُكتب. */
  var SCHEMA_VERSION = '4.2';

  /**
   * `Direction.json` — التعداد المغلق حرفياً من المخطط المثبَّت.
   * مكتوب هنا لا مقروءاً من المحرك: قائمةٌ تُقرأ من المُختبَر تتوسّع بإضافة
   * قيمة إليه فتمرّ البوابة بلا فحص.
   */
  var WZDX_DIRECTIONS = ['northbound', 'eastbound', 'southbound', 'westbound',
    'undefined', 'unknown', 'inner-loop', 'outer-loop'];

  /**
   * الجدول.
   *
   * المفتاح صيغةٌ داخلية قد تصل من المحفظة أو من ملف جهة، والقيمة قيمة المخطط.
   * الصيغ العربية متعددة عمداً (`شمال` و`شمالاً` و`الشمال` و`شمالي`) لأن
   * مصدر البيانات ليس واحداً، ولأن إسقاط صيغةٍ منها يعني فشل تصدير حقيقي
   * لا خطأ تحويل نظري.
   */
  var DIRECTION_MAP = {
    // عربي — شمال
    'شمال': 'northbound',
    'شمالاً': 'northbound',
    'شمالا': 'northbound',
    'الشمال': 'northbound',
    'شمالي': 'northbound',
    'باتجاه الشمال': 'northbound',
    // عربي — جنوب
    'جنوب': 'southbound',
    'جنوباً': 'southbound',
    'جنوبا': 'southbound',
    'الجنوب': 'southbound',
    'جنوبي': 'southbound',
    'باتجاه الجنوب': 'southbound',
    // عربي — شرق
    'شرق': 'eastbound',
    'شرقاً': 'eastbound',
    'شرقا': 'eastbound',
    'الشرق': 'eastbound',
    'شرقي': 'eastbound',
    'باتجاه الشرق': 'eastbound',
    // عربي — غرب
    'غرب': 'westbound',
    'غرباً': 'westbound',
    'غربا': 'westbound',
    'الغرب': 'westbound',
    'غربي': 'westbound',
    'باتجاه الغرب': 'westbound',
    // عربي — الحلقات
    'الدائري الداخلي': 'inner-loop',
    'الحلقة الداخلية': 'inner-loop',
    'الدائري الخارجي': 'outer-loop',
    'الحلقة الخارجية': 'outer-loop',
    // عربي — لا ينطبق / مجهول
    'غير محدد': 'undefined',
    'غير محدَّد': 'undefined',
    'لا ينطبق': 'undefined',
    'مجهول': 'unknown',
    'غير معروف': 'unknown',
  };

  /**
   * القيم التي **تُرفض عمداً** ولها سبب مكتوب.
   *
   * «كلا الاتجاهين» ليست قيمة ناقصة في جدولنا: المواصفة لا تملك لها قيمة، وطريقها
   * في 4.2 حدثان مستقلان لكل اتجاه حدث. تحويلها إلى `undefined` يخفي إغلاقاً
   * يمسّ اتجاهين خلف قيمة تعني «لا اتجاه»، وهو أخطر ما يمكن أن يقرأه مستهلك.
   */
  var REFUSED = {
    'الاتجاهين': 'كلا الاتجاهين ليس قيمة في تعداد 4.2 — تُصدَّر حدثاً لكل اتجاه',
    'كلا الاتجاهين': 'كلا الاتجاهين ليس قيمة في تعداد 4.2 — تُصدَّر حدثاً لكل اتجاه',
    'الاتجاهان': 'كلا الاتجاهين ليس قيمة في تعداد 4.2 — تُصدَّر حدثاً لكل اتجاه',
    'both': 'كلا الاتجاهين ليس قيمة في تعداد 4.2 — تُصدَّر حدثاً لكل اتجاه',
    'two-way': 'كلا الاتجاهين ليس قيمة في تعداد 4.2 — تُصدَّر حدثاً لكل اتجاه',
  };

  /** يزيل التشكيل والمسافات الزائدة قبل البحث — لا يترجم. */
  function normalise(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/[ً-ٰٟ]/g, '')  // تشكيل
      .replace(/ـ/g, '')                  // تطويل
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * يحوّل قيمة اتجاه داخلية إلى قيمة `Direction.json`.
   *
   * لا يعيد نصّاً: يعيد نتيجةً تحمل سببها. الاستدعاء الذي يريد نصّاً فقط
   * سيتجاهل السبب ويكتب `unknown` بلا قصد — والنتيجة تمنعه.
   *
   * @param {string} value القيمة الداخلية.
   * @returns {{ok:boolean, value:(string|null), reason:string, input:string}}
   */
  function mapDirection(value) {
    var raw = typeof value === 'string' ? value : '';
    var key = normalise(raw);

    if (!key) {
      return { ok: false, value: null, input: raw,
        reason: 'الاتجاه فارغ — و`direction` حقل إلزامي في core_details' };
    }

    // قيمة معيارية وصلت كما هي: تمرّ بلا تحويل.
    if (WZDX_DIRECTIONS.indexOf(key) !== -1) {
      return { ok: true, value: key, input: raw, reason: 'قيمة معيارية أصلاً' };
    }

    var refused = REFUSED[key] || REFUSED[key.toLowerCase()];
    if (refused) {
      return { ok: false, value: null, input: raw, reason: refused };
    }

    var mapped = DIRECTION_MAP[key];
    if (mapped) {
      return { ok: true, value: mapped, input: raw, reason: 'محوَّل من الجدول' };
    }

    return {
      ok: false, value: null, input: raw,
      reason: 'قيمة اتجاه غير معروفة في جدول التحويل: «' + raw + '»',
    };
  }

  /**
   * `LocationMethod` — كيف عُرف موضع الحدث.
   *
   * الحقل إلزامي في 4.2، ويكشف شيئاً لا يظهر في الهندسة: هل الموقع مساحيّ أم
   * مستنتَج. أثر لا يمسح ميدانياً، فالقيمة الصادقة `other` مع هندسة الممر،
   * و`unknown` حين لا نعرف حتى من أين جاءت الهندسة.
   */
  var LOCATION_METHODS = ['channel-device-method', 'sign-method',
    'junction-method', 'other', 'unknown'];

  /**
   * @param {string} source كيف اشتُقّت الهندسة: 'corridor' | 'snapped' | 'unknown'
   * @returns {{ok:boolean, value:(string|null), reason:string}}
   */
  function mapLocationMethod(source) {
    if (source === 'corridor' || source === 'snapped' || source === 'permit') {
      return { ok: true, value: 'other',
        reason: 'الهندسة مشتقّة من شبكة الطرق لا من مسح موقعي — «other» أصدق '
          + 'من طريقة تدّعي جهازاً' };
    }
    if (source === 'unknown' || source === undefined || source === null) {
      return { ok: true, value: 'unknown', reason: 'مصدر الهندسة غير معروف' };
    }
    return { ok: false, value: null,
      reason: 'مصدر هندسة غير معروف في الجدول: «' + source + '»' };
  }

  /**
   * `VehicleImpact` من عدد المسارات المغلقة.
   *
   * منقول من المحرك إلى هنا كي تبقى **كل** ترجمة معيارية في ملف واحد يُفحص.
   * تفرّقها كان سبب بقاء الاتجاه بلا جدول أصلاً.
   */
  function mapVehicleImpact(lanes, lanesClosed) {
    if (!Number.isInteger(lanes) || lanes < 1) {
      return { ok: false, value: null, reason: 'عدد المسارات غير صالح' };
    }
    if (!Number.isInteger(lanesClosed) || lanesClosed < 0 || lanesClosed > lanes) {
      return { ok: false, value: null,
        reason: 'عدد المسارات المغلقة خارج المدى [0, ' + lanes + ']' };
    }
    if (lanesClosed === 0) {
      return { ok: true, value: 'all-lanes-open', reason: 'لا إغلاق' };
    }
    if (lanesClosed >= lanes) {
      return { ok: true, value: 'all-lanes-closed', reason: 'كل المسارات مغلقة' };
    }
    return { ok: true, value: 'some-lanes-closed', reason: 'إغلاق جزئي' };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    WZDX_DIRECTIONS: WZDX_DIRECTIONS,
    DIRECTION_MAP: DIRECTION_MAP,
    LOCATION_METHODS: LOCATION_METHODS,
    REFUSED_DIRECTIONS: REFUSED,
    normalise: normalise,
    mapDirection: mapDirection,
    mapLocationMethod: mapLocationMethod,
    mapVehicleImpact: mapVehicleImpact,
  };
});
