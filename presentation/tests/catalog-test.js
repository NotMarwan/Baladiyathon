/**
 * أثر — حارس الفهرس: لا ادّعاء بلا سند.
 * ---------------------------------------------------------------------------
 * `athar-catalog.js` هو ما تعرضه الصفحة الرئيسية وصفحة النظرة العامة عن
 * المشروع: خصائصه وحالاتها ومصادرها واختباراتها وقيوده. وثيقةٌ من هذا النوع
 * تكذب بلا أن تقصد: تُكتب مرة، ثم يتغيّر الملف أو تُحذف الحزمة أو تنتقل
 * الخاصية، ويبقى النص يقول ما لم يعد صحيحاً.
 *
 * فالحزمة تفتح ما يُذكر لا تصدّقه:
 *
 *   ← كل ملف مذكور في خاصية أو بنية موجود على القرص.
 *   ← كل حزمة اختبار مذكورة موجودة في `tests/`.
 *   ← لا خاصية «مكتملة» بلا حزمة تغطيها — الاكتمال بلا تحقّق ادّعاء.
 *   ← كل معرّف مصدر موجود في `athar-sources.html` نفسه.
 *   ← كل صفحة في قسم المتقدم موجودة ومربوطة.
 *   ← الخاصية غير المنفذة لا تحمل ملفاً ولا حزمة — ولا تُعدّ إنجازاً.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const Catalog = require(path.join(ROOT, 'athar-catalog.js'));

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

const suiteFiles = fs.readdirSync(path.join(ROOT, 'tests'))
  .filter((f) => f.endsWith('-test.js'));

/* ---- الخصائص ---- */

ok('كل خاصية تحمل الحقول التي تجعلها قابلة للتحقق', () => {
  const required = ['id', 'name', 'goal', 'status', 'inputs', 'outputs',
    'source', 'validation', 'limits'];
  Catalog.FEATURES.forEach((item) => {
    required.forEach((field) => {
      assert.ok(item[field] !== undefined && item[field] !== '',
        item.id + ': حقل ناقص — ' + field);
    });
  });
});

ok('كل حالة معرَّفة في جدول الحالات — لا حالة مخترعة', () => {
  Catalog.FEATURES.forEach((item) => {
    assert.ok(Catalog.STATUS[item.status], item.id + ': حالة غير معرَّفة ' + item.status);
  });
});

ok('كل ملف تذكره خاصية موجود فعلاً', () => {
  const missing = [];
  Catalog.FEATURES.forEach((item) => {
    if (!item.file) return;
    if (!fs.existsSync(path.join(ROOT, item.file))) missing.push(item.id + ' → ' + item.file);
  });
  assert.deepStrictEqual(missing, [], 'ملفات مذكورة وغير موجودة: ' + missing.join('، '));
});

ok('كل حزمة اختبار تذكرها خاصية موجودة في tests/', () => {
  const missing = [];
  Catalog.FEATURES.forEach((item) => {
    if (item.validation === '—') return;
    item.validation.split('·').map((s) => s.trim()).forEach((suite) => {
      if (!suite) return;
      if (suiteFiles.indexOf(suite) === -1) missing.push(item.id + ' → ' + suite);
    });
  });
  assert.deepStrictEqual(missing, [], 'حزم مذكورة وغير موجودة: ' + missing.join('، '));
});

/**
 * الاكتمال بلا تحقّق ادّعاء.
 * خاصيةٌ تُعلَن «مكتملة» ولا حزمة تغطيها لا يمكن لأحد أن يتأكد منها — لا
 * محكّم ولا مطوّر بعد شهر. فالقاعدة تُفرَض هنا لا تُوصى.
 */
ok('لا خاصية مكتملة بلا حزمة اختبار تغطيها', () => {
  const bare = Catalog.byStatus('complete')
    .filter((item) => !item.validation || item.validation === '—')
    .map((item) => item.id);
  assert.deepStrictEqual(bare, [], 'خصائص مكتملة بلا تحقّق: ' + bare.join('، '));
});

ok('الخاصية غير المنفذة لا تدّعي ملفاً ولا حزمة', () => {
  Catalog.byStatus('notImplemented').forEach((item) => {
    assert.strictEqual(item.file, null, item.id + ': غير منفذة وتذكر ملفاً');
    assert.strictEqual(item.validation, '—', item.id + ': غير منفذة وتذكر حزمة');
  });
});

ok('لا معرّف خاصية مكرر', () => {
  const seen = {};
  Catalog.FEATURES.forEach((item) => {
    assert.ok(!seen[item.id], 'معرّف مكرر: ' + item.id);
    seen[item.id] = true;
  });
});

/**
 * الحالات الست موجودة في الجدول لا في الشيفرة وحدها: طيّ الاكتمال إلى
 * نعم/لا هو ما يجعل التوثيق يبالغ بلا أن يقصد.
 */
ok('جدول الحالات يغطي الحالات الست المطلوبة', () => {
  ['complete', 'partial', 'wip', 'blockedData', 'needsIntegration', 'notImplemented']
    .forEach((key) => {
      assert.ok(Catalog.STATUS[key], 'حالة مفقودة: ' + key);
      assert.ok(Catalog.STATUS[key].label, key + ': بلا تسمية عربية');
    });
});

ok('المشروع لا يدّعي أنه كله مكتمل', () => {
  const notComplete = Catalog.FEATURES.filter((item) => item.status !== 'complete');
  assert.ok(notComplete.length >= 3,
    'كل الخصائص «مكتملة» — راجع الحالات الحقيقية قبل النشر');
});

/* ---- المصادر ---- */

ok('كل معرّف مصدر موجود في سجل المصادر نفسه', () => {
  const html = fs.readFileSync(path.join(ROOT, 'athar-sources.html'), 'utf8');
  const missing = Catalog.SOURCES
    .filter((source) => html.indexOf('id="' + source.id + '"') === -1)
    .map((source) => source.id);
  assert.deepStrictEqual(missing, [], 'مصادر مذكورة وغير موجودة: ' + missing.join('، '));
});

ok('سجل المصادر لا يحوي مصدراً غاب عن الفهرس', () => {
  const html = fs.readFileSync(path.join(ROOT, 'athar-sources.html'), 'utf8');
  const found = (html.match(/id="(src-[^"]+)"/g) || [])
    .map((m) => m.replace(/id="|"/g, ''));
  const known = Catalog.SOURCES.map((source) => source.id);
  const extra = found.filter((id) => known.indexOf(id) === -1);
  assert.deepStrictEqual(extra, [], 'مصادر في السجل وليست في الفهرس: ' + extra.join('، '));
});

/* ---- البنية والصفحات ---- */

ok('كل ملف في وصف البنية موجود', () => {
  const missing = [];
  Catalog.ARCHITECTURE.forEach((layer) => {
    layer.files.forEach((file) => {
      if (!fs.existsSync(path.join(ROOT, file))) missing.push(layer.layer + ' → ' + file);
    });
  });
  assert.deepStrictEqual(missing, [], 'ملفات بنية غير موجودة: ' + missing.join('، '));
});

ok('كل صفحة في قسم المتقدم موجودة', () => {
  const missing = Catalog.ADVANCED
    .filter((page) => !fs.existsSync(path.join(ROOT, page.file)))
    .map((page) => page.file);
  assert.deepStrictEqual(missing, [], 'صفحات مذكورة وغير موجودة: ' + missing.join('، '));
});

ok('كل حزمة في جدول الاختبارات موجودة', () => {
  const missing = Catalog.TESTING.areas
    .filter((row) => suiteFiles.indexOf(row.suite) === -1)
    .map((row) => row.suite);
  assert.deepStrictEqual(missing, [], 'حزم مذكورة وغير موجودة: ' + missing.join('، '));
});

/* ---- الفجوات والبيانات التمثيلية ---- */

ok('كل فجوة تحمل صياغة حالة صريحة لا فراغاً', () => {
  Catalog.GAPS.forEach((gap) => {
    assert.ok(gap.item && gap.state, 'فجوة بلا وصف أو حالة');
  });
});

/**
 * البيانات التمثيلية تُعلَن حيث تُعرض لا في وثيقة جانبية.
 * فالفهرس يذكر مكان الوسم، والحزمة تفتح الصفحة وتتأكد أنه هناك.
 */
ok('كل بيان تمثيلي موسوم في الصفحة التي يظهر فيها', () => {
  const desk = fs.readFileSync(path.join(ROOT, 'athar-desk.html'), 'utf8');
  assert.ok(desk.indexOf('بيانات توضيحية للعرض') !== -1,
    'المكتب بلا شارة البيانات التوضيحية');

  const measurement = fs.readFileSync(path.join(ROOT, 'athar-desk-measurement.js'), 'utf8');
  assert.ok(measurement.indexOf('تركيبية ومعلَّمة') !== -1,
    'تبويب القياس بلا لافتة الأرصاد التركيبية');

  Catalog.REPRESENTATIVE.forEach((row) => {
    assert.ok(row.why && row.mark, row.item + ': بلا سبب أو بلا وسم');
  });
});

/* ---- الرحلة ---- */

ok('الرحلة المختصرة أربع خطوات مرقّمة بالترتيب وكل خطوة تفتح صفحة قائمة', () => {
  assert.strictEqual(Catalog.JOURNEY.length, 4, 'الرحلة المختصرة ليست أربع خطوات');
  Catalog.JOURNEY.forEach((step, index) => {
    assert.strictEqual(step.step, index + 1, 'ترقيم الخطوات مضطرب');
    assert.ok(fs.existsSync(path.join(ROOT, step.href)), 'خطوة تشير إلى صفحة غير موجودة');
  });
});

/* ---- الصفحات المبنيّة ---- */

/**
 * النص في الـHTML لا في السكربت.
 * ---------------------------------------------------------------------------
 * صفحاتُ الفهرس تُبنى مرة وتُكتب في الملف، فيقرؤها من لا ينفّذ جافاسكربت —
 * قارئ صوتي، مفهرس، نظام تقييم. والثمن أن تتقادم: يتغيّر الفهرس ويبقى المكتوب.
 * فالحزمة تعيد البناء في الذاكرة وتقارنه بالمكتوب، ولا تكتب شيئاً.
 */
ok('صفحات الفهرس مبنيّة من النسخة الحالية منه', () => {
  const builder = require(path.join(ROOT, 'scripts', 'build-catalog-pages.js'));
  const expected = builder.expected();
  const stale = Object.keys(expected).filter((file) => {
    return fs.readFileSync(path.join(ROOT, file), 'utf8') !== expected[file];
  });
  assert.deepStrictEqual(stale, [],
    'صفحات متقادمة: ' + stale.join('، ')
      + ' — شغّل: node presentation/scripts/build-catalog-pages.js');
});

/**
 * الكشف المتدرّج لا الإخفاء.
 * ---------------------------------------------------------------------------
 * الفرق بين طيّ المعلومة وإخفائها أن الأولى في الشجرة والثانية ليست. فالتفصيل
 * داخل `<details>` — عنصر قياسي محتواه مقروء دائماً — ولا يُدفع خارج الشاشة
 * ولا يُلوَّن بلون الخلفية.
 */
ok('التفصيل مطويّ لا مخفيّ — ولا نص خارج الشاشة ولا بلون الخلفية', () => {
  const overview = fs.readFileSync(path.join(ROOT, 'athar-overview.html'), 'utf8');
  assert.ok((overview.match(/<details/g) || []).length >= 10,
    'لا كشف متدرّج في صفحة النظرة العامة');

  ['athar-home.html', 'athar-overview.html', 'athar-advanced.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(!/display\s*:\s*none/.test(html), file + ': نص محجوب بـ display:none');
    assert.ok(!/text-indent\s*:\s*-\d{4}/.test(html), file + ': نص مدفوع خارج الشاشة');
    assert.ok(!/font-size\s*:\s*0\b/.test(html), file + ': نص بحجم صفر');
  });
});

ok('صفحات الفهرس بنيتها دلالية: عناوين مرتّبة وجداول حقيقية', () => {
  const overview = fs.readFileSync(path.join(ROOT, 'athar-overview.html'), 'utf8');
  assert.strictEqual((overview.match(/<h1/g) || []).length, 1, 'عنوان أول ليس واحداً');
  assert.ok((overview.match(/<table/g) || []).length >= 5,
    'البيانات الجدولية ليست في جداول');
  assert.ok(overview.indexOf('<caption') !== -1, 'جدول بلا وصف للقارئ الصوتي');
  assert.ok(overview.indexOf('scope="col"') !== -1, 'رؤوس الجدول بلا نطاق');
  assert.ok(overview.indexOf('<nav class="ac-toc"') !== -1, 'صفحة طويلة بلا فهرس داخلي');

  const home = fs.readFileSync(path.join(ROOT, 'athar-home.html'), 'utf8');
  assert.strictEqual((home.match(/<h1/g) || []).length, 1, 'الرئيسية بلا عنوان أول واحد');
  assert.strictEqual((home.match(/class="ac-cta"/g) || []).length, 1,
    'أكثر من إجراء أساسي واحد على الرئيسية');
});

/**
 * الحالة نصّ لا لون.
 * كل وسم حالة يحمل تسميته العربية داخل العنصر نفسه، فمن لا يميّز الألوان —
 * أو من يقرأ النص وحده — يعرف الحالة.
 */
ok('كل وسم حالة يحمل نصّه لا لونه وحده', () => {
  const overview = fs.readFileSync(path.join(ROOT, 'athar-overview.html'), 'utf8');
  const tags = overview.match(/<span class="ac-status"[^>]*>[\s\S]{0,200}?<\/span>/g) || [];
  assert.ok(tags.length >= Catalog.FEATURES.length, 'وسوم الحالة أقل من الخصائص');
  tags.forEach((tag) => {
    const text = tag.replace(/<[^>]*>/g, '').trim();
    assert.ok(text.length > 0, 'وسم حالة بلا نص');
  });
  assert.ok(overview.indexOf('الحالة: ') !== -1,
    'وسم الحالة بلا تسمية صريحة للقارئ الصوتي');
});

if (failures) {
  console.error('\n' + failures + ' فشل');
  process.exit(1);
}
console.log('\nكل اختبارات الفهرس نجحت');
