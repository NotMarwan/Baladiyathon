'use strict';
/**
 * WP-T5 — منع الانعطاف: مطبَّق، ومحدود، وكلاهما مفحوص.
 *
 * التحكيم البارد خصم على هذا البند بوصف دقيق: «الآلية منفَّذة والبيانات
 * رقيقة». وهذه الحزمة تفصل الادعاءين وتفحص كلاً منه على حدة:
 *
 *   · **التطبيق** — يُفحص سلوكاً: مساراتٌ حقيقية عبر عقد مقيَّدة، ويُشترط
 *     ألّا يمرّ أيٌّ منها بانتقال ممنوع. وجودُ جدول القيود لا يثبت احترامه.
 *   · **الحدّ** — يُفحص إعلاناً: سلسلة الفقد معروضة برقمها في سطحٍ يقرؤه
 *     المحكّم، لا مذكورة في تعليق.
 *
 * ولماذا لم يُوسَّع مدى إسناد العقدة لاستعادة السبعة عشر: منعٌ كاذب أسوأ من
 * منعٍ غائب. الغائب يترك المحرك يقترح انعطافاً قد يكون ممنوعاً؛ والكاذب يمنع
 * انعطافاً مسموحاً فيرسل السائق في التفاف بلا سبب — وهو خطأ يصنعه النظام لا
 * خطأ يرثه عن بياناته.
 *
 * التشغيل: node presentation/tests/turn-restrictions-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'riyadh-route-graph.js'));
require(path.join(ROOT, 'data', 'riyadh-turn-restrictions.js'));
const Routing = require(path.join(ROOT, 'masar-city-routing.js'));
const Coverage = require(path.join(ROOT, 'masar-network-coverage.js'));

const GRAPH = global.window.RIYADH_ROUTE_GRAPH;
const prepared = Routing.prepare(GRAPH);

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

// ---- التطبيق: سلوك لا جدول -----------------------------------------------

test('كل قيد محمَّل في جدول البحث بمفتاحه', () => {
  /* الشرط الأدنى: قيدٌ في البيانات ولا مفتاح له في `prepared` قيدٌ مهمَل. */
  const missing = [];
  GRAPH.restrictions.forEach((rule) => {
    const key = rule[0] + ':' + rule[1] + ':' + rule[2];
    if (!prepared.forbidden[key]) missing.push(key);
  });
  assert.deepStrictEqual(missing, [],
    `${missing.length} قيداً في البيانات بلا مفتاح في جدول البحث`);
  assert.strictEqual(Object.keys(prepared.forbidden).length,
    GRAPH.restrictions.length);
});

test('لا مسار حقيقي يخالف قيداً — يُفحص على أربعين حالة', () => {
  /* **الفحص الحاكم.** لكل قيد يُطلب مسارٌ بين طرفيه: من الطرف البعيد للضلع
     الداخل إلى الطرف البعيد للضلع الخارج. لو تجاهل البحث القيد لكان هذا
     المسار أقصر طريق ممكن، فيظهر الانتقال الممنوع فوراً. */
  let tested = 0;
  const violations = [];

  for (const [fromEdge, via, toEdge] of GRAPH.restrictions) {
    const a = GRAPH.edges[fromEdge];
    const b = GRAPH.edges[toEdge];
    const from = a[0] === via ? a[1] : a[0];
    const to = b[0] === via ? b[1] : b[0];
    if (!GRAPH.inMain[from] || !GRAPH.inMain[to]) continue;

    const route = Routing.shortestPath(prepared, from, to, { hour: 8 });
    if (!route || !route.states) continue;
    tested += 1;

    for (let i = 1; i < route.states.length; i += 1) {
      const previous = route.states[i - 1] >> 1;
      const current = route.states[i] >> 1;
      const node = Routing.tailOf(GRAPH, route.states[i]);
      if (previous === fromEdge && node === via && current === toEdge) {
        violations.push(`${fromEdge}:${via}:${toEdge}`);
      }
    }
    if (tested >= 40) break;
  }

  assert.ok(tested >= 30, `${tested} حالة فقط — العيّنة أضيق من أن تُعمَّم`);
  assert.deepStrictEqual(violations, [],
    `${violations.length} مساراً خالف قيداً:\n    ${violations.join('\n    ')}`);
});

test('الاتجاه الواحد محترم كذلك — لا يكفي منع الانعطاف', () => {
  /* ستة وأربعون ألف ضلع باتجاه واحد. مسارٌ يعبر ضلعاً عكس اتجاهه خطأٌ أفدح
     من انعطاف ممنوع، ويقع في كل رحلة لا في تقاطع. */
  const wrongWay = [];
  let checked = 0;
  for (let i = 0; i < GRAPH.edges.length && checked < 25; i += 977) {
    const edge = GRAPH.edges[i];
    if (edge[5] === 0) continue;
    if (!GRAPH.inMain[edge[0]] || !GRAPH.inMain[edge[1]]) continue;
    checked += 1;
    /* الاتجاه: `direction >= 0` يجيز a→b، و`<= 0` يجيز b→a. الحالة الزوجية
       a→b والفردية b→a. */
    const forbiddenState = edge[5] > 0 ? 2 * i + 1 : 2 * i;
    const allowed = (prepared.outgoing[edge[5] > 0 ? edge[1] : edge[0]] || []);
    if (allowed.indexOf(forbiddenState) !== -1) wrongWay.push(i);
  }
  assert.ok(checked >= 15, `${checked} ضلعاً فقط فُحص`);
  assert.deepStrictEqual(wrongWay, [],
    `${wrongWay.length} ضلعاً يمكن عبوره عكس اتجاهه`);
});

// ---- الحدّ: معلن برقمه ---------------------------------------------------

test('التغطية محسوبة من البيانات لا مكتوبة', () => {
  const facts = Coverage.turnRestrictions(global.window);
  assert.ok(facts, 'لا حصيلة تغطية');
  assert.strictEqual(facts.forbiddenTransitions, GRAPH.restrictions.length);
  assert.strictEqual(facts.keptRelations,
    global.window.RIYADH_TURN_RESTRICTIONS.rules.length);
  assert.strictEqual(facts.edges, GRAPH.edges.length);
  assert.strictEqual(facts.appliedRules + facts.unresolvedRules,
    facts.keptRelations, 'المطبَّق والمتعذّر لا يجمعان المستخرَج');

  const source = fs.readFileSync(
    path.join(ROOT, 'masar-network-coverage.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/[^\n]*/gm, ' ');
  const planted = source.match(/\b\d{2,}\b/g) || [];
  assert.deepStrictEqual(planted, [],
    `أرقام مزروعة في وحدة التغطية: ${planted.join(' ')}`);
});

test('سلسلة الفقد كاملة — لا فرقٌ مجهول المنشأ', () => {
  /* من يقرأ «64 من 162» يستحق أن يعرف أين ذهبت البقية. فرقٌ بلا تفصيل
     يُقرأ إهمالاً أو إخفاءً. */
  const facts = Coverage.turnRestrictions(global.window);
  const accounted = facts.keptRelations + facts.skipped.incomplete
    + facts.skipped.viaWay + facts.skipped.conditional;
  assert.strictEqual(accounted, facts.fetchedRelations,
    `${facts.fetchedRelations - accounted} علاقة غير محسوبة في سلسلة الفقد`);
  assert.ok(facts.skipped.incomplete > 0,
    'لا فقد معلن — إمّا تغيّرت البيانات أو سقط العدّ');
});

test('الجملة المعروضة تقول الشطرين معاً', () => {
  /* شطرٌ وحده تضليل في الاتجاهين: «مطبَّق» وحده يوهم بالشمول، و«محدود»
     وحده يوهم بأن الآلية غائبة. */
  const text = Coverage.statement(global.window);
  assert.ok(/مطبَّق ومفحوص/.test(text), 'الجملة لا تقول إن القيود مطبَّقة');
  assert.ok(/التغطية ليست شاملة/.test(text), 'الجملة لا تعلن الحدّ');
  assert.ok(/OpenStreetMap/.test(text), 'الجملة لا تنسب السبب إلى المصدر');
  assert.ok(/منعٍ كاذب|منع كاذب/.test(text),
    'الجملة لا تشرح لماذا لم يُوسَّع الإسناد');
  const facts = Coverage.turnRestrictions(global.window);
  [facts.appliedRules, facts.forbiddenTransitions, facts.skipped.incomplete]
    .forEach((value) => {
      assert.ok(text.indexOf(String(value)) !== -1,
        `الجملة لا تحمل الرقم ${value}`);
    });
});

test('الحدّ معروض في سطح يقرؤه المحكّم لا في تعليق', () => {
  /* تعليقٌ يشرح حدّاً لا يصل إلى أحد. الدرس نفسه المتعلَّم في WP-WZ1. */
  const sources = fs.readFileSync(path.join(ROOT, 'masar-sources.html'), 'utf8');
  assert.ok(sources.indexOf('masar-network-coverage.js') !== -1,
    'صفحة المصادر لا تحمّل وحدة التغطية');
  assert.ok(/turn-restriction-coverage/.test(sources),
    'صفحة المصادر بلا موضع لعرض التغطية');
});

console.log(`ALL TESTS PASSED (${count})`);
