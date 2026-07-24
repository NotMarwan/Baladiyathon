/**
 * أثر — الخريطة الأساسية الفاتحة (بلا بلاط، بلا خوادم خارجية)
 * ---------------------------------------------------------------------------
 * 1) style JSON مكتوب يدوياً — نملك كل لون وعرض عند كل مستوى تكبير.
 * 2) أرضية فاتحة هادئة — الخريطة تقرأ كمستند حكومي رسمي لا كلوحة عرض.
 * 3) تدرّج الطرق بالعرض لا بالصخب: شرياني كريمي ← رئيسي أبيض ← فرعي أرفع.
 * 4) حافة رمادية تحت كل طريق — العمق من الطبقتين لا من الظل.
 * 5) الخطوط والأيقونات محلية تحت vendor/ — صفر طلبات وقت التشغيل.
 * 6) أسماء الطرق طبقة symbol حقيقية، فتشكيل العربية من إضافة RTL.
 * 7) المياه والمساحات الخضراء من data/riyadh-base.geojson.
 * 8) الدالة نقية تماماً — تُختبر في Node بلا متصفح.
 *
 * بيانات الطرق والمعالم © مساهمو OpenStreetMap — رخصة ODbL.
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharWorksMapStyle = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BASE_COLORS = {
    stage: '#f3f2ef',
    water: '#c3dcf0',
    green: '#dde9d2',
    road: '#ffffff',
    roadMajor: '#fdf6e3',
    casing: '#e2e0db',
    label: '#5b5b60',
    labelHalo: '#ffffff',
    placeLabel: '#3b3b40',
  };

  var MAJOR = ['motorway', 'motorway_link', 'trunk', 'trunk_link'];
  var PRIMARY = ['primary', 'primary_link', 'secondary', 'secondary_link'];

  /** عرض الطريق: يكبر مع التقريب ويتدرج مع التصنيف. scale يوسّع الحافة. */
  function roadWidth(scale) {
    function byClass(major, primary, minor) {
      return [
        'match', ['get', 'highway'],
        MAJOR, major * scale,
        PRIMARY, primary * scale,
        minor * scale,
      ];
    }
    return [
      'interpolate', ['exponential', 1.6], ['zoom'],
      10, byClass(1.6, 1, 0.5),
      13, byClass(4.5, 2.6, 1.2),
      15, byClass(11, 7, 3.4),
      18, byClass(30, 20, 11),
    ];
  }

  function buildStyle(roads, base, options) {
    var opts = options || {};
    return {
      version: 8,
      glyphs: opts.glyphsUrl,
      sprite: opts.spriteUrl,
      sources: {
        roads: { type: 'geojson', data: roads },
        base: { type: 'geojson', data: base },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': BASE_COLORS.stage } },
        {
          id: 'base-green', type: 'fill', source: 'base',
          filter: ['==', ['get', 'kind'], 'green'],
          paint: { 'fill-color': BASE_COLORS.green },
        },
        {
          id: 'base-water', type: 'fill', source: 'base',
          filter: ['==', ['get', 'kind'], 'water'],
          paint: { 'fill-color': BASE_COLORS.water },
        },
        {
          id: 'roads-casing', type: 'line', source: 'roads',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': BASE_COLORS.casing, 'line-width': roadWidth(1.35) },
        },
        {
          id: 'roads', type: 'line', source: 'roads',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': [
              'match', ['get', 'highway'],
              MAJOR, BASE_COLORS.roadMajor,
              PRIMARY, BASE_COLORS.roadMajor,
              BASE_COLORS.road,
            ],
            'line-width': roadWidth(1),
          },
        },
        {
          id: 'road-labels', type: 'symbol', source: 'roads', minzoom: 13,
          filter: ['all', ['has', 'name'], ['!=', ['get', 'name'], '']],
          layout: {
            'symbol-placement': 'line',
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 11,
            'text-max-angle': 30,
          },
          paint: {
            'text-color': BASE_COLORS.label,
            'text-halo-color': BASE_COLORS.labelHalo,
            'text-halo-width': 1.4,
          },
        },
        {
          id: 'place-labels', type: 'symbol', source: 'base',
          filter: ['==', ['get', 'kind'], 'place'],
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 15, 14],
          },
          paint: {
            'text-color': BASE_COLORS.placeLabel,
            'text-halo-color': BASE_COLORS.labelHalo,
            'text-halo-width': 1.6,
          },
        },
      ],
    };
  }

  return { BASE_COLORS: BASE_COLORS, roadWidth: roadWidth, buildStyle: buildStyle };
});
