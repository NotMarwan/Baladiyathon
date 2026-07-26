'use strict';
const assert = require('assert');
const path = require('path');
const States = require(path.join(__dirname, '..', 'masar-desk-states.js'));

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

/* ---- التوجيه مقابل الحكم: ما يجوز أتمتته ---- */

ok('لا إجراء يترتّب عليه حكم يُصنَّف توجيهاً', () => {
  // القاعدة: ما يمكن أتمتته هو ما لا يندم عليه المراجع.
  ['approve', 'reject', 'return', 'escalate', 'schedule', 'publish', 'suspend', 'close']
    .forEach((action) => {
      assert.ok(!States.isRouting(action),
        `${action} مصنّف توجيهاً — أتمتته تتخذ قراراً بالنيابة عن المراجع`);
    });
});

ok('كل إجراء توجيه موجود فعلاً في جدول الانتقالات', () => {
  States.ROUTING_ACTIONS.forEach((action) => {
    assert.ok(States.ACTION_TARGET[action], `إجراء توجيه لا وجود له: ${action}`);
    assert.ok(States.isRouting(action));
  });
});

ok('التصنيف يقسم الحالات قسمين، ومراجعة القرار في اليدوي', () => {
  // هذا هو العقد الذي يعتمد عليه مفتاح D في المكتب.
  const auto = [];
  const manual = [];

  Object.keys(States.LABELS).forEach((status) => {
    const actions = States.actionsFor(status);
    if (!actions.length) return;
    (actions.length === 1 || States.isRouting(actions[0]) ? auto : manual).push(status);
  });

  assert.ok(auto.length > 0 && manual.length > 0,
    'التصنيف انهار إلى طرف واحد — إمّا كله آلي أو كله يدوي');
  assert.ok(manual.indexOf('StrategyReview') !== -1,
    'مراجعة القرار تُؤتمت — وهي بالضبط ما يجب أن يقف عنده المراجع');
});

/* ---- المسار الرئيس: «أين أنا؟» ---- */

/**
 * جدول المراحل ليس وصفاً موازياً للآلة — هو مسارٌ داخلها.
 * لو كُتب يدوياً ولم يُفحص، لعرض المكتب طريقاً لا يسلكه النظام: مراحل لا
 * انتقال بينها، ورقمٌ من كلٍّ لا معنى له.
 */
ok('كل انتقال في المسار الرئيس مشروع في آلة الحالة', () => {
  for (let i = 0; i + 1 < States.PIPELINE.length; i += 1) {
    const from = States.PIPELINE[i];
    const to = States.PIPELINE[i + 1];
    assert.ok(States.can(from, to),
      `المسار يزعم انتقالاً غير مشروع: ${from} ← ${to}`);
  }
});

ok('كل حالة إمّا على المسار أو مسنَدة إليه بسبب معلن', () => {
  Object.keys(States.TRANSITIONS).forEach((status) => {
    const onPath = States.PIPELINE.indexOf(status) !== -1;
    const off = States.OFF_PATH[status];
    assert.ok(onPath || off, `حالة بلا موقع من المسار: ${status}`);
    if (off) {
      assert.ok(States.PIPELINE.indexOf(off.at) !== -1,
        `${status}: مسنَدة إلى محطة ليست على المسار`);
      assert.ok(off.note, `${status}: خارج المسار بلا سبب معلن`);
    }
  });
});

ok('موقع الحالة يُقرأ رقماً واسماً — والخارج عن المسار يقول سببه', () => {
  const onPath = States.stage('StrategyReview');
  assert.strictEqual(onPath.index, 4);
  assert.strictEqual(onPath.total, States.PIPELINE.length);
  assert.strictEqual(onPath.onPath, true);
  assert.strictEqual(onPath.note, '');
  assert.strictEqual(onPath.label, 'مراجعة القرار');

  const off = States.stage('CoordinationRequired');
  assert.strictEqual(off.onPath, false);
  assert.ok(off.note, 'الخارج عن المسار بلا سبب');
  assert.strictEqual(off.index, States.PIPELINE.indexOf('ImpactScreening') + 1);
});

ok('حالة مجهولة لا تكسر المؤشر', () => {
  const unknown = States.stage('لا-توجد');
  assert.strictEqual(unknown.index, 0);
});

console.log(`\n${passed} اختبارات نجحت`);
