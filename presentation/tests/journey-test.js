/**
 * مسار — حارس مخطط رحلة المستخدم. (تبويب مؤقّت — يُحذف معه.)
 * ---------------------------------------------------------------------------
 * مخطط رحلةٍ يوصف يدوياً ينحرف عن المنتج بعد أول تعديل، ثم يُقرأ وصفاً لما
 * ليس موجوداً. فالحزمة تفرض الاتجاهين معاً:
 *
 *   ← لا خطوة في المخطط بلا مقابل في الشيفرة: كل عقدة تحمل `ref` بصيغة
 *     `ملف#رمز`، ويُفتح الملف ويُبحث فيه عن الرمز.
 *   → ولا خطوة في المنتج غائبة عن المخطط: التبويبات السبعة وحالات الفشل
 *     والامتناع المعلنة كلها لها عقدة.
 *
 * ويُفحص المخطط بوصفه رسماً: بداية واحدة، ونهاية، وكل عقدة تُبلَغ من البداية،
 * ولا انتقال إلى عقدة غير موجودة.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const Model = require(path.join(ROOT, 'masar-journey-model.js'));
const Diagram = require(path.join(ROOT, 'masar-journey-diagram.js'));
const File = require(path.join(ROOT, 'masar-desk-file.js'));
const States = require(path.join(ROOT, 'masar-desk-states.js'));

let failures = 0;
function ok(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.error('not ok - ' + name);
    console.error('  ' + err.message);
  }
}

/* ---- سلامة الرسم ---- */

ok('بداية واحدة ونهاية واحدة — لا مخطط بلا مدخل أو بلا مخرج', () => {
  const starts = Model.NODES.filter((n) => n.kind === 'start');
  const ends = Model.NODES.filter((n) => n.kind === 'end');
  assert.strictEqual(starts.length, 1, 'عدد نقاط البداية: ' + starts.length);
  assert.strictEqual(ends.length, 1, 'عدد نقاط النهاية: ' + ends.length);
});

ok('لا معرّف مكرر', () => {
  const seen = {};
  Model.NODES.forEach((node) => {
    assert.ok(!seen[node.id], 'معرّف مكرر: ' + node.id);
    seen[node.id] = true;
  });
});

ok('كل انتقال يصل بين عقدتين موجودتين', () => {
  Model.EDGES.forEach((edge) => {
    assert.ok(Model.byId(edge.from), 'مصدر غير موجود: ' + edge.from);
    assert.ok(Model.byId(edge.to), 'هدف غير موجود: ' + edge.to);
  });
});

ok('كل عقدة تُبلَغ من البداية — لا خطوة معلّقة', () => {
  const seen = Model.reachable();
  const orphans = Model.NODES.filter((node) => !seen[node.id]).map((node) => node.id);
  assert.deepStrictEqual(orphans, [], 'عقد لا تُبلَغ: ' + orphans.join('، '));
});

ok('كل عقدة غير نهائية لها مخرج — لا طريق مسدود بلا إعلان', () => {
  const withExit = {};
  Model.EDGES.forEach((edge) => { withExit[edge.from] = true; });
  const stuck = Model.NODES
    .filter((node) => node.kind !== 'end' && !withExit[node.id])
    .map((node) => node.id);
  assert.deepStrictEqual(stuck, [], 'عقد بلا مخرج: ' + stuck.join('، '));
});

ok('كل قرار يتفرّع إلى مسارين على الأقل — المعيّن بمخرج واحد ليس قراراً', () => {
  Model.NODES.filter((node) => node.kind === 'decision').forEach((node) => {
    const out = Model.EDGES.filter((edge) => edge.from === node.id);
    assert.ok(out.length >= 2, node.id + ': ' + out.length + ' مخرجاً فقط');
    out.forEach((edge) => {
      assert.ok(edge.label, node.id + ' → ' + edge.to + ': فرع بلا تسمية');
    });
  });
});

/* ---- الإسناد: لا عقدة بلا مقابل في الشيفرة ---- */

ok('كل مرجع يشير إلى ملف قائم ورمز موجود فيه', () => {
  const missing = [];
  Model.NODES.forEach((node) => {
    assert.ok(node.ref, node.id + ': بلا مرجع');
    const [file, symbol] = node.ref.split('#');
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) {
      missing.push(node.id + ': ملف مفقود ' + file);
      return;
    }
    const source = fs.readFileSync(full, 'utf8');
    if (source.indexOf(symbol) === -1) {
      missing.push(node.id + ': ' + symbol + ' ليس في ' + file);
    }
  });
  assert.deepStrictEqual(missing, [], 'مراجع لا مقابل لها:\n  ' + missing.join('\n  '));
});

/* ---- التغطية: لا خطوة في المنتج غائبة عن المخطط ---- */

ok('التبويبات السبعة كلها في المخطط — لا تبويب بلا موضع في الرحلة', () => {
  const labels = File.TABS.map((tab) => tab.label);
  assert.deepStrictEqual(labels, Model.COVERAGE.tabs,
    'تبويبات المنتج تغيّرت ولم يتبعها المخطط');

  const tabsNode = Model.byId('tabs');
  labels.forEach((label) => {
    assert.ok(tabsNode.label.indexOf(label) !== -1, 'تبويب غائب عن المخطط: ' + label);
  });
});

ok('حالات الاستثناء المعلنة كلها ممثَّلة', () => {
  Model.COVERAGE.exceptions.forEach((id) => {
    const node = Model.byId(id);
    assert.ok(node, 'حالة استثنائية مفقودة: ' + id);
    assert.ok(node.kind === 'error' || node.kind === 'terminal',
      id + ': ليست معلَّمة استثناءً');
  });
});

/**
 * الحُرّاس ليسوا شعاراً في المخطط كذلك: القاعدتان اللتان يفرضهما
 * `masar-desk-states.js` مذكورتان بنصّهما في عقدة الحجب، فمن يقرأ الرحلة
 * يعرف ما الذي يوقف الإجراء قبل أن يجرّبه.
 */
ok('عقدة الحجب تسمّي القواعد التي يفرضها الحارس فعلاً', () => {
  const blocked = Model.byId('blocked');
  const snapshot = States.guard({ status: 'StrategyReview' }, 'approve');
  const publish = States.guard({ status: 'Scheduled' }, 'publish');

  assert.ok(snapshot.blockers.some((b) => b.reason === 'snapshot-required'),
    'الحارس لم يعد يفرض نسخة المدخلات');
  assert.ok(publish.blockers.some((b) => b.reason === 'direction-required'),
    'الحارس لم يعد يفرض الاتجاه');

  assert.ok(blocked.label.indexOf('نسخة مدخلات') !== -1, 'قاعدة نسخة المدخلات غائبة');
  assert.ok(blocked.label.indexOf('اتجاه') !== -1, 'قاعدة الاتجاه غائبة');
});

ok('المسارات مسمّاة وكل عقدة تقع في أحدها', () => {
  const ids = Model.LANES.map((lane) => lane.id);
  Model.NODES.forEach((node) => {
    assert.ok(ids.indexOf(node.lane) !== -1, node.id + ': مسار غير معرّف');
  });
});

/* ---- الرسم ---- */

ok('الراسم يخرج SVG صالحاً يحمل كل عقدة', () => {
  const svg = Diagram.render(Model);
  assert.ok(svg.indexOf('<svg') === 0, 'المخرج ليس SVG');
  assert.ok(svg.indexOf('</svg>') !== -1, 'SVG غير مغلق');
  assert.ok(svg.indexOf('jnArrow') !== -1, 'لا رأس سهم معرَّف');

  // الأشكال القياسية: معيّن لكل قرار، وقرص للبداية والنهاية.
  const diamonds = (svg.match(/class="jn-decision"/g) || []).length;
  const decisions = Model.NODES.filter((node) => node.kind === 'decision').length;
  assert.strictEqual(diamonds, decisions, 'عدد المعيّنات لا يساوي عدد القرارات');

  Model.NODES.forEach((node) => {
    const first = node.label.split(/\s+/)[0].replace(/[«»]/g, '');
    assert.ok(svg.indexOf(first) !== -1, 'عقدة بلا نص مرسوم: ' + node.id);
  });
});

ok('الأسهم الراجعة متقطّعة — العودة تُقرأ من الشكل', () => {
  const svg = Diagram.render(Model);
  const backs = Model.EDGES.filter((edge) => edge.back).length;
  assert.ok(backs >= 4, 'المخطط بلا عودات كافية: ' + backs);
  assert.ok((svg.match(/jn-edge-back/g) || []).length >= backs,
    'عودات غير مرسومة بنمط العودة');
});

ok('النص يُلفّ فلا يخرج من الشكل', () => {
  const lines = Diagram.wrap('كلمة أخرى وثالثة ورابعة وخامسة وسادسة وسابعة وثامنة', 20);
  assert.ok(lines.length > 1, 'اللفّ لا يعمل');
  lines.forEach((line) => assert.ok(line.length <= 28, 'سطر أطول من المسموح: ' + line));
});

/* ---- المؤقّت يبقى مؤقّتاً ---- */

ok('التبويب معلَّم مؤقّتاً وقابلاً للحذف بلا أثر', () => {
  // موضعه بعد إعادة التنظيم: داخل «التفاصيل المتقدمة» لا على الشريط الرئيسي.
  const Catalog = require(path.join(ROOT, 'masar-catalog.js'));
  const entry = Catalog.ADVANCED.filter((page) => page.file === 'masar-journey.html')[0];
  assert.ok(entry, 'التبويب ليس في قسم التفاصيل المتقدمة');
  assert.strictEqual(entry.temporary, true, 'التبويب غير معلَّم مؤقّتاً في الفهرس');

  const nav = fs.readFileSync(path.join(ROOT, 'masar-nav.js'), 'utf8');
  assert.ok(nav.indexOf("'masar-journey.html'") !== -1,
    'الشريط لا يعرف الصفحة فلا يعلّم قسمها');
  assert.ok(!/\{\s*file:\s*'masar-journey\.html'/.test(nav),
    'التبويب المؤقّت عاد إلى الشريط الرئيسي');

  const html = fs.readFileSync(path.join(ROOT, 'masar-journey.html'), 'utf8');
  assert.ok(html.indexOf('تبويب مؤقّت') !== -1, 'الصفحة لا تعلن أنها مؤقّتة');

  /*
   * من يذكر الصفحة محصورٌ في ثلاثة مواضع معروفة، وكلها مذكورة في تعليمات
   * الحذف داخل الصفحة نفسها. الحصر هو ما يجعل «قابل للحذف» قابلاً للتحقّق:
   * قائمةٌ مفتوحة تعني أن أحداً لا يعرف ما الذي سينكسر عند الحذف.
   */
  const ALLOWED_REFERRERS = [
    'masar-nav.js',        // ليعلّم قسم «التفاصيل المتقدمة» حين تُفتح الصفحة
    'masar-catalog.js',    // مدخل واحد في قائمة المتقدمة، معلَّم temporary
    'masar-advanced.html', // كتلة مبنيّة من الفهرس — تختفي ببناء واحد بعد الحذف
  ];

  const product = fs.readdirSync(ROOT)
    .filter((f) => (f.endsWith('.js') || f.endsWith('.html')) && f.indexOf('journey') === -1);
  const leaks = product.filter((f) =>
    fs.readFileSync(path.join(ROOT, f), 'utf8').indexOf('masar-journey') !== -1
    && ALLOWED_REFERRERS.indexOf(f) === -1);
  assert.deepStrictEqual(leaks, [], 'ملفات المنتج تعتمد على التبويب المؤقّت: ' + leaks.join('، '));

  // وتعليمات الحذف داخل الصفحة تذكر كل موضع من هذه المواضع.
  ALLOWED_REFERRERS.forEach((file) => {
    assert.ok(html.indexOf(file) !== -1,
      'تعليمات الحذف لا تذكر ' + file + ' — الحذف سيترك أثراً');
  });
});

if (failures) {
  console.error('\n' + failures + ' فشل');
  process.exit(1);
}
console.log('\nكل اختبارات رحلة المستخدم نجحت');
