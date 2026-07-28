'use strict';
/**
 * البوابة النهائية.
 * تُترجم «تعريف الإنجاز» من بحث المقارنات إلى فحص آلي: يستطيع المراجع من شاشة
 * واحدة وبلا إعادة إدخال أن يجد عملاً، ويفهم موقعه وحالته، ويرى الأثر والثقة،
 * ويقارن البدائل، ويفهم سبب التوصية، ويعتمد أو يُرجع، ويفتح مسودة الخطة.
 * إن مرّت هذه الحزمة فالمشروع يستوفي المعيار الذي وضعه لنفسه.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
// سطح المكتب صار ملفين: الهيكل في HTML والسلوك في المُقلع. البوابة تقرأ
// السطح كاملاً كما يراه المتصفح — إخراج السكربت لا يُعفيه من أيّ شرط هنا.
const deskHtml = fs.readFileSync(path.join(ROOT, 'masar-desk.html'), 'utf8');
const deskBoot = fs.readFileSync(path.join(ROOT, 'masar-desk-boot.js'), 'utf8');
// الحساب خرج من المُقلع إلى وحدة نقية تُختبر في Node؛ والبوابة تسأل عن السطح
// كما يراه المتصفح، فتقرأ الوحدة معه — لا تُعفى خطوة لأنها انتقلت ملفاً.
const deskAnalysis = fs.readFileSync(path.join(ROOT, 'masar-desk-analysis.js'), 'utf8');
const desk = deskHtml + '\n' + deskBoot + '\n' + deskAnalysis;

ok('١ — يجد عملاً: الصندوق والبحث والمرشح والفرز على الشاشة', () => {
  assert.ok(desk.indexOf('deskList') !== -1, 'لا صندوق أعمال');
  assert.ok(desk.indexOf('desk-search') !== -1, 'لا بحث');
  assert.ok(desk.indexOf('desk-status') !== -1, 'لا مرشح حالة');
  assert.ok(desk.indexOf('desk-sort') !== -1, 'لا فرز');
});

ok('٢ — يفهم موقعه وحالته: الخريطة ووسم الحالة على الشاشة نفسها', () => {
  assert.ok(desk.indexOf('MasarWorksMap') !== -1, 'لا خريطة على المكتب');
  assert.ok(desk.indexOf('MasarDeskStates') !== -1, 'لا وسوم حالة');
  assert.ok(desk.indexOf('highlightWork') !== -1, 'الخريطة لا تتبع التحديد');
  assert.ok(desk.indexOf('onWorkClick') !== -1, 'النقر على الخريطة لا يحدّد الصف');
});

ok('٣ — يرى الأثر والثقة: المحرك وشريط الثقة موصولان', () => {
  assert.ok(deskBoot.indexOf('MasarDeskAnalysis.evaluate') !== -1, 'المكتب لا يستدعي التحليل');
  assert.ok(desk.indexOf('Engine.score') !== -1, 'الأثر غير محسوب');
  assert.ok(desk.indexOf('renderConfidence') !== -1, 'لا شريط ثقة');
});

ok('٤ — يقارن البدائل: optimize مستدعى ونتيجته معروضة', () => {
  assert.ok(desk.indexOf('Engine.optimize') !== -1, 'لا بدائل');
  assert.ok(desk.indexOf('alternatives') !== -1);
});

ok('٥ — يفهم سبب التوصية: الأسباب تُمرَّر إلى البطاقة', () => {
  assert.ok(/reasons\s*:/.test(desk), 'الأسباب غير ممرَّرة');
  assert.ok(desk.indexOf('renderSummary') !== -1);
});

ok('٦ — يعتمد أو يُرجع خلف حارس يعرض عائقه', () => {
  assert.ok(desk.indexOf('MasarDeskStates.guard') !== -1, 'الاعتماد بلا حارس');
  assert.ok(desk.indexOf('renderBlockers') !== -1, 'العوائق لا تُعرض');
  assert.ok(desk.indexOf('MasarDeskStates.apply') !== -1, 'لا تطبيق ينتج نسخة');
});

ok('٧ — يُخرج خطة إدارة المرور من الشاشة نفسها لا بإحالة', () => {
  assert.ok(desk.indexOf("'plan'") !== -1, 'لا تبويب خطة');
  assert.ok(desk.indexOf('MasarDeskPlan.renderTab') !== -1, 'التبويب لا يبني خطة');
  assert.ok(desk.indexOf('MasarDeskPlan.toDocument') !== -1, 'لا وثيقة تُنزَّل');
  assert.ok(desk.indexOf('MasarWzdxExport.buildFeed') !== -1, 'لا تصدير معياري');
  // الشرط على **تبويب الخطة** لا على السطح كله: اسم النموذج التفاعلي يظهر
  // مشروعاً كوجهة تنقّل في لوحة الأوامر، ومنعه هناك يحرس صياغةً لا معنى.
  const planModule = fs.readFileSync(path.join(ROOT, 'masar-desk-plan.js'), 'utf8');
  assert.ok(planModule.indexOf('النموذج التفاعلي') === -1,
    'تبويب الخطة ما زال يحيل إلى صفحة أخرى بدل أن يُخرج');
  assert.ok(planModule.indexOf('نزّل خطة إدارة المرور') !== -1, 'لا زرّ تنزيل للخطة');
});

ok('زرّ بلا إجراء لا يمرّ إلى مسار الإجراءات', () => {
  // أزرار التصدير تحمل صنف المظهر نفسه؛ الربط بالصنف وحده يستدعيها بـ null.
  assert.ok(desk.indexOf(".desk-action[data-action]") !== -1,
    'الربط بالصنف وحده — سيُستدعى الإجراء بلا اسم');
});

ok('لا إعادة إدخال: المكتب يقرأ المحفظة ولا يعرض نموذج إدخال يدوي', () => {
  assert.ok(desk.indexOf('MASAR_CITY_PORTFOLIO') !== -1, 'لا محفظة');
  assert.ok(desk.indexOf('<input') === -1 || desk.indexOf('type="number"') === -1,
    'نموذج إدخال يدوي على مكتب المراجع');
});

ok('القرار يترك أثراً: سجل تدقيق يُبنى من كل إجراء', () => {
  assert.ok(desk.indexOf('MasarDecisionRecord.create') !== -1, 'لا سجل قرار');
  assert.ok(desk.indexOf('renderAudit') !== -1, 'السجل لا يُعرض');
});

ok('القرار يبقى بعد تحديث الصفحة — لا يعيش في ذاكرة الجلسة', () => {
  assert.ok(desk.indexOf('localStorage') !== -1, 'لا تخزين محلي');
  assert.ok(desk.indexOf('MasarDecisionRecord.restore') !== -1,
    'المحفظة لا تُبنى من السجل عند الإقلاع');
  assert.ok(desk.indexOf('MasarDecisionRecord.serialize') !== -1, 'لا حفظ');
});

ok('نسخة المدخلات تُحفظ مع القرار — القاعدة التي لا تُكسر', () => {
  assert.ok(/MasarDecisionRecord\.create\([^)]*analysis\.input/.test(desk.replace(/\s+/g, ' ')),
    'القرار يُحفظ بلا نسخة مدخلاته');
});

ok('دورة القرار تعبر واجهة الخادم كذلك لا المتصفح وحده', () => {
  assert.ok(/\/api\/works\/'\s*\+/.test(desk) || desk.indexOf('/decisions') !== -1,
    'لا نقطة خدمة للقرار');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(server.indexOf('/decisions') !== -1, 'الخادم لا يعرف دورة القرار');
  assert.ok(server.indexOf('inputs snapshot is required') !== -1,
    'الخادم لا يفرض قاعدة نسخة المدخلات');
});

ok('الأثر يُترجم إلى وحدات القرار لا وحدات المرور وحدها', () => {
  ['personHours', 'timeValueSAR', 'co2Range'].forEach((fn) => {
    assert.ok(desk.indexOf('Engine.' + fn) !== -1, `وحدة قرار غير محسوبة: ${fn}`);
  });
});

ok('المكتب بلا أي مورد خارجي', () => {
  const tags = desk.match(/<(script|link|img)[^>]*>/g) || [];
  tags.forEach((tag) => assert.ok(!/https?:\/\//.test(tag), `مورد خارجي: ${tag}`));
});

ok('كل ملف يشير إليه المكتب موجود فعلاً', () => {
  const refs = desk.match(/(?:src|href)="([^"]+)"/g) || [];
  refs.forEach((ref) => {
    const file = ref.match(/"([^"]+)"/)[1];
    if (file.indexOf('://') !== -1 || file.startsWith('#')) return;
    assert.ok(fs.existsSync(path.join(ROOT, file)), `ملف مفقود: ${file}`);
  });
});

ok('شارة الصدق على المكتب — البيانات توضيحية ومعلنة', () => {
  assert.ok(desk.indexOf('بيانات توضيحية للعرض') !== -1);
});

ok('كل صفحات العائلة داخل نظام الوسوم الواحد', () => {
  ['masar-desk.html', 'masar-map.html', 'masar-decision.html'].forEach((page) => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(html.indexOf('masar-tokens.css') !== -1 || html.indexOf('masar-nav.js') !== -1,
      `${page} خارج نظام الوسوم`);
  });
});

/* ---- عقد أول رسم: ما يراه المحكّم في الثانية الأولى ---- */

ok('لا سكربت يحجب أول رسم على المكتب', () => {
  const tags = deskHtml.match(/<script\b[^>]*>/g) || [];
  tags.forEach((tag) => {
    assert.ok(/\bdefer\b|\basync\b|\btype="module"/.test(tag),
      `سكربت حاجب يوقف المحلّل قبل أول رسم: ${tag}`);
  });
  assert.ok(tags.length > 0, 'لا سكربتات على المكتب أصلاً');
});

ok('لا سكربت داخل صفحة المكتب — السلوك كله في ملف مؤجَّل', () => {
  // سكربت داخل الصفحة لا يقبل defer، فينفَّذ قبل تبعياته ويكسر الترتيب.
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/.test(deskHtml),
    'ما زال في الصفحة سكربت داخلي — سيسبق كل ما يعتمد عليه');
});

ok('وسوم الهوية تصل قبل أول رسم لا بعد وصول سكربت', () => {
  const head = deskHtml.slice(0, deskHtml.indexOf('</head>'));
  assert.ok(head.indexOf('masar-tokens.css') !== -1,
    'الوسوم محقونة بجافاسكربت — الهيكل سيُرسم بمتغيّرات غير معرَّفة');
});

ok('هيكل الانتظار مكتوب في الصفحة لا مُصيَّر بجافاسكربت', () => {
  assert.ok(deskHtml.indexOf('desk-skeleton') !== -1, 'لا هيكل انتظار في الصندوق');
  assert.ok(deskHtml.indexOf('desk-boot') !== -1, 'لا حالة تحميل على الخريطة');
  const css = fs.readFileSync(path.join(ROOT, 'masar-desk.css'), 'utf8');
  assert.ok(/\.desk-skeleton-row\s*\{[^}]*--masar-row-h/.test(css),
    'الهيكل لا يطابق ارتفاع الصف الحقيقي — ستقفز اللوحة حين يحل محله');
});

ok('غطاء التحميل ينزاح دائماً — بحدث أو بسقف زمني', () => {
  assert.ok(/bootTimer\s*=\s*window\.setTimeout\(\s*bootDone/.test(deskBoot),
    'لا سقف زمني: خريطة تفشل بصمت تترك الغطاء إلى الأبد');
  // المسارات الثلاثة كلها ترفع الغطاء: النجاح بـ bootDone مباشرة، والفشل
  // وغياب المحرك عبر mapUnavailable — وأول ما تفعله رفعُ الغطاء.
  assert.ok(deskBoot.indexOf("GL.map.on('error'") !== -1
    && /error[\s\S]{0,200}mapUnavailable\(/.test(deskBoot),
    'خطأ الخريطة لا يرفع الغطاء');
  assert.ok(/\}\s*else\s*\{\s*mapUnavailable\(/.test(deskBoot),
    'صفحة بلا خريطة تبقى تحت الغطاء');
  assert.ok(/function mapUnavailable\([\s\S]{0,120}bootDone\(\);/.test(deskBoot),
    'mapUnavailable لا يرفع الغطاء — الفشل يترك الشاشة تحته');
});

/**
 * الخريطة تسقط والمكتب لا.
 * ---------------------------------------------------------------------------
 * غياب WebGL يترك مستطيلاً فارغاً وسط الشاشة. الفراغ يُقرأ عطلاً شاملاً،
 * فيتوقف المراجع عن العمل وهو قادر عليه: الفرز والقرار والتصدير لا تحتاج
 * الخريطة أصلاً. فالسبب يُقال، والمتاح يُقال معه.
 */
ok('تعذّر الخريطة يُعلَن ولا يُترك فراغاً', () => {
  assert.ok(deskBoot.indexOf('desk-map-down') !== -1,
    'لا لوحة تُعلن تعذّر الخريطة');
  const css = fs.readFileSync(path.join(ROOT, 'masar-desk.css'), 'utf8');
  assert.ok(css.indexOf('.desk-map-down') !== -1, 'لا تنسيق للوحة التعذّر');
});

/**
 * أول تحديد لا يعلّق على الخريطة.
 * ---------------------------------------------------------------------------
 * كان داخل onReady: خريطة لا تجهز تترك ملف القرار فارغاً بلا سبب معلن — وهو
 * أول ما يراه من يفتح الأداة. المكتب لا يحتاج بلاطة ليعمل.
 */
ok('المكتب يفتح على عمل لا على فراغ — ولو لم ترسم الخريطة', () => {
  assert.ok(/function selectInitial\(\)/.test(deskBoot), 'لا تحديد أوّلي مستقل');
  const inReady = deskBoot.slice(deskBoot.indexOf('GL.api.onReady'),
    deskBoot.indexOf('GL.map.on(\'error\''));
  assert.ok(inReady.indexOf('store.select(') === -1,
    'التحديد الأول ما زال داخل جاهزية الخريطة');
});

ok('المكتب يفتح على المدينة لا على مقطع — التحديد الآلي يُبرز ولا يطير', () => {
  assert.ok(deskBoot.indexOf('GL.api.frameWorks()') !== -1,
    'لا تأطير للمحفظة: المنظر الافتتاحي عشوائي');
  assert.ok(/highlightWork\(selectedId,\s*\{\s*fly:\s*userDriven\s*\}\)/.test(deskBoot),
    'الطيران لا يميّز التحديد الآلي من نقر المراجع');
  assert.ok(/userDriven\s*=\s*true;\s*store\.select/.test(deskBoot.replace(/\s+/g, ' ')),
    'النقر لا يعلن نيّته قبل التحديد');
});

ok('الفرز والترشيح لا يحرّكان الخريطة — التحديد لم يتغيّر', () => {
  assert.ok(deskBoot.indexOf('selectedId !== lastHighlighted') !== -1,
    'كل بثّ من المخزن يعيد الطيران ولو لم يتغيّر التحديد');
});

ok('الصندوق يبقى صالحاً للعمل تحت غطاء الخريطة', () => {
  const css = fs.readFileSync(path.join(ROOT, 'masar-desk.css'), 'utf8');
  const boot = css.slice(css.indexOf('.desk-boot {'));
  assert.ok(/position:\s*absolute/.test(boot.slice(0, 220)),
    'الغطاء ليس مطلقاً داخل لوحة الخريطة — قد يحجب الفرز');
  assert.ok(deskHtml.indexOf('<div class="desk-boot"') > deskHtml.indexOf('desk-map-wrap'),
    'الغطاء خارج لوحة الخريطة');
});

/* ==========================================================================
 * الرحلة مُشغَّلة لا مقروءة.
 * ==========================================================================
 * كل ما سبق في هذا الملف بحثٌ عن نصّ في مصدر: `desk.indexOf('renderSummary')`
 * يمرّ إذا ورد الاسم في تعليق. وهو حارسٌ نافع على **البنية** — يمنع أن يُحذف
 * وصلٌ أو يُقطع سكربت — لكنه لا يشغّل سطراً واحداً من الحساب أو التصيير.
 *
 * وقد سقطت الحزمة في ذلك مرّة: `evaluate` كان يرمي `RangeError` على تصريح بلا
 * تواريخ ولا مدة، فيبقى ملف القرار على التصريح **السابق** بينما المخزن انتقل
 * إلى الجديد. ثمانيةٌ وعشرون فحصاً خضراء والعيب في قلب الرحلة.
 *
 * فما يلي يشغّل المسار كما يشغّله المتصفح: المحفظة المنشورة نفسها، ثم
 * `MasarDeskAnalysis.evaluate`، ثم `MasarDeskFile.renderSummary` — ويفتّش في
 * الناتج النهائي. البوابة لا تكتمل ببحثٍ عن أسماء.
 */

const Engine = require(path.join(ROOT, 'masar-engine.js'));
const Analysis = require(path.join(ROOT, 'masar-desk-analysis.js'));
const Inbox = require(path.join(ROOT, 'masar-desk-inbox.js'));
const DeskFile = require(path.join(ROOT, 'masar-desk-file.js'));
const States = require(path.join(ROOT, 'masar-desk-states.js'));

// المحفظة تُقرأ كما يقرؤها المتصفح: ملف سكربت يعلّق على `window`.
global.window = global;
require(path.join(ROOT, 'data', 'city-portfolio.geojson.js'));
const portfolio = global.MASAR_CITY_PORTFOLIO;

/** كل ما يُسرّب داخلاً إلى شاشة المراجع. */
const LEAKS = ['undefined', 'NaN', '[object Object]', 'Infinity'];

function leaksIn(html) {
  return LEAKS.filter((needle) => html.indexOf(needle) !== -1);
}

ok('المحفظة المنشورة تُصيَّر كاملةً بلا رمي وبلا تسريب', () => {
  assert.ok(portfolio && portfolio.features.length >= 100,
    'المحفظة المنشورة غائبة أو أصغر من أن تختبر شيئاً');

  const silent = [];
  portfolio.features.forEach((feature) => {
    const p = feature.properties;
    let analysis;
    // الرمي هنا هو العيب نفسه: `renderFile` يسقط قبل أن يكتب سطراً.
    try {
      analysis = Analysis.evaluate(p, Engine);
    } catch (err) {
      assert.fail(`التحليل يرمي على ${p.permitRef}: ${err.message}`);
    }

    const html = DeskFile.renderSummary(feature, analysis)
      + DeskFile.renderHeader(feature)
      + DeskFile.renderActions(feature)
      + Inbox.renderRow(feature, false);

    const leaked = leaksIn(html);
    assert.deepStrictEqual(leaked, [], `تسريب على ${p.permitRef}: ${leaked.join(', ')}`);

    // بطاقةٌ إمّا توصي أو تقول لماذا لا. الصمت في موضع التوصية يُقرأ موافقة.
    if (html.indexOf('لا توصية') === -1 && html.indexOf('desk-recommend') === -1) {
      silent.push(p.permitRef);
    }
  });
  assert.deepStrictEqual(silent, [], `بطاقات صامتة: ${silent.slice(0, 5).join(', ')}`);
});

ok('الرقم المعروض محسوبٌ من المحرك لا منقولٌ من ملف البيانات', () => {
  // الرقم المنشور مع التصريح والرقم المحسوب لحظة العرض كمّية واحدة. افتراقهما
  // هو الخلل الذي أخرج الحساب إلى وحدة نقية أصلاً — والحارس يبقى مشغَّلاً.
  let worst = 0;
  let worstRef = '';
  portfolio.features.forEach((feature) => {
    const p = feature.properties;
    const live = Analysis.evaluate(p, Engine).scored.delayVehHours;
    assert.ok(Number.isFinite(live), `أثر غير محسوب على ${p.permitRef}`);
    const drift = Math.abs(live - Number(p.impactVehHours)) / Number(p.impactVehHours) * 100;
    if (drift > worst) { worst = drift; worstRef = p.permitRef; }
  });
  assert.ok(worst < 1, `الرقم المعروض يفارق المنشور بـ${worst.toFixed(2)}٪ على ${worstRef}`);
  assert.ok(worst > 0, 'انطباق تامّ — الرقم منقول لا محسوب');
});

/**
 * المدخل الناقص: امتناعٌ يصل الشاشة.
 * ---------------------------------------------------------------------------
 * ليس فحص وحدة: يمرّ بالمسار الذي يمرّ به المتصفح كاملاً — من خصائص التصريح
 * إلى نصّ البطاقة — ويفتّش عن اسم الحقل الناقص في المخرَج النهائي.
 */
ok('تصريح ناقص المدخلات يمتنع باسم الحقل ولا يُسقط الرحلة', () => {
  const source = portfolio.features[0];
  const stripped = {
    type: 'Feature',
    geometry: source.geometry,
    properties: Object.assign({}, source.properties),
  };
  ['start', 'end', 'durationHours', 'workDays'].forEach((field) => {
    delete stripped.properties[field];
  });

  let analysis;
  try {
    analysis = Analysis.evaluate(stripped.properties, Engine);
  } catch (err) {
    assert.fail(`الرحلة تنهار على مدخل ناقص بدل أن تمتنع: ${err.message}`);
  }

  const card = DeskFile.renderSummary(stripped, analysis);
  assert.ok(card.indexOf('لا توصية') !== -1, 'يوصي على مدخلات ناقصة');
  assert.ok(card.indexOf('مدة الإغلاق') !== -1, 'الامتناع لا يسمّي الحقل الناقص');
  assert.deepStrictEqual(leaksIn(card), [], 'تسريب في بطاقة الامتناع');

  // ولا يُحفظ رقمٌ ملفَّق في نسخة المدخلات التي تدخل سجل القرار.
  assert.strictEqual(analysis.scored.delayVehHours, null, 'أثرٌ مخترَع لمدة مجهولة');
  const snapshot = JSON.parse(JSON.stringify(analysis.input));
  assert.ok(!Object.keys(snapshot).some((key) => Number.isNaN(analysis.input[key])),
    'نسخة المدخلات تحمل NaN — تُحفظ في السجل قيمةً فارغة بلا إعلان');

  // والصندوق يعلن الثغرة قبل أن يفتح المراجع الملف.
  assert.ok(Inbox.renderRow(stripped, false).indexOf('مدخلات ناقصة') !== -1,
    'الطابور لا يميّز تصريحاً لا يمكن أن يُقرَّر عليه');
});

ok('حارس الاعتماد يشتغل فعلاً على المحفظة لا في المصدر وحده', () => {
  // `desk.indexOf('MasarDeskStates.guard')` يمرّ بورود الاسم. هذا يشغّله.
  const review = portfolio.features
    .filter((feature) => feature.properties.status === 'StrategyReview')[0];
  assert.ok(review, 'لا تصريح في مرحلة القرار داخل المحفظة');

  const allowed = States.guard(review.properties, 'approve');
  assert.ok(typeof allowed.allowed === 'boolean', 'الحارس لا يعطي حكماً');

  const naked = Object.assign({}, review.properties, { inputsVersion: undefined });
  const blocked = States.guard(naked, 'approve');
  assert.strictEqual(blocked.allowed, false, 'اعتماد بلا نسخة مدخلات مثبّتة');
  const shown = DeskFile.renderBlockers(blocked.blockers);
  assert.ok(shown.indexOf('role="alert"') !== -1, 'العائق لا يُعلَن للقارئ الصوتي');
  blocked.blockers.forEach((blocker) => {
    assert.ok(shown.indexOf(blocker.reason) === -1,
      `رمز داخلي تسرّب إلى الشاشة: ${blocker.reason}`);
  });
});

console.log(`\n${passed} اختبارات نجحت`);
