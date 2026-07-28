/**
 * مسار — تصيير صندوق الأعمال.
 * ---------------------------------------------------------------------------
 * 1) كل الدوال نقية تُعيد نصاً — تُختبر في Node بلا DOM.
 * 2) صف العمل يحمل الحقول السبعة من نظام التصميم: المرجع، الشارع، النافذة،
 *    الأثر، الثقة، الحالة، الإجراء التالي.
 * 3) الحالة لون + رمز + نص. اللون وحده لا ينقل حالة.
 * 4) كل قيمة تمر بترميز HTML؛ بيانات التصاريح نص لا شيفرة.
 * 5) الحقل الغائب يصير «—» لا undefined.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./masar-desk-states.js'));
  } else {
    root.MasarDeskInbox = factory(root.MasarDeskStates);
  }
})(typeof self !== 'undefined' ? self : this, function (States) {
  'use strict';

  var DASH = '—';

  var SENSITIVITY_LABELS = {
    hospital: 'مستشفى',
    school: 'مدرسة',
    transit: 'نقل عام',
  };

  var CONFIDENCE_LABELS = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };

  var SORT_OPTIONS = [
    { value: 'impact', label: 'الأثر (الأعلى أولاً)' },
    { value: 'severity', label: 'الشدة' },
    { value: 'start', label: 'تاريخ البدء' },
    { value: 'street', label: 'الشارع' },
  ];

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  function text(value) {
    return value === null || value === undefined || value === '' ? DASH : String(value);
  }

  function number(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('ar-SA-u-nu-latn', { maximumFractionDigits: 0 }) : DASH;
  }

  function shortDate(value) {
    var ms = Date.parse(value);
    if (!ms) return DASH;
    try {
      return new Intl.DateTimeFormat('ar-SA-u-nu-latn', { day: 'numeric', month: 'short' }).format(new Date(ms));
    } catch (err) {
      return new Date(ms).toISOString().slice(5, 10);
    }
  }

  /** وسم الحالة: نبرة + رمز + نص. لا يُختصر إلى نقطة ملونة. */
  function statusTag(status) {
    var meta = (States.LABELS || {})[status] || { label: status || DASH, icon: '•', tone: 'muted' };
    return '<span class="desk-tag" data-tone="' + escapeHtml(meta.tone) + '">'
      + '<span class="desk-tag-icon" aria-hidden="true">' + escapeHtml(meta.icon) + '</span>'
      + '<span>' + escapeHtml(meta.label) + '</span></span>';
  }

  function renderRow(feature, isSelected) {
    var p = (feature && feature.properties) || {};
    var flags = [];

    if (p.escalate) {
      flags.push('<span class="desk-flag" data-tone="danger" title="'
        + escapeHtml(p.escalateReason || '') + '">تصعيد</span>');
    }
    if (SENSITIVITY_LABELS[p.sensitivity]) {
      flags.push('<span class="desk-flag" data-tone="warning">'
        + escapeHtml(SENSITIVITY_LABELS[p.sensitivity]) + '</span>');
    }

    return '<li class="desk-row" role="option" tabindex="0"'
      + ' data-work-id="' + escapeHtml(text(p.id)) + '"'
      + ' aria-selected="' + (isSelected ? 'true' : 'false') + '">'
      + '<div class="desk-row-main">'
      + '<span class="desk-ref">' + escapeHtml(text(p.permitRef)) + '</span>'
      + '<span class="desk-street">' + escapeHtml(text(p.street)) + '</span>'
      + (flags.length ? '<span class="desk-flags">' + flags.join('') + '</span>' : '')
      + '</div>'
      + '<div class="desk-row-meta">'
      + statusTag(p.status)
      + '<span class="desk-window">' + escapeHtml(shortDate(p.start))
      + ' ← ' + escapeHtml(shortDate(p.end)) + '</span>'
      + '</div>'
      + '<div class="desk-row-figures">'
      + '<span class="desk-impact"><span class="desk-figure">' + escapeHtml(number(p.impactVehHours))
      + '</span> ساعة-مركبة</span>'
      + '<span class="desk-confidence">ثقة ' + escapeHtml(CONFIDENCE_LABELS[p.confidence] || DASH)
      + '</span>'
      + '</div>'
      + '<div class="desk-row-next">' + escapeHtml(States.nextAction(p.status)) + '</div>'
      + '</li>';
  }

  function renderList(features, selectedId) {
    if (!features || !features.length) {
      return '<p class="desk-empty">لا نتائج مطابقة — وسّع المرشحات أو امسح البحث.</p>';
    }
    var rows = features.map(function (feature) {
      return renderRow(feature, feature.properties.id === selectedId);
    }).join('');
    return '<ul class="desk-list" role="listbox" aria-label="صندوق الأعمال">' + rows + '</ul>';
  }

  /**
   * الاختيار الافتراضي عند فتح المكتب: معيارٌ على الطابور لا معرّف مثبَّت.
   * ---------------------------------------------------------------------------
   * أول صفّ في الطابور هو ترتيب الفرز — «ما ينتظر قراراً» ثم الأعلى أثراً —
   * لا أفضل ما يُظهِر المنتج. الأثر يرتفع مع ضعف الثقة أيضاً، فتصريحٌ منخفض
   * الثقة يتصدّر الطابور غالباً، ويفتح المكتب حينها على صفّ يُخفي بالضبط ما
   * يريد المراجع رؤيته أولاً: بوابة الامتناع وفارق النهار/الليل لا يظهران
   * بوضوح إلا على تصريح واثق القياس.
   *
   * فالاختيار هنا دالة تُطبَّق على الطابور كما وصل: أعلى ساعات-مركبة بين
   * التصاريح ذات الثقة المرتفعة. لا يُعاد ترتيب الطابور ولا تُصفَّى صفوفه —
   * القائمة المعروضة تبقى كما فُرزت؛ ما يتغيّر هو أيّ صفّ منها يُحدَّد أولاً.
   * ومعرّف تصريح مثبَّت بخطّ اليد كان سيبدو أدقّ اليوم، لكنه يتقادم مع أول
   * إعادة توليد للمحفظة — فيفتح الديمو على صفٍّ لم يعد موجوداً.
   *
   * وإن لم يطابق المعيار أي صفّ (لا ثقة مرتفعة في هذا الطابور)، الاحتياط هو
   * أول صفّ كما كان — لا صندوق فارغ على محفظة صغيرة أو تجريبية بلا صفوف
   * عالية الثقة.
   *
   * @param {Array<object>} features الطابور بترتيبه الحالي — يُقرأ ولا يُعدَّل.
   * @returns {object|null} الصفّ المختار، أو null إن كان الطابور فارغاً.
   */
  function pickDefault(features) {
    var list = features || [];
    if (!list.length) return null;

    var winner = null;
    var winnerHours = -Infinity;

    list.forEach(function (feature) {
      var p = (feature && feature.properties) || {};
      if (p.confidence !== 'high') return;
      var hours = Number(p.impactVehHours) || 0;
      if (!winner || hours > winnerHours) {
        winner = feature;
        winnerHours = hours;
      }
    });

    return winner || list[0];
  }

  function statusOptions(selected) {
    var options = ['<option value="">كل الحالات</option>'];
    Object.keys(States.TRANSITIONS).forEach(function (status) {
      var meta = States.LABELS[status];
      options.push('<option value="' + escapeHtml(status) + '"'
        + (selected === status ? ' selected' : '') + '>'
        + escapeHtml(meta.label) + '</option>');
    });
    return options.join('');
  }

  function sortOptions(selected) {
    return SORT_OPTIONS.map(function (option) {
      return '<option value="' + escapeHtml(option.value) + '"'
        + (selected === option.value ? ' selected' : '') + '>'
        + escapeHtml(option.label) + '</option>';
    }).join('');
  }

  /**
   * سطر العدّادات وحده.
   * ---------------------------------------------------------------------------
   * مفصولٌ عن بقية الشريط لأنه الجزء الوحيد الذي يتغيّر مع كل ضغطة مفتاح في
   * حقل البحث. الشريط كله كان يُعاد بناؤه ليتحدّث هذا السطر، فيُهدَم الحقل
   * الذي يكتب فيه المراجع وتُفقد البؤرة بعد أول حرف — بحثٌ لا يُكتب فيه إلا
   * حرف واحد. الآن: الشريط يُبنى مرة، وهذا السطر وحده يُستبدل.
   */
  function renderCounts(counts) {
    var c = counts || {};
    return '<span>يُعرض <strong>' + escapeHtml(number(c.visible)) + '</strong>'
      + ' من ' + escapeHtml(number(c.total)) + '</span>'
      + '<span class="desk-pending"><strong>' + escapeHtml(number(c.needsDecision))
      + '</strong> ينتظر قراراً</span>';
  }

  function renderToolbar(counts, filters) {
    var f = filters || {};
    return '<div class="desk-toolbar">'
      + '<label class="desk-field"><span class="visually-hidden">ابحث بالشارع أو المرجع</span>'
      + '<input id="desk-search" type="search" placeholder="ابحث بالشارع أو المرجع…"'
      + ' value="' + escapeHtml(f.query || '') + '" autocomplete="off"></label>'
      + '<div class="desk-field-row">'
      + '<label class="desk-field"><span>الحالة</span>'
      + '<select id="desk-status">' + statusOptions(f.status) + '</select></label>'
      + '<label class="desk-field"><span>الترتيب</span>'
      + '<select id="desk-sort">' + sortOptions(f.sort) + '</select></label>'
      + '</div>'
      + '<p class="desk-counts" id="desk-counts" role="status">' + renderCounts(counts) + '</p>'
      + '</div>';
  }

  return {
    renderRow: renderRow,
    renderList: renderList,
    renderToolbar: renderToolbar,
    renderCounts: renderCounts,
    statusTag: statusTag,
    escapeHtml: escapeHtml,
    pickDefault: pickDefault,
    SENSITIVITY_LABELS: SENSITIVITY_LABELS,
    CONFIDENCE_LABELS: CONFIDENCE_LABELS,
    SORT_OPTIONS: SORT_OPTIONS,
  };
});
