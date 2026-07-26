'use strict';

/**
 * Plain node:assert suite for Masar's independent innovation loops.
 * Run: node presentation/tests/innovation-test.js
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Demo = require(path.join(__dirname, '..', 'data', 'innovation-demo-data.js'));
const Boundary = require(path.join(__dirname, '..', 'masar-boundary.js'));
const Budget = require(path.join(__dirname, '..', 'masar-budget.js'));
const Reasons = require(path.join(__dirname, '..', 'masar-reasons.js'));
const Conflict = require(path.join(__dirname, '..', 'masar-conflict.js'));
const Memory = require(path.join(__dirname, '..', 'masar-memory.js'));

let count = 0;

function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

test('demo fixture labels every value set as an illustrative assumption', () => {
  assert.equal(Demo.meta.dataStatus, 'افتراض توضيحي للعرض');
  assert.equal(Demo.meta.methodologySource, 'src-021');
  assert.ok(Demo.meta.competitorSources.includes('src-024'));
  assert.ok(Demo.meta.competitorSources.includes('src-030'));
});

test('demo calibration history includes both low and severe errors', () => {
  assert.ok(Demo.memoryRecords.some((record) => record.absoluteErrorPct <= 5));
  assert.ok(Demo.memoryRecords.some((record) => record.absoluteErrorPct >= 30));
});

test('dynamic boundary expands when traffic grows and more lanes close', () => {
  const low = Boundary.calculate({
    workLengthMeters: 400,
    hourlyVolume: 1000,
    totalLanes: 4,
    lanesClosed: 1,
    capacityPerLane: 1800,
    provenance: Demo.meta,
  });
  const high = Boundary.calculate({
    workLengthMeters: 400,
    hourlyVolume: 6000,
    totalLanes: 4,
    lanesClosed: 3,
    capacityPerLane: 1800,
    provenance: Demo.meta,
  });

  assert.ok(high.radiusMeters > low.radiusMeters);
  assert.equal(high.components.length, 3);
  assert.equal(high.provenance.dataStatus, 'افتراض توضيحي للعرض');
});

test('dynamic boundary reports an auditable sum of its components', () => {
  const result = Boundary.calculate({
    ...Demo.boundary,
    provenance: Demo.meta,
  });
  const componentSum = result.components.reduce((sum, component) => sum + component.meters, 0);

  assert.equal(result.radiusMeters, Math.round(componentSum));
  assert.equal(result.baseRadiusMeters, Demo.boundary.workLengthMeters / 2);
  assert.match(result.method, /demand\/capacity/);
});

test('corridor budget reschedules a permit that exceeds the monthly ceiling', () => {
  const request = Demo.permits.find((permit) => permit.status === 'requested');
  const result = Budget.assess(request, Demo.permits, {
    monthlyBudgetVehHours: Demo.budget.monthlyBudgetVehHours,
    provenance: Demo.meta,
  });

  assert.equal(result.decision, 'reschedule');
  assert.equal(result.usedBefore, 5900);
  assert.equal(result.projectedUsage, 8700);
  assert.equal(result.remainingAfter, -700);
  assert.ok(result.suggestedStart.startsWith('2026-09'));
  assert.equal(result.provenance.dataStatus, 'افتراض توضيحي للعرض');
});

test('corridor budget accepts a request whose impact remains below the ceiling', () => {
  const request = Demo.permits.find((permit) => permit.status === 'requested');
  const result = Budget.assess(
    { ...request, delayVehHours: 1000 },
    Demo.permits,
    {
      monthlyBudgetVehHours: Demo.budget.monthlyBudgetVehHours,
      provenance: Demo.meta,
    }
  );

  assert.equal(result.decision, 'accept');
  assert.equal(result.projectedUsage, 6900);
  assert.equal(result.remainingAfter, 1100);
  assert.equal(result.suggestedStart, request.start);
});

test('corridor budget counts only accepted permits on the same corridor and month', () => {
  const request = Demo.permits.find((permit) => permit.status === 'requested');
  const septemberPermit = {
    ...Demo.permits[0],
    id: 'P-SEP',
    start: '2026-09-02T22:00:00+03:00',
    end: '2026-09-03T06:00:00+03:00',
    delayVehHours: 9999,
  };
  const result = Budget.assess(request, [...Demo.permits, septemberPermit], {
    monthlyBudgetVehHours: Demo.budget.monthlyBudgetVehHours,
    provenance: Demo.meta,
  });

  assert.equal(result.usedBefore, 5900);
});

test('quantitative explainer ranks the strongest measured candidate first', () => {
  const result = Reasons.explain(
    Demo.ranking.baseline,
    Demo.ranking.candidates,
    Demo.meta
  );
  const winner = result.ranked[0];

  assert.equal(winner.id, 'C-23');
  assert.equal(winner.rank, 1);
  assert.equal(winner.factors.length, 4);
  assert.ok(winner.factors.every((factor) => Number.isFinite(factor.delta)));
  assert.ok(winner.factors.every((factor) => Number.isFinite(factor.deltaPct)));
  assert.ok(winner.factors.every((factor) => Number.isFinite(factor.weightPct)));
  assert.ok(
    Math.abs(
      winner.factors.reduce((sum, factor) => sum + factor.weightPct, 0) - 100
    ) < 1e-9
  );
  assert.match(result.method, /no fixed factor weights/i);
});

test('quantitative explainer responds to changed candidate measurements', () => {
  const changed = Demo.ranking.candidates.map((candidate) =>
    candidate.id === 'C-08'
      ? {
          ...candidate,
          demandVehPerHour: 2000,
          queueVehHours: 600,
          busPersonHours: 80,
          corridorConflicts: 0,
        }
      : candidate
  );
  const result = Reasons.explain(Demo.ranking.baseline, changed, Demo.meta);

  assert.equal(result.ranked[0].id, 'C-08');
});

test('quantitative explainer returns numbers instead of templated reason strings', () => {
  const result = Reasons.explain(
    Demo.ranking.baseline,
    Demo.ranking.candidates,
    Demo.meta
  );

  assert.ok(result.ranked.every((candidate) => candidate.reasons === undefined));
  assert.ok(
    result.ranked.every((candidate) =>
      candidate.factors.every(
        (factor) =>
          typeof factor.baseline === 'number' &&
          typeof factor.candidate === 'number' &&
          typeof factor.unit === 'string'
      )
    )
  );
});

test('multi-permit conflict analysis builds a symmetric N by N matrix', () => {
  const result = Conflict.analyze(Demo.permits, {
    coordinationWindowHours: 72,
    provenance: Demo.meta,
  });

  assert.equal(result.matrix.length, Demo.permits.length);
  assert.ok(
    result.matrix.every((row) => row.length === Demo.permits.length)
  );
  assert.equal(result.matrix[0][1].temporalOverlapHours, 7);
  assert.equal(result.matrix[0][1].sharedSegmentCount, 1);
  assert.deepEqual(result.matrix[0][1], result.matrix[1][0]);
  assert.ok(result.matrix.every((row, index) => row[index].exposure === 0));
});

test('multi-permit conflict analysis reports conflicts and Dig-Once groups', () => {
  const result = Conflict.analyze(Demo.permits, {
    coordinationWindowHours: 72,
    provenance: Demo.meta,
  });

  assert.ok(
    result.conflicts.some(
      (item) => item.pair.includes('P-101') && item.pair.includes('P-102')
    )
  );
  assert.ok(
    result.digOnceGroups.some(
      (group) =>
        group.permitIds.includes('P-101') &&
        group.permitIds.includes('P-102')
    )
  );
  assert.ok(result.interactionRatio > 1);
  assert.match(result.interactionDerivation, /overlap-hours/);
});

test('multi-permit interaction ratio is derived from overlap instead of 1.3', () => {
  const noOverlap = Demo.permits.map((permit, index) => ({
    ...permit,
    routeSegments: [`UNIQUE-${index}`],
  }));
  const result = Conflict.analyze(noOverlap, {
    coordinationWindowHours: 72,
    provenance: Demo.meta,
  });

  assert.equal(result.interactionRatio, 1);
  assert.notEqual(result.interactionRatio, 1.3);
});

test('Dig-Once grouping responds to the supplied coordination window', () => {
  const narrow = Conflict.analyze(Demo.permits, {
    coordinationWindowHours: 72,
    provenance: Demo.meta,
  });
  const wide = Conflict.analyze(Demo.permits, {
    coordinationWindowHours: 400,
    provenance: Demo.meta,
  });
  const narrowLargest = Math.max(
    ...narrow.digOnceGroups.map((group) => group.permitIds.length)
  );
  const wideLargest = Math.max(
    ...wide.digOnceGroups.map((group) => group.permitIds.length)
  );

  assert.ok(wideLargest > narrowLargest);
});

test('calibration memory derives correction from observed and predicted totals', () => {
  const result = Memory.calibrate(Demo.memoryRecords, {
    successThresholdPct: 15,
    provenance: Demo.meta,
  });

  assert.ok(
    Math.abs(result.correctionFactor - 6130 / 5400) < 1e-12
  );
  assert.equal(result.method, 'sum(observedVehHours) / sum(predictedVehHours)');
  assert.notEqual(result.correctionFactor, 0.35);
  assert.notEqual(result.correctionFactor, 1.3);
});

test('calibration memory improves aggregate error without hiding regressions', () => {
  const result = Memory.calibrate(Demo.memoryRecords, {
    successThresholdPct: 15,
    provenance: Demo.meta,
  });

  assert.equal(result.beforeMapePct, 21);
  assert.ok(result.afterMapePct < result.beforeMapePct);
  assert.ok(result.casesImproved > 0);
  assert.ok(result.casesWorsened > 0);
});

test('calibration memory keeps successful and failed cases visible', () => {
  const result = Memory.calibrate(Demo.memoryRecords, {
    successThresholdPct: 15,
    provenance: Demo.meta,
  });

  assert.ok(result.verdictCounts.before.success > 0);
  assert.ok(result.verdictCounts.before.failure > 0);
  assert.ok(result.verdictCounts.after.success > 0);
  assert.ok(result.verdictCounts.after.failure > 0);
  assert.ok(result.records.every((record) => record.beforeVerdict));
  assert.ok(result.records.every((record) => record.afterVerdict));
});

test('calibration judgments respond to the supplied success threshold', () => {
  const strict = Memory.calibrate(Demo.memoryRecords, {
    successThresholdPct: 15,
    provenance: Demo.meta,
  });
  const broad = Memory.calibrate(Demo.memoryRecords, {
    successThresholdPct: 35,
    provenance: Demo.meta,
  });

  assert.ok(
    broad.verdictCounts.before.success > strict.verdictCounts.before.success
  );
});

test('offline lab contains every innovation scene and local dependency', () => {
  const labPath = path.join(__dirname, '..', 'masar-lab.html');
  const lab = fs.readFileSync(labPath, 'utf8');
  const localAssets = [
    'masar-engine.js',
    'masar-boundary.js',
    'masar-budget.js',
    'masar-reasons.js',
    'masar-conflict.js',
    'masar-memory.js',
    'innovation-demo-data.js',
  ];
  const scenes = [
    'boundary-scene',
    'budget-scene',
    'reasons-scene',
    'conflict-scene',
    'memory-scene',
  ];

  localAssets.forEach((asset) =>
    assert.ok(lab.includes(asset), `missing local asset ${asset}`)
  );
  scenes.forEach((scene) =>
    assert.ok(lab.includes(`id="${scene}"`), `missing scene ${scene}`)
  );
  assert.ok(!/src=["']https?:\/\//.test(lab), 'lab must not request scripts');
  assert.ok(!/href=["']https?:\/\//.test(lab), 'lab must not request styles');
  assert.ok(lab.includes('افتراض توضيحي للعرض'));
});

test('offline lab exposes live controls and honest competitive positioning', () => {
  const lab = fs.readFileSync(
    path.join(__dirname, '..', 'masar-lab.html'),
    'utf8'
  );

  [
    'boundary-volume',
    'budget-request-impact',
    'ranking-bus-impact',
    'coordination-hours',
    'success-threshold',
  ].forEach((id) =>
    assert.ok(lab.includes(`id="${id}"`), `missing live control ${id}`)
  );
  assert.ok(lab.includes('سنغافورة'));
  assert.ok(lab.includes('one.network'));
  assert.ok(lab.includes('السياق السعودي'));
  assert.ok(!lab.includes('الأول عالميًا'));
  assert.ok(!lab.includes('الوحيد'));
});

console.log(`ALL INNOVATION TESTS PASSED (${count})`);
