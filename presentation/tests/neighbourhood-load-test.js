'use strict';
/**
 * أين يقع الحمل — بوابة تصنيف الشوارع السكنية.
 * ---------------------------------------------------------------------------
 * **العيب الذي تحرسه.**
 *
 * `overflows` كان يقول إن طابوراً يتكوّن على البديل، ولا يقول **أين**. وأحد
 * المنظّمين قالها من موقع ساكن: «الطريق العام مغلق، فصار الزحام عند بيتي».
 * وهي حالةٌ كان النموذج يتنبّأ بها ولا يسمّيها: طابورٌ على شريان كلفةٌ على من
 * اختار الطريق، وطابورٌ في حيٍّ كلفةٌ على من لم يختر شيئاً — والرقم واحد.
 *
 * **وما تحرس منه — أربعة نقودٍ متوقَّعة، كلٌّ منها فحصٌ هنا.**
 *
 * ١) «غيّرتم أرقامكم». التصنيف **تفصيلٌ للحكم القائم لا نقضٌ له**: كل تحميلٍ
 *    سكني فوق السعة يرفع النسبة الكلية فوق الواحد بالضرورة. صفر تناقض،
 *    مفحوصاً على المحفظة كلها، والتعداد المنشور لم يتحرّك.
 *
 * ٢) «اخترعتم عتبة تُنتج النتيجة التي تريدون». العتبة 1.0 نفسها التي يستعملها
 *    `verdictOf`، وسعة الشارع السكني من جدول أصناف الرسم لا من هذا الملف.
 *    والفحص يعيد اشتقاق النسبة من واجهة المحرك العامة بمسارٍ مستقل.
 *
 * ٣) «بحثكم ضيّق — وسّعوه تجدوا بديلاً يجنّب الحيّ». مقيس: فتح البحث على
 *    أهداف المحرك الخمسة كلها أنقذ **صفر** تصريح.
 *
 * ٤) «العلَم مثبَّتٌ على الرفض». الفحص يشترط وجود حالاتٍ تدخل حيّاً وتبقى دون
 *    سعته، وحالاتٍ لا تدخل حيّاً أصلاً — فالتصنيف يفرّق فعلاً.
 *
 * **وما لا تُثبته هذه الحزمة.** أن التصنيف يقيس أثراً على السكان. لا يقيسه:
 * لا ضجيج ولا سلامة ولا سرعة عند البيوت. يقيس نسبة حجمٍ إلى سعة على أصنافٍ
 * سكنية، وهي نموذج بالكامل.
 *
 * التشغيل: node presentation/tests/neighbourhood-load-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
global.window = global;

const REPORT = path.join(DATA, 'alternate-load.json');
const ENGINE_FILE = path.join(ROOT, 'masar-city-routing.js');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const portfolio = JSON.parse(fs.readFileSync(
  path.join(DATA, 'city-portfolio.geojson'), 'utf8'));
const hood = report.neighbourhood;

test('كل تصريح له حكم على موقع الحمل — بلا إسقاط صامت', () => {
  /* إسقاط ما تعذّر حسابه يجعل النسبة تُقرأ على مقام أصغر من المعلَن، وهي
     أخطر طريقة لتحسين رقم: لا تكذب، تُخفي المقام. */
  assert.ok(hood, 'التقرير بلا قسم للحيّ');
  portfolio.features.forEach((feature) => {
    const entry = report.permits[feature.properties.permitRef];
    assert.ok(entry && entry.neighbourhood && entry.neighbourhood.key,
      `${feature.properties.permitRef}: بلا حكم على موقع الحمل`);
  });
  const summed = Object.values(hood.tally).reduce((a, b) => a + b, 0);
  assert.strictEqual(summed, report.total,
    'مجموع تصنيفات الحيّ لا يساوي المحفظة');
});

test('التصنيف تفصيلٌ للحكم القائم لا نقضٌ له — صفر تناقض', () => {
  /* النقد الأول المتوقَّع: «غيّرتم أرقامكم». لم تتغيّر: `overloaded` مجموعة
     جزئية من `overflows` بالضرورة الحسابية، والفحص يثبتها على المحفظة. */
  const contradictions = [];
  Object.keys(report.permits).forEach((ref) => {
    const row = report.permits[ref];
    if (!row.neighbourhood || row.neighbourhood.key !== 'overloaded') return;
    if (row.verdict.key !== 'overflows') contradictions.push(ref);
  });
  assert.strictEqual(contradictions.length, 0,
    `تحميلٌ سكني فوق السعة دون فيضٍ كلّي: ${contradictions.join('، ')} — `
    + 'إما أن الحكمين يُحسبان من معادلتين، أو أن أحدهما بائت');

  /* والاتجاه الآخر مسموح: فيضٌ على شريان بلا تحميلٍ سكني. لو انعدم لصار
     التصنيف مرادفاً للحكم القائم فلا يضيف شيئاً — فيُشترط وجوده. */
  const arterialOnly = Object.keys(report.permits).filter((ref) => {
    const row = report.permits[ref];
    return row.verdict.key === 'overflows'
      && row.neighbourhood && row.neighbourhood.key !== 'overloaded';
  });
  assert.ok(arterialOnly.length > 0,
    'كل فيضٍ سكني — التصنيف مرادف للحكم القائم ولا يضيف تمييزاً');
});

test('التعداد المنشور لم يتحرّك — التصنيف أُضيف ولم يُعِد الحساب', () => {
  /* لو تحرّك رقمٌ منشور بسبب إضافة تصنيف، لكان التصنيف قد غيّر الحساب لا
     وصفه. هذه الأرقام مثبَّتة عمداً كي يسقط الفحص إن تحرّكت. */
  assert.deepStrictEqual(report.tally,
    { carries: 3, 'near-capacity': 3, overflows: 112, unknown: 32 },
    'تعداد حمل البديل تحرّك — راجع سبب التحرّك قبل تحديث هذا الرقم');
});

test('توسيع البحث إلى أهداف المحرك الخمسة أنقذ صفر تصريح', () => {
  /* النقد الثالث: «بحثكم ضيّق». مقيسٌ لا مُجاب عنه بالكلام. */
  assert.strictEqual(hood.auditSearchCount, 5,
    'عمق التدقيق ليس البحث الأوسع — الادعاء يفقد سنده');
  assert.ok(hood.auditSearchCount > hood.displaySearchCount,
    'التدقيق ليس أوسع من العرض — فلا يفحص شيئاً');
  assert.strictEqual(hood.widerSearchRescued, 0,
    'توسيع البحث أنقذ تصاريح — الحكم كان أثراً لضيق البحث، فصحّح النص');
  assert.strictEqual(hood.noAcceptableAlternative, hood.tally.overloaded,
    'عدد «بلا بديل مقبول» يخالف تعداد المحمَّل على الحيّ');
});

test('التصنيف يفرّق فعلاً — ثلاث حالات كلها موجودة', () => {
  /* النقد الرابع: «العلَم مثبَّتٌ على الرفض». لو كان كذلك لانعدمت الحالتان
     الأخريان. */
  assert.ok(hood.tally.none > 0, 'لا بديل واحد يتجنّب الأحياء — العلَم مثبَّت');
  assert.ok(hood.tally.within > 0,
    'لا بديل يدخل حيّاً ويبقى دون سعته — العلَم يرفض كل دخول لا كل تجاوز');
  assert.ok(hood.tally.overloaded > 0, 'لا حالة محمَّلة — التصنيف بلا أثر');

  /* و«يدخل ضمن السعة» يجب أن يكون فعلاً داخلاً: أضلاع سكنية موجودة. */
  Object.keys(report.permits).forEach((ref) => {
    const n = report.permits[ref].neighbourhood;
    if (!n) return;
    if (n.key === 'within') {
      assert.ok(n.minorEdges > 0, `${ref}: «يدخل حيّاً» بلا ضلع سكني`);
      assert.ok(n.ratioAfter <= 1, `${ref}: «ضمن السعة» ونسبته ${n.ratioAfter}`);
    }
    if (n.key === 'none') {
      assert.strictEqual(n.minorEdges, 0, `${ref}: «لا يدخل حيّاً» وله أضلاع سكنية`);
    }
    if (n.key === 'overloaded') {
      assert.ok(n.ratioAfter > 1, `${ref}: «فوق السعة» ونسبته ${n.ratioAfter}`);
    }
  });
});

test('أصناف الحيّ معلَنة في المحرك — لا قائمة خفية في هذا الملف', () => {
  /* التصنيف يعتمد على `MINOR_NAMES`. لو غُيّرت لتوسيع النتيجة أو تضييقها،
     يجب أن يسقط فحص لا أن تنزلق النسبة صامتة. */
  const source = fs.readFileSync(ENGINE_FILE, 'utf8');
  const match = source.match(/var MINOR_NAMES = \{([^}]*)\}/);
  assert.ok(match, 'MINOR_NAMES غير موجودة في محرك المدينة');
  const names = match[1].split(',').map((part) => part.split(':')[0].trim())
    .filter(Boolean).sort();
  assert.deepStrictEqual(names, ['living_street', 'residential', 'unclassified'],
    'أصناف الحيّ تغيّرت — كل نسبة سكنية منشورة تحتاج إعادة توليد وتبريراً');
});

/* ---- الفحص المستقل: النسبة السكنية معادة الاشتقاق من واجهة المحرك ---- */

require(path.join(DATA, 'riyadh-route-graph.js'));
const Routing = require(ENGINE_FILE);
const graph = global.RIYADH_ROUTE_GRAPH;
const prepared = Routing.prepare(graph);
const MINOR = { residential: 1, living_street: 1, unclassified: 1 };
const classOf = (index) => prepared.classes && prepared.classes[graph.edges[index][6]];
const isMinor = (index) => {
  const profile = classOf(index);
  return !!(profile && MINOR[profile.name]);
};

/* تصريحٌ واحد يكفي للفحص المستقل، ويُختار بمعيارٍ لا بالرقم: أول خطٍّ حكمه
   `overloaded`. تثبيت معرّف يجعل الفحص يسقط لتغيّر البيانات لا لتغيّر السلوك. */
const subject = portfolio.features.find((feature) => {
  if (!feature.geometry || feature.geometry.type !== 'LineString') return false;
  const row = report.permits[feature.properties.permitRef];
  return row && row.neighbourhood && row.neighbourhood.key === 'overloaded';
});
assert.ok(subject, 'لا تصريح محمَّل على حيّ — لا شيء يُفحص مستقلاً');

const live = Routing.alternativesAround(prepared, subject.geometry.coordinates,
  { hour: report.referenceHour, count: report.neighbourhood.displaySearchCount });
assert.ok(live && live.ok, 'تعذّر إعادة حساب التصريح المفحوص');
const chosen = (live.alternatives || []).filter((one) => one && one.load)
  .sort((a, b) => a.load.maxRatioAfter - b.load.maxRatioAfter)[0];
assert.ok(chosen, 'لا بديل محمَّل في إعادة الحساب');

test('النسبة السكنية = أقصى نسبةٍ على الأضلاع السكنية وحدها — بمسارٍ مستقل', () => {
  /* النقد الثاني: «حسابٌ خاصٌّ يُنتج ما تريدون». الفحص لا يكرّر معادلة المحرك
     — يستدعي `loadRoute` نفسها على مسارٍ مصنوعٍ من أضلاع الحيّ وحدها. فإن كان
     النطاق السكني محسوباً صحيحاً، وجب أن يتطابق `maxRatioAfter` لهذا المسار
     مع `minorMaxRatioAfter` للمسار الكامل. تطابقٌ لا تقريب. */
  const minorEdges = chosen.edges.filter(isMinor);
  assert.strictEqual(chosen.load.minorEdges, minorEdges.length,
    'عدد الأضلاع السكنية في المحرك يخالف عدّها من جدول الأصناف');
  assert.ok(minorEdges.length > 0, 'التصريح المفحوص بلا أضلاع سكنية');

  const isolated = Routing.loadRoute(prepared, { edges: minorEdges },
    live.diverted.vehPerHour, report.referenceHour);
  assert.strictEqual(isolated.maxRatioAfter, chosen.load.minorMaxRatioAfter,
    'النسبة السكنية لا تساوي أقصى نسبةٍ على الأضلاع السكنية وحدها');
  assert.strictEqual(isolated.maxRatioBefore, chosen.load.minorMaxRatioBefore,
    'النسبة السكنية قبل التحويل لا تطابق حسابها المعزول');
  /* والمعزول كلّه سكني، فنطاقه السكني هو نفسه — تماسكٌ داخلي. */
  assert.strictEqual(isolated.minorMaxRatioAfter, isolated.maxRatioAfter,
    'مسارٌ كلّه سكني ونطاقه السكني يخالف نطاقه الكامل');
});

test('النسبة السكنية لا تتجاوز النسبة الكلية أبداً — حدٌّ حسابي', () => {
  /* لو تجاوزتها لكان النطاق السكني يقرأ أضلاعاً خارج المسار، أو يحمّل
     حركةً غير المحوَّلة. حدٌّ يجب أن يصمد على كل بديل لا على المختار وحده. */
  (live.alternatives || []).forEach((one) => {
    assert.ok(one.load.minorMaxRatioAfter <= one.load.maxRatioAfter,
      `نسبة الحيّ ${one.load.minorMaxRatioAfter} فوق النسبة الكلية `
      + `${one.load.maxRatioAfter} — النطاق يقرأ خارج المسار`);
    assert.strictEqual(one.load.minorOverflows,
      one.load.minorEdges > 0 && one.load.minorMaxRatioAfter > 1,
      'العلَم لا يطابق قاعدته المعلنة');
  });
});

test('العلَم يقرأ السعة لا مجرّد الدخول — شاهدٌ حيٌّ يدخل ولا يفيض', () => {
  /* **ثغرةٌ وجدها فحص الطفرات.** الشاهد السابق كله `overloaded`، وفيه طرفا
     القاعدة صادقان معاً — فيمرّ حتى لو صار العلَم «مرفوعٌ لأي دخول». وهي
     طفرةٌ خطيرة: تجعل كل بديل يمرّ بحيٍّ مرفوضاً، فينهار التمييز الذي وُجد
     التصنيف من أجله. فيلزم شاهدٌ يدخل الحيّ ويبقى دون سعته. */
  const within = portfolio.features.find((feature) => {
    if (!feature.geometry || feature.geometry.type !== 'LineString') return false;
    const row = report.permits[feature.properties.permitRef];
    return row && row.neighbourhood && row.neighbourhood.key === 'within';
  });
  assert.ok(within, 'لا تصريح يدخل حيّاً ضمن سعته — لا شاهد على قراءة السعة');

  const run = Routing.alternativesAround(prepared, within.geometry.coordinates,
    { hour: report.referenceHour, count: hood.displaySearchCount });
  assert.ok(run && run.ok, 'تعذّر إعادة حساب الشاهد');
  const pick = (run.alternatives || []).filter((one) => one && one.load)
    .sort((a, b) => a.load.maxRatioAfter - b.load.maxRatioAfter)[0];
  assert.ok(pick, 'الشاهد بلا بديل محمَّل');

  assert.ok(pick.load.minorEdges > 0, 'الشاهد لا يدخل حيّاً — لا يفحص القاعدة');
  assert.ok(pick.load.minorMaxRatioAfter <= 1,
    `نسبة حيّ الشاهد ${pick.load.minorMaxRatioAfter} فوق السعة — البيانات تحرّكت`);
  assert.strictEqual(pick.load.minorOverflows, false,
    'بديلٌ يدخل حيّاً ويبقى دون سعته والعلَم مرفوع — العلَم يعاقب الدخول '
    + 'لا التجاوز، فيرفض كل تحويلةٍ محلية بلا سبب');
});

test('مسارٌ بلا أضلاع سكنية: نطاقه السكني صفرٌ لا نسخةٌ من الكلّي', () => {
  /* العيب المحتمل: أن يُهمل النطاق السكني الفلترة فيعيد النسبة الكلية على
     مسارٍ لا يدخل حيّاً — فيصير كل بديل «محمَّلاً على حيّ». */
  const majorEdges = chosen.edges.filter((index) => !isMinor(index));
  assert.ok(majorEdges.length > 0, 'التصريح المفحوص كلّه سكني — لا شاهد نفي');
  const clean = Routing.loadRoute(prepared, { edges: majorEdges },
    live.diverted.vehPerHour, report.referenceHour);
  assert.strictEqual(clean.minorEdges, 0, 'أضلاع غير سكنية عُدّت سكنية');
  assert.strictEqual(clean.minorMaxRatioAfter, 0, 'نطاقٌ سكني على مسارٍ بلا حيّ');
  assert.strictEqual(clean.minorOverflows, false,
    'مسارٌ لا يدخل حيّاً وعلَمُه مرفوع');
  assert.strictEqual(clean.minorBindingStreet, '',
    'مقطعٌ سكني مقيِّد على مسارٍ بلا حيّ');
  assert.ok(clean.maxRatioAfter > 0, 'المسار غير السكني بلا حمل — الشاهد فارغ');
});

test('البطاقة تعرض موقع الحمل والقرار — لا رقمٌ في ملفٍ لا يقرؤه أحد', () => {
  /* الحساب في ملف JSON لا يغيّر قراراً. المراجع يقرّر من البطاقة، فإن لم
     يظهر فيها موقعُ الحمل بقي الحيّ مكتوماً كما كان — وهو العيب نفسه الذي
     وُجد هذا العمل لإصلاحه، منقولاً طبقةً واحدة. */
  const Engine = require(path.join(ROOT, 'masar-engine.js'));
  const Analysis = require(path.join(ROOT, 'masar-desk-analysis.js'));
  const DeskFile = require(path.join(ROOT, 'masar-desk-file.js'));

  const feature = portfolio.features.find((one) => {
    const row = report.permits[one.properties.permitRef];
    return row && row.neighbourhood && row.neighbourhood.key === 'overloaded';
  });
  assert.ok(feature, 'لا حالة محمَّلة على حيّ — لا شيء يُعرض');

  const saved = global.MASAR_ALTERNATE_LOAD;
  global.MASAR_ALTERNATE_LOAD = report;
  try {
    const html = DeskFile.renderSummary(feature,
      Analysis.evaluate(feature.properties, Engine));
    assert.ok(html.indexOf('أين يقع الحمل؟') !== -1,
      'البطاقة لا تسأل أين يقع الحمل');
    assert.ok(html.indexOf('فوق سعته') !== -1, 'الحكم السكني غير معروض');
    assert.ok(html.indexOf('قبل') !== -1 && html.indexOf('بعد التحويل') !== -1,
      'قبل/بعد على الشارع السكني غير معروضين — «١٤٥٪» وحدها تُقرأ كأن الحيّ '
      + 'كان مزدحماً أصلاً فتُبرّئ الإغلاق');
    assert.ok(html.indexOf('قرارٌ لا مسار') !== -1,
      'البطاقة تعرض المشكلة ولا تسمّي المخرَج — فتُقرأ «استخدم هذا البديل»');

    /* والحالة التي لها بديلٌ يجنّب الحيّ لا يجوز أن تحمل كتلة القرار. */
    const ok = portfolio.features.find((one) => {
      const row = report.permits[one.properties.permitRef];
      return row && row.neighbourhood && row.neighbourhood.key === 'none';
    });
    if (ok) {
      const clean = DeskFile.renderSummary(ok, Analysis.evaluate(ok.properties, Engine));
      assert.ok(clean.indexOf('قرارٌ لا مسار') === -1,
        'كتلة «لا بديل مقبول» تظهر على حالة بديلُها يتجنّب الأحياء');
    }
  } finally {
    if (saved === undefined) delete global.MASAR_ALTERNATE_LOAD;
    else global.MASAR_ALTERNATE_LOAD = saved;
  }
});

test('الخريطة تقول أين يقع الحمل — لا «يتجاوز السعة» مجرَّدة', () => {
  /* الخريطة تحسب البديل حيّاً في المتصفح، لا تقرأ الملخّص المولَّد. فلو بقيت
     تقول «الطلب يتجاوز السعة» وحدها، لظلّ أهمّ ما يعرفه المحرك مكتوماً في
     السطح الذي يفتحه الناس أولاً. */
  const Solution = require(path.join(ROOT, 'masar-worksmap-solution.js'));

  const subjectResult = Routing.alternativesAround(prepared,
    subject.geometry.coordinates,
    { hour: report.referenceHour, count: hood.displaySearchCount });
  const html = Solution.detourHtml(subjectResult);

  assert.ok(html.indexOf('داخل حيّ سكني') !== -1,
    'الخريطة لا تقول إن الحمل يقع داخل حيّ');
  assert.ok(/\d+٪ من سعته بعد التحويل، مقابل \d+٪ قبله/.test(html),
    'قبل/بعد على الشارع السكني غائبان عن الخريطة');
  assert.ok(html.indexOf('works-detour-hood') !== -1, 'السطر بلا صنف يُنسَّق به');

  /* كل بدائل هذا التصريح محمَّلة على الحيّ، فكتلة القرار واجبة. */
  const loaded = (subjectResult.alternatives || []).filter((one) => one && one.load);
  if (loaded.length && loaded.every((one) => one.load.minorOverflows)) {
    assert.ok(html.indexOf('قرارٌ لا مسار') !== -1,
      'كل البدائل محمَّلة على الحيّ والخريطة لا تسمّي المخرَج');
    assert.strictEqual(html.split('قرارٌ لا مسار').length - 1, 1,
      'كتلة القرار مكرَّرة — تُقرأ زينةً ثم تُتجاوز');
  }

  /* والنفي: بديلٌ لا يفيض على حيّ لا يحمل السطر ولا الكتلة. */
  const clean = Solution.detourHtml({
    ok: true, hour: 8, closedEdges: 1, baseline: { minutes: 5 },
    diverted: { vehPerHour: 100, lanesClosed: 1, lanes: 2 },
    alternatives: [{
      lengthM: 1000, minutes: 6, addedMinutesAfterDiversion: 1, streets: [],
      load: { overflows: false, minorOverflows: false, maxRatioAfter: 0.5 },
    }],
  });
  assert.ok(clean.indexOf('داخل حيّ سكني') === -1,
    'السطر يظهر على بديل لا يُحمّل حيّاً');
  assert.ok(clean.indexOf('قرارٌ لا مسار') === -1,
    'كتلة القرار تظهر على بديل مقبول');
});

test('الحدّ معلن مع الرقم — ولا يدّعي قياس أثرٍ على السكان', () => {
  /* الرقم يقول «فوق السعة». ولا يقول ضجيجاً ولا سلامةً ولا سرعةً عند البيوت،
     وهذه هي الأسئلة التي يسألها الساكن فعلاً. إعلان ما لا نقيسه شرط. */
  assert.ok(hood.doesNotProve && hood.doesNotProve.length > 40,
    'قسم الحيّ بلا حدٍّ معلن');
  assert.ok(/لا يقيس أثراً على السكان/.test(hood.doesNotProve),
    'الحدّ لا ينفي قياس الأثر على السكان — والرقم يُقرأ أوسع مما يحمل');
  assert.ok(/سعتها من جدول أصناف الرسم/.test(hood.note),
    'مصدر السعة غير معلن — العتبة تُقرأ اختراعاً');
});

console.log(`ALL TESTS PASSED (${count})`);
