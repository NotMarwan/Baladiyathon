'use strict';
/**
 * بوابة إغلاق Gate 1.
 *
 * الشروط العشرة مجتمعة. الحزم الأخرى تفحص كلٌّ نطاقها؛ هذه تسأل السؤال الذي
 * يسأله المحكّم: **هل بقي على أي سطح ادعاء لا يُدافَع عنه؟**
 *
 * تكرارٌ مقصود مع بوابات أخرى: الشرط الذي يُفحص في مكان واحد يسقط بسقوط ذلك
 * المكان. وGate 1 هي التي يُبنى عليها كل ما بعدها.
 *
 * التشغيل: node presentation/tests/gate1-closure-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');

global.window = global;
const Engine = require(path.join(ROOT, 'masar-engine.js'));
const Canonical = require(path.join(ROOT, 'masar-canonical.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

function visible(text, file) {
  let out = text;
  if (/\.html$/.test(file)) {
    out = out.replace(/<!--[\s\S]*?-->/g, (b) => b.replace(/[^\n]/g, ' '));
  }
  if (/\.(js|html)$/.test(file)) {
    out = out.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '));
    out = out.replace(/^\s*\/\/[^\n]*/gm, (b) => b.replace(/[^\n]/g, ' '));
  }
  /* الأصول المضمَّنة ليست نصّاً يقرأه المحكّم. العرض المقدَّم فيه صور base64
     بحجم ميغابايتين، وفيها بالمصادفة تتابعات مثل «TBD» — فيصير الفحص يبلّغ عن
     بكسلات. أي تتابع base64 من أربعين محرفاً فأكثر يُجرَّد. */
  out = out.replace(/data:[\w/+.-]+;base64,[A-Za-z0-9+/=]{40,}/g,
    (b) => b.replace(/[^\n]/g, ' '));
  out = out.replace(/[A-Za-z0-9+/]{120,}={0,2}/g, (b) => b.replace(/[^\n]/g, ' '));
  return out;
}

/* كل ملف يراه المحكّم: صفحات النشر، وREADME، وبطاقة الفكرة، ومواد التسليم. */
function surfaces() {
  const out = [];
  fs.readdirSync(ROOT).forEach((name) => {
    if (/\.(html|md)$/.test(name)) out.push(path.join(ROOT, name));
  });
  const card = path.join(REPO, 'بطاقة-الفكرة.md');
  if (fs.existsSync(card)) out.push(card);
  const sub = path.join(REPO, 'output', 'submission');
  if (fs.existsSync(sub)) {
    fs.readdirSync(sub).forEach((name) => {
      if (/\.html$/.test(name)) out.push(path.join(sub, name));
    });
  }
  return out.map((file) => ({
    file, rel: path.relative(REPO, file),
    text: visible(fs.readFileSync(file, 'utf8'), file),
  }));
}

const SURFACES = surfaces();

function scan(pattern, label) {
  const hits = [];
  SURFACES.forEach((s) => {
    s.text.split('\n').forEach((line, index) => {
      if (pattern.test(line)) hits.push(`${s.rel}:${index + 1}`);
    });
  });
  assert.strictEqual(hits.length, 0,
    `${label}\n    ${hits.join('\n    ')}`);
}

// ---- 1 ----------------------------------------------------------------
test('١ · صفر رقم سنوي بلا مقام رسمي', () => {
  const claims = [];
  SURFACES.forEach((s) => {
    const body = s.text.replace(/<div class="denominator-note">[\s\S]*?<\/div>/g,
      (b) => b.replace(/[^\n]/g, ' '));
    body.split('\n').forEach((line, index) => {
      if (/سنوياً|سنوية|annual/i.test(line) && /\d{3,}/.test(line)) {
        claims.push(`${s.rel}:${index + 1}`);
      }
    });
  });
  assert.strictEqual(claims.length, 0,
    `رقم موصوف «سنوياً» بلا مقام رسمي:\n    ${claims.join('\n    ')}`);
});

// ---- 2 ----------------------------------------------------------------
test('٢ · صفر رقم SAR غير مدعوم', () => {
  const r = Engine.digOnce({ trenchKm: 1.2, permitsMerged: 3 });
  Object.keys(r).forEach((key) => {
    assert.ok(!/SAR|ريال/i.test(key), `حقل مالي في digOnce: ${key}`);
  });
  assert.strictEqual(Engine.DEFAULTS.trenchCostPerKmSAR, undefined,
    'كلفة الخندق الافتراضية عادت');
  scan(/وفر (?:الحفر|Dig-?Once)[^<]*(?:﷼|ريال)/,
    'مبلغ Dig-Once عاد إلى سطح عرض:');
});

// ---- 3 ----------------------------------------------------------------
test('٣ · صفر اسم قطعي لطول أو وفر مبني على افتراض', () => {
  Canonical.BANNED_CLAIMS.forEach((claim) => {
    scan(claim.pattern, `ادعاء قطعي — ${claim.why}\n    البديل: ${claim.instead}`);
  });
  const r = Engine.digOnce({ trenchKm: 1.2, permitsMerged: 3 });
  assert.strictEqual(r.avoidedTrenchKm, undefined, 'الاسم القاطع عاد للمحرك');
  assert.strictEqual(r.avoidedDigs, undefined, 'ادعاء الأثر عاد للمحرك');
  assert.ok(/تداخل تام/.test(r.overlapAssumption), 'الافتراض لا يسافر مع الرقم');
});

// ---- 4 ----------------------------------------------------------------
test('٤ · صفر رابط إلى نموذج متقاعد', () => {
  const nav = fs.readFileSync(path.join(ROOT, 'masar-nav.js'), 'utf8');
  const card = fs.readFileSync(path.join(REPO, 'بطاقة-الفكرة.md'), 'utf8');
  assert.ok(card.indexOf('masar-desk.html') !== -1,
    'بطاقة الفكرة لا تحيل إلى المكتب — النموذج الحاكم');
  assert.ok(nav.indexOf('masar-desk.html') !== -1, 'المكتب خارج الشريط');
  (card.match(/`presentation\/([\w.-]+\.html)`/g) || []).forEach((token) => {
    const name = token.replace(/`|presentation\//g, '');
    assert.ok(fs.existsSync(path.join(ROOT, name)),
      `بطاقة الفكرة تحيل إلى ملف غير موجود: ${name}`);
  });
});

// ---- 5 ----------------------------------------------------------------
test('٥ · صفر Placeholder', () => {
  scan(/\[الاسم\]|\[الدور\]|\[أدخل|TODO|TBD|FIXME/, 'عنصر نائب باقٍ:');
});

// ---- 6 ----------------------------------------------------------------
test('٦ · صفر ادعاء كاذب عن file://', () => {
  scan(/بما فيه الخريطة/, 'ادعاء عمل الخريطة بلا خادم:');
  const readme = fs.readFileSync(path.join(ROOT, 'README-masar.md'), 'utf8');
  assert.ok(/الخريطة تتطلب الخادم المحلي/.test(readme),
    'README لا يسمّي قيد الخريطة');
  const card = fs.readFileSync(path.join(REPO, 'بطاقة-الفكرة.md'), 'utf8');
  assert.ok(/الخريطة تتطلب الخادم المحلي/.test(card),
    'بطاقة الفكرة لا تسمّي قيد الخريطة');
});

// ---- 7 ----------------------------------------------------------------
test('٧ · صفر ادعاء توافق WZDx قبل اجتياز المخطط', () => {
  scan(/متوافق مع WZDx|WZDx.{0,20}معتمد|تصدير معياري معتمد/,
    'ادعاء توافق WZDx قبل بوابة المخطط:');
  /* WP-WZ1 — الفحص كان يقرأ الملف **بتعليقاته**.
     عند تضييق العبارة بقيت الصياغة القديمة داخل تعليق يشرح التغيير، فمرّت
     البوابة على نصّ لا يراه أحد. تعليقٌ يُرضي فحصاً هو أسوأ أشكال المرور:
     يبدو الادعاء معلَناً وهو مشروحٌ لمن يقرأ الشيفرة وحده.
     التجريد هنا هو نفسه المستعمل في `visible()` أعلى الملف. */
  const plan = visible(
    fs.readFileSync(path.join(ROOT, 'masar-desk-plan.js'), 'utf8'),
    'masar-desk-plan.js'
  );
  /* البوابة تلاحق الدليل لا نصّاً بعينه.
     كانت تثبّت «لم يُشغَّل عليه المحقق الرسمي بعد» — وصارت تلك العبارة تنفي
     إنجازاً محقَّقاً بعد تثبيت المخطط الرسمي. فحُدِّثت لتثبّت ما يجب أن يبقى:
     (١) ذكر الالتزام المثبَّت — فلا «رسمي» بلا نسخة؛
     (٢) إعلان أن المتصفح لا يشغّل المحقق — فلا يُقرأ الزرّ ضماناً رسمياً؛
     (٣) بقاء حظر «متوافق» المطلق ما دامت هناك حالات ممنوعة. */
  assert.ok(/42b98fc/.test(plan),
    'واجهة التصدير لا تذكر التزام المخطط الرسمي المثبَّت');
  assert.ok(/لا يعمل داخل المتصفح/.test(plan),
    'واجهة التصدير لا تعلن أن المحقق الرسمي لا يعمل في المتصفح');
  assert.ok(!/لم يُشغَّل عليه المحقق الرسمي بعد/.test(plan),
    'واجهة التصدير ما زالت تنفي تشغيل المحقق الرسمي — وقد شُغِّل');
  assert.ok(!/متوافق مع WZDx/.test(plan), 'ادعاء توافق في واجهة التصدير');
});

// ---- 8 ----------------------------------------------------------------
test('٨ · الأرقام المشتركة متطابقة قيمةً ووحدةً ودلالة', () => {
  const M = Canonical.metrics();
  assert.strictEqual(M.additionalPermitsInGroups.value,
    M.groupedPermitCount.value - M.coordinationGroupCount.value);
  Object.keys(M).forEach((key) => {
    assert.ok(M[key].unit && M[key].meaning, `${key}: بلا وحدة أو دلالة`);
  });
  /* التفصيل في canonical-metrics-test.js؛ هنا يُتحقَّق أن المصدر الحاكم قائم
     ومتّسق داخلياً، فلا تُغلق البوابة على مصدر منهار. */
});

// ---- 9 ----------------------------------------------------------------
test('٩ · كل رقم رئيسي يحمل sourceType والاشتقاق والحدود', () => {
  const impact = fs.readFileSync(path.join(ROOT, 'masar-city-impact.html'), 'utf8');
  assert.ok(impact.indexOf('masar-provenance.js') !== -1,
    'صفحة الأثر لا تحمّل عقد المصدر');
  const stamps = impact.match(/stamp\('card-/g) || [];
  assert.ok(stamps.length >= 4, `${stamps.length} بطاقة موسومة فقط`);
  assert.ok(/counter-provenance/.test(impact), 'الرقم الرئيسي بلا سطر مصدر');
  const P = require(path.join(ROOT, 'masar-provenance.js'));
  assert.throws(() => P.value({ value: 1, unit: 'كم' }), /نوع مصدر/,
    'العقد يقبل قيمة بلا نوع مصدر');
});

// ---- 10 ---------------------------------------------------------------
test('١٠ · سجل خط الأساس يوثّق الوقت وحالة Git لكل تشغيل', () => {
  const log = path.join(REPO, 'docs', 'plans', 'master-improvement',
    'TEST-BASELINE-LOG.md');
  assert.ok(fs.existsSync(log), 'سجل خط الأساس غير موجود');
  const text = fs.readFileSync(log, 'utf8');
  ['HEAD', 'بصمة', 'قبل', 'بعد', 'المعلَّقات'].forEach((field) => {
    assert.ok(text.indexOf(field) !== -1, `السجل بلا حقل ${field}`);
  });
  assert.ok(/النسخة المشتركة/.test(text),
    'السجل لا يوثّق شرط النسخة المشتركة بعد الدمج');
  /* الرقم نفسه (50/50) لا يُثبَّت هنا: عدد الحزم ينمو، وتثبيته يجعل البوابة
     تفشل كلما أُضيف اختبار. المفروض وجود السجل بحقوله لا قيمة بعينها. */
});

console.log(`ALL TESTS PASSED (${count})`);
