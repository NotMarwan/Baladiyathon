'use strict';
/**
 * تفكيك دلتا المحفظة — الرقم الذي يُقرأ إنجازاً، وقيوده.
 *
 * التدقيق المستقل حكم بأن «‎89.2٪» صحيح حسابياً ومضلّل بعرضه مفرداً. والحكم
 * بقي وثيقةً بلا سكربت، أي أن الرقم المفكَّك **لم يكن قابلاً لإعادة الإنتاج**
 * — وهو ما يجعل التفكيك نفسه ادعاءً لا دليلاً.
 *
 * تحرس هذه الحزمة ثلاثة أشياء، لا واحداً:
 *
 *   1. أن التفكيك يصف **الرقم المعروض نفسه** لا رقماً قريباً منه.
 *   2. أن حصة إزاحة الساعة تُعرض **مدىً** لا نقطة، لأن الإسناد بين عاملين
 *      متفاعلين يعتمد على ترتيب تطبيقهما.
 *   3. أن القيود **تسافر مع الرقم**: بوابة تُسقط أي سطح يقول «وفّرنا» عارياً.
 *
 * التشغيل: node presentation/tests/delta-decomposition-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'delta-decomposition.json');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
const Portfolio = require(path.join(ROOT, 'masar-portfolio.js'));
const Canonical = require(path.join(ROOT, 'masar-canonical.js'));

test('التفكيك يصف الدلتا المعروضة نفسها — لا رقماً قريباً منها', () => {
  /* أهمّ فحص في الحزمة. تفكيكٌ لرقمٍ غير المعروض يبرّئ المعروض بالباطل:
     القارئ يرى قيوداً منسوبة إلى رقم لم تُقَس عليه. */
  const shipped = Portfolio.buildPortfolio(Portfolio.SEED).totals.savedPct;
  assert.ok(Math.abs(report.governing.deltaPct - shipped) < 1e-9,
    `التفكيك يصف ${report.governing.deltaPct} والمعروض ${shipped}`);
});

test('حصة إزاحة الساعة مدى لا نقطة — الإسناد يعتمد على ترتيب العوامل', () => {
  const { lowPct, highPct, hourFirstPct, hourLastPct } = report.hourShift;
  assert.ok(Number.isFinite(lowPct) && Number.isFinite(highPct),
    'حدّا المدى ليسا عددين');
  assert.ok(lowPct < highPct,
    `المدى منهار (${lowPct} إلى ${highPct}) — رقم واحد يدّعي دقّة لا يملكها`);
  assert.strictEqual(lowPct, Math.min(hourFirstPct, hourLastPct));
  assert.strictEqual(highPct, Math.max(hourFirstPct, hourLastPct));
});

test('إزاحة الساعة وحدها تفسّر أغلب الخفض — الحكم الحاكم مقيس لا منقول', () => {
  /* هذا ما يجعل عرض الرقم مفرداً مضلّلاً: الخفض ليس من الأبعاد التي بُني
     عليها المُحسِّن. العتبة عند النصف مقصودة فضفاضة — الحزمة تحرس الاتجاه
     لا رقماً بعينه، فلا تسقط عند كل معايرة. */
  assert.ok(report.hourShift.lowPct > 50,
    `أدنى حصة للساعة ${report.hourShift.lowPct}٪ — إن نزلت تحت النصف فالحكم `
    + 'المكتوب في القيود لم يعد مسنوداً، فراجعه بدل أن تخفض العتبة');
});

test('مظروف الافتراضين يحيط بالدلتا المعروضة', () => {
  /* الافتراضان — الأرضية وأسّ المنحنى — بلا سند مقيس. فموضع الرقم داخل مداه
     اختيارٌ لا نتيجة، وإخفاء المدى يجعل الاختيار يُقرأ قياساً. */
  const { lowPct, highPct, withoutFloorPct, linearCurvePct } = report.envelope;
  assert.ok(lowPct < report.governing.deltaPct && report.governing.deltaPct < highPct,
    `الدلتا ${report.governing.deltaPct} خارج المظروف ${lowPct}–${highPct}`);
  assert.ok(Math.abs(withoutFloorPct - linearCurvePct) > 1,
    'الافتراضان ينتجان الرقم نفسه — الاستبدال لم يقع، والمحرك لم يتغيّر');
});

test('الأساس مسمّى — الدلتا تقيس رداءته بقدر ما تقيس الحل', () => {
  const realism = report.baselineRealism;
  assert.ok(realism.daytimeStartSharePct > 0,
    'حصة البدء النهاري صفر — تعريف الليل انفصل عن المحرك');
  assert.ok(Number.isInteger(realism.nightBand.from)
    && Number.isInteger(realism.nightBand.to),
    'نطاق الليل غير مقروء من المحرك');
});

test('التوزيع يمنع قراءة الدلتا وصفاً لحالة نموذجية', () => {
  /* المجموع لا يصف الأفراد: ثلاثة عشر تصريحاً دون النصف واثنان سالبان. */
  const dist = report.distribution;
  assert.ok(dist.permitsBelowHalf > 0,
    'صفر تصريح دون النصف — التوزيع لم يُحسب');
  assert.ok(dist.minSavedPct < 0,
    'لا تصريح سالب — القصّ إلى الصفر عاد، فتختفي المقايضة التي تبرّر التوصية');
});

test('المؤشرات الحاكمة تحمل القيود لا الرقم وحده', () => {
  const metrics = Canonical.metrics();
  const pairs = [
    ['deltaHourShareLowPct', report.hourShift.lowPct],
    ['deltaHourShareHighPct', report.hourShift.highPct],
    ['deltaEnvelopeLowPct', report.envelope.lowPct],
    ['deltaEnvelopeHighPct', report.envelope.highPct],
    ['baselineDaytimeStartSharePct', report.baselineRealism.daytimeStartSharePct],
  ];
  pairs.forEach(([key, expected]) => {
    assert.ok(metrics[key], `${key} غائب عن المؤشرات الحاكمة`);
    assert.strictEqual(metrics[key].value, expected,
      `${key} انفصل عن التفكيك المولَّد`);
  });
});

test('بوابة تُسقط ادعاء الوفر عارياً من قيوده', () => {
  /* الحدّ المكتوب في الدلالة («لا وفر مثبت») صحيح ولا يكفي: لا شيء يمنع سطحاً
     من كتابة «وفّرنا 89٪». هذه البوابة تمنعه، وبديلها يحمل المدى والأساس. */
  const claim = Canonical.BANNED_CLAIMS.find(
    (entry) => entry.pattern.test('وفرنا 89٪ من التأخير'));
  assert.ok(claim, 'لا بوابة تمنع ادعاء الوفر — الحدّ يعيش في الدلالة وحدها');
  assert.ok(/\d/.test(claim.instead) && claim.instead.indexOf('–') !== -1,
    'البديل لا يحمل مدىً — يستبدل ادعاءً عارياً بادعاء عارٍ آخر');
  assert.ok(claim.instead.indexOf('نهاري') !== -1,
    'البديل لا يسمّي الأساس، فيُقرأ الأساس ممارسةً قائمة');
  assert.ok(claim.why.indexOf('الليل') !== -1,
    'السبب لا يذكر مصدر الخفض الحقيقي — إزاحة ساعة العمل');
});

test('غياب التفكيك يُسقط المؤشرات صراحةً لا صامتاً', () => {
  /* لو عاد الملف المولَّد غائباً لكان الأسوأ أن تُعرض الدلتا عاريةً من قيودها
     بينما البوابة صامتة — وهو بالضبط الوضع الذي وُجدت القيود لمنعه. */
  const source = fs.readFileSync(path.join(ROOT, 'masar-canonical.js'), 'utf8');
  assert.ok(/throw new Error\('تفكيك الدلتا غير محمَّل/.test(source),
    'masar-canonical.js لا يسقط عند غياب التفكيك');
});

console.log(`ALL TESTS PASSED (${count})`);
