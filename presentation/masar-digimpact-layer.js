/**
 * مسار — طبقة أثر الحفر على الخريطة
 * ---------------------------------------------------------------------------
 * ترسم هالةً ملوّنة **تحت** خطوط الأعمال المتقطّعة لا فوقها: الشرطة الكهرمانية
 * تبقى تقول «هنا عمل»، والهالة تحتها تقول «وهذا ما يفعله بالحركة». وضعُها فوق
 * الخطوط يمحو رمز العمل ويحوّل الخريطة إلى لوحة حرارة بلا معنى تشغيلي.
 *
 * الهالة عريضة ومموّهة عمداً: هي كمّيةُ **أثرٍ** لا حدُّ **موقع**. الحدّ الحادّ
 * يُقرأ «هذا هو المقطع المغلق بالضبط» — وذاك دور خط العمل نفسه.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./masar-digimpact.js'));
  } else {
    root.MasarDigImpactLayer = factory(root.MasarDigImpact);
  }
})(typeof self !== 'undefined' ? self : this, function (DigImpact) {
  'use strict';

  var SOURCE_ID = DigImpact.SOURCE_ID;
  var LAYER_ID = DigImpact.LAYER_ID;

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  /** اللون من النطاقات نفسها — لا لوحة ثانية تنحرف عنها. */
  function colorExpression() {
    var expression = ['match', ['get', 'dig_band']];
    DigImpact.BANDS.forEach(function (band) { expression.push(band.id, band.color); });
    expression.push(DigImpact.BANDS[0].color);
    return expression;
  }

  /**
   * العرض يتبع شدّة الأثر لا التقريب وحده.
   * مقطعٌ يضاعف الزمن مرّتين يستحق هالةً أعرض من مقطعٍ يزيده عُشراً — فتُقرأ
   * الشدّة من الحجم قبل أن تُقرأ من اللون، وهو ما تلتقطه العين أولاً.
   */
  function widthExpression() {
    return [
      'interpolate', ['linear'], ['zoom'],
      10, ['interpolate', ['linear'], ['get', 'dig_factor'], 1, 4, 2.5, 12],
      14, ['interpolate', ['linear'], ['get', 'dig_factor'], 1, 9, 2.5, 26],
      18, ['interpolate', ['linear'], ['get', 'dig_factor'], 1, 20, 2.5, 56],
    ];
  }

  function buildLayer(sourceId) {
    return {
      id: LAYER_ID,
      type: 'line',
      source: sourceId || SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': colorExpression(),
        'line-width': widthExpression(),
        'line-opacity': 0.42,
        'line-blur': 5,
      },
    };
  }

  function formatHour(hour) {
    var value = ((Math.round(hour) % 24) + 24) % 24;
    return (value < 10 ? '0' : '') + value + ':00';
  }

  function toggleHtml() {
    return '<label class="masar-map-toggle">'
      + '<input type="checkbox" data-digimpact="1" />'
      + '<span class="masar-map-swatch" style="background:'
      + escapeHtml(DigImpact.BANDS[DigImpact.BANDS.length - 1].color) + '"></span>'
      + '<span>' + escapeHtml(DigImpact.GROUP_LABEL) + '</span>'
      + '</label>';
  }

  function legendHtml(summary, hour) {
    var rows = DigImpact.BANDS.map(function (band) {
      var count = summary && summary.byBand ? summary.byBand[band.id] : null;
      return '<div class="wm-legend-row">'
        + '<span class="wm-legend-line wm-legend-solid" style="color:'
        + escapeHtml(band.color) + ';border-top-width:5px"></span>'
        + '<span>' + escapeHtml(band.label)
        + (count === null || count === undefined
          ? ''
          : ' <span class="tl-count">(' + escapeHtml(count) + ')</span>')
        + '</span></div>';
    }).join('');

    return '<div class="wm-legend-split">' + escapeHtml(DigImpact.GROUP_LABEL)
      + ' — الساعة ' + escapeHtml(formatHour(hour)) + '</div>'
      + rows
      + '<p class="tl-note">مضاعف زمن العبور عبر مقطع العمل: زمنُه أثناء الإغلاق '
      + 'مقسوماً على زمنه بلا إغلاق، بدالة BPR نفسها التي يستعملها المحرك. '
      + 'يتغيّر بالساعة لأن الطلب يتغيّر — والإغلاق نفسه ليلاً أخفّ أثراً منه '
      + 'في الذروة، وهذه هي التوصية التي يبنيها المنتج.</p>';
  }

  /** كتلة الأثر في بطاقة السجل — تُذيَّل ببطاقة العمل القائمة. */
  function popupHtml(impact) {
    if (!impact) return '';
    var band = DigImpact.bandOf(impact.factor);
    return '<section class="tl-popup">'
      + '<h4>أثر هذا العمل على الحركة — الساعة '
      + escapeHtml(formatHour(impact.hour)) + '</h4>'
      + '<p class="tl-headline">' + escapeHtml(impact.factor.toFixed(2))
      + '× <span>زمن العبور</span></p>'
      + '<p class="tl-state"><span class="tl-dot" style="background:'
      + escapeHtml(band.color) + '"></span>' + escapeHtml(band.label) + '</p>'
      + '<dl>'
      + '<dt>الحارات</dt><dd>' + escapeHtml(impact.lanesOpen) + ' مفتوحة من '
      + escapeHtml(impact.lanes) + '</dd>'
      + '<dt>الزمن المضاف</dt><dd>' + escapeHtml(impact.addedMinutes.toFixed(1))
      + ' دقيقة على المقطع</dd>'
      + '<dt>حجم/سعة</dt><dd>' + escapeHtml(impact.ratioBefore.toFixed(2))
      + ' ⟵ ' + escapeHtml(impact.ratioDuring.toFixed(2)) + '</dd>'
      + '</dl>'
      + '<p class="tl-basis">الزمن من دالة BPR في المحرك، وسعة الحارة داخل '
      + 'منطقة العمل من قياس ميداني معلن (1475 مركبة/ساعة/حارة). طول المقطع '
      + 'المرجعي افتراض عرضٍ معلن، فالدقائق المضافة نسبيةٌ لا مقيسة على هذا '
      + 'الشارع بعينه.</p>'
      + (impact.beyondScreening
        ? '<ul class="tl-caveats"><li>هذا المضاعف فوق حدّ الفحص السريع المعلن: '
          + 'الطلب تجاوز السعة، وBPR يتضخّم هناك. اقرأه <strong>مؤشّر خطورة '
          + 'يستدعي محاكاة متخصصة</strong> لا تقديراً دقيقاً لزمن الرحلة.</li></ul>'
        : '')
      + '</section>';
  }

  /**
   * يركّب المصدر والطبقة. الطبقة تُدرَج قبل أول طبقة خطوط أعمال كي تبقى
   * الشرطة فوق الهالة.
   */
  function install(map, getWorks, options) {
    var opts = options || {};
    var hour = Number.isFinite(opts.hour) ? opts.hour : 18;
    var visible = false;
    var installed = false;
    var lastError = null;

    function currentWorks() {
      var works = typeof getWorks === 'function' ? getWorks() : getWorks;
      return works && works.features ? works : { type: 'FeatureCollection', features: [] };
    }

    function rebuild() {
      var collection = DigImpact.buildCollection(currentWorks(), hour);
      var source = map.getSource(SOURCE_ID);
      if (source && source.setData) source.setData(collection);
      return collection;
    }

    function ensureLayer() {
      if (installed) return true;
      try {
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }
        if (!map.getLayer(LAYER_ID)) {
          var before = map.getLayer('roadworks-realtime-lines-casing')
            ? 'roadworks-realtime-lines-casing'
            : undefined;
          map.addLayer(buildLayer(SOURCE_ID), before);
        }
        installed = true;
        lastError = null;
      } catch (err) {
        installed = false;
        lastError = err;
      }
      return installed;
    }

    if (!ensureLayer() && typeof map.on === 'function') {
      map.on('styledata', function retry() {
        if (ensureLayer() && typeof map.off === 'function') map.off('styledata', retry);
      });
    }

    return {
      ensureLayer: ensureLayer,
      lastError: function () { return lastError; },
      hour: function () { return hour; },
      setVisible: function (nextVisible) {
        visible = !!nextVisible;
        if (!ensureLayer()) return null;
        var summary = null;
        if (visible) summary = DigImpact.summarize(rebuild());
        map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
        return summary;
      },
      setHour: function (nextHour) {
        var value = Number(nextHour);
        hour = Number.isFinite(value) ? ((Math.round(value) % 24) + 24) % 24 : hour;
        if (!visible || !ensureLayer()) return null;
        return DigImpact.summarize(rebuild());
      },
      refresh: function () {
        if (!visible || !ensureLayer()) return null;
        return DigImpact.summarize(rebuild());
      },
    };
  }

  return {
    SOURCE_ID: SOURCE_ID,
    LAYER_ID: LAYER_ID,
    colorExpression: colorExpression,
    widthExpression: widthExpression,
    buildLayer: buildLayer,
    formatHour: formatHour,
    toggleHtml: toggleHtml,
    legendHtml: legendHtml,
    popupHtml: popupHtml,
    install: install,
  };
});
