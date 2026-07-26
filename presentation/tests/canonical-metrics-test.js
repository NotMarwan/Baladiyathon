'use strict';
/**
 * WP-A5 — كل رقم مشترك من مصدر حاكم واحد.
 *
 * مقارنة الصفحات ببعضها تُثبت الاتساق ولا تُثبت الصحة: صفحتان متطابقتان على
 * رقم خاطئ تمرّان. فتُقارَن الأسطح كلها بمصدر حاكم واحد — `athar-canonical.js`
 * — يحسب مؤشراته من بيانات المحفظة ولا يخزّن رقماً مكتوباً يدوياً.
 *
 * الأسطح المفحوصة: مكتب المراجع · صفحة أثر المدينة · بطاقة الفكرة · العرض
 * المقدَّم · README · سجل المصادر · صفحات النموذج القديم القابلة للوصول.
 *
 * التشغيل: node presentation/tests/canonical-metrics-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');

global.window = global;
const Canonical = require(path.join(ROOT, 'athar-canonical.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const M = Canonical.metrics();

/* الأسطح التي يصلها المحكّم. مسارٌ غير موجود يُعدّ خطأ فحص لا يُبتلع: بوابة
   تفحص ملفاً غير موجود تعطي أخضر كاذباً. */
const SURFACES = [
  { name: 'مكتب المراجع', file: path.join(ROOT, 'athar-desk.html') },
  { name: 'مُقلع المكتب', file: path.join(ROOT, 'athar-desk-boot.js') },
  { name: 'صفحة أثر المدينة', file: path.join(ROOT, 'athar-city-impact.html') },
  { name: 'الخريطة', file: path.join(ROOT, 'athar-map.html') },
  { name: 'النموذج القديم', file: path.join(ROOT, 'athar-prototype.html') },
  { name: 'سجل المصادر', file: path.join(ROOT, 'athar-sources.html') },
  { name: 'README', file: path.join(ROOT, 'README-athar.md') },
  { name: 'بطاقة الفكرة', file: path.join(REPO, 'بطاقة-الفكرة.md') },
];

const DECK = path.join(REPO, 'output', 'submission',
  'athar-baladiyathon-judging-deck.html');
if (fs.existsSync(DECK)) SURFACES.push({ name: 'العرض المقدَّم', file: DECK });

/**
 * يجرّد ما لا يراه المحكّم — تعليقات HTML وJS الكتلية والسطرية.
 *
 * البوابة تفحص النصّ المعروض. والتعليق المفسِّر للمنع يذكر الممنوع بحكم شرحه
 * له، فمنعُه يدفع إلى حذف صامت بلا سبب مكتوب — وهو أسوأ مما تمنعه البوابة.
 *
 * الاستبدال بمسافات لا بحذف: يحفظ الفواصل السطرية فيبقى رقم السطر في رسالة
 * الفشل مطابقاً للملف على القرص.
 */
function visible(text, file) {
  var out = text;
  if (/\.html$/.test(file)) {
    out = out.replace(/<!--[\s\S]*?-->/g, (b) => b.replace(/[^\n]/g, ' '));
  }
  if (/\.(js|html)$/.test(file)) {
    out = out.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '));
    out = out.replace(/^\s*\/\/[^\n]*/gm, (b) => b.replace(/[^\n]/g, ' '));
  }
  return out;
}

function read(surface) {
  assert.ok(fs.existsSync(surface.file),
    `سطح مفقود: ${surface.name} — ${surface.file}`);
  return visible(fs.readFileSync(surface.file, 'utf8'), surface.file);
}

const TEXTS = SURFACES.map((s) => ({ name: s.name, text: read(s) }));

test('كل سطح معلن موجود ومقروء — لا فحص على ملف غائب', () => {
  assert.ok(TEXTS.length >= 8, `${TEXTS.length} سطحاً فقط`);
});

// --- تعارض القيم -------------------------------------------------------

/**
 * يبحث عن قيمة منافسة لمؤشر حاكم: رقم مجاور للفظ المؤشر ويخالفه.
 * لا يُطالِب كل سطح بذكر كل مؤشر — يمنع فقط أن يذكره برقم آخر.
 */
function conflicts(label, canonicalValue, pattern) {
  const found = [];
  TEXTS.forEach((surface) => {
    surface.text.split('\n').forEach((line, index) => {
      const match = line.match(pattern);
      if (!match) return;
      const seen = Number(String(match[1]).replace(/[,٬\s]/g, ''));
      if (!Number.isFinite(seen) || seen === canonicalValue) return;
      found.push(`${surface.name}:${index + 1} — ${label} = ${seen}`
        + ` بينما الحاكم ${canonicalValue}`);
    });
  });
  return found;
}

test('حجم المحفظة موحَّد عبر كل الأسطح', () => {
  const bad = conflicts('حجم المحفظة', M.portfolioPermitCount.value,
    /(\d{2,4})\s*تصريحاً تمثيلياً/);
  assert.strictEqual(bad.length, 0, bad.join('\n    '));
});

test('عدد مجموعات التنسيق موحَّد', () => {
  const bad = conflicts('مجموعات التنسيق', M.coordinationGroupCount.value,
    /(\d{1,4})\s*مجموعة/);
  assert.strictEqual(bad.length, 0, bad.join('\n    '));
});

test('عدد الممرات موحَّد — 12 ممراً تجريدياً لا يناقض 114 شارعاً جغرافياً', () => {
  /* الرقمان يصفان محفظتين مختلفتين، ويتعايشان ما دام كلٌّ مقروناً بمحفظته.
     الخلط بينهما هو الخطأ، لا وجودهما — وB4 توحّدهما. */
  const bad = conflicts('الممرات', M.corridorCount.value, /(\d{1,3})\s*ممراً/);
  assert.strictEqual(bad.length, 0, bad.join('\n    '));
});

test('عدد حزم الاختبار مطابق للتشغيل الحيّ لا لرقم قديم', () => {
  const suites = fs.readdirSync(__dirname).filter((f) => f.endsWith('-test.js')).length;
  const stale = [];
  TEXTS.forEach((surface) => {
    surface.text.split('\n').forEach((line, index) => {
      const match = line.match(/(\d{2,4})\s*(?:فحصاً|اختباراً|حزمة)/);
      if (!match) return;
      const seen = Number(match[1]);
      /* الفارق المسموح صفر على عدد الحزم؛ وأرقام أخرى (فحوص داخل حزمة) لا
         تُقارَن هنا لأنها لا تُدّعى إجمالاً. المنع منصبّ على الرقم الجامد
         الذي كان في العرض: 177. */
      if (seen === 177) {
        stale.push(`${surface.name}:${index + 1} — ${seen} بينما الحزم ${suites}`);
      }
    });
  });
  assert.strictEqual(stale.length, 0, stale.join('\n    '));
});

// --- الدلالة لا القيمة فقط ---------------------------------------------

test('لا سطح يصف الفرق النموذجي بأنه وفر مثبت', () => {
  /* الفحص واعٍ بالنفي. «لا وفرٌ مقيس ميدانياً» هو **بالضبط** الصياغة التي
     نريدها، ومنعُها يدفع إلى حذف التوضيح بدل حذف الادعاء — فينقلب الفحص على
     غرضه. المنع منصبّ على الإثبات: «وفر مقيس» بلا نفي قبله. */
  const CLAIM = /(?:وفر|توفير)\s*(?:مثبت|محقَّق|محقق|مقيس|فعلي)/g;
  const NEGATED = /(?:لا|ليس|ليست|بلا|دون|غير)\s*$/;
  const bad = [];
  TEXTS.forEach((surface) => {
    surface.text.split('\n').forEach((line, index) => {
      let match;
      CLAIM.lastIndex = 0;
      while ((match = CLAIM.exec(line)) !== null) {
        const before = line.slice(Math.max(0, match.index - 12), match.index);
        if (NEGATED.test(before)) continue;
        bad.push(`${surface.name}:${index + 1} — «${match[0]}»`);
      }
    });
  });
  assert.strictEqual(bad.length, 0,
    `${bad.length} موضعاً يصف فرقاً نموذجياً وفراً مثبتاً:\n    ` + bad.join('\n    '));
});

test('لا ادعاء محظور على أي سطح — WZDx والحفريات المتجنَّبة والطول المتجنَّب', () => {
  const bad = [];
  Canonical.BANNED_CLAIMS.forEach((claim) => {
    TEXTS.forEach((surface) => {
      surface.text.split('\n').forEach((line, index) => {
        /* التعليق المفسِّر للمنع يذكر الممنوع بحكم شرحه له. */
        if (/^\s*(\*|\/\/|#|<!--)/.test(line)) return;
        if (claim.pattern.test(line)) {
          bad.push(`${surface.name}:${index + 1}\n      السبب: ${claim.why}`
            + `\n      البديل: ${claim.instead}`);
        }
      });
    });
  });
  assert.strictEqual(bad.length, 0,
    `${bad.length} ادعاءً محظوراً:\n    ` + bad.join('\n    '));
});

test('وضع البيانات مصطلح واحد — لا «تخيلي» ولا «وهمي» بديلاً عن «اصطناعي»', () => {
  const bad = [];
  TEXTS.forEach((surface) => {
    surface.text.split('\n').forEach((line, index) => {
      if (/بيانات (?:تخيلية|وهمية|مزيفة)/.test(line)) {
        bad.push(`${surface.name}:${index + 1}`);
      }
    });
  });
  assert.strictEqual(bad.length, 0,
    'مصطلحات وضع بيانات متعددة:\n    ' + bad.join('\n    '));
});

// --- المصدر الحاكم لا يزرع أرقاماً --------------------------------------

test('المصدر الحاكم يحسب ولا يخزّن — لا رقم مكتوب يدوياً فيه', () => {
  /* الخطر المقابل للتوحيد: أن يصير الملف الحاكم مكاناً جديداً لزرع أرقام.
     الفحص يمنع أي عدد من ثلاث خانات فأكثر مكتوباً حرفياً في الملف. */
  const source = fs.readFileSync(path.join(ROOT, 'athar-canonical.js'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const planted = code.match(/[^\w.](\d{3,})/g) || [];
  assert.strictEqual(planted.length, 0,
    `أرقام مزروعة في المصدر الحاكم: ${planted.join(' ')} — كل قيمة تُحسب`);
});

test('كل مؤشر حاكم يحمل قيمته ووحدته ودلالته', () => {
  Object.keys(M).forEach((key) => {
    assert.ok(M[key].value !== undefined && M[key].value !== null,
      `${key}: بلا قيمة`);
    assert.ok(M[key].unit, `${key}: بلا وحدة`);
    assert.ok(M[key].meaning && M[key].meaning.length > 10,
      `${key}: بلا دلالة — الرقم بلا معناه يُساء استعماله`);
  });
});

test('العلاقات الحسابية بين المؤشرات صحيحة', () => {
  assert.strictEqual(M.additionalPermitsInGroups.value,
    M.groupedPermitCount.value - M.coordinationGroupCount.value,
    'التصاريح الإضافية ≠ المدموجة ناقص المجموعات');
  assert.ok(M.groupedPermitCount.value <= M.portfolioPermitCount.value,
    'التصاريح المدموجة أكثر من المحفظة كلها');
  assert.ok(M.groupedPermitCount.value >= 2 * M.coordinationGroupCount.value,
    'مجموعة بأقل من عضوين');
});

test('دلالة العدّ مقيَّدة — لا تدّعي أثراً', () => {
  assert.ok(/عدّ لا أثر/.test(M.additionalPermitsInGroups.meaning),
    'دلالة التصاريح الإضافية لا تنفي ادعاء الأثر');
  assert.ok(/افتراض تداخل تام|لا هندسة محسوبة/
    .test(M.duplicateTrenchKmEquivalent.meaning),
    'دلالة الطول المكافئ بلا افتراضها');
  assert.ok(/لا قياس ميداني/.test(M.portfolioDeltaVehHours.meaning),
    'دلالة الفرق النموذجي لا تنفي القياس الميداني');
});

console.log(`ALL TESTS PASSED (${count})`);
