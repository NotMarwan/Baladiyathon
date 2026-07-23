'use strict';

/**
 * Plain node:assert suite for Athar's independent innovation loops.
 * Run: node presentation/tests/innovation-test.js
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const Demo = require(path.join(__dirname, '..', 'data', 'innovation-demo-data.js'));
const Boundary = require(path.join(__dirname, '..', 'athar-boundary.js'));

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

console.log(`ALL INNOVATION TESTS PASSED (${count})`);
