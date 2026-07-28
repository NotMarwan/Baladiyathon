'use strict';
/**
 * ختمُ عدد الحزم في العرض التفصيلي من الجرد — بدل كتابته باليد.
 * ---------------------------------------------------------------------------
 * الشريحة السابعة عشرة كانت تعلن «‎N / N‎ حزمة تحقق تمرّ كاملةً». وكان الرقم **مكتوباً
 * يدوياً في الـHTML المبني**، فتقادم ثلاث مرات في يومين مع كل حزمة تُضاف:
 * ٧٧ ⟵ ٨٠ ⟵ ٨١ ⟵ ٨٢. وفي كل مرة تسقط `deck-numbers-test` و`deck-text-test`،
 * ويُقرأ سقوطهما عطلاً في عمل من أضاف الحزمة وهو ليس منه.
 *
 * والعلّة بنيوية لا سهوٌ متكرّر: عرض المنصة (١٣ شريحة) يُبنى من
 * `deck-manifest.json` برموز `data-fig`، فلا يتقادم رقمٌ فيه أبداً. أما العرض
 * التفصيلي (٢١ شريحة) فلم يعد يُبنى من `tools/deck-build/slides-*.html` — تلك
 * مقاطع من حقبة التسع عشرة شريحة — وصار الـHTML المبني هو المصدر الحيّ. فبقي
 * رقمه خارج كل توليد.
 *
 * هذا السكربت يسدّ الفجوة: يقرأ العدد من الجرد ويختمه في موضعه. ويُستدعى من
 * `tools/deck-build/export-masar-pdf.cjs` قبل التصيير، فلا يمكن أن يُبنى PDF من
 * HTML متقادم.
 *
 * ولا يخترع رقماً: مصدره `presentation/tests/fixtures/test-manifest.json`
 * المولَّد من تشغيلٍ أخضر وحده.
 *
 * WP — «الناجح» لا «الناجح مرتين». كانت الحزمة المعلَّقة (`PENDING` في
 * `run-all.js`) تسقط من الجرد بلا أثر، فيبدو «N/N» اكتمالاً بلا استثناء —
 * وهو عين ما يسأل عنه فريقٌ أحمر مستقل. الختّام الآن يقرأ `pendingSuites`
 * من الجرد ويضمّها إلى المقام: «الناجح / (الناجح + المعلَّق)». جردٌ سابقٌ
 * على هذا الحقل يُعامَل بتساهل (0 معلَّق) لا بسقوط — الحقل جديد، وتشغيلة
 * خضراء واحدة تكفي لملئه؛ أما قيمة **فاسدة** لهذا الحقل (سالبة أو غير رقمية)
 * فتُسقط الختّام كما تُسقطه قيمة فاسدة في `suites`.
 *
 * التشغيل: node presentation/scripts/sync-deck-counts.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const MANIFEST = path.join(ROOT, 'tests', 'fixtures', 'test-manifest.json');

/* الملفان اللذان يحملان الرقم. الثاني وسيطٌ يولّده مُصدِّر الـPDF، ويُختم
   كذلك كي لا يبقى في الشجرة أثرٌ يقول رقماً آخر. */
const TARGETS = [
  path.join(REPO, 'output', 'submission', 'masar-baladiyathon-judging-deck.html'),
  path.join(REPO, 'tools', 'deck-build', 'masar-pdf-only.html'),
];

/**
 * الموضع محدَّد بجاره لا بالرقم وحده.
 *
 * `[٠-٩]+ / [٠-٩]+` وحده يطابق أرقام الشرائح («16 / 21») وغيرها. فاللاحقة
 * `</div><p class="lead">حزمة تحقق` تثبّت الموضع على بطاقة واحدة بعينها.
 *
 * لم يتغيّر التعبير حين صار الختّام «الناجح / الإجمالي» بدل «N / N»: اللاحقة
 * تتحقق من الحرفين الأولين لنصّ الفقرة («حزمة تحقق») لا مما بعدهما، ونصّ
 * الفقرة الجديد ما زال يبدأ بهما. تغييرٌ يبدّل أول الفقرة نفسها هو ما يستدعي
 * تحديث هذا التعبير.
 */
const COUNT_PATTERN = /[٠-٩]+ \/ [٠-٩]+(?=<\/div><p class="lead">حزمة تحقق)/g;

function toArabicDigits(value) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

function syncDeckCounts({ quiet = false } = {}) {
  if (!fs.existsSync(MANIFEST)) {
    throw new Error(`الجرد غير موجود: ${MANIFEST}\n`
      + '  شغّل `npm test` حتى يخضرّ — الجرد يُكتب من التشغيل الأخضر وحده.');
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (!(manifest.suites > 0)) {
    throw new Error(`جرد بلا عدد حزم صالح: ${JSON.stringify(manifest)}`);
  }

  /* `pendingSuites` غائبٌ عن جرودٍ سابقة على هذا الحقل — يُعامَل صفراً لا
     سقوطاً كي لا يوقف بناء العرض كله لمجرد أن الجرد لم يُعَد توليده بعد.
     أما وجوده بقيمة فاسدة (سالبة أو ليست عدداً صحيحاً) فسقوطٌ فعلي: تلك
     حالة تلف لا حالة جردٍ قديم. */
  const pendingSuites = manifest.pendingSuites === undefined ? 0 : manifest.pendingSuites;
  if (!Number.isInteger(pendingSuites) || pendingSuites < 0) {
    throw new Error(`جرد بعدد حزم معلَّقة غير صالح (pendingSuites): ${JSON.stringify(manifest)}`);
  }

  /* الإجمالي يضمّ المعلَّقة كي لا تُسقَط من المقام كما كانت تُسقَط من البسط —
     هذا هو صلب الإصلاح: «الناجح / (الناجح + المعلَّق)» لا «الناجح / نفسه». */
  const total = manifest.suites + pendingSuites;
  const stamp = `${toArabicDigits(manifest.suites)} / ${toArabicDigits(total)}`;
  const changed = [];

  TARGETS.forEach((file) => {
    if (!fs.existsSync(file)) return;
    const before = fs.readFileSync(file, 'utf8');
    const hits = before.match(COUNT_PATTERN);

    /* الصمت أخطر من السقوط هنا.
       لو تغيّر ترميز الشريحة فلم يطابق التعبير، لمرّ السكربت «ناجحاً» وبقي
       الرقم متقادماً — وهو بالضبط العطل الذي وُضع لمنعه. */
    if (!hits || !hits.length) {
      throw new Error(`لم يُعثر على موضع عدد الحزم في ${path.basename(file)}.\n`
        + '  تغيّر ترميز الشريحة السابعة عشرة؟ حدّث `COUNT_PATTERN` في هذا الملف.\n'
        + '  السكربت يسقط ولا يمرّ صامتاً: رقمٌ متقادم يصل اللجنة أسوأ من بناءٍ يفشل.');
    }

    const after = before.replace(COUNT_PATTERN, stamp);
    if (after !== before) {
      fs.writeFileSync(file, after, 'utf8');
      changed.push(`${path.basename(file)}: ${hits[0]} ⟵ ${stamp}`);
    }
  });

  if (!quiet) {
    console.log(changed.length
      ? `عدد الحزم ${stamp} — ${changed.join(' · ')}`
      : `عدد الحزم ${stamp} — مطابق بالفعل`);
  }
  return { suites: manifest.suites, pendingSuites, total, stamp, changed };
}

module.exports = { syncDeckCounts, toArabicDigits };

if (require.main === module) {
  try {
    syncDeckCounts();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
