/**
 * أثر — لوحة الأوامر.
 * ---------------------------------------------------------------------------
 * 150 تصريحاً على 114 شارعاً، وسبعة تبويبات، وسبع صفحات، وعشرة إجراءات. الوصول
 * إلى أيّها اليوم يمرّ بمرشِّح أو بشريط تنقّل أو بتذكّر مكان. لوحة واحدة تُلغي
 * الثلاثة: اكتب ما تريده، واضغط Enter.
 *
 * القيمة الحقيقية هنا ليست القفز — بل **أن البحث العربي يعمل**.
 *
 * العربية تُكتب بأشكال متعدّدة للحرف نفسه: «الإمام» و«الامام» و«الأمام» ثلاث
 * كتابات لكلمة واحدة، و«مكتبة» و«مكتبه» كذلك. بحثٌ يقارن المحارف حرفياً يفشل
 * على كل واحدة منها، ويظنّ المستخدم أن الشارع غير موجود. التطبيع قبل المقارنة
 * هو الفرق بين بحث يعمل وبحث يبدو معطلاً — وهو تفصيل لا يُلاحَظ حين يعمل
 * ويُلاحَظ فوراً حين لا يعمل.
 *
 * الترتيب مقصود: ما يبدأ بالنص أولاً، ثم ما تبدأ كلمة فيه به، ثم ما يحتويه.
 * مراجعٌ يكتب «الملك» يريد «طريق الملك فهد» لا «شارع عبدالملك».
 *
 * الوحدة نقية: تأخذ فهرساً ونصاً وتعيد نتائج مرتّبة. لا DOM ولا حالة.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharDeskPalette = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_RESULTS = 8;

  /** التشكيل والتطويل: زينة كتابية لا تُقارن. */
  var DIACRITICS = /[ً-ْٰـ]/g;

  var FOLD = {
    'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
    'ة': 'ه',
    'ى': 'ي', 'ئ': 'ي',
    'ؤ': 'و',
  };

  /**
   * يطبّع نصاً عربياً للمقارنة.
   * لا يُعرض المطبَّع أبداً — يُقارَن به فقط، ويبقى الأصل هو المعروض.
   */
  function fold(text) {
    return String(text === null || text === undefined ? '' : text)
      .replace(DIACRITICS, '')
      .replace(/[أإآٱةىئؤ]/g, function (ch) { return FOLD[ch] || ch; })
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * درجة المطابقة. أعلى = أفضل. صفر = لا مطابقة.
   * البداية أقوى من بداية كلمة، وبداية كلمة أقوى من الاحتواء.
   */
  function score(haystack, needle) {
    if (!needle) return 1;
    var text = fold(haystack);
    var query = fold(needle);
    if (!text || !query) return 0;

    var at = text.indexOf(query);
    if (at === -1) return 0;
    if (at === 0) return 100 - Math.min(50, text.length - query.length);
    if (text.charAt(at - 1) === ' ') return 60 - Math.min(40, text.length - query.length);
    return 20 - Math.min(15, text.length - query.length);
  }

  /**
   * يرشّح الفهرس ويرتّبه.
   * @param {Array<{kind:string, label:string, hint?:string, id?:string, value?:*}>} entries
   * @param {string} query
   * @param {number} [limit]
   */
  function search(entries, query, limit) {
    var cap = limit || MAX_RESULTS;

    var scored = (entries || []).map(function (entry, index) {
      var best = Math.max(
        score(entry.label, query),
        entry.hint ? score(entry.hint, query) * 0.8 : 0
      );
      // الترتيب الأصلي يفصل المتساويين: الإجراءات والتبويبات قبل 150 تصريحاً.
      return { entry: entry, score: best, index: index };
    }).filter(function (row) { return row.score > 0; });

    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

    return scored.slice(0, cap).map(function (row) { return row.entry; });
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  var KIND_LABELS = {
    work: 'تصريح',
    action: 'إجراء',
    tab: 'تبويب',
    page: 'صفحة',
  };

  /** @param {Array} results · @param {number} active الفهرس المُبرَز */
  function renderResults(results, active) {
    if (!results.length) {
      return '<p class="desk-palette-empty" role="status">لا نتيجة مطابقة.</p>';
    }

    return '<ul class="desk-palette-list" role="listbox" aria-label="النتائج">'
      + results.map(function (entry, index) {
        return '<li role="option" id="deskPaletteOption' + index + '"'
          + ' aria-selected="' + (index === active ? 'true' : 'false') + '"'
          + ' data-index="' + index + '">'
          + '<span class="desk-palette-kind">' + escapeHtml(KIND_LABELS[entry.kind] || '') + '</span>'
          + '<span class="desk-palette-label">' + escapeHtml(entry.label) + '</span>'
          + (entry.hint ? '<span class="desk-palette-hint">' + escapeHtml(entry.hint) + '</span>' : '')
          + '</li>';
      }).join('')
      + '</ul>';
  }

  /** هيكل اللوحة. الحقل يبقى قائماً عبر البحث فلا تُفقد البؤرة مع كل حرف. */
  function renderShell() {
    return '<div class="desk-palette-card" role="document">'
      + '<label class="visually-hidden" for="deskPaletteInput">'
      + 'ابحث عن تصريح أو شارع أو إجراء أو صفحة</label>'
      + '<input type="search" id="deskPaletteInput" class="desk-palette-input"'
      + ' autocomplete="off" role="combobox" aria-expanded="true"'
      + ' aria-controls="deskPaletteResults" aria-autocomplete="list"'
      + ' placeholder="تصريح · شارع · إجراء · صفحة">'
      + '<div id="deskPaletteResults" class="desk-palette-results"></div>'
      + '<p class="desk-palette-foot">'
      + '<kbd>↑</kbd><kbd>↓</kbd> للتنقّل · <kbd>Enter</kbd> للاختيار · <kbd>Esc</kbd> للإغلاق</p>'
      + '</div>';
  }

  return {
    fold: fold,
    score: score,
    search: search,
    renderResults: renderResults,
    renderShell: renderShell,
    KIND_LABELS: KIND_LABELS,
    MAX_RESULTS: MAX_RESULTS,
  };
});
