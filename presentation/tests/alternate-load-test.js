'use strict';
/**
 * بوابة «هل يتحمّل البديل الحركة؟».
 * ---------------------------------------------------------------------------
 * **العيب الذي تحرسه.**
 *
 * بطاقة القرار كانت تجيب سبعة من ثمانية أسئلة يسألها من يقرأ خطة إغلاق،
 * ويسقط الثامن — وهو أخطرها عملياً: الطريق الذي سيستقبل الحركة، هل يتحمّلها؟
 * إغلاقٌ بديلُه فارغ وإغلاقٌ بديلُه مشبَع يعطيان الرقم نفسه في ساعات-المركبة
 * ويعنيان شيئين مختلفين تماماً على الأرض.
 *
 * الجواب كان محسوباً في محرك التوجيه، ومعروضاً في الخريطة وحدها. والمراجع
 * يقرّر من المكتب.
 *
 * **وما تحرس منه.**
 *
 * أن يُقرأ الرقم قياساً. نسبة الحجم إلى السعة على البديل مشتقّة من النموذج
 * بالكامل: الحركة المحوَّلة مقدَّرة، والسعة افتراض معلن، والنموذج لا يعرف أن
 * السائق قد يلغي رحلته. درجتها `model-derived` ولا تُرفَّع.
 *
 * التشغيل: node presentation/tests/alternate-load-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;

const Engine = require(path.join(ROOT, 'masar-engine.js'));
const Analysis = require(path.join(ROOT, 'masar-desk-analysis.js'));
const DeskFile = require(path.join(ROOT, 'masar-desk-file.js'));

const REPORT = path.join(ROOT, 'data', 'alternate-load.json');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const portfolio = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8'));

test('كل تصريح في المحفظة له حكم على بديله — بلا إسقاط صامت', () => {
  /* إسقاط التصاريح التي تعذّر حساب بديلها يجعل النسب تُقرأ على محفظة أصغر
     من المعلَنة، وهي أخطر طريقة لتحسين رقم: لا تكذب، تُخفي المقام. */
  assert.strictEqual(report.total, portfolio.features.length);
  portfolio.features.forEach((feature) => {
    const entry = report.permits[feature.properties.permitRef];
    assert.ok(entry, `${feature.properties.permitRef}: بلا حكم على البديل`);
    assert.ok(entry.verdict && entry.verdict.key, 'حكم بلا مفتاح');
  });
  const summed = Object.values(report.tally).reduce((a, b) => a + b, 0);
  assert.strictEqual(summed, report.total, 'مجموع التصنيفات لا يساوي المحفظة');
});

test('الحكم يُشتقّ من النسبة لا يُكتب — والعتبات متسقة', () => {
  Object.entries(report.permits).forEach(([ref, entry]) => {
    const ratio = entry.ratioAfter;
    const key = entry.verdict.key;
    if (!Number.isFinite(ratio)) {
      assert.strictEqual(key, 'unknown', `${ref}: بلا نسبة وحكمه ليس «غير محسوب»`);
      return;
    }
    if (ratio > 1) assert.strictEqual(key, 'overflows', `${ref}: نسبة ${ratio} وحكم ${key}`);
    else if (ratio >= 0.85) assert.strictEqual(key, 'near-capacity', `${ref}: ${ratio}/${key}`);
    else assert.strictEqual(key, 'carries', `${ref}: ${ratio}/${key}`);
  });
});

test('قبل وبعد معاً — النسبة وحدها لا تقول من أغرق الطريق', () => {
  /* «٣٠٥٪» لا تفرّق بين طريقٍ كان مزدحماً أصلاً وطريقٍ أغرقه هذا الإغلاق.
     والفرق يحدّد هل الحلّ نافذة أخرى أم طريق آخر. */
  Object.entries(report.permits)
    .filter(([, entry]) => entry.verdict.key !== 'unknown')
    .forEach(([ref, entry]) => {
      assert.ok(Number.isFinite(entry.ratioBefore), `${ref}: بلا نسبة قبل التحويل`);
      assert.ok(entry.ratioAfter >= entry.ratioBefore,
        `${ref}: الحمل بعد التحويل أقل منه قبله — التحويل يزيد لا ينقص`);
      assert.ok(Number.isFinite(entry.divertedVehPerHour),
        `${ref}: بلا حجم محوَّل`);
    });
});

test('التقرير يعلن درجته وحدّه — ولا يدّعي قياساً', () => {
  assert.strictEqual(report.grade, 'model-derived');
  assert.ok(report.doesNotProve && report.doesNotProve.length > 40);
  assert.match(report.doesNotProve, /لا قياس ميداني/);
  const forbidden = ['مرصود', 'مقيس', 'مُقاس'];
  forbidden.forEach((word) => {
    assert.ok(report.note.indexOf(word) === -1,
      `«${word}» في وصف رقم مشتقّ من النموذج`);
  });
});

test('البطاقة تعرض الحكم بلغة تُقرأ بلا مصطلح', () => {
  const feature = portfolio.features
    .find((one) => report.permits[one.properties.permitRef].verdict.key === 'overflows');
  assert.ok(feature, 'لا حالة فائضة في المحفظة — راجع التقرير');

  global.MASAR_ALTERNATE_LOAD = report;
  const analysis = Analysis.evaluate(feature.properties, Engine);
  const html = DeskFile.renderSummary(feature, analysis);

  assert.ok(html.indexOf('هل يتحمّل البديل') !== -1,
    'البطاقة لا تسأل السؤال أصلاً');
  assert.ok(html.indexOf('لا يتحمّل') !== -1, 'الحكم غير معروض');
  assert.ok(html.indexOf('طابور') !== -1,
    'الحكم بلا شرح بلغة عادية — «١٫٩» وحدها لا تعني شيئاً لغير المتخصص');
  assert.ok(html.indexOf('لا قياس ميداني') !== -1,
    'الحدّ غائب عن البطاقة — الرقم يُقرأ قياساً');
});

test('غياب الملخّص يُسكت البطاقة ولا يُسقطها', () => {
  /* بطاقةٌ صامتة أصدق من تقدير، وأسلم من صفحة تسقط. */
  const feature = portfolio.features[0];
  const saved = global.MASAR_ALTERNATE_LOAD;
  delete global.MASAR_ALTERNATE_LOAD;
  try {
    const analysis = Analysis.evaluate(feature.properties, Engine);
    const html = DeskFile.renderSummary(feature, analysis);
    assert.ok(html.indexOf('هل يتحمّل البديل') === -1,
      'البطاقة تعرض القسم بلا بيانات');
    assert.ok(html.length > 100, 'البطاقة سقطت بغياب ملف اختياري');
  } finally {
    global.MASAR_ALTERNATE_LOAD = saved;
  }
});

test('المكتب يُحمّل الملخّص', () => {
  const page = fs.readFileSync(path.join(ROOT, 'masar-desk.html'), 'utf8');
  assert.match(page, /data\/alternate-load\.js/,
    'المكتب لا يُحمّل ملخّص حمل البديل');
});

console.log(`ALL TESTS PASSED (${count})`);
