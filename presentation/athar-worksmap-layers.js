/**
 * أثر — مصنع طبقات الأعمال (نمط one.network)
 * ---------------------------------------------------------------------------
 * 1) كل نوع بيانات = ثلاثية casing/line/symbol — نفس اصطلاح one.network حرفياً.
 * 2) كل طبقة مقيدة بمجموعتها؛ بلا هذا القيد ترسم كل طبقة كل الميزات.
 * 3) الخطوط متقطعة بفجوات أوسع من الشرطة — يبقى الإسفلت مقروءاً تحتها.
 * 4) الحاشية بيضاء تحت كل خط متقطع؛ الداكنة تظهر من كل فجوة وتبدو منقّطة.
 * 5) نمط الشرطات يشتد تحت z15 — بلا ذلك يتفكك إلى نقاط متناثرة.
 * 6) عرض الخط يتدرج مع التقريب فيغطي عرض الشارع لا خيطاً فوقه.
 * 7) الرمز يتبع نوع العمل واللون يتبع المجموعة — لا رمز احتياطي غير مقصود.
 * 8) baseFilters يحفظ شرط المجموعة كي لا يمحوه setFilter عند الفلترة الزمنية.
 * 9) كل الدوال نقية — تُختبر في Node بلا متصفح.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharWorksMapLayers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WORKS_COLORS = {
    roadworks: '#f0a020',
    emergency: '#e03131',
    closure: '#c92a2a',
    incident: '#f76707',
    diversion: '#1c7ed6',
    // لون `poi-information.svg` — الرمز الاحتياطي لنوعٍ لم يُعرَّف بعد. لا طبقة
    // تستعمله اليوم، ويبقى في اللوحة كي لا ينزلق الأصل عن الطيف حين يُستعمل.
    info: '#1971c2',
    poi: '#2f9e44',
    poiCasing: '#ffffff',
    dashCasing: '#ffffff',
  };

  // لوحة الأيقونة 32 والشارة داخلها 26؛ 0.92 تضعها على الشاشة بـ ~24px —
  // تُقرأ بنظرة ولا تبتلع الشارع تحتها.
  /**
   * حجم الشارة يتبع التقريب.
   * ---------------------------------------------------------------------------
   * حجمٌ ثابت (0.92 ≈ 24 بكسل) يعني أن شارة المنع عند تقريب المدينة تغطي تقاطعاً
   * كاملاً بما فيه من شوارع وأسماء — ويقرؤها المستعمل بقعةً حمراء لا علامة.
   * وعند تقريب الشارع يعني العكس: شارةٌ صغيرة على تقاطعٍ واسع.
   *
   * فتصغر عند المدينة وتكبر عند الشارع، كما تفعل كل خريطة ملاحة.
   */
  var SIZES = {
    iconSize: [
      'interpolate', ['linear'], ['zoom'],
      10, 0.5, 13, 0.68, 15, 0.86, 18, 1,
    ],
  };

  /**
   * عرض المقطع المعلَّم.
   * ---------------------------------------------------------------------------
   * كان يبلغ 8.5 بكسل عند التقريب الخامس عشر وحاشيته 12.5 — والشارع الرئيسي
   * تحته 7. أي أن العلامة أعرض من الطريق الذي تعلّمه بالضعف تقريباً، فتبتلع
   * الإسفلت واسم الشارع معاً، ويُقرأ الخط طريقاً مستقلاً لا حالةً على طريق.
   *
   * القاعدة الآن: العلامة أرفع من الشارع دائماً، فيبقى لون الطريق ظاهراً على
   * جانبيها ويبقى اسمه مقروءاً. والحاشية تزيد 1.2 بكسل لا خمسة.
   *
   * (مرجع المقارنة: عرض `roads` عند z15 — شرياني 11، رئيسي 7، محلي 3.4.)
   */
  var LINE_WIDTH = [
    'interpolate', ['exponential', 1.4], ['zoom'],
    10, 1.6, 13, 2.4, 15, 3.2, 17, 4.2, 20, 6.5,
  ];

  var CASING_WIDTH = [
    'interpolate', ['exponential', 1.4], ['zoom'],
    10, 2.8, 13, 3.6, 15, 4.4, 17, 5.4, 20, 7.7,
  ];

  /**
   * الشرطة والفجوة بوحدة عرض الخط لا بالبكسل — هكذا يعرّفها مواصف الأسلوب.
   * عند عرضٍ 3.2 تعطي [2.6, 2.0] شرطةً بطول 8.3 بكسل وفجوةً 6.4: الطريق يظهر
   * بين الشرطات، والنمط يُقرأ «مقطعٌ معلَّم» لا «خطٌّ مصمت».
   */
  var DASH_PATTERN = [2.6, 2.0];
  var DASH_PATTERN_ROUTE = [2.2, 2.4];

  /**
    * line-dasharray خاصية cross-faded: تقبل step على التقريب لا interpolate.
    * الفجوة تبقى أوسع من الشرطة عند كل مستوى — بلا ذلك يُقرأ الخط سادّاً عند
    * التقريب البعيد ويضيع تمييز «هذا مقطع معلَّم» عن «هذا شارع».
    */
  function dashByZoom(pattern) {
    return [
      'step', ['zoom'],
      ['literal', [1.1, 1.3]],
      13, ['literal', [pattern[0] * 0.95, pattern[1] * 0.9]],
      15, ['literal', pattern],
    ];
  }

  function scaleWidth(expression, factor) {
    return expression.map(function (token, index) {
      var isStopValue = index >= 4 && index % 2 === 0 && typeof token === 'number';
      return isStopValue ? Number((token * factor).toFixed(2)) : token;
    });
  }

  var LINE_ONLY = ['==', ['geometry-type'], 'LineString'];

  function matchFilter(config) {
    var parts = [['==', ['get', 'group'], config.group]];
    if (config.subtype) parts.push(['==', ['get', 'subtype'], config.subtype]);
    return parts;
  }

  function buildTriple(config) {
    var scale = config.widthScale || 1;
    var lineWidth = scale === 1 ? LINE_WIDTH : scaleWidth(LINE_WIDTH, scale);
    var casingWidth = scale === 1 ? CASING_WIDTH : scaleWidth(CASING_WIDTH, scale);
    var dash = dashByZoom(config.dashPattern || DASH_PATTERN);
    var match = matchFilter(config);
    var lineFilter = ['all', LINE_ONLY].concat(match);
    // كان هنا `['!', ['has', 'point_count']]` — شرط استبعاد دوائر التجميع. مات
    // يوم صار المصدر `cluster: false`: لا ميزة تحمل point_count أصلاً، فالشرط
    // يُقيَّم على كل رمز في كل إطار ليعيد true دائماً.
    var symbolFilter = ['all'].concat(match);
    var lineSource = config.lineSource || config.source;

    var casing = {
      id: config.name + '-lines-casing', type: 'line', source: lineSource,
      filter: lineFilter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': config.casingColor,
        'line-width': casingWidth,
        // الحاشية أخفت من الخط: دورها الفصل لا الإعلان.
        'line-opacity': 0.55,
      },
    };

    var line = {
      id: config.name + '-lines', type: 'line', source: lineSource,
      filter: lineFilter,
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': config.lineColor,
        'line-width': lineWidth,
        'line-dasharray': dash,
        // شفافية خفيفة تُبقي الإسفلت واسم الشارع مقروءين من تحت العلامة.
        'line-opacity': 0.85,
      },
    };

    var symbol = {
      id: config.name + '-symbols', type: 'symbol', source: config.source,
      filter: symbolFilter,
      layout: {
        'icon-image': config.iconImage,
        'icon-size': SIZES.iconSize,
        /**
         * بلا تجميع، الازدحام يُحل بالتصادم لا بدائرة عدّاد: تحت z14 تختفي
         * الأيقونة المتصادمة وتبقى الأعلى شدة — الخريطة تبقى مقروءة والرمز
         * يبقى رمزاً. فوق z14 يتسع المكان فيُسمح بالتراكب ولا يُخفى سجل.
         * symbol-sort-key يقرر من يبقى: الأدنى قيمةً يُرسم أولاً ويفوز.
         */
        'icon-allow-overlap': ['step', ['zoom'], false, 14, true],
        'icon-padding': 3,
        'symbol-sort-key': ['-', 10, ['to-number', ['get', 'severity'], 0]],
      },
    };

    if (config.minzoom !== undefined) {
      casing.minzoom = config.minzoom;
      line.minzoom = config.minzoom;
      symbol.minzoom = config.minzoom;
    }

    return [casing, line, symbol];
  }

  /**
   * الرمز يحمل نوع العمل، والشارة تحمل المجموعة.
   * ---------------------------------------------------------------------------
   * `works-<subtype>` أو `poi-<subtype>`: نفس الرسم في المجموعتين بلونين —
   * المفتاح كهربائي في الطوارئ هنا وهناك، ويبقى الأخضر يقول «نقطة اهتمام»
   * والكهرماني يقول «أعمال طرق». بلا هذا كانت ٢٢ صيانةً و١٦ نقطةَ اهتمام تقع
   * كلها على رمز احتياطي واحد، فتُقرأ الخريطة نوعاً واحداً من العمل.
   * الاحتياطي يبقى مقصوداً لا مستوراً: `roadworks` (المخروط) هو رسم
   * `roadworks/default` عمداً، و`poi-information` رسم أي نوع لم يُعرَّف بعد.
   */
  var iconByType = function (prefix, fallback) {
    return ['coalesce', ['image', ['concat', prefix, ['get', 'subtype']]], ['image', fallback]];
  };

  var LAYER_GROUPS = [
    {
      id: 'roadworks', label: 'أعمال الطرق', swatch: WORKS_COLORS.roadworks,
      configs: [{
        name: 'roadworks-realtime', group: 'roadworks',
        lineColor: WORKS_COLORS.roadworks, casingColor: WORKS_COLORS.dashCasing,
        iconImage: iconByType('works-', 'roadworks'),
      }],
    },
    {
      id: 'closures', label: 'الإغلاقات والقيود', swatch: WORKS_COLORS.closure,
      configs: [{
        name: 'closures-restrictions-realtime', group: 'closures',
        lineColor: WORKS_COLORS.closure, casingColor: WORKS_COLORS.dashCasing,
        iconImage: 'closure',
      }],
    },
    {
      id: 'incidents', label: 'الحوادث', swatch: WORKS_COLORS.incident,
      configs: [{
        name: 'incidents-realtime', group: 'incidents',
        lineColor: WORKS_COLORS.incident, casingColor: WORKS_COLORS.dashCasing,
        iconImage: 'incident',
      }],
    },
    /**
     * تحويلات فقط — بلا شقّ حافلات.
     * -------------------------------------------------------------------------
     * كان هنا تقسيمٌ ثانٍ: `bus-routes` على `subtype: 'bus'`، ومعه
     * `excludeSubtype: 'bus'` على التحويلات. ولا سجل في المحفظة يحمل هذا النوع
     * — أنواعها الأربعة maintenance و development و emergency و default —
     * فالطبقة ترسم صفر ميزة، واللوحة مع ذلك تقول «والحافلات». وعدٌ بطبقةٍ لا
     * بيانات تحتها أسوأ من غيابها: الساكن يقرأ الصفر انقطاعاً في الخدمة لا
     * انقطاعاً في البيانات. حُذفت الطبقة وصُحّح العنوان؛ ويوم تصل بيانات نقل
     * عام حقيقية تُضاف الطبقة ومعها ما ترسمه.
     */
    {
      id: 'diversions', label: 'مسارات التحويل', swatch: WORKS_COLORS.diversion,
      configs: [{
        name: 'diversion-routes', group: 'diversions',
        lineColor: WORKS_COLORS.diversion, casingColor: WORKS_COLORS.dashCasing,
        iconImage: 'diversion', dashPattern: DASH_PATTERN_ROUTE, widthScale: 0.7,
      }],
    },
    {
      id: 'pois', label: 'نقاط الاهتمام', swatch: WORKS_COLORS.poi,
      configs: [{
        name: 'events-poi', group: 'pois',
        lineColor: WORKS_COLORS.poi, casingColor: WORKS_COLORS.poiCasing,
        iconImage: iconByType('poi-', 'poi-information'), minzoom: 11,
      }],
    },
  ];

  function buildWorksLayers(binding) {
    var out = [];
    LAYER_GROUPS.forEach(function (group) {
      group.configs.forEach(function (config) {
        var bound = Object.assign({}, config, {
          source: binding.points,
          lineSource: binding.lines || binding.points,
        });
        out = out.concat(buildTriple(bound));
      });
    });
    return out;
  }

  /**
   * مصدر النقاط بلا تجميع.
   * ---------------------------------------------------------------------------
   * دائرة العدّاد تقول «هنا سبعة» ولا تقول أيّ سبعة: تُخفي نوع العمل وشدته
   * خلف رقم. المحفظة ١٥٠ سجلاً — عددٌ ترسمه الخريطة رموزاً فعلية، فيقرأ
   * الساكن الطبقة من الشكل لا من الرقم. الازدحام يُدار بالتصادم في طبقة
   * الرموز (icon-allow-overlap) لا بدمج السجلات.
   */
  var POINT_SOURCE_OPTIONS = { cluster: false };

  function baseFilters() {
    var result = {};
    buildWorksLayers({ points: '__base__', lines: '__base__' }).forEach(function (layer) {
      result[layer.id] = layer.filter;
    });
    return result;
  }

  function buildDateFilter(range) {
    if (!range) return null;
    return [
      'all',
      ['<', ['get', 'start_ts'], range.to],
      ['>', ['get', 'end_ts'], range.from],
    ];
  }

  function composeFilter(base, extra) {
    if (!extra) return base;
    if (!base) return extra;
    var parts = base[0] === 'all' ? base.slice(1) : [base];
    return ['all'].concat(parts, [extra]);
  }

  return {
    WORKS_COLORS: WORKS_COLORS,
    LINE_WIDTH: LINE_WIDTH,
    CASING_WIDTH: CASING_WIDTH,
    DASH_PATTERN: DASH_PATTERN,
    dashByZoom: dashByZoom,
    LAYER_GROUPS: LAYER_GROUPS,
    buildTriple: buildTriple,
    buildWorksLayers: buildWorksLayers,
    POINT_SOURCE_OPTIONS: POINT_SOURCE_OPTIONS,
    baseFilters: baseFilters,
    buildDateFilter: buildDateFilter,
    composeFilter: composeFilter,
  };
});
