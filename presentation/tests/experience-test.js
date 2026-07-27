'use strict';
/**
 * مسار — بوابة تجربة الجهة.
 * ---------------------------------------------------------------------------
 * تحرس هذه الحزمة صدق السيناريو وعزل الواجهة: تصريحا المياه والكهرباء يأتيان
 * من المحفظة نفسها، والأثر المقترح لا يُختلق، وكل ما يُعرض للجهة يبقى قراءةً
 * محلية لا كتابة في الخادم.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
function ok(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

const ROOT = path.join(__dirname, '..');

function browserData(file) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox);
  return sandbox.window;
}

const portfolio =
  browserData('data/city-portfolio.geojson.js').MASAR_CITY_PORTFOLIO;
const compliance =
  browserData('data/digonce-compliance.js').MASAR_DIGONCE_COMPLIANCE;
const Model = require(path.join(ROOT, 'masar-experience-model.js'));

const model = Model.buildViewModel(portfolio, compliance, {
  currentRef: 'BLD-2026-0077',
  otherRef: 'BLD-2026-0076',
});

ok('الحالة المختارة كهرباء ومياه على الشارع نفسه — من المحفظة لا من نص الصفحة', () => {
  assert.strictEqual(model.available, true);
  assert.strictEqual(model.actor.name, 'الشركة السعودية للكهرباء');
  assert.strictEqual(model.scenario.current.properties.permitRef, 'BLD-2026-0077');
  assert.strictEqual(model.scenario.other.properties.permitRef, 'BLD-2026-0076');
  assert.strictEqual(
    model.scenario.current.properties.promoter,
    'الشركة السعودية للكهرباء',
  );
  assert.strictEqual(model.scenario.other.properties.promoter, 'شركة المياه الوطنية');
  assert.strictEqual(
    model.scenario.current.properties.street,
    model.scenario.other.properties.street,
  );
});

ok('الرقم الذي لا يحسبه المحرك يبقى غير محسوب', () => {
  assert.strictEqual(model.scenario.proposed.impactVehHours, null);
  assert.ok(model.scenario.before.impactVehHours > 0);
  assert.strictEqual(model.scenario.before.openings, 2);
  assert.strictEqual(model.scenario.proposed.openings, 1);
});

ok('حد البيانات يسافر مع نموذج الصفحة', () => {
  assert.ok(model.dataLimit.includes('مولَّدة'));
  assert.ok(model.dataLimit.includes('ليست سجلّ تصاريح رسمياً'));
});

ok('محفظة الصفحة تخص الكهرباء وحدها ولا تدّعي تنسيقاً غير مثبت', () => {
  assert.ok(model.summary.permitCount > 0);
  assert.ok(model.permits.length > 0 && model.permits.length <= 8);
  model.permits.forEach((item) => {
    assert.strictEqual(item.promoter, 'الشركة السعودية للكهرباء');
    assert.ok(['action', 'waiting', 'scheduled', 'all'].includes(item.bucket));
    assert.notStrictEqual(item.bucket, 'coordinated');
  });
});

ok('الهندسة تتحول إلى مسارين متجهيين داخل نطاق ثابت', () => {
  assert.strictEqual(model.scenario.geometry.viewBox, '0 0 640 260');
  assert.match(model.scenario.geometry.currentPath, /^M /);
  assert.match(model.scenario.geometry.otherPath, /^M /);
});

ok('قدرات المشروع عشر بطاقات محددة المدخل والمخرج', () => {
  assert.strictEqual(model.capabilities.length, 10);
  model.capabilities.forEach((capability) => {
    assert.ok(capability.title);
    assert.ok(capability.purpose);
    assert.ok(capability.input);
    assert.ok(capability.output);
  });
});

ok('غياب البيانات أو الحالة لا يصنع تصريحاً بديلاً', () => {
  const missing = Model.buildViewModel(null, null);
  assert.strictEqual(missing.available, false);
  assert.strictEqual(missing.scenario, null);

  const noPair = Model.buildViewModel(
    { type: 'FeatureCollection', features: [] },
    { notices: {}, permits: {}, dataLimit: 'حد تمثيلي' },
  );
  assert.strictEqual(noPair.available, true);
  assert.strictEqual(noPair.scenario, null);
});

console.log(`ALL EXPERIENCE TESTS PASSED (${passed})`);
