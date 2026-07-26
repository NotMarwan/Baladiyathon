/**
 * أثر — تصيير الفهرس: الصفحة الرئيسية والنظرة العامة والتفاصيل المتقدمة.
 * ---------------------------------------------------------------------------
 * دوال نقية تعيد نصاً، تقرأ من `athar-catalog.js` وحده. الصفحات لا تكتب
 * وصفاً ولا حالة ولا رقماً بنفسها — فلا تفترق ثلاث صفحات في وصف مشروع واحد.
 *
 * المبدأ في العرض: **الكشف المتدرّج.** الملخص ظاهر، والتفصيل داخل `<details>`
 * — عنصر متصفّح قياسي محتواه في الشجرة دائماً، يقرؤه القارئ الصوتي والمفهرس
 * ونظام التقييم سواء فُتح أم لا. وهذا هو الفرق بين طيّ المعلومة وإخفائها:
 * الأول يريح العين ويُبقي النص، والثاني يكذب على الاثنين.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./athar-catalog.js'));
  } else {
    root.AtharCatalogView = factory(root.AtharCatalog);
  }
})(typeof self !== 'undefined' ? self : this, function (Catalog) {
  'use strict';

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  /** وسم حالة: نبرة + نص. اللون وحده لا ينقل حالة — النص هو الحامل. */
  function statusTag(key) {
    var meta = Catalog.STATUS[key] || { label: key, tone: 'muted' };
    return '<span class="ac-status" data-tone="' + escapeHtml(meta.tone) + '">'
      + '<span class="visually-hidden">الحالة: </span>'
      + escapeHtml(meta.label) + '</span>';
  }

  function rows(pairs) {
    return pairs.filter(function (pair) { return pair[1]; }).map(function (pair) {
      return '<div class="ac-pair"><dt>' + escapeHtml(pair[0]) + '</dt>'
        + '<dd>' + escapeHtml(pair[1]) + '</dd></div>';
    }).join('');
  }

  /* ---------- الصفحة الرئيسية ---------- */

  function renderHero() {
    var p = Catalog.PROJECT;
    return '<h1>' + escapeHtml(p.name) + ' — ' + escapeHtml(p.tagline) + '</h1>'
      + '<p class="ac-lead">' + escapeHtml(p.summary) + '</p>'
      + '<p class="ac-cta-row">'
      + '<a class="ac-cta" href="athar-desk.html">ابدأ من مكتب المراجع</a>'
      + '<a class="ac-cta-secondary" href="athar-map.html">أو اعرض الخريطة العامة</a>'
      + '</p>'
      + '<p class="ac-context">' + escapeHtml(p.challenge) + '</p>';
  }

  function renderProblem() {
    var p = Catalog.PROJECT;
    return '<h2 id="problem">المشكلة</h2>'
      + '<p>' + escapeHtml(p.problem) + '</p>'
      + '<h3>لمن صُمّم</h3>'
      + '<ul class="ac-users">' + p.users.map(function (user) {
        return '<li><strong>' + escapeHtml(user.who) + '</strong> — '
          + escapeHtml(user.need) + '</li>';
      }).join('') + '</ul>';
  }

  function renderJourney() {
    return '<h2 id="journey">الرحلة في أربع خطوات</h2>'
      + '<ol class="ac-journey">' + Catalog.JOURNEY.map(function (step) {
        return '<li class="ac-step">'
          + '<p class="ac-step-num">الخطوة ' + step.step + ' من ' + Catalog.JOURNEY.length + '</p>'
          + '<h3><a href="' + escapeHtml(step.href) + '">' + escapeHtml(step.title) + '</a></h3>'
          + '<p>' + escapeHtml(step.body) + '</p></li>';
      }).join('') + '</ol>';
  }

  function renderValues() {
    return '<h2 id="value">ما الذي يميّزه</h2>'
      + '<ul class="ac-values">' + Catalog.PROJECT.values.map(function (value) {
        return '<li><h3>' + escapeHtml(value.title) + '</h3>'
          + '<p>' + escapeHtml(value.body) + '</p></li>';
      }).join('') + '</ul>';
  }

  /**
   * حالة المشروع في سطر واحد على الصفحة الأولى.
   * الرقم محسوب من الفهرس لا مكتوب: عدد يُكتب يدوياً يتخلّف عن الجدول الذي
   * يصفه، ثم يُقرأ ادّعاءً.
   */
  function renderStatusStrip() {
    var total = Catalog.FEATURES.length;
    var counts = Object.keys(Catalog.STATUS).map(function (key) {
      return { key: key, n: Catalog.byStatus(key).length };
    }).filter(function (row) { return row.n > 0; });

    return '<h2 id="status">حالة المشروع الآن</h2>'
      + '<p class="ac-note">' + total + ' خاصية موصوفة، كلٌّ بحالتها الحقيقية '
      + 'ومصدر بياناتها وطريقة التحقق منها وقيدها.</p>'
      + '<ul class="ac-status-strip">' + counts.map(function (row) {
        return '<li>' + statusTag(row.key)
          + '<span class="ac-status-count">' + row.n + ' من ' + total + '</span></li>';
      }).join('') + '</ul>'
      + '<p class="ac-cta-row">'
      + '<a class="ac-cta-secondary" href="athar-overview.html">افتح نظرة عامة على النظام</a>'
      + '</p>';
  }

  function renderHome() {
    return '<section class="ac-hero" aria-labelledby="ac-title">'
      + renderHero().replace('<h1>', '<h1 id="ac-title">') + '</section>'
      + '<section class="ac-block" aria-labelledby="problem">' + renderProblem() + '</section>'
      + '<section class="ac-block" aria-labelledby="journey">' + renderJourney() + '</section>'
      + '<section class="ac-block" aria-labelledby="value">' + renderValues() + '</section>'
      + '<section class="ac-block" aria-labelledby="status">' + renderStatusStrip() + '</section>';
  }

  /* ---------- نظرة عامة على النظام ---------- */

  function renderFeatureTable() {
    var body = Catalog.FEATURES.map(function (item) {
      return '<tr>'
        + '<th scope="row">' + escapeHtml(item.name) + '</th>'
        + '<td>' + statusTag(item.status) + '</td>'
        + '<td>' + escapeHtml(item.goal) + '</td>'
        + '<td>' + (item.file
          ? '<code>' + escapeHtml(item.file) + '</code>'
          : '<span class="ac-none">لا ملف — غير منفذة</span>') + '</td>'
        + '</tr>';
    }).join('');

    var details = Catalog.FEATURES.map(function (item) {
      return '<details class="ac-details" id="feature-' + escapeHtml(item.id) + '">'
        + '<summary><span class="ac-summary-name">' + escapeHtml(item.name) + '</span>'
        + statusTag(item.status) + '</summary>'
        + '<dl class="ac-dl">' + rows([
          ['الهدف', item.goal],
          ['المدخلات', item.inputs],
          ['المخرجات', item.outputs],
          ['مصدر البيانات', item.source],
          ['طريقة التحقق', item.validation],
          ['القيود', item.limits],
          ['الملف', item.file || 'لا ملف — غير منفذة'],
        ]) + '</dl></details>';
    }).join('');

    return '<h2 id="features">الخصائص وحالتها</h2>'
      + '<p class="ac-note">الجدول للنظرة السريعة، والتفصيل تحته: لكل خاصية '
      + 'مدخلاتها ومخرجاتها ومصدرها وطريقة التحقق منها وقيدها.</p>'
      + '<div class="ac-table-wrap"><table class="ac-table">'
      + '<caption class="visually-hidden">خصائص المشروع وحالة اكتمال كل واحدة</caption>'
      + '<thead><tr><th scope="col">الخاصية</th><th scope="col">الحالة</th>'
      + '<th scope="col">الهدف</th><th scope="col">الملف</th></tr></thead>'
      + '<tbody>' + body + '</tbody></table></div>'
      + '<h3>تفاصيل كل خاصية</h3>' + details;
  }

  function renderIO() {
    return '<h2 id="io">المدخلات والمخرجات</h2>'
      + '<h3>ما يستقبله النظام</h3>'
      + '<div class="ac-table-wrap"><table class="ac-table">'
      + '<caption class="visually-hidden">مدخلات النظام ونوع كل مدخل ومنشؤه</caption>'
      + '<thead><tr><th scope="col">المدخل</th><th scope="col">النوع والمدى</th>'
      + '<th scope="col">من أين يأتي</th></tr></thead><tbody>'
      + Catalog.IO.inputs.map(function (row) {
        return '<tr><th scope="row">' + escapeHtml(row.name) + '</th>'
          + '<td>' + escapeHtml(row.kind) + '</td>'
          + '<td>' + escapeHtml(row.origin) + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<h3>ما ينتجه النظام</h3>'
      + '<div class="ac-table-wrap"><table class="ac-table">'
      + '<caption class="visually-hidden">مخرجات النظام ووحدة كل مخرج وطريقة حسابه</caption>'
      + '<thead><tr><th scope="col">المخرج</th><th scope="col">الوحدة</th>'
      + '<th scope="col">كيف يُحسب</th></tr></thead><tbody>'
      + Catalog.IO.outputs.map(function (row) {
        return '<tr><th scope="row">' + escapeHtml(row.name) + '</th>'
          + '<td>' + escapeHtml(row.unit) + '</td>'
          + '<td>' + escapeHtml(row.how) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderSources() {
    return '<h2 id="sources">مصادر البيانات</h2>'
      + '<p class="ac-note">' + Catalog.SOURCES.length + ' مصدراً: خارجية منشورة، '
      + 'وداخلية مشتقّة من عمل المشروع نفسه. التفصيل الكامل لكل مصدر في '
      + '<a href="athar-sources.html">سجل المصادر</a>.</p>'
      + '<div class="ac-table-wrap"><table class="ac-table">'
      + '<caption class="visually-hidden">مصادر بيانات المشروع ونوع كل مصدر</caption>'
      + '<thead><tr><th scope="col">المعرّف</th><th scope="col">المصدر</th>'
      + '<th scope="col">النوع</th></tr></thead><tbody>'
      + Catalog.SOURCES.map(function (source) {
        return '<tr><th scope="row"><code>' + escapeHtml(source.id) + '</code></th>'
          + '<td><a href="athar-sources.html#' + escapeHtml(source.id) + '">'
          + escapeHtml(source.title) + '</a></td>'
          + '<td>' + escapeHtml(source.kind) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderValidation() {
    return '<h2 id="validation">التحقق من المدخلات والنتائج</h2>'
      + '<dl class="ac-dl">' + Catalog.VALIDATION.map(function (row) {
        return '<div class="ac-pair"><dt>' + escapeHtml(row.where) + '</dt>'
          + '<dd>' + escapeHtml(row.how) + '</dd></div>';
      }).join('') + '</dl>';
  }

  function renderErrors() {
    return '<h2 id="errors">معالجة الأخطاء والحالات الاستثنائية</h2>'
      + '<div class="ac-table-wrap"><table class="ac-table">'
      + '<caption class="visually-hidden">الحالات الاستثنائية وسلوك النظام في كل منها</caption>'
      + '<thead><tr><th scope="col">الحالة</th><th scope="col">سلوك النظام</th></tr></thead>'
      + '<tbody>' + Catalog.ERRORS.map(function (row) {
        return '<tr><th scope="row">' + escapeHtml(row.when) + '</th>'
          + '<td>' + escapeHtml(row.what) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderArchitecture() {
    return '<h2 id="architecture">بنية النظام</h2>'
      + Catalog.ARCHITECTURE.map(function (layer) {
        return '<details class="ac-details"><summary>'
          + '<span class="ac-summary-name">' + escapeHtml(layer.layer) + '</span></summary>'
          + '<p>' + escapeHtml(layer.body) + '</p>'
          + '<ul class="ac-files">' + layer.files.map(function (file) {
            return '<li><code>' + escapeHtml(file) + '</code></li>';
          }).join('') + '</ul></details>';
      }).join('');
  }

  function renderTesting() {
    return '<h2 id="testing">الاختبارات</h2>'
      + '<p class="ac-note">' + escapeHtml(Catalog.TESTING.note) + '</p>'
      + '<p>المُشغّل: <code>' + escapeHtml(Catalog.TESTING.runner) + '</code></p>'
      + '<div class="ac-table-wrap"><table class="ac-table">'
      + '<caption class="visually-hidden">مجالات الاختبار والحزمة التي تغطي كل مجال</caption>'
      + '<thead><tr><th scope="col">ما يُختبر</th><th scope="col">الحزمة</th></tr></thead>'
      + '<tbody>' + Catalog.TESTING.areas.map(function (row) {
        return '<tr><th scope="row">' + escapeHtml(row.area) + '</th>'
          + '<td><code>' + escapeHtml(row.suite) + '</code></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderLimits() {
    return '<h2 id="limits">القيود وما ليس متوفراً</h2>'
      + '<p class="ac-note">كل بند هنا نقصٌ معلَن لا تفصيلة تنفيذ. عدم ذكره '
      + 'كان سيجعل ما فوقه يُقرأ أكمل مما هو.</p>'
      + '<div class="ac-table-wrap"><table class="ac-table">'
      + '<caption class="visually-hidden">ما ليس متوفراً في النظام وحالة كل بند</caption>'
      + '<thead><tr><th scope="col">البند</th><th scope="col">الحالة</th></tr></thead>'
      + '<tbody>' + Catalog.GAPS.map(function (gap) {
        return '<tr><th scope="row">' + escapeHtml(gap.item) + '</th>'
          + '<td>' + escapeHtml(gap.state) + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<h3 id="representative">البيانات التمثيلية وأين تُعلَن</h3>'
      + Catalog.REPRESENTATIVE.map(function (row) {
        return '<details class="ac-details"><summary>'
          + '<span class="ac-summary-name">' + escapeHtml(row.item) + '</span>'
          + '<span class="ac-status" data-tone="warning">بيانات تمثيلية</span></summary>'
          + '<dl class="ac-dl">' + rows([
            ['لماذا', row.why],
            ['أين تُعلَن', row.mark],
          ]) + '</dl></details>';
      }).join('');
  }

  function renderOverview() {
    var p = Catalog.PROJECT;
    return '<section class="ac-block" aria-labelledby="purpose">'
      + '<h2 id="purpose">هدف المشروع</h2>'
      + '<p class="ac-lead">' + escapeHtml(p.summary) + '</p>'
      + '<p>' + escapeHtml(p.problem) + '</p>'
      + '<p class="ac-context">' + escapeHtml(p.challenge) + '</p></section>'
      + '<section class="ac-block" aria-labelledby="journey">' + renderJourney() + '</section>'
      + '<section class="ac-block" aria-labelledby="features">'
      + renderFeatureTable() + '</section>'
      + '<section class="ac-block" aria-labelledby="io">' + renderIO() + '</section>'
      + '<section class="ac-block" aria-labelledby="sources">' + renderSources() + '</section>'
      + '<section class="ac-block" aria-labelledby="validation">'
      + renderValidation() + '</section>'
      + '<section class="ac-block" aria-labelledby="errors">' + renderErrors() + '</section>'
      + '<section class="ac-block" aria-labelledby="architecture">'
      + renderArchitecture() + '</section>'
      + '<section class="ac-block" aria-labelledby="testing">' + renderTesting() + '</section>'
      + '<section class="ac-block" aria-labelledby="limits">' + renderLimits() + '</section>';
  }

  /** فهرس داخل الصفحة الطويلة: القفز إلى القسم بدل التمرير الأعمى. */
  function renderOverviewIndex() {
    var sections = [
      ['purpose', 'هدف المشروع'],
      ['journey', 'رحلة المستخدم'],
      ['features', 'الخصائص وحالتها'],
      ['io', 'المدخلات والمخرجات'],
      ['sources', 'مصادر البيانات'],
      ['validation', 'التحقق'],
      ['errors', 'معالجة الأخطاء'],
      ['architecture', 'بنية النظام'],
      ['testing', 'الاختبارات'],
      ['limits', 'القيود وما ليس متوفراً'],
    ];
    return '<nav class="ac-toc" aria-label="أقسام الصفحة"><h2>محتويات الصفحة</h2><ol>'
      + sections.map(function (pair) {
        return '<li><a href="#' + pair[0] + '">' + escapeHtml(pair[1]) + '</a></li>';
      }).join('') + '</ol></nav>';
  }

  /* ---------- التفاصيل المتقدمة ---------- */

  function renderAdvanced() {
    return '<ul class="ac-cards">' + Catalog.ADVANCED.map(function (page) {
      return '<li class="ac-card">'
        + '<h2><a href="' + escapeHtml(page.file) + '">' + escapeHtml(page.label) + '</a></h2>'
        + (page.temporary
          ? '<p class="ac-status" data-tone="warning">تبويب مؤقّت — قابل للحذف بلا أثر</p>'
          : '')
        + '<p>' + escapeHtml(page.body) + '</p></li>';
    }).join('') + '</ul>';
  }

  return {
    statusTag: statusTag,
    renderHome: renderHome,
    renderJourney: renderJourney,
    renderOverview: renderOverview,
    renderOverviewIndex: renderOverviewIndex,
    renderFeatureTable: renderFeatureTable,
    renderAdvanced: renderAdvanced,
    escapeHtml: escapeHtml,
  };
});
