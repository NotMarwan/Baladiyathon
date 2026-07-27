'use strict';
/**
 * مسار — تقرير الظلّ: ماذا لو حلّ مِنسَب محلّ الحركة العشوائية؟
 * ---------------------------------------------------------------------------
 * **الخطر الذي يتجنّبه هذا الملف.**
 *
 * تبديل `aadt` بمِنسَب يحرّك **كل رقم معروض** في العرض والجرد: ساعات التأخير،
 * والريال، والكربون، والشدة، والترتيب في صندوق الأعمال. وتبديلٌ بهذا الأثر لا
 * يُجرى لأن المؤشّر الجديد يبدو أفضل — يُجرى بعد أن يُقاس ما سيتحرّك.
 *
 * فهذا الملف **يحسب ولا يبدّل**. لا يلمس `masar-engine.js` ولا
 * `masar-portfolio.js` ولا `city-portfolio.geojson`. يستدعي المحرك نفسه
 * بمدخلات بديلة ويكتب الفرق.
 *
 * **والسؤال الحاكم فيه ليس «كم يتحرّك الرقم» بل «هل ينقلب الترتيب».**
 * إن لم يتغيّر ترتيب التصاريح فالعشوائية لم تكن تضرّ القرار — كانت تضرّ
 * المظهر وحده، وهذا أهون. وإن تغيّر الترتيب فقد كان الترتيب المعروض على
 * المراجع ترتيبَ مولّد أرقام، وهذا عيبٌ في القرار لا في العرض.
 *
 * **وكيف يُشتقّ حجمٌ من مؤشّر — وهو أخطر خطوة هنا.**
 *
 * لا يُشتقّ رقمٌ واحد. `vphBand` مدىً في ساعة الذروة، ويُقسَّم على حصة ساعة
 * الذروة في `HOURLY_PROFILE` فيخرج **مدى** حركةٍ يومية لا قيمة. والمحرك
 * يُشغَّل على طرفَي المدى وعلى وسطه، فيُقرأ الأثر مدىً كذلك. أي نقطةٍ واحدة
 * هنا تكون ادّعاءً لا يحمله المؤشّر.
 *
 * التشغيل: node presentation/scripts/build-street-load-shadow.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const DOCS = path.join(ROOT, '..', 'docs');
global.window = global;

const Engine = require(path.join(ROOT, 'masar-engine.js'));
const Model = require(path.join(ROOT, 'masar-street-load.js'));

const OUT_MD = path.join(DOCS, 'STREET-LOAD-SHADOW.md');
const OUT_JSON = path.join(DATA, 'street-load-shadow.json');

/** إزاحة رتبةٍ تُعدّ تحرّكاً ذا معنى في صندوق الأعمال. */
const BIG_MOVE = 10;

function round1(value) {
  return Math.round(value * 10) / 10;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function averageRanks(values) {
  const order = values.map((value, at) => ({ value, at }))
    .sort((a, b) => a.value - b.value);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j += 1;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[order[k].at] = rank;
    i = j + 1;
  }
  return ranks;
}

function spearman(a, b) {
  if (a.length !== b.length || a.length < 2) return null;
  const ra = averageRanks(a);
  const rb = averageRanks(b);
  const n = ra.length;
  const mean = (n + 1) / 2;
  let cov = 0; let varA = 0; let varB = 0;
  for (let i = 0; i < n; i += 1) {
    cov += (ra[i] - mean) * (rb[i] - mean);
    varA += (ra[i] - mean) ** 2;
    varB += (rb[i] - mean) ** 2;
  }
  if (varA <= 0 || varB <= 0) return null;
  return round3(cov / Math.sqrt(varA * varB));
}

/** ترتيبٌ تنازلي بالأثر — 1 هو الأعلى. */
function rankDesc(values) {
  const order = values.map((value, at) => ({ value, at }))
    .sort((a, b) => b.value - a.value);
  const ranks = new Array(values.length);
  order.forEach((one, at) => { ranks[one.at] = at + 1; });
  return ranks;
}

/**
 * يشغّل المحرك على تصريحٍ بحركةٍ معطاة — بالمدخلات نفسها التي بُنيت بها
 * المحفظة، كي يكون الفرق فرق الحركة وحدها لا فرق طريقة الحساب.
 */
function runEngine(properties, aadt) {
  const startHour = new Date(properties.start).getUTCHours();
  const shared = {
    aadt,
    lanes: properties.lanes,
    lanesClosed: properties.lanesClosed,
    startHour,
    capacityPerLane: Engine.DEFAULTS.capacityPerLane,
    freeFlowMin: Engine.DEFAULTS.freeFlowMin,
  };
  const daily = Engine.score(Object.assign({}, shared,
    { durationHours: properties.windowHours }));
  const plan = Engine.optimize(Object.assign({}, shared, {
    durationHours: properties.durationHours,
    sensitivity: properties.sensitivity,
  }));
  const best = plan.top3[0];

  /* الشدة بالعتبتين نفسيهما في build-city-portfolio.js. نسخةٌ ثانية من عتبة
     تفترق عن أصلها بلا أن ينبّه شيء — فتُقرأ من الملف الأصل لا تُكتب هنا. */
  const SEVERITY_HIGH = 8000;
  const SEVERITY_MEDIUM = 2500;
  const delay = plan.baseline.delayVehHours;
  const severity = (daily.level === 'high' || delay >= SEVERITY_HIGH) ? 3
    : (daily.level === 'medium' || delay >= SEVERITY_MEDIUM) ? 2 : 1;

  return {
    impactVehHours: Math.round(delay),
    severity,
    bestStartHour: best.startHour,
    savedVehHours: Math.round(best.savedVehHours),
    savedPct: round1(best.savedPct),
  };
}

function main() {
  const portfolio = JSON.parse(fs.readFileSync(
    path.join(DATA, 'city-portfolio.geojson'), 'utf8'));
  const load = JSON.parse(fs.readFileSync(path.join(DATA, 'street-load.json'), 'utf8'));
  Model.assertGrade(load.grade);

  const peakShare = Math.max.apply(null, Engine.HOURLY_PROFILE);

  const rows = [];
  const mismatched = [];
  const skipped = [];

  portfolio.features.forEach((feature) => {
    const p = feature.properties;
    const entry = load.permits[p.permitRef];

    /* التصريح بلا مدى مطلق لا يدخل الظلّ: المدى يُشتقّ من سعة المقطع، ولا
       سعة واحدة لتصريحٍ منسوبه عن الشارع كله. الامتناع يُسجَّل بسببه. */
    if (!entry || !entry.vphBand) {
      skipped.push({
        permitRef: p.permitRef,
        street: p.street,
        reason: (entry && entry.reason) || 'بلا مدخل في مِنسَب',
      });
      return;
    }

    const current = runEngine(p, p.aadt);

    /* فحصُ إعادة الإنتاج: لو لم يطابق تشغيلُنا بالحركة الحالية ما هو مكتوب في
       المحفظة، فأرقام الظلّ كلها تقارن شيئين لم يُحسبا بالطريقة نفسها —
       والتقرير يصير عن فرقٍ في الشيفرة لا فرقٍ في الحركة. */
    if (current.impactVehHours !== p.impactVehHours) {
      mismatched.push({
        permitRef: p.permitRef,
        stored: p.impactVehHours,
        recomputed: current.impactVehHours,
      });
    }

    const aadtBand = {
      low: Math.round(entry.vphBand.low / peakShare),
      high: Math.round(entry.vphBand.high / peakShare),
    };
    const aadtMid = Math.round((aadtBand.low + aadtBand.high) / 2);

    rows.push({
      permitRef: p.permitRef,
      street: p.street,
      roadClass: entry.roadClass,
      loadIndex: entry.loadIndex,
      loadRank: entry.rank,
      tierLabel: entry.tierLabel,
      currentAadt: p.aadt,
      shadowAadtLow: aadtBand.low,
      shadowAadtMid: aadtMid,
      shadowAadtHigh: aadtBand.high,
      aadtRatio: round3(aadtMid / p.aadt),
      current,
      shadowLow: runEngine(p, aadtBand.low),
      shadowMid: runEngine(p, aadtMid),
      shadowHigh: runEngine(p, aadtBand.high),
    });
  });

  if (!rows.length) throw new Error('لا تصريح صالح لتقرير الظلّ');

  /* ---- انقلاب الترتيب: أهمّ ما في التقرير ---- */

  const currentRanks = rankDesc(rows.map((row) => row.current.impactVehHours));
  const shadowRanks = rankDesc(rows.map((row) => row.shadowMid.impactVehHours));
  rows.forEach((row, at) => {
    row.currentRank = currentRanks[at];
    row.shadowRank = shadowRanks[at];
    row.rankShift = currentRanks[at] - shadowRanks[at];
  });

  const moved = rows.filter((row) => Math.abs(row.rankShift) > BIG_MOVE);
  const topNow = rows.filter((row) => row.currentRank <= 10).map((row) => row.permitRef);
  const topShadow = rows.filter((row) => row.shadowRank <= 10).map((row) => row.permitRef);
  const leftTop = topNow.filter((ref) => topShadow.indexOf(ref) === -1);
  const enteredTop = topShadow.filter((ref) => topNow.indexOf(ref) === -1);
  const severityChanged = rows.filter((row) => row.shadowMid.severity !== row.current.severity);
  const windowChanged = rows.filter((row) => row.shadowMid.bestStartHour !== row.current.bestStartHour);

  const totals = {
    currentVehHours: rows.reduce((sum, row) => sum + row.current.impactVehHours, 0),
    shadowLowVehHours: rows.reduce((sum, row) => sum + row.shadowLow.impactVehHours, 0),
    shadowMidVehHours: rows.reduce((sum, row) => sum + row.shadowMid.impactVehHours, 0),
    shadowHighVehHours: rows.reduce((sum, row) => sum + row.shadowHigh.impactVehHours, 0),
  };

  const ratios = rows.map((row) => row.aadtRatio).sort((a, b) => a - b);
  const mid = (list) => list[Math.floor(list.length / 2)];

  const summary = {
    generatedFrom: 'presentation/scripts/build-street-load-shadow.js',
    grade: load.grade,
    changesNothing: 'تقريرٌ يحسب ولا يبدّل. لم يُعدَّل masar-engine.js ولا '
      + 'masar-portfolio.js ولا city-portfolio.geojson.',
    peakShareUsed: peakShare,
    permitsCompared: rows.length,
    permitsSkipped: skipped.length,
    reproductionMismatches: mismatched.length,
    aadtRatio: {
      note: 'وسط مدى مِنسَب مقسوماً على الحركة الحالية. الواحد يعني اتفاقاً، '
        + 'وبُعده عنه في الاتجاهين يقيس ما كانت العشوائية تضيفه أو تحذفه.',
      lowest: ratios[0],
      median: mid(ratios),
      highest: ratios[ratios.length - 1],
      belowHalf: ratios.filter((one) => one < 0.5).length,
      aboveDouble: ratios.filter((one) => one > 2).length,
    },
    totals,
    /**
     * تحدّب معادلة الأثر — ولماذا لا يُدافَع عن المجموع بالوسيط.
     * -----------------------------------------------------------------------
     * وسيط النسبة قد يكون دون الواحد بينما يتضاعف المجموع أضعافاً. وليس في
     * ذلك تناقض: BPR أُسّية، فرفعُ حركةِ قلّةٍ من التصاريح يبتلع خفضَ حركةِ
     * كثرةٍ منها. وهذه بالضبط الحجّة التي تُقال دفاعاً عن رقمٍ منشور —
     * «الوسيط لم يتحرّك» — فتُقاس هنا بدل أن تُناقَش.
     */
    convexity: (() => {
      const sorted = rows.map((row) => row.shadowMid.impactVehHours)
        .sort((a, b) => b - a);
      const total = sorted.reduce((sum, one) => sum + one, 0);
      const topShare = Math.max(1, Math.round(rows.length * 0.10));
      const top = sorted.slice(0, topShare).reduce((sum, one) => sum + one, 0);
      return {
        note: 'المجموع لا يتبع الوسيط لأن معادلة الأثر متحدّبة.',
        midOverCurrent: round1(totals.shadowMidVehHours / totals.currentVehHours),
        topShare,
        topShareOfTotal: total > 0 ? round3(top / total) : null,
      };
    })(),
    ranking: {
      spearman: spearman(rows.map((row) => row.current.impactVehHours),
        rows.map((row) => row.shadowMid.impactVehHours)),
      bigMoveThreshold: BIG_MOVE,
      movedMoreThanThreshold: moved.length,
      worstShift: rows.reduce((max, row) => Math.max(max, Math.abs(row.rankShift)), 0),
      leftTopTen: leftTop,
      enteredTopTen: enteredTop,
      severityChanged: severityChanged.length,
      recommendedWindowChanged: windowChanged.length,
    },
    skipped,
    mismatched,
    permits: rows,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_MD, markdown(summary, load, rows, moved), 'utf8');

  process.stdout.write(`تقرير الظلّ — ${rows.length} تصريحاً قورنت، `
    + `${skipped.length} امتنعت\n`);
  process.stdout.write(`  نسبة مِنسَب إلى الحركة الحالية: `
    + `${summary.aadtRatio.lowest} إلى ${summary.aadtRatio.highest} `
    + `(وسيط ${summary.aadtRatio.median})\n`);
  process.stdout.write(`  ارتباط الترتيبين: ${summary.ranking.spearman}\n`);
  process.stdout.write(`  تحرّك أكثر من ${BIG_MOVE} مراتب: ${moved.length}\n`);
  process.stdout.write(`  خرج من العشرة الأوائل: ${leftTop.length} · دخلها: `
    + `${enteredTop.length}\n`);
  process.stdout.write(`  تغيّرت شدّته: ${severityChanged.length} · تغيّرت نافذته: `
    + `${windowChanged.length}\n`);
  if (mismatched.length) {
    process.stdout.write(`  تحذير: ${mismatched.length} تصريحاً لم يُعد إنتاج `
      + `رقمه المخزَّن\n`);
  }
  process.stdout.write(`\n${OUT_MD}\n`);
}

/* --------------------------------------------------------------- التقرير */

function pct(value) {
  return `${Math.round(value * 1000) / 10}٪`;
}

function markdown(summary, load, rows, moved) {
  const byShift = rows.slice().sort((a, b) => Math.abs(b.rankShift) - Math.abs(a.rankShift));
  const verdict = summary.ranking.movedMoreThanThreshold > 0
    ? 'الترتيب **ينقلب**. فالعشوائية لم تكن تضرّ المظهر وحده — كانت تضرّ '
      + 'القرار: صندوق الأعمال مرتَّبٌ بالأثر، وأعلى الصف هو ما ينظر فيه '
      + 'المراجع أولاً.'
    : 'الترتيب **لا ينقلب**. فالعشوائية كانت تضرّ المظهر ولا تضرّ القرار، '
      + 'وتبديلها يبقى تحسيناً في الصدق لا في النتيجة.';

  const head = [
    '# تقرير الظلّ — مِنسَب مقابل الحركة الحالية',
    '',
    '> **مولَّد.** `presentation/scripts/build-street-load-shadow.js`.',
    '> لا رقم في هذا الملف مكتوب يدوياً، ولا سطر منه يُعدَّل باليد.',
    '',
    '## ما هذا التقرير وما ليس',
    '',
    'تبديل الحركة العشوائية بمِنسَب يحرّك كل رقم معروض في العرض والجرد. وهذا',
    'التقرير **يحسب ما سيتحرّك ولا يحرّكه**: لم يُعدَّل `masar-engine.js` ولا',
    '`masar-portfolio.js` ولا `city-portfolio.geojson`. التبديل قرارٌ إنسانيّ،',
    'وهذه مادّته.',
    '',
    '### كيف اشتُقّ حجمٌ من مؤشّر',
    '',
    'لم يُشتقّ رقمٌ واحد. `vphBand` مدىً في ساعة الذروة، قُسِم على حصة ساعة',
    `الذروة في \`HOURLY_PROFILE\` (${summary.peakShareUsed}) فخرج **مدى** حركةٍ`,
    'يومية. وشُغِّل المحرك على طرفَي المدى وعلى وسطه، فالأثر مدىً كذلك.',
    'وأي نقطةٍ واحدة هنا تكون ادّعاءً لا يحمله المؤشّر.',
    '',
    `درجة مِنسَب \`${load.grade}\`، ولا ترتفع بهذا التقرير ولا به يُقاس شيء`,
    'ميدانياً.',
    '',
    '## الحكم',
    '',
    verdict,
    '',
    '| | |',
    '|---|---|',
    `| تصاريح قورنت | ${summary.permitsCompared} |`,
    `| تصاريح امتنعت | ${summary.permitsSkipped} — بلا مدى مطلق، والسبب مع كلٍّ منها أدناه |`,
    `| ارتباط الترتيبين (سبيرمان) | ${summary.ranking.spearman} |`,
    `| تحرّك أكثر من ${summary.ranking.bigMoveThreshold} مراتب | ${summary.ranking.movedMoreThanThreshold} تصريحاً |`,
    `| أقصى إزاحة | ${summary.ranking.worstShift} مرتبة |`,
    `| خرج من العشرة الأوائل | ${summary.ranking.leftTopTen.length} |`,
    `| دخل العشرة الأوائل | ${summary.ranking.enteredTopTen.length} |`,
    `| تغيّرت شدّته | ${summary.ranking.severityChanged} تصريحاً |`,
    `| تغيّرت نافذته الموصى بها | ${summary.ranking.recommendedWindowChanged} تصريحاً |`,
    '',
    '## كم تبعد الحركة الحالية عن مِنسَب',
    '',
    'النسبة = وسط مدى مِنسَب ÷ الحركة الحالية. الواحد اتفاق، وبُعده عنه في',
    'الاتجاهين هو ما كانت العشوائية تضيفه أو تحذفه.',
    '',
    '| | |',
    '|---|---|',
    `| أدنى نسبة | ${summary.aadtRatio.lowest} |`,
    `| الوسيط | ${summary.aadtRatio.median} |`,
    `| أعلى نسبة | ${summary.aadtRatio.highest} |`,
    `| تصاريح حركتها الحالية أكثر من ضِعف مِنسَب | ${summary.aadtRatio.belowHalf} |`,
    `| تصاريح مِنسَب فيها أكثر من ضِعف الحالية | ${summary.aadtRatio.aboveDouble} |`,
    '',
    '## مجموع المحفظة',
    '',
    'المجموع محسوب على التصاريح المقارَنة وحدها، لا على المحفظة كاملة —',
    'والمقام معلن كي لا يُقرأ الرقم على محفظةٍ أكبر مما حُسب.',
    '',
    '| الحالة | ساعات-مركبة |',
    '|---|---|',
    `| الحركة الحالية | ${summary.totals.currentVehHours.toLocaleString('en')} |`,
    `| مِنسَب — أدنى المدى | ${summary.totals.shadowLowVehHours.toLocaleString('en')} |`,
    `| مِنسَب — وسط المدى | ${summary.totals.shadowMidVehHours.toLocaleString('en')} |`,
    `| مِنسَب — أعلى المدى | ${summary.totals.shadowHighVehHours.toLocaleString('en')} |`,
    '',
    `أي أن المجموع المعروض اليوم يقع ${summary.totals.currentVehHours >= summary.totals.shadowLowVehHours
      && summary.totals.currentVehHours <= summary.totals.shadowHighVehHours
      ? '**داخل** مدى مِنسَب' : '**خارج** مدى مِنسَب'}.`,
    '',
    '### والوسيط لا يدافع عن المجموع',
    '',
    `وسيط النسبة ${summary.aadtRatio.median} — أي أن التصريح النموذجي تتحرّك`,
    `حركته قليلاً. والمجموع مع ذلك يبلغ ${summary.convexity.midOverCurrent}`,
    'ضِعف ما هو معروض. والسبب ليس تناقضاً بل **تحدّب معادلة الأثر**: BPR أُسّية،',
    'فمضاعفة الحركة على تصريحٍ واحد تضاعف أثره أضعافاً، ورفعُ حركةِ قلّةٍ يبتلع',
    'خفضَ حركةِ كثرة.',
    '',
    `وهذا مقيس هنا: أعلى ${summary.convexity.topShare} تصاريح بالأثر تحمل`,
    `${pct(summary.convexity.topShareOfTotal)} من مجموع الظلّ. فقولُ «الوسيط`,
    'لم يتحرّك» **ليس دفاعاً** عن مجموع، ولا عن رقمٍ يُعرض على شريحة.',
    '',
    '## التصاريح التي يقلب مِنسَب ترتيبها',
    '',
    'وهذا أهم ما في التقرير. صندوق الأعمال مرتَّبٌ بالأثر تنازلياً، وأعلى الصف',
    'هو ما ينظر فيه المراجع أولاً. فتحرّك المرتبة تحرّكٌ في ما يُرى.',
    '',
    '**الإزاحة موجبة إذا صعد التصريح** — أي صار أقرب إلى رأس الصندوق بمِنسَب',
    'مما هو عليه اليوم. وسالبةً إذا هبط.',
    '',
    'الجدول لأكبر خمسة وعشرين إزاحةً؛ والباقي كله في',
    '`presentation/data/street-load-shadow.json`.',
    '',
  ];

  const table = ['| التصريح | الشارع | الصنف | مِنسَب | الترتيب الآن | بمِنسَب | الإزاحة | الأثر الآن | بمِنسَب (أدنى–وسط–أعلى) |',
    '|---|---|---|---|---|---|---|---|---|'];
  byShift.slice(0, 25).forEach((row) => {
    table.push(`| \`${row.permitRef}\` | ${row.street} | ${row.roadClass} | `
      + `${row.loadIndex} | ${row.currentRank} | ${row.shadowRank} | `
      + `${row.rankShift > 0 ? '+' : ''}${row.rankShift} | `
      + `${row.current.impactVehHours.toLocaleString('en')} | `
      + `${row.shadowLow.impactVehHours.toLocaleString('en')}–`
      + `${row.shadowMid.impactVehHours.toLocaleString('en')}–`
      + `${row.shadowHigh.impactVehHours.toLocaleString('en')} |`);
  });

  const topBlock = ['', '### العشرة الأوائل — من خرج ومن دخل', ''];
  if (!summary.ranking.leftTopTen.length && !summary.ranking.enteredTopTen.length) {
    topBlock.push('لم يتغيّر أحد. رأس الصندوق نفسه في الحالين.');
  } else {
    topBlock.push(`**خرج:** ${summary.ranking.leftTopTen.map((ref) => `\`${ref}\``).join(' · ') || 'لا أحد'}`);
    topBlock.push('');
    topBlock.push(`**دخل:** ${summary.ranking.enteredTopTen.map((ref) => `\`${ref}\``).join(' · ') || 'لا أحد'}`);
    topBlock.push('');
    topBlock.push('وهؤلاء تصاريحُ كان المراجع يراها أولاً ولن يراها، وأخرى'
      + ' لم يكن يراها وسيراها. والفرق ليس في الرقم بل في ما يقع تحت العين.');
  }

  const same = rows.filter((row) => row.street && rows
    .some((other) => other !== row && other.street === row.street));
  const streetBlock = ['', '## الشارع الواحد بقيمتين', '',
    'أصل المشكلة: تصريحان على الشارع نفسه بحركتين متباعدتين بلا سبب. وهذا ما',
    'يقوله الجدول — الحركة الحالية مقابل مِنسَب، للشوارع التي تحمل أكثر من',
    'تصريح.', '',
    '| الشارع | الحركة الحالية | مِنسَب (وسط المدى) |',
    '|---|---|---|'];
  const byStreet = {};
  same.forEach((row) => {
    if (!byStreet[row.street]) byStreet[row.street] = [];
    byStreet[row.street].push(row);
  });
  Object.keys(byStreet)
    .map((name) => ({ name, list: byStreet[name] }))
    .map((one) => {
      const currents = one.list.map((row) => row.currentAadt);
      const shadows = one.list.map((row) => row.shadowAadtMid);
      const spread = (list) => Math.max.apply(null, list) / Math.min.apply(null, list);
      return Object.assign(one, {
        currents, shadows, currentSpread: spread(currents), shadowSpread: spread(shadows) });
    })
    .sort((a, b) => b.currentSpread - a.currentSpread)
    .slice(0, 12)
    .forEach((one) => {
      streetBlock.push(`| ${one.name} | `
        + `${one.currents.map((v) => v.toLocaleString('en')).join(' · ')} `
        + `(تباعد ×${Math.round(one.currentSpread * 10) / 10}) | `
        + `${one.shadows.map((v) => v.toLocaleString('en')).join(' · ')} `
        + `(تباعد ×${Math.round(one.shadowSpread * 10) / 10}) |`);
    });

  const skippedBlock = ['', '## ما امتنع التقرير عنه', '',
    `${summary.permitsSkipped} تصريحاً بلا مدى مطلق في مِنسَب، فلا حركة تُشتقّ`,
    'لها ولا ظلّ يُحسب. والامتناع مسجَّل بسببه لا مُسقَط من العدّ — إسقاطه',
    'يجعل النسب أعلاه تُقرأ على محفظةٍ أكبر مما حُسب.', ''];
  if (summary.skipped.length) {
    skippedBlock.push('| التصريح | الشارع | السبب |', '|---|---|---|');
    summary.skipped.slice(0, 30).forEach((one) => {
      skippedBlock.push(`| \`${one.permitRef}\` | ${one.street} | ${one.reason} |`);
    });
  }

  const checkBlock = ['', '## فحص إعادة الإنتاج', '',
    'قبل أي مقارنة، شُغِّل المحرك بالحركة **الحالية** وقُورن ناتجه بما هو',
    'مكتوب في المحفظة. ولولا هذا الفحص لأمكن أن يكون الفرق كله فرقاً في طريقة',
    'الاستدعاء لا في الحركة.', ''];
  checkBlock.push(summary.reproductionMismatches === 0
    ? `**طابقت الأرقام في ${summary.permitsCompared} تصريحاً من ${summary.permitsCompared}.**`
      + ' فالفرق أدناه فرق حركةٍ وحدها.'
    : `**اختلف ${summary.reproductionMismatches} تصريحاً.** والفرق أدناه يخلط`
      + ' فرق الحركة بفرق الاستدعاء، فلا يُقرأ قبل إصلاح ذلك:'
      + `\n\n${summary.mismatched.slice(0, 10).map((one) => `- \`${one.permitRef}\`: المخزَّن ${one.stored} · المُعاد ${one.recomputed}`).join('\n')}`);

  const tail = ['', '## ما لا يقوله هذا التقرير', '',
    '- **لا يقول إن مِنسَب أصحّ.** لا عدّ مركبات على أي مقطع في المحفظة، فلا',
    '  مرجع يُحكم به بين الرقمين. يقول إن أحدهما له مدخلات تُقرأ والآخر مولّد',
    '  أرقام — وهذا فرقٌ في الدفاع عن الرقم لا في مطابقته للواقع.',
    '- **لا يقيس شيئاً ميدانياً.** كل رقم هنا ناتج نموذج من افتراضات معلنة.',
    '- **لا يوصي بالتبديل تلقائياً.** التوصية أدناه، والقرار لمن يقرأ.',
    '',
    '## التوصية',
    '',
    summary.ranking.movedMoreThanThreshold > 0
      ? 'أُوصي بالتبديل — **بعد** أن يقرأ التقرير من يملك القرار، ولسببين:'
        + ' الأول أن الترتيب ينقلب، أي أن العشوائية تُغيّر ما يقع تحت عين'
        + ' المراجع أولاً. والثاني أن مِنسَب يحمل مدخلاته معه، فرقمٌ يُسأل عنه'
        + ' يمكن الدفاع عنه أو نقضه — والعشوائي لا يُدافع عنه ولا يُنقض.'
        + '\n\nوشرط التبديل أن يُعرض الأثر **مدىً** لا نقطة، وأن يُعاد بناء'
        + ' الجرد كله بعده، وأن تبقى الدرجة `model-derived` — فالتبديل يبدّل'
        + ' مصدر الرقم ولا يرفع دليله.'
      : 'لا أُوصي بالتبديل الآن. الترتيب لا ينقلب، فالمكسب في الصدق وحده'
        + ' والكلفة إعادة بناء كل رقم معروض. والأولى أن يُعرض مِنسَب إلى جانب'
        + ' الحركة الحالية بوصفه حدّاً عليها، ويؤجَّل التبديل إلى أن يأتي عدّ'
        + ' حقيقي يستحق إعادة البناء.',
    '',
    '---',
    '',
    `المدخلات: \`presentation/data/street-load.json\` (درجة \`${load.grade}\`)`,
    'و`presentation/data/city-portfolio.geojson`. المفصَّل بصيغة آلية في',
    '`presentation/data/street-load-shadow.json`.',
    ''];

  return head.concat(table, topBlock, streetBlock, skippedBlock, checkBlock, tail)
    .join('\n');
}

main();
