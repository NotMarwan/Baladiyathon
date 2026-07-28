'use strict';
/**
 * يجلب IBM Plex Sans Arabic مرة واحدة إلى assets/fonts/ — الناتج يُلتزم في المستودع.
 * ---------------------------------------------------------------------------
 * سياسة أمن المحتوى `default-src 'self'` (server.js) تحجب أي خط من شبكة توصيل،
 * فالاستضافة الذاتية ليست تفضيلاً بل الطريق الوحيد. وقبل هذا الملف لم يكن في
 * القرص ملف خط واحد: كل الواجهة كانت تُرسم بـSegoe UI، و٥٤ إعلان وزن تطلب
 * 800/900 من احتياطيٍّ يقف عند 700 — فيُصطنع العريض ويلطخ نقاط الحروف العربية.
 *
 * IBM Plex Sans Arabic يقف عند 700 أيضاً. الحدّ يُفرض في masar-fonts.css لا
 * بالأمل: كل ما فوق 700 يُخفَض هناك، فلا يعود اصطناع العريض ممكناً.
 *
 * المجموعتان المحمَّلتان: `arabic` و`latin`. اللاتينية ليست زينة — الأرقام في
 * هذا المنتج غربية (٠١٢ لا تظهر، انظر سياسة الأرقام في masar-engine.js)،
 * ومداها U+0030-0039 يقع في المجموعة اللاتينية وحدها. حذفها يعني أرقاماً
 * بخط احتياطي وسط نصٍّ بخط الهوية.
 * `cyrillic-ext` و`latin-ext` تُترك عمداً: لا محرف منهما في الواجهة.
 */
const fs = require('fs');
const path = require('path');

const FAMILY = 'IBM Plex Sans Arabic';
const WEIGHTS = [400, 500, 600, 700];
const SUBSETS = ['arabic', 'latin'];

// وكيل متصفح حديث: بدونه تُعيد Google صيغة truetype الأثقل بدل woff2.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const API = 'https://fonts.googleapis.com/css2?family='
  + FAMILY.replace(/ /g, '+') + ':wght@' + WEIGHTS.join(';') + '&display=swap';

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const CSS_TARGET = path.join(__dirname, '..', 'masar-fonts.css');

/** يفكّك ردّ Google إلى كتل: {subset, weight, unicodeRange, url}. */
function parseFaces(css) {
  var faces = [];
  var blocks = css.split('@font-face');
  var subset = null;

  blocks.forEach(function (block) {
    // اسم المجموعة يسبق كتلتها في تعليق مفرد — يُلتقط من ذيل الكتلة السابقة.
    var comments = block.match(/\/\*\s*([a-z-]+)\s*\*\//g);
    var pending = comments ? comments[comments.length - 1].replace(/[/*\s]/g, '') : null;

    var weight = (block.match(/font-weight:\s*(\d+)/) || [])[1];
    var url = (block.match(/url\((https:\/\/[^)]+\.woff2)\)/) || [])[1];
    var range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1];

    if (subset && weight && url && range) {
      faces.push({ subset: subset, weight: Number(weight), url: url, range: range.trim() });
    }
    subset = pending;
  });

  return faces;
}

async function main() {
  const response = await fetch(API, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`HTTP ${response.status} من Google Fonts`);
  const css = await response.text();

  const wanted = parseFaces(css).filter(function (f) {
    return SUBSETS.indexOf(f.subset) !== -1;
  });

  const expected = WEIGHTS.length * SUBSETS.length;
  if (wanted.length !== expected) {
    throw new Error(`توقّعت ${expected} كتلة خط ووجدت ${wanted.length} — تغيّر ردّ Google`);
  }

  fs.mkdirSync(FONT_DIR, { recursive: true });

  var total = 0;
  var rules = [];

  for (const face of wanted) {
    const name = `ibm-plex-sans-arabic-${face.weight}-${face.subset}.woff2`;
    const res = await fetch(face.url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status} عند ${name}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    // توقيع woff2: بدونه قد نكتب صفحة خطأ HTML باسم خط ويصمت الفشل.
    if (buffer.slice(0, 4).toString('ascii') !== 'wOF2') {
      throw new Error(`${name} ليس ملف woff2 — توقيع خاطئ`);
    }

    fs.writeFileSync(path.join(FONT_DIR, name), buffer);
    total += buffer.length;
    console.log(`  ${name}: ${Math.round(buffer.length / 1024)} كيلوبايت`);

    rules.push(
      '@font-face {\n'
      + `  font-family: "${FAMILY}";\n`
      + '  font-style: normal;\n'
      + `  font-weight: ${face.weight};\n`
      + '  font-display: swap;\n'
      + `  src: url("assets/fonts/${name}") format("woff2");\n`
      + `  unicode-range: ${face.range};\n`
      + '}'
    );
  }

  const header = '/* ==========================================================================\n'
    + '   مسار — الخط المستضاف ذاتياً\n'
    + `   مولَّد بـ scripts/fetch-fonts.js. لا تحرّره يدوياً — أعد تشغيل السكربت.\n`
    + '   ========================================================================== */\n\n';

  const clamp = '\n/* الأسرة تقف عند 700، وفي الشيفرة إعلانات 800 و900.\n'
    + '   المتصفح يسدّ الفرق باصطناع العريض: يُثخّن الحدّ برمجياً فتلتحم نقاط\n'
    + '   الحروف العربية وتُقرأ لطخة. المنع هنا لا بمطاردة كل إعلان — ومنعُه\n'
    + '   يجعل المتصفح ينزل إلى أقرب وزن حقيقي (700) بدل أن يخترع واحداً.\n'
    + '   `font-synthesis` الشامل احتياط للمتصفح الذي لا يعرف الخاصية المفردة؛\n'
    + '   والمائل ليس خسارة: لا مائل في الأسرة، ولا في الخط العربي أصلاً. */\n'
    + 'html { font-synthesis: none; font-synthesis-weight: none; }\n';

  fs.writeFileSync(CSS_TARGET, header + rules.join('\n\n') + '\n' + clamp);

  console.log(`\nالمجموع: ${Math.round(total / 1024)} كيلوبايت في ${wanted.length} ملف`);
  console.log('كُتب masar-fonts.css — اربطه قبل masar-tokens.css في كل صفحة');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
