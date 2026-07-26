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

  for (const feature of portfolio.features) {
    const ref = feature.properties.permitRef;
    /* التصاريح النقطية بلا خطّ لا يُحسب لها بديل. تُسجَّل `unknown` بسببها
       بدل أن تُسقط من العدّ — الإسقاط يجعل النسب تُقرأ على محفظة أصغر. */
    if (!feature.geometry || feature.geometry.type !== 'LineString') {
      byPermit[ref] = { verdict: verdictOf(NaN), reason: 'هندسة نقطية — لا خطّ يُحوَّل حوله' };
      tally.unknown += 1;
      continue;
    }

    let result = null;
    let reason = '';
    try {
      result = Routing.alternativesAround(prepared, feature.geometry.coordinates,
        { hour: REFERENCE_HOUR, count: 2 });
    } catch (error) {
      reason = 'خطأ توجيه: ' + error.message;
    }
    if (!reason && (!result || !result.ok)) {
      reason = 'لا بديل محسوب: ' + ((result && result.reason) || 'غير معروف');
    }

    const best = !reason && (result.alternatives || [])
      .filter((one) => one && one.load)
      .sort((a, b) => a.load.maxRatioAfter - b.load.maxRatioAfter)[0];

    if (!best) {
      byPermit[ref] = { verdict: verdictOf(NaN), reason: reason || 'بديل بلا تحميل محسوب' };
      tally.unknown += 1;
      continue;
    }

    const load = best.load;
    const verdict = verdictOf(load.maxRatioAfter);
    byPermit[ref] = {
      verdict: verdict,
      /* قبل/بعد معاً: «١٫٩» وحدها لا تقول إن الطريق كان مزدحماً أصلاً أم أن
         الإغلاق هو ما أغرقه. والفرق يحدّد هل الحلّ نافذة أخرى أم طريق آخر. */
      ratioBefore: Math.round(load.maxRatioBefore * 100) / 100,
      ratioAfter: Math.round(load.maxRatioAfter * 100) / 100,
      divertedVehPerHour: Math.round(load.divertedVehPerHour),
      bindingStreet: load.bindingStreet || '',
      alternativesFound: (result.alternatives || []).length,
      reason: '',
    };
    tally[verdict.key] += 1;
  }

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
    permits: byPermit,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_JS, `window.MASAR_ALTERNATE_LOAD = ${JSON.stringify(report)};\n`, 'utf8');

  console.log(`${report.total} تصريحاً — البديل:`);
  console.log(`  يتحمّل: ${tally.carries}`);
  console.log(`  يقترب من طاقته: ${tally['near-capacity']}`);
  console.log(`  لا يتحمّل: ${tally.overflows}`);
  console.log(`  غير محسوب: ${tally.unknown}`);
  console.log(`\n${OUT_JSON}`);
}

main();
