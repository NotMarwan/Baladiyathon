'use strict';
const assert = require('assert');
const path = require('path');
const Record = require(path.join(__dirname, '..', 'athar-decision-record.js'));

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

console.log(`\n${passed} اختبارات نجحت`);
