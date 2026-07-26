'use strict';
/**
 * بوابة حزمة القياس الميداني.
 *
 * لكل فحص هنا **زوج**: مُدخل يمرّ ومُدخل مزروع العطب يسقط. بوابةٌ تُختبر
 * بالنجاح وحده تمرّر كل شيء وتبدو خضراء.
 *
 * التشغيل: node presentation/tests/measurement-pack-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const Pack = require(path.join(ROOT, 'measurement-pack', 'index.js'));
const { checks, counterfactual, reports } = Pack;

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const BASE = Pack.example();

/** نسخة «حقيقية» من المثال — لفحص السببية بلا وسم التركيبي. */
function asReal(patch) {
  const study = clone(BASE);
  study.study.dataMode = 'local-field';
  study.study.synthetic = false;
  return Object.assign(study, patch || {});
}

// ---- ملفات الحزمة --------------------------------------------------------

test('كل ملفات الحزمة المعلنة موجودة', () => {
  const manifest = Pack.manifest();
  const missing = manifest.rows.filter((row) => !row.exists).map((row) => row.file);
  assert.deepStrictEqual(missing, [], `ملفات ناقصة: ${missing.join('، ')}`);
});

test('المخطط يعلن أن وضع البيانات إمّا ميداني محلي أو تركيبي — لا ثالث', () => {
  const schema = Pack.schema();
  assert.deepStrictEqual(schema.properties.study.properties.dataMode.enum,
    ['local-field', 'synthetic']);
});

test('المخطط يُشغَّل فعلاً على المثال — لا مخطط يُكتب ولا يُختبر', () => {
  /* مخططٌ في المستودع لا يمرّ عليه محقق هو وثيقة لا بوابة. وأول ما يكشفه
     التشغيل هو أن المثال نفسه يخالف المخطط الذي كُتب له. */
  const Ajv = require('ajv');
  const addFormats = require('ajv-formats');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(Pack.schema());

  assert.strictEqual(validate(BASE), true,
    `المثال يخالف مخططه:\n    ${(validate.errors || [])
      .map((error) => `${error.instancePath} ${error.message}`).join('\n    ')}`);

  /* والمحقق يسقط على عطب مزروع — وإلا كان يقبل كل شيء. */
  const damaged = clone(BASE);
  damaged.closure.lanesClosed = 'اثنان';
  assert.strictEqual(validate(damaged), false, 'المحقق قبِل نوعاً خاطئاً');

  const noTimezone = clone(BASE);
  noTimezone.study.timezone = 'UTC';
  assert.strictEqual(validate(noTimezone), false,
    'المحقق قبِل منطقة زمنية غير الرياض — الإزاحة تنقل الذروة');
});

test('قوالب CSV تحمل أعمدة الحجم والجودة والمصدر', () => {
  const header = fs.readFileSync(
    path.join(ROOT, 'measurement-pack', 'templates', 'series.csv'), 'utf8')
    .split('\n')[0];
  ['volume_veh_per_hour', 'quality', 'source', 'coverage', 'segment_id']
    .forEach((column) => {
      assert.ok(header.indexOf(column) !== -1, `العمود ${column} غائب عن القالب`);
    });
});

// ---- المثال التركيبي -----------------------------------------------------

test('المثال موسوم تركيبياً في ثلاثة مواضع لا موضع واحد', () => {
  /* وسمٌ واحد يُحذف بالنسخ. الثلاثة: تحذير الملف، و`dataMode`، و`synthetic`. */
  assert.ok(BASE._WARNING && BASE._WARNING.indexOf('تركيبية') !== -1);
  assert.strictEqual(BASE.study.dataMode, 'synthetic');
  assert.strictEqual(BASE.study.synthetic, true);
});

test('المثال التركيبي يُستورد ويُفحص — الغرض منه ذلك', () => {
  const result = Pack.ingest(BASE, { delayVehHours: 5000 });
  assert.strictEqual(result.accepted, true);
  assert.strictEqual(result.usable, true);
});

test('ولا يُحسب منه أثر مهما اكتمل', () => {
  /* الحزمة التركيبية تحمل تصميم «محور مقارنة» كاملاً. ولو كان الحارس يفحص
     التصميم وحده لأجاز أثراً من بيانات مولَّدة. */
  const result = Pack.ingest(BASE);
  assert.strictEqual(BASE.counterfactual.design, 'control-corridor');
  assert.strictEqual(result.causal.allowed, false);
  assert.match(result.causal.reason, /تركيبية/);
});

// ---- الاكتمال ------------------------------------------------------------

test('حزمة كاملة تمرّ فحص الاكتمال', () => {
  assert.strictEqual(checks.completeness(BASE).ok, true);
});

test('حذف حقل إلزامي يمنع الاستيراد ويسمّيه', () => {
  const damaged = clone(BASE);
  delete damaged.closure.actualStart;
  const verdict = checks.completeness(damaged);
  assert.strictEqual(verdict.importable, false);
  assert.ok(verdict.missing.includes('closure.actualStart'));
});

test('غياب الحالة المقابلة يخفض ولا يمنع', () => {
  const damaged = clone(BASE);
  delete damaged.series.control;
  delete damaged.geometry.controlCorridor;
  const verdict = checks.completeness(damaged);
  assert.strictEqual(verdict.importable, true, 'مُنع الاستيراد لغياب المقارنة');
  assert.ok(verdict.degraded.some((item) => /الحالة المقابلة/.test(item.what)));
});

test('غياب سجل العوامل المربكة يُعلن «لم يُسجَّل» لا «لا عوامل»', () => {
  const damaged = clone(BASE);
  delete damaged.confounders;
  const verdict = checks.completeness(damaged);
  assert.ok(verdict.degraded.some((item) => /confounders/.test(item.what)));
});

// ---- الجودة --------------------------------------------------------------

test('حزمة سليمة تمرّ فحص الجودة', () => {
  assert.strictEqual(checks.quality(BASE).ok, true);
});

test('سلسلة قصيرة تسقط — لحظة لا نمط', () => {
  const damaged = clone(BASE);
  damaged.series.before.samples = damaged.series.before.samples.slice(0, 5);
  const verdict = checks.quality(damaged);
  assert.strictEqual(verdict.ok, false);
  assert.ok(verdict.problems.some((problem) => /أقل من/.test(problem)));
});

test('سرعة خارج المدى الفيزيائي تسقط', () => {
  const damaged = clone(BASE);
  damaged.series.during.samples[3].speedKph = 480;
  assert.ok(checks.quality(damaged).problems
    .some((problem) => /خارج المدى الفيزيائي/.test(problem)));
});

test('حجم في السلسلة بلا مصدر volume معلن يسقط', () => {
  /* هذا هو الحقل الذي ستُبنى عليه `v/c`. رقمٌ لا أحد يعرف كيف قيس لا يجوز
     أن يصير بسطاً. */
  const damaged = clone(BASE);
  damaged.provenance.sources = damaged.provenance.sources
    .filter((source) => source.metric !== 'volume');
  assert.ok(checks.quality(damaged).problems
    .some((problem) => /ولا مصدر من نوع volume/.test(problem)));
});

// ---- الاتساق -------------------------------------------------------------

test('حزمة متسقة تمرّ', () => {
  assert.strictEqual(checks.consistency(BASE).ok, true);
});

test('عيّنة «أثناء» خارج نافذة الإغلاق تسقط', () => {
  /* أخطر عطب في المجموعة: بيانات كاملة ونظيفة وموسومة خطأً. الفرق الناتج
     يبدو أثراً وهو خطأ محاذاة. */
  const damaged = clone(BASE);
  damaged.series.during.samples[0].at = '2026-09-20T10:00:00.000Z';
  assert.ok(checks.consistency(damaged).problems
    .some((problem) => /خارج نافذة الإغلاق/.test(problem)));
});

test('عيّنة «قبل» بعد بدء الإغلاق تسقط', () => {
  const damaged = clone(BASE);
  damaged.series.before.samples[0].at = '2026-09-09T01:00:00.000Z';
  assert.ok(checks.consistency(damaged).problems
    .some((problem) => /بعد بدء الإغلاق/.test(problem)));
});

test('لا مقطع مشترك بين «قبل» و«أثناء» يسقط', () => {
  const damaged = clone(BASE);
  damaged.series.during.samples.forEach((sample) => { sample.segmentId = 'SEG-OTHER'; });
  assert.ok(checks.consistency(damaged).problems
    .some((problem) => /لا مقطع مشترك/.test(problem)));
});

test('فاصل زمني غير معلن يسقط', () => {
  const damaged = clone(BASE);
  delete damaged.series.during.intervalMinutes;
  assert.ok(checks.consistency(damaged).problems
    .some((problem) => /فاصل زمني غير معلن/.test(problem)));
});

test('نهاية إغلاق قبل بدايته تسقط', () => {
  const damaged = clone(BASE);
  damaged.closure.actualEnd = damaged.closure.actualStart;
  assert.ok(checks.consistency(damaged).problems
    .some((problem) => /ليست بعد بدايته/.test(problem)));
});

// ---- الحالة المقابلة والسببية ---------------------------------------------

test('بلا تصميم مقارنة يُمنع الادّعاء السببي وتُفرض الصياغة البديلة', () => {
  const study = asReal();
  study.counterfactual = { design: 'none' };
  const verdict = counterfactual.canClaimCausal(study);
  assert.strictEqual(verdict.allowed, false);
  assert.strictEqual(verdict.phrasing, counterfactual.OBSERVED_ONLY);
  assert.match(verdict.reason, /لا تفصل أثر الإغلاق عن التغيّر الطبيعي/);
});

test('تصميم معلن وشروطه ناقصة يُرفض — وهو أخطر من غيابه', () => {
  const study = asReal();
  study.counterfactual = { design: 'control-corridor' };
  delete study.series.control;
  const verdict = counterfactual.canClaimCausal(study);
  assert.strictEqual(verdict.allowed, false);
  assert.ok(verdict.missing.includes('series.control'));
  assert.match(verdict.reason, /معلن غير منفَّذ/);
});

test('تصميم مكتمل الشروط على بيانات حقيقية يُجيز الأثر مع تحفّظه', () => {
  const verdict = counterfactual.canClaimCausal(asReal());
  assert.strictEqual(verdict.allowed, true);
  assert.strictEqual(verdict.design, 'control-corridor');
  assert.ok(verdict.caveat.length > 20, 'تصميم بلا تحفّظ معلن');
});

test('كل تصميم مقارنة يعلن قوّته وشروطه وتحفّظه', () => {
  Object.keys(counterfactual.DESIGNS).forEach((key) => {
    const design = counterfactual.DESIGNS[key];
    assert.ok(design.strength, `${key}: بلا قوّة معلنة`);
    assert.ok(Array.isArray(design.requires) && design.requires.length,
      `${key}: بلا شروط`);
    assert.ok(design.caveat && design.caveat.length > 15, `${key}: بلا تحفّظ`);
  });
});

test('اللغة السببية تُلتقط حين لا يجوز الادّعاء', () => {
  const study = asReal();
  study.counterfactual = { design: 'none' };
  const verdict = counterfactual.canClaimCausal(study);
  const check = counterfactual.checkPhrasing('الإغلاق سبّب تأخيراً قدره 400 ساعة', verdict);
  assert.strictEqual(check.ok, false);
  assert.ok(check.violations.length >= 1);
});

test('واللغة نفسها تمرّ حين يجوز', () => {
  const verdict = counterfactual.canClaimCausal(asReal());
  assert.strictEqual(
    counterfactual.checkPhrasing('الإغلاق سبّب تأخيراً', verdict).ok, true);
});

// ---- التقارير ------------------------------------------------------------

test('تقرير قبل/أثناء/بعد يعرض الفرق ويصفه بما يجيزه التصميم', () => {
  const report = reports.beforeDuringAfter(BASE);
  assert.ok(report.observed.speed.absolute < 0, 'السرعة لم تنخفض في المثال');
  assert.ok(report.observed.travelTime.absolute > 0);
  assert.match(report.statement, /ليس أثراً سببياً مثبتاً/);
});

test('الفرق في الفروق يُحسب حين توجد سلسلة مقارنة، ويغيب بغيابها', () => {
  assert.ok(reports.beforeDuringAfter(BASE).differenceInDifferences);
  const damaged = clone(BASE);
  delete damaged.series.control;
  assert.strictEqual(reports.beforeDuringAfter(damaged).differenceInDifferences, null);
});

test('غياب الحجم يمنع مقارنة المتوقَّع بالمرصود بسبب معلن', () => {
  /* الوحدتان مختلفتان: النموذج ساعات-مركبة، والمرصود سرعة وزمن. المقارنة
     بينهما بلا حجم تُنتج رقم معايرة بلا معنى. */
  const damaged = clone(BASE);
  ['before', 'during', 'after'].forEach((key) => {
    damaged.series[key].samples.forEach((sample) => { sample.volumeVehPerHour = null; });
  });
  const report = reports.expectedVsObserved(damaged, { delayVehHours: 5000 });
  assert.strictEqual(report.comparable, false);
  assert.match(report.reason, /يحتاج حجم حركة/);
  assert.ok(report.whatWouldFixIt.length > 20, 'منعٌ بلا طريق');
});

test('المقارنة تُحسب حين يوجد الحجم — ولا تُجيز المعايرة', () => {
  const report = reports.expectedVsObserved(BASE, { delayVehHours: 5000 });
  assert.strictEqual(report.comparable, true);
  assert.ok(Number.isFinite(report.observedVehHours));
  assert.strictEqual(report.calibrationAllowed, false,
    'حالة واحدة أجازت معايرة — النقطة الواحدة لا تعطي معاملاً');
  assert.match(report.calibrationRule, /عيّنة صالحة من عدة حالات/);
});

test('بلا توقّع من النموذج لا مقارنة', () => {
  const report = reports.expectedVsObserved(BASE, null);
  assert.strictEqual(report.comparable, false);
  assert.match(report.reason, /لا توقّع من النموذج/);
});

test('متوسط الحجم يبقى null عند غيابه ولا يصير صفراً', () => {
  const damaged = clone(BASE);
  damaged.series.during.samples.forEach((sample) => { sample.volumeVehPerHour = null; });
  const summary = reports.summarise(damaged.series.during);
  assert.strictEqual(summary.meanVolumeVehPerHour, null,
    'صفر بدل غياب — الصفر يعني «لم تمرّ مركبة»');
});

// ---- الاستيراد الكامل ----------------------------------------------------

test('حزمة ناقصة تُرفض عند المرحلة الأولى ولا يُسأل عن سببيتها', () => {
  const damaged = clone(BASE);
  delete damaged.series.during;
  const result = Pack.ingest(damaged);
  assert.strictEqual(result.accepted, false);
  assert.strictEqual(result.stage, 'الاكتمال');
  assert.strictEqual(result.reports, null);
});

test('«مقبولة» و«صالحة للاستنتاج» و«يجوز النسب» ثلاثة حقول لا حقل', () => {
  const result = Pack.ingest(BASE, { delayVehHours: 5000 });
  assert.strictEqual(typeof result.accepted, 'boolean');
  assert.strictEqual(typeof result.usable, 'boolean');
  assert.strictEqual(typeof result.causal.allowed, 'boolean');
  assert.notStrictEqual(result.accepted, result.causal.allowed,
    'القبول والنسب يتطابقان — الفصل بينهما هو الحارس كله');
});

// ---- وثائق الحزمة --------------------------------------------------------

test('وثيقة الكفاية تفصل المعايرة عن إثبات الأثر', () => {
  const body = fs.readFileSync(
    path.join(ROOT, 'measurement-pack', 'SUFFICIENCY.md'), 'utf8');
  assert.match(body, /ما يكفي للمعايرة، وما يكفي لإثبات الأثر/);
  assert.match(body, /لا تُعاير من حالة واحدة|لماذا لا تُعاير من حالة واحدة/);
});

test('طلب البيانات يسمّي الحجم حقلاً حاكماً ويعلن حدود النظام', () => {
  const body = fs.readFileSync(
    path.join(ROOT, 'measurement-pack', 'DATA-REQUEST.md'), 'utf8');
  assert.match(body, /حاكم — بدونه لا معايرة/);
  assert.match(body, /لم يُعاير بعد على أي إغلاق ميداني/);
});

test('قاموس البيانات يمنع كتابة الغائب صفراً', () => {
  const body = fs.readFileSync(
    path.join(ROOT, 'measurement-pack', 'DATA-DICTIONARY.md'), 'utf8');
  assert.match(body, /لا تُكتب صفراً/);
});

console.log(`ALL TESTS PASSED (${count})`);
