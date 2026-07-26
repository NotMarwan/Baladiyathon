/**
 * أثر — لوحة التحكم بالخريطة (الفترة الزمنية + إظهار الطبقات + قائمة السجلات)
 * ---------------------------------------------------------------------------
 * 1) render نقية تُعيد HTML — تُختبر في Node بلا DOM.
 * 2) كل نص يمر بترميز HTML؛ العناوين بيانات لا شيفرة.
 * 3) الافتراضي «اليوم» — نفس سلوك one.network عند الفتح.
 * 4) حدّ اليوم مثبَّت على توقيت الرياض (+٣) لا على منطقة المتصفح ولا على UTC.
 * 5) قائمة السجلات صفوف أزرار — كل سجل على الخريطة يُبلغ بلوحة المفاتيح.
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

  /**
   * حدّ اليوم بتوقيت الرياض، لا بتوقيت المتصفح ولا بـ UTC.
   * ---------------------------------------------------------------------------
   * الحساب كان `Date.UTC(...getUTCDate())`: ثابتٌ لا يتأرجح مع منطقة القارئ —
   * وتلك كانت النية وتبقى. لكن المدينة على +٣ بلا توقيت صيفي، فبين منتصف الليل
   * والثالثة فجراً بالرياض يكون التاريخ بـ UTC هو الأمس: «اليوم» يعرض نافذة
   * انتهت، والعامل الذي يخرج للعمل الليلي يقرأ خريطةً عن يومٍ مضى.
   * الإزاحة تُضاف قبل قراءة التاريخ وتُطرح بعده: المنتصف يبقى منتصفَ ليلٍ
   * *بالرياض* محسوباً بالمللي ثانية المطلقة، والنتيجة واحدة في أي متصفح.
   */
  var RIYADH_OFFSET_MS = 3 * 3600 * 1000;

  function toEpochRange(preset, nowMs) {
    if (preset === 'all') return null;
    var local = new Date(nowMs + RIYADH_OFFSET_MS);
    var midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    var from = midnight - RIYADH_OFFSET_MS;
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

  function groupOf(groups, id) {
    var list = groups || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /**
   * الدليل يُبنى من سجل الطبقات نفسه.
   * ---------------------------------------------------------------------------
   * كان الدليل أربعة صفوف مكتوبة بأيديها في الصفحة واللوحة خمس مجموعات: «نقاط
   * الاهتمام» تظهر على الخريطة بلونٍ لا يشرحه الدليل، فيقرأ الساكن أخضرَ لا
   * مفتاح له. ونصّان يوصفان شيئاً واحداً ينحرفان عند أول تعديل. الآن مصدر
   * واحد — كل مجموعة في `LAYER_GROUPS` صفٌّ في الدليل ومربعٌ في اللوحة معاً.
   */
  /**
   * صفوف المسارات المحسوبة.
   * ---------------------------------------------------------------------------
   * الدليل كان يشرح طبقات الخريطة الخمس ويسكت عن ثلاثة خطوط تظهر عند فتح سجل:
   * المقطع المغلق والبديلان. فيقرأ المستعمل أحمرَ مصمتاً وأزرقَ وسنجابياً بلا
   * مفتاح. وهي مرسومة مصمتة لا مخطّطة — فالصفّ يجب أن يقول ذلك بشكله لا بنصّه.
   *
   * تُقرأ من `AtharWorksMapSolution` نفسه حين يكون محمَّلاً، فلا ينحرف نصّان
   * يصفان شيئاً واحداً.
   */
  function routeLegendRows() {
    var Solution = typeof AtharWorksMapSolution !== 'undefined' ? AtharWorksMapSolution : null;
    if (!Solution || !Solution.ROUTE_COLORS) return '';
    var rows = [
      { kind: 'closed', label: 'المقطع المغلق (عند فتح سجل)' },
      { kind: 'first', label: 'المسار البديل الموصى به' },
      { kind: 'second', label: 'بديلٌ آخر مطروح' },
    ];
    return rows.map(function (row) {
      var rank = (Solution.ROUTE_RANK || {})[row.kind] || {};
      // العرض المعروض هو عرض التقريب السادس عشر — وسطُ ما يراه المستعمل.
      var width = rank.width ? rank.width[5] : 3;
      var opacity = typeof rank.opacity === 'number' ? rank.opacity : 1;
      // المغلق مشروطٌ على الخريطة، فيُشرَط في الدليل — وإلا وصف الدليل غير ما يُرى.
      var style = row.kind === 'closed' ? 'dashed' : 'solid';
      /**
       * الدليل يحمل الدرجتين معاً.
       * الخط على الخريطة حشوٌ وحاشيةٌ أغمق، وعيّنةٌ بلونٍ واحد تكذب على الدرجة
       * الفاتحة خاصةً: `#AEC9F5` وحده على بياضٍ يكاد لا يُرى، وهو على الخريطة
       * ظاهرٌ لأن حاشيته تحدّه. فالظلّ الخارجي بمقدار بكسل يقوم مقام الحاشية.
       */
      var casing = (Solution.ROUTE_CASING_COLORS || {})[row.kind];
      return '<div class="wm-legend-row">'
        + '<span class="wm-legend-line wm-legend-solid" style="color:'
        + escapeHtml(Solution.ROUTE_COLORS[row.kind])
        + ';border-top-width:' + width.toFixed(1) + 'px'
        + ';border-top-style:' + style
        + (casing ? ';box-shadow:0 0 0 1px ' + escapeHtml(casing) : '')
        + ';opacity:' + opacity + '"></span>'
        + '<span>' + escapeHtml(row.label) + '</span>'
        + '</div>';
    }).join('');
  }

  function renderLegend(groups) {
    var rows = (groups || []).map(function (group) {
      return '<div class="wm-legend-row">'
        + '<span class="wm-legend-line" style="color:' + escapeHtml(group.swatch) + '"></span>'
        + '<span>' + escapeHtml(group.label) + '</span>'
        + '</div>';
    }).join('');
    return '<h2>الدليل</h2>' + rows
      + '<div class="wm-legend-split">المسارات المحسوبة</div>'
      + routeLegendRows();
  }

  /**
   * قائمة السجلات المعروضة — الطريق الوحيد إلى السجل بلا فأرة.
   * ---------------------------------------------------------------------------
   * الخريطة كانت تُقدِّم ١٥٠ تصريحاً على رموزٍ لا يبلغها Tab: من لا يمسك فأرة
   * لا يفتح بطاقةَ سجلٍ واحد. والقائمة ليست عكازاً مخفياً للقارئ الصوتي — هي
   * ظاهرة لأنها مفيدة للعين أيضاً: نتائج البحث مقروءةً كنصّ، ومسحُ ما تحت
   * الفترة المختارة دون اصطياد رمزٍ بين رموز.
   * كل صف زرٌّ حقيقي: يأخذ التركيز، ويستجيب للمسافة والإدخال، ويعلن نفسه زراً.
   */
  function renderRecords(records, groups) {
    var list = records || [];
    if (!list.length) {
      return '<p class="wm-records-empty">لا سجل يطابق الفترة والطبقات والبحث المختار.</p>';
    }

    var rows = list.map(function (record) {
      var group = groupOf(groups, record.group);
      var swatch = group ? group.swatch : 'currentColor';
      var label = group ? group.label : 'سجل';
      var reference = record.permitRef || record.id || '';
      return '<li><button type="button" class="wm-record" data-id="'
        + escapeHtml(record.id || '') + '">'
        + '<span class="wm-record-dot" style="background:' + escapeHtml(swatch) + '"></span>'
        + '<span class="wm-record-body">'
        + '<span class="wm-record-title">' + escapeHtml(record.title || 'سجل بلا عنوان') + '</span>'
        + '<span class="wm-record-meta">' + escapeHtml(label)
        + (reference ? ' · ' + escapeHtml(reference) : '') + '</span>'
        + '</span></button></li>';
    }).join('');

    return '<ul class="wm-records-list">' + rows + '</ul>';
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

  return {
    render: render,
    renderLegend: renderLegend,
    renderRecords: renderRecords,
    mount: mount,
    toEpochRange: toEpochRange,
    PRESETS: PRESETS,
    RIYADH_OFFSET_MS: RIYADH_OFFSET_MS,
  };
});
