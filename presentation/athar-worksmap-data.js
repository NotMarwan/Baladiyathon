/**
 * أثر — تطبيع بيانات الأعمال إلى المخطط الذي ترسمه الطبقات
 * ---------------------------------------------------------------------------
 * 1) مخطط واحد يفصل الرسم عن مصدر البيانات — تغيير المصدر لا يمس الطبقات.
 * 2) impactLevel العربي يتحول إلى شدة رقمية تقود اللون وترتيب الرموز.
 * 3) الحالة تقرر المجموعة: مغلق ← إغلاقات، غير ذلك ← أعمال طرق.
 * 4) التواريخ إلى epoch — الفلترة الزمنية تقارن أرقاماً لا نصوصاً.
 * 5) الميزات بلا هندسة تُسقط بصمت بدل أن تُسقط الخريطة كلها.
 * 6) الفصل حسب الهندسة إجباري: التجميع يُسقط كل ما ليس Point.
 * 7) دوال نقية — تُختبر في Node.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharWorksMapData = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var IMPACT_SEVERITY = { high: 3, medium: 2, low: 1 };
  var IMPACT_SUBTYPE = { high: 'emergency', medium: 'development', low: 'default' };
  var CLOSED_STATUSES = ['مغلق', 'مغلقة', 'إغلاق كامل'];

  function text(value, fallback) {
    return typeof value === 'string' && value.length > 0 ? value : (fallback || '');
  }

  function epoch(value) {
    if (typeof value === 'number') return value;
    var parsed = typeof value === 'string' ? Date.parse(value) : NaN;
    return isNaN(parsed) ? 0 : parsed;
  }

  function groupOf(properties) {
    var status = text(properties.status);
    if (CLOSED_STATUSES.indexOf(status) !== -1) return 'closures';
    if (text(properties.group)) return text(properties.group);
    return 'roadworks';
  }

  function toCanonical(properties) {
    var impact = text(properties.impactLevel, 'low');
    var from = text(properties.from);
    var to = text(properties.to);
    var span = from && to ? from + ' ← ' + to : text(properties.description);

    return {
      id: text(properties.id, 'WORK-?'),
      group: groupOf(properties),
      subtype: text(properties.subtype, IMPACT_SUBTYPE[impact] || 'default'),
      title: text(properties.road, text(properties.title, 'أعمال طرق')),
      description: span,
      start_ts: epoch(properties.start || properties.start_ts),
      end_ts: epoch(properties.end || properties.end_ts),
      severity: IMPACT_SEVERITY[impact] || 0,
      promoter: text(properties.promoter),
      road: text(properties.road),
    };
  }

  function normalizeWorks(raw) {
    var source = raw || {};
    var input = Array.isArray(source.features) ? source.features : [];
    var features = [];

    for (var i = 0; i < input.length; i += 1) {
      var item = input[i];
      if (!item || !item.geometry) continue;
      features.push({
        type: 'Feature',
        geometry: item.geometry,
        properties: toCanonical(item.properties || {}),
      });
    }

    return { type: 'FeatureCollection', features: features };
  }

  function splitByGeometry(collection) {
    var points = { type: 'FeatureCollection', features: [] };
    var lines = { type: 'FeatureCollection', features: [] };

    (collection.features || []).forEach(function (feature) {
      var type = feature.geometry.type;
      if (type === 'Point' || type === 'MultiPoint') points.features.push(feature);
      else lines.features.push(feature);
    });

    return { points: points, lines: lines };
  }

  return { normalizeWorks: normalizeWorks, splitByGeometry: splitByGeometry };
});
