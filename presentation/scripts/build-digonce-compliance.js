'use strict';
/**
 * من تأخّر؟ — الكشف الاتجاهيّ لفرص التنسيق الفائتة.
 * ---------------------------------------------------------------------------
 * **العيب الذي يُغلق هنا.**
 *
 * شركة المياه تأخذ تصريحاً وتحفر شارعاً وتغلقه شهراً. تنتهي، ويُفتح الشارع.
 * ثم تأتي الكهرباء بعد أيام وتحفر الشارع نفسه فيُغلق ثانيةً. المواطن دفع
 * الثمن مرتين، والحفر كان يمكن أن يقع مرة واحدة.
 *
 * والدمج القائم في `masar-portfolio.js` يعرف أن هؤلاء متقاربون، ولا يعرف
 * **من تأخّر**. وهو فرقٌ يقلب المعنى: «تصريحان على شارع واحد» وصفٌ لا يسأل
 * أحداً شيئاً، و«الكهرباء بدأت بعد أن فتحت المياه الشارع وكان بإمكانها أن
 * تبدأ معها» سؤالٌ له مسؤول. المؤشّر بلا اتجاه لا يحاسب أحداً، وبلا اتجاه
 * أيضاً يحاسب الأول — وهو أظلم من ألّا يحاسب أحداً.
 *
 * **القاعدة، وهي ضيّقة عمداً.**
 *
 * عدم الامتثال ليس «حفرتَ في شارع حفر فيه غيرك». هو: طلبتَ تصريحاً على
 * الشارع نفسه، وبدأتَ عملك بعد بدء تصريح آخر قائم أو منتهٍ قريباً، وكان
 * بإمكانك أن تبدأ معه. فالأول ليس مخالفاً، والمتأخر وحده هو المسؤول.
 *
 * **ما يُستثنى، وكلٌّ بسببه.**
 *
 *   ١) العمل الطارئ (`subtype: "emergency"`). كسر ماسورة لا يُعاقَب صاحبه على
 *      عدم التنسيق — لم يكن يعلم. مؤشّرٌ يعاقب الطوارئ مؤشّر ظالم.
 *   ٢) الأول على الشارع. لا يُحاسب من لم يسبقه أحد.
 *   ٣) ما لا يُعرف عنه شيء. نقص تاريخ أو شارع يعطي `unjudgeable` لا مخالفة.
 *   ٤) السابق طارئ **والفجوة موجبة**. نافذة الطوارئ تُفتح بلا إعلان مسبق
 *      وتُغلق، فمن بدأ بعدها لم تكن أمامه نافذة يلحق بها حين خطّط. أمّا
 *      التداخل الزمني فيبقى محاسَباً: الخندق كان مفتوحاً وأنت تبدأ.
 *
 * **حدٌّ يسافر مع كل رقم يخرج من هنا.**
 *
 * المحفظة مولَّدة ببذرة ثابتة — ليست سجلّ تصاريح رسمياً. فالمؤشّر يصف محفظة
 * مولَّدة، ولا يقول شيئاً عن سلوك جهة حقيقية. رقمُ امتثالٍ يُقرأ حكماً على
 * شركة حقيقية وهو من بيانات مولَّدة ضررٌ لا فائدة. وما يجعله ذا قيمة رغم
 * ذلك: الآلية — الإشعار وقاعدة الاستثناء والمؤشّر — تعمل كما هي على سجلّ
 * حقيقي حين يُوصَل.
 *
 * التشغيل: node presentation/scripts/build-digonce-compliance.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
global.window = global;

const Portfolio = require(path.join(ROOT, 'masar-portfolio.js'));

const OUT_JSON = path.join(DATA, 'digonce-compliance.json');
const OUT_JS = path.join(DATA, 'digonce-compliance.js');

const MS_PER_DAY = 86400000;

/**
 * عتبة «الفجوة القصيرة» — اصطلاح لا قياس.
 *
 * الرقم لا يهبط من السماء ولا يُدَّعى قياساً: هو `DIG_ONCE_WINDOW_DAYS` نفسه
 * الذي يبني به مسار مجموعات التنسيق، مقروءاً من مصدره لا منسوخاً عنه. ومعناه
 * حدٌّ إداريّ: كم يوماً بعد إغلاق الخندق يبقى «كان بإمكانك أن تبدأ معهم»
 * قولاً معقولاً. ولأنه اصطلاح، تُعرض حساسية النتيجة له في `sensitivity`:
 * القارئ يرى بنفسه كم من الحصيلة صنعه الاختيار لا البيانات.
 */
const WINDOW_DAYS = Portfolio.DIG_ONCE_WINDOW_DAYS;

/** العتبات التي تُعرض عندها الحساسية — أضيق من الاصطلاح وأوسع منه. */
const SENSITIVITY_DAYS = [7, 14, WINDOW_DAYS, 60, 90];

const EMERGENCY = 'emergency';

/**
 * ترتيب قوّة الحالة.
 *
 * التصريح المتأخر قد يسبقه أكثر من واحد على الشارع نفسه، ولا بدّ من اختيار
 * الحالة التي يُنسب إليها. والاختيار هنا **أقصى فرصة تنسيق أُتيحت له**: لو
 * كان بإمكانه أن ينضم إلى خندق مفتوح، فوجودُ سابقٍ آخر بعيد لا يعفيه.
 *
 * والاتجاه المعاكس — اختيار الأضعف — يجعل المؤشّر يُخفّف عن نفسه بسابقٍ
 * صادف أن كان بعيداً، وهي طريقة صامتة لتحسين رقم.
 */
const STRENGTH = {
  overlapping: 5,
  'missed-window': 4,
  'exempt-unplannable-predecessor': 3,
  'too-far-apart': 2,
  unjudgeable: 1,
};

/** التصنيفات التي تُحسب على الجهة المتأخرة بوصفها فرصة تنسيق فائتة. */
const CHARGEABLE = new Set(['overlapping', 'missed-window']);

function dayOf(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

/** بيانات كافية للحكم: شارع مسمّى وتاريخا بدء وانتهاء مقروءان. */
function judgeable(properties) {
  return Boolean(properties.street)
    && Number.isFinite(dayOf(properties.start))
    && Number.isFinite(dayOf(properties.end));
}

/**
 * يصنّف زوجاً: متأخّرٌ في مواجهة سابقٍ واحد.
 *
 * الفجوة تُقاس بين **بدء المتأخر وانتهاء السابق** لا بين البدأين: السؤال هو
 * «هل كان الخندق مفتوحاً أو قريب الإغلاق حين بدأت؟»، والبدآن المتباعدان مع
 * عملٍ طويل يعنيان خندقاً مفتوحاً فعلاً. والسالب تداخلٌ زمني: بدأتَ قبل أن
 * ينتهي.
 */
function classifyPair(later, earlier, windowDays) {
  const gapMs = dayOf(later.start) - dayOf(earlier.end);
  const gapDays = gapMs / MS_PER_DAY;

  let status;
  if (gapMs < 0) status = 'overlapping';
  else if (gapDays <= windowDays) status = 'missed-window';
  else status = 'too-far-apart';

  /* الاستثناء الرابع، وحدّه: الطوارئ لا تُخطَّط فلا نافذة يُلحق بها. ويسقط
     الاستثناء عند التداخل — الخندق كان مفتوحاً أمام عينك وأنت تبدأ. */
  let wouldBe = null;
  if (status === 'missed-window' && earlier.subtype === EMERGENCY) {
    wouldBe = status;
    status = 'exempt-unplannable-predecessor';
  }

  return {
    status,
    wouldBe,
    gapDays: round1(gapDays),
    earlierRef: earlier.permitRef,
    earlierPromoter: earlier.promoter,
    earlierSubtype: earlier.subtype,
    earlierStart: earlier.start,
    earlierEnd: earlier.end,
    /* وسمان يسافران مع الحالة ولا يعفيان منها: القارئ الذي يرى أن أحدهما
       يستحق الاستثناء يستطيع أن يعيد الحساب بنفسه، ومن يُخفيهما يجعل ذلك
       مستحيلاً. */
    samePromoter: later.promoter === earlier.promoter,
    predecessorEmergency: earlier.subtype === EMERGENCY,
  };
}

/**
 * يصنّف المحفظة كلها عند عتبة واحدة.
 *
 * كل تصريح يخرج بحالة — بلا إسقاط صامت. إسقاط ما تعذّر حكمه يجعل النسب
 * تُقرأ على محفظة أصغر من المعلَنة، وهي أخطر طريقة لتحسين رقم: لا تكذب،
 * تُخفي المقام.
 */
function classify(features, windowDays) {
  const byStreet = new Map();
  features.forEach((feature) => {
    const p = feature.properties;
    const key = p.street || '';
    if (!byStreet.has(key)) byStreet.set(key, []);
    byStreet.get(key).push(p);
  });

  const permits = {};
  const cases = [];

  byStreet.forEach((list, street) => {
    const sorted = list.slice().sort((a, b) => dayOf(a.start) - dayOf(b.start));

    sorted.forEach((p, index) => {
      const base = {
        street: street,
        promoter: p.promoter,
        subtype: p.subtype,
        start: p.start,
        end: p.end,
        permitsOnStreet: sorted.length,
      };

      if (!judgeable(p)) {
        permits[p.permitRef] = Object.assign({}, base, {
          status: 'unjudgeable',
          reason: 'شارع غير مسمّى أو تاريخ غير مقروء — لا حكم على ناقص البيانات',
        });
        return;
      }

      if (sorted.length === 1) {
        permits[p.permitRef] = Object.assign({}, base, {
          status: 'alone-on-street',
          reason: 'لا تصريح آخر على هذا الشارع — لا فرصة تنسيق فائتة',
        });
        return;
      }

      /* السابقون: من بدأ قبله على الشارع نفسه. الترتيب زمنيّ، فما قبل موضعه
         هو سابقُه. والمساواة في البدء لا تُحسب سبقاً — لا أحد «تأخّر» عن
         عملٍ بدأ معه في اللحظة نفسها. */
      const earlier = sorted.slice(0, index)
        .filter((other) => judgeable(other) && dayOf(other.start) < dayOf(p.start));

      if (!earlier.length) {
        permits[p.permitRef] = Object.assign({}, base, {
          status: 'first-on-street',
          reason: 'أول من بدأ على هذا الشارع — لا يُحاسب من لم يسبقه أحد',
          predecessorsConsidered: 0,
        });
        return;
      }

      const best = earlier
        .map((other) => classifyPair(p, other, windowDays))
        .sort((a, b) => STRENGTH[b.status] - STRENGTH[a.status]
          || a.gapDays - b.gapDays)[0];

      /* الاستثناء يُحسب زوجه ثم يُعفى، لا يُقصَ قبل الحساب.
         الفرق ليس تنظيمياً: استثناءٌ يُطبَّق بلا أن يُعرف ماذا كان سيقول
         استثناءٌ لا يُراجَع. و`wouldBe` هو ما يجعل أثر القاعدة مرئياً —
         كم حالةً أسقطتها فعلاً — بدل أن يُدَّعى عدلها بلا رقم. */
      const emergency = p.subtype === EMERGENCY;
      const status = emergency ? 'exempt-emergency' : best.status;
      const entry = Object.assign({}, base, best, {
        status: status,
        predecessorsConsidered: earlier.length,
        chargeable: CHARGEABLE.has(status),
        wouldBe: emergency ? best.status : best.wouldBe,
      });
      if (emergency) {
        entry.reason = 'عمل طارئ — كسر ماسورة لا يُعاقَب صاحبه على عدم التنسيق';
      }
      permits[p.permitRef] = entry;
      cases.push(Object.assign({ permitRef: p.permitRef }, entry));
    });
  });

  return { permits, cases };
}

/** تعداد الحالات بالتصنيف. */
function tallyOf(permits) {
  const tally = {
    overlapping: 0,
    'missed-window': 0,
    'exempt-emergency': 0,
    'exempt-unplannable-predecessor': 0,
    'too-far-apart': 0,
    'first-on-street': 0,
    'alone-on-street': 0,
    unjudgeable: 0,
  };
  Object.values(permits).forEach((entry) => { tally[entry.status] += 1; });
  return tally;
}

/**
 * مؤشّر الامتثال لكل جهة — بالبسط والمقام معاً، دائماً.
 *
 * «٤٠٪ عدم امتثال» من خمس حالات ليست كـ٤٠٪ من خمسين، وإخفاء المقام يصنع
 * رقماً يُساء استعماله. والمقام هو تصاريح الجهة **غير الطارئة**: الطوارئ
 * مستثناة من البسط، فبقاؤها في المقام يخفض نسبة من عملها كله طارئ لسبب لا
 * علاقة له بتنسيقها.
 *
 * والترتيب بلا تشهير: العنوان «فرص تنسيق فائتة» لا «مخالفات». المؤشّر أداة
 * تنسيق لا لوحة عار — والفرق ليس لفظياً: لوحة العار تدفع الجهة إلى إخفاء
 * الطلب، والأداة تدفعها إلى الاتصال بجارها.
 */
function promotersOf(features, permits) {
  const index = new Map();
  const ensure = (name) => {
    if (!index.has(name)) {
      index.set(name, {
        promoter: name,
        permits: 0,
        emergencyPermits: 0,
        nonEmergencyPermits: 0,
        missedCases: 0,
        overlapping: 0,
        missedWindow: 0,
        exemptEmergency: 0,
        exemptUnplannablePredecessor: 0,
        tooFarApart: 0,
        firstOnStreet: 0,
        samePromoterCases: 0,
      });
    }
    return index.get(name);
  };

  features.forEach((feature) => {
    const p = feature.properties;
    const row = ensure(p.promoter || 'جهة غير مسمّاة');
    row.permits += 1;
    if (p.subtype === EMERGENCY) row.emergencyPermits += 1;
    else row.nonEmergencyPermits += 1;
  });

  Object.values(permits).forEach((entry) => {
    const row = ensure(entry.promoter || 'جهة غير مسمّاة');
    if (entry.status === 'overlapping') row.overlapping += 1;
    if (entry.status === 'missed-window') row.missedWindow += 1;
    if (entry.status === 'exempt-emergency') row.exemptEmergency += 1;
    if (entry.status === 'exempt-unplannable-predecessor') {
      row.exemptUnplannablePredecessor += 1;
    }
    if (entry.status === 'too-far-apart') row.tooFarApart += 1;
    if (entry.status === 'first-on-street') row.firstOnStreet += 1;
    if (entry.chargeable) {
      row.missedCases += 1;
      if (entry.samePromoter) row.samePromoterCases += 1;
    }
  });

  return [...index.values()].map((row) => Object.assign({}, row, {
    /* `null` لا صفر حين يخلو المقام: صفرٌ يُقرأ «امتثال تام» وهو «لا مقام». */
    ratePct: row.nonEmergencyPermits > 0
      ? round1((100 * row.missedCases) / row.nonEmergencyPermits)
      : null,
  })).sort((a, b) => (b.ratePct || 0) - (a.ratePct || 0)
    || b.missedCases - a.missedCases);
}

/**
 * سياق التنسيق لكل تصريح — مادة الإشعار.
 *
 * الشقّ البنّاء: قبل أن يُحاسب أحد، يُقال له إن الشارع مشغول. والإشعار يذكر
 * الأعمال القائمة والمنتهية حديثاً **والقادمة** معاً: القادم هو الوحيد الذي
 * ما زال بإمكان الطالب أن ينضم إليه فعلاً، فحصرُ الإشعار في الماضي يجعله
 * إبلاغاً بفوات الفرصة لا دعوةً إليها.
 */
function noticesOf(features, windowDays) {
  const notices = {};
  const byStreet = new Map();
  features.forEach((feature) => {
    const p = feature.properties;
    if (!byStreet.has(p.street)) byStreet.set(p.street, []);
    byStreet.get(p.street).push(p);
  });

  features.forEach((feature) => {
    const p = feature.properties;
    if (!judgeable(p)) {
      notices[p.permitRef] = { street: p.street || '', others: [], unjudgeable: true };
      return;
    }

    const here = { from: dayOf(p.start), to: dayOf(p.end) };
    const others = (byStreet.get(p.street) || [])
      .filter((other) => other.permitRef !== p.permitRef && judgeable(other))
      .map((other) => {
        const there = { from: dayOf(other.start), to: dayOf(other.end) };
        let relation;
        let gapDays;
        if (there.from < here.to && there.to > here.from) {
          relation = 'ongoing';
          gapDays = 0;
        } else if (there.to <= here.from) {
          relation = 'recently-ended';
          gapDays = round1((here.from - there.to) / MS_PER_DAY);
        } else {
          relation = 'upcoming';
          gapDays = round1((there.from - here.to) / MS_PER_DAY);
        }
        return {
          permitRef: other.permitRef,
          promoter: other.promoter,
          subtype: other.subtype,
          start: other.start,
          end: other.end,
          relation: relation,
          gapDays: gapDays,
        };
      })
      .filter((row) => row.relation === 'ongoing' || row.gapDays <= windowDays)
      .sort((a, b) => a.gapDays - b.gapDays);

    notices[p.permitRef] = { street: p.street, others: others };
  });

  return notices;
}

function main() {
  const portfolio = JSON.parse(fs.readFileSync(
    path.join(DATA, 'city-portfolio.geojson'), 'utf8'));
  const features = portfolio.features;

  const governing = classify(features, WINDOW_DAYS);
  const tally = tallyOf(governing.permits);
  const promoters = promotersOf(features, governing.permits);

  const streets = new Set(features.map((f) => f.properties.street));
  const perStreet = new Map();
  features.forEach((f) => {
    const key = f.properties.street;
    perStreet.set(key, (perStreet.get(key) || 0) + 1);
  });
  const multiPermitStreets = [...perStreet.values()].filter((n) => n > 1).length;

  /* الحساسية للعتبة: ما تغيّره العتبة هو حدّ «منتهٍ قريباً» وحده. التداخل
     الزمني لا يتحرك معها أبداً — وهذا نفسه نتيجة تُقرأ: جوهرُ الحصيلة ليس
     أثر اختيارنا. */
  /**
   * أثر الاستثناء محسوباً — لا مُدَّعىً.
   *
   * «الطوارئ مستثناة» جملةٌ يقولها كل مؤشّر عن نفسه. وما يجعلها قابلة
   * للمراجعة هو الرقم: كم حالةً أسقطها الاستثناء فعلاً. صفرٌ هنا يعني أن
   * القاعدة لم تعمل بعد وأن عدلها غير مُختبَر، ورقمٌ كبير يعني أنها تحمل
   * جُلّ الحصيلة — والقارئ يحقّ له أن يعرف أيّهما.
   */
  const exemptionEffect = {
    emergencyPermits: features
      .filter((f) => f.properties.subtype === EMERGENCY).length,
    emergencyWithPredecessor: tally['exempt-emergency'],
    emergencyWouldBeChargeable: Object.values(governing.permits)
      .filter((entry) => entry.status === 'exempt-emergency'
        && CHARGEABLE.has(entry.wouldBe)).length,
    unplannablePredecessorWouldBeChargeable: Object.values(governing.permits)
      .filter((entry) => entry.status === 'exempt-unplannable-predecessor'
        && CHARGEABLE.has(entry.wouldBe)).length,
  };

  const sensitivity = SENSITIVITY_DAYS.map((days) => {
    const run = classify(features, days);
    const runTally = tallyOf(run.permits);
    return {
      windowDays: days,
      overlapping: runTally.overlapping,
      missedWindow: runTally['missed-window'],
      chargeable: runTally.overlapping + runTally['missed-window'],
    };
  });

  /**
   * حدٌّ اكتشفه التشغيل، ولم يكن في الطلب.
   *
   * نوافذ المحفظة كلها متقاربة، ومدد الأعمال أطول من تباعد البدايات. فالحالة
   * التي وصفها الطلب حرفياً — تنتهي المياه ويُفتح الشارع ثم تحفر الكهرباء بعد
   * أيام — **لا تقع في هذه المحفظة ولا مرة**: كل حالة مرصودة تداخلٌ زمنيّ.
   *
   * وإخفاء هذا يجعل رقم الحساسية يُقرأ صموداً وهو انعدامُ مادة. فيُعلن مع
   * الحصيلة، ويترتّب عليه شيئان: العتبة لا تصنع شيئاً من هذه الأرقام، وتصنيفا
   * `missed-window` و`too-far-apart` مفحوصان على حالات مُصطنَعة في الحزمة لا
   * على المحفظة — وهو الفرق بين شيفرة مختبَرة وشيفرة مرئية فحسب.
   */
  const spanFrom = Math.min.apply(null,
    features.map((f) => dayOf(f.properties.start)));
  const spanTo = Math.max.apply(null, features.map((f) => dayOf(f.properties.end)));
  const spanDays = Math.round((spanTo - spanFrom) / MS_PER_DAY);
  const longestWorkDays = Math.max.apply(null,
    features.map((f) => (dayOf(f.properties.end) - dayOf(f.properties.start))
      / MS_PER_DAY)).toFixed(0);

  const notices = noticesOf(features, WINDOW_DAYS);
  const noticeRelations = { ongoing: 0, 'recently-ended': 0, upcoming: 0 };
  Object.values(notices).forEach((row) => {
    (row.others || []).forEach((other) => { noticeRelations[other.relation] += 1; });
  });

  const report = {
    generatedFrom: 'presentation/scripts/build-digonce-compliance.js',
    grade: 'model-derived',
    portfolioMode: 'synthetic',
    portfolioSeed: Portfolio.SEED,
    portfolioLimit: 'المحفظة مولَّدة ببذرة ثابتة — ليست سجلّ تصاريح رسمياً. '
      + 'المؤشّر يصف محفظة مولَّدة، ولا يقول شيئاً عن سلوك جهة حقيقية. '
      + 'والآلية نفسها — الإشعار وقاعدة الاستثناء والمؤشّر — تعمل كما هي على '
      + 'سجلّ حقيقي حين يُوصَل.',
    rule: 'عدم الامتثال اتجاهيّ: طلبٌ على الشارع نفسه، وبدءٌ بعد بدء تصريح '
      + 'قائم أو منتهٍ قريباً، مع إمكان البدء معه. الأول ليس مخالفاً، '
      + 'والمتأخر وحده هو المسؤول.',
    doesNotProve: 'لا قياس ميداني ولا سجلّ رسمي. الحالة تقول إن نافذتين على '
      + 'شارع واحد كان يمكن أن تتّحدا في هذه المحفظة، ولا تقول إن الاتحاد كان '
      + 'ممكناً تقنياً: أعماق الخدمات ومواصفات الردم غير معروفة، ولا سجلّ '
      + 'إشعارٍ يُثبت أن الجهة المتأخرة عَلِمت.',
    windowDays: WINDOW_DAYS,
    windowBasis: 'اصطلاح لا قياس. الرقم هو DIG_ONCE_WINDOW_DAYS نفسه في '
      + 'masar-portfolio.js، مقروءاً من مصدره لا منسوخاً عنه. ومعناه حدٌّ '
      + 'إداريّ: كم يوماً بعد إغلاق الخندق يبقى «كان بإمكانك أن تبدأ معهم» '
      + 'قولاً معقولاً. حساسية الحصيلة له معروضة في sensitivity.',
    exemptions: [
      {
        key: 'exempt-emergency',
        why: 'العمل الطارئ لا يُخطَّط. كسر ماسورة لا يُعاقَب صاحبه على عدم '
          + 'التنسيق — لم يكن يعلم. ومؤشّر يعاقب الطوارئ يُرفض في أول مراجعة.',
      },
      {
        key: 'first-on-street',
        why: 'لا يُحاسب من لم يسبقه أحد. المؤشّر اتجاهيّ، والأول ليس مخالفاً.',
      },
      {
        key: 'unjudgeable',
        why: 'الاستثناء قبل الاتهام. نقص شارع أو تاريخ يعطي «غير قابل للحكم» '
          + 'لا «مخالفة».',
      },
      {
        key: 'exempt-unplannable-predecessor',
        why: 'الاستثناء الرابع: السابق طارئ والفجوة موجبة. نافذة الطوارئ '
          + 'تُفتح بلا إعلان مسبق وتُغلق، فمن بدأ بعدها لم تكن أمامه نافذة '
          + 'يلحق بها حين خطّط. ويسقط الاستثناء عند التداخل الزمني: الخندق '
          + 'كان مفتوحاً وهو يبدأ.',
      },
    ],
    total: features.length,
    streetCount: streets.size,
    multiPermitStreetCount: multiPermitStreets,
    portfolioSpanDays: spanDays,
    longestWorkDays: Number(longestWorkDays),
    dataLimit: 'نوافذ المحفظة كلها تقع في ' + spanDays + ' يوماً، وأطول عمل '
      + 'فيها ' + longestWorkDays + ' يوماً — أي أن مدد الأعمال تزيد على تباعد '
      + 'البدايات. فالحالة التي وصفها الطلب حرفياً (تنتهي جهة ويُفتح الشارع '
      + 'ثم تحفر جهة أخرى بعد أيام) لا تقع في هذه المحفظة ولا مرة: كل حالة '
      + 'مرصودة تداخلٌ زمنيّ. ويترتّب على ذلك أن العتبة لا تصنع شيئاً من هذه '
      + 'الأرقام — والحساسية تُثبته بانعدام فرقها — وأن تصنيفَي missed-window '
      + 'وtoo-far-apart مفحوصان على حالات مُصطنَعة في الحزمة لا على المحفظة. '
      + 'وللسبب نفسه لا يحمل الإشعار في هذه المحفظة إلا علاقة ongoing: '
      + 'recently-ended وupcoming مفحوصتان مُصطنَعتين كذلك.',
    noticeRelations: noticeRelations,
    tally: tally,
    chargeableCaseCount: tally.overlapping + tally['missed-window'],
    judgedPairCount: governing.cases.length,
    exemptionEffect: exemptionEffect,
    sensitivity: sensitivity,
    promoters: promoters,
    cases: governing.cases,
    permits: governing.permits,
    notices: notices,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_JS,
    `window.MASAR_DIGONCE_COMPLIANCE = ${JSON.stringify(report)};\n`, 'utf8');

  console.log(`${report.total} تصريحاً على ${report.streetCount} شارعاً `
    + `(${report.multiPermitStreetCount} شارعاً بأكثر من تصريح):`);
  console.log(`  تداخل زمني: ${tally.overlapping}`);
  console.log(`  نافذة فائتة: ${tally['missed-window']}`);
  console.log(`  مستثنى — طارئ: ${tally['exempt-emergency']}`);
  console.log(`  مستثنى — سابقه طارئ: ${tally['exempt-unplannable-predecessor']}`);
  console.log(`  متباعد: ${tally['too-far-apart']}`);
  console.log(`  أول على الشارع: ${tally['first-on-street']}`);
  console.log(`  وحيد على الشارع: ${tally['alone-on-street']}`);
  console.log(`  غير قابل للحكم: ${tally.unjudgeable}`);
  console.log('\nفرص التنسيق الفائتة لكل جهة (بسط/مقام غير طارئ):');
  promoters.forEach((row) => {
    console.log(`  ${row.promoter}: ${row.missedCases}/${row.nonEmergencyPermits}`
      + (row.ratePct === null ? ' — لا مقام' : ` = ${row.ratePct}%`));
  });
  console.log('\nأثر الاستثناء محسوباً:');
  console.log(`  ${exemptionEffect.emergencyPermits} تصريحاً طارئاً في المحفظة، `
    + `${exemptionEffect.emergencyWithPredecessor} منها له سابق، `
    + `و${exemptionEffect.emergencyWouldBeChargeable} كان سيُحاسب بلا الاستثناء.`);
  console.log('\nالحساسية للعتبة:');
  sensitivity.forEach((row) => {
    console.log(`  ${row.windowDays} يوماً: ${row.chargeable} حالة `
      + `(${row.overlapping} تداخلاً · ${row.missedWindow} نافذة فائتة)`);
  });
  console.log(`\nحدّ البيانات: ${report.dataLimit}`);
  console.log(`\n${OUT_JSON}`);
}

/* الحارس ضروري لا شكليّ: الحزمة تستورد المصنّف كي تفحص قاعدة الاستثناء على
   حالات مركّبة، وبلا الحارس يكتب كل استيراد ملفَّي البيانات من جديد. */
if (require.main === module) main();

module.exports = {
  classify, tallyOf, promotersOf, noticesOf, WINDOW_DAYS, CHARGEABLE,
};
