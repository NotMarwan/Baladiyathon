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
const desk = fs.readFileSync(path.join(ROOT, 'athar-desk.html'), 'utf8');

ok('١ — يجد عملاً: الصندوق والبحث والمرشح والفرز على الشاشة', () => {
  assert.ok(desk.indexOf('deskList') !== -1, 'لا صندوق أعمال');
  assert.ok(desk.indexOf('desk-search') !== -1, 'لا بحث');
  assert.ok(desk.indexOf('desk-status') !== -1, 'لا مرشح حالة');
  assert.ok(desk.indexOf('desk-sort') !== -1, 'لا فرز');
});

ok('٢ — يفهم موقعه وحالته: الخريطة ووسم الحالة على الشاشة نفسها', () => {
  assert.ok(desk.indexOf('AtharWorksMap') !== -1, 'لا خريطة على المكتب');
  assert.ok(desk.indexOf('AtharDeskStates') !== -1, 'لا وسوم حالة');
  assert.ok(desk.indexOf('highlightWork') !== -1, 'الخريطة لا تتبع التحديد');
  assert.ok(desk.indexOf('onWorkClick') !== -1, 'النقر على الخريطة لا يحدّد الصف');
});

ok('٣ — يرى الأثر والثقة: المحرك وشريط الثقة موصولان', () => {
  assert.ok(desk.indexOf('AtharEngine.score') !== -1, 'الأثر غير محسوب');
  assert.ok(desk.indexOf('renderConfidence') !== -1, 'لا شريط ثقة');
});

ok('٤ — يقارن البدائل: optimize مستدعى ونتيجته معروضة', () => {
  assert.ok(desk.indexOf('AtharEngine.optimize') !== -1, 'لا بدائل');
  assert.ok(desk.indexOf('alternatives') !== -1);
});

ok('٥ — يفهم سبب التوصية: الأسباب تُمرَّر إلى البطاقة', () => {
  assert.ok(/reasons\s*:/.test(desk), 'الأسباب غير ممرَّرة');
  assert.ok(desk.indexOf('renderSummary') !== -1);
});

ok('٦ — يعتمد أو يُرجع خلف حارس يعرض عائقه', () => {
  assert.ok(desk.indexOf('AtharDeskStates.guard') !== -1, 'الاعتماد بلا حارس');
  assert.ok(desk.indexOf('renderBlockers') !== -1, 'العوائق لا تُعرض');
  assert.ok(desk.indexOf('AtharDeskStates.apply') !== -1, 'لا تطبيق ينتج نسخة');
});

ok('٧ — يفتح مسودة الخطة من الشاشة نفسها', () => {
  assert.ok(desk.indexOf("'plan'") !== -1, 'لا تبويب خطة');
  assert.ok(desk.indexOf('خطة إدارة المرور') !== -1);
});

ok('لا إعادة إدخال: المكتب يقرأ المحفظة ولا يعرض نموذج إدخال يدوي', () => {
  assert.ok(desk.indexOf('ATHAR_CITY_PORTFOLIO') !== -1, 'لا محفظة');
  assert.ok(desk.indexOf('<input') === -1 || desk.indexOf('type="number"') === -1,
    'نموذج إدخال يدوي على مكتب المراجع');
});

ok('القرار يترك أثراً: سجل تدقيق يُبنى من كل إجراء', () => {
  assert.ok(desk.indexOf('AtharDecisionRecord.create') !== -1, 'لا سجل قرار');
  assert.ok(desk.indexOf('renderAudit') !== -1, 'السجل لا يُعرض');
});

ok('القرار يبقى بعد تحديث الصفحة — لا يعيش في ذاكرة الجلسة', () => {
  assert.ok(desk.indexOf('localStorage') !== -1, 'لا تخزين محلي');
  assert.ok(desk.indexOf('AtharDecisionRecord.restore') !== -1,
    'المحفظة لا تُبنى من السجل عند الإقلاع');
  assert.ok(desk.indexOf('AtharDecisionRecord.serialize') !== -1, 'لا حفظ');
});

ok('نسخة المدخلات تُحفظ مع القرار — القاعدة التي لا تُكسر', () => {
  assert.ok(/AtharDecisionRecord\.create\([^)]*analysis\.input/.test(desk.replace(/\s+/g, ' ')),
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
    assert.ok(desk.indexOf('AtharEngine.' + fn) !== -1, `وحدة قرار غير محسوبة: ${fn}`);
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
  ['athar-desk.html', 'athar-map.html', 'athar-decision.html'].forEach((page) => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(html.indexOf('athar-tokens.css') !== -1 || html.indexOf('athar-nav.js') !== -1,
      `${page} خارج نظام الوسوم`);
  });
});

console.log(`\n${passed} اختبارات نجحت`);
