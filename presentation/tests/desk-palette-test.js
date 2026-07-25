'use strict';
const assert = require('assert');
const path = require('path');

const Palette = require(path.join(__dirname, '..', 'athar-desk-palette.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

/* ---- التطبيع: الفرق بين بحث يعمل وبحث يبدو معطلاً ---- */

ok('أشكال الألف الثلاثة تُطبَّع إلى واحد', () => {
  // «الإمام» و«الامام» و«الأمام» ثلاث كتابات لكلمة واحدة.
  const forms = ['الإمام', 'الامام', 'الأمام', 'الآمام'];
  const folded = forms.map(Palette.fold);
  folded.forEach((f) => assert.strictEqual(f, folded[0], `اختلف: ${f}`));
});

ok('التاء المربوطة والهاء تتطابقان', () => {
  assert.strictEqual(Palette.fold('مكتبة'), Palette.fold('مكتبه'));
});

ok('الألف المقصورة والياء تتطابقان', () => {
  assert.strictEqual(Palette.fold('مصطفى'), Palette.fold('مصطفي'));
});

ok('التشكيل والتطويل يسقطان', () => {
  assert.strictEqual(Palette.fold('الْمَلِك'), Palette.fold('الملك'));
  assert.strictEqual(Palette.fold('الملـــك'), Palette.fold('الملك'));
});

ok('المسافات الزائدة تُوحَّد ولا تمنع المطابقة', () => {
  assert.strictEqual(Palette.fold('  طريق   الملك  '), 'طريق الملك');
});

ok('التطبيع لا يُعرض — الأصل يبقى هو المعروض', () => {
  const html = Palette.renderResults([{ kind: 'work', label: 'طريق الإمام' }], 0);
  assert.ok(html.indexOf('طريق الإمام') !== -1, 'عُرض النص المطبَّع بدل الأصل');
});

/* ---- الترتيب: ما يريده الكاتب أولاً ---- */

const STREETS = [
  { kind: 'work', label: 'شارع عبدالملك بن مروان' },
  { kind: 'work', label: 'طريق الملك فهد' },
  { kind: 'work', label: 'الملك عبدالله' },
];

ok('البداية تسبق بداية الكلمة، وبداية الكلمة تسبق الاحتواء', () => {
  const found = Palette.search(STREETS, 'الملك');
  assert.strictEqual(found[0].label, 'الملك عبدالله', 'ما يبدأ بالنص لم يتصدّر');
  assert.strictEqual(found[1].label, 'طريق الملك فهد', 'بداية الكلمة لم تسبق الاحتواء');
  assert.strictEqual(found[2].label, 'شارع عبدالملك بن مروان');
});

ok('البحث بشكل مختلف يجد النتيجة نفسها', () => {
  // مراجعٌ يكتب بلا همزة يجب أن يجد ما كُتب بها.
  const entries = [{ kind: 'work', label: 'طريق الإمام عبدالله بن سعود' }];
  assert.strictEqual(Palette.search(entries, 'الامام').length, 1);
  assert.strictEqual(Palette.search(entries, 'الإمام').length, 1);
});

ok('المرجع اللاتيني يُبحث كما يُكتب', () => {
  const entries = [{ kind: 'work', label: 'طريق أ', hint: 'BLD-2026-0084' }];
  assert.strictEqual(Palette.search(entries, 'BLD-2026-0084').length, 1);
  assert.strictEqual(Palette.search(entries, 'bld-2026').length, 1, 'الحالة تمنع المطابقة');
});

ok('التلميح يطابق لكن بوزن أقل من العنوان', () => {
  const entries = [
    { kind: 'work', label: 'مطابقة في التلميح', hint: 'الرياض' },
    { kind: 'work', label: 'الرياض', hint: 'شيء آخر' },
  ];
  assert.strictEqual(Palette.search(entries, 'الرياض')[0].label, 'الرياض');
});

ok('نص فارغ يعيد كل شيء بترتيبه الأصلي', () => {
  // الإجراءات والتبويبات تُدرَج أولاً في الفهرس، فتظهر قبل 150 تصريحاً.
  const mixed = [{ kind: 'action', label: 'اعتماد' }, { kind: 'work', label: 'طريق' }];
  const found = Palette.search(mixed, '');
  assert.strictEqual(found[0].kind, 'action');
});

ok('لا مطابقة تعيد مصفوفة فارغة لا استثناء', () => {
  assert.deepStrictEqual(Palette.search(STREETS, 'زززز'), []);
  assert.deepStrictEqual(Palette.search(null, 'شيء'), []);
});

ok('النتائج مسقوفة — قائمة لا تُقرأ ليست نتائج', () => {
  const many = Array.from({ length: 60 }, (unused, i) => ({ kind: 'work', label: 'طريق ' + i }));
  assert.strictEqual(Palette.search(many, 'طريق').length, Palette.MAX_RESULTS);
  assert.strictEqual(Palette.search(many, 'طريق', 3).length, 3);
});

/* ---- العرض: قابل للتشغيل بلوحة المفاتيح ---- */

const results = Palette.search(STREETS, 'الملك');
const list = Palette.renderResults(results, 1);

ok('القائمة تحمل أدوار الوصول الصحيحة', () => {
  assert.ok(list.indexOf('role="listbox"') !== -1);
  assert.ok(list.indexOf('role="option"') !== -1);
  assert.ok(list.indexOf('aria-selected="true"') !== -1, 'لا خيار مُبرَز');
  assert.strictEqual((list.match(/aria-selected="true"/g) || []).length, 1,
    'أكثر من خيار مُبرَز في وقت واحد');
});

ok('الخيار المُبرَز هو المطلوب لا الأول دائماً', () => {
  // يُفحص المعنى لا ترتيب السمات: أيّ عنصر يحمل aria-selected="true".
  const selected = (list.match(/<li[^>]*aria-selected="true"[^>]*>/g) || [])[0] || '';
  assert.ok(selected, 'لا عنصر مُبرَز');
  assert.ok(selected.indexOf('data-index="1"') !== -1,
    `أُبرِز غير المطلوب: ${selected}`);
});

ok('كل نتيجة تحمل نوعها فلا يختلط تصريح بإجراء', () => {
  const mixed = Palette.renderResults([
    { kind: 'work', label: 'طريق' }, { kind: 'action', label: 'اعتماد' },
  ], 0);
  assert.ok(mixed.indexOf('تصريح') !== -1);
  assert.ok(mixed.indexOf('إجراء') !== -1);
});

ok('لا نتيجة تقول ذلك ولا تترك فراغاً', () => {
  const empty = Palette.renderResults([], 0);
  assert.ok(empty.indexOf('لا نتيجة مطابقة') !== -1);
  assert.ok(empty.indexOf('role="status"') !== -1, 'الفراغ لا يُعلَن لقارئ الشاشة');
});

ok('الهيكل يحمل حقلاً موسوماً ومفاتيح معروضة', () => {
  const shell = Palette.renderShell();
  assert.ok(shell.indexOf('role="combobox"') !== -1);
  assert.ok(shell.indexOf('aria-controls="deskPaletteResults"') !== -1);
  assert.ok(shell.indexOf('for="deskPaletteInput"') !== -1, 'حقل بلا وسم');
  assert.ok(shell.indexOf('<kbd>Esc</kbd>') !== -1, 'المفاتيح غير معروضة');
});

ok('كل نص يمر بالترميز', () => {
  const nasty = Palette.renderResults([{ kind: 'work', label: '<img src=x onerror=1>' }], 0);
  assert.ok(nasty.indexOf('<img src=x') === -1);
  assert.ok(nasty.indexOf('&lt;img') !== -1);
});

console.log(`\n${passed} اختبارات نجحت`);
