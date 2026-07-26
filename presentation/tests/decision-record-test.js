'use strict';
const assert = require('assert');
const path = require('path');
const Record = require(path.join(__dirname, '..', 'masar-decision-record.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const WORK = {
  id: 'p001', permitRef: 'BLD-2026-0001', status: 'StrategyReview',
  confidence: 'low', escalate: true, version: 1,
};
const INPUT = {
  aadt: 80000, lanes: 4, lanesClosed: 2, startHour: 8, durationHours: 8,
  windowHours: 8, workDays: 18, capacityPerLane: 1800, freeFlowMin: 6,
  خارج_العقد: 'يجب أن يُسقط',
};
const ANALYSIS = {
  scored: { delayVehHours: 940, delayPct: 42.5, level: 'high' },
  alternatives: [{ label: 'كتلة ليلية', delayVehHours: 310, savedPct: 67 }],
  reasons: ['نافذة خارج الذروة', 'مرحلة واحدة', 'تفادي الذروة', 'رابع يُقصّ'],
  conflicts: [{ withRef: 'BLD-2026-0099', withId: 'p099', overlapHours: 12 }],
  delta: -67,
};
const EVENT = {
  version: 2, action: 'approve', from: 'StrategyReview', to: 'Approved',
  actor: 'مراجع أول', reason: 'الأثر ضمن الحد', at: '2026-07-25T10:00:00Z',
};

function record(overrides) {
  return Object.assign(Record.create(WORK, ANALYSIS, EVENT, INPUT), overrides || {});
}

/* ---- بناء السجل ---- */

ok('السجل يثبّت نسخة المدخلات — بلاها لا اعتماد', () => {
  const out = Record.create(WORK, ANALYSIS, EVENT, INPUT);
  Record.INPUT_FIELDS.forEach((field) => {
    assert.strictEqual(out.inputs[field], INPUT[field], `حقل مدخلات مفقود: ${field}`);
  });
});

ok('نسخة المدخلات لا تحمل حقولاً خارج العقد', () => {
  const out = Record.create(WORK, ANALYSIS, EVENT, INPUT);
  assert.strictEqual(out.inputs['خارج_العقد'], undefined);
  assert.deepStrictEqual(Object.keys(out.inputs).sort(), Record.INPUT_FIELDS.slice().sort());
});

ok('السجل يحمل التوصية والمطلوب والفرق', () => {
  const out = Record.create(WORK, ANALYSIS, EVENT, INPUT);
  assert.strictEqual(out.recommendation.label, 'كتلة ليلية');
  assert.strictEqual(out.asked.delayVehHours, 940);
  assert.strictEqual(out.delta, -67);
});

ok('الأسباب تُقصّ عند ثلاثة', () => {
  assert.strictEqual(Record.create(WORK, ANALYSIS, EVENT, INPUT).reasons.length, 3);
});

ok('السجل يحفظ الثقة وعلامة التصعيد — لا يُقرأ لاحقاً كقرار واثق', () => {
  const out = Record.create(WORK, ANALYSIS, EVENT, INPUT);
  assert.strictEqual(out.confidence, 'low');
  assert.strictEqual(out.escalated, true);
});

ok('السجل يحمل التوقيع والوقت من الحدث لا من الساعة', () => {
  const out = Record.create(WORK, ANALYSIS, EVENT, INPUT);
  assert.strictEqual(out.actor, 'مراجع أول');
  assert.strictEqual(out.at, '2026-07-25T10:00:00Z');
});

ok('غياب البدائل يُسجَّل امتناعاً لا توصيةً فارغة', () => {
  const out = Record.create(WORK, { scored: null, alternatives: [] }, EVENT, INPUT);
  assert.strictEqual(out.recommendation, null);
  assert.strictEqual(out.asked, null);
});

/* ---- التراكم ---- */

ok('الإضافة تراكم لا استبدال', () => {
  const list = Record.append(Record.append([], record({ version: 2 })), record({ version: 3 }));
  assert.deepStrictEqual(list.map((r) => r.version), [2, 3]);
});

ok('إعادة كتابة النسخة نفسها تستبدلها ولا تكرّرها', () => {
  const list = Record.append([record({ version: 2, actor: 'أ' })], record({ version: 2, actor: 'ب' }));
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].actor, 'ب');
});

ok('الإضافة تحفظ الترتيب بالنسخة مهما كان ترتيب الوصول', () => {
  const list = Record.append(Record.append([], record({ version: 5 })), record({ version: 3 }));
  assert.deepStrictEqual(list.map((r) => r.version), [3, 5]);
});

ok('أحدث نسخة هي الحالة السارية', () => {
  const list = [record({ version: 2, status: 'Approved' }), record({ version: 4, status: 'Scheduled' })];
  assert.strictEqual(Record.latest(list).status, 'Scheduled');
});

ok('لا سجلات يعني لا حالة سارية', () => {
  assert.strictEqual(Record.latest([]), null);
});

/* ---- التخزين ---- */

ok('الحفظ والاسترجاع دورة مغلقة', () => {
  const byWork = { p001: [record({ version: 2 })] };
  assert.deepStrictEqual(Record.deserialize(Record.serialize(byWork)), byWork);
});

ok('مخزَّن تالف يعود فارغاً ولا يرمي', () => {
  ['', 'ليس JSON', '{', '[]', 'null'].forEach((text) => {
    assert.deepStrictEqual(Record.deserialize(text), {});
  });
});

ok('مخزَّن من إصدار مخطط مختلف يُتجاهل', () => {
  const stale = JSON.stringify({ schema: 99, works: { p001: [record()] } });
  assert.deepStrictEqual(Record.deserialize(stale), {});
});

ok('سجل مشوّه داخل مخزَّن سليم يُسقط وحده', () => {
  const mixed = JSON.stringify({
    schema: Record.SCHEMA_VERSION,
    works: { p001: [record({ version: 2 }), { لا: 'شيء' }] },
  });
  const out = Record.deserialize(mixed);
  assert.strictEqual(out.p001.length, 1);
});

/* ---- الاسترجاع على المحفظة ---- */

function feature(id, status) {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[46.6, 24.7], [46.7, 24.8]] },
    properties: { id: id, permitRef: 'BLD-' + id, status: status, version: 1, street: 'طريق أ' },
  };
}

ok('الاسترجاع يفرض الحالة والنسخة من السجل', () => {
  const restored = Record.restore([feature('p001', 'StrategyReview')], {
    p001: [record({ version: 3, status: 'Scheduled', at: '2026-07-25T10:00:00Z' })],
  });
  assert.strictEqual(restored[0].properties.status, 'Scheduled');
  assert.strictEqual(restored[0].properties.version, 3);
  assert.strictEqual(restored[0].properties.decidedBy, 'مراجع أول');
});

ok('الاسترجاع لا يمس عملاً بلا سجل', () => {
  const restored = Record.restore([feature('p002', 'ImpactScreening')], { p001: [record()] });
  assert.strictEqual(restored[0].properties.status, 'ImpactScreening');
  assert.strictEqual(restored[0].properties.version, 1);
});

ok('الاسترجاع لا يعدّل الميزة الأصلية ولا يفقد هندستها', () => {
  const original = feature('p001', 'StrategyReview');
  const snapshot = JSON.stringify(original);
  const restored = Record.restore([original], { p001: [record({ version: 2, status: 'Approved' })] });
  assert.strictEqual(JSON.stringify(original), snapshot, 'الأصل تغيّر');
  assert.deepStrictEqual(restored[0].geometry, original.geometry);
});

ok('العدّاد يفصل الأعمال عن القرارات', () => {
  const counts = Record.counts({
    p001: [record({ version: 2 }), record({ version: 3 })],
    p002: [record({ version: 2 })],
  });
  assert.strictEqual(counts.works, 2);
  assert.strictEqual(counts.decisions, 3);
});

/* ---- التراجع: تصحيحٌ مقيَّد لا محوٌ ---- */

ok('السجل يحفظ الحالة السابقة — بدونها لا تراجع', () => {
  assert.strictEqual(Record.create(WORK, ANALYSIS, EVENT, INPUT).from, 'StrategyReview');
});

ok('التراجع يعيد العمل إلى حالته قبل القرار الأخير', () => {
  const spec = Record.undoSpec([record()]);
  assert.strictEqual(spec.allowed, true);
  assert.strictEqual(spec.spec.toStatus, 'StrategyReview');
  assert.strictEqual(spec.spec.fromStatus, 'Approved');
  assert.strictEqual(spec.spec.undoneVersion, 2);
  assert.strictEqual(spec.spec.nextVersion, 3);
});

ok('التراجع يستهدف آخر نسخة لا أيّ نسخة', () => {
  // التراجع عن نسخة وسطى يترك ما بعدها معلّقاً على حالة لم تعد قائمة.
  const trail = [
    record({ version: 2, status: 'Approved', from: 'StrategyReview', action: 'approve' }),
    record({ version: 3, status: 'Scheduled', from: 'Approved', action: 'schedule' }),
  ];
  assert.strictEqual(Record.undoSpec(trail).spec.undoneVersion, 3);
  assert.strictEqual(Record.undoSpec(trail).spec.toStatus, 'Approved');
});

ok('الترتيب في المصفوفة لا يحدّد الأخير — رقم النسخة يحدّده', () => {
  const shuffled = [
    record({ version: 3, status: 'Scheduled', from: 'Approved' }),
    record({ version: 2, status: 'Approved', from: 'StrategyReview' }),
  ];
  assert.strictEqual(Record.undoSpec(shuffled).spec.undoneVersion, 3);
});

ok('عمل بلا قرار لا يُتراجَع عنه ويُقال السبب', () => {
  const none = Record.undoSpec([]);
  assert.strictEqual(none.allowed, false);
  assert.ok(none.reason.indexOf('لا قرار مسجَّل') !== -1);
  assert.strictEqual(Record.undoSpec(null).allowed, false);
});

ok('سجل قديم بلا حالة سابقة يُرفض تراجعه بسبب مكتوب', () => {
  // القرارات المقيَّدة قبل إتاحة التراجع لا تحمل from؛ التخمين هنا يكتب حالة
  // لم تقع، والرفض المعلَّل أصدق.
  const old = Record.undoSpec([record({ from: null })]);
  assert.strictEqual(old.allowed, false);
  assert.ok(old.reason.indexOf('قبل إتاحة التراجع') !== -1);
});

ok('سجل التراجع نسخة جديدة تُضاف ولا تحذف ما قبلها', () => {
  const trail = [record()];
  const spec = Record.undoSpec(trail).spec;
  const undo = Record.createUndo(WORK, spec, 'مناوب الفرز', '2026-07-25T11:00:00Z');
  const after = Record.append(trail, undo);

  assert.strictEqual(after.length, 2, 'التراجع ابتلع القرار بدل أن يعوّضه');
  assert.strictEqual(after[0].action, 'approve');
  assert.strictEqual(after[1].action, 'undo');
});

ok('سجل التراجع يسمّي ما تراجع عنه ونسخته', () => {
  const spec = Record.undoSpec([record()]).spec;
  const undo = Record.createUndo(WORK, spec, 'مناوب الفرز', '2026-07-25T11:00:00Z');
  assert.ok(undo.reason.indexOf('approve') !== -1, 'لا يذكر الإجراء المُتراجَع عنه');
  assert.ok(undo.reason.indexOf('2') !== -1, 'لا يذكر النسخة');
  assert.strictEqual(undo.actor, 'مناوب الفرز');
});

ok('التراجع لا يدّعي مدخلات ولا توصية — لم يُعد حساباً', () => {
  const spec = Record.undoSpec([record()]).spec;
  const undo = Record.createUndo(WORK, spec, 'م', '2026-07-25T11:00:00Z');
  assert.deepStrictEqual(undo.inputs, {});
  assert.strictEqual(undo.recommendation, null);
  assert.strictEqual(undo.asked, null);
});

ok('سجل التراجع صالح ويعبر التخزين', () => {
  const spec = Record.undoSpec([record()]).spec;
  const undo = Record.createUndo(WORK, spec, 'م', '2026-07-25T11:00:00Z');
  assert.strictEqual(Record.isValid(undo), true);

  const back = Record.deserialize(Record.serialize({ p001: [record(), undo] }));
  assert.strictEqual(back.p001.length, 2);
  assert.strictEqual(back.p001[1].action, 'undo');
});

ok('الاستعادة تُرجع العمل إلى الحالة السابقة بعد التراجع', () => {
  const spec = Record.undoSpec([record()]).spec;
  const undo = Record.createUndo(WORK, spec, 'م', '2026-07-25T11:00:00Z');
  const features = [{ type: 'Feature', geometry: null, properties: Object.assign({}, WORK) }];

  const restored = Record.restore(features, { p001: [record(), undo] });
  assert.strictEqual(restored[0].properties.status, 'StrategyReview');
  assert.strictEqual(restored[0].properties.version, 3);
});

ok('التراجع عن التراجع يعيد القرار — ولا يفقد أثر أيّهما', () => {
  const first = record();
  const spec = Record.undoSpec([first]).spec;
  const undo = Record.createUndo(WORK, spec, 'م', '2026-07-25T11:00:00Z');

  const redoSpec = Record.undoSpec([first, undo]);
  assert.strictEqual(redoSpec.allowed, true);
  assert.strictEqual(redoSpec.spec.toStatus, 'Approved', 'لا يعود إلى القرار');
  assert.strictEqual(redoSpec.spec.undoneAction, 'undo');
});

console.log(`\n${passed} اختبارات نجحت`);
