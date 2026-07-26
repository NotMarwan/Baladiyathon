'use strict';
/**
 * WP-N1 — كل رقم في العرض التقديمي له مصدر.
 *
 * القاعدة الحمراء تنصّ عليها حرفياً: «رقم في العرض بلا مصدر مباشر». ولم تكن
 * مفحوصة — `submission-deck-test.js` يفحص بنية العرض لا أرقامه.
 *
 * ---------------------------------------------------------------------------
 * **حدٌّ يجب قوله قبل أي نتيجة خضراء هنا.**
 *
 * العرض خمسٌ وعشرون صورة مضمَّنة وستة آلاف محرف نصّ. فأكثر ما يقرؤه المحكّم
 * **داخل الصور**، وأي رقم فيها لا يصل إليه هذا الفحص ولا أي فحص آلي.
 *
 * فما تثبته هذه الحزمة: أن كل رقم في **النصّ الظاهر** له واحد من ثلاثة —
 * مصدر رسمي، أو اشتقاق من تشغيل المشروع نفسه، أو وسم صريح بأنه مقترح.
 * وما لا تثبته: أرقام الصور. وللبوابة فحصٌ يحرس هذا الحدّ نفسه كي لا يُنسى:
 * إن ارتفع نصيب الصور فجأة، فذلك تحوّلٌ من محتوى مفحوص إلى محتوى لا يُفحص.
 *
 * التشغيل: node presentation/tests/deck-numbers-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const DECK = path.join(REPO, 'output', 'submission',
  'athar-baladiyathon-judging-deck.html');
const MANIFEST = path.join(__dirname, 'fixtures', 'test-manifest.json');

global.window = global;
const Canonical = require(path.join(ROOT, 'athar-canonical.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const RAW = fs.readFileSync(DECK, 'utf8');

/**
 * النصّ الذي يقرؤه إنسان: بلا شيفرة ولا أنماط ولا أصول مضمَّنة.
 *
 * الوسوم السطرية تبقى **ملتصقة** بنصّها. أول صياغة قطعت عند كل وسم، فانفصل
 * «٢٠–٣٠ تصريحًا» عن «نطاق تجنيد مقترح» الملاصق له في العنصر نفسه، فبدا
 * رقماً بلا وسم. **مقطّعُ النصّ يصنع العيب الذي يبلّغ عنه** إن قطع حيث لا
 * يقطع القارئ.
 */
const INLINE_TAGS = /<\/?(?:strong|em|b|i|span|a|code|small|sup|sub)\b[^>]*>/gi;

function visibleBlocks() {
  return RAW
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\sstyle="[^"]*"/gi, ' ')
    .replace(/data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(INLINE_TAGS, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const BLOCKS = visibleBlocks();
const ARABIC_DIGITS = /[٠-٩]/;

/**
 * فئات الأرقام المقبولة — **بأسبابها لا كقائمة أرقام**.
 *
 * قائمةُ أرقامٍ مسموحة تتمدّد كلما أزعج الفحص أحداً. الفئة لا تتمدّد: رقمٌ
 * جديد إمّا يقع في فئة قائمة أو يسقط الفحص.
 */
const ACCEPTED = [
  {
    key: 'slide-number',
    why: 'ترقيم الشرائح — بنية العرض لا ادعاء',
    matches: (block) => /^[٠-٩\d]+\s*\/\s*[٠-٩\d]+$/.test(block),
  },
  {
    key: 'ordinal',
    /* رقمُ خطوةٍ بلا وحدة ولا مقارَن: «١» فوق «بوابة الجودة» علامةُ ترتيب،
       لا كمّية تُسأل عن مصدرها. والشرط ضيّق عمداً — خانة واحدة وحدها، أو
       رقمٌ متبوع بنقطة في أول السطر. */
    why: 'ترقيم خطوات مسلسلة — علامة ترتيب لا كمّية',
    matches: (block) => /^[٠-٩]\.\s/.test(block) || /^[١-٩]$/.test(block),
  },
  {
    key: 'year',
    why: 'سنة الحدث — واقعة لا قياس',
    matches: (block) => /٢٠٢٦/.test(block) && !/[٠-٩]{3}/.test(
      block.replace(/٢٠٢٦/g, '')
    ),
  },
  {
    key: 'self-derived',
    why: 'مشتقّ من تشغيل المشروع نفسه ومفحوص أدناه بمقارنة الجرد',
    matches: (block) => /فحصًا|فحصاً|حزمة تحقق/.test(block),
  },
  {
    key: 'proposed',
    why: 'عتبة مقترحة داخل بروتوكول موسوم «مقترح» — لا نتيجة',
    matches: (block) => /مقترح|مقاسة على الأقل|منفعة كلية/.test(block),
  },
];

function classify(block) {
  return ACCEPTED.find((entry) => entry.matches(block)) || null;
}

// ---- الحدّ المعلن ---------------------------------------------------------

test('الحدّ معلن: العرض صور في أغلبه، وأرقام الصور خارج أي فحص آلي', () => {
  const images = (RAW.match(/<img/g) || []).length;
  const text = BLOCKS.join(' ').length;
  assert.ok(images >= 20, `${images} صورة فقط — الحدّ المكتوب لم يعد يصف العرض`);
  assert.ok(text > 3000, `${text} محرفاً — النصّ الظاهر أقصر من أن يُفحص`);
  const header = fs.readFileSync(__filename, 'utf8').slice(0, 1600);
  assert.ok(/داخل الصور/.test(header),
    'الحزمة لا تعلن حدّها — نتيجةٌ خضراء بلا حدّها تُقرأ تغطيةً كاملة');
});

// ---- كل رقم في فئة -------------------------------------------------------

test('كل كتلة نصّية فيها رقم تقع في فئة مقبولة معلَّلة', () => {
  const orphans = [];
  BLOCKS.forEach((block, index) => {
    if (!ARABIC_DIGITS.test(block) && !/\d/.test(block)) return;
    if (classify(block)) return;
    orphans.push(`[${index}] ${block.slice(0, 90)}`);
  });
  assert.deepStrictEqual(orphans, [],
    `${orphans.length} رقماً بلا مصدر ولا وسم:\n    ${orphans.join('\n    ')}`);
});

test('الفئات كلها مستعملة — لا فئة تُضاف لتمرير رقم ثم تُنسى', () => {
  /* فئةٌ بلا مطابق واحد بابٌ فُتح لرقمٍ زال، وتبقى مفتوحة لغيره. */
  const used = new Set();
  BLOCKS.forEach((block) => {
    const entry = classify(block);
    if (entry) used.add(entry.key);
  });
  ACCEPTED.forEach((entry) => {
    assert.ok(used.has(entry.key),
      `الفئة «${entry.key}» بلا مطابق في العرض — باب مفتوح بلا ساكن`);
  });
});

// ---- الأرقام المشتقّة تطابق مصدرها ---------------------------------------

test('عدد الفحوص والحزم في العرض يطابق جرد التشغيل', () => {
  /* الجرد يُكتب من `run-all.js` عند تشغيل أخضر — أي أن الرقم يُنتَج من فعل
     التشغيل لا يُكتب يدوياً. وكان العرض يقول «١٧٧ فحصاً» والحقيقة قرابة
     الألف: رقمٌ مكتوب في شريحة يتقادم في أسبوع ولا ينبّه أحد. */
  assert.ok(fs.existsSync(MANIFEST),
    'جرد التشغيل غائب — شغّل: node presentation/tests/run-all.js');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  assert.ok(manifest.checks > 0 && manifest.suites > 0, 'جرد فارغ');

  const toArabic = (value) => String(value).replace(/\d/g,
    (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);

  /* عدد الحزم يُعرض بالضبط: يتغيّر نادراً، و«ستون من ستين» جملةٌ ذات معنى.
     أمّا عدد الفحوص فيُعرض **أرضيةً**: رقمٌ دقيق يتقادم مع كل فحص يُضاف،
     فيصير العرض يكذب بعد ساعة من صدقه. والأرضية لا تكذب أبداً — لكنها
     تكذب على نفسها إن بقيت بعيدة جداً عن الحقيقة، فلها حدّان. */
  const suites = toArabic(manifest.suites);
  assert.ok(RAW.indexOf(`${suites} / ${suites}`) !== -1,
    `العرض لا يعرض «${manifest.suites} / ${manifest.suites}» — عدد الحزم متقادم`);

  const FLOOR = 900;
  assert.ok(manifest.checks >= FLOOR,
    `العرض يعلن أكثر من ${FLOOR} فحص والحقيقة ${manifest.checks} — ادعاء فوق الواقع`);
  assert.ok(manifest.checks < FLOOR * 1.6,
    `الأرضية ${FLOOR} بعيدة عن ${manifest.checks} — أرضيةٌ متقادمة تبخس العمل `
    + 'وتُقرأ إهمالاً. ارفعها.');
  assert.ok(/أكثر من تسعمئة فحص/.test(RAW),
    'العرض لا يعرض الأرضية بصيغتها المفحوصة');

  /* والرقم القديم لا يبقى في مكان آخر من العرض. */
  const stale = BLOCKS.filter((block) => /١٧٧/.test(block));
  assert.deepStrictEqual(stale, [],
    `العدد المتقادم ١٧٧ باقٍ:\n    ${stale.join('\n    ')}`);
});

test('لا تفصيل مخترع لتوزيع الفحوص على الطبقات', () => {
  /* كان العرض يعرض «٦٢ محرك · ١٥ واجهة · ٢١ توجيه…» — ثمانية أرقام مجموعها
     ١٧٧، لا يقابلها تقسيم قائم في المستودع. تفصيلٌ دقيق المظهر بلا مصدر
     أسوأ من مجملٍ صادق. */
  const invented = BLOCKS.filter((block) => /محرك\s*·\s*[٠-٩]+\s*واجهة/.test(block));
  assert.deepStrictEqual(invented, [],
    `تفصيل بلا مصدر:\n    ${invented.join('\n    ')}`);
});

// ---- الاتساق مع المصدر الحاكم --------------------------------------------

test('أي مؤشّر حاكم يظهر في العرض يطابق athar-canonical.js', () => {
  /* العرض سطحٌ مثل غيره. ظهور رقم المحفظة فيه بقيمة أخرى هو التناقض نفسه
     الذي بُني له المصدر الحاكم. */
  const metrics = Canonical.metrics();
  const toArabic = (value) => String(value).replace(/\d/g,
    (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
  const text = BLOCKS.join(' ');

  const guarded = [
    { key: 'portfolioPermitCount', word: 'تصريح' },
    { key: 'corridorCount', word: 'ممر' },
    { key: 'coordinationGroupCount', word: 'مجموع' },
  ];
  guarded.forEach((item) => {
    const value = metrics[item.key].value;
    const wrong = [value - 1, value + 1, value * 2]
      .filter((candidate) => candidate > 0)
      .map(toArabic)
      .filter((candidate) => new RegExp(candidate + '\\s*' + item.word).test(text));
    assert.deepStrictEqual(wrong, [],
      `${item.key}: العرض يحمل قيمة تخالف المصدر الحاكم (${value})`);
  });
});

// ---- لا رقم سنوي ولا مالي بلا مقام ---------------------------------------

test('لا رقم موصوف «سنوياً» ولا مبلغ بالريال في العرض', () => {
  const offenders = BLOCKS.filter((block) => (
    (/سنوياً|سنوية/.test(block) && /[٠-٩]{3}|\d{3}/.test(block))
    || /(?:﷼|ريال)/.test(block)
  ));
  assert.deepStrictEqual(offenders, [],
    `رقم سنوي أو مالي بلا مقام:\n    ${offenders.join('\n    ')}`);
});

console.log(`ALL TESTS PASSED (${count})`);
