'use strict';
/**
 * WP-X1 — حالة القدرة واحدة عبر كل الأسطح.
 *
 * وقع هذا العيب مرتين، ومرة منه كانت في صالحنا:
 *
 *   · العرض قال «الصلاحيات غير منفذة» بعد أن نُفِّذت في WP-D3.
 *   · وقال «سجل تدقيق دائم غير منفذ» بعد أن نُفِّذ في WP-L1.
 *
 * محكّمٌ يرى فصل الصلاحيات يعمل ثم يقرأ في العرض أنه غير منفَّذ لا يعرف أي
 * السطرين يصدّق. **سطحان يتناقضان أسوأ من سطحٍ يعترف، ولو كان الاعتراف في
 * صالحنا** — لأن الشكّ يقع على الاثنين لا على أحدهما.
 *
 * ولذلك لا تكفي مراجعةٌ بشرية: القدرات تُنفَّذ في دورة، والنصوص تُكتب في
 * دورة أخرى، والمسافة بينهما هي العيب.
 *
 * ---------------------------------------------------------------------------
 * **الحقيقة تُستخرج من الشيفرة لا تُعلَن في جدول.**
 *
 * لكل قدرة `evidence` تقرأ الشيفرة نفسها وتعيد منفَّذ/غير منفَّذ. جدولُ
 * حالاتٍ مكتوب يدوياً يتقادم كما تتقادم الصفحات، فيصير للتناقض مصدرٌ ثالث.
 *
 * التشغيل: node presentation/tests/capability-truth-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

/** نصّ يقرؤه إنسان: بلا شيفرة ولا تعليق ولا أصل مضمَّن. */
function visible(file) {
  let text = read(file);
  if (/\.html$/.test(file)) {
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ');
  }
  if (/\.js$/.test(file)) {
    text = text
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/[^\n]*/gm, ' ');
  }
  return text
    .replace(/data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

function surfaces() {
  const list = [];
  fs.readdirSync(ROOT)
    .filter((name) => /\.(html|md)$/.test(name))
    .forEach((name) => list.push(path.join(ROOT, name)));
  const card = path.join(REPO, 'docs', 'hackathon', 'بطاقة-الفكرة.md');
  if (fs.existsSync(card)) list.push(card);
  const submission = path.join(REPO, 'output', 'submission');
  if (fs.existsSync(submission)) {
    fs.readdirSync(submission)
      .filter((name) => /\.html$/.test(name))
      .forEach((name) => list.push(path.join(submission, name)));
  }
  return list;
}

const SURFACES = surfaces();
const server = read(path.join(ROOT, 'server.js'));
const routing = read(path.join(ROOT, 'masar-city-routing.js'));

/**
 * القدرات المتنازَع عليها.
 *
 * `denial` أنماط تُقرأ نفياً. تُكتب ضيّقة عمداً: نمطٌ واسع يلتقط جملةً تشرح
 * حدّاً مشروعاً («لا مصادقة مستخدمين») فيمنع الصدق باسم الاتساق.
 */
const CAPABILITIES = [
  {
    key: 'roles',
    label: 'فصل الصلاحيات في الخادم',
    evidence: () => /X-Masar-Key/.test(server)
      && /segregationBreach/.test(server)
      && /ROLE_NOT_PERMITTED/.test(server),
    denial: /(?:الصلاحيات|فصل الصلاحيات)[^.،]{0,30}غير (?:منفذة|منفَّذة|منفذ|منفَّذ)/,
  },
  {
    key: 'ledger',
    label: 'سجل تدقيق ثابت',
    evidence: () => /decisions\.jsonl/.test(server)
      && /createLedger/.test(server),
    denial: /سجل تدقيق (?:دائم|ثابت)[^.،]{0,20}غير (?:منفذ|منفَّذ)|السجل الدائم[^.،]{0,20}غير/,
  },
  {
    key: 'diverted-load',
    label: 'تحميل الحركة المحوَّلة على البديل',
    evidence: () => /divertedDemand/.test(routing) && /loadRoute/.test(routing),
    denial: /الحركة المحوَّلة[^.،]{0,25}غير (?:محسوبة|منفذة|منفَّذة)/,
  },
];

// ---- الأدلة تُقرأ لا تُعلَن ---------------------------------------------

test('كل قدرة لها دليل من الشيفرة لا إعلان في جدول', () => {
  CAPABILITIES.forEach((capability) => {
    assert.strictEqual(typeof capability.evidence, 'function',
      `${capability.key}: بلا دليل مقروء`);
    assert.strictEqual(capability.evidence(), true,
      `${capability.key}: الدليل يقول إنها غير منفَّذة — إمّا انكسرت أو تغيّر اسمها`);
  });
});

// ---- لا سطح ينفي منفَّذاً ------------------------------------------------

test('لا سطح يصف قدرة منفَّذة بأنها غير منفَّذة', () => {
  /* الفحص الحاكم. ويشمل العرض وبطاقة الفكرة وREADME — كلها يقرؤها المحكّم. */
  const offenders = [];
  CAPABILITIES.filter((capability) => capability.evidence()).forEach((capability) => {
    SURFACES.forEach((file) => {
      const text = visible(file);
      if (capability.denial.test(text)) {
        offenders.push(`${path.relative(REPO, file)} — ينفي «${capability.label}»`);
      }
    });
  });
  assert.deepStrictEqual(offenders, [],
    `${offenders.length} سطحاً ينفي قدرة قائمة:\n    ${offenders.join('\n    ')}`);
});

test('أنماط النفي ضيّقة — لا تلتقط حدّاً مشروعاً معلَناً', () => {
  /* حدودٌ صادقة يجب أن تبقى مكتوبة: «لا مصادقة مستخدمين» و«لا تشفير نقل»
     و«الربط البلدي غير منفذ» كلها صحيحة اليوم. نمطٌ واسع يمنع الصدق باسم
     الاتساق — وهو أسوأ من التناقض الذي يحرسه. */
  const honest = [
    'لا مصادقة مستخدمين ولا تشفير نقل.',
    'التكامل البلدي غير منفذ؛ وله عقد بيانات موصوف ومحقق فقط.',
    'غير منفذ: الربط البلدي وبيانات الحركة الحية.',
    'المفتاح يربط دوراً لا شخصاً.',
  ];
  CAPABILITIES.forEach((capability) => {
    honest.forEach((sentence) => {
      assert.ok(!capability.denial.test(sentence),
        `نمط «${capability.key}» يلتقط حدّاً صادقاً: ${sentence}`);
    });
  });
});

test('النفي يُلتقط حين يقع فعلاً — النمط ليس معطَّلاً', () => {
  /* نمطٌ لا يطابق شيئاً أبداً يمرّ دائماً. كل نمط يُجرَّب على الجملة التي
     وُضع لها. */
  const samples = {
    roles: 'التكامل البلدي والصلاحيات غير منفذة.',
    ledger: 'غير منفذ: سجل تدقيق دائم غير منفذ.',
    'diverted-load': 'الحركة المحوَّلة غير محسوبة على البديل.',
  };
  CAPABILITIES.forEach((capability) => {
    const sample = samples[capability.key];
    assert.ok(sample, `${capability.key}: بلا جملة اختبار`);
    assert.ok(capability.denial.test(sample),
      `${capability.key}: النمط لا يلتقط نفياً صريحاً — ${sample}`);
  });
});

test('الجرد يغطي القدرات التي انكسرت فعلاً من قبل', () => {
  /* لا يُضاف هنا إلا ما وقع: جردٌ يتنبّأ يتضخّم ولا يُقرأ. */
  const keys = CAPABILITIES.map((capability) => capability.key);
  ['roles', 'ledger'].forEach((key) => {
    assert.ok(keys.indexOf(key) !== -1,
      `القدرة «${key}» وقع فيها التناقض ولا تُحرَس`);
  });
});

console.log(`ALL TESTS PASSED (${count})`);
