/**
 * أثر — شريط التنقل الموحد.
 * ---------------------------------------------------------------------------
 * خمسة أقسام، لا ثمانية.
 *
 * كان الشريط يحمل ثمانية تبويبات متساوية الوزن — ثلاثة أساسية وخمسة خلف فاصل.
 * وثمانية خيارات على شريط واحد لا تقول للداخل من أين يبدأ ولا أين ينتهي؛ فمن
 * يفتح الأداة يقرأ قائمة مواضيع لا مساراً. والصفحات الخمس الأخيرة لم تكن
 * زائدة — هي الدليل: سجل المصادر وسيناريو المدينة والنموذج الأول والمختبر
 * ومخطط الرحلة. حذفُها كان سيُفقد التوثيق، وإبقاؤها على الشريط كان يُزاحم
 * المسار.
 *
 * فالمسار خمسة أقسام، والدليل خلف بابٍ واحد اسمه «التفاصيل المتقدمة»:
 *
 *   1. الرئيسية        — ما هذا؟ ولمن؟ وما الخطوة التالية؟
 *   2. الخريطة         — الحصيلة على الأرض، وهي ما يراه الساكن
 *   3. مكتب المراجع    — حيث يقع العمل والقرار
 *   4. نظرة عامة       — وصف النظام كاملاً في صفحة واحدة
 *   5. التفاصيل المتقدمة — الأدلة والصفحات التحليلية
 *
 * والصفحة المتقدمة تُعلِّم قسمها في الشريط بـ`aria-current`، فلا يفقد من فتحها
 * موقعه من الهيكل.
 */
(function () {
  'use strict';

  var PAGES = [
    { file: 'athar-home.html', label: 'الرئيسية' },
    { file: 'athar-map.html', label: 'الخريطة' },
    { file: 'athar-desk.html', label: 'مكتب المراجع' },
    { file: 'athar-overview.html', label: 'نظرة عامة' },
    { file: 'athar-advanced.html', label: 'التفاصيل المتقدمة' },
  ];

  /**
   * الصفحات التي يمثّلها قسم «التفاصيل المتقدمة».
   * مصدرها الحقيقي `athar-catalog.js`، وهو غير محمَّل على كل صفحة — فالقائمة
   * هنا نسخةٌ يحرس مطابقتَها `catalog-test.js`، لا فرعٌ يتقادم بصمت.
   */
  var ADVANCED_PAGES = [
    'athar-compare.html',
    'athar-sources.html',
    'athar-city-impact.html',
    'athar-decision.html',
    'athar-prototype.html',
    'athar-lab.html',
    'athar-journey.html',
  ];

  var current = (window.location.pathname.split('/').pop() || '').toLowerCase();
  if (!current) current = 'athar-home.html';

  // الوسوم تُحقن قبل قواعد الشريط كي تتوفر المتغيّرات لصفحة لا تستوردها بنفسها.
  // الصفحة التي تستوردها بنفسها لا تُحقن مرتين — الحقن احتياط لا قاعدة، وصفحة
  // تستورد وسومها في رأسها تنالها عند أول رسم لا بعد وصول هذا الملف.
  var hasTokens = Array.prototype.some.call(
    document.querySelectorAll('link[rel="stylesheet"]'),
    function (link) { return (link.getAttribute('href') || '').indexOf('athar-tokens.css') !== -1; }
  );

  if (!hasTokens) {
    var tokens = document.createElement('link');
    tokens.rel = 'stylesheet';
    tokens.href = 'athar-tokens.css';
    document.head.appendChild(tokens);
  }

  /* WP-G2 — الـ`nonce` يسافر مع النمط المحقون.
     سياسة أمن المحتوى تحجب أي `<style>` يُنشأ وقت التشغيل بلا `nonce`، فيبقى
     شريط التنقل بلا أنماط في كل صفحة **بلا رسالة خطأ ظاهرة للمستخدم**.
     المصدر الوحيد المشروع للقيمة هو وسم هذا السكربت نفسه: يضعه الخادم لكل
     طلب، فلا قيمة ثابتة تُخزَّن ولا تُخمَّن.
     `currentScript` يُقرأ هنا وقت التحميل — يصير `null` داخل أي نداء مؤجَّل. */
  var scriptNonce = (document.currentScript && document.currentScript.nonce) || '';

  var style = document.createElement('style');
  if (scriptNonce) style.setAttribute('nonce', scriptNonce);
  style.textContent =
    // خمسة روابط تتّسع في 390 بكسل بلا تمرير. والتمرير يبقى حارساً للغة أطول
    // أو خطٍّ أعرض: الفيض يُحبس في الشريط ولا يُزيح الجسد تحته.
    '.athar-nav{position:fixed;top:0;right:0;left:0;z-index:9;display:flex;gap:var(--athar-space-1);' +
    'align-items:center;background:var(--athar-surface);' +
    // safe center: يتوسّط ما دام يتّسع، ويعود إلى البداية حين يفيض. التوسيط
    // الأعمى مع التمرير يقصّ أول عنصر خارج المدى فلا يُبلغ إليه أبداً.
    'justify-content:center;justify-content:safe center;' +
    'border-bottom:1px solid var(--athar-line);box-shadow:var(--athar-shadow-sm);' +
    'padding:var(--athar-space-2) var(--athar-space-3);font-family:var(--athar-font);' +
    'overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none}' +
    '.athar-nav::-webkit-scrollbar{display:none}' +
    '.athar-nav a{color:var(--athar-ink);text-decoration:none;font-weight:700;font-size:13px;' +
    'border-radius:var(--athar-radius-sm);padding:6px 14px;border:1px solid transparent;' +
    'white-space:nowrap;flex:0 0 auto;' +
    'transition:color var(--athar-t-hover),background var(--athar-t-hover)}' +
    '.athar-nav a:hover{background:var(--athar-primary-soft);color:var(--athar-primary)}' +
    '.athar-nav a:focus-visible{outline:2px solid var(--athar-primary);outline-offset:2px}' +
    '.athar-nav a[aria-current="page"]{background:var(--athar-primary);color:#fff}' +
    // الصفحة المتقدمة تُعلّم قسمها بلا أن تدّعي أنها هو: نبرة أخف من الحالي.
    '.athar-nav a[data-section="true"]{background:var(--athar-primary-soft);' +
    'color:var(--athar-primary)}' +
    'body.athar-nav-offset{padding-top:46px}' +
    '.athar-nav.below-badge{top:40px}';
  document.head.appendChild(style);

  function build() {
    var nav = document.createElement('nav');
    nav.className = 'athar-nav';
    nav.setAttribute('aria-label', 'أقسام أثر');
    var inAdvanced = ADVANCED_PAGES.indexOf(current) !== -1;

    PAGES.forEach(function (page) {
      var link = document.createElement('a');
      link.href = page.file;
      link.textContent = page.label;

      if (page.file.toLowerCase() === current) {
        link.setAttribute('aria-current', 'page');
      } else if (inAdvanced && page.file === 'athar-advanced.html') {
        // القسم الحالي لا الصفحة الحالية: من فتح «سجل المصادر» يعرف أين هو منه.
        link.setAttribute('data-section', 'true');
        link.setAttribute('aria-current', 'true');
      }

      nav.appendChild(link);
    });

    var badge = document.getElementById('badge-representative');
    if (badge) nav.classList.add('below-badge');
    document.body.classList.add('athar-nav-offset');
    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
