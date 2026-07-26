'use strict';
/**
 * بوابة تصنيف الاستقرار والامتناع.
 *
 * أخطر ما يمكن أن يحدث لهذا الملف أن يُعدَّل حتى «تتحسّن» الأرقام. والبوابات
 * هنا مكتوبة لتجعل ذلك فشلاً: عتباتٌ لا تُرخى، وامتناعٌ لا يُخفى، وحالة
 * «مستقرّة» لا تُمنح لتوصية يقلبها افتراض.
 *
 * التشغيل: node presentation/tests/stability-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;

const Engine = require(path.join(ROOT, 'athar-engine.js'));
const Sensitivity = require(path.join(ROOT, 'athar-sensitivity.js'));
const Stability = require(path.join(ROOT, 'athar-stability.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const INPUT = {
  aadt: 79347, lanes: 4, lanesClosed: 1, startHour: 8, durationHours: 142,
  capacityPerLane: Engine.DEFAULTS.capacityPerLane,
  freeFlowMin: Engine.DEFAULTS.freeFlowMin, sensitivity: 'normal',
};

/** جدول حساسية مصنوع يدوياً — لفحص المصنِّف وحده لا المحرك. */
function fakeTornado(flips, widestSwing, levelFlips) {
  const rows = [];
  for (let i = 0; i < 8; i += 1) {
    rows.push({
      key: 'k' + i, label: 'افتراض ' + i, kind: 'محسوب',
      why: 'اختبار',
      swingPct: i === 0 ? widestSwing : 1,
      lowImpactVehHours: 100, highImpactVehHours: 400,
      changesRecommendation: i < flips,
      changesLevel: i < (levelFlips || 0),
      winners: { low: 'a', high: 'b' },
    });
  }
  return { rows };
}

// ---- الحالات الأربع ------------------------------------------------------

test('الحالات الأربع موجودة، ونصفها فقط قابل للقرار', () => {
  const keys = Object.keys(Stability.STATES);
  assert.deepStrictEqual(keys.sort(),
    ['conditional', 'fragile', 'insufficient', 'stable']);
  assert.strictEqual(Stability.STATES.stable.decidable, true);
  assert.strictEqual(Stability.STATES.conditional.decidable, true);
  assert.strictEqual(Stability.STATES.fragile.decidable, false);
  assert.strictEqual(Stability.STATES.insufficient.decidable, false);
});

test('كل حالة تحمل معناها وما يُفعل عندها', () => {
  Object.keys(Stability.STATES).forEach((key) => {
    const state = Stability.STATES[key];
    assert.ok(state.meaning.length > 20, `${key}: بلا معنى`);
    assert.ok(state.action.length > 15, `${key}: بلا إجراء — تصنيفٌ بلا أثر`);
  });
});

test('الامتناع نصّ واحد يُقرأ من مكان واحد', () => {
  assert.match(Stability.ABSTENTION, /غير مستقرة عبر نطاق الافتراضات/);
  assert.match(Stability.ABSTENTION, /بيانات إضافية أو مراجعة خبير/);
});

// ---- التصنيف -------------------------------------------------------------

test('صفر انقلاب وتأرجح ضيّق = مستقرّة', () => {
  const verdict = Stability.classify(INPUT, { tornado: fakeTornado(0, 10, 0) });
  assert.strictEqual(verdict.state, 'stable');
  assert.strictEqual(verdict.decidable, true);
  assert.strictEqual(verdict.abstention, '');
});

test('انقلاب واحد = هشّة، ولو كان التأرجح ضئيلاً', () => {
  /* الهشاشة خاصية الترتيب لا خاصية الرقم. توصيةٌ تنقلب بافتراض واحد لا
     تصير متينة لأن الرقم لم يتحرك كثيراً. */
  const verdict = Stability.classify(INPUT, { tornado: fakeTornado(1, 5, 0) });
  assert.strictEqual(verdict.state, 'fragile');
  assert.strictEqual(verdict.decidable, false);
  assert.strictEqual(verdict.abstention, Stability.ABSTENTION);
});

test('ثلاثة انقلابات مستقلة = أدلة غير كافية', () => {
  const verdict = Stability.classify(INPUT, { tornado: fakeTornado(3, 5, 0) });
  assert.strictEqual(verdict.state, 'insufficient');
  assert.strictEqual(verdict.decidable, false);
});

test('ترتيب صامد وحجم متأرجح = مستقرّة بشرط لا مستقرّة', () => {
  const verdict = Stability.classify(INPUT, { tornado: fakeTornado(0, 300, 0) });
  assert.strictEqual(verdict.state, 'conditional');
  assert.strictEqual(verdict.decidable, true);
  assert.match(verdict.reason, /يُعرض مدىً لا رقماً/);
});

test('كل حالة غير قابلة للقرار تحمل رسالة الامتناع، وكل قابلة لا تحملها', () => {
  [[0, 5, 0], [0, 300, 0], [1, 5, 0], [4, 5, 0]].forEach((shape) => {
    const verdict = Stability.classify(INPUT, { tornado: fakeTornado.apply(null, shape) });
    if (verdict.decidable) {
      assert.strictEqual(verdict.abstention, '',
        `${verdict.state}: قابلة للقرار وتعرض امتناعاً`);
    } else {
      assert.strictEqual(verdict.abstention, Stability.ABSTENTION,
        `${verdict.state}: تمتنع بلا رسالة`);
    }
  });
});

// ---- حجم الأثر -----------------------------------------------------------

test('حجم الأثر يُعرض مدىً حتى مع ترتيب مستقرّ', () => {
  const verdict = Stability.classify(INPUT, { tornado: fakeTornado(0, 300, 0) });
  assert.ok(verdict.magnitude, 'بلا وصف لحجم عدم اليقين');
  assert.strictEqual(verdict.magnitude.defensible, false);
  assert.ok(verdict.magnitude.lowVehHours < verdict.magnitude.highVehHours);
  assert.match(verdict.magnitude.note, /غير قابل للدفاع عنه مفرداً/);
});

test('كل افتراض يقلب توصية يحمل البيانات التي تضيّقه', () => {
  const verdict = Stability.classify(INPUT, { tornado: fakeTornado(2, 5, 0) });
  verdict.flippingAssumptions.forEach((item) => {
    assert.ok(item.dataNeeded && item.dataNeeded.length > 10,
      `${item.key}: هشاشة بلا طلب — تُقرأ عجزاً لا أمر عمل`);
  });
});

test('كل افتراض حقيقي في وحدة الحساسية له طلب بيانات مسمّى', () => {
  /* افتراضٌ يقلب التوصية وليس له سطر في جدول الطلب يجعل المراجع يقرأ
     «هشّة» بلا أن يعرف ما يطلب. */
  Sensitivity.ASSUMPTIONS.forEach((assumption) => {
    const need = Stability.dataNeededFor(assumption.key);
    assert.ok(need.indexOf('غير محدَّد') === -1,
      `${assumption.key}: بلا طلب بيانات في جدول DATA_NEEDED`);
  });
});

// ---- المحفظة -------------------------------------------------------------

test('المحفظة كاملة مصنَّفة — لا عيّنة', () => {
  const report = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'stability-report.json'), 'utf8'));
  assert.strictEqual(report.total, 150);
  assert.strictEqual(report.rows.length, 150);
  const sum = Object.keys(report.counts)
    .reduce((total, key) => total + report.counts[key], 0);
  assert.strictEqual(sum, 150, 'مجموع التصنيفات لا يساوي المحفظة');
});

test('نسبة الامتناع معلَنة ولا تُخفى', () => {
  const report = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'stability-report.json'), 'utf8'));
  assert.ok(report.abstained > 0,
    'صفر امتناع عبر 150 حالة — راجع العتبات، لا احتفل');
  assert.strictEqual(report.abstained + report.decidable, report.total);
  assert.ok(report.abstainedShare >= 1);
});

test('كل صف ممتنع يحمل سببه ورسالته', () => {
  const report = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'stability-report.json'), 'utf8'));
  report.rows.filter((row) => !row.decidable).forEach((row) => {
    assert.ok(row.reason && row.reason.length > 15, `${row.permitRef}: امتناع بلا سبب`);
    assert.ok(row.abstention, `${row.permitRef}: امتناع بلا رسالة`);
  });
});

test('التقرير يرتّب طلب البيانات بأثره لا بسهولته', () => {
  const report = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'stability-report.json'), 'utf8'));
  assert.ok(report.dataAsks.length >= 3);
  for (let i = 1; i < report.dataAsks.length; i += 1) {
    assert.ok(report.dataAsks[i - 1].flipsRecommendations
      >= report.dataAsks[i].flipsRecommendations, 'الترتيب ليس بالأثر');
  }
  report.dataAsks.forEach((ask) => {
    assert.ok(ask.dataNeeded.length > 10, `${ask.assumption}: طلب بلا وصف`);
  });
});

test('التقرير المكتوب يطابق التشغيل الحيّ', () => {
  const report = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'stability-report.json'), 'utf8'));
  const portfolio = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8'));

  /* عيّنة لا كامل: التصنيف يستدعي المحرك عشرين مرة لكل تصريح، والمحفظة
     كاملة تجعل الحزمة دقائق. العيّنة تكشف التقادم، والتقرير الكامل يُولَّد
     بسكربته. */
  const sample = portfolio.features.slice(0, 12);
  sample.forEach((feature) => {
    const properties = feature.properties;
    const live = Stability.classify({
      aadt: properties.aadt, lanes: properties.lanes,
      lanesClosed: properties.lanesClosed,
      startHour: new Date(properties.start).getUTCHours(),
      durationHours: properties.durationHours,
      capacityPerLane: Engine.DEFAULTS.capacityPerLane,
      freeFlowMin: Engine.DEFAULTS.freeFlowMin,
      sensitivity: properties.sensitivity || 'normal',
    });
    const stored = report.rows.find((row) => row.permitRef === properties.permitRef);
    assert.ok(stored, `${properties.permitRef}: غائب عن التقرير`);
    assert.strictEqual(stored.state, live.state,
      `${properties.permitRef}: التقرير متقادم — أعِد توليده`);
  });
});

// ---- ما لا يجوز فعله بالعتبات --------------------------------------------

test('العتبات لم تُرخَ — انقلاب واحد يكفي للهشاشة', () => {
  /* أسهل طريق لتحسين الأرقام: جعل `fragileFlips = 2`. عندها تصير كل توصية
     يقلبها افتراض واحد «مستقرّة»، وترتفع الحصيلة بلا بيانات جديدة. */
  assert.strictEqual(Stability.THRESHOLDS.fragileFlips, 1,
    'عتبة الهشاشة أُرخيت — الأرقام تحسّنت بلا بيانات');
  assert.ok(Stability.THRESHOLDS.insufficientFlips <= 3);
  assert.ok(Stability.THRESHOLDS.conditionalSwingPct <= 50);
});

test('لا حالة «مستقرّة» تُمنح لتوصية يقلبها افتراض', () => {
  const report = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'stability-report.json'), 'utf8'));
  report.rows.filter((row) => row.state === 'stable').forEach((row) => {
    assert.strictEqual(row.flipping.length, 0,
      `${row.permitRef}: «مستقرّة» وفيها ${row.flipping.length} انقلاب`);
  });
});

console.log(`ALL TESTS PASSED (${count})`);
