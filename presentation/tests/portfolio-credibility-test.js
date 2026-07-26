'use strict';
/**
 * مصداقية رقم المحفظة — الحارس الذي يمنع عودة رجل القشّ.
 * ---------------------------------------------------------------------------
 * لوحة أثر المدينة كانت تعلن وفر ٩٨.٦٪. الرقم صحيح حسابياً وكاذب دلالياً:
 * تصريح واحد يشكّل ٢٣٪ منه، وهو إغلاق ثلاثة من أربعة مسارات على شريان يحمل
 * ٨٧ ألف مركبة يومياً، ثماني ساعات من الثالثة عصراً، سبعة وعشرين يوماً — تصريح
 * لا تصدره بلدية. والوفر على تصريح ما كان ليُصدر ليس وفراً.
 *
 * ما يُختبر هنا ليس قيمة الرقم بل شكل توزيعه: أن يصف المحفظة لا حالة فيها.
 * لأن رقماً يقوده شاذّ يسقط أمام سؤال واحد، وسقوطه يأخذ معه المصداقية كلها.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const Engine = require(path.join(ROOT, 'athar-engine.js'));
global.AtharEngine = Engine;
const Portfolio = require(path.join(ROOT, 'athar-portfolio.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const permits = Portfolio.buildPermits(Portfolio.SEED);
const portfolio = Portfolio.buildPortfolio(Portfolio.SEED);
const records = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8')
).features.map((f) => f.properties);

/* ---- قيد الإصدار ---- */

const DAY_FROM = 6;
const DAY_TO = 21;

ok('لا تصريح نهاري يغلق أكثر من ثلث سعة الممر', () => {
  permits.forEach((permit) => {
    const daytime = permit.startHour >= DAY_FROM && permit.startHour < DAY_TO;
    if (!daytime) return;
    const allowed = Math.max(1, Math.floor(permit.lanes * 0.34));
    assert.ok(permit.lanesClosed <= allowed,
      `${permit.id}: ${permit.lanesClosed} من ${permit.lanes} عند الساعة ${permit.startHour}`);
  });
});

ok('الإغلاق الثقيل ما زال ممكناً — ليلاً', () => {
  // مساران ومسار مغلق نصفُ السعة حسابياً، وهو أدنى إغلاق ممكن على ذلك الشارع
  // لا إغلاقاً ثقيلاً. الثقل يبدأ من مسارين مغلقين فصاعداً.
  const heavy = permits.filter((p) => p.lanesClosed >= 2 && p.lanesClosed / p.lanes >= 0.5);
  assert.ok(heavy.length > 0, 'القيد ابتلع الإغلاق الثقيل كله');
  heavy.forEach((permit) => {
    const daytime = permit.startHour >= DAY_FROM && permit.startHour < DAY_TO;
    assert.ok(!daytime, `${permit.id}: إغلاق ثقيل نهاري عند ${permit.startHour}`);
  });
});

/* ---- شكل التوزيع ---- */

ok('لا تصريح واحد يتجاوز عُشر الرقم المعلن', () => {
  const share = portfolio.concentration.topPermitPct;
  assert.ok(share < 10, `أعلى تصريح ${share.toFixed(1)}٪ من الإجمالي`);
});

ok('أعلى خمسة تصاريح دون ثلث الرقم', () => {
  const share = portfolio.concentration.topFivePct;
  assert.ok(share < 33, `أعلى خمسة ${share.toFixed(1)}٪ من الإجمالي`);
});

ok('المتوسط لا يبتعد عن الوسيط أكثر من ثلاثة أضعاف', () => {
  const { meanVehHours, medianVehHours } = portfolio.concentration;
  assert.ok(medianVehHours > 0, 'وسيط صفري');
  const skew = meanVehHours / medianVehHours;
  assert.ok(skew < 3, `انحراف ${skew.toFixed(1)}× — الإجمالي يصف شاذّاً لا محفظة`);
});

ok('الوفر الإجمالي يساوي الحالة النموذجية لا حالة شاذة', () => {
  // إجماليٌّ يبتعد عن وسيط التصاريح يعني أن قلة تقوده. القرب هو الدليل على أن
  // الرقم قابل للتعميم — وهو ما يُسأل عنه أول شيء.
  const gap = Math.abs(portfolio.totals.savedPct - portfolio.concentration.medianSavedPct);
  assert.ok(gap < 10,
    `إجمالي ${portfolio.totals.savedPct.toFixed(1)}٪ ووسيط ${portfolio.concentration.medianSavedPct.toFixed(1)}٪`);
});

ok('الوفر داخل نطاق يُدافَع عنه — لا مئة بالمئة ولا صفر', () => {
  const pct = portfolio.totals.savedPct;
  assert.ok(pct > 40 && pct < 90, `وفر ${pct.toFixed(1)}٪ خارج النطاق المعقول`);
});

/* ---- الحل مكتوب مع المشكلة ---- */

ok('كل تصريح على الخريطة يحمل توصيته', () => {
  const required = ['impactVehHours', 'bestVehHours', 'savedVehHours', 'savedPct',
    'bestStartHour', 'asIsWindow', 'bestWindow', 'bestReason'];
  records.forEach((record) => {
    required.forEach((key) => {
      assert.ok(record[key] !== undefined, `${record.id} بلا ${key}`);
    });
  });
});

/* WP-B1 — تغيّر شرط هذا الفحص عن قصد.
 *
 * كان يشترط `bestVehHours <= impactVehHours` دائماً. كان صحيحاً حين كان
 * الهدف واحداً. بعد أن صار المحسّن يوازن التأخير باحتكاك الموقع وبالتعرّض في
 * الجوار الحسّاس، صارت توصيةٌ تأخيرها أعلى **جواباً مشروعاً** — لكن بشرطين:
 * أن يكون المجموع المكافئ أقلّ فعلاً، وأن تُسمّى المقايضة في السجل.
 *
 * الشرط الذي لا يجوز التنازل عنه: توصية أسوأ على كل الحدود. */
ok('التوصية لا تكون أسوأ على كل الحدود، والوفر متسق مع طرفيه', () => {
  const tradeOffs = [];
  records.forEach((record) => {
    if (record.bestVehHours > record.impactVehHours) {
      tradeOffs.push(record.id);
      assert.ok(record.totalEquivalentVehHours < record.baselineEquivalentVehHours,
        `${record.id}: تأخير أعلى ومجموع مكافئ ليس أقل — توصية أسوأ على كل الحدود`);
      assert.ok(record.tradeOff && record.tradeOff.length > 20,
        `${record.id}: تأخير أعلى بلا مقايضة مسمّاة`);
      assert.ok(record.savedVehHours < 0,
        `${record.id}: الوفر مقصوص إلى صفر بينما التأخير أعلى`);
    }
    const expected = record.impactVehHours > 0
      ? (100 * (record.impactVehHours - record.bestVehHours)) / record.impactVehHours
      : 0;
    assert.ok(Math.abs(expected - record.savedPct) < 1.5,
      `${record.id}: وفر معلن ${record.savedPct}٪ وحساب ${expected.toFixed(1)}٪`);
  });
  /* والمقايضات ليست القاعدة: لو صارت الغالبية، فالمحسّن يبيع التأخير رخيصاً. */
  assert.ok(tradeOffs.length <= records.length * 0.2,
    `${tradeOffs.length} من ${records.length} توصية ترفع التأخير — الوزن يبتلع الحساب`);
});

ok('الأثر المنشور هو أساس المحسِّن نفسه — لا حساب موازٍ', () => {
  // رقمان لنفس الكمية على بطاقة واحدة يقرؤهما المراجع تناقضاً.
  for (let i = 0; i < records.length; i += 37) {
    const record = records[i];
    const plan = Engine.optimize({
      aadt: record.aadt,
      lanes: record.lanes,
      lanesClosed: record.lanesClosed,
      startHour: new Date(record.start).getUTCHours(),
      durationHours: record.durationHours,
      capacityPerLane: Engine.DEFAULTS.capacityPerLane,
      freeFlowMin: Engine.DEFAULTS.freeFlowMin,
    });
    assert.strictEqual(Math.round(plan.baseline.delayVehHours), record.impactVehHours,
      `${record.id}: الأثر المنشور لا يطابق أساس المحسِّن`);
  }
});

ok('نص النافذة يُقرأ في ثانيتين — ساعتان وعدد', () => {
  const shape = /^\d{2}:00–\d{2}:00 · .+$/;
  records.forEach((record) => {
    assert.ok(shape.test(record.asIsWindow), `${record.id}: «${record.asIsWindow}»`);
    assert.ok(shape.test(record.bestWindow), `${record.id}: «${record.bestWindow}»`);
    assert.ok(record.bestWindow.length < 40, `${record.id}: نص نافذة أطول من بطاقة`);
  });
});

/* ---- الشدة والتصعيد قراران لا قرار ---- */

ok('طبقات الشدة الثلاث مأهولة — ولا واحدة تبتلع المحفظة', () => {
  const counts = { 1: 0, 2: 0, 3: 0 };
  records.forEach((record) => { counts[record.severity] += 1; });
  [1, 2, 3].forEach((level) => {
    assert.ok(counts[level] > 0, `طبقة الشدة ${level} خالية`);
    assert.ok(counts[level] < records.length * 0.7, `طبقة الشدة ${level} تبتلع المحفظة`);
  });
  assert.ok(counts[3] < counts[1], 'الأعلى شدة أكثر من الأدنى — هرم مقلوب');
});

ok('التصعيد مستقل عن الشدة — خروجٌ عن نطاق لا حجم أثر', () => {
  const escalated = records.filter((record) => record.escalate);
  assert.ok(escalated.length > 0, 'لا تصريح يستحق محاكاة متخصصة — البوابة مغلقة');
  assert.ok(escalated.some((record) => record.severity < 3),
    'كل مُصعَّد أعلى شدة — القراران ما زالا مدموجين');
});

ok('بوابة المدة تقيس عمر التصريح لا نافذته اليومية', () => {
  // النافذة اليومية لا تتجاوز ثماني ساعات، وعتبة التصعيد اثنتان وسبعون —
  // فمقارنتها بالنافذة تُبقي البوابة مغلقة أبداً.
  const gated = records.filter((record) => record.windowHours * record.workDays > 72
    && record.lanesClosed / record.lanes >= 0.5);
  assert.ok(gated.length > 0, 'لا حالة تستوفي شرط البوابة أصلاً');
  gated.forEach((record) => {
    assert.ok(record.escalate, `${record.id}: يستوفي شرط التصعيد ولا يحمله`);
  });
});

console.log(`\n${passed} اختبارات نجحت`);
