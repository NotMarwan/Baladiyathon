/**
 * أثر — عُد من حيث وقفت.
 * ---------------------------------------------------------------------------
 * مراجعٌ يفتح الأداة كل صباح يدفع ضريبةً قبل أن يعمل: يعيد ضبط المرشِّح، ويعيد
 * الفرز، ويبحث عن العمل الذي تركه أمس. دقيقتان لا تُنتجان قراراً واحداً،
 * وتتكرران كل يوم.
 *
 * هذه الوحدة تُلغي تلك الضريبة: تحفظ ما كان المراجع يراه، وتقول له عند العودة
 * أين توقّف وكم مضى وماذا بقي.
 *
 * حدّ يجب أن يبقى ظاهراً: هذه ذاكرة **متصفّح واحد لمراجع واحد**. لا تعرف ماذا
 * فعل زميله، ولا تدّعي ذلك. «ما تغيّر منذ آخر زيارة» هنا يعني «ما فعلتَه أنت
 * آخر مرة» — وقولها بهذا الوضوح أصدق من واجهة توحي بتنسيق لا يقع.
 *
 * الزمن يُحقن ولا يُقرأ من الساعة: الوحدة نقية وتُختبر في Node.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharDeskRecall = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'athar.desk.recall.v1';
  var SCHEMA = 1;

  /** بعد هذا لا معنى لاستئناف: جلسة الأمس البعيد ليست جلسةً تُستأنف. */
  var STALE_DAYS = 14;

  var MINUTE = 60000;
  var HOUR = 3600000;
  var DAY = 86400000;

  function read(store) {
    try {
      var raw = store.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.schema !== SCHEMA) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  /**
   * @param {object} store مخزن بعقد localStorage
   * @param {object} state {query, status, sort, selectedId, tab, decisions, pending}
   * @param {string} at ختم ISO — يُحقن
   */
  function write(store, state, at) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify({
        schema: SCHEMA,
        at: at || null,
        query: state.query || '',
        status: state.status || null,
        sort: state.sort || null,
        selectedId: state.selectedId || null,
        tab: state.tab || null,
        decisions: Number(state.decisions) || 0,
        pending: Number(state.pending) || 0,
      }));
      return true;
    } catch (err) {
      return false;
    }
  }

  function clear(store) {
    try { store.removeItem(STORAGE_KEY); } catch (err) { /* لا شيء يُفعل */ }
  }

  /** «قبل ثلاث ساعات». تقريبٌ مقصود: الدقّة هنا لا تخدم أحداً. */
  function ago(elapsedMs) {
    if (elapsedMs < 2 * MINUTE) return 'قبل لحظات';
    if (elapsedMs < HOUR) return 'قبل ' + Math.round(elapsedMs / MINUTE) + ' دقيقة';
    if (elapsedMs < DAY) {
      var hours = Math.round(elapsedMs / HOUR);
      return hours === 1 ? 'قبل ساعة' : hours === 2 ? 'قبل ساعتين'
        : 'قبل ' + hours + ' ساعات';
    }
    var days = Math.round(elapsedMs / DAY);
    return days === 1 ? 'أمس' : days === 2 ? 'قبل يومين' : 'قبل ' + days + ' يوماً';
  }

  /**
   * ماذا نقول للعائد.
   * @param {object|null} saved خرج read
   * @param {string} nowISO الآن — يُحقن
   * @param {object} counts {decisions, pending}
   * @returns {{show:boolean, ...}}
   */
  function resume(saved, nowISO, counts) {
    if (!saved || !saved.at) return { show: false, reason: 'first-visit' };

    var elapsed = Date.parse(nowISO) - Date.parse(saved.at);
    if (!isFinite(elapsed) || elapsed < 0) return { show: false, reason: 'clock' };
    if (elapsed > STALE_DAYS * DAY) return { show: false, reason: 'stale' };

    // جلسة بلا قرار واحد ليست جلسةً تُستأنف — الشريط يصير ضجيجاً يومياً.
    if (!saved.decisions) return { show: false, reason: 'nothing-done' };

    return {
      show: true,
      ago: ago(elapsed),
      decisions: saved.decisions,
      pending: (counts && counts.pending) || 0,
      selectedId: saved.selectedId || null,
      newSince: Math.max(0, ((counts && counts.decisions) || 0) - saved.decisions),
    };
  }

  function integer(value) {
    try {
      return new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 0 })
        .format(Math.round(value));
    } catch (err) {
      return String(Math.round(value));
    }
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  function counted(n, forms) {
    if (n === 1) return forms.one;
    if (n === 2) return forms.two;
    if (n >= 3 && n <= 10) return integer(n) + ' ' + forms.few;
    return integer(n) + ' ' + forms.many;
  }

  var WORK_FORMS = { one: 'عملاً واحداً', two: 'عملين', few: 'أعمال', many: 'عملاً' };
  var WAITING_FORMS = { one: 'عمل واحد', two: 'عملان', few: 'أعمال', many: 'عملاً' };

  /** @param {object} state خرج resume · @param {string} [ref] مرجع العمل المحفوظ */
  function render(state, ref) {
    if (!state.show) return '';

    return '<span class="desk-resume-text">'
      + escapeHtml(state.ago) + ' قرّرتَ <strong>'
      + counted(state.decisions, WORK_FORMS) + '</strong>'
      + (state.pending
        ? ' · ما زال <strong>' + counted(state.pending, WAITING_FORMS) + '</strong> ينتظر'
        : ' · لا عمل ينتظر قراراً')
      + '.</span>'
      + (ref
        ? '<button type="button" class="desk-resume-go" id="deskResumeGo">'
          + 'تابع من <bdi>' + escapeHtml(ref) + '</bdi></button>'
        : '')
      + '<button type="button" class="desk-resume-close" id="deskResumeClose"'
      + ' aria-label="أغلق شريط الاستئناف">إخفاء</button>';
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA: SCHEMA,
    STALE_DAYS: STALE_DAYS,
    read: read,
    write: write,
    clear: clear,
    resume: resume,
    render: render,
    ago: ago,
  };
});
