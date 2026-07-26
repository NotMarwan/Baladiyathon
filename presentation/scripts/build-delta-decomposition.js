'use strict';
/**
 * تفكيك دلتا المحفظة — من أين يأتي الرقم الذي يقرؤه المحكّم إنجازاً.
 *
 * التدقيق المستقل أثبت أن «‎89.2٪ خفضاً» صحيح حسابياً ومضلّل بعرضه مفرداً:
 * جُلّه من إزاحة ساعة البدء إلى الليل — وهي نتيجة يبلغها أيُّ مخطِّط يعرف أن
 * الليل أخفّ — لا من الأبعاد التي بُني عليها المُحسِّن. لكن التفكيك كُتب
 * وثيقةً ولم يُترك سكربت، فبقي الرقم **غير قابل لإعادة الإنتاج**.
 *
 * وهذا السكربت يغلق ذلك. كل رقم هنا مشتقّ من المحرك عند التوليد لا منسوخ من
 * نصّ: نسخُ رقمٍ من وثيقة إلى سطح عرض يعيد المشكلة التي وُجد الجرد ليمنعها —
 * رقم بلا سند حيّ يتقادم صامتاً.
 *
 * ثلاثة أرقام هي جوهر المخرَج:
 *
 *   · **حصة إزاحة الساعة** — يُقاس بجدولٍ مضادّ للواقع يغيّر ساعة البدء وحدها
 *     ويثبّت بنية النوافذ كما قدّمها المتقدّم. الفرق بينه وبين الفائز هو كل ما
 *     أضافته بقية أبعاد البحث.
 *   · **مظروف الافتراضين** — الأرضية وأسّ المنحنى، وكلاهما بلا سند مقيس.
 *     يُقاس بتشغيل المحرك نفسه بعد استبدال الثابت، والاستبدال **يُتحقَّق منه**
 *     فيسقط التوليد إن لم يقع، كي لا يُبلَّغ رقمٌ من محرك لم يتغيّر.
 *   · **واقعية الأساس** — حصة التصاريح المقدَّمة ببدء نهاري. الدلتا تقيس رداءة
 *     الأساس بقدر ما تقيس الحل، وإخفاء ذلك يجعل الأساس يُقرأ ممارسةً قائمة.
 *
 * المصدر: `docs/DELTA-89-DECOMPOSITION-2026-07-26.md`.
 *
 * التشغيل: node presentation/scripts/build-delta-decomposition.js
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const ENGINE_PATH = path.join(ROOT, 'athar-engine.js');

const OUT_JSON = path.join(DATA, 'delta-decomposition.json');
const OUT_JS = path.join(DATA, 'delta-decomposition.js');

/* حدّ «النهار» هنا هو ساعات البدء التي لا تقع في النطاق الليلي للمحرك. لا
   يُعاد تعريفه محلياً — يُقرأ من `NIGHT_BAND` كي لا ينفصل تعريفان. */

/**
 * يحمّل نسخة من المحرك بعد استبدال نصّي واحد، ويتحقق من وقوعه.
 *
 * التحقق ليس احتياطاً زائداً: لو تغيّرت صياغة الثابت في المحرك لعاد الاستبدال
 * بلا أثر، ولأنتج السكربت رقمين متطابقين يُقرآن «الافتراض لا يغيّر شيئاً» —
 * وهو أخطر خطأ ممكن هنا، لأنه يبرّئ الافتراض بصمت.
 *
 * @param {string} find النصّ المستبدَل، ويجب أن يرد مرة واحدة بالضبط
 * @param {string} replace بديله
 * @returns {object} المحرك المحمَّل من المصدر المعدَّل
 */
function loadEngineWith(find, replace) {
  const source = fs.readFileSync(ENGINE_PATH, 'utf8');
  const occurrences = source.split(find).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `«${find}» ورد ${occurrences} مرة في athar-engine.js — الاستبدال يحتاج `
      + 'مرة واحدة بالضبط. تغيّرت صياغة الثابت، فصحّح السكربت بدل أن يبلّغ '
      + 'رقماً من محرك لم يتغيّر.');
  }
  const sandbox = { module: { exports: {} }, self: undefined };
  sandbox.exports = sandbox.module.exports;
  vm.createContext(sandbox);
  vm.runInContext(source.replace(find, replace), sandbox,
    { filename: 'athar-engine.js<معدَّل>' });
  return sandbox.module.exports;
}

/**
 * يجمع دلتا المحفظة كاملةً بمحرك معطى — الأساس، الأمثل، والنسبة.
 *
 * يعيد إنتاج حساب `athar-portfolio.js` بالمدخلات نفسها. التطابق مع الرقم
 * الحاكم يُفحص أدناه قبل أي استنتاج: تفكيكٌ لرقمٍ غير الرقم المعروض لا قيمة له.
 *
 * @param {object} Engine
 * @param {Array<object>} permits
 * @returns {{baseline:number, optimized:number, pct:number}}
 */
function portfolioDelta(Engine, permits) {
  let baseline = 0;
  let optimized = 0;
  permits.forEach((permit) => {
    const result = Engine.optimize(inputOf(Engine, permit));
    baseline += result.baseline.delayVehHours;
    optimized += result.top3[0].delayVehHours;
  });
  return {
    baseline,
    optimized,
    pct: baseline > 0 ? (100 * (baseline - optimized)) / baseline : 0,
  };
}

/** مدخلات المحرك لتصريح واحد — مطابقة لما يبنيه `athar-portfolio.js`. */
function inputOf(Engine, permit) {
  return {
    aadt: permit.aadt,
    lanes: permit.lanes,
    lanesClosed: permit.lanesClosed,
    startHour: permit.startHour,
    durationHours: permit.durationHours,
    capacityPerLane: Engine.DEFAULTS.capacityPerLane,
    freeFlowMin: Engine.DEFAULTS.freeFlowMin,
  };
}

/**
 * أقصى ساعات نافذة استعملها الأساس، مشتقّةً من نوافذه لا من ثابت منسوخ.
 *
 * حين تتعدد النوافذ يكون الأقصى هو طول أطولها. وحين تكون واحدة فأي قيمة تبلغ
 * مدة العمل تعيد إنتاج البنية نفسها، فيؤخذ الأكبر منهما. النسخ اليدوي لقيمة
 * `WORK_WINDOW_HOURS` كان سيربط السكربت بثابت غير مُصدَّر يتغيّر بلا إنذار.
 */
function maxNightHoursOf(baselineWindows, durationHours) {
  /* تعدّد النوافذ هو ما يكشف الحدّ: القسمة لا تقع إلا عند بلوغه، فطول أطولها
     هو الحدّ نفسه. ومع نافذة واحدة لم يُبلَغ الحدّ أصلاً، فأي قيمة تبلغ المدة
     تعيد إنتاج البنية ذاتها.

     وأخذ الأكبر من الاثنين في الحالتين خطأ يقلب النتيجة: مع مدة 24 وثلاث
     نوافذ من 8 يعطي 24، فيصير الجدول المضادّ كتلةً متصلة تبتلع الذروة —
     ويظهر أثر إزاحة الساعة سالباً. */
  if (baselineWindows.length > 1) {
    return baselineWindows.reduce(
      (max, window) => Math.max(max, window.durationHours), 0);
  }
  return Math.min(24, durationHours);
}

function main() {
  const Engine = require(ENGINE_PATH);
  global.AtharEngine = Engine;
  const Portfolio = require(path.join(ROOT, 'athar-portfolio.js'));

  const permits = Portfolio.buildPermits(Portfolio.SEED);
  const governing = portfolioDelta(Engine, permits);

  /* التحقق قبل الاستنتاج: الرقم المفكَّك هو الرقم المعروض نفسه. */
  const shipped = Portfolio.buildPortfolio(Portfolio.SEED).totals.savedPct;
  if (Math.abs(governing.pct - shipped) > 1e-9) {
    throw new Error(
      `الدلتا المشتقّة ${governing.pct} تخالف المعروضة ${shipped} — `
      + 'التفكيك يصف رقماً غير الذي يقرؤه المحكّم.');
  }

  // ---- حصة إزاحة الساعة وحدها ----
  let hourOnlyDelay = 0;
  let structureOnlyDelay = 0;
  let permitsWhereHourIsAll = 0;
  const perPermit = [];

  permits.forEach((permit) => {
    const result = Engine.optimize(inputOf(Engine, permit));
    const base = result.baseline.delayVehHours;
    const best = result.top3[0].delayVehHours;
    const maxNight = maxNightHoursOf(result.baseline.windows, permit.durationHours);

    /* بوابة قبل الاستنتاج: الأداة نفسها تعيد إنتاج تأخير الأساس من نوافذ
       الأساس. `score()` لا يقبل نوافذ إطلاقاً — يقرأ `startHour` و
       `durationHours` ويحسب كتلة متصلة — فتمريرها إليه يُجوهَل بصمت ويقيس
       جدولاً غير المقصود. هذه البوابة تكشف ذلك بدل أن يمرّ رقم مضلّل. */
    const reproduced = Engine.evaluateSchedule(
      inputOf(Engine, permit), result.baseline.windows).closureDelayVehHours;
    if (Math.abs(reproduced - base) > 1e-9) {
      throw new Error(
        `تأخير الأساس المُعاد إنتاجه ${reproduced} يخالف ${base} — `
        + 'أداة الجدول المضادّ تقيس غير ما يقيسه المحرك.');
    }

    /* جدولان مضادّان للواقع، لا واحد.
       الإسناد بين عاملين متفاعلين يعتمد على ترتيب تطبيقهما، فرقمٌ واحد
       لـ«حصة الساعة» ادعاءُ دقّةٍ لا يملكها التفكيك. يُقاس الطرفان:

         · الساعة أولاً — ساعة الفائز ببنية نوافذ المتقدّم مثبَّتة.
         · البنية أولاً — بنية نوافذ الفائز بساعة المتقدّم مثبَّتة، وحصة
           الساعة عندئذٍ هي المتبقّي. */
    const hourFirst = Engine.evaluateSchedule(
      inputOf(Engine, permit),
      Engine.buildNightWindows(
        result.top3[0].startHour, permit.durationHours, maxNight),
    ).closureDelayVehHours;

    const winnerMaxNight = maxNightHoursOf(
      result.top3[0].windows, permit.durationHours);
    const structureFirst = Engine.evaluateSchedule(
      inputOf(Engine, permit),
      Engine.buildNightWindows(
        permit.startHour, permit.durationHours, winnerMaxNight),
    ).closureDelayVehHours;

    hourOnlyDelay += hourFirst;
    structureOnlyDelay += structureFirst;
    const totalCut = base - best;
    const hourCut = base - hourFirst;
    if (totalCut > 0 && hourCut / totalCut >= 0.999) permitsWhereHourIsAll += 1;

    perPermit.push({
      baseline: base,
      best,
      savedPct: base > 0 ? (100 * (base - best)) / base : 0,
      startHour: permit.startHour,
    });
  });

  const totalReduction = governing.baseline - governing.optimized;
  const hourReduction = governing.baseline - hourOnlyDelay;
  const structureReduction = governing.baseline - structureOnlyDelay;
  const share = (part) => (totalReduction !== 0 ? (100 * part) / totalReduction : 0);
  const hourFirstPct = share(hourReduction);
  /* حصة الساعة حين تُطبَّق البنية أولاً = المتبقّي بعدها. */
  const hourLastPct = 100 - share(structureReduction);

  // ---- مظروف الافتراضين غير المسنودين ----
  const noFloor = portfolioDelta(
    loadEngineWith('const WORK_ZONE_FRICTION = 1.10;',
      'const WORK_ZONE_FRICTION = 1.00;'),
    permits);
  const linearCurve = portfolioDelta(
    loadEngineWith('Math.pow(ratio, 4)', 'Math.pow(ratio, 1)'),
    permits);

  const bounds = [governing.pct, noFloor.pct, linearCurve.pct];

  // ---- توزيع وتركّز وواقعية الأساس ----
  const savedPcts = perPermit.map((row) => row.savedPct).sort((a, b) => a - b);
  const sortedBaselines = perPermit.map((row) => row.baseline).sort((a, b) => b - a);
  const shareOfTop = (n) => (governing.baseline > 0
    ? (100 * sortedBaselines.slice(0, n).reduce((sum, v) => sum + v, 0)) / governing.baseline
    : 0);

  const night = Engine.NIGHT_BAND;
  if (!Number.isInteger(night.from) || !Number.isInteger(night.to)) {
    throw new Error('NIGHT_BAND ليس {from,to} — تعريف الليل انفصل عن المحرك.');
  }
  /* النطاق يلتفّ حول منتصف الليل (22 ⟶ 6)، فالمقارنة المتصلة تعطي عكس الحكم. */
  const isNightStart = (hour) => (night.from <= night.to
    ? hour >= night.from && hour < night.to
    : hour >= night.from || hour < night.to);
  const daytimeStarts = perPermit.filter((row) => !isNightStart(row.startHour)).length;

  const report = {
    generatedBy: 'presentation/scripts/build-delta-decomposition.js',
    source: 'docs/DELTA-89-DECOMPOSITION-2026-07-26.md',
    portfolio: {
      seed: Portfolio.SEED,
      permits: permits.length,
      mode: 'synthetic',
      note: 'المحفظة مولَّدة ببذرة ثابتة — ليست بيانات رسمية',
    },
    governing: {
      baselineVehHours: governing.baseline,
      optimizedVehHours: governing.optimized,
      deltaPct: governing.pct,
    },
    hourShift: {
      hourFirstPct,
      hourLastPct,
      lowPct: Math.min(hourFirstPct, hourLastPct),
      highPct: Math.max(hourFirstPct, hourLastPct),
      counterfactualVehHours: hourOnlyDelay,
      structureOnlyVehHours: structureOnlyDelay,
      permitsWhereHourExplainsAll: permitsWhereHourIsAll,
      meaning: 'حصة إزاحة ساعة البدء من الخفض. مدى لا نقطة: الإسناد بين '
        + 'عاملين متفاعلين يعتمد على ترتيب تطبيقهما، فالطرفان مقيسان.',
    },
    envelope: {
      lowPct: Math.min(...bounds),
      highPct: Math.max(...bounds),
      withoutFloorPct: noFloor.pct,
      linearCurvePct: linearCurve.pct,
      meaning: 'مدى الدلتا عبر الافتراضين اللذين لا سند مقيساً لهما — '
        + 'أرضية منطقة العمل وأسّ منحنى BPR',
    },
    distribution: {
      medianSavedPct: savedPcts[Math.floor(savedPcts.length / 2)],
      minSavedPct: savedPcts[0],
      maxSavedPct: savedPcts[savedPcts.length - 1],
      permitsBelowHalf: savedPcts.filter((pct) => pct < 50).length,
      permitsNegative: savedPcts.filter((pct) => pct < 0).length,
    },
    concentration: {
      topOneSharePct: shareOfTop(1),
      topFiveSharePct: shareOfTop(5),
      meaning: 'حصة أكبر التصاريح من تأخير الأساس — يفحص إن كان الرقم مسحوباً بشاذّ',
    },
    baselineRealism: {
      daytimeStartPermits: daytimeStarts,
      daytimeStartSharePct: (100 * daytimeStarts) / permits.length,
      nightBand: { from: night.from, to: night.to },
      meaning: 'حصة التصاريح المقدَّمة ببدء نهاري — الدلتا تقيس رداءة الأساس '
        + 'بقدر ما تقيس الحل',
    },
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_JS,
    `window.ATHAR_DELTA_DECOMPOSITION = ${JSON.stringify(report)};\n`, 'utf8');

  console.log(`الدلتا ${report.governing.deltaPct.toFixed(1)}٪ — `
    + `${report.hourShift.lowPct.toFixed(1)}٪ إلى ${report.hourShift.highPct.toFixed(1)}٪ `
    + 'منها من إزاحة الساعة');
  console.log(`المظروف ${report.envelope.lowPct.toFixed(1)}٪ – `
    + `${report.envelope.highPct.toFixed(1)}٪`);
  console.log(OUT_JSON);
  console.log(OUT_JS);
}

main();
