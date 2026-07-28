'use strict';
/*
 * سقف حجم الملف — سقّاطة، لا حكم إعدام.
 * ---------------------------------------------------------------------------
 * القاعدة: ٨٠٠ سطر شيفرة للملف الواحد. وسبعة ملفات تتجاوزها اليوم.
 *
 * وتقسيمها الآن قرارٌ سيّئ: النموذج يعمل، والهاكاثون قائم، والعائد التحكيمي
 * صفر — لا معيار من الستة يذكر حجم ملف. تقسيمُ `masar-prototype.html` (١٬٦٦١
 * سطراً في كتلة سكربت واحدة، والعرض يربط إليها) ساعةَ التسليم يخاطر بديمو
 * شغّال مقابل لا شيء.
 *
 * وتركُها بلا بوابة قرارٌ أسوأ: الدَّين الذي لا يُقاس ينمو. فهذه سقّاطة —
 * **كل ملف يُسمح له بما هو عليه اليوم ولا سطر أكثر**، وأي ملف جديد أو خارج
 * القائمة محكوم بالثمانمئة كاملة.
 *
 * والعدّ **أسطر شيفرة لا أسطر ملف**: هذا المستودع يشرح قراراته في تعليقات
 * طويلة عمداً، وعدُّ التعليق ضدّ الملف يعاقب التوثيق. الفرق ليس صغيراً —
 * `masar-engine.js` ١٬٤١٤ سطراً في الملف و**٨٢٥** شيفرة.
 *
 * وتضيق السقّاطة من نفسها: ملفٌّ نزل تحت ميزانيته بأكثر من `SLACK` يُسقط
 * الحزمة طالباً خفض الرقم — وإلا بقيت الميزانية سقفاً وهمياً يسمح بعودة ما
 * حُذف.
 *
 * الخطة الكاملة للتقسيم — بعد التسليم: `docs/engineering/FILE-BUDGET.md`.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..');

/** السقف العام. كل ملف غير مذكور في الميزانيات محكوم به. */
const LIMIT = 800;

/** هامش قبل مطالبة الميزانية بالنزول. أضيق منه يعني تعديل الرقم كل التزام. */
const SLACK = 40;

/*
 * الميزانيات — مقيسة عند إضافة هذه الحزمة، لا مختارة.
 * الرقم هو الواقع؛ والسبب هو ما يجعل تجاوزه مرفوضاً وخفضه مطلوباً.
 */
const BUDGETS = {
  'masar-prototype.html': { max: 1804, why: 'كتلة سكربت واحدة 1,661 سطراً — تحتاج تقسيماً دلالياً لا نقلاً' },
  'masar-lab.html': { max: 1580, why: 'كتلة أنماط واحدة 1,101 سطراً — تُستخرج ملفاً مستقلاً' },
  'masar-decision.html': { max: 1073, why: '510 سكربت + 484 نمط — تنقسم ثلاثاً وكلها تحت السقف' },
  'masar-desk-boot.js': { max: 949, why: 'إقلاع المكتب — يُقسم بالمسؤولية: سجل، جلسة، تصيير' },
  'masar-desk.css': { max: 927, why: 'أنماط المكتب — تُقسم بالمنطقة: صندوق، ملف، خريطة' },
  'masar-city-routing.js': { max: 914, why: 'التوجيه — الرسم والبحث والتقييم في ملف واحد' },
  /*
   * رُفعت 825 ⟵ 872 مرّةً واحدة، بقرار مكتوب لا بصمت.
   *
   * السقّاطة تقول «ضع الجديد في وحدة مستقلة»، وهي القاعدة الصحيحة لكل ملف
   * آخر. لكن هذا الملف يحكمه قيدٌ أقوى: **الحساب له مصدر واحد** (AGENTS.md،
   * وREADME، وتشترك فيه الواجهة والخادم وحزم الاختبار). ونقلُ منطق ترتيب
   * الجداول إلى وحدة أخرى يكسر ذلك القيد ليُرضي هذا.
   *
   * والزيادة السابعة والأربعون سطراً ثمنُ إصلاحٍ حقيقي: `indifferenceBand`
   * أوقف ادّعاء ترتيبٍ أدقّ من عدم يقين النموذج — والفارق بين المرشحَين
   * الأولين وسيطه 5.8٪ ومئةٌ وخمسون من مئة وخمسين داخل 10٪.
   *
   * وهذا **بالضبط** ما وصفه `docs/engineering/FILE-BUDGET.md` بأنه شرط
   * التقسيم: «يُترك حتى يفرض توسّعٌ حقيقي التقسيم». التوسّع وقع. فالرفع مرّة
   * واحدة، والتقسيم يصعد إلى رأس خطة ما بعد التسليم.
   */
  /* رُفع ثانيةً — ٨٧٢ ⟵ ٨٩٤ — بقرار مكتوب لا بانزلاق.
     ما دخل: إغناء `switchPoint()` ليقول **عند أي وزن ينقلب القرار** وأي جدول
     يفوز عندها، جواباً على سؤال فريق أحمر: «صنّفتُ تصريحاً بجوار مستشفى فلم
     تتغيّر الجدولة». والبديل — وحدة مستقلة — يكسر قيداً أقوى ينصّ عليه
     `AGENTS.md`: لا تُشتقّ معادلة مرورية خارج `masar-engine.js`، ونقطة الانقلاب
     تقاطعُ دالّتي الهدف نفسِهما. فالتقسيم هنا يشقّ الحساب لا ينظّمه. */
  /* الرفع الثالث — ٨٩٤ ⟵ ٩٥٤ — وهو **الأخير بلا خطة تقسيم**.
     ما دخل: نقطة الانقلاب صارت ثنائية الاتجاه — لا «عند أي وزن يرتفع فينقلب»
     وحدها، بل «وعند أي وزن ينخفض فينقلب» معها. وهي رياضيات هدفٍ لا عرضاً، فمحلّها
     المحرّك بحكم `AGENTS.md`: لا تُشتقّ معادلة مرورية خارجه.
     **وثلاثة رفوعٍ متتالية تُفرغ البوابة من معناها.** فالقاعدة من هنا: أي زيادة
     قادمة على هذا الملف تحتاج خطة تقسيم مكتوبة تُنفَّذ معها — لا رفعاً رابعاً.
     المرشّح الطبيعي للفصل: طبقة الشرح النصّي (`note` وصياغة الأسباب) عن طبقة
     الحساب؛ الأولى تخرج إلى وحدة عرض ولا تكسر قيد المصدر الواحد. */
  'masar-engine.js': { max: 954, why: 'مصدر الحساب الوحيد — رُفع ثلاثاً؛ الرابع يحتاج تقسيماً لا رفعاً' },
};

/**
 * أسطر الشيفرة: بلا فراغ وبلا تعليق سطري أو كتلي (JS و HTML).
 * تقريبٌ لا مُحلِّل نحوي — يكفي لسقّاطة، ولا يُبنى عليه قرار آخر.
 */
function codeLines(source) {
  let count = 0;
  let inBlock = false;
  let inHtmlComment = false;
  source.split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    if (inBlock) { if (line.includes('*/')) inBlock = false; return; }
    if (inHtmlComment) { if (line.includes('-->')) inHtmlComment = false; return; }
    if (line.startsWith('/*')) { if (!line.includes('*/')) inBlock = true; return; }
    if (line.startsWith('<!--')) { if (!line.includes('-->')) inHtmlComment = true; return; }
    if (line.startsWith('//') || line.startsWith('*')) return;
    count += 1;
  });
  return count;
}

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const measured = fs.readdirSync(dir)
  .filter((name) => /\.(js|html|css)$/.test(name))
  .sort()
  .map((name) => ({ name, lines: codeLines(fs.readFileSync(path.join(dir, name), 'utf8')) }));

test('لا ملف جديد يتجاوز ٨٠٠ سطر شيفرة', () => {
  const offenders = measured
    .filter((file) => file.lines > LIMIT && !BUDGETS[file.name])
    .map((file) => `${file.name}: ${file.lines} سطر شيفرة (السقف ${LIMIT})`);
  assert.deepStrictEqual(offenders, [],
    'ملفات تتجاوز السقف بلا ميزانية معلنة:\n    ' + offenders.join('\n    ')
    + '\n    قسّم الملف، أو أعلن ميزانيته وسببها في BUDGETS إن كان التقسيم مؤجَّلاً بقرار.');
});

test('لا ملف متجاوز ينمو فوق ميزانيته — السقّاطة لا ترتدّ', () => {
  const grown = [];
  Object.keys(BUDGETS).forEach((name) => {
    const file = measured.find((item) => item.name === name);
    if (!file) return;
    if (file.lines > BUDGETS[name].max) {
      grown.push(`${name}: ${file.lines} > ${BUDGETS[name].max} `
        + `(+${file.lines - BUDGETS[name].max}) — ${BUDGETS[name].why}`);
    }
  });
  assert.deepStrictEqual(grown, [],
    'ملفات نمت فوق ميزانيتها:\n    ' + grown.join('\n    ')
    + '\n    الملف المتجاوز لا يُزاد عليه. ضع الجديد في وحدة مستقلة.');
});

test('السقّاطة تضيق: ميزانية تجاوزها الواقع نزولاً تُخفَّض', () => {
  const stale = [];
  Object.keys(BUDGETS).forEach((name) => {
    const file = measured.find((item) => item.name === name);
    if (!file) {
      stale.push(`${name}: الملف لم يعد موجوداً — احذف ميزانيته`);
      return;
    }
    if (file.lines + SLACK < BUDGETS[name].max) {
      stale.push(`${name}: ${file.lines} سطراً والميزانية ${BUDGETS[name].max} — `
        + `اخفضها إلى ${file.lines}`);
    }
  });
  assert.deepStrictEqual(stale, [],
    'ميزانيات متقادمة:\n    ' + stale.join('\n    ')
    + '\n    ميزانية أعلى من الواقع تسمح بعودة ما حُذف.');
});

test('كل ميزانية تحمل سببها — قائمة بلا أسباب تتحول إلى مكبّ', () => {
  Object.keys(BUDGETS).forEach((name) => {
    assert.ok(BUDGETS[name].why && BUDGETS[name].why.length > 20,
      `${name}: ميزانية بلا سبب مكتوب`);
  });
});

const debt = Object.keys(BUDGETS)
  .map((name) => (measured.find((item) => item.name === name) || { lines: 0 }).lines - LIMIT)
  .filter((extra) => extra > 0)
  .reduce((sum, extra) => sum + extra, 0);
console.log(`  · الدَّين: ${Object.keys(BUDGETS).length} ملفات، `
  + `${debt} سطراً فوق السقف — الخطة في docs/engineering/FILE-BUDGET.md`);

console.log(`\n${passed} اختبارات نجحت`);
