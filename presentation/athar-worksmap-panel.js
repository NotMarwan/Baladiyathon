/**
 * أثر — لوحة التحكم بالخريطة (الفترة الزمنية + إظهار الطبقات)
 * ---------------------------------------------------------------------------
 * 1) render نقية تُعيد HTML — تُختبر في Node بلا DOM.
 * 2) كل نص يمر بترميز HTML؛ العناوين بيانات لا شيفرة.
 * 3) الافتراضي «اليوم» — نفس سلوك one.network عند الفتح.
 * 4) الفترة تُحسب بتوقيت UTC فلا تتأرجح النتيجة مع منطقة المتصفح.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharWorksMapPanel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY_MS = 24 * 3600 * 1000;
  var PRESETS = [
    { value: 'today', label: 'اليوم' },
    { value: 'week', label: 'هذا الأسبوع' },
    { value: 'month', label: 'هذا الشهر' },
    { value: 'all', label: 'كل التواريخ' },
  ];
  var SPANS = { today: 1, week: 7, month: 30 };
  var DEFAULT_PRESET = 'today';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function toEpochRange(preset, nowMs) {
    if (preset === 'all') return null;
    var now = new Date(nowMs);
    var from = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return { from: from, to: from + (SPANS[preset] || 1) * DAY_MS };
  }

  function render(groups) {
    var options = PRESETS.map(function (preset) {
      var selected = preset.value === DEFAULT_PRESET ? ' selected' : '';
      return '<option value="' + preset.value + '"' + selected + '>'
        + escapeHtml(preset.label) + '</option>';
    }).join('');

    var toggles = groups.map(function (group) {
      return '<label class="athar-map-toggle">'
        + '<input type="checkbox" data-group="' + escapeHtml(group.id) + '" checked />'
        + '<span class="athar-map-swatch" style="background:' + escapeHtml(group.swatch) + '"></span>'
        + '<span>' + escapeHtml(group.label) + '</span>'
        + '</label>';
    }).join('');

    return '<label class="athar-map-field"><span>الفترة</span>'
      + '<select id="athar-date-preset">' + options + '</select></label>'
      + '<fieldset class="athar-map-field"><legend>الطبقات</legend>' + toggles + '</fieldset>';
  }

  /** groups اختيارية — تعود افتراضاً إلى سجل الطبقات المحمَّل في الصفحة. */
  function mount(root, api, nowMs, groups) {
    var scope = typeof self !== 'undefined' ? self : this;
    var list = groups || (scope.AtharWorksMapLayers && scope.AtharWorksMapLayers.LAYER_GROUPS) || [];
    root.innerHTML = render(list);

    var select = root.querySelector('#athar-date-preset');
    if (select) {
      select.addEventListener('change', function () {
        api.setDateRange(toEpochRange(select.value, nowMs));
      });
    }

    var boxes = root.querySelectorAll('input[data-group]');
    for (var i = 0; i < boxes.length; i += 1) {
      (function (box) {
        box.addEventListener('change', function () {
          api.toggleGroup(box.getAttribute('data-group'), box.checked);
        });
      })(boxes[i]);
    }

    api.setDateRange(toEpochRange(DEFAULT_PRESET, nowMs));
  }

  return { render: render, mount: mount, toEpochRange: toEpochRange, PRESETS: PRESETS };
});
