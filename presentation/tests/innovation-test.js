'use strict';

/**
 * Plain node:assert suite for Athar's independent innovation loops.
 * Run: node presentation/tests/innovation-test.js
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const Demo = require(path.join(__dirname, '..', 'data', 'innovation-demo-data.js'));
const Boundary = require(path.join(__dirname, '..', 'athar-boundary.js'));
const Budget = require(path.join(__dirname, '..', 'athar-budget.js'));

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

console.log(`ALL INNOVATION TESTS PASSED (${count})`);
