/**
 * مسار — مُصدِّر WZDx: من سجل تصريح داخلي إلى تغذية معيارية، أو إلى رفضٍ مُعلَّل.
 * ---------------------------------------------------------------------------
 * **لماذا طبقة بين المحفظة والمحرك.**
 *
 * `MasarEngine.wzdx` يبني البنية ويحرس التعدادات، ولا يعرف شيئاً عن العربية
 * ولا عن هندسة ناقصة ولا عن محفظة. وسجل التصريح يصل بالعربية وقد تكون هندسته
 * نقطة. فبينهما عملٌ اسمه **التحويل والرفض**، وهو ما يفعله هذا الملف:
 *
 *   · يحوّل الاتجاه عبر `MasarWzdxMapping` — أو يرفض التصريح باسمه وسببه.
 *   · يطلب هندسة خطية، ويقبل هندسة مُسنَدة من شبكة الطرق إن مرّرها المستدعي،
 *     ولا يخترع واحدة أبداً.
 *   · يبقي أعلام التحقق الأربعة على `false` ما لم يصل دليل صريح.
 *   · يعيد **تقريراً** لا ملفاً: ما نجح، وما مُنع، ولماذا.
 *
 * **ولماذا لا يرمي استثناءً.**
 *
 * لأن المستدعي الأول محفظةٌ من مئة وخمسين. استثناءٌ واحد يوقف التصدير كلّه،
 * فيبدو نظامٌ ينجح في 134 حالة كأنه لا ينتج شيئاً. النتيجة المُعلَّلة تسمح
 * بتصدير ما يصحّ ومنع ما لا يصحّ في المرور نفسه.
 *
 * UMD.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./masar-engine.js'),
      require('./masar-wzdx-mapping.js'));
  } else {
    root.MasarWzdxExport = factory(root.MasarEngine, root.MasarWzdxMapping);
  }
})(typeof self !== 'undefined' ? self : this, function (Engine, Mapping) {
  'use strict';

  /** تصنيفات نتيجة التصدير — نصوص التقرير تُقرأ منها لا تُكتب في موضعين. */
  var OUTCOME = {
    PASSED: 'نجح أمام المخطط الرسمي',
    DIRECTION: 'فشل بسبب الاتجاه',
    GEOMETRY: 'فشل بسبب الهندسة',
    REQUIRED: 'فشل بسبب حقل إلزامي',
    SOURCE: 'غير قابل للنشر بسبب نقص بيانات المصدر',
    ERROR: 'تعذّر التحقق بسبب عطل تقني',
  };

  /**
   * يستخرج الهندسة الصالحة للتصدير.
   *
   * ثلاثة مصادر بترتيب أفضلية معلن، ولا رابع:
   *   1. هندسة خطية وصلت مع التصريح.
   *   2. هندسة مُسنَدة إلى مقطع شبكة حقيقي مرّرها المستدعي (`resolution`).
   *   3. لا شيء — ويُرفض.
   */
  function geometryFor(feature, resolution) {
    var geometry = feature && feature.geometry;

    if (geometry && geometry.type === 'LineString'
      && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
      return {
        ok: true,
        coordinates: geometry.coordinates,
        source: 'permit',
        note: 'هندسة خطية وصلت مع التصريح',
      };
    }

    if (resolution && resolution.resolved && Array.isArray(resolution.coordinates)
      && resolution.coordinates.length >= 2) {
      return {
        ok: true,
        coordinates: resolution.coordinates,
        source: 'snapped',
        note: 'هندسة مقطع شبكة مُسنَد — ' + (resolution.reason || ''),
        evidence: resolution.evidence || null,
      };
    }

    if (geometry && geometry.type === 'Point') {
      /* التمييز مهم لأنه يوجّه الطلب: «نقص هندسة» يُصلَح بإحداثيات أدقّ من
         الجهة، و«نقص امتداد» يُصلَح بحقل طول موقع العمل. الحالتان تبدوان
         واحدة على الشاشة إن لم يُفصلا، فتُطلب البيانات الخطأ. */
      var code = resolution && resolution.code;
      return {
        ok: false,
        outcome: code === 'segment-too-long' ? OUTCOME.SOURCE : OUTCOME.GEOMETRY,
        reason: (resolution && resolution.blockReason)
          || 'هندسة نقطية بلا إسناد إلى مقطع شبكة — WZDx لا يقبل Point للحدث',
      };
    }

    return {
      ok: false,
      outcome: OUTCOME.GEOMETRY,
      reason: 'لا هندسة صالحة: المطلوب LineString بنقطتين فأكثر',
    };
  }

  /** الحقول الإلزامية التي يقرؤها المُصدِّر من سجل التصريح. */
  var REQUIRED_KEYS = [
    { key: 'permitRef', label: 'رقم التصريح' },
    { key: 'street', label: 'اسم الشارع' },
    { key: 'lanes', label: 'عدد المسارات' },
    { key: 'lanesClosed', label: 'عدد المسارات المغلقة' },
    { key: 'start', label: 'بداية النافذة' },
    { key: 'windowHours', label: 'طول النافذة' },
  ];

  function missingRequired(properties) {
    var missing = [];
    REQUIRED_KEYS.forEach(function (field) {
      var value = properties[field.key];
      if (value === undefined || value === null || value === '') {
        missing.push(field.label + ' (' + field.key + ')');
      }
    });
    return missing;
  }

  /**
   * يبني تغذية WZDx لتصريح واحد.
   *
   * @param {object} feature ميزة GeoJSON من المحفظة.
   * @param {object} [options] `{ resolution, windows, dataSourceId, publisher }`
   * @returns {{ok:boolean, outcome:string, feed:(object|null), blockers:string[],
   *            notes:string[], direction:object, geometry:object}}
   */
  function buildFeed(feature, options) {
    var settings = options || {};
    var properties = (feature && feature.properties) || {};
    var blockers = [];
    var notes = [];

    var missing = missingRequired(properties);
    if (missing.length) {
      return {
        ok: false, outcome: OUTCOME.REQUIRED, feed: null,
        blockers: ['حقول إلزامية مفقودة: ' + missing.join('، ')],
        notes: notes, direction: null, geometry: null,
      };
    }

    var direction = Mapping.mapDirection(properties.direction);
    if (!direction.ok) blockers.push('الاتجاه: ' + direction.reason);

    var geometry = geometryFor(feature, settings.resolution);
    if (!geometry.ok) blockers.push('الهندسة: ' + geometry.reason);

    if (blockers.length) {
      return {
        ok: false,
        /* أولوية السبب حين يجتمع سببان: الاتجاه أولاً لأنه يُصلَح بجدول عندنا،
           والهندسة تحتاج بيانات من الجهة. الترتيب يوجّه العمل لا يخفي شيئاً —
           `blockers` تحمل الاثنين. */
        outcome: !direction.ok ? OUTCOME.DIRECTION : geometry.outcome,
        feed: null, blockers: blockers, notes: notes,
        direction: direction, geometry: geometry,
      };
    }

    notes.push('مصدر الهندسة: ' + geometry.note);
    if (geometry.source === 'snapped') {
      notes.push('الهندسة مشتقّة من شبكة الطرق ولم تُقَس ميدانياً — '
        + 'أعلام تحقق الموضع تبقى false.');
    }

    var locationMethod = Mapping.mapLocationMethod(geometry.source);
    if (!locationMethod.ok) {
      return {
        ok: false, outcome: OUTCOME.SOURCE, feed: null,
        blockers: ['طريقة تحديد الموقع: ' + locationMethod.reason],
        notes: notes, direction: direction, geometry: geometry,
      };
    }
    notes.push('location_method = ' + locationMethod.value + ' — ' + locationMethod.reason);

    var feed;
    try {
      feed = Engine.wzdx({
        id: properties.permitRef,
        roadName: properties.street,
        direction: direction.value,
        lanes: properties.lanes,
        lanesClosed: properties.lanesClosed,
        startISO: properties.start,
        durationHours: properties.windowHours,
        coordinates: geometry.coordinates,
        windows: settings.windows,
        locationMethod: locationMethod.value,
        dataSourceId: settings.dataSourceId || 'masar-reviewer-desk',
        publisher: settings.publisher,
        organizationName: settings.organizationName,
        /* الأعلام الأربعة لا تُمرَّر إلا بدليل صريح من المستدعي. غيابها يعني
           `false` — وهو الصدق: التواريخ مقترحة والمواقع مشتقّة. */
        startDateVerified: settings.startDateVerified,
        endDateVerified: settings.endDateVerified,
        startPositionVerified: settings.startPositionVerified,
        endPositionVerified: settings.endPositionVerified,
      });
    } catch (error) {
      return {
        ok: false, outcome: OUTCOME.ERROR, feed: null,
        blockers: ['المحرك رفض المُدخل: ' + error.message],
        notes: notes, direction: direction, geometry: geometry,
      };
    }

    return {
      ok: true, outcome: OUTCOME.PASSED, feed: feed,
      blockers: [], notes: notes, direction: direction, geometry: geometry,
    };
  }

  return {
    OUTCOME: OUTCOME,
    buildFeed: buildFeed,
    geometryFor: geometryFor,
    missingRequired: missingRequired,
  };
});
