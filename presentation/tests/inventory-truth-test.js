'use strict';
/**
 * البوابة التي تمنع الجرد من الانفصال عن المنتج.
 * ---------------------------------------------------------------------------
 * جرد الميزات هو ما يُقرأ عند التقييم، وهو أخطر ملف في المستودع لأنه الوحيد
 * الذي يمكن أن **يدّعي** بدل أن يصف. وقد حدث: ظلّ يقول عن الحفر المشترك «تعمل
 * في المختبر» بعد أن صارت تعمل على المكتب، وقال عن التعارض ما يناقض ما تعرضه
 * الشاشة.
 *
 * هذه الحزمة تربط كل ادّعاء «تعمل الآن على الرحلة الرئيسية» بشيء يمكن التحقّق
 * منه في الشيفرة: وحدةٌ محمَّلة على المكتب ومُستدعاة فيه. الادّعاء بلا وصلٍ
 * يُسقط الحزمة.
 *
 * لا تدّعي هذه البوابة أن الميزة **جيدة** — تدّعي فقط أنها **موصولة**. الجودة
 * تُقاس بالتشغيل، والوصل يُقاس هنا.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const BENCH = path.join(ROOT, '..', 'research', '2026-07-23', 'athar-competitor-benchmarks');
const INVENTORY = path.join(BENCH, 'athar-feature-inventory.md');

const inventory = fs.readFileSync(INVENTORY, 'utf8');
const deskSurface = ['athar-desk.html', 'athar-desk-boot.js']
  .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');

/** كل ميزة تدّعي الرحلة الرئيسية، والوصل الذي يُثبت الادّعاء. */
const MAIN_JOURNEY = {
  'الميزة ٢٥': ['AtharDeskDigOnce', 'conflict'],
  'الميزة ٢٦': ['AtharDeskDigOnce.render', 'mergeFor'],
  'الميزة ٣٢': ['AtharDeskMeasurement.render', 'importObservation'],
  'الميزة ٣٣': ['AtharImpactCalibration.createCalibration', 'calibration.status'],
};

function blockOf(feature) {
  const at = inventory.indexOf('### ' + feature);
  assert.notStrictEqual(at, -1, `ميزة مفقودة من الجرد: ${feature}`);
  const end = inventory.indexOf('### ', at + 4);
  return inventory.slice(at, end === -1 ? inventory.length : end);
}

ok('كل ادّعاء «على الرحلة الرئيسية» موصول فعلاً بالمكتب', () => {
  Object.keys(MAIN_JOURNEY).forEach((feature) => {
    const block = blockOf(feature);
    if (block.indexOf('على الرحلة الرئيسية') === -1) return;

    MAIN_JOURNEY[feature].forEach((hook) => {
      assert.ok(deskSurface.indexOf(hook) !== -1,
        `${feature} يدّعي الرحلة الرئيسية والمكتب لا يستدعي ${hook}`);
    });
  });
});

ok('كل ادّعاء بالرحلة الرئيسية يحمل تاريخ تحقّقه', () => {
  // ادّعاءٌ بلا تاريخ لا يُعرف متى صحّ ولا متى تقادم.
  Object.keys(MAIN_JOURNEY).forEach((feature) => {
    const block = blockOf(feature);
    if (block.indexOf('على الرحلة الرئيسية') === -1) return;
    assert.ok(/تحقّق \d{1,2} \S+ \d{4}/.test(block),
      `${feature} يدّعي بلا تاريخ تحقّق`);
  });
});

ok('ما يبقى مخططاً له لا يُوصف بأنه يعمل', () => {
  // الميزة ٣٨ هي الفخّ: تصدير WZDx موجود، والنشر إلى تطبيقات الملاحة لم يقع.
  const publish = blockOf('الميزة ٣٨');
  assert.ok(publish.indexOf('مخطط لها') !== -1,
    'نشر الإغلاقات سُجّل عاملاً — والتصدير ليس نشراً');
});

ok('وحدات المكتب المدّعاة موجودة كملفات ومحمَّلة في الصفحة', () => {
  const html = fs.readFileSync(path.join(ROOT, 'athar-desk.html'), 'utf8');
  ['athar-desk-digonce.js', 'athar-desk-measurement.js', 'athar-impact-calibration.js',
    'athar-desk-plan.js', 'athar-desk-recall.js', 'athar-desk-session.js']
    .forEach((file) => {
      assert.ok(fs.existsSync(path.join(ROOT, file)), `ملف مفقود: ${file}`);
      assert.ok(html.indexOf(file) !== -1, `${file} غير محمَّل على المكتب`);
    });
});

ok('تقرير التدقيق موجود ويحمل حدوده لا إنجازاته وحدها', () => {
  const audit = fs.readFileSync(path.join(ROOT, '..', 'docs', 'AUDIT-2026-07-25.md'), 'utf8');
  assert.ok(audit.indexOf('ما زال ناقصاً') !== -1, 'تدقيق بلا قسم نواقص');
  assert.ok(audit.indexOf('لا قياس ميداني') !== -1,
    'التدقيق لا يذكر أن المعايرة لم تقع — وهو أهم حدّ فيه');
  assert.ok(audit.indexOf('لا مستخدم حقيقي') !== -1,
    'التدقيق لا يذكر غياب المستخدم الحقيقي');
});

console.log(`\n${passed} اختبارات نجحت`);
