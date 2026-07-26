/**
 * أثر — بناء صفحات الفهرس الثلاث من `athar-catalog.js`.
 * ---------------------------------------------------------------------------
 * لماذا بناءٌ لا تصييرٌ في المتصفح: هذه الصفحات هي ما يقرؤه من يريد أن يفهم
 * المشروع — قارئ صوتي، مفهرس، نظام تقييم آلي، أو مطوّر يفتح الملف. وصفحةٌ
 * محتواها لا يوجد إلا بعد تنفيذ سكربت تُقرأ فارغةً عند كل واحد من هؤلاء.
 * فالنص يُكتب في الـ HTML، ويبقى مصدره واحداً: هذا السكربت.
 *
 * والقاعدة محروسة لا موصى بها: `catalog-test.js` يعيد البناء في الذاكرة
 * ويقارنه بالمكتوب، فيفشل إن تغيّر الفهرس ولم تُبنَ الصفحات بعده.
 *
 *   node presentation/scripts/build-catalog-pages.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const View = require(path.join(ROOT, 'athar-catalog-view.js'));

const START = '<!-- catalog:start -->';
const END = '<!-- catalog:end -->';

const PAGES = [
  { file: 'athar-home.html', render: View.renderHome },
  { file: 'athar-overview.html', render: function () {
    return View.renderOverviewIndex() + View.renderOverview();
  } },
  { file: 'athar-advanced.html', render: View.renderAdvanced },
];

/** يستبدل ما بين العلامتين. غيابهما خطأ صريح لا كتابةٌ في غير موضعها. */
function inject(html, body, file) {
  const from = html.indexOf(START);
  const to = html.indexOf(END);
  if (from === -1 || to === -1 || to < from) {
    throw new Error('علامتا الحقن مفقودتان أو مقلوبتان في ' + file);
  }
  return html.slice(0, from + START.length) + '\n' + body + '\n' + html.slice(to);
}

function build(page) {
  const full = path.join(ROOT, page.file);
  const html = fs.readFileSync(full, 'utf8');
  return { full, next: inject(html, page.render(), page.file) };
}

/** يعيد ما ينبغي أن تكونه كل صفحة — يستعمله الاختبار بلا كتابة على القرص. */
function expected() {
  const out = {};
  PAGES.forEach((page) => {
    out[page.file] = build(page).next;
  });
  return out;
}

function main() {
  PAGES.forEach((page) => {
    const result = build(page);
    fs.writeFileSync(result.full, result.next, 'utf8');
    console.log('بُنيت ' + page.file);
  });
}

module.exports = { expected, PAGES, START, END };

if (require.main === module) main();
