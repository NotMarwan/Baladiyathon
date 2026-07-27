/**
 * مسار — شريط التنقل الموحد.
 * ---------------------------------------------------------------------------
 * ستة أقسام، لا ثمانية.
 *
 * كان الشريط يحمل ثمانية تبويبات متساوية الوزن — ثلاثة أساسية وخمسة خلف فاصل.
 * وثمانية خيارات على شريط واحد لا تقول للداخل من أين يبدأ ولا أين ينتهي؛ فمن
 * يفتح الأداة يقرأ قائمة مواضيع لا مساراً. والصفحات الخمس الأخيرة لم تكن
 * زائدة — هي الدليل: سجل المصادر وسيناريو المدينة والنموذج الأول والمختبر
 * ومخطط الرحلة. حذفُها كان سيُفقد التوثيق، وإبقاؤها على الشريط كان يُزاحم
 * المسار.
 *
 * فالمسار ستة أقسام، والدليل خلف بابٍ واحد اسمه «التفاصيل المتقدمة»:
 *
 *   1. الرئيسية        — ما هذا؟ ولمن؟ وما الخطوة التالية؟
 *   2. تجربة المستخدم  — كيف يصل التنبيه إلى الجهة وماذا تفعل به
 *   3. الخريطة         — الحصيلة على الأرض، وهي ما يراه الساكن
 *   4. مكتب المراجع    — حيث يقع العمل والقرار
 *   5. نظرة عامة       — وصف النظام كاملاً في صفحة واحدة
 *   6. التفاصيل المتقدمة — الأدلة والصفحات التحليلية
 *
 * والصفحة المتقدمة تُعلِّم قسمها في الشريط بـ`aria-current`، فلا يفقد من فتحها
 * موقعه من الهيكل.
 */
(function () {
  'use strict';

  var PAGES = [
    { file: 'masar-home.html', label: 'الرئيسية' },
    { file: 'masar-experience.html', label: 'تجربة المستخدم' },
    { file: 'masar-map.html', label: 'الخريطة' },
    { file: 'masar-desk.html', label: 'مكتب المراجع' },
    { file: 'masar-overview.html', label: 'نظرة عامة' },
    { file: 'masar-advanced.html', label: 'التفاصيل المتقدمة' },
  ];

  /**
   * الصفحات التي يمثّلها قسم «التفاصيل المتقدمة».
   * مصدرها الحقيقي `masar-catalog.js`، وهو غير محمَّل على كل صفحة — فالقائمة
   * هنا نسخةٌ يحرس مطابقتَها `catalog-test.js`، لا فرعٌ يتقادم بصمت.
   */
  var ADVANCED_PAGES = [
    'masar-compare.html',
    'masar-sources.html',
    'masar-city-impact.html',
    'masar-decision.html',
    'masar-prototype.html',
    'masar-lab.html',
    'masar-journey.html',
  ];

  var current = (window.location.pathname.split('/').pop() || '').toLowerCase();
  if (!current) current = 'masar-home.html';

  // الوسوم تُحقن قبل قواعد الشريط كي تتوفر المتغيّرات لصفحة لا تستوردها بنفسها.
  // الصفحة التي تستوردها بنفسها لا تُحقن مرتين — الحقن احتياط لا قاعدة، وصفحة
  // تستورد وسومها في رأسها تنالها عند أول رسم لا بعد وصول هذا الملف.
  var hasTokens = Array.prototype.some.call(
    document.querySelectorAll('link[rel="stylesheet"]'),
    function (link) { return (link.getAttribute('href') || '').indexOf('masar-tokens.css') !== -1; }
  );

  if (!hasTokens) {
    var tokens = document.createElement('link');
    tokens.rel = 'stylesheet';
    tokens.href = 'masar-tokens.css';
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
    // ستة روابط تفيض على الهاتف عمداً: التمرير يبقي حجم النص ومجال اللمس
    // صالحين، والفيض يُحبس في الشريط ولا يُزيح الجسد تحته.
    '.masar-nav{position:fixed;top:0;right:0;left:0;z-index:9;display:flex;gap:var(--masar-space-1);' +
    'align-items:center;background:var(--masar-surface);' +
    // safe center: يتوسّط ما دام يتّسع، ويعود إلى البداية حين يفيض. التوسيط
    // الأعمى مع التمرير يقصّ أول عنصر خارج المدى فلا يُبلغ إليه أبداً.
    'justify-content:center;justify-content:safe center;' +
    'border-bottom:1px solid var(--masar-line);box-shadow:var(--masar-shadow-sm);' +
    'padding:var(--masar-space-2) var(--masar-space-3);font-family:var(--masar-font);' +
    'overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none}' +
    '.masar-nav::-webkit-scrollbar{display:none}' +
    '.masar-nav a{color:var(--masar-ink);text-decoration:none;font-weight:700;font-size:13px;' +
    'border-radius:var(--masar-radius-sm);padding:6px 14px;border:1px solid transparent;' +
    'white-space:nowrap;flex:0 0 auto;' +
    'transition:color var(--masar-t-hover),background var(--masar-t-hover)}' +
    '.masar-nav a:hover{background:var(--masar-primary-soft);color:var(--masar-primary)}' +
    '.masar-nav a:focus-visible{outline:2px solid var(--masar-primary);outline-offset:2px}' +
    '.masar-nav a[aria-current="page"]{background:var(--masar-primary);color:#fff}' +
    // الصفحة المتقدمة تُعلّم قسمها بلا أن تدّعي أنها هو: نبرة أخف من الحالي.
    '.masar-nav a[data-section="true"]{background:var(--masar-primary-soft);' +
    'color:var(--masar-primary)}' +
    'body.masar-nav-offset{padding-top:46px}' +
    '.masar-nav.below-badge{top:40px}';
  document.head.appendChild(style);

  function build() {
    var nav = document.createElement('nav');
    nav.className = 'masar-nav';
    nav.setAttribute('aria-label', 'أقسام أثر');
    var inAdvanced = ADVANCED_PAGES.indexOf(current) !== -1;

    PAGES.forEach(function (page) {
      var link = document.createElement('a');
      link.href = page.file;
      link.textContent = page.label;

      if (page.file.toLowerCase() === current) {
        link.setAttribute('aria-current', 'page');
      } else if (inAdvanced && page.file === 'masar-advanced.html') {
        // القسم الحالي لا الصفحة الحالية: من فتح «سجل المصادر» يعرف أين هو منه.
        link.setAttribute('data-section', 'true');
        link.setAttribute('aria-current', 'true');
      }

      nav.appendChild(link);
    });

    var badge = document.getElementById('badge-representative');
    if (badge) nav.classList.add('below-badge');
    document.body.classList.add('masar-nav-offset');
    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
