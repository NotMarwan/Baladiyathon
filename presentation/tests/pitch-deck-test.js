'use strict';
/**
 * عرض المنصة — الحزمة التي تمنع عودة العيوب التي وُجد من أجلها.
 *
 * العرض السابق حمل ثلاثة عيوب، وكلها من نوع واحد: **رقم أو صورة عاشا خارج
 * أي بوابة**. قال «أكثر من تسعمئة فحص» والحقيقة 1,214، وحمل الاسم القديم بعد
 * تغييره، وبقي ملف PDF أقدم من الشرائح. لا شيء كان يفحص.
 *
 * فهذه الحزمة تفحص المخرَج المولَّد لا القالب: كل رقم مرئي له سطر في الجرد،
 * والشعارات الثلاثة حاضرة، والملف مكتفٍ بذاته.
 *
 * التشغيل: node presentation/tests/pitch-deck-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const DECK = path.join(REPO, 'output', 'submission', 'masar-pitch-deck.html');
const MANIFEST = path.join(REPO, 'output', 'submission', 'deck-manifest.json');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const html = fs.readFileSync(DECK, 'utf8');
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const figures = Object.values(manifest.figures);

function fmt(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return value.toLocaleString('en-US');
  return Number(value.toFixed(1)).toLocaleString('en-US');
}

const visible = html
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ');

test('العرض ثلاث عشرة شريحة — خانة المنصة لا أرشيف', () => {
  /* واحد وعشرون شريحة في خانة خمس دقائق تعني خمس عشرة ثانية للشريحة.
     العرض التفصيلي يبقى منفصلاً لمن يقرأ.
     والثالثة عشرة أُضيفت لسؤال ساكن — «أين يقع الطابور؟» — وهو سؤالٌ يُسأل
     على المنصة فيُجاب فيها، لا يُحال إلى مرفق. */
  const slides = (html.match(/class="slide/g) || []).length;
  assert.strictEqual(slides, 13, `${slides} شريحة — العرض خرج عن حجم المنصة`);
});

test('كل رقم مرئي مسنود بسطر في الجرد', () => {
  /* العيب الحاكم في العرض السابق: «أكثر من تسعمئة فحص» والحقيقة 1,214.
     رقمٌ بلا سند حيّ يتقادم صامتاً ولا ينبّه أحد. */
  const ALLOWED = new Set(['4.2', '2026', '0045', '14.9', '500']);
  const backed = new Set(figures.map((row) => fmt(row.value)));
  const orphans = [];
  visible.split('\n').forEach((line) => {
    (line.match(/\d[\d,.]*\d|\d/g) || []).forEach((n) => {
      if (!ALLOWED.has(n) && !backed.has(n)) orphans.push(n);
    });
  });
  assert.strictEqual(orphans.length, 0,
    `أرقام بلا سند: ${[...new Set(orphans)].join('، ')}`);
});

test('الأرقام الحاكمة حاضرة فعلاً — لا قالب فارغ', () => {
  /* بوابة السند وحدها تمرّ على عرض خالٍ من الأرقام. هذه تشترط الحضور. */
  ['alternateOverflows', 'interopFeedFeatures', 'checksPassed', 'stabilityAbstained',
    'localMeasuredCases', 'portfolioDeltaPct',
    /* شريحة الحيّ: الرقم الحاكم، ومعه ما يجعله مقروءاً — السعة التي تُقاس
       عليها، وصفر إنقاذٍ بتوسيع البحث. رقمٌ بلا هذين يُقرأ رأياً. */
    'neighbourhoodOverloaded', 'neighbourhoodCapacity',
    'neighbourhoodWiderSearchRescued'].forEach((key) => {
    const row = figures.find((f) => f.key === key);
    assert.ok(row, `${key} غائب عن الجرد`);
    assert.ok(visible.indexOf(fmt(row.value)) !== -1,
      `${key} = ${fmt(row.value)} لا يظهر في العرض`);
  });
  assert.ok(!/data-fig="\w+"\s*>\s*</.test(html),
    'رمز رقم بقي فارغاً — البناء لم يملأه');
});

test('الاسم مسار لا الاسم القديم', () => {
  assert.ok(/مسار/.test(visible), 'اسم المشروع غائب عن العرض');
  assert.ok(!/athar/i.test(html), 'الاسم اللاتيني القديم ما زال في العرض');
});

test('الشعارات الثلاثة حاضرة ومضمَّنة — الملف مكتفٍ بذاته', () => {
  /* PDF يُطبع بلا خادم، والملف يُنقل بين الأجهزة. مسار صورة نسبي يكسر كليهما. */
  const images = html.match(/<img[^>]+>/g) || [];
  assert.ok(images.length >= 24, `${images.length} صورة فقط`);
  images.forEach((tag) => {
    assert.ok(/src="data:image\/png;base64,/.test(tag),
      `صورة غير مضمَّنة: ${tag.slice(0, 70)}`);
  });
  ['شعار مسار', 'وزارة البلديات والإسكان', 'بلدياتثون'].forEach((alt) => {
    assert.ok(html.indexOf(alt) !== -1, `الشعار «${alt}» غائب`);
  });
});

test('كل حدّ معلن يسافر مع رقمه — لا رقم عارٍ', () => {
  /* الصدق ليس حاشية: الرقم الكبير يُقرأ إنجازاً ما لم يُعرض حدّه معه. */
  const limits = (html.match(/class="limit"/g) || []).length;
  assert.ok(limits >= 6, `${limits} حدّاً معلناً فقط — الأرقام تسبق قيودها`);
  assert.ok(/لا قياسات ميدانية/.test(visible),
    'العرض لا يعلن غياب القياس الميداني');
  assert.ok(/لا وفر مثبت/.test(visible),
    'الدلتا معروضة بلا حدّها — تُقرأ وفراً');
});

test('البنية سليمة للطباعة — مقاس ثابت واتجاه عربي', () => {
  assert.ok(/dir="rtl"/.test(html), 'الاتجاه ليس عربياً');
  assert.ok(/@page\s*\{[^}]*size:\s*1600px\s+900px/.test(html),
    'مقاس الصفحة غير مثبَّت — الطباعة تقصّ');
});

console.log(`ALL TESTS PASSED (${count})`);
