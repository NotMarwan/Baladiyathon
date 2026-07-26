'use strict';
/**
 * بوابة العرض النصّي القابل للتدقيق.
 *
 * الفجوة التي يغلقها: أرقام العرض المصوَّر داخل صور Base64، خارج أي فحص آلي
 * وخارج القراءة الدلالية. والبوابة تفحص أن البديل النصّي **فعلاً** نصّي، وأن
 * كل رقم فيه مسنود ومحدود، وأنه لا يتقادم عن مصادره.
 *
 * التشغيل: node presentation/tests/deck-text-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
global.window = global;

const builder = require(path.join(ROOT, 'scripts', 'build-deck-manifest.js'));
const Evidence = require(path.join(ROOT, 'masar-route-evidence.js'));

const MANIFEST = path.join(REPO, 'output', 'submission', 'deck-manifest.json');
const TEXT_DECK = path.join(REPO, 'output', 'submission', 'masar-judging-deck-text.html');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const deck = fs.readFileSync(TEXT_DECK, 'utf8');

// ---- الجرد ---------------------------------------------------------------

test('كل رقم في الجرد يحمل قيمته ووحدته ومصدره ودرجته وحدّه', () => {
  assert.ok(manifest.figures.length >= 15, `${manifest.figures.length} رقماً فقط`);
  manifest.figures.forEach((item) => {
    assert.ok(item.key, 'رقم بلا مفتاح');
    assert.ok(item.value !== undefined && item.value !== null, `${item.key}: بلا قيمة`);
    assert.ok(item.unit, `${item.key}: بلا وحدة`);
    assert.ok(item.source && item.source.length > 8, `${item.key}: بلا مصدر`);
    assert.ok(item.limit && item.limit.length > 15,
      `${item.key}: بلا حدّ — رقمٌ بلا حدّ مكتوب يُقرأ مطلقاً`);
  });
});

test('درجة كل رقم من قائمة الدرجات المعلنة', () => {
  const keys = Evidence.EVIDENCE_GRADES.map((grade) => grade.key);
  manifest.figures.forEach((item) => {
    assert.ok(keys.includes(item.grade),
      `${item.key}: درجة خارج القائمة — «${item.grade}»`);
  });
});

test('لا مفتاح مكرَّر في الجرد', () => {
  const keys = manifest.figures.map((item) => item.key);
  assert.strictEqual(new Set(keys).size, keys.length, 'مفاتيح مكرَّرة');
});

test('الجرد يعلن أن ما ليس فيه لا يظهر في شريحة', () => {
  assert.match(manifest.rule, /لا يجوز أن يظهر في شريحة/);
});

// ---- العرض النصّي --------------------------------------------------------

test('العرض النصّي بلا صورة واحدة', () => {
  /* هذا هو الشرط كله: أرقامٌ في صورة لا تُفحص ولا تُقرأ آلياً. */
  assert.strictEqual((deck.match(/data:image/g) || []).length, 0,
    'صورة مضمَّنة في العرض النصّي');
  assert.strictEqual((deck.match(/<img\b/g) || []).length, 0, 'وسم صورة');
});

test('العرض النصّي بلا سكربت — المحتوى نصّ لا ناتج تنفيذ', () => {
  assert.strictEqual((deck.match(/<script/gi) || []).length, 0);
});

test('كل رقم في الجرد يظهر في العرض النصّي', () => {
  manifest.figures.forEach((item) => {
    assert.ok(deck.indexOf(item.key) !== -1,
      `${item.key}: في الجرد وغائب عن العرض`);
  });
});

test('كل رقم في العرض يظهر بحدّه لا وحده', () => {
  manifest.figures.forEach((item) => {
    assert.ok(deck.indexOf(item.limit) !== -1,
      `${item.key}: قيمته معروضة وحدّه غائب`);
  });
});

test('العرض يعلن درجات الدليل بما تُثبته وما لا تُثبته', () => {
  Evidence.EVIDENCE_GRADES.forEach((grade) => {
    assert.ok(deck.indexOf(grade.label) !== -1, `درجة غائبة: ${grade.label}`);
    assert.ok(deck.indexOf(grade.notProves) !== -1,
      `${grade.key}: معروضة بلا حدّها`);
  });
});

test('العرض يعلن السقف الحاكم: صفر حالة ميدانية', () => {
  /* أهم جملة في الملف. حذفها يجعل جدول أرقام خضراء يُقرأ إثبات أثر. */
  assert.match(deck, /لا حالة ميدانية واحدة في المستودع/);
  assert.match(deck, /درجة الأثر الميداني المثبت/);
  const fieldCases = manifest.figures.find((item) => item.key === 'fieldCases');
  assert.strictEqual(fieldCases.value, 0, 'حالات ميدانية أكبر من صفر — راجع');
});

test('لا دقّة زائفة: لا رقم بأكثر من خانتين عشريتين في العرض', () => {
  const overPrecise = (deck.match(/\d+\.\d{3,}/g) || []);
  assert.deepStrictEqual(overPrecise, [],
    `دقّة زائفة على رقم مشتقّ: ${overPrecise.join('، ')}`);
});

// ---- عدم التقادم ---------------------------------------------------------

test('الجرد المكتوب يطابق التوليد الحيّ — لا رقم متقادم', () => {
  /* هذه البوابة هي كل الفرق بين «مولَّد» و«مكتوب مرة». */
  const live = builder.build();
  assert.strictEqual(live.figures.length, manifest.figures.length,
    'عدد الأرقام تغيّر — أعِد توليد الجرد');
  live.figures.forEach((item) => {
    const stored = manifest.figures.find((row) => row.key === item.key);
    assert.ok(stored, `${item.key}: مولَّد وغائب عن الملف`);
    assert.strictEqual(String(stored.value), String(item.value),
      `${item.key}: القيمة المخزَّنة ${stored.value} والمولَّدة ${item.value}`);
  });
});

test('العرض النصّي المكتوب يطابق ما يولّده الباني', () => {
  assert.strictEqual(builder.html(builder.build()), deck,
    'العرض النصّي متقادم — شغّل scripts/build-deck-manifest.js');
});

// ---- العرض المصوَّر يبقى موصوفاً بحدّه ------------------------------------

test('العرض المصوَّر ما زال أغلبه صوراً — والحدّ يبقى معلناً', () => {
  /* لا يُدّعى أن الفجوة أُغلقت: الصور باقية وأرقامها خارج الفحص. ما تغيّر
     أن بجانبها ملفاً نصّياً مفحوصاً. */
  const visual = fs.readFileSync(path.join(REPO, 'output', 'submission',
    'masar-baladiyathon-judging-deck.html'), 'utf8');
  const images = (visual.match(/data:image/g) || []).length;
  assert.ok(images >= 20, `${images} صورة — تغيّر شكل العرض، راجع هذه البوابة`);
});

console.log(`ALL TESTS PASSED (${count})`);
