/**
 * أثر — شريط التنقل الموحد بين صفحات العائلة الثلاث.
 * يُحقن ذاتياً عند التحميل. يعلّم الصفحة الحالية بـ aria-current.
 * إن وُجدت شارة مثبتة أعلى الصفحة (لوحة المدينة) ينزاح الشريط تحتها.
 */
(function () {
  'use strict';

  // الترتيب مقصود: المحكّم يفتح أول تبويب، وأول تبويب يجب أن يكون المنتج لا العرض.
  var PAGES = [
    { file: "athar-desk.html", label: 'مكتب المراجع' },
    { file: "athar-decision.html", label: 'شاشة القرار' },
    { file: "athar-map.html", label: 'الخريطة' },
    { file: "athar-prototype.html", label: 'النموذج التفاعلي' },
    { file: "athar-lab.html", label: 'مختبر الابتكار' },
    { file: "athar-city-impact.html", label: 'لوحة أثر المدينة' },
  ];

  var current = (window.location.pathname.split('/').pop() || '').toLowerCase();

  // الوسوم تُحقن قبل قواعد الشريط كي تتوفر المتغيّرات لصفحة لا تستوردها بنفسها.
  var tokens = document.createElement('link');
  tokens.rel = 'stylesheet';
  tokens.href = 'athar-tokens.css';
  document.head.appendChild(tokens);

  var style = document.createElement('style');
  style.textContent =
    '.athar-nav{position:fixed;top:0;right:0;left:0;z-index:9;display:flex;gap:var(--athar-space-1);' +
    'align-items:center;justify-content:center;background:var(--athar-surface);' +
    'border-bottom:1px solid var(--athar-line);box-shadow:var(--athar-shadow-sm);' +
    'padding:var(--athar-space-2) var(--athar-space-3);font-family:var(--athar-font)}' +
    '.athar-nav a{color:var(--athar-muted);text-decoration:none;font-weight:700;font-size:13px;' +
    'border-radius:var(--athar-radius-sm);padding:6px 14px;border:1px solid transparent;' +
    'transition:color var(--athar-t-hover),background var(--athar-t-hover)}' +
    '.athar-nav a:hover{background:var(--athar-primary-soft);color:var(--athar-primary)}' +
    '.athar-nav a:focus-visible{outline:2px solid var(--athar-primary);outline-offset:2px}' +
    '.athar-nav a[aria-current="page"]{background:var(--athar-primary);color:#fff}' +
    'body.athar-nav-offset{padding-top:46px}' +
    '.athar-nav.below-badge{top:40px}';
  document.head.appendChild(style);

  function build() {
    var nav = document.createElement('nav');
    nav.className = 'athar-nav';
    nav.setAttribute('aria-label', 'صفحات أثر');
    PAGES.forEach(function (page) {
      var link = document.createElement('a');
      link.href = page.file;
      link.textContent = page.label;
      if (page.file.toLowerCase() === current) link.setAttribute('aria-current', 'page');
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
