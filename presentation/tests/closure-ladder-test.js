'use strict';
/**
 * سلّم استمرارية الخدمة — `masar-closure-ladder.js`.
 * ---------------------------------------------------------------------------
 * ما يُختبر: أن السلّم **عرضُ قرارٍ فوق المحرك لا محركٌ ثانٍ** — كل تأخير
 * فيه يساوي حرفياً ما يعيده `MasarEngine.score` لنفس المُدخل، وأن قاعدة
 * «البديل يقيّد التصريح» تعمل في الاتجاهين: بديلٌ يمرّ يفتح الإغلاق الكامل،
 * ولا بديل يهبط بالتوصية درجةً ويعلن ثمن الهبوط.
 */
const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const Engine = require(path.join(ROOT, 'masar-engine.js'));
const Ladder = require(path.join(ROOT, 'masar-closure-ladder.js'));

/** تصريح العرض القياسي — نفس افتراضات المحرك المعلنة. */
const PERMIT = {
  aadt: Engine.DEFAULTS.aadt,
  lanes: Engine.DEFAULTS.lanes, // 4
  freeFlowMin: Engine.DEFAULTS.freeFlowMin,
  startHour: 22,
  durationHours: 48,
};

/* ---- بناء السلّم ---- */

ok('طريق بأربع حارات: أربع درجات متمايزة تصاعدياً 1..4', () => {
  const ladder = Ladder.buildLadder(PERMIT);
  assert.deepStrictEqual(
    ladder.steps.map((s) => s.lanesClosed), [1, 2, 3, 4]);
  assert.deepStrictEqual(
    ladder.steps.map((s) => s.lanesOpen), [3, 2, 1, 0]);
});

ok('طريق بحارتين: الدرجات تُدمج بمفاتيحها لا تتكرر برقم واحد', () => {
  const ladder = Ladder.buildLadder({ ...PERMIT, lanes: 2 });
  assert.strictEqual(ladder.steps.length, 2);
  const first = ladder.steps[0];
  // نصف العرض = إبقاء حارة = حارة واحدة — درجة واحدة بأسمائها الثلاثة
  assert.deepStrictEqual(first.keys.sort(), [
    Ladder.STEPS.HALF_WIDTH, Ladder.STEPS.KEEP_ONE_LANE, Ladder.STEPS.SINGLE_LANE,
  ].sort());
  assert.strictEqual(ladder.steps[1].keys[0], Ladder.STEPS.FULL);
});

ok('كل درجة تساوي حرفياً ناتج MasarEngine.score — لا محرك ثانٍ', () => {
  const ladder = Ladder.buildLadder(PERMIT);
  ladder.steps.forEach((step) => {
    const direct = Engine.score({ ...PERMIT, lanesClosed: step.lanesClosed });
    assert.strictEqual(step.delayVehHours, direct.delayVehHours,
      `درجة ${step.lanesClosed}: تأخير مختلف عن المحرك`);
    assert.strictEqual(step.score, direct.score);
    assert.strictEqual(step.level, direct.level);
  });
});

ok('التأخير لا ينقص كلما أُغلق أكثر — رتابة السلّم', () => {
  const ladder = Ladder.buildLadder(PERMIT);
  for (let i = 1; i < ladder.steps.length; i += 1) {
    assert.ok(ladder.steps[i].delayVehHours >= ladder.steps[i - 1].delayVehHours,
      `درجة ${ladder.steps[i].lanesClosed} أقل تأخيراً من ${ladder.steps[i - 1].lanesClosed}`);
  }
});

ok('شروط الاستمرارية: المشاة والإسعاف في كل درجة، والدوران المحلي والبديل للكامل وحده', () => {
  const ladder = Ladder.buildLadder(PERMIT);
  ladder.steps.forEach((step) => {
    Ladder.BASE_CONDITIONS.forEach((condition) => {
      assert.ok(step.conditions.indexOf(condition) !== -1,
        `درجة ${step.lanesClosed} بلا شرط: ${condition}`);
    });
  });
  const full = ladder.steps[ladder.steps.length - 1];
  Ladder.FULL_CLOSURE_CONDITIONS.forEach((condition) => {
    assert.ok(full.conditions.indexOf(condition) !== -1, 'الكامل بلا شرطه');
    ladder.steps.slice(0, -1).forEach((partial) => {
      assert.ok(partial.conditions.indexOf(condition) === -1,
        'شرط الكامل تسرّب إلى درجة جزئية');
    });
  });
  // حارة مفتوحة واحدة = تشغيل بالتناوب
  const keepOne = ladder.steps.find((s) => s.lanesOpen === 1);
  assert.ok(keepOne.conditions.some((c) => c.indexOf('بالتناوب') !== -1));
});

ok('الافتراضات معلنة: مصدر الحساب، وفحص الجدوى الميداني، وموضع البُعد الزمني', () => {
  const ladder = Ladder.buildLadder(PERMIT);
  assert.ok(ladder.assumptions.some((a) => a.indexOf('MasarEngine.score') !== -1));
  assert.ok(ladder.assumptions.some((a) => a.indexOf('ميداني') !== -1));
  assert.ok(ladder.assumptions.some((a) => a.indexOf('optimize') !== -1));
});

ok('مُدخل بلا حارات صحيحة يُرفض بخطأ مسمّى لا برقم صامت', () => {
  assert.throws(() => Ladder.buildLadder({ ...PERMIT, lanes: 0 }), RangeError);
  assert.throws(() => Ladder.buildLadder({ ...PERMIT, lanes: 2.5 }), RangeError);
  assert.throws(() => Ladder.buildLadder(null), RangeError);
});

/* ---- التوصية: البديل يقيّد التصريح ---- */

const FAILING_AUDIT = {
  ok: true,
  alternatives: [
    { policy: { verdict: 'fail', violations: [] } },
    { policy: { verdict: 'fail', violations: [] } },
  ],
};
const PASSING_AUDIT = {
  ok: true,
  alternatives: [
    { policy: { verdict: 'fail', violations: [] } },
    { policy: { verdict: 'warn', violations: [] } },
  ],
};

ok('طلب جزئي يُجاز كما طُلب — الشارع يخدم مكانه', () => {
  const ladder = Ladder.buildLadder(PERMIT);
  const out = Ladder.recommend(ladder, 2, null);
  assert.strictEqual(out.mode, 'as-requested');
  assert.strictEqual(out.step.lanesClosed, 2);
});

ok('طلب كامل وبديل يمرّ (ولو بتحذير) = يُجاز الكامل بشرطه', () => {
  const ladder = Ladder.buildLadder(PERMIT);
  const out = Ladder.recommend(ladder, 4, PASSING_AUDIT);
  assert.strictEqual(out.mode, 'as-requested');
  assert.strictEqual(out.step.lanesClosed, 4);
  assert.ok(out.reason.indexOf('بوابات السلامة') !== -1);
});

ok('طلب كامل ولا بديل يمرّ = هبوط إلى إبقاء حارة، والثمن معلَن وغير سالب', () => {
  const ladder = Ladder.buildLadder(PERMIT);
  const out = Ladder.recommend(ladder, 4, FAILING_AUDIT);
  assert.strictEqual(out.mode, 'stepped-down');
  assert.strictEqual(out.step.lanesOpen, 1);
  assert.ok(typeof out.savedVehHours === 'number' && out.savedVehHours >= 0,
    `ثمن الهبوط ${out.savedVehHours}`);
  assert.ok(out.reason.indexOf('البديل يقيّد التصريح') !== -1);
});

ok('غياب التدقيق كلياً يعامَل كغياب بديل — الحذر افتراضي لا استثناء', () => {
  const ladder = Ladder.buildLadder(PERMIT);
  assert.strictEqual(Ladder.recommend(ladder, 4, null).mode, 'stepped-down');
  assert.strictEqual(Ladder.recommend(ladder, 4, { ok: false }).mode, 'stepped-down');
});

ok('طريق بحارة واحدة ولا بديل: لا جزئي يُنزَل إليه — إحالة إلى الجدولة', () => {
  const ladder = Ladder.buildLadder({ ...PERMIT, lanes: 1 });
  const out = Ladder.recommend(ladder, 1, FAILING_AUDIT);
  assert.strictEqual(out.mode, 'schedule-only');
  assert.strictEqual(out.step, null);
  assert.ok(out.reason.indexOf('optimize') !== -1);
});

ok('طلب خارج نطاق حارات الطريق يُرفض بخطأ', () => {
  const ladder = Ladder.buildLadder(PERMIT);
  assert.throws(() => Ladder.recommend(ladder, 0, null), RangeError);
  assert.throws(() => Ladder.recommend(ladder, 5, null), RangeError);
});

console.log(`\n${passed} passed`);
