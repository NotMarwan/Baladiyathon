'use strict';
/**
 * صندوق الأعمال لا ينطوي على الشاشات الضيقة.
 * ---------------------------------------------------------------------------
 * **العيب الذي تحرسه هذه البوابة.**
 *
 * عند 390 بكسل كان `#deskList` يُصيَّر بارتفاع **صفر** داخل لوحٍ بارتفاع 55
 * بكسل، بينما `scrollHeight` يزيد على ثلاثة عشر ألف بكسل. أي أن التصاريح
 * المئة والخمسين كانت كلها في شجرة الصفحة ولا واحد منها مرئي.
 *
 * وأثره ليس تجميلياً: صندوق الأعمال هو **بوابة الدخول الوحيدة** إلى المحفظة.
 * بلا قائمة لا يصل المراجع إلى عمل إلا بالبحث عن مرجعه — وهو لا يعرف المرجع
 * قبل أن يرى القائمة. فالمنتج على الجوال كان يعرض خريطة وبطاقة قرار لعملٍ
 * لا سبيل إلى اختياره.
 *
 * **السبب:** استعلام العرض الضيق كان يعطي `.desk-pane` سقفاً (`max-height`)
 * بلا أرضية. وفي العمود المنفرد يصير صفّ الشبكة بارتفاع محتواه، و`#deskList`
 * يحمل `flex: 1 1 auto` مع `min-height: 0` موروثاً — فلا أساس يُوزَّع عليه.
 *
 * **لماذا فحص نصّي لا فحص متصفح.** خط الاختبارات لا يشغّل متصفحاً، وإضافة
 * واحد لأجل قاعدتين إسرافٌ يبطئ كل تشغيل. المفحوص هنا هو السبب الجذري —
 * وجود أرضية معلَنة — لا العَرَض. والقياس البصري أُثبت يدوياً عند 390px
 * (صفر ⇐ 380 بكسل) وسُجّل في
 * `docs/audits/final-independent-acceptance/NON-EXPERT-VISUAL-AUDIT.md`.
 *
 * التشغيل: node presentation/tests/responsive-inbox-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'masar-desk.css'), 'utf8');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

/** يستخرج متن استعلام وسائط بعينه. */
function mediaBlock(query) {
  const start = css.indexOf(query);
  assert.notStrictEqual(start, -1, `استعلام مفقود: ${query}`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`استعلام غير مغلق: ${query}`);
}

const narrow = mediaBlock('@media (max-width: 900px)');

test('استعلام العرض الضيق موجود ويطوي الشبكة إلى عمود واحد', () => {
  assert.match(narrow, /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    'العمود المنفرد غير معلَن — التخطيط الضيق لا ينطبق');
});

test('لوح صندوق الأعمال له أرضية لا سقف وحده', () => {
  assert.match(narrow, /\.desk-pane-inbox\s*\{[^}]*min-height:/,
    'لوح الصندوق بلا `min-height` — السقف وحده يطويه إلى صفر');
});

test('قائمة التصاريح نفسها لها أرضية', () => {
  assert.match(narrow, /#deskList\s*\{[^}]*min-height:/,
    '`#deskList` بلا `min-height` — `flex: 1 1 auto` ينكمش إلى صفر');
});

test('الأرضية أكبر من صفر بقدر يكفي لصفوف تُقرأ', () => {
  /* صفّ التصريح الواحد ~75 بكسل. أرضيةٌ دون ربع الشاشة تعرض صفّاً أو صفين،
     وهي قائمة بالاسم لا بالوظيفة. الحدّ 25vh يمنع «إصلاحاً» يمرّ البوابة
     ولا يعيد القائمة. */
  const listFloor = /#deskList\s*\{[^}]*min-height:\s*(\d+(?:\.\d+)?)vh/.exec(narrow);
  assert.ok(listFloor, 'أرضية القائمة ليست بوحدة vh — لا تُقاس نسبةً للشاشة');
  assert.ok(Number(listFloor[1]) >= 25,
    `أرضية القائمة ${listFloor[1]}vh — أقل من أن تعرض قائمة تُتصفَّح`);
});

test('السقف باقٍ فوق الأرضية — الصندوق لا يبتلع الشاشة', () => {
  assert.match(narrow, /\.desk-pane\s*\{[^}]*max-height:/,
    'السقف رُفع — الصندوق قد يدفع بطاقة القرار خارج الشاشة');
});

test('لا تمرير أفقي: أعمدة الشبكة تنكمش', () => {
  /* `min-width: 0` على اللوح هو ما يسمح للعمود بالانكماش. رفعُه يعيد الفيض
     الأفقي الذي كان قبل الشبكة الحالية. */
  assert.match(css, /\.desk-pane\s*\{[^}]*min-width:\s*0/,
    '`min-width: 0` مرفوع عن اللوح — يعود التمرير الأفقي على الجوال');
});

console.log(`ALL TESTS PASSED (${count})`);
