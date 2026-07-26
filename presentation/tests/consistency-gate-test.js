'use strict';
/**
 * WP-A1 — بوابة الادعاءات.
 *
 * عشرة تناقضات في تقرير التحكيم نشأت كلها من سبب واحد: الحذف يُنفَّذ في صفحة
 * ويُنسى في أخرى، ولا شيء يفحص. النسخة القديمة تبقى حيّة وقابلة للوصول من
 * الشريط، فيقرأها المحكّم ويقارنها بالحاكمة.
 *
 * هذه البوابة تجعل عودة أيٍّ منها تفشل في الثانية. وهي الاستعمال الصحيح
 * الوحيد للفحص النصّي: إثبات **غياب** نص، لا إثبات سلوك.
 *
 * توسَّع في WP-A5 لتشمل تطابق الأرقام المشتركة بين الملفات.
 *
 * التشغيل: node presentation/tests/consistency-gate-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

/* الاستثناءات معلَنة ومبرَّرة لا صامتة: بوابة تتجاهل ملفات بلا سبب مكتوب
   تتحول إلى طقس. */
const SKIP_DIRS = new Set(['vendor', 'data', 'node_modules', 'icons', '.claude']);
const SKIP_FILES = new Set([
  'consistency-gate-test.js', // يحمل الأنماط نفسها بحكم وظيفته
]);

function walk(dir, out = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
      return;
    }
    if (!/\.(html|md)$/.test(entry.name)) return;
    if (SKIP_FILES.has(entry.name)) return;
    out.push(path.join(dir, entry.name));
  });
  return out;
}

const surfaces = walk(ROOT);

/* كل نمط يحمل سبب حظره. بوابة تقول «ممنوع» بلا سبب تُعطَّل عند أول إزعاج. */
const BANNED = [
  {
    pattern: /2\.5M|2\.5 ?مليون عملية/,
    why: 'الرقم الحاكم 2.2 مليون (UK DfT، أبريل 2023 – مارس 2024). 2.5M يناقض سجل المصادر.',
  },
  {
    pattern: /researchgate\.net/,
    why: 'مصدر ثانوي استُشهد به لرقم «−11.1٪» لا يقوله البحث بهذه الصيغة.',
  },
  {
    pattern: /broadbandnow\.com/,
    why: 'وسيط لتقرير GAO. المصدر الأولي هو تقرير GAO نفسه — وهو في سجل المصادر.',
  },
  {
    pattern: /ant_colony|مستعمرة النمل/,
    why: 'خوارزمية غير منفَّذة في المشروع. ذكرها ادعاء قدرة غير موجودة.',
  },
  {
    pattern: /iaarc\.org/,
    why: 'مصدر الخوارزمية غير المنفَّذة أعلاه.',
  },
  {
    pattern: /150 ?يوم[اً]? ?\/ ?300 ?يوم|300 ?يوم[اً]? للطرق العامة/,
    why: 'مدد نظامية لم تُتحقَّق من مصدر رسمي مباشر.',
  },
  {
    pattern: /بما فيه الخريطة/,
    why: 'الخريطة تفشل على file:// — سياسة المصدر نفسه تحجب sprite/glyphs. الادعاء كاذب.',
  },
  {
    /* الدقّة هنا مقصودة. `athar-routing.js` — محرك الممر في صفحتَي النموذج
       والقرار — يحمّل الحركة المحوَّلة فعلاً (سطر 305 وما بعده)، فذكرها هناك
       صحيح. `athar-city-routing.js` — محرك الخريطة على مستوى المدينة — لا
       يحمّلها إطلاقاً (صفر تطابق). الكاذب هو الادعاء **المطلق** الذي يعمّم
       قدرة محرك على المنتج كله؛ لذلك يُحظر «مثبت» و«الآن» لا الوصف نفسه. */
    pattern: /الحركة المحو[لّ]ة مثبت|تحميل الحركة المحو[لّ]ة (?:مطبَّق|يعمل) (?:الآن|كاملا)/,
    why: 'ادعاء مطلق يعمّم قدرة athar-routing.js على المنتج كله. محرك الخريطة '
      + '(athar-city-routing.js) لا يحمّل الحركة المحوَّلة — صفر تطابق.',
  },
];

/* فحص مُنطاق: السطح الذي يقوده محرك المدينة لا يعد بما لا يملكه المحرك.
   عام على كل الأسطح لا قائمة ثابتة، فلا تفلت صفحة تُضاف لاحقاً. */
const CITY_ENGINE = 'athar-city-routing.js';
const CORRIDOR_ENGINE = 'athar-routing.js';

/**
 * يجرّد تعليقات HTML الكتلية ويبقي أرقام الأسطر صحيحة.
 *
 * البوابة تفحص **ما يراه المحكّم**، والتعليق لا يُعرض. والتعليق المفسِّر
 * للحذف يذكر المحذوف بحكم شرحه له — منعُه يدفع إلى حذف صامت بلا سبب مكتوب،
 * وهو أسوأ مما تمنعه البوابة أصلاً.
 *
 * الاستبدال بمسافات لا بحذف: يحفظ الفواصل السطرية فيبقى رقم السطر في رسالة
 * الفشل مطابقاً للملف على القرص.
 */
function visibleText(file) {
  const raw = fs.readFileSync(file, 'utf8');
  if (!/\.html$/.test(file)) return raw;
  return raw.replace(/<!--[\s\S]*?-->/g, (block) =>
    block.replace(/[^\n]/g, ' '));
}

function scanFor(entry) {
  const hits = [];
  surfaces.forEach((file) => {
    visibleText(file).split('\n').forEach((line, index) => {
      /* أسطر التعليق في Markdown وJS: لا صيغة كتلية لها هنا. */
      if (/^\s*(\/\/|\*)/.test(line)) return;
      if (entry.pattern.test(line)) {
        hits.push(`${path.relative(ROOT, file)}:${index + 1}`);
      }
    });
  });
  return hits;
}

test('أسطح العرض مفحوصة فعلاً — البوابة ترى ما يراه المحكّم', () => {
  assert.ok(surfaces.length >= 12,
    `${surfaces.length} ملفاً فقط — البوابة تفحص أقل مما ينبغي`);
  const names = surfaces.map((f) => path.basename(f));
  ['athar-prototype.html', 'athar-desk.html', 'athar-map.html', 'README-athar.md']
    .forEach((required) => {
      assert.ok(names.includes(required), `${required} خارج نطاق الفحص`);
    });
});

BANNED.forEach((entry) => {
  const label = entry.pattern.source.split('|')[0].replace(/\\/g, '');
  test(`لا أثر لـ«${label}» في أي سطح عرض`, () => {
    const hits = scanFor(entry);
    assert.strictEqual(hits.length, 0,
      `${hits.length} موضعاً:\n    ${hits.join('\n    ')}\n  السبب: ${entry.why}`);
  });
});

/* WP-R1 — انقلبت علّة هذا الفحص، فانقلب هو.
 *
 * كان يقول: «محرك المدينة لا يحمّل الحركة المحوَّلة، فأي صفحة تقودها ممنوعة
 * من ذكر السعة بعد التحويل». صار المحرك يحمّلها (`loadRoute`)، فالعلّة زالت.
 *
 * وبقاء الفحص كما هو كان سيبقيه **أخضر لسببٍ لم يعد قائماً** — يمنع ادعاءً
 * صار مستحقاً، ويوهم أن قيداً يُحرَس وهو محلول.
 *
 * الممنوع الآن أدقّ: التحميل **نموذجٌ بقاعدة معلنة**، لا قياس. فادعاء أن
 * السعة «متحققة» أو أن البديل «يتحمّل» الحركة يبقى سابقاً لدليله.
 */
const CAPACITY_OVERCLAIM = /السعة (?:متحققة|مؤكدة)|البديل يتحمّل|يتحمّل التحويل|سعة كافية مؤكدة/;

test('لا ادعاء بأن سعة البديل متحققة — التحميل نموذج لا قياس', () => {
  const offenders = [];
  surfaces.forEach((file) => {
    visibleText(file).split('\n').forEach((line, index) => {
      if (CAPACITY_OVERCLAIM.test(line)) {
        offenders.push(`${path.relative(ROOT, file)}:${index + 1}`);
      }
    });
  });
  assert.strictEqual(offenders.length, 0,
    `${offenders.length} موضعاً يدّعي سعةً متحققة:\n    ${offenders.join('\n    ')}`
    + '\n  التحميل يستعمل قاعدة عرض معلنة (حصة الطلب المرتبطة بالمسارات المغلقة)'
    + ' لا معايرة اختيار سائق مقيسة.');
});

test('عارض البدائل يعلن أن الزمن بعد التحويل وأن القاعدة ليست قياساً', () => {
  /* الفحص المقابل: بعد أن صار التحميل منفَّذاً، غيابُ إعلانه عيبٌ كذلك.
     رقمٌ محمَّل يُعرض كأنه غير محمَّل يخفي أهم ما فيه.
     يُقرأ من الوحدة العارضة لا من الصفحة: النصّ يُولَّد وقت التشغيل. */
  const renderer = visibleText(path.join(ROOT, 'athar-worksmap-solution.js'));
  assert.ok(/بعد تحميل البديل بالحركة المحوَّلة/.test(renderer),
    'عارض البدائل لا يعلن أن الزمن محسوب بعد التحويل');
  assert.ok(/قاعدة التحويل معلنة لا مقيسة/.test(renderer),
    'عارض البدائل لا يعلن أن قاعدة التحويل ليست قياساً');
});

test('النموذج يحيل إلى سجل المصادر الحاكم بدل نسخة مختصرة', () => {
  const prototype = fs.readFileSync(path.join(ROOT, 'athar-prototype.html'), 'utf8');
  assert.ok(prototype.indexOf('athar-sources.html') !== -1,
    'athar-prototype.html لا يحيل إلى سجل المصادر — الحذف ترك فراغاً لا إحالة');
});

test('README يسمّي قيد file:// صراحةً بدل أن يعد بما لا يفي به', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README-athar.md'), 'utf8');
  assert.ok(/file:\/\//.test(readme) && /الخريطة تتطلب الخادم المحلي/.test(readme),
    'README لا يذكر أن الخريطة تحتاج الخادم المحلي');
});

/* ------------------------------------------------------------------ *
 * WP-A4 — بطاقة الفكرة. هي نموذج التقديم الرسمي، وأي عنصر نائب فيها
 * مانع تسليم معلَن. تُفحص من هنا لأن البوابة تملك بالفعل تعريف «سطح عرض».
 * ------------------------------------------------------------------ */

const CARD_PATH = path.join(ROOT, '..', 'بطاقة-الفكرة.md');
const card = fs.existsSync(CARD_PATH) ? fs.readFileSync(CARD_PATH, 'utf8') : null;

test('بطاقة الفكرة موجودة ومقروءة', () => {
  assert.ok(card, `بطاقة-الفكرة.md غير موجودة في ${path.dirname(CARD_PATH)}`);
});

test('لا عنصر نائب في بطاقة الفكرة — العناصر النائبة مانع تسليم', () => {
  const placeholders = [];
  card.split('\n').forEach((line, index) => {
    if (/\[الاسم\]|\[الدور\]|\[أدخل|TODO|TBD/.test(line)) {
      placeholders.push(`بطاقة-الفكرة.md:${index + 1}`);
    }
  });
  assert.strictEqual(placeholders.length, 0,
    `${placeholders.length} عنصراً نائباً:\n    ${placeholders.join('\n    ')}`);
});

test('كل ملف تحيل إليه بطاقة الفكرة موجود فعلاً', () => {
  /* رابط مكسور في نموذج التقديم أسوأ من غياب الرابط: المحكّم يفتحه فلا يجد
     شيئاً، فيقرأ الغياب إهمالاً لا اختياراً. */
  const repoRoot = path.join(ROOT, '..');
  const missing = [];
  const referenced = card.match(/`([\w./-]+\.(?:html|md|js|json))`/g) || [];
  [...new Set(referenced)].forEach((token) => {
    const rel = token.replace(/`/g, '');
    if (!fs.existsSync(path.join(repoRoot, rel))) missing.push(rel);
  });
  assert.strictEqual(missing.length, 0,
    `${missing.length} ملفاً محالاً إليه وغير موجود:\n    ${missing.join('\n    ')}`);
});

test('بطاقة الفكرة تحيل إلى النسخة الحاكمة لا إلى نموذج متقاعد', () => {
  /* المكتب هو المنتج الفعلي — سبع تبويبات وقرار وسجل. توجيه المحكّم إلى
     صفحة أقدم يجعله يحكم على ما ليس المنتج. */
  assert.ok(card.indexOf('athar-desk.html') !== -1,
    'البطاقة لا تحيل إلى athar-desk.html — النموذج الحاكم');
  assert.ok(card.indexOf('athar-sources.html') !== -1,
    'البطاقة لا تحيل إلى سجل المصادر');
});

test('بطاقة الفكرة تذكر أن الخريطة تحتاج الخادم — لا وعد بما لا يفي به', () => {
  assert.ok(/الخريطة تتطلب الخادم المحلي/.test(card),
    'البطاقة لا تذكر قيد الخريطة على file://');
});

console.log(`ALL TESTS PASSED (${count})`);
