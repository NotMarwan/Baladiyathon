'use strict';
const assert = require('assert');
const path = require('path');
const States = require(path.join(__dirname, '..', 'athar-desk-states.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

function work(props) {
  return Object.assign({
    id: 'w1', permitRef: 'BLD-0001', status: 'ImpactScreening',
    start: '2026-07-22T06:00:00Z', end: '2026-07-24T06:00:00Z',
    lanes: 4, lanesClosed: 1, direction: 'شمال',
    impactVehHours: 120, version: 1, inputsVersion: 'v1',
  }, props || {});
}

ok('الانتقالات تطابق آلة الحالة المعتمدة', () => {
  assert.ok(States.can('ImpactScreening', 'StrategyReview'));
  assert.ok(States.can('StrategyReview', 'Approved'));
  assert.ok(States.can('StrategyReview', 'Returned'));
  assert.ok(States.can('Approved', 'Scheduled'));
  assert.ok(!States.can('ImpactScreening', 'Approved'), 'قفزة فوق مراجعة القرار');
  assert.ok(!States.can('Closed', 'Draft'), 'رجوع من حالة نهائية');
});

ok('كل حالة تحمل تسمية عربية ورمزاً ونبرة — لا لون وحده', () => {
  Object.keys(States.TRANSITIONS).forEach((status) => {
    const label = States.LABELS[status];
    assert.ok(label, `حالة بلا تسمية: ${status}`);
    assert.ok(label.label && label.icon && label.tone, `تسمية ناقصة: ${status}`);
  });
});

ok('كل هدف انتقال حالة معرَّفة — لا وجهة يتيمة', () => {
  Object.keys(States.TRANSITIONS).forEach((from) => {
    States.TRANSITIONS[from].forEach((to) => {
      assert.ok(States.TRANSITIONS[to] !== undefined, `وجهة غير معرّفة: ${from} → ${to}`);
    });
  });
});

ok('لا اعتماد بلا نسخة مدخلات', () => {
  const result = States.guard(work({ status: 'StrategyReview', inputsVersion: null }), 'approve');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.blockers.some((b) => b.field === 'inputsVersion'));
});

ok('لا نشر بلا زمن انتهاء', () => {
  const result = States.guard(work({ status: 'Scheduled', end: null }), 'publish');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.blockers.some((b) => b.field === 'end'));
});

ok('لا نشر بلا اتجاه', () => {
  const result = States.guard(work({ status: 'Scheduled', direction: null }), 'publish');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.blockers.some((b) => b.field === 'direction'));
});

ok('المسارات المغلقة لا تتجاوز الكلية', () => {
  const result = States.guard(work({ status: 'StrategyReview', lanesClosed: 5, lanes: 4 }), 'approve');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.blockers.some((b) => b.field === 'lanesClosed'));
});

ok('نافذة زمنية معكوسة تُمنع', () => {
  const result = States.guard(work({
    status: 'StrategyReview',
    start: '2026-07-24T06:00:00Z',
    end: '2026-07-22T06:00:00Z',
  }), 'approve');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.blockers.some((b) => b.field === 'end'));
});

ok('العمل المكتمل يمرّ من الحارس', () => {
  const result = States.guard(work({ status: 'StrategyReview' }), 'approve');
  assert.strictEqual(result.allowed, true);
  assert.deepStrictEqual(result.blockers, []);
});

ok('الإرجاع مسموح حتى لو نقصت المدخلات — النقص سببه', () => {
  const result = States.guard(work({ status: 'StrategyReview', inputsVersion: null }), 'return');
  assert.strictEqual(result.allowed, true);
});

ok('إجراء مجهول يُرفض ولا يُنفَّذ بصمت', () => {
  const result = States.guard(work(), 'يحذف-كل-شيء');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.blockers.some((b) => b.reason === 'unknown-action'));
});

ok('كل عائق يحمل رسالة عربية قابلة للعرض', () => {
  const result = States.guard(work({ status: 'StrategyReview', inputsVersion: null }), 'approve');
  result.blockers.forEach((blocker) => {
    assert.ok(typeof blocker.message === 'string' && blocker.message.length > 4,
      `عائق بلا رسالة: ${blocker.field}`);
  });
});

ok('التطبيق يرفع رقم النسخة ولا يعدّل الأصل', () => {
  const original = work({ status: 'StrategyReview' });
  const snapshot = JSON.stringify(original);
  const result = States.apply(original, 'approve', 'مراجع أول', 'الأثر ضمن الحد');
  assert.strictEqual(JSON.stringify(original), snapshot, 'الأصل تغيّر');
  assert.strictEqual(result.work.version, 2);
  assert.strictEqual(result.work.status, 'Approved');
});

ok('الإجراء التالي يتحدث مع الحالة الجديدة', () => {
  const result = States.apply(work({ status: 'StrategyReview' }), 'approve', 'مراجع', 'ok');
  assert.strictEqual(result.work.nextAction, States.nextAction('Approved'));
});

ok('كل تطبيق ينتج حدث تدقيق كامل', () => {
  const result = States.apply(work({ status: 'StrategyReview' }), 'approve', 'مراجع أول', 'ضمن الحد');
  const event = result.event;
  ['entity', 'version', 'action', 'from', 'to', 'actor', 'reason', 'at'].forEach((field) => {
    assert.ok(field in event, `حدث التدقيق ينقصه ${field}`);
  });
  assert.strictEqual(event.from, 'StrategyReview');
  assert.strictEqual(event.to, 'Approved');
  assert.strictEqual(event.entity, 'BLD-0001');
});

ok('وقت الحدث يُحقن من المستدعي — الدالة نقية', () => {
  const at = '2026-07-25T10:00:00Z';
  const result = States.apply(work({ status: 'StrategyReview' }), 'approve', 'مراجع', 'ok', at);
  assert.strictEqual(result.event.at, at);
  assert.strictEqual(result.work.decidedAt, at);
});

ok('التطبيق المحظور يرمي ولا يغيّر شيئاً بصمت', () => {
  assert.throws(() => {
    States.apply(work({ status: 'StrategyReview', inputsVersion: null }), 'approve', 'مراجع', 'x');
  }, /blocked/);
});

ok('الإجراء التالي معرّف لكل حالة عاملة', () => {
  ['CompletenessReview', 'ImpactScreening', 'CoordinationRequired', 'StrategyReview',
    'Approved', 'Scheduled', 'Deployed'].forEach((status) => {
    assert.ok(States.nextAction(status).length > 2, `لا إجراء تالٍ لـ ${status}`);
  });
});

ok('الإجراءات المتاحة تُشتق من الحالة لا تُكتب يدوياً', () => {
  assert.deepStrictEqual(States.actionsFor('StrategyReview').sort(), ['approve', 'reject', 'return']);
  assert.deepStrictEqual(States.actionsFor('Approved'), ['schedule']);
  assert.deepStrictEqual(States.actionsFor('Calibrated'), []);
});

ok('كل حالة غير نهائية لها إجراء واحد على الأقل — لا طريق مسدود', () => {
  var terminal = ['Calibrated', 'Rejected'];
  Object.keys(States.TRANSITIONS).forEach((status) => {
    if (terminal.indexOf(status) !== -1) return;
    assert.ok(States.actionsFor(status).length > 0,
      `حالة بلا مخرج — العمل يعلق عندها: ${status}`);
  });
});

console.log(`\n${passed} اختبارات نجحت`);
