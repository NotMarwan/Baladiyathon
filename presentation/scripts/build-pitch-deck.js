'use strict';
/**
 * عرض المنصة — اثنتا عشرة شريحة تُبنى من الجرد لا من الذاكرة.
 *
 * العرض التفصيلي (٢١ شريحة) يبقى كما هو للمحكّم الذي يقرأ. وهذا العرض لما
 * يُقال على المنصة: خانة الهاكاثون خمس إلى ثماني دقائق، وواحدٌ وعشرون شريحة
 * تعني خمس عشرة ثانية لكل شريحة — وهو مستحيل عملياً.
 *
 * والقاعدة الحاكمة نفسها: **لا رقم مكتوب يدوياً**. كل رقم في القالب رمزٌ
 * `data-fig="key"` يُملأ من `output/submission/deck-manifest.json` عند البناء،
 * فإن غاب المفتاح سقط البناء. والرقم المنسوخ يدوياً يتقادم صامتاً — وهذا
 * بالضبط ما جعل العرض السابق يقول «أكثر من تسعمئة فحص» والحقيقة 1,214.
 *
 * والشعارات تُضمَّن base64 كي يبقى الملف مكتفياً بذاته: يُفتح من أي مكان،
 * ويُطبع PDF بلا خادم، ولا يكسره نقل مجلد.
 *
 * التشغيل: node presentation/scripts/build-pitch-deck.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const SRC = path.join(ROOT, 'deck', 'masar-pitch-deck.src.html');
const MANIFEST = path.join(REPO, 'output', 'submission', 'deck-manifest.json');
const OUT = path.join(REPO, 'output', 'submission', 'masar-pitch-deck.html');

/**
 * يصوغ الرقم للعرض: الصحيح بفواصل الآلاف، والكسري بمنزلة واحدة.
 *
 * أرقام لاتينية عمداً. الجرد يحملها لاتينية، والمحكّم يقارن الشريحة بالجرد —
 * فتحويلها إلى هندية يضيف خطوة ترجمة بين ما يُقال وما يُفحص.
 *
 * @param {number|string} value
 * @returns {string}
 */
function fmt(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return value.toLocaleString('en-US');
  return Number(value.toFixed(1)).toLocaleString('en-US');
}

/**
 * المسموح خارج الجرد، وكلٌّ بسببه المكتوب. قائمة بلا أسباب تتحول إلى مكبّ.
 *
 *   4.2  — نسخة مخطط WZDx: اسم معيار لا قياس.
 *   2026 — سنة الهاكاثون.
 *   0045 — جزء من معرّف التصريح BLD-2026-0045.
 *   14.9 — المسافة إلى أقرب عدّاد رسمي، من مسح المصادر لا من المحفظة.
 *   500  — عتبة الجوار في المسح نفسه.
 */
const ALLOWED = /^(4\.2|2026|0045|14\.9|500)$/;

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const figures = new Map();
  Object.values(manifest.figures).forEach((row) => figures.set(row.key, row));

  let html = fs.readFileSync(SRC, 'utf8');
  const missing = new Set();
  let filled = 0;

  /* الترتيب مقصود: `data-unit` أولاً، وإلا التقط النمط الأعمّ سمةَ الوحدة
     وكتب فيها القيمة العددية. */
  html = html.replace(/data-unit="(\w+)"\s*>\s*</g, function (whole, key) {
    const row = figures.get(key);
    if (!row) { missing.add(key); return whole; }
    filled += 1;
    return 'data-unit="' + key + '">' + row.unit + '<';
  });

  html = html.replace(/data-fig="(\w+)"([^>]*)>\s*</g, function (whole, key, rest) {
    const row = figures.get(key);
    if (!row) { missing.add(key); return whole; }
    filled += 1;
    return 'data-fig="' + key + '"' + rest + '>' + fmt(row.value) + '<';
  });

  if (missing.size) {
    throw new Error('مفاتيح غائبة عن الجرد: ' + [...missing].join('، ')
      + '\n  رقمٌ لا يوجد في الجرد لا يجوز أن يظهر في شريحة. أضِفه إلى '
      + 'masar-canonical.js وأعد توليد الجرد، أو صحّح المفتاح.');
  }

  /* بوابة الرقم بلا سند — العيب الذي أوقع العرض السابق حرفياً.
     تُفحص النصوص المرئية وحدها: خارج CSS، وخارج التعليقات، وخارج الوسوم،
     وبعد ملء الرموز — فما يبقى رقماً هو ما كتبه إنسان في الشريحة. */
  const visible = html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const ledgerValues = new Set([...figures.values()].map(function (row) {
    return fmt(row.value);
  }));
  const unbacked = [];
  visible.split('\n').forEach(function (line) {
    const text = line.trim();
    if (!text) return;
    (text.match(/\d[\d,.]*\d|\d/g) || []).forEach(function (n) {
      if (ALLOWED.test(n) || ledgerValues.has(n)) return;
      unbacked.push(n + '  <=  ' + text.slice(0, 52));
    });
  });
  if (unbacked.length) {
    throw new Error(unbacked.length + ' رقماً بلا سند في الجرد:\n  '
      + unbacked.join('\n  ')
      + '\n  كل رقم يحتاج سطراً في الجرد، أو إدراجاً صريحاً في ALLOWED مع سببه.');
  }

  /* تضمين الشعارات — يبقى الملف مكتفياً بذاته. */
  let embedded = 0;
  html = html.replace(/src="([^"]+\.png)"/g, function (whole, rel) {
    const file = path.resolve(path.dirname(SRC), rel);
    if (!fs.existsSync(file)) throw new Error('صورة مفقودة: ' + rel);
    embedded += 1;
    return 'src="data:image/png;base64,' + fs.readFileSync(file).toString('base64') + '"';
  });

  fs.writeFileSync(OUT, html, 'utf8');
  const slides = (html.match(/class="slide/g) || []).length;
  console.log(slides + ' شريحة · ' + filled + ' رقماً من الجرد · '
    + embedded + ' صورة مضمَّنة');
  console.log(OUT);
}

main();
