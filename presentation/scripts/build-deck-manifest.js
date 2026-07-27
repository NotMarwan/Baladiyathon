'use strict';
/**
 * جرد أرقام العرض، والعرض النصّي المولَّد منه.
 * ---------------------------------------------------------------------------
 * **المشكلة.**
 *
 * العرض التقديمي خمسٌ وعشرون صورة Base64 وثمانية وعشرون ألف محرف نصّ. أي أن
 * أكثر ما يقرؤه المحكّم داخل الصور — وأي رقم فيها خارج كل فحص آلي، وخارج
 * القراءة الدلالية إن كان التحكيم يستعين بأداة.
 *
 * فالعرض البصري يبقى للعين، ويُضاف بجانبه **عرض نصّي مولَّد**: كل رقم فيه
 * مأخوذ من مصدر حاكم في المستودع، ومعه درجة دليله وحدّه.
 *
 * **ولماذا مولَّد لا مكتوب.**
 *
 * لأن الرقم المكتوب في شريحة يتقادم في أسبوع ولا ينبّه أحد — وهذا حدث فعلاً:
 * كان العرض يقول «١٧٧ فحصاً» والحقيقة أكثر من ألف. المولَّد يتقادم مع مصدره
 * أو لا يتقادم.
 *
 * التشغيل: node presentation/scripts/build-deck-manifest.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
global.window = global;

const Canonical = require(path.join(ROOT, 'masar-canonical.js'));
const Cases = require(path.join(ROOT, 'masar-comparable-cases.js'));
const Evidence = require(path.join(ROOT, 'masar-route-evidence.js'));
/* يُقرأ ولا يُكتب: نقطة تشغيل السعة تُؤخذ من المحرك نفسه لا من نسخة عنها،
   كي لا يبقى في الجرد رقمٌ صحيحٌ يوم كُتب وخاطئٌ بعد أول تعديل في المحرك. */
const Engine = require(path.join(ROOT, 'masar-engine.js'));

const OUT_JSON = path.join(REPO, 'output', 'submission', 'deck-manifest.json');
const OUT_HTML = path.join(REPO, 'output', 'submission', 'masar-judging-deck-text.html');

function read(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * كل رقم في العرض النصّي يمرّ من هنا.
 *
 * الحقول الأربعة إلزامية، وأهمها `limit`: رقمٌ بلا حدّ مكتوب يُقرأ مطلقاً.
 */
function figure(key, value, unit, source, grade, limit) {
  return { key, value, unit, source, grade, limit };
}

/**
 * الحالة الواحدة التي يعرضها العرض بجانب العدّ.
 *
 * **وهي ليست الأسوأ عمداً.** ترتيبها التاسع من مئة واثنتي عشرة حالة فائضة،
 * والأسوأ يصل إلى نسبة أعلى بكثير — وهي معروضة بجوارها في الجرد
 * (`alternateWorstAfterShare`) كي لا يُقرأ المثال حدّاً أعلى وهو وسط.
 * اختيار الحالة الأسوأ مثالاً يقلب معنى الشريحة من «هذا هو الحال» إلى
 * «هذا أقصى ما وجدنا»، وهما ادّعاءان مختلفان.
 */
const EXAMPLE_PERMIT = 'BLD-2026-0045';

function build() {
  const metrics = Canonical.metrics();
  const wzdx = read(path.join(ROOT, 'data', 'wzdx-conformance-summary.json'));
  const stability = read(path.join(ROOT, 'data', 'stability-summary.json'));
  const tests = read(path.join(ROOT, 'tests', 'fixtures', 'test-manifest.json'));
  const prior = Cases.priorFor('capacityPerLaneInWorkZone');
  const casesSummary = Cases.summary();
  const readiness = read(path.join(ROOT, 'data', 'route-evidence', 'readiness.json'));
  const interop = read(path.join(ROOT, 'data', 'wzdx-interop-summary.json'));
  const alternate = read(path.join(ROOT, 'data', 'alternate-load.json'));
  const arterialPrior = Cases.priorFor('capacityPerLaneInWorkZone_signalizedArterial');
  const delaware = Cases.cases().find((item) => item.key === 'delaware-arterial');

  const figures = [];

  Object.keys(metrics).forEach((key) => {
    figures.push(figure(key, metrics[key].value, metrics[key].unit,
      'masar-canonical.js (محسوب من المحفظة)', 'model-derived',
      metrics[key].meaning));
  });

  figures.push(figure('wzdxPassed', wzdx.passed, 'تصريح',
    'data/wzdx-conformance-report.json — ajv على المخطط الرسمي، التزام '
    + wzdx.commit.slice(0, 7), 'model-derived',
    'اجتياز بنيوي للمخطط. لا يعني أن البيانات صحيحة ميدانياً.'));
  figures.push(figure('wzdxTotal', wzdx.total, 'تصريح',
    'data/wzdx-conformance-report.json', 'model-derived',
    'المحفظة تمثيلية مولَّدة، لا سجل تصاريح حقيقي.'));
  figures.push(figure('wzdxBlocked', wzdx.failed, 'تصريح',
    'data/wzdx-conformance-report.json', 'model-derived',
    'ممنوعة لنقص امتداد العمل في بيانات المصدر — لا لعيب في المُصدِّر.'));

  figures.push(figure('stabilityDecidable', stability.decidable, 'توصية',
    'data/stability-report.json', 'model-derived',
    'قابلة للقرار يعني أن ترتيب البدائل يصمد، لا أن الرقم صحيح.'));
  figures.push(figure('stabilityAbstained', stability.abstained, 'توصية',
    'data/stability-report.json', 'model-derived',
    'الامتناع نتيجة صالحة: البيانات لا تكفي لترتيب البدائل.'));
  figures.push(figure('stabilityAbstainedShare', stability.abstainedShare, '٪',
    'data/stability-report.json', 'model-derived',
    'نسبة الامتناع عبر المحفظة التمثيلية.'));

  figures.push(figure('checksPassed', tests.checks, 'فحص',
    'presentation/tests/fixtures/test-manifest.json — مولَّد من تشغيل أخضر',
    'model-derived',
    'الفحوص تُثبت أن الشيفرة تفعل ما وُصفت به. لا تُثبت أن النموذج صحيح.'));
  figures.push(figure('suitesPassed', tests.suites, 'حزمة',
    'presentation/tests/fixtures/test-manifest.json', 'model-derived',
    'عدد حزم الاختبار.'));

  figures.push(figure('frictionPriorLow', prior.priorLow, prior.unit,
    'data/comparable-cases.json — ' + prior.basis[0], 'global-analog',
    prior.doesNotProve));
  figures.push(figure('frictionPriorHigh', prior.priorHigh, prior.unit,
    'data/comparable-cases.json — ' + prior.basis[1], 'global-analog',
    prior.doesNotProve));
  figures.push(figure('comparableCases', casesSummary.total, 'حالة',
    'data/comparable-cases.json', 'global-analog',
    'لا واحدة منها سعودية بقياسات — والنتيجة معلنة في السجل.'));
  figures.push(figure('localMeasuredCases', casesSummary.localMeasured, 'حالة',
    'data/comparable-cases.json', 'global-analog',
    'صفر. لا حالة سعودية بقياسات قبل/أثناء في المصادر العامة المفحوصة.'));

  /* التبادلية — الرقمان الوحيدان في الجرد المشتقّان من **إنتاج جهة أخرى**.
     كل ما عداهما مشتقّ من أثر أو من ورقة. */
  const interopPublishers = interop.rows.map((row) => row.publisher).join('، ');
  const interopErrors = interop.rows.reduce((sum, row) => sum + row.errorCount, 0);
  figures.push(figure('interopFeedFeatures', interop.totalFeatures, 'منطقة عمل',
    'data/wzdx-interop-summary.json — تغذية ' + interopPublishers
      + '، مثبَّتة ببصمتها', 'external-official',
    'تبادلية بنيوية لا قياس. تغذية ولايةٍ أخرى لا تقول شيئاً عن الرياض ولا '
      + 'عن صحة أي رقم في مسار.'));
  figures.push(figure('interopFeedErrors', interopErrors, 'خطأ',
    'data/wzdx-interop-summary.json — نفس المحقق ونفس الالتزام '
      + interop.validator.commit.slice(0, 7), 'external-official',
    'صفر يعني أن المخطط الذي نصدّر عليه قبِل إنتاج جهة رسمية حقيقية. '
      + 'ولا يعني أن مُخرَجنا صحيح مرورياً: هذا اجتياز بنية لا قياس، '
      + 'ولا يقول شيئاً عن الرياض.'));

  /* حمل البديل — الجواب على السؤال الثامن.
     تعدادٌ على المحفظة كلها، بلا إسقاط: مجموع الأربعة يساوي
     `portfolioPermitCount`، فلا تُقرأ نسبةٌ على مقام أصغر من المعلَن. */
  const altSource = 'data/alternate-load.json — ساعة مرجعية '
    + alternate.referenceHour;
  figures.push(figure('alternateOverflows', alternate.tally.overflows, 'تصريح',
    altSource, alternate.grade,
    'الطلب المحوَّل يتجاوز طاقة البديل في النموذج. لا قياس ميداني: الحركة '
    + 'المحوَّلة مقدَّرة، والسعة افتراض معلن، والنموذج لا يعرف أن السائق قد '
    + 'يلغي رحلته أو يغيّر ساعتها.'));
  figures.push(figure('alternateCarries', alternate.tally.carries, 'تصريح',
    altSource, alternate.grade,
    'يبقى دون طاقته في النموذج عند الساعة المرجعية وحدها. ساعة أخرى قد '
    + 'تعطي حكماً آخر.'));
  figures.push(figure('alternateNearCapacity', alternate.tally['near-capacity'],
    'تصريح', altSource, alternate.grade,
    'قريب من طاقته — حكمٌ حدّي يقلبه تغيّر صغير في الحركة المحوَّلة، فلا '
    + 'يُقرأ نجاحاً.'));
  figures.push(figure('alternateUncomputed', alternate.tally.unknown, 'تصريح',
    altSource, alternate.grade,
    'لم يُحسب له بديل — هندسة نقطية بلا خطّ يُحوَّل حوله. غياب حكم لا حكم '
    + 'بالسلامة.'));

  /* أين يقع الحمل — سؤالُ ساكن لا سؤالُ مهندس.
     `alternateOverflows` يقول إن طابوراً يتكوّن ولا يقول أين، وهذه الأرقام
     تقوله. وهي **تفصيلٌ للتعداد أعلاه لا تعدادٌ ثانٍ**: كل محمَّلٍ على حيّ
     داخلٌ في `alternateOverflows`. */
  const hood = alternate.neighbourhood;
  if (!hood || !hood.tally) {
    throw new Error('alternate-load.json بلا قسم للحيّ — أعد توليده بـ '
      + 'build-alternate-load.js قبل بناء الجرد');
  }
  const hoodSource = altSource + ' — نطاق أصناف residential وliving_street '
    + 'وunclassified، بعتبة السعة نفسها';
  const pct = (ratio) => Math.round(ratio * 100);

  figures.push(figure('neighbourhoodOverloaded', hood.tally.overloaded, 'تصريح',
    hoodSource, alternate.grade,
    'بديلها الأفضل يدفع شارعاً سكنياً فوق سعته المعلنة في النموذج. وفتح '
    + 'البحث على أهداف المحرك الخمسة كلها لم ينقذ منها واحداً. ولا يقيس '
    + 'أثراً على السكان — لا ضجيج ولا سلامة ولا سرعة عند البيوت.'));
  /* المقام معروضٌ مع البسط. «103» بلا مقام يُسأل عنه فوراً، و«من 150» خطأ:
     32 تصريحاً بلا بديل محسوب أصلاً، فالمقام هو ما حُسب له بديل. */
  figures.push(figure('neighbourhoodComputed',
    hood.tally.none + hood.tally.within + hood.tally.overloaded, 'تصريح',
    hoodSource, alternate.grade,
    'ما حُسب له بديل فعلاً — والباقي هندسة نقطية بلا خطّ يُحوَّل حوله. '
    + 'قراءة النسبة على 150 تُصغّر المشكلة بمقامٍ لم يُفحص.'));
  figures.push(figure('neighbourhoodSpared',
    hood.tally.none + hood.tally.within, 'تصريح', hoodSource, alternate.grade,
    'بديلها لا يدخل حيّاً، أو يدخله ويبقى دون سعته. حكمٌ عند ساعة مرجعية '
    + 'واحدة — ساعة أخرى قد تعطي غيره.'));
  figures.push(figure('neighbourhoodWiderSearchRescued', hood.widerSearchRescued,
    'تصريح', hoodSource + `، بحثٌ بعمق ${hood.auditSearchCount} مقابل `
    + `${hood.displaySearchCount} في العرض`, alternate.grade,
    'صفر يعني أن الحكم ليس أثراً لضيق البحث. ولا يعني أن لا بديل موجود في '
    + 'الواقع: المحرك يبحث بخمسة أهداف على رسمٍ مبسَّط، لا على شبكة الرياض '
    + 'كاملة بإشاراتها وممنوعاتها.'));

  figures.push(figure('neighbourhoodLoadBeforeShare',
    pct(hood.medianMinorRatioBefore), '٪', hoodSource, alternate.grade,
    'وسيط حمل أكثر مقطعٍ سكني تحميلاً على البديل، قبل التحويل. الوسيط لا '
    + 'المتوسط: أقصى حالة تبلغ أضعاف السعة فتجرّ المتوسط.'));
  figures.push(figure('neighbourhoodLoadAfterShare',
    pct(hood.medianMinorRatioAfter), '٪', hoodSource, alternate.grade,
    'الوسيط نفسه بعد التحويل. فوق المئة يعني طابوراً في النموذج لا زمن '
    + 'تأخير مقيساً، ولا يعرف النموذج أن الساكن قد يؤجّل رحلته.'));
  figures.push(figure('neighbourhoodWorstShare',
    pct(hood.worstMinorRatioAfter), '٪', hoodSource, alternate.grade,
    'أسوأ حالة في المحفظة — حدٌّ أعلى لا حالٌ معتاد.'));
  figures.push(figure('neighbourhoodCapacity', hood.minorCapacityVehPerHour,
    'مركبة/ساعة', 'data/riyadh-route-graph.js — جدول أصناف الطرق، صنف '
    + 'residential', 'model-derived',
    'سعة افتراضية معلنة من جدول الأصناف، لا عدّاً ميدانياً على شارع بعينه.'));

  const example = alternate.permits[EXAMPLE_PERMIT];
  if (!example || !example.ratioAfter) {
    throw new Error(`${EXAMPLE_PERMIT}: الحالة المعروضة في العرض غير موجودة `
      + 'أو بلا نسبة — العرض يعرض حالة زالت من البيانات');
  }
  const share = (ratio) => Math.round(ratio * 100);
  const worstAfter = Object.keys(alternate.permits).reduce((worst, key) => {
    const row = alternate.permits[key];
    return row.verdict.key === 'overflows' && row.ratioAfter > worst
      ? row.ratioAfter : worst;
  }, 0);
  const exampleSource = altSource + ' — التصريح ' + EXAMPLE_PERMIT
    + '، المقطع المقيِّد: ' + example.bindingStreet;
  figures.push(figure('alternateCaseBeforeShare', share(example.ratioBefore), '٪',
    exampleSource, alternate.grade,
    'نسبة الحجم إلى السعة على البديل قبل التحويل، عند ساعة مرجعية واحدة.'));
  figures.push(figure('alternateCaseAfterShare', share(example.ratioAfter), '٪',
    exampleSource, alternate.grade,
    'النسبة نفسها بعد التحويل. فوق المئة تعني طابوراً في النموذج، لا زمن '
    + 'تأخير مقيساً.'));
  figures.push(figure('alternateCaseDiverted', example.divertedVehPerHour,
    'مركبة/ساعة', exampleSource, alternate.grade,
    'حركة محوَّلة مقدَّرة من حصة المسارات المغلقة، لا عدّاً مرورياً.'));
  figures.push(figure('alternateWorstAfterShare', share(worstAfter), '٪',
    altSource + ' — أعلى نسبة بعد التحويل في المحفظة', alternate.grade,
    'موجود كي لا تُقرأ الحالة المعروضة حدّاً أعلى وهي وسط الترتيب. رقمٌ '
    + 'نموذجي مثل غيره، لا قياس.'));

  /* سعة منطقة العمل — نقطة تشغيل المحرك، وسندها.
     الحارس هنا غرضه واحد: أن يسقط البناء إن انفصل ما يقوله العرض عن نقطة
     تشغيل المحرك، بدل أن يبقى الجرد صادقاً عن نسخةٍ سابقة من الشيفرة. */
  const engineCapacity = Engine.CALIBRATION.WORK_ZONE_LANE_CAPACITY;
  if (engineCapacity !== arterialPrior.priorHigh) {
    throw new Error('سعة منطقة العمل في المحرك (' + engineCapacity + ') لا '
      + 'تطابق سند السجل (' + arterialPrior.priorHigh + ') — العرض سيعرض '
      + 'رقماً بلا سنده');
  }
  figures.push(figure('workZoneLaneCapacity', engineCapacity, arterialPrior.unit,
    'masar-engine.js — نقطة التشغيل، وسندها delaware-arterial في '
    + 'data/comparable-cases.json', arterialPrior.evidenceLevel,
    delaware.doesNotProve));
  figures.push(figure('workZoneCapacitySites', delaware.sites, 'موقع مقيس',
    'data/comparable-cases.json — delaware-arterial، ' + delaware.agency,
    arterialPrior.evidenceLevel,
    'متوسط عبر خمسة وعشرين موقعاً أمريكياً، وتوزيعها نفسه واسع. لا يُسقَط '
    + 'على إشارة بعينها ولا على شارع في الرياض.'));

  figures.push(figure('providersReady',
    readiness.providers.filter((provider) => provider.ready).length, 'مزوّد',
    'data/route-evidence/readiness.json', 'synthetic',
    'صفر: لا مفاتيح. المحوّلات جاهزة ولم تُشغَّل ببيانات حقيقية.'));
  figures.push(figure('fieldCases', 0, 'حالة',
    'لا ملف — القيمة صفر لأن لا حالة ميدانية في المستودع', 'local-field',
    'هذا هو السقف الحاكم لدرجة الأثر: بلا حالة ميدانية واحدة لا يُثبت أثر.'));

  return {
    generatedFrom: 'presentation/scripts/build-deck-manifest.js',
    rule: 'كل رقم في العرض النصّي مأخوذ من هنا. رقمٌ لا يوجد في هذا الجرد '
      + 'لا يجوز أن يظهر في شريحة.',
    grades: Evidence.EVIDENCE_GRADES.map((grade) => ({
      key: grade.key, label: grade.label, rank: grade.rank,
      proves: grade.proves, notProves: grade.notProves,
    })),
    figures,
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

/**
 * يعرض الرقم بدقّة تناسب معناه.
 *
 * `462599.8379158891` ساعة-مركبة دقّةٌ زائفة على رقم مشتقّ من افتراضات
 * تتأرجح بمئات بالمئة. عشرُ خانات عشرية تُقرأ قياساً دقيقاً وهي ناتج قسمة.
 */
function present(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  if (Number.isInteger(value)) return value;
  return Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
}

function gradeLabel(manifest, key) {
  const grade = manifest.grades.find((item) => item.key === key);
  return grade ? grade.label : key;
}

/**
 * العرض النصّي.
 *
 * بلا صورة واحدة وبلا سكربت: كل ما فيه نصّ قابل للنسخ والفحص والقراءة الآلية.
 * والجدول هو الشكل الصحيح — كل رقم في صفّه مع مصدره ودرجته وحدّه، فلا يُقرأ
 * رقمٌ بمعزل عن قيده.
 */
function html(manifest) {
  const rows = manifest.figures.map((item) => '<tr>'
    + `<td><code>${escapeHtml(item.key)}</code></td>`
    + `<td class="num">${escapeHtml(present(item.value))}</td>`
    + `<td>${escapeHtml(item.unit)}</td>`
    + `<td>${escapeHtml(gradeLabel(manifest, item.grade))}</td>`
    + `<td>${escapeHtml(item.source)}</td>`
    + `<td>${escapeHtml(item.limit)}</td>`
    + '</tr>').join('\n');

  const grades = manifest.grades.map((grade) => '<tr>'
    + `<td>${escapeHtml(grade.label)}</td>`
    + `<td class="num">${escapeHtml(grade.rank)}</td>`
    + `<td>${escapeHtml(grade.proves)}</td>`
    + `<td>${escapeHtml(grade.notProves)}</td>`
    + '</tr>').join('\n');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<meta charset="utf-8">
<title>مسار — العرض النصّي القابل للتدقيق</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light dark; --line: #d8d8d8; --muted: #5a5a5a; }
  body { font: 16px/1.8 system-ui, "Segoe UI", Tahoma, sans-serif;
         max-width: 60rem; margin: 0 auto; padding: 2rem 1.25rem; }
  h1 { font-size: 1.7rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.15rem; margin-top: 2.5rem; border-bottom: 1px solid var(--line);
       padding-bottom: 0.35rem; }
  p.lead { color: var(--muted); margin-top: 0; }
  table { border-collapse: collapse; width: 100%; font-size: 0.86rem; margin-top: 0.75rem; }
  th, td { border: 1px solid var(--line); padding: 0.45rem 0.6rem;
           text-align: start; vertical-align: top; }
  th { background: rgba(127,127,127,0.12); font-weight: 700; }
  td.num { font-variant-numeric: tabular-nums; font-weight: 700; white-space: nowrap; }
  code { font-size: 0.85em; }
  .wrap { overflow-x: auto; }
  .note { border-inline-start: 3px solid var(--line); padding: 0.5rem 0.9rem;
          color: var(--muted); font-size: 0.9rem; }
</style>

<h1>مسار — العرض النصّي القابل للتدقيق</h1>
<p class="lead">كل رقم هنا مولَّد من مصدر حاكم في المستودع، ومعه درجة دليله وحدّه.
لا صور، ولا سكربت، ولا رقم مكتوب يدوياً.</p>

<h2>لماذا يوجد هذا الملف بجوار العرض المصوَّر</h2>
<p>العرض التقديمي خمسٌ وعشرون صورة مضمَّنة وقرابة ثمانية وعشرين ألف محرف نصّ.
فأكثر ما يقرؤه المحكّم داخل الصور، وأي رقم فيها خارج أي فحص آلي وخارج القراءة
الدلالية. هذا الملف يجعل الأرقام نفسها قابلة للفحص: تُنسخ، وتُقارن بمصادرها،
وتُقرأ آلياً.</p>

<p class="note">${escapeHtml(manifest.rule)}</p>

<h2>الأرقام ومصادرها</h2>
<div class="wrap">
<table>
<thead><tr><th>المفتاح</th><th>القيمة</th><th>الوحدة</th><th>درجة الدليل</th>
<th>المصدر</th><th>الحدّ — ما لا يقوله هذا الرقم</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>

<h2>درجات الدليل</h2>
<p>الدرجة ليست وصفاً: هي ما يحدّد ما يجوز أن يُقال عن الرقم. رقمٌ بدرجة
«مشتقّ من النموذج» لا يُوصف بأنه مرصود، ونظيرٌ عالمي لا يُوصف بأنه محلي.</p>
<div class="wrap">
<table>
<thead><tr><th>الدرجة</th><th>الرتبة</th><th>ما تُثبته</th><th>ما لا تُثبته</th></tr></thead>
<tbody>
${grades}
</tbody>
</table>
</div>

<h2>الحدّ الحاكم</h2>
<p class="note">لا حالة ميدانية واحدة في المستودع. أعلى درجة دليل متاحة اليوم
لمعاملات النموذج هي «نظير عالمي»، ودرجة الأثر الميداني المثبت <strong>صفر</strong>.
كل ما في الجدول أعلاه إمّا ناتج نموذج، أو حصيلة فحص شيفرة، أو نطاق مستنتج من
دراسات خارجية. ولا شيء منها يُثبت أثر إغلاق في الرياض.</p>
`;
}

function main() {
  const manifest = build();
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(OUT_HTML, html(manifest));
  console.log(`${manifest.figures.length} رقماً مجروداً`);
  console.log(OUT_JSON);
  console.log(OUT_HTML);
}

if (require.main === module) main();

module.exports = { build, html };
