'use strict';
/**
 * WP-C1 — بوابة صدق المقارنة.
 *
 * صفحة مقارنة أسهل شيء يُكتب وأصعب شيء يُصدَّق. الفخّان المعروفان:
 *
 *   · جدولٌ يربح كل صفوفه — دعاية بشكل جدول، يقرؤها المحكّم كذلك من أول نظرة.
 *   · نفيُ قدرةٍ عن منافس بلا دليل — وهو الادعاء نفسه الذي نمنعه على أنفسنا،
 *     مقلوباً على الخصم.
 *
 * فالبوابة تفرض ثلاثة: أن يتفوّق كل منافس في صفٍّ على الأقل، وأن يحمل كل
 * صفٍّ مصدراً، وأن تبقى صياغة «غير مثبت علناً» بدل النفي.
 *
 * وتفحص **البيانات** لا نصّ الصفحة: الصفحة تُبنى منها، فإصلاح النصّ وحده
 * يتركها كاذبة عند أول إعادة تصيير.
 *
 * التشغيل: node presentation/tests/compare-honesty-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const Compare = require(path.join(ROOT, 'athar-compare-data.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const PAGE = path.join(ROOT, 'athar-compare.html');

// ---- كل منافس يتفوّق في شيء -------------------------------------------

test('كل منافس يتفوّق على أثر في بُعد واحد على الأقل', () => {
  /* **الفحص الحاكم.** جدولٌ بلا خسارة واحدة ليس مقارنة. */
  Compare.COMPETITORS.forEach((item) => {
    const wins = Compare.advantagesOf(item.key);
    assert.ok(wins.length >= 1,
      `«${item.name}» لا يتفوّق في أي بُعد — الجدول دعاية لا مقارنة`);
  });
});

test('التفوّق ليس رمزياً: غيرُنا يتقدّم في ثلث الأبعاد على الأقل', () => {
  const leading = Compare.DIMENSIONS
    .filter((dim) => Compare.betterElsewhere(dim).length).length;
  assert.ok(leading >= Math.ceil(Compare.DIMENSIONS.length / 3),
    `${leading} من ${Compare.DIMENSIONS.length} بعداً فقط يتقدّم فيها غيرُنا — `
    + 'خسارةٌ صوريّة تُقرأ دعايةً بغلاف إنصاف');
});

test('التفوّق مُسمّى صراحةً لا مستنتَجاً من الرتب', () => {
  /* الاستنتاج من الرتب يجعل تعديل وصفٍ يبدّل خريطة التفوّق بصمت. */
  Compare.DIMENSIONS.forEach((dim) => {
    assert.ok(Array.isArray(dim.betterElsewhere),
      `${dim.key}: بلا قائمة تفوّق صريحة`);
    dim.betterElsewhere.forEach((key) => {
      assert.ok(Compare.COMPETITORS.some((item) => item.key === key),
        `${dim.key}: يشير إلى منافس غير معرّف «${key}»`);
      const theirs = dim.competitors[key];
      assert.strictEqual(Compare.outranks(theirs.state, dim.athar.state), true,
        `${dim.key}: «${key}» معلَّم متفوّقاً ولا يعلوه دليلاً`);
    });
  });
});

test('كل بُعد يتفوّق فيه منافس مذكورٌ في قائمة تفوّقه — لا تفوّت صامت', () => {
  /* العكس: منافسٌ رتبته أعلى ولا يُعدّ متفوّقاً يعني خسارةً أُخفيت. */
  Compare.DIMENSIONS.forEach((dim) => {
    Compare.COMPETITORS.forEach((item) => {
      /* المجهول لا يُقارَن: `outranks` تعيد `null` فلا يُعدّ خسارةً
         مخفيّة ولا تفوّقاً. */
      const theirs = dim.competitors[item.key];
      if (Compare.outranks(theirs.state, dim.athar.state) !== true) return;
      assert.ok(dim.betterElsewhere.indexOf(item.key) !== -1,
        `${dim.key}: «${item.key}» أعلى رتبةً من أثر ولم يُعدّ متفوّقاً — خسارة مخفية`);
    });
  });
});

// ---- كل ادعاء بمصدر ----------------------------------------------------

test('كل منافس وكل بُعد يحمل مصدراً رسمياً', () => {
  const httpOnly = /^https:\/\//;
  Compare.COMPETITORS.forEach((item) => {
    assert.ok(httpOnly.test(item.source), `${item.key}: مصدر غير صالح`);
    assert.ok(item.sourceLabel && item.sourceLabel.length > 5,
      `${item.key}: المصدر بلا وصف يقول ماذا يثبت`);
  });
  Compare.DIMENSIONS.forEach((dim) => {
    assert.ok(httpOnly.test(dim.source), `${dim.key}: بُعد بلا مصدر`);
  });
});

test('المصادر رسمية — لا صفحة مقارنة تجارية', () => {
  /* منهج حزمة البحث: لا تُستعمل صفحة مقارنة تجارية مستقلة لإثبات قدرة منتج. */
  const banned = /g2\.com|capterra|trustradius|softwareadvice|gartner\.com\/reviews/i;
  const all = Compare.COMPETITORS.map((item) => item.source)
    .concat(Compare.DIMENSIONS.map((dim) => dim.source));
  all.forEach((url) => {
    assert.ok(!banned.test(url), `مصدر مقارنة تجارية: ${url}`);
  });
});

test('تاريخ المراجعة معلن ومعقول', () => {
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(Compare.REVIEWED_ON));
  const page = fs.readFileSync(PAGE, 'utf8');
  assert.ok(page.indexOf('REVIEWED_ON') !== -1 || page.indexOf(Compare.REVIEWED_ON) !== -1,
    'الصفحة لا تعرض تاريخ مراجعة المصادر');
});

// ---- لا نفي بلا دليل ---------------------------------------------------

test('لا حالة تنفي قدرة عن منافس — الصياغة «غير مثبت علناً»', () => {
  /* `absent` تعني «غير موجود» ولا تُقال إلا عن أثر نفسه: نحن نعرف منتجنا،
     ولا نعرف داخل أنظمتهم المغلقة. */
  Compare.DIMENSIONS.forEach((dim) => {
    Compare.COMPETITORS.forEach((item) => {
      const theirs = dim.competitors[item.key];
      assert.ok(theirs, `${dim.key}: لا حالة لـ«${item.key}»`);
      assert.ok(Compare.STATES[theirs.state],
        `${dim.key}/${item.key}: حالة غير معروفة «${theirs.state}»`);
      assert.notStrictEqual(theirs.state, 'absent',
        `${dim.key}: نفيُ قدرةٍ عن «${item.key}» بلا دليل`);
      if (theirs.state === 'not-public') {
        assert.ok(/لم (?:تظهر|يظهر)/.test(theirs.note),
          `${dim.key}/${item.key}: «غير مثبت علناً» بصياغة تُقرأ نفياً — ${theirs.note}`);
      }
    });
  });
});

test('الصفحة تشرح أن «غير مثبت علناً» ليست نفياً', () => {
  const page = fs.readFileSync(PAGE, 'utf8');
  assert.ok(/غير مثبت علناً[\s\S]{0,80}ليست[\s\S]{0,40}لا يفعلونه/.test(page),
    'الصفحة لا تفصل بين «لم يظهر» و«لا يوجد»');
});

// ---- خارطة الطريق لا تُحتسب قدرة --------------------------------------

test('خارطة الطريق لا تُعدّ تفوّقاً لأثر', () => {
  /* «سيفعل» في عمود مقارنة يُقرأ «يفعل». */
  assert.strictEqual(Compare.STATES.roadmap.rank, 0, 'خارطة الطريق لها رتبة');
  Compare.DIMENSIONS.filter((dim) => dim.athar.state === 'roadmap')
    .forEach((dim) => {
      Compare.COMPETITORS.forEach((item) => {
        const theirs = dim.competitors[item.key];
        if (Compare.outranks(theirs.state, dim.athar.state) === true) {
          assert.ok(dim.betterElsewhere.indexOf(item.key) !== -1,
            `${dim.key}: أثر على خارطة الطريق و«${item.key}» أعلى ولم يُعدّ متفوّقاً`);
        }
      });
      assert.ok(/غير منفَّذ/.test(dim.athar.note),
        `${dim.key}: خارطة طريق بلا تصريح أنها غير منفَّذة`);
    });
});

test('المقارنة لا تناقض ما تعلنه بقية الأسطح عن أثر', () => {
  /* الفخّ الذي كشفه زرعٌ نجا: رفعُ حالة أثر من «خارطة طريق» إلى «منفَّذ»
     كان يمرّ — البوابة تفحص الاتساق الداخلي ولا تعرف الحقيقة.
     فالحقيقة تُقرأ من سطحٍ آخر: صفحة الأثر تعلن أنه لا وفر مقيس ميدانياً
     وأن الإثبات ينتظر تجربة ظل. وما دامت تلك العبارة قائمة، فالمعايرة بعد
     التنفيذ **لا يجوز** أن تُعرض منفَّذة في جدول المقارنة.
     سطحان يتناقضان أسوأ من سطحٍ يعترف. */
  const impact = fs.readFileSync(path.join(ROOT, 'athar-city-impact.html'), 'utf8');
  const noFieldData = /وفر مقيس ميدانياً/.test(impact) && /تجربة ظل/.test(impact);
  if (!noFieldData) return;

  const calibration = Compare.DIMENSIONS.find((dim) => dim.key === 'post-calibration');
  assert.ok(calibration, 'بُعد المعايرة بعد التنفيذ غائب من المقارنة');
  assert.notStrictEqual(calibration.athar.state, 'implemented',
    'المقارنة تعرض المعايرة بعد التنفيذ منفَّذة، وصفحة الأثر تعلن أنه لا '
    + 'قياس ميداني — سطحان يتناقضان');
  assert.notStrictEqual(calibration.athar.state, 'partial',
    'المعايرة «منفَّذة بحدود» بلا بيانات ميدانية أصلاً');
});

test('كل حالة لأثر مصحوبة بحدّها', () => {
  Compare.DIMENSIONS.forEach((dim) => {
    assert.ok(dim.athar && dim.athar.note && dim.athar.note.length > 15,
      `${dim.key}: حالة أثر بلا شرح`);
    assert.ok(Compare.STATES[dim.athar.state],
      `${dim.key}: حالة أثر غير معروفة`);
  });
});

// ---- القاعدة الحمراء ---------------------------------------------------

test('لا ادعاء «الأول» أو «غير مسبوق» في البيانات ولا في الصفحة', () => {
  const page = fs.readFileSync(PAGE, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const data = fs.readFileSync(path.join(ROOT, 'athar-compare-data.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/[^\n]*/gm, ' ');
  [['الصفحة', page], ['البيانات', data]].forEach(([label, text]) => {
    text.split('\n').forEach((line, index) => {
      /* نمط القاعدة الحمراء نفسه المعرَّف في الوحدة — ولا يُقرأ منها هنا
         حتى لا يُفرَّغ بتعديله. */
      assert.ok(!/الأول من نوعه|أول منصة|غير مسبوق|لا مثيل له|الوحيد في/.test(line),
        `${label}:${index + 1} ادعاء تفرّد بلا مراجعة سوق شاملة`);
    });
  });
});

test('الصفحة تعلن أن أثر ليس بديلاً لمنصة التصريح', () => {
  const page = fs.readFileSync(PAGE, 'utf8');
  assert.ok(/ليس بديلاً لمنصة التصريح/.test(page),
    'الصفحة لا تقول أين ينتهي دور أثر');
});

// ---- الصفحة مبنية من البيانات -----------------------------------------

test('الصفحة تُبنى من الوحدة ولا تكرّر الجدول نصّاً', () => {
  /* جدولٌ مكتوب في HTML يفترق عن البيانات عند أول تعديل، فيصير للمقارنة
     نسختان تختلفان — وهو أسوأ من غياب المقارنة. */
  const page = fs.readFileSync(PAGE, 'utf8');
  assert.ok(page.indexOf('athar-compare-data.js') !== -1,
    'الصفحة لا تحمّل بيانات المقارنة');
  Compare.DIMENSIONS.forEach((dim) => {
    assert.ok(page.indexOf(dim.title) === -1,
      `عنوان البُعد «${dim.title}» مكتوب في الصفحة — نسخة ثانية تتقادم`);
  });
});

test('الصفحة موصولة: في الفهرس وفي شريط التنقل', () => {
  const nav = fs.readFileSync(path.join(ROOT, 'athar-nav.js'), 'utf8');
  const advanced = fs.readFileSync(path.join(ROOT, 'athar-advanced.html'), 'utf8');
  assert.ok(nav.indexOf('athar-compare.html') !== -1, 'الصفحة خارج قائمة الشريط');
  assert.ok(advanced.indexOf('href="athar-compare.html"') !== -1,
    'الصفحة يتيمة — لا يصلها قسم التفاصيل المتقدمة');
});

console.log(`ALL TESTS PASSED (${count})`);
