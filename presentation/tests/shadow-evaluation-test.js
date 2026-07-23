'use strict';

const assert = require('node:assert');
const Shadow = require('../athar-shadow-evaluation.js');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const protocol = {
  minMeasuredCases: 3,
  maxMapePct: 20,
  minBenefitVehHours: 100,
  maxTransitBreaches: 0,
  maxCriticalAccessBreaches: 0,
};

function shadowCase(overrides) {
  return {
    permitId: 'M-1',
    kind: 'measured',
    predictedVehHours: 90,
    observedVehHours: 100,
    counterfactualVehHours: 150,
    transitBreach: false,
    criticalAccessBreach: false,
    ...overrides,
  };
}

function passingMeasuredCases() {
  return [
    shadowCase({ permitId: 'M-1', predictedVehHours: 90, observedVehHours: 100, counterfactualVehHours: 150 }),
    shadowCase({ permitId: 'M-2', predictedVehHours: 120, observedVehHours: 110, counterfactualVehHours: 165 }),
    shadowCase({ permitId: 'M-3', predictedVehHours: 85, observedVehHours: 80, counterfactualVehHours: 140 }),
  ];
}

test('synthetic cases never satisfy the measured evidence threshold', () => {
  const result = Shadow.evaluateShadowPilot([
    shadowCase({ permitId: 'S-1', kind: 'synthetic', observedVehHours: 75, counterfactualVehHours: 140 }),
    shadowCase({ permitId: 'S-2', kind: 'synthetic', observedVehHours: 85, counterfactualVehHours: 150 }),
    shadowCase({ permitId: 'S-3', kind: 'synthetic', observedVehHours: 65, counterfactualVehHours: 135 }),
  ], protocol);

  assert.strictEqual(result.status, 'insufficient-evidence');
  assert.strictEqual(result.measuredCases, 0);
  assert.strictEqual(result.syntheticCases, 3);
  assert.strictEqual(result.maeVehHours, null);
  assert.strictEqual(result.mapePct, null);
  assert.strictEqual(result.totalObservedBenefitVehHours, null);
});

test('three measured cases pass only when every threshold passes', () => {
  const result = Shadow.evaluateShadowPilot(passingMeasuredCases(), protocol);

  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(result.measuredCases, 3);
  assert.strictEqual(result.syntheticCases, 0);
  assert.strictEqual(result.totalObservedBenefitVehHours, 165);
  assert.ok(Math.abs(result.maeVehHours - (25 / 3)) < 1e-9);
  assert.ok(result.mapePct <= 20);
  assert.deepStrictEqual(result.violations, []);
});

test('critical access breach is a hard failure even when numeric thresholds pass', () => {
  const cases = passingMeasuredCases();
  cases[0] = { ...cases[0], criticalAccessBreach: true };
  const result = Shadow.evaluateShadowPilot(cases, protocol);

  assert.strictEqual(result.status, 'fail');
  assert.ok(result.violations.includes('critical-access-breach'));
});

test('one measured case stays insufficient beside many synthetic cases', () => {
  const cases = [
    shadowCase({ permitId: 'M-1' }),
    ...Array.from({ length: 20 }, (_, index) => shadowCase({
      permitId: `S-${index + 1}`,
      kind: 'synthetic',
    })),
  ];
  const result = Shadow.evaluateShadowPilot(cases, protocol);

  assert.strictEqual(result.status, 'insufficient-evidence');
  assert.strictEqual(result.measuredCases, 1);
  assert.strictEqual(result.syntheticCases, 20);
  assert.ok(result.violations.includes('insufficient-measured-cases'));
});

test('MAPE above the protocol threshold fails', () => {
  const cases = passingMeasuredCases().map((item, index) => ({
    ...item,
    predictedVehHours: item.observedVehHours * (index === 0 ? 1.4 : 1.3),
  }));
  const result = Shadow.evaluateShadowPilot(cases, protocol);

  assert.strictEqual(result.status, 'fail');
  assert.ok(result.mapePct > protocol.maxMapePct);
  assert.ok(result.violations.includes('mape-threshold'));
});

test('observed benefit below the protocol threshold fails', () => {
  const cases = passingMeasuredCases().map((item) => ({
    ...item,
    counterfactualVehHours: item.observedVehHours + 20,
  }));
  const result = Shadow.evaluateShadowPilot(cases, protocol);

  assert.strictEqual(result.status, 'fail');
  assert.strictEqual(result.totalObservedBenefitVehHours, 60);
  assert.ok(result.violations.includes('benefit-threshold'));
});

test('public transport breach above the allowed maximum fails', () => {
  const cases = passingMeasuredCases();
  cases[1] = { ...cases[1], transitBreach: true };
  const result = Shadow.evaluateShadowPilot(cases, protocol);

  assert.strictEqual(result.status, 'fail');
  assert.ok(result.violations.includes('transit-breach'));
});

test('zero observed value is visible as a data violation and never produces infinity', () => {
  const cases = passingMeasuredCases();
  cases[0] = {
    ...cases[0],
    predictedVehHours: 10,
    observedVehHours: 0,
    counterfactualVehHours: 80,
  };
  const result = Shadow.evaluateShadowPilot(cases, protocol);

  assert.strictEqual(result.status, 'fail');
  assert.ok(result.violations.includes('zero-observed-value'));
  assert.ok(result.mapePct === null || Number.isFinite(result.mapePct));
});

test('negative numeric input fails validation before arithmetic', () => {
  const result = Shadow.evaluateShadowPilot([
    shadowCase({ predictedVehHours: -1 }),
  ], protocol);

  assert.strictEqual(result.status, 'fail');
  assert.strictEqual(result.maeVehHours, null);
  assert.ok(result.violations.includes('invalid-predictedVehHours-0'));
});

test('unknown case kind fails validation', () => {
  const validation = Shadow.validateShadowCases([
    shadowCase({ kind: 'historical' }),
  ], protocol);

  assert.strictEqual(validation.valid, false);
  assert.ok(validation.errors.includes('invalid-kind-0'));
});

test('duplicate permit id fails validation', () => {
  const validation = Shadow.validateShadowCases([
    shadowCase({ permitId: 'DUP-1' }),
    shadowCase({ permitId: 'DUP-1' }),
  ], protocol);

  assert.strictEqual(validation.valid, false);
  assert.ok(validation.errors.includes('duplicate-permit-DUP-1'));
});

test('missing protocol field fails validation', () => {
  const incompleteProtocol = { ...protocol };
  delete incompleteProtocol.maxMapePct;
  const validation = Shadow.validateShadowCases(passingMeasuredCases(), incompleteProtocol);

  assert.strictEqual(validation.valid, false);
  assert.ok(validation.errors.includes('invalid-protocol-maxMapePct'));
});

test('signed bias preserves positive direction', () => {
  const cases = [10, 20, 30].map((error, index) => shadowCase({
    permitId: `P-${index + 1}`,
    predictedVehHours: 100 + error,
    observedVehHours: 100,
    counterfactualVehHours: 150,
  }));
  const result = Shadow.evaluateShadowPilot(cases, protocol);

  assert.strictEqual(result.signedBiasVehHours, 20);
});

test('signed bias preserves negative direction', () => {
  const cases = [10, 20, 30].map((error, index) => shadowCase({
    permitId: `N-${index + 1}`,
    predictedVehHours: 100 - error,
    observedVehHours: 100,
    counterfactualVehHours: 150,
  }));
  const result = Shadow.evaluateShadowPilot(cases, protocol);

  assert.strictEqual(result.signedBiasVehHours, -20);
});

test('synthetic safety flags do not enter measured pass or fail metrics', () => {
  const result = Shadow.evaluateShadowPilot([
    ...passingMeasuredCases(),
    shadowCase({
      permitId: 'S-1',
      kind: 'synthetic',
      transitBreach: true,
      criticalAccessBreach: true,
    }),
  ], protocol);

  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(result.measuredCases, 3);
  assert.strictEqual(result.syntheticCases, 1);
  assert.deepStrictEqual(result.violations, []);
});

console.log(`ALL SHADOW EVALUATION TESTS PASSED (${count})`);
