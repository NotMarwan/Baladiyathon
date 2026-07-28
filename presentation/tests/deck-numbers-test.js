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
 * فما تثبته هذه الحزمة: أن كل رقم في **النصّ الظاهر** له واحد من أربعة —
 * سطرٌ في `deck-manifest.json` بمصدره ودرجته وحدّه، أو اشتقاق من تشغيل
 * المشروع نفسه، أو وسم صريح بأنه مقترح، أو أنه بنيةٌ لا كمّية (ترقيم، معرّف
 * تصريح، رقم إصدار مواصفة).
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
  'masar-baladiyathon-judging-deck.html');
const MANIFEST = path.join(__dirname, 'fixtures', 'test-manifest.json');
const DECK_MANIFEST = path.join(REPO, 'output', 'submission', 'deck-manifest.json');

global.window = global;
const Canonical = require(path.join(ROOT, 'masar-canonical.js'));

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
 * الجرد — مصدر القبول للأرقام الموضوعية.
 *
 * الفئات أدناه كانت كلها **بنيوية**: ترقيم، وسنة، ووسم «مقترح». أي أن العرض
 * لم يكن يحمل رقماً موضوعياً واحداً خارج الصور — وهو عيبٌ مسجَّل في التدقيق
 * لا ميزة. وإدخال رقم موضوعي يحتاج فئةً لا تتمدّد بالمزاج: الشرط أن يكون
 * للرقم **سطرٌ في `deck-manifest.json`** بمصدره ودرجته وحدّه. فالفئة لا تقول
 * «هذا الرقم مسموح»، بل «هذا الرقم مجرود، واذهب فاقرأ حدّه».
 */
const deckManifest = JSON.parse(fs.readFileSync(DECK_MANIFEST, 'utf8'));

const toAscii = (text) => text.replace(/[٠-٩]/g,
  (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

/* الفاصل الألفي وعلامة النسبة لا تغيّران الكمّية. */
function numbersIn(block) {
  return toAscii(block).replace(/[٬,]/g, '').match(/\d+(?:\.\d+)?/g) || [];
}

/* القيمة تُعرض في العرض بدقّة تناسب معناها — والمقارنة تجري على الشكلين:
   الصحيح، والمقرَّب. `present()` في الباني يفعل الشيء نفسه. */
const MANIFEST_VALUES = new Set();
deckManifest.figures.forEach((item) => {
  if (typeof item.value !== 'number' || !Number.isFinite(item.value)) return;
  MANIFEST_VALUES.add(String(item.value));
  MANIFEST_VALUES.add(String(Math.round(item.value)));
});

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
    /* هذه الفئة **لا تدخل الجرد عمداً**. عتبةُ بروتوكول لم تُعتمد ليست رقماً
       له مصدر ودرجة دليل، ولا مصدرَ مولَّداً في المستودع يشتقّها. فإدخالها
       في `deck-manifest.json` يقتضي كتابتها يدوياً في الباني — وهو بالضبط
       ما يمنعه الجرد. تبقى هنا موسومة «مقترح»، والقرار مكتوب. */
    why: 'عتبة مقترحة داخل بروتوكول موسوم «مقترح» — لا نتيجة',
    matches: (block) => /مقترح|مقاسة على الأقل|منفعة كلية/.test(block),
  },
  {
    key: 'permit-id',
    /* `BLD-2026-0045` أربعة أرقام في اسم صفّ، لا كمّية تُسأل عن مصدرها.
       والشرط ضيّق: إن بقي في الكتلة رقمٌ بعد نزع المعرّف، سقطت الفئة. */
    why: 'معرّف تصريح في المحفظة التمثيلية — اسمٌ لا كمّية',
    matches: (block) => /BLD-\d{4}-\d{4}/.test(block)
      && !/[٠-٩\d]/.test(block.replace(/BLD-\d{4}-\d{4}/g, '')),
  },
  {
    key: 'standard-version',
    why: 'رقم إصدار مواصفة رسمية — واقعة لا قياس',
    matches: (block) => /WZDx\s*4\.2/.test(block)
      && !/[٠-٩\d]/.test(block.replace(/WZDx\s*4\.2/g, '')),
  },
  {
    key: 'manifest-backed',
    why: 'قيمة مجرودة — لكل رقم في الكتلة سطرٌ في deck-manifest.json '
      + 'بمصدره ودرجته وحدّه',
    matches: (block) => {
      const found = numbersIn(block);
      return found.length > 0
        && found.every((number) => MANIFEST_VALUES.has(number));
    },
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
  /* WP — الإجمالي يضمّ المعلَّقة، لا الناجح وحده.
     كان الرقم «N / N» يُسقط الحزمة المعلَّقة من البسط والمقام معاً، فيبدو
     العرض مكتملاً بلا استثناء — وهو ما سأله فريقٌ أحمر مستقل حرفياً. الفحص
     هنا يطابق ما ينتجه `sync-deck-counts.js` فعلاً — بما فيه تساهله نفسه مع
     جردٍ سابق على حقل `pendingSuites` (يُعامَل صفراً لا سقوطاً)، كي لا يُبلّغ
     هذا الفحص عن عطلٍ لا يقع في السكربت المفحوص. */
  const suites = toArabic(manifest.suites);
  const pendingSuites = manifest.pendingSuites === undefined ? 0 : manifest.pendingSuites;
  const total = toArabic(manifest.suites + pendingSuites);
  /* السقوط يسمّي أمر إصلاحه.
     تقادم هذا الرقم ثلاث مرات في يومين — ٧٧ ⟵ ٨٠ ⟵ ٨١ ⟵ ٨٢ — وفي كل مرة
     كان يُصلَح بتحرير يدوي في الـHTML المبني. صار له ختّامٌ يقرأ الجرد، فبقاء
     الرسالة بلا اسمه يعيد الناس إلى التحرير اليدوي. */
  assert.ok(RAW.indexOf(`${suites} / ${total}`) !== -1,
    `العرض لا يعرض «${manifest.suites} / ${manifest.suites + pendingSuites}» — عدد الحزم متقادم.\n`
    + '    الإصلاح: node presentation/scripts/sync-deck-counts.js\n'
    + '    (ويُستدعى تلقائياً من tools/deck-build/export-masar-pdf.cjs قبل التصيير)');

  /* الأرضية رُفعت ٩٠٠ ⟵ ١٢٠٠ لأن البوابة نفسها طلبت ذلك.
     الحدّ الأعلى `FLOOR * 1.6` وُضع كي لا تشيخ الأرضية فتبخس العمل: بلغ العدّ
     ١٬٤٦٠ فتجاوز ١٬٤٤٠ وسقط الفحص بنصّه «أرضيةٌ متقادمة … ارفعها». وهذه بوابة
     تطلب الترقية بدل أن تسكت عليها — والسكوت هو ما جعل العرض يقول «تسعمئة»
     والحقيقة ألفٌ ونصف. */
  const FLOOR = 1200;
  assert.ok(manifest.checks >= FLOOR,
    `العرض يعلن أكثر من ${FLOOR} فحص والحقيقة ${manifest.checks} — ادعاء فوق الواقع`);
  assert.ok(manifest.checks < FLOOR * 1.6,
    `الأرضية ${FLOOR} بعيدة عن ${manifest.checks} — أرضيةٌ متقادمة تبخس العمل `
    + 'وتُقرأ إهمالاً. ارفعها.');
  assert.ok(/أكثر من ألف ومئتي فحص/.test(RAW),
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

test('أي مؤشّر حاكم يظهر في العرض يطابق masar-canonical.js', () => {
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

// ---- العرض القصير سطحٌ مثل غيره ------------------------------------------

test('عرض الدقائق الثلاث لا يحمل عدّ فحوص متقادماً', () => {
  /* كان يقول «185 حالة آلية» والحقيقة أكثر من ألف — العيب نفسه الذي وقع في
     العرض المصوَّر («١٧٧ فحصاً»)، وفي سطحٍ لم تكن تحرسه بوابة. الحارس هنا
     يمنع تكراره في أي عدد مكتوب يدوياً، لا في هذا الرقم وحده. */
  const pitch = fs.readFileSync(path.join(ROOT, 'masar-pitch.html'), 'utf8');
  const testManifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  assert.ok(/أكثر من تسعمئة فحص/.test(pitch),
    'العرض القصير لا يعرض عدد الفحوص بالصيغة الأرضية المفحوصة');
  assert.ok(testManifest.checks >= 900,
    `الأرضية المعلنة 900 فوق الواقع ${testManifest.checks}`);

  const stale = (pitch.match(/(\d{2,4})\s*(?:حالة آلية|فحصاً|فحصًا|حالة اختبار)/g)
    || []).filter((match) => Number(match.match(/\d+/)[0]) !== testManifest.checks);
  assert.deepStrictEqual(stale, [],
    `عدّ فحوص مكتوب يدوياً في العرض القصير: ${stale.join('، ')}`);
});

// ---- الاكتشافان اللذان دخلا العرض ----------------------------------------

test('حكم حمل البديل معروض بعدده وحالته، ومطابق للجرد', () => {
  /* الشريحة تحمل عدّاً وحالةً واحدة. والعدّ وحده يُقرأ إحصاءً بارداً،
     والحالة وحدها تُقرأ استثناءً — فلا تُفصل إحداهما عن الأخرى. */
  const text = BLOCKS.join(' ');
  const toArabic = (value) => String(value).replace(/\d/g,
    (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
  const pinned = ['alternateOverflows', 'alternateCaseBeforeShare',
    'alternateCaseAfterShare', 'alternateCaseDiverted'];
  const missing = pinned.filter((key) => {
    const item = deckManifest.figures.find((row) => row.key === key);
    assert.ok(item, `${key}: غائب عن الجرد`);
    return text.indexOf(toArabic(item.value)) === -1;
  });
  assert.deepStrictEqual(missing, [],
    `أرقام في الجرد وغائبة عن الشريحة: ${missing.join('، ')}`);
  assert.ok(/BLD-2026-0045/.test(text), 'الحالة المعروضة بلا معرّف تصريح');
  assert.ok(/السويس/.test(text), 'المقطع المقيِّد غائب — النسبة بلا موضع');
});

test('الحالة المعروضة تُعلَن غير الأسوأ، والأسوأ معروض بجوارها', () => {
  /* بلا هذا، تُقرأ الحالة حدّاً أعلى وهي وسط الترتيب — وهو تهوين لا مبالغة،
     لكنه يبقى قراءةً خاطئة يمكن للجنة أن تكشفها بنفسها من البيانات. */
  const text = BLOCKS.join(' ');
  const worst = deckManifest.figures.find(
    (row) => row.key === 'alternateWorstAfterShare');
  const asArabic = String(worst.value).replace(/\d/g,
    (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
  assert.ok(text.indexOf(asArabic) !== -1,
    'أعلى نسبة في المحفظة غائبة عن العرض');
  assert.ok(/الأسوأ/.test(text), 'العرض لا يقول إن الحالة المعروضة ليست الأسوأ');
});

test('برهان التبادلية معروض بعدده وبحدّه معاً', () => {
  const text = BLOCKS.join(' ');
  const features = deckManifest.figures.find(
    (row) => row.key === 'interopFeedFeatures');
  const asArabic = String(features.value).replace(/\d/g,
    (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
  assert.ok(text.indexOf(asArabic) !== -1, 'عدد مناطق العمل غائب عن العرض');
  assert.ok(/صفر أخطاء/.test(text), 'النتيجة معروضة بلا «صفر أخطاء»');
  assert.ok(/تبادلية بنية لا قياس/.test(text),
    'العدد معروض بلا حدّه — تبادلية بنيةٍ تُقرأ قياساً إن لم يُقيَّد');
  assert.ok(/لا تقول شيئاً عن الرياض/.test(text),
    'العرض لا يقيّد تغذية ولايةٍ أخرى بأنها لا تخصّ الرياض');
});

test('سعة منطقة العمل معروضة بسندها وبعدد مواقعه', () => {
  const text = BLOCKS.join(' ');
  const toArabic = (value) => String(value).replace(/\d/g,
    (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
  ['workZoneLaneCapacity', 'workZoneCapacitySites'].forEach((key) => {
    const item = deckManifest.figures.find((row) => row.key === key);
    assert.ok(item, `${key}: غائب عن الجرد`);
    assert.ok(text.indexOf(toArabic(item.value)) !== -1,
      `${key}: مجرود وغائب عن العرض`);
  });
  assert.ok(/لم تُعاير على الرياض/.test(text),
    'قيمة مقيسة أجنبياً معروضة بلا الحدّ الذي يمنع قراءتها محلية');
});

/* ---- ختّام عدد الحزم: أن يعمل، وأن يسقط حين لا يعمل ---- */

const { syncDeckCounts } = require(path.join(__dirname, '..', 'scripts', 'sync-deck-counts.js'));

/*
 * الخطر الحقيقي في هذا الختّام ليس أن يخطئ، بل أن **يمرّ صامتاً**: لو تغيّر
 * ترميز الشريحة فلم يطابق تعبيرُه شيئاً، لطبع «تمّ» وبقي الرقم متقادماً —
 * وهو عين العطل الذي وُضع لمنعه. فيُفحص الطرفان: أنه يجد موضعه، وأنه يسقط إن
 * لم يجده.
 */
test('الختّام يجد موضعه في العرض المبني — ولا يمرّ على لا شيء', () => {
  const result = syncDeckCounts({ quiet: true });
  assert.ok(result.suites > 0, 'الختّام أعاد عدد حزم غير صالح');
  assert.ok(RAW.indexOf(result.stamp) !== -1,
    `الختّام يعلن «${result.stamp}» ولا يظهر في العرض المقروء هنا`);
});

test('الختّام لا يعمل إلا مرة — إعادته لا تغيّر شيئاً', () => {
  const again = syncDeckCounts({ quiet: true });
  assert.deepStrictEqual(again.changed, [],
    `الختّام غيّر شيئاً في التشغيلة الثانية: ${again.changed.join(' · ')}`);
});

test('الختّام يسقط إن غاب موضعه — لا نجاح صامت على رقم متقادم', () => {
  const deckPath = DECK;
  const original = fs.readFileSync(deckPath, 'utf8');
  /* زمنا الملف يُحفظان ويُعادان.
     `submission-deck-test.js` يسقط إن صار الـHTML أحدث من الـPDF المبني منه.
     وكتابةُ المحتوى نفسه ترفع زمن التعديل، فيسقط ذلك الفحص بسبب هذا — بوابةٌ
     تكسر بوابةً أخرى بلا أن يتغيّر شيء في التسليم. */
  const before = fs.statSync(deckPath);
  /* كسرُ اللاحقة وحدها يكفي: التعبير يثبّت الموضع بها، فإزالتها تحاكي تغيّر
     ترميز الشريحة بدقة أكبر من حذف الرقم. */
  const broken = original.replace('</div><p class="lead">حزمة تحقق',
    '</div><p class="lead">حزمةُ تحقق');
  assert.notStrictEqual(broken, original, 'لم تُكسر اللاحقة — الفحص لا يقيس شيئاً');
  fs.writeFileSync(deckPath, broken, 'utf8');
  let threw = false;
  try {
    syncDeckCounts({ quiet: true });
  } catch (error) {
    threw = /لم يُعثر على موضع عدد الحزم/.test(error.message);
  } finally {
    fs.writeFileSync(deckPath, original, 'utf8');
    fs.utimesSync(deckPath, before.atime, before.mtime);
  }
  assert.ok(threw, 'الختّام مرّ على عرضٍ لا يحمل موضعه — نجاحٌ صامت');
});

console.log(`ALL TESTS PASSED (${count})`);
