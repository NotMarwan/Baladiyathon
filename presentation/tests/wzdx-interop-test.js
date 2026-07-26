'use strict';
/**
 * بوابة التبادلية — والحدّ الذي يحرسها من أن تُقرأ أكثر مما تقول.
 * ---------------------------------------------------------------------------
 * **ما تحرسه.**
 *
 * أن التغذية المرجعية **مثبَّتة فعلاً**: البصمة المسجَّلة تطابق الملف على
 * القرص. تغذيةٌ تُسحب عند العرض تجعل النتيجة غير قابلة لإعادة الإنتاج، ورقمٌ
 * لا يُعاد إنتاجه ليس دليلاً.
 *
 * **وما تحرس منه — وهو الأهم.**
 *
 * أن يُقرأ «اجتاز المخطط» على أنه «صحيح مرورياً». التبادلية بنية لا قياس،
 * ودرجتها `external-official` رتبتها **3** من 8: فوق النموذج والنظير
 * العالمي، ودون كل درجة محلية ودون القياس الميداني الأجنبي. وأرخص طريقة
 * لرفع درجة الأثر بلا بيانات هي أن تُكتب هذه النتيجة بلغة قياس — فتُمنع
 * بفحص لا بعُرف.
 *
 * التشغيل: node presentation/tests/wzdx-interop-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
global.window = global;

const Evidence = require(path.join(ROOT, 'masar-route-evidence.js'));

const FEED_DIR = path.join(ROOT, 'data', 'reference-feeds');
const MANIFEST = path.join(FEED_DIR, 'MANIFEST.json');
const REPORT = path.join(ROOT, 'data', 'wzdx-interop-summary.json');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

test('التغذية المرجعية مثبَّتة ومصحوبة بجردها', () => {
  assert.ok(fs.existsSync(MANIFEST),
    'لا جرد تغذيات — شغّل: node presentation/scripts/fetch-reference-wzdx.js');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  assert.ok(manifest.feeds.length >= 1, 'الجرد بلا تغذية واحدة');
  manifest.feeds.forEach((entry) => {
    assert.ok(entry.source && /^https:\/\//.test(entry.source),
      `${entry.key}: بلا مصدر`);
    assert.ok(entry.publisher, `${entry.key}: بلا جهة ناشرة`);
    assert.ok(entry.sha256 && entry.sha256.length === 64, `${entry.key}: بلا بصمة`);
  });
});

test('البصمة المسجَّلة تطابق الملف — التثبيت حقيقي لا معلَن', () => {
  /* هذا هو الفحص الذي يجعل الادّعاء قابلاً للمراجعة من الخارج: من شكّ يحسب
     SHA-256 بنفسه ويقارن. وهو أيضاً ما يمنع أن تُستبدل التغذية بأخرى
     «أنظف» بعد أن تسقط. */
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  manifest.feeds.forEach((entry) => {
    const file = path.join(FEED_DIR, entry.file);
    assert.ok(fs.existsSync(file), `${entry.key}: الملف المثبَّت مفقود`);
    const actual = crypto.createHash('sha256')
      .update(fs.readFileSync(file, 'utf8'), 'utf8').digest('hex');
    assert.strictEqual(actual, entry.sha256,
      `${entry.key}: البصمة لا تطابق — المثبَّت ليس ما يُدَّعى`);
  });
});

test('التغذية تُقرأ بلا شبكة وتحمل ما يوصف به', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  manifest.feeds.forEach((entry) => {
    const feed = JSON.parse(fs.readFileSync(path.join(FEED_DIR, entry.file), 'utf8'));
    assert.strictEqual(feed.type, 'FeatureCollection', `${entry.key}: ليست تغذية`);
    assert.strictEqual(feed.features.length, entry.featureCount,
      `${entry.key}: عدد مناطق العمل في الجرد لا يطابق الملف`);
    assert.ok(String(feed.feed_info.version).startsWith('4'),
      `${entry.key}: إصدار التغذية ليس من العائلة الرابعة`);
  });
});

test('التقرير مولَّد ويعلن نتيجته بلا تجميل', () => {
  assert.ok(fs.existsSync(REPORT),
    'لا تقرير تبادلية — شغّل: node presentation/scripts/build-interop-report.js');
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.ok(report.rows.length >= 1);
  assert.strictEqual(report.evidenceGrade, 'external-official');
  assert.ok(report.validator.commit && report.validator.commit.length === 40,
    'التقرير بلا التزام مخطط مثبَّت');
  assert.ok(/ajv@/.test(report.validator.validator), 'التقرير بلا اسم المحقق');
  /* الادّعاء يُولَّد من النتيجة. لو سقطت تغذيةٌ وبقيت الجملة تقول «قبِل»،
     صار التقرير يكذب على مُولِّده. */
  if (report.allValid) {
    assert.match(report.permittedClaim, /بصفر أخطاء/);
  } else {
    assert.match(report.permittedClaim, /اجتازت/);
    assert.ok(report.rows.some((row) => !row.valid));
  }
});

test('الحدّ مكتوب في التقرير نفسه لا في ذاكرة أحد', () => {
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.ok(report.forbiddenClaim, 'تقرير بلا حدّ');
  assert.match(report.forbiddenClaim, /الرياض/);
  assert.match(report.forbiddenClaim, /بنية لا قياس|لا قياس/);
});

test('درجة التبادلية دون كل درجة محلية ودون القياس الميداني الأجنبي', () => {
  const grade = Evidence.EVIDENCE_GRADES
    .find((one) => one.key === 'external-official');
  assert.ok(grade, 'درجة `external-official` غير معرَّفة');
  assert.strictEqual(grade.calibrates, false,
    'التبادلية تُعاير — والمعايرة حكرٌ على الدليل الميداني المحلي');
  assert.strictEqual(grade.narrows, false,
    'التبادلية تضيّق نطاقاً — وهي لا تحمل رقماً أصلاً');

  const rankOf = (key) => Evidence.EVIDENCE_GRADES
    .find((one) => one.key === key).rank;
  ['local-field', 'local-route', 'local-historical', 'local-comparable',
    'global-field-measured'].forEach((key) => {
    assert.ok(rankOf(key) > grade.rank,
      `\`${key}\` ليست فوق التبادلية — السُّلَّم انقلب`);
  });
  assert.ok(grade.rank > rankOf('model-derived'),
    'التبادلية دون النموذج — وهي إنتاج جهة حقيقية');
});

test('لغة القياس ممنوعة على درجة التبادلية', () => {
  ['مرصود', 'مقيس', 'ميداني', 'محلي'].forEach((word) => {
    const verdict = Evidence.checkLanguage('external-official',
      `تقرير ${word} على التغذية`);
    assert.strictEqual(verdict.ok, false,
      `«${word}» مرّت على درجة التبادلية — وهي بنية لا قياس`);
  });
  const fine = Evidence.checkLanguage('external-official',
    'تغذية حكومية حقيقية اجتازت المخطط الرسمي المثبَّت بصفر أخطاء.');
  assert.strictEqual(fine.ok, true, 'البوابة تمنع اللغة الصحيحة أيضاً');
});

test('البطاقة في صفحة المصادر تُملأ من الملخّص لا من رقم مكتوب', () => {
  /* رقمٌ مكتوب في صفحة يتقادم مع أول تغذية تُضاف ولا ينبّه أحد. الفحص هنا
     على السبب: البطاقة تقرأ `MASAR_WZDX_INTEROP`، ولا تحمل الرقم نصّاً. */
  const page = fs.readFileSync(path.join(ROOT, 'masar-sources.html'), 'utf8');
  assert.match(page, /MASAR_WZDX_INTEROP/,
    'بطاقة التبادلية لا تقرأ الملخّص المولَّد');
  assert.match(page, /data\/wzdx-interop-summary\.js/,
    'صفحة المصادر لا تُحمّل ملخّص التبادلية');
  const summary = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  const written = new RegExp(`>\\s*${summary.totalFeatures}\\s*<`);
  assert.ok(!written.test(page),
    'عدد مناطق العمل مكتوب في الصفحة — سيتقادم بلا منبّه');
});

test('الرقمان في الجرد يحملان درجة التبادلية وحدَّها', () => {
  const manifest = JSON.parse(fs.readFileSync(
    path.join(REPO, 'output', 'submission', 'deck-manifest.json'), 'utf8'));
  const rows = manifest.figures.filter((one) => one.grade === 'external-official');
  assert.strictEqual(rows.length, 2, 'رقما التبادلية غير مجرودَين');
  rows.forEach((row) => {
    assert.ok(row.limit && row.limit.length > 20, `${row.key}: بلا حدّ مكتوب`);
    assert.match(row.limit, /الرياض|قياس/,
      `${row.key}: حدٌّ لا ينفي القراءة القياسية`);
  });
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  const features = rows.find((one) => one.key === 'interopFeedFeatures');
  assert.strictEqual(features.value, report.totalFeatures,
    'رقم الجرد لا يطابق التقرير');
});

console.log(`ALL TESTS PASSED (${count})`);
