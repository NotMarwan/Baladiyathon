/**
 * أثر — مُقلع صفحة رحلة المستخدم. تبويب مؤقّت (انظر رأس `athar-journey.html`).
 * يرسم المخطط من النموذج، ويبني جدول الإسناد من العقد نفسها — لا نسخة ثانية
 * تُحدَّث يدوياً فتفترق عن اللوحة.
 */
(function () {
  'use strict';

  var LANE_LABEL = { user: 'المراجع', system: 'النظام' };

  var KIND_LABEL = {
    start: 'بداية',
    end: 'نهاية',
    action: 'نشاط المراجع',
    system: 'نشاط النظام',
    decision: 'قرار',
    error: 'استثناء',
    terminal: 'نهاية فرع',
  };

  var canvas = document.getElementById('journeyCanvas');
  var body = document.querySelector('#journeyTrace tbody');

  if (!canvas || typeof AtharJourneyModel === 'undefined'
    || typeof AtharJourneyDiagram === 'undefined') {
    if (canvas) {
      canvas.innerHTML = '<p class="journey-fallback">تعذّر تحميل نموذج الرحلة — '
        + 'المخطط غير معروض. الجدول أدناه هو المرجع.</p>';
    }
    return;
  }

  canvas.innerHTML = AtharJourneyDiagram.render(AtharJourneyModel);

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  if (!body) return;

  // الترتيب ترتيب الرحلة نفسه: الصف يتبع الصعود في `row` ثم المسار الرئيس قبل
  // الجانبي، فيُقرأ الجدول كما تُقرأ اللوحة.
  var ordered = AtharJourneyModel.NODES.slice().sort(function (a, b) {
    if (a.row !== b.row) return a.row - b.row;
    return (a.side ? 1 : 0) - (b.side ? 1 : 0);
  });

  body.innerHTML = ordered.map(function (node) {
    return '<tr>'
      + '<td>' + escapeHtml(node.label)
      + (node.note ? '<br><span class="journey-kind" data-kind="system">'
        + escapeHtml(node.note) + '</span>' : '')
      + '</td>'
      + '<td><span class="journey-kind" data-kind="' + escapeHtml(node.kind) + '">'
      + escapeHtml(KIND_LABEL[node.kind] || node.kind) + '</span></td>'
      + '<td>' + escapeHtml(LANE_LABEL[node.lane] || node.lane) + '</td>'
      + '<td><code>' + escapeHtml(node.ref) + '</code></td>'
      + '</tr>';
  }).join('');
})();
