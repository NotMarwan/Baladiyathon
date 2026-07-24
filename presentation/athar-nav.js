/**
 * أثر — شريط التنقل الموحد بين صفحات العائلة الثلاث.
 * يُحقن ذاتياً عند التحميل. يعلّم الصفحة الحالية بـ aria-current.
 * إن وُجدت شارة مثبتة أعلى الصفحة (لوحة المدينة) ينزاح الشريط تحتها.
 */
(function () {
  'use strict';

  var PAGES = [
    { file: "athar-prototype.html", label: 'النموذج التفاعلي' },
    { file: "athar-lab.html", label: 'مختبر الابتكار' },
    { file: "athar-city-impact.html", label: 'لوحة أثر المدينة' },
    { file: "athar-map.html", label: 'الخريطة' },
  ];

  var current = (window.location.pathname.split('/').pop() || '').toLowerCase();

  var style = document.createElement('style');
  style.textContent =
    '.athar-nav{position:fixed;top:0;right:0;left:0;z-index:9;display:flex;gap:6px;justify-content:center;' +
    'background:#102535;padding:7px 10px;font-family:"Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif}' +
    '.athar-nav a{color:#d4e2e8;text-decoration:none;font-weight:800;font-size:13px;border-radius:999px;' +
    'padding:5px 14px;border:1px solid transparent}' +
    '.athar-nav a:hover{border-color:#efbc6e;color:#fff}' +
    '.athar-nav a[aria-current="page"]{background:#efbc6e;color:#231a08}' +
    'body.athar-nav-offset{padding-top:44px}' +
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
