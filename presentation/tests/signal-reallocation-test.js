'use strict';
/**
 * بوابة «نقل الأخضر إلى مدخل البديل».
 * ---------------------------------------------------------------------------
 * **العيب الذي تحرسه.**
 *
 * الطور السابق سمّى مرورَ البديل بالتقاطع `blocked` — أي تسقط التوصية. والتسمية
 * مقلوبة: تلك أثمن حالة، وإجراؤها **نقل الأخضر من المدخل المغلق إلى مدخل
 * البديل**. وكان الجواب صفراً لعيبٍ في نمذجة الإغلاق لا لغياب الحالة.
 *
 * **وما تحرس منه.**
 *
 * ثلاثة، كلٌّ منها يجعل العمل يبدو أقوى مما هو:
 *
 * ١) أن يُقرأ الرقم حساباً. لا ثانيةَ واحدة على هذه البيانات — طول الدورة غير
 *    موجود. والمعروض نسبةٌ من دورةٍ مجهولة الطول.
 * ٢) أن تُوسَّع زاوية الاتجاه حتى تكثر الحالات. والمنطق هنا معكوس عمداً: توسيع
 *    الزاوية **يُنقص** الحالات، والفحص يثبت ذلك على المسح المنشور.
 * ٣) أن تنحرف نسخةُ البدائل عن المحرك بصمت. فتُفحص مطابقتها له حرفياً على
 *    مجموعة إغلاق الإنتاج.
 *
 * التشغيل: node presentation/tests/signal-reallocation-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;

const Engine = require(path.join(ROOT, 'masar-engine.js'));
const Analysis = require(path.join(ROOT, 'masar-desk-analysis.js'));
const DeskFile = require(path.join(ROOT, 'masar-desk-file.js'));
const RouteEvidence = require(path.join(ROOT, 'masar-route-evidence.js'));
const Routing = require(path.join(ROOT, 'masar-city-routing.js'));

const REPORT = path.join(ROOT, 'data', 'signal-reallocation.json');
const DETECTION = path.join(ROOT, 'data', 'signal-phase-impact.json');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const detection = JSON.parse(fs.readFileSync(DETECTION, 'utf8'));
const portfolio = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8'));

const junctions = Object.values(report.permits).flatMap((one) => one.junctions || []);
const ACTIONS = ['reallocate', 'redistribute', 'no-waste', 'unmeasurable'];

test('كل تصريح مؤكَّد له حالة إجراء — بلا إسقاط صامت', () => {
  const confirmed = Object.entries(detection.permits)
    .filter(([, entry]) => entry.control === 'confirmed').map(([ref]) => ref);
  assert.strictEqual(report.total, confirmed.length);
  confirmed.forEach((ref) => {
    const entry = report.permits[ref];
    assert.ok(entry, `${ref}: بلا حالة إجراء`);
    assert.ok(ACTIONS.indexOf(entry.action) !== -1, `${ref}: حالة غير معروفة`);
  });
  const summed = ACTIONS.reduce((total, key) => total + report.tally[key], 0);
  assert.strictEqual(summed, report.total, 'مجموع الحالات لا يساوي المؤكَّد');
});

test('الكشف لا يُعاد — تعريف «مؤكَّد» واحدٌ في المستودع', () => {
  /* لو أعاد هذا الملف الكشف بعتباته لصار في المستودع تعريفان لـ«مؤكَّد»
     ينحرفان بصمت. فيُقرأ من مُخرَج الطور السابق ويُفحص أنه هو. */
  assert.strictEqual(report.builtOn.confirmedPermits, detection.tally.confirmed);
  Object.keys(report.permits).forEach((ref) => {
    assert.strictEqual(detection.permits[ref].control, 'confirmed',
      `${ref}: في تحليل النقل وليس مؤكَّداً في الكشف`);
  });
});

test('نسخة البدائل تطابق المحرك حرفياً على إغلاق الإنتاج', () => {
  /* أخطر انحراف ممكن هنا: أن تعطي نسختُنا مساراً غير الذي يعرضه المنتج، فتُبنى
     توصية على بديلٍ لا يراه أحد. الفحص يعيد الحساب بمكوّنات المحرك المصدَّرة
     ويقارن `states` حالةً بحالة. */
  require(path.join(ROOT, 'data', 'riyadh-route-graph.js'));
  const graph = global.RIYADH_ROUTE_GRAPH;
  const prepared = Routing.prepare(graph);
  const objectives = Routing.OBJECTIVES;

  let compared = 0;
  Object.keys(report.permits).slice(0, 4).forEach((ref) => {
    const feature = portfolio.features
      .find((one) => one.properties.permitRef === ref);
    if (!feature || !feature.geometry || feature.geometry.type !== 'LineString') return;
    const line = feature.geometry.coordinates;
    const engine = Routing.alternativesAround(prepared, line, { hour: 8, count: 2 });
    if (!engine.ok) return;

    const banned = Routing.edgesUnderClosure(prepared, line);
    const corridor = Routing.corridorField(prepared, line);
    const ends = Routing.solveBoundary(prepared, banned, 8, line, corridor);
    const window = Routing.windowFor(ends.span);
    const seeds = [objectives.fastest, objectives.local, objectives.minor,
      objectives.shortest, objectives.major];
    const candidates = [];
    seeds.forEach((seed) => {
      let ready = null;
      if (seed === objectives.local && ends.local) ready = ends.local;
      if (seed === objectives.fastest && ends.probe) ready = ends.probe;
      const route = ready || Routing.shortestPath(prepared, ends.from, ends.to,
        { hour: 8, banned: banned, objective: seed, corridor: corridor, window: window });
      if (route) { route.objective = seed.key; candidates.push(route); }
    });
    const kept = Routing.chooseAlternatives(prepared, candidates, 2);
    assert.deepStrictEqual(kept.map((one) => one.states),
      engine.alternatives.map((one) => one.states),
      `${ref}: نسخة البدائل انحرفت عن المحرك`);
    compared += 1;
  });
  assert.ok(compared > 0, 'لم تُقارَن حالة واحدة — الفحص يمرّ فارغاً');
});

test('إغلاق الطور مجموعة جزئية من إغلاق الإنتاج — يفتح ولا يغلق', () => {
  /* لو أغلق ضلعاً لم يغلقه الإنتاج لصار نموذجاً أشدّ لا أدقّ، ولانقلب معنى
     الفاتورة أدناه. */
  junctions.forEach((junction) => {
    junction.legDetail.forEach((leg) => {
      if (leg.closedInPhase) {
        assert.ok(leg.closedInProduction,
          `عقدة ${junction.node}: ضلع ${leg.edge} مغلق في الطور ومفتوح في الإنتاج`);
      }
    });
    assert.ok(junction.openLegsInPhase >= junction.openLegsInProduction,
      `عقدة ${junction.node}: إغلاق الطور فتح أضلاعاً أقلّ من الإنتاج`);
  });
});

test('العيب المقيس ما زال قائماً في الإنتاج — والفاتورة تُنسب إليه بحق', () => {
  /* الفاتورة كلها مبنية على أن الإنتاج لا يترك ضلعاً مفتوحاً عند أي تقاطع.
     فإن تغيّر المحرك بطلت النسبة، ووجب إعادة القياس قبل ادعاء أي مكسب. */
  assert.strictEqual(report.closureModelCost.openLegInProduction, 0,
    'الإنتاج صار يترك أضلاعاً مفتوحة — أعد قياس الفاتورة');
  assert.strictEqual(report.closureModelCost.alternativeEntersInProduction, 0,
    'بديلٌ يدخل التقاطع تحت إغلاق الإنتاج — العيب تغيّر');
  assert.ok(report.closureModelCost.openLegInPhase > 0,
    'إغلاق الطور لم يفتح ضلعاً — اختبار الاتجاه لا يعمل');
  assert.strictEqual(report.closureModelCost.casesHiddenByProductionClosure,
    report.closureModelCost.alternativeEntersInPhase
    - report.closureModelCost.alternativeEntersInProduction);
  assert.match(report.closureModelCost.constant, /CLOSURE_NEAR_M/);
  assert.ok(report.closureModelCost.recommendation.indexOf('لم يُنفَّذ') !== -1,
    'الفاتورة لا تقول إن تعديل المحرك لم يُنفَّذ هنا');
});

test('توسيع الزاوية يُنقص الحالات لا يزيدها — فلا مكسب في التساهل', () => {
  /* حارسٌ ضد أرخص تزوير: توسيع عتبة حتى تكثر النتائج. المنطق هنا معكوس
     بنيوياً — كل درجة تُزاد تُبقي أضلاعاً أكثر مغلقةً — والفحص يثبته على
     المسح المنشور بدل أن يَعِد به. */
  const sweep = report.method.thetaSweep;
  const angles = report.method.thetaSweepDeg.slice().sort((a, b) => a - b);
  assert.ok(angles.length >= 2, 'مسح بزاوية واحدة ليس مسحاً');
  for (let index = 1; index < angles.length; index += 1) {
    const wider = sweep[String(angles[index])].alternativeEntersJunction;
    const tighter = sweep[String(angles[index - 1])].alternativeEntersJunction;
    assert.ok(wider <= tighter,
      `الزاوية ${angles[index]}° تعطي حالات أكثر من ${angles[index - 1]}° — `
      + 'المنطق انقلب، فراجع اختبار الاتجاه قبل الاعتماد على الرقم');
  }
  assert.ok(angles.indexOf(report.method.thetaDeg) !== -1,
    'الزاوية الحاكمة ليست في المسح المنشور');
});

test('الحالة مشتقّة من القياس لا مكتوبة', () => {
  junctions.forEach((junction) => {
    if (junction.closedApproaches === 0) {
      assert.strictEqual(junction.action, 'no-waste',
        `عقدة ${junction.node}: لا مدخل مغلق وحالتها ليست «لا أخضر مهدور»`);
      return;
    }
    assert.strictEqual(junction.action,
      junction.alternativeEntersJunction ? 'reallocate' : 'redistribute',
      `عقدة ${junction.node}: الحالة لا تطابق مرور البديل بها`);
  });
});

test('كل مدخل بديل مسمّى بحالته المتجهة، والانعطاف غير ممنوع', () => {
  /* المسار حالاتٌ متجهة لا عقد: المدخل هو الضلع الذي رأسُه العقدة. وقيود
     الانعطاف يحترمها البحث أصلاً — فظهورُ انعطافٍ ممنوع هنا يعني أننا نقرأ
     المسار خطأً، لا أن المحرك أخطأ. */
  let checked = 0;
  junctions.filter((one) => one.action === 'reallocate').forEach((junction) => {
    const approach = junction.approach;
    assert.ok(approach, `عقدة ${junction.node}: حالة نقل بلا مدخل`);
    assert.ok(Number.isInteger(approach.arriveEdge), 'مدخل بلا ضلع');
    assert.strictEqual(approach.turnForbidden, false,
      `عقدة ${junction.node}: انعطاف ممنوع في مسار أنتجه البحث — قراءة المسار خاطئة`);
    checked += 1;
  });
  assert.ok(checked > 0, 'لا حالة نقل واحدة — الفحص يمرّ فارغاً');
});

test('المظروف نسبةٌ من دورة، ولا يدّعي ثوانيَ ولا درجةً أعلى', () => {
  const rankOf = (key) => {
    const grade = RouteEvidence.EVIDENCE_GRADES.filter((one) => one.key === key)[0];
    assert.ok(grade, `درجة غير معروفة: ${key}`);
    return grade.rank;
  };
  const modelRank = rankOf('model-derived');

  let seen = 0;
  junctions.filter((one) => one.envelope).forEach((junction) => {
    const envelope = junction.envelope;
    seen += 1;
    assert.strictEqual(envelope.lowPct, 0,
      `عقدة ${junction.node}: أدنى المظروف ليس صفراً`);
    assert.strictEqual(envelope.highPct,
      Math.round((100 * junction.closedApproaches) / junction.legs),
      `عقدة ${junction.node}: أعلى المظروف ليس حصة المداخل المغلقة`);
    assert.ok(envelope.highPct <= 100, 'المظروف يتجاوز الدورة كاملةً');
    assert.match(envelope.unit, /٪/);
    assert.match(envelope.notSeconds, /طول الدورة/);
    assert.ok(envelope.assumption.length > 30, 'مظروف بلا افتراض معلن');
    assert.ok(rankOf(envelope.evidenceLevel) <= modelRank,
      `عقدة ${junction.node}: درجة أعلى من مشتقّ من النموذج`);
  });
  assert.ok(seen > 0, 'لا مظروف واحد — الفحص يمرّ فارغاً');
});

test('لغة التقرير تلتزم بدرجته — ولا ثانية في أي حقل', () => {
  assert.strictEqual(report.grade, 'model-derived');
  const prose = [report.role, report.doesNotProve, report.singleGreenNotTwo,
    report.method.onClosedStreet, report.method.conservative,
    report.closureModelCost.defect, report.closureModelCost.recommendation]
    .concat(junctions.map((one) => one.why))
    .concat(junctions.filter((one) => one.envelope).map((one) => one.envelope.assumption))
    .join(' ');
  const verdict = RouteEvidence.checkLanguage('model-derived', prose);
  assert.ok(verdict.ok, 'مفردات ممنوعة: ' + verdict.violations.join('، '));

  /* لا رقم يُقدَّم بوحدة الثانية في أي مكان من المُخرَج. */
  assert.ok(!/\d+\s*ثاني/.test(JSON.stringify(report)),
    'رقمٌ بوحدة الثانية في المُخرَج — طول الدورة غير معلوم فلا ثوانيَ تُشتقّ');
  assert.match(report.doesNotProve, /طول الدورة/);
});

test('التوصية تسمّي الطرفين، أو تمتنع بسببٍ مكتوب', () => {
  /* «نسّق إعادة توقيت» بلاغٌ يُحال، و«انقل من س إلى ص» أمرُ تشغيل. والفرق كله
     في الاسمين — فالتوصية بلا اسم تمتنع ولا تُعرض ناقصة. */
  junctions.forEach((junction) => {
    const recommendation = junction.recommendation;
    if (junction.action === 'no-waste' || junction.action === 'unmeasurable') {
      assert.strictEqual(recommendation, null,
        `عقدة ${junction.node}: توصية على حالة ${junction.action}`);
      return;
    }
    assert.ok(recommendation, `عقدة ${junction.node}: بلا توصية ولا امتناع`);
    if (recommendation.blockedBy) {
      assert.strictEqual(recommendation.label, null, 'امتناع ومعه نصّ توصية');
      assert.ok(recommendation.blockedBy.length > 20, 'امتناع بلا سبب مكتوب');
      return;
    }
    assert.ok(recommendation.fromApproach, 'توصية بلا مدخل خاسر مسمّى');
    if (junction.action === 'reallocate') {
      assert.strictEqual(recommendation.action, 'reallocate-green');
      assert.ok(recommendation.toApproach, 'نقلٌ بلا مدخل رابح مسمّى');
      assert.notStrictEqual(recommendation.toApproach, recommendation.fromApproach,
        `عقدة ${junction.node}: النقل من مدخل إلى نفسه`);
      assert.match(recommendation.label, /إدارة المرور/);
    } else {
      assert.strictEqual(recommendation.action, 'drop-phase');
      assert.strictEqual(recommendation.toApproach, null,
        'إسقاطُ طورٍ ومعه مدخل رابح — الحالتان لا تجتمعان');
    }
  });
});

test('البطاقة تسمّي «من أين» و«إلى أين» بلغة تُقرأ', () => {
  const ref = Object.entries(report.permits)
    .filter(([, entry]) => entry.action === 'reallocate')
    .filter(([, entry]) => entry.junctions
      .some((one) => one.recommendation && one.recommendation.label))[0][0];
  const feature = portfolio.features
    .find((one) => one.properties.permitRef === ref);

  global.MASAR_SIGNAL_PHASE = detection;
  global.MASAR_SIGNAL_REALLOCATION = report;
  const html = DeskFile.renderSummary(feature,
    Analysis.evaluate(feature.properties, Engine));

  assert.ok(html.indexOf('الطريق البديل يمرّ بالإشارة نفسها') !== -1,
    'البطاقة لا تقول إن البديل يمرّ بالإشارة — وهي كل الفكرة');
  assert.ok(html.indexOf('نقل زمن الأخضر من') !== -1, 'الإجراء غير مسمّى');
  const junction = report.permits[ref].junctions
    .filter((one) => one.recommendation && one.recommendation.label)[0];
  assert.ok(html.indexOf(junction.recommendation.fromApproach) !== -1,
    'المدخل الخاسر غير معروض بالاسم');
  assert.ok(html.indexOf(junction.recommendation.toApproach) !== -1,
    'المدخل الرابح غير معروض بالاسم');
  assert.ok(html.indexOf('الأخضر المنقول واحد') !== -1,
    'البطاقة تترك الخسارة والكسب يُقرآن مكسبين — ازدواج عدّ');
  assert.ok(html.indexOf('طول الدورة غير منشور') !== -1,
    'البطاقة لا تقول لماذا لا ثوانيَ هنا');
});

test('الحالة المكتشَفة بلا اسم تُعلن امتناعها ولا تتراجع إلى عبارة عامة', () => {
  const found = Object.entries(report.permits)
    .filter(([, entry]) => (entry.junctions || [])
      .some((one) => one.recommendation && one.recommendation.blockedBy))[0];
  if (!found) return;
  const feature = portfolio.features
    .find((one) => one.properties.permitRef === found[0]);

  global.MASAR_SIGNAL_PHASE = detection;
  global.MASAR_SIGNAL_REALLOCATION = report;
  const html = DeskFile.renderSummary(feature,
    Analysis.evaluate(feature.properties, Engine));

  assert.ok(html.indexOf('الحالة مكتشَفة والتوصية ممتنعة') !== -1,
    'الامتناع غير معلن — الحالة تختفي بدل أن تُقال ناقصة');
  assert.ok(html.indexOf('نقل زمن الأخضر من') === -1,
    'توصية نقل بلا اسمَي مدخلين');
});

test('«لا أخضر مهدور» تُقال ولا تُخلط بالطابور', () => {
  const found = Object.entries(report.permits)
    .filter(([, entry]) => entry.action === 'no-waste')[0];
  if (!found) return;
  const feature = portfolio.features
    .find((one) => one.properties.permitRef === found[0]);

  global.MASAR_SIGNAL_PHASE = detection;
  global.MASAR_SIGNAL_REALLOCATION = report;
  const html = DeskFile.renderSummary(feature,
    Analysis.evaluate(feature.properties, Engine));

  assert.ok(html.indexOf('طابورٌ خلف الحفر لا أخضرٌ مهدور') !== -1,
    'البطاقة تخلط تخزين الطابور بالأخضر المهدور');
  assert.ok(html.indexOf('نقل زمن الأخضر من') === -1,
    'توصية نقل على حالة بلا أخضر مهدور');
  /* المظروف يسقط كلّه هنا: مدىً للأخضر المهدور تحت عنوانٍ يقول إنه غير مهدور
     تناقضٌ يُقرأ رقماً — والقارئ يصدّق الرقم لا العنوان. */
  assert.ok(html.indexOf('الأخضر المهدور') === -1,
    'البطاقة تعرض مدى أخضرٍ مهدور على حالة أعلنت أنه غير مهدور');
});

test('غياب تحليل النقل يُبقي البطاقة على التوصية العامة ولا يُسقطها', () => {
  /* بطاقةٌ أضعف أصدق من صفحة تسقط — والملف اختياري في الصفحة. */
  const ref = Object.entries(report.permits)
    .filter(([, entry]) => entry.action === 'reallocate')[0][0];
  const feature = portfolio.features
    .find((one) => one.properties.permitRef === ref);

  global.MASAR_SIGNAL_PHASE = detection;
  const saved = global.MASAR_SIGNAL_REALLOCATION;
  delete global.MASAR_SIGNAL_REALLOCATION;
  try {
    const html = DeskFile.renderSummary(feature,
      Analysis.evaluate(feature.properties, Engine));
    assert.ok(html.indexOf('طور الإشارة') !== -1, 'البطاقة سقطت بغياب ملف اختياري');
    assert.ok(html.indexOf('نقل زمن الأخضر من') === -1,
      'البطاقة تسمّي مدخلين بلا بيانات تسميهما');
  } finally {
    global.MASAR_SIGNAL_REALLOCATION = saved;
  }
});

test('المكتب يُحمّل تحليل النقل', () => {
  const page = fs.readFileSync(path.join(ROOT, 'masar-desk.html'), 'utf8');
  assert.match(page, /data\/signal-reallocation\.js/,
    'المكتب لا يُحمّل تحليل النقل');
});

console.log(`ALL TESTS PASSED (${count})`);
