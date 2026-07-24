/**
 * أثر — مصنع طبقات الأعمال (نمط one.network)
 * ---------------------------------------------------------------------------
 * 1) كل نوع بيانات = ثلاثية casing/line/symbol — نفس اصطلاح one.network حرفياً.
 * 2) كل طبقة مقيدة بمجموعتها؛ بلا هذا القيد ترسم كل طبقة كل الميزات.
 * 3) الخطوط متقطعة بفجوات أوسع من الشرطة — يبقى الإسفلت مقروءاً تحتها.
 * 4) الحاشية بيضاء تحت كل خط متقطع؛ الداكنة تظهر من كل فجوة وتبدو منقّطة.
 * 5) نمط الشرطات يشتد تحت z15 — بلا ذلك يتفكك إلى نقاط متناثرة.
 * 6) عرض الخط يتدرج مع التقريب فيغطي عرض الشارع لا خيطاً فوقه.
 * 7) التجميع لنقاط فقط؛ supercluster يُسقط كل ما ليس Point.
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
    info: '#1971c2',
    poi: '#2f9e44',
    poiCasing: '#ffffff',
    dashCasing: '#ffffff',
    clusterSmall: '#f0a020',
    clusterMedium: '#f76707',
    clusterLarge: '#e03131',
    clusterText: '#ffffff',
  };

  var SIZES = { iconSize: 0.8, clusterSmall: 15, clusterMedium: 20, clusterLarge: 26 };

  // أعرض قليلاً من الشارع نفسه: المقطع يجب أن «يبتلع» الإسفلت لا أن يعلوه كخيط.
  var LINE_WIDTH = [
    'interpolate', ['exponential', 1.5], ['zoom'],
    10, 2.8, 13, 5.6, 15, 8.5, 17, 13, 20, 28,
  ];

  var CASING_WIDTH = [
    'interpolate', ['exponential', 1.5], ['zoom'],
    10, 4.4, 13, 8.4, 15, 12.5, 17, 18, 20, 38,
  ];

  var DASH_PATTERN = [1.6, 2.2];
  var DASH_PATTERN_ROUTE = [2, 2];

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
  var NOT_CLUSTER = ['!', ['has', 'point_count']];

  function matchFilter(config) {
    var parts = [['==', ['get', 'group'], config.group]];
    if (config.subtype) parts.push(['==', ['get', 'subtype'], config.subtype]);
    if (config.excludeSubtype) parts.push(['!=', ['get', 'subtype'], config.excludeSubtype]);
    return parts;
  }

  function buildTriple(config) {
    var scale = config.widthScale || 1;
    var lineWidth = scale === 1 ? LINE_WIDTH : scaleWidth(LINE_WIDTH, scale);
    var casingWidth = scale === 1 ? CASING_WIDTH : scaleWidth(CASING_WIDTH, scale);
    var dash = dashByZoom(config.dashPattern || DASH_PATTERN);
    var match = matchFilter(config);
    var lineFilter = ['all', LINE_ONLY].concat(match);
    var symbolFilter = ['all', NOT_CLUSTER].concat(match);
    var lineSource = config.lineSource || config.source;

    var casing = {
      id: config.name + '-lines-casing', type: 'line', source: lineSource,
      filter: lineFilter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': config.casingColor,
        'line-width': casingWidth,
        'line-opacity': 0.9,
      },
    };

    var line = {
      id: config.name + '-lines', type: 'line', source: lineSource,
      filter: lineFilter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': config.lineColor,
        'line-width': lineWidth,
        'line-dasharray': dash,
      },
    };

    var symbol = {
      id: config.name + '-symbols', type: 'symbol', source: config.source,
      filter: symbolFilter,
      layout: {
        'icon-image': config.iconImage,
        'icon-size': SIZES.iconSize,
        'icon-allow-overlap': true,
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
    {
      id: 'diversions', label: 'مسارات التحويل والحافلات', swatch: WORKS_COLORS.diversion,
      configs: [
        {
          name: 'diversion-routes', group: 'diversions', excludeSubtype: 'bus',
          lineColor: WORKS_COLORS.diversion, casingColor: WORKS_COLORS.dashCasing,
          iconImage: 'diversion', dashPattern: DASH_PATTERN_ROUTE, widthScale: 0.7,
        },
        {
          name: 'bus-routes', group: 'diversions', subtype: 'bus',
          lineColor: WORKS_COLORS.info, casingColor: WORKS_COLORS.dashCasing,
          iconImage: 'bus-stop', dashPattern: DASH_PATTERN_ROUTE, widthScale: 0.55, minzoom: 11,
        },
      ],
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

  var CLUSTER_OPTIONS = {
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 14,
    clusterMinPoints: 2,
    clusterProperties: { max_severity: ['max', ['to-number', ['get', 'severity'], 0]] },
  };

  function buildClusterLayers(source) {
    return [
      {
        id: source + '-clusters', type: 'circle', source: source, filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            WORKS_COLORS.clusterSmall, 10, WORKS_COLORS.clusterMedium, 50, WORKS_COLORS.clusterLarge,
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            SIZES.clusterSmall, 10, SIZES.clusterMedium, 50, SIZES.clusterLarge,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      },
      {
        id: source + '-cluster-count', type: 'symbol', source: source, filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': WORKS_COLORS.clusterText },
      },
    ];
  }

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
    buildClusterLayers: buildClusterLayers,
    CLUSTER_OPTIONS: CLUSTER_OPTIONS,
    baseFilters: baseFilters,
    buildDateFilter: buildDateFilter,
    composeFilter: composeFilter,
  };
});
