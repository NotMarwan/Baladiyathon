'use strict';
/**
 * هل يتحمّل البديل الحركة المحوَّلة؟ — جواب لكل تصريح.
 * ---------------------------------------------------------------------------
 * **السؤال الذي كان بلا جواب.**
 *
 * بطاقة القرار كانت تعرض التوصية واستقرارها وحجم أثرها، ولا تقول شيئاً عن
 * أهمّ ما يسأله من يقرأ خطة إغلاق: **الطريق الذي سيستقبل الحركة، هل يتحمّلها؟**
 * والفرق ليس تفصيلاً: إغلاقٌ بديلُه فارغ وإغلاقٌ بديلُه مشبَع يعطيان الرقم
 * نفسه في ساعات-المركبة ويعنيان شيئين مختلفين تماماً على الأرض.
 *
 * والجواب كان محسوباً فعلاً — `loadRoute` في محرك التوجيه يحمّل البديل
 * بالحركة المحوَّلة ويعيد `maxRatioAfter` و`overflows` والمقطع المقيِّد —
 * لكنه كان يظهر في خريطة الأعمال وحدها. والمراجع يقرّر من المكتب.
 *
 * **ولماذا يُحسب هنا لا في المتصفح.**
 *
 * رسم التوجيه الكامل يزيد على اثني عشر ميغابايت. تحميله في المكتب لأجل رقمين
 * لكل تصريح يبطئ الصفحة التي تُفتح مئة مرة في اليوم. فيُحسب مرة، ويُقرأ
 * ملخّصاً صغيراً.
 *
 * **وما لا يُثبته.**
 *
 * لا شيء ميدانياً. نسبة الحجم إلى السعة على البديل مشتقّة من النموذج:
 * الحركة المحوَّلة مقدَّرة من حصة المسارات المغلقة، والسعة افتراض معلن،
 * والتوزيع لا يعرف أن السائق قد يلغي رحلته أو يغيّر ساعتها. درجتها
 * `model-derived`، وهي تقول **الاتجاه وحجمه التقريبي** لا القيمة.
 *
 * التشغيل: node presentation/scripts/build-alternate-load.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
global.window = global;

const REFERENCE_HOUR = 8;

/**
 * عمق البحث المعروض، وعمق التدقيق.
 *
 * العرض يبقى على 2 كي لا يتحرّك رقمٌ منشور بلا سبب. والتدقيق يفتح البحث على
 * **كل** أهداف المحرك الخمسة، لأن أوّل ما يُقال لهذا التصنيف: «بحثك ضيّق،
 * وسّعه تجد بديلاً يجنّب الحيّ». فيُقاس الادعاء بدل مناقشته.
 */
const DISPLAY_COUNT = 2;
const AUDIT_COUNT = 5;

const OUT_JSON = path.join(DATA, 'alternate-load.json');
const OUT_JS = path.join(DATA, 'alternate-load.js');

/**
 * يترجم نسبة الحجم إلى السعة إلى حكمٍ يقرؤه غير المتخصص.
 *
 * العتبات ليست اكتشافاً — هي اصطلاح هندسي معتاد، ومكتوبة هنا كي تُراجَع:
 * دون 0.85 يسير المرور، وبين 0.85 و1.0 يقترب من طاقته، وفوق 1.0 يزيد الطلب
 * على ما يمرّ فيتكوّن طابور.
 */
function verdictOf(ratio) {
  if (!Number.isFinite(ratio)) {
    return { key: 'unknown', label: 'غير محسوب', plain: 'لم يُحسب بديل لهذا العمل.' };
  }
  if (ratio > 1) {
    return {
      key: 'overflows',
      label: 'لا يتحمّل',
      plain: 'الطلب على البديل يتجاوز طاقته — يتكوّن طابور، والتأخير ينتقل '
        + 'إلى الطريق البديل بدل أن يختفي.',
    };
  }
  if (ratio >= 0.85) {
    return {
      key: 'near-capacity',
      label: 'يقترب من طاقته',
      plain: 'البديل يستوعب الحركة بلا هامش يُذكر — أي حادث أو عمل ثانٍ '
        + 'عليه يقلبه إلى ازدحام.',
    };
  }
  return {
    key: 'carries',
    label: 'يتحمّل',
    plain: 'البديل يستوعب الحركة المحوَّلة ويبقى دون طاقته.',
  };
}

/**
 * أين وقع الحمل — على طريقٍ بُني ليحمل، أم أمام البيوت؟
 * ---------------------------------------------------------------------------
 * **السؤال الذي طرحه ساكن.** «الطريق العام مغلق، فصار الزحام عند بيتي.»
 * وهذا سؤالٌ لم يكن للنظام جوابٌ عنه: `overflows` يقول إن طابوراً يتكوّن،
 * ولا يقول أين. والفرق ليس تفصيلاً — طابورٌ على شريان كلفةٌ على من اختار
 * الطريق، وطابورٌ في حيٍّ كلفةٌ على من لم يختر شيئاً.
 *
 * **ولماذا الحيّ مرشَّحٌ أصلاً.** ليس خطأً في التوجيه: الهدف `local` يوجّه
 * عمداً إلى جوار العمل لأن السائق يفعل ذلك — قيس فبلغ وسيط الالتفاف الشرياني
 * 2.81 ضعف فجوة الإغلاق. **فالنموذج يتنبّأ بما سيحدث، لا يوصي بما ينبغي.**
 * وهذا التصنيف هو الفرق بين الاثنين: مسارٌ يتنبّأ به النموذج ليس بالضرورة
 * مساراً تُبنى عليه خطة.
 *
 * **والعتبة ليست جديدة.** 1.0 نفسها التي يستعملها `verdictOf`، مقصورةً على
 * أصناف الشوارع السكنية. الشارع السكني في جدول الأصناف حارةٌ واحدة بسعة 600
 * مركبة/ساعة؛ وتجاوز السعة تجاوزٌ سواء كان الطريق شرياناً أو أمام بيت.
 */
function neighbourhoodOf(load) {
  if (!load || !(load.minorEdges > 0)) {
    return {
      key: 'none',
      label: 'لا يدخل حيّاً',
      plain: 'البديل لا يمرّ بشارع سكني — الحمل يبقى على شبكةٍ بُنيت له.',
    };
  }
  if (load.minorOverflows) {
    return {
      key: 'overloaded',
      label: 'يُحمَّل على الحيّ فوق سعته',
      plain: 'البديل يدفع شارعاً سكنياً فوق سعته المعلنة — الطابور يتكوّن '
        + 'أمام البيوت لا على طريقٍ بُني ليحمله.',
    };
  }
  return {
    key: 'within',
    label: 'يدخل حيّاً ضمن سعته',
    plain: 'البديل يمرّ بشوارع سكنية وتبقى كلها دون سعتها المعلنة.',
  };
}

/**
 * أفضل بديل عند عمق بحثٍ معطى، مع سؤال: هل **أيٌّ** من البدائل يجنّب الحيّ؟
 *
 * سؤال «أيٌّ منها» لا يُجاب من أفضلها: أفضل بديل يُختار بأدنى نسبة على البديل
 * كلّه، وقد يكون غيرُه أسوأ إجمالاً وأرفق بالحيّ. فيُفحص كلّ ما أعاده المحرك.
 */
function searchAt(Routing, prepared, coordinates, count) {
  var result;
  try {
    result = Routing.alternativesAround(prepared, coordinates,
      { hour: REFERENCE_HOUR, count: count });
  } catch (error) {
    return { reason: 'خطأ توجيه: ' + error.message };
  }
  if (!result || !result.ok) {
    return { reason: 'لا بديل محسوب: ' + ((result && result.reason) || 'غير معروف') };
  }
  const loaded = (result.alternatives || []).filter((one) => one && one.load);
  if (!loaded.length) return { reason: 'بديل بلا تحميل محسوب' };
  return {
    result: result,
    alternatives: loaded,
    best: loaded.slice().sort((a, b) => a.load.maxRatioAfter - b.load.maxRatioAfter)[0],
    /* «يجنّب الحيّ» يشمل حالين: لا يدخله أصلاً، أو يدخله ويبقى دون سعته. */
    spares: loaded.some((one) => !one.load.minorOverflows),
  };
}

function main() {
  require(path.join(DATA, 'riyadh-route-graph.js'));
  const Routing = require(path.join(ROOT, 'masar-city-routing.js'));
  const graph = global.RIYADH_ROUTE_GRAPH;
  if (!graph) throw new Error('رسم التوجيه غير محمَّل');

  const prepared = Routing.prepare(graph);
  const portfolio = JSON.parse(fs.readFileSync(
    path.join(DATA, 'city-portfolio.geojson'), 'utf8'));

  const byPermit = {};
  const tally = { carries: 0, 'near-capacity': 0, overflows: 0, unknown: 0 };
  const hood = { none: 0, within: 0, overloaded: 0, unknown: 0 };
  /* التصاريح التي وسّع لها البحث فوجد بديلاً يجنّب الحيّ ولم يجده العرض.
     صفرٌ هنا يعني أن الحكم ليس أثراً لضيق البحث. */
  let widerSearchRescued = 0;
  let noAcceptableAlternative = 0;
  const minorAfterRatios = [];
  const minorBeforeRatios = [];

  /* سعة الشارع السكني من جدول أصناف الرسم لا من هنا. الرقم يُنشر في العرض،
     وكتابته يدوياً تجعله يتقادم صامتاً إن تغيّر الجدول. */
  let minorCapacity = 0;
  Object.keys(prepared.classes || {}).forEach((key) => {
    const profile = prepared.classes[key];
    if (profile && profile.name === 'residential') {
      minorCapacity = profile.lanes * profile.capacity;
    }
  });
  if (!(minorCapacity > 0)) {
    throw new Error('صنف residential غير موجود في جدول الأصناف — '
      + 'سعة الشارع السكني بلا مصدر، ولا تُكتب يدوياً');
  }

  for (const feature of portfolio.features) {
    const ref = feature.properties.permitRef;
    /* التصاريح النقطية بلا خطّ لا يُحسب لها بديل. تُسجَّل `unknown` بسببها
       بدل أن تُسقط من العدّ — الإسقاط يجعل النسب تُقرأ على محفظة أصغر. */
    if (!feature.geometry || feature.geometry.type !== 'LineString') {
      byPermit[ref] = {
        verdict: verdictOf(NaN),
        neighbourhood: { key: 'unknown', label: 'غير محسوب', plain: 'لم يُحسب بديل لهذا العمل.' },
        reason: 'هندسة نقطية — لا خطّ يُحوَّل حوله',
      };
      tally.unknown += 1;
      hood.unknown += 1;
      continue;
    }

    const shown = searchAt(Routing, prepared, feature.geometry.coordinates, DISPLAY_COUNT);
    if (!shown.best) {
      byPermit[ref] = {
        verdict: verdictOf(NaN),
        neighbourhood: { key: 'unknown', label: 'غير محسوب', plain: 'لم يُحسب بديل لهذا العمل.' },
        reason: shown.reason,
      };
      tally.unknown += 1;
      hood.unknown += 1;
      continue;
    }

    const load = shown.best.load;
    const verdict = verdictOf(load.maxRatioAfter);
    const neighbourhood = neighbourhoodOf(load);

    /* التدقيق يُشغَّل حيث يُفيد وحده: إن كان أحد البدائل المعروضة يجنّب الحيّ
       فالسؤال محسوم، وتوسيع البحث كلفةٌ بلا جواب جديد. */
    const spared = shown.spares
      || searchAt(Routing, prepared, feature.geometry.coordinates, AUDIT_COUNT).spares === true;
    if (!shown.spares && spared) widerSearchRescued += 1;
    if (!spared) noAcceptableAlternative += 1;
    if (load.minorEdges > 0) {
      minorAfterRatios.push(load.minorMaxRatioAfter);
      minorBeforeRatios.push(load.minorMaxRatioBefore);
    }

    byPermit[ref] = {
      verdict: verdict,
      /* قبل/بعد معاً: «١٫٩» وحدها لا تقول إن الطريق كان مزدحماً أصلاً أم أن
         الإغلاق هو ما أغرقه. والفرق يحدّد هل الحلّ نافذة أخرى أم طريق آخر. */
      ratioBefore: Math.round(load.maxRatioBefore * 100) / 100,
      ratioAfter: Math.round(load.maxRatioAfter * 100) / 100,
      divertedVehPerHour: Math.round(load.divertedVehPerHour),
      bindingStreet: load.bindingStreet || '',
      alternativesFound: shown.alternatives.length,
      neighbourhood: {
        key: neighbourhood.key,
        label: neighbourhood.label,
        plain: neighbourhood.plain,
        minorEdges: load.minorEdges,
        ratioBefore: Math.round(load.minorMaxRatioBefore * 100) / 100,
        ratioAfter: Math.round(load.minorMaxRatioAfter * 100) / 100,
        bindingStreet: load.minorBindingStreet || '',
        /* هل جنّب الحيَّ **أيُّ** بديل، بعد فتح البحث على كل الأهداف؟
           «لا» تعني أن الإغلاق بلا بديل مقبول — وهو قرارٌ آخر لا مسارٌ آخر. */
        sparedByAnyAlternative: spared,
        rescuedByWiderSearch: !shown.spares && spared,
      },
      reason: '',
    };
    tally[verdict.key] += 1;
    hood[neighbourhood.key] += 1;
  }

  const mid = (list) => (list.length
    ? list.slice().sort((a, b) => a - b)[Math.floor(list.length / 2)] : 0);
  const round = (value) => Math.round(value * 100) / 100;
  /* الوسيط لا المتوسط: أقصى حالة تبلغ ستة أضعاف السعة، والمتوسط يجرّه فرد
     فيُقرأ كأنه الحال المعتاد. */
  const median = mid(minorAfterRatios);
  const medianBefore = mid(minorBeforeRatios);
  const worst = minorAfterRatios.reduce((max, one) => (one > max ? one : max), 0);

  const report = {
    generatedFrom: 'presentation/scripts/build-alternate-load.js',
    referenceHour: REFERENCE_HOUR,
    grade: 'model-derived',
    note: 'نسبة الحجم إلى السعة على أفضل بديل، بعد تحميله بالحركة المحوَّلة '
      + 'من المسارات المغلقة، عند ساعة مرجعية واحدة.',
    doesNotProve: 'لا قياس ميداني. الحركة المحوَّلة مقدَّرة من حصة المسارات '
      + 'المغلقة، والسعة افتراض معلن، والنموذج لا يعرف أن السائق قد يلغي '
      + 'رحلته أو يغيّر ساعتها. الرقم يقول الاتجاه وحجمه التقريبي لا القيمة.',
    total: portfolio.features.length,
    tally: tally,
    neighbourhood: {
      note: 'أين يقع الحمل: على شبكةٍ بُنيت له، أم على شوارع يسكنها الناس. '
        + 'العتبة 1.0 نفسها، مقصورةً على أصناف residential وliving_street '
        + 'وunclassified، وسعتها من جدول أصناف الرسم.',
      doesNotProve: 'التصنيف يفصّل حكم البديل ولا ينقضه: كل تحميلٍ سكني فوق '
        + 'السعة يرفع النسبة الكلية فوق الواحد بالضرورة. ولا يقيس أثراً على '
        + 'السكان — لا ضجيج ولا سلامة ولا سرعة، فهذه لا تملك الشبكة بياناً عنها.',
      displaySearchCount: DISPLAY_COUNT,
      auditSearchCount: AUDIT_COUNT,
      tally: hood,
      /* قبل وبعد معاً — وهو جوهر شكوى الساكن: الشارع لم يكن مزدحماً، الإغلاق
         هو ما أزدحمه. رقمُ «بعد» وحده يُقرأ كأن الحيّ كان مزدحماً أصلاً. */
      medianMinorRatioBefore: round(medianBefore),
      medianMinorRatioAfter: round(median),
      worstMinorRatioAfter: round(worst),
      minorCapacityVehPerHour: minorCapacity,
      /* الرقم الحاكم: تصاريحُ لا يجنّب الحيَّ فيها أيُّ بديل، حتى بعد فتح
         البحث على أهداف المحرك الخمسة كلها. */
      noAcceptableAlternative: noAcceptableAlternative,
      widerSearchRescued: widerSearchRescued,
    },
    permits: byPermit,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_JS, `window.MASAR_ALTERNATE_LOAD = ${JSON.stringify(report)};\n`, 'utf8');

  console.log(`${report.total} تصريحاً — البديل:`);
  console.log(`  يتحمّل: ${tally.carries}`);
  console.log(`  يقترب من طاقته: ${tally['near-capacity']}`);
  console.log(`  لا يتحمّل: ${tally.overflows}`);
  console.log(`  غير محسوب: ${tally.unknown}`);
  console.log('\nأين يقع الحمل:');
  console.log(`  لا يدخل حيّاً: ${hood.none}`);
  console.log(`  يدخل ضمن السعة: ${hood.within}`);
  console.log(`  فوق سعة الحيّ: ${hood.overloaded}`);
  console.log(`  وسيط نسبة الحيّ: ${report.neighbourhood.medianMinorRatioBefore}`
    + ` قبل التحويل، ${report.neighbourhood.medianMinorRatioAfter} بعده`);
  console.log(`  أسوأ حالة: ${report.neighbourhood.worstMinorRatioAfter}`);
  console.log(`  سعة الشارع السكني: ${minorCapacity} مركبة/ساعة`);
  console.log(`  بلا بديل مقبول (بعد بحثٍ بعمق ${AUDIT_COUNT}): ${noAcceptableAlternative}`);
  console.log(`  أنقذه توسيع البحث: ${widerSearchRescued}`);
  console.log(`\n${OUT_JSON}`);
}

main();
