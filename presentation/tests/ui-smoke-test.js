'use strict';
/**
 * Static smoke checks for athar-prototype.html — no browser needed.
 * Run: node presentation/tests/ui-smoke-test.js
 * يصطاد فئات الأخطاء التي كشفها التحكيم العدائي: IDs بلا معالجات،
 * وسوم «وفر» فوق أرقام ضرر، ممنوعات، وبيانات تركيبية بلا وسم.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'athar-prototype.html'), 'utf8');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

// كل ID تستخدمه getElementById موجود فعلاً في الوسوم
test('every getElementById target exists as an id attribute', () => {
  const used = new Set(
    [...html.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1])
  );
  const defined = new Set(
    [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1])
  );
  const missing = [...used].filter((id) => !defined.has(id));
  assert.deepStrictEqual(missing, [], `missing ids: ${missing.join(', ')}`);
});

// عناصر الواجهة الجديدة الحرجة موجودة ومربوطة
test('critical interactive elements are present and wired', () => {
  for (const id of ['wzdxExportBtn', 'cfCard', 'cfVerdict', 'personHoursRange', 'transitRangeLine']) {
    assert.ok(html.includes(`id="${id}"`), `element ${id} missing`);
  }
  assert.ok(/wzdxExportBtn'\)\.addEventListener/.test(html), 'wzdx button has no listener');
});

// الممنوعات الحمراء غائبة («فالنموذج مضمون» ادعاء ممنوع؛ كلمة «مضمونة» في
// تعليق برمجي عن rAF ليست ادعاءً فتُستثنى بفحص العبارة الكاملة)
test('forbidden claims absent from prototype', () => {
  for (const bad of ['أول منصة', 'غير مسبوق', '627', 'فالنموذج مضمون']) {
    assert.ok(!html.includes(bad), `forbidden string present: ${bad}`);
  }
});

// كل بطاقة تحمل كلمة «وفر/موفّر» في سطر عرض يجب أن تستمد من savedVehHours
// لا من delayVehHours (فخ عكس الإشارة). فحص تقريبي: السطر الحامل للوسمين معاً ممنوع.
test('no line labels harm (delayVehHours) as savings (وفر)', () => {
  const lines = html.split('\n');
  const offenders = lines.filter(
    (l) => /delayVehHours/.test(l) && /وفر|موفّر|متجنبة/.test(l)
  );
  assert.deepStrictEqual(offenders, [], `sign-inversion suspects:\n${offenders.join('\n')}`);
});

// بطاقة الحالة المقابلة: الحكم موسوم كتركيبي، والانحراف غير ثابت
test('counterfactual card verdict is labeled synthetic and drift is variable', () => {
  assert.ok(/حكم على حالة تركيبية/.test(html), 'verdict lacks synthetic label');
  assert.ok(!/predicted \* 1\.12;/.test(html), 'fixed 1.12 drift still present');
  assert.ok(/syntheticDrift/.test(html), 'variable drift missing');
});

// تصدير WZDx مربوط بالمقطع المختار لا بإحداثيات ثابتة
test('wzdx export uses selected segment coordinates', () => {
  assert.ok(/CORRIDOR_COORDS\[segIdx\]/.test(html), 'wzdx not bound to selected segment');
  assert.ok(!/coordinates: \[\[46\.675, 24\.700\], \[46\.680, 24\.735\]\],\n    \}\);\n    var blob/.test(html), 'hardcoded coords remain in export');
});

// اللقطة المضمنة في الواجهة تطابق ملف البيانات الحقيقي المجلوب من RCRC
test('inline RCRC snapshot matches vendored data file', () => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'rcrc-corridor-transit.json'), 'utf8')
  );
  assert.strictEqual(data.busStops.routeCount, 9);
  assert.strictEqual(data.busStops.totalWithin2km, 70);
  assert.strictEqual(data.metroStations.totalWithin2km, 6);
  assert.ok(data._provenance.accessedDate === '2026-07-23', 'provenance date missing');
  assert.ok(/routeCount: 9/.test(html), 'inline routeCount mismatch');
  assert.ok(/busStopsWithin2km: 70/.test(html), 'inline stop count mismatch');
  assert.ok(/metroStationsWithin2km: 6/.test(html), 'inline metro count mismatch');
});

// ثوابت المعايرة الأربعة معروضة في جدول الشفافية
test('all four calibration constants appear in the ASSUMPTIONS table', () => {
  for (const key of ['scoreCalibration', 'workZoneFriction', 'compoundFactor', 'minCapacityFraction']) {
    assert.ok(html.includes(`key: '${key}'`), `ASSUMPTIONS missing ${key}`);
  }
});

// transitImpact في الواجهة مربوط بعدد المسارات الحقيقي لا بالافتراض
test('transit impact uses real RCRC route count', () => {
  assert.ok(/transitImpact\(result, \{ routes: RCRC_TRANSIT\.routeCount \}\)/.test(html),
    'transitImpact not wired to RCRC_TRANSIT');
});

console.log(`ALL UI SMOKE TESTS PASSED (${count})`);
