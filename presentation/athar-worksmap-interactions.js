/**
 * أثر — تفاعل خريطة الأعمال (بوب-أب التفاصيل)
 * ---------------------------------------------------------------------------
 * 1) popupHtml دالة نقية تُختبر في Node — بلا خريطة ولا DOM.
 * 2) كل قيمة تمر بترميز HTML؛ بيانات التصاريح نص لا شيفرة.
 * 3) النقر يقرأ طبقات الرموز والخطوط معاً — مقطع العمل قابل للنقر كنقطته.
 * 4) بلا تجميع فلا فرد تجميعات: كل رمز على الخريطة سجل واحد يفتح بطاقته.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./athar-worksmap-layers.js'),
      require('./athar-worksmap-solution.js')
    );
  } else {
    root.AtharWorksMapInteractions = factory(
      root.AtharWorksMapLayers,
      root.AtharWorksMapSolution
    );
  }
})(typeof self !== 'undefined' ? self : this, function (Layers, Solution) {
  'use strict';

  var GROUP_LABELS = {
    roadworks: 'أعمال طرق',
    closures: 'إغلاق',
    incidents: 'حادث',
    diversions: 'تحويلة',
    pois: 'نقطة اهتمام',
  };

  var SEVERITY_LABELS = { 3: 'أثر عالٍ', 2: 'أثر متوسط', 1: 'أثر منخفض' };

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  function formatDate(ms) {
    var value = Number(ms);
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium' }).format(new Date(value));
    } catch (err) {
      return new Date(value).toISOString().slice(0, 10);
    }
  }

  function layerIds(suffix) {
    var ids = [];
    (Layers.LAYER_GROUPS || []).forEach(function (group) {
      group.configs.forEach(function (config) { ids.push(config.name + suffix); });
    });
    return ids;
  }

  /** بطاقة التفاصيل. نقية: تأخذ خصائص الميزة وتعيد نصاً. */
  function popupHtml(properties, extra) {
    var p = properties || {};
    var group = GROUP_LABELS[p.group] || 'سجل';
    var severity = SEVERITY_LABELS[Number(p.severity)];

    return '<article class="works-popup">'
      + '<p class="works-popup-kicker">' + escapeHtml(group)
      + (severity ? ' · ' + escapeHtml(severity) : '') + '</p>'
      + '<h3>' + escapeHtml(p.title) + '</h3>'
      + (p.description ? '<p>' + escapeHtml(p.description) + '</p>' : '')
      + '<dl>'
      + (p.street ? '<dt>الشارع</dt><dd>' + escapeHtml(p.street) + '</dd>' : '')
      + '<dt>من</dt><dd>' + escapeHtml(formatDate(p.start_ts)) + '</dd>'
      + '<dt>إلى</dt><dd>' + escapeHtml(formatDate(p.end_ts)) + '</dd>'
      + '<dt>الجهة</dt><dd>' + escapeHtml(p.promoter || '—') + '</dd>'
      + '<dt>المقاول</dt><dd>' + escapeHtml(p.contractor || '—') + '</dd>'
      // رقم التصريح هو المرجع المنشور: به يراجع الساكن البلدية، وبه يُسمّى ملف
      // القرار المُنزَّل من مكتب المراجع. `id` مفتاح مخزنٍ داخلي يبقى للربط
      // والتحديد، ولا يُقدَّم لأحد بوصفه رقماً يُحتجّ به.
      + '<dt>المرجع</dt><dd>' + escapeHtml(p.permitRef || p.id || '—') + '</dd>'
      + '</dl>'
      /**
       * الحل بعد التعريف مباشرة، داخل البطاقة نفسها.
       * ---------------------------------------------------------------------
       * البطاقة كانت تنتهي عند «من ومتى وأين» — تعريفاً. والمنتج كله مبنيٌّ على
       * أن لكل تصريح نافذةً أقل أثراً، محسوبةً ومكتوبةً مع البيانات. فتحويلها
       * إلى سطرين هنا هو ما يجعل الخريطة تعرض قراراً لا أرقاماً عن مشكلة.
       * الوحدة اختيارية: صفحة لا تحمّلها تبقى بطاقتها صحيحة ناقصةً كتلة.
       */
      + (Solution ? Solution.solutionHtml(p) : '')
      // كتلة إضافية تُحقن من الصفحة: المسار البديل يحتاج رسم المدينة وحساباً،
      // وكلاهما خارج مسؤولية بطاقةٍ نقية تُختبر في Node.
      + (extra || '')
      + '</article>';
  }

  /**
   * @param {object} map خريطة MapLibre
   * @param {object} maplibre الوحدة نفسها (للـ Popup)
   * @param {object} [options] {decorate(feature) → نصٌّ يُذيَّل به البطاقة}
   */
  function install(map, maplibre, options) {
    var opts = options || {};
    var clickable = layerIds('-symbols').concat(layerIds('-lines'));

    clickable.forEach(function (layerId) {
      map.on('mouseenter', layerId, function () {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, function () {
        map.getCanvas().style.cursor = '';
      });
    });

    map.on('click', function (event) {
      var available = clickable.filter(function (id) { return map.getLayer(id); });
      if (!available.length) return;
      var feature = map.queryRenderedFeatures(event.point, { layers: available })[0];
      if (!feature) return;
      new maplibre.Popup({ closeButton: true, maxWidth: '320px' })
        .setLngLat(event.lngLat)
        .setHTML(popupHtml(feature.properties, opts.decorate ? opts.decorate(feature) : ''))
        .addTo(map);
    });
  }

  return { popupHtml: popupHtml, install: install, GROUP_LABELS: GROUP_LABELS };
});
