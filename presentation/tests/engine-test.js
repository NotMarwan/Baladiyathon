'use strict';
/**
 * Plain node:assert test suite for AtharEngine.
 * Run: node presentation/tests/engine-test.js
 * No frameworks. Throws on first failure; prints ALL TESTS PASSED (n) on success.
 */

const assert = require('node:assert');
const path = require('node:path');

const AtharEngine = require(path.join(__dirname, '..', 'athar-engine.js'));
const Calib = require(path.join(__dirname, '..', 'athar-impact-calibration.js'));
const Budget = require(path.join(__dirname, '..', 'athar-impact-budget.js'));

function memStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
  };
}

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

// ---------------------------------------------------------------------------
// HOURLY_PROFILE / DEFAULTS basic shape checks
// ---------------------------------------------------------------------------

test('HOURLY_PROFILE has 24 entries summing to ~1.0', () => {
  assert.strictEqual(AtharEngine.HOURLY_PROFILE.length, 24);
  const sum = AtharEngine.HOURLY_PROFILE.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1.0) < 1e-9, `sum was ${sum}`);
});

test('DEFAULTS carries expected demo constants', () => {
  assert.strictEqual(AtharEngine.DEFAULTS.aadt, 85000);
  assert.strictEqual(AtharEngine.DEFAULTS.lanes, 4);
  assert.strictEqual(AtharEngine.DEFAULTS.capacityPerLane, 1800);
  assert.strictEqual(AtharEngine.DEFAULTS.freeFlowMin, 6);
  assert.strictEqual(AtharEngine.DEFAULTS.lengthKm, 4.2);
  assert.strictEqual(AtharEngine.DEFAULTS.valueOfTimeSAR, 45);
  assert.strictEqual(AtharEngine.DEFAULTS.idleFuelLPerHour, 0.9);
  assert.strictEqual(AtharEngine.DEFAULTS.co2KgPerL, 2.31);
  assert.strictEqual(AtharEngine.DEFAULTS.trenchCostPerKmSAR, 850000);
});

// ---------------------------------------------------------------------------
// bprTravelTime
// ---------------------------------------------------------------------------

test('bprTravelTime returns freeFlowMin at zero volume', () => {
  const t = AtharEngine.bprTravelTime(6, 0, 7200);
  assert.strictEqual(t, 6);
});

test('bprTravelTime increases with volume/capacity ratio', () => {
  const low = AtharEngine.bprTravelTime(6, 1000, 7200);
  const high = AtharEngine.bprTravelTime(6, 7000, 7200);
  assert.ok(high > low, `expected high(${high}) > low(${low})`);
});

test('bprTravelTime matches BPR formula exactly for a sample point', () => {
  const t0 = 6;
  const v = 3600;
  const c = 7200;
  const expected = t0 * (1 + 0.15 * Math.pow(v / c, 4));
  const actual = AtharEngine.bprTravelTime(t0, v, c);
  assert.ok(Math.abs(actual - expected) < 1e-9);
});

// ---------------------------------------------------------------------------
// score() — numeric sanity from the plan
// ---------------------------------------------------------------------------

test('Night closure (startHour 23) delay < day closure (startHour 8) for same inputs', () => {
  const base = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    durationHours: 4,
  };
  const night = AtharEngine.score({ ...base, startHour: 23 });
  const day = AtharEngine.score({ ...base, startHour: 8 });
  assert.ok(
    night.delayVehHours < day.delayVehHours,
    `night(${night.delayVehHours}) should be < day(${day.delayVehHours})`
  );
});

test('More lanesClosed => more delay, monotonic', () => {
  const base = {
    aadt: 85000,
    lanes: 4,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 4,
  };
  const d0 = AtharEngine.score({ ...base, lanesClosed: 0 }).delayVehHours;
  const d1 = AtharEngine.score({ ...base, lanesClosed: 1 }).delayVehHours;
  const d2 = AtharEngine.score({ ...base, lanesClosed: 2 }).delayVehHours;
  const d3 = AtharEngine.score({ ...base, lanesClosed: 3 }).delayVehHours;
  assert.ok(d0 <= d1, `d0(${d0}) <= d1(${d1})`);
  assert.ok(d1 <= d2, `d1(${d1}) <= d2(${d2})`);
  assert.ok(d2 <= d3, `d2(${d2}) <= d3(${d3})`);
});

test('score() with 0 lanesClosed => delayVehHours = 0, score = 0', () => {
  const r = AtharEngine.score({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 0,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 4,
  });
  assert.strictEqual(r.delayVehHours, 0);
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.level, 'low');
});

test('score() level buckets match the real engine output across severities', () => {
  // يستدعي score() الحقيقية (لا نسخة محلية من المنطق) عبر مدخلات متدرجة
  // الشدة، ويتحقق أن level المُرجَع يطابق حدود score المُرجَع نفسه.
  const bucketOf = (s) => (s < 25 ? 'low' : s < 60 ? 'medium' : 'high');
  const severities = [
    { lanesClosed: 0, startHour: 3, durationHours: 2 },
    { lanesClosed: 1, startHour: 3, durationHours: 4 },
    { lanesClosed: 2, startHour: 8, durationHours: 12 },
    { lanesClosed: 3, startHour: 8, durationHours: 48 },
    { lanesClosed: 4, startHour: 8, durationHours: 72 },
  ];
  const seen = new Set();
  severities.forEach((sv) => {
    const r = AtharEngine.score({
      aadt: 85000, lanes: 4, capacityPerLane: 1800, freeFlowMin: 6,
      lanesClosed: sv.lanesClosed, startHour: sv.startHour, durationHours: sv.durationHours,
    });
    assert.strictEqual(r.level, bucketOf(r.score),
      `level ${r.level} != bucket of score ${r.score} for ${JSON.stringify(sv)}`);
    seen.add(r.level);
  });
  assert.ok(seen.size >= 2, `expected at least 2 distinct levels, saw: ${[...seen]}`);
});

test('score() hourly breakdown length matches durationHours', () => {
  const r = AtharEngine.score({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 6,
  });
  assert.strictEqual(r.hourly.length, 6);
});

// ---------------------------------------------------------------------------
// Edge cases: duration>24h hour wrapping
// ---------------------------------------------------------------------------

test('durationHours > 24 wraps hours correctly (h % 24)', () => {
  const inputBase = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
  };
  const r48 = AtharEngine.score({ ...inputBase, startHour: 8, durationHours: 48 });
  assert.strictEqual(r48.hourly.length, 48);
  // hour 24 into the closure should wrap back to startHour (8) demand-wise
  const hour0 = r48.hourly[0];
  const hour24 = r48.hourly[24];
  assert.ok(Math.abs(hour0.delayVehHours - hour24.delayVehHours) < 1e-9,
    `wrapped hour delay mismatch: ${hour0.delayVehHours} vs ${hour24.delayVehHours}`);
});

test('durationHours = 30 starting at hour 20 wraps past midnight (h%24) with matching profile fractions', () => {
  const r = AtharEngine.score({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 1,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 20,
    durationHours: 30,
  });
  assert.strictEqual(r.hourly.length, 30);
  // hour index 4 => absolute hour 24 => wraps to 0
  assert.strictEqual(r.hourly[4].hour, 0);
  // hour index 29 => absolute hour 49 => wraps to 1
  assert.strictEqual(r.hourly[29].hour, 1);
});

// ---------------------------------------------------------------------------
// Edge cases: lanesClosed == lanes capacity floor
// ---------------------------------------------------------------------------

test('lanesClosed == lanes applies capacity floor (0.25*capacityPerLane), stays finite', () => {
  const r = AtharEngine.score({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 4,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 2,
  });
  assert.ok(Number.isFinite(r.delayVehHours));
  assert.ok(r.delayVehHours > 0);
  assert.ok(Number.isFinite(r.score));
});

test('lanesClosed > lanes is clamped to the same capacity floor as lanesClosed == lanes', () => {
  const base = {
    aadt: 85000,
    lanes: 4,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 2,
  };
  const atLanes = AtharEngine.score({ ...base, lanesClosed: 4 }).delayVehHours;
  const overLanes = AtharEngine.score({ ...base, lanesClosed: 6 }).delayVehHours;
  assert.ok(Math.abs(atLanes - overLanes) < 1e-9, `expected floor clamp equal: ${atLanes} vs ${overLanes}`);
});

// ---------------------------------------------------------------------------
// Edge case: zero lanesClosed => zero delay (duplicate emphasis + multiple hours)
// ---------------------------------------------------------------------------

test('zero lanesClosed => zero delay across multi-hour, multi-day closures', () => {
  const r = AtharEngine.score({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 0,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 5,
    durationHours: 36,
  });
  assert.strictEqual(r.delayVehHours, 0);
  r.hourly.forEach((h) => assert.strictEqual(h.delayVehHours, 0));
});

// ---------------------------------------------------------------------------
// optimize()
// ---------------------------------------------------------------------------

test('optimize().top3[0].delayVehHours <= baseline.delayVehHours', () => {
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 4,
  };
  const result = AtharEngine.optimize(input);
  assert.ok(result.top3.length === 3, `expected 3 candidates, got ${result.top3.length}`);
  assert.ok(
    result.top3[0].delayVehHours <= result.baseline.delayVehHours,
    `top3[0](${result.top3[0].delayVehHours}) should be <= baseline(${result.baseline.delayVehHours})`
  );
});

test('optimize() top3 sorted ascending by delayVehHours', () => {
  const result = AtharEngine.optimize({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 4,
  });
  assert.ok(result.top3[0].delayVehHours <= result.top3[1].delayVehHours);
  assert.ok(result.top3[1].delayVehHours <= result.top3[2].delayVehHours);
});

test('optimize() each candidate has label, startHour, phases, reasons[3]', () => {
  const result = AtharEngine.optimize({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 4,
  });
  result.top3.forEach((c) => {
    assert.strictEqual(typeof c.label, 'string');
    assert.strictEqual(typeof c.startHour, 'number');
    assert.ok([1, 2].includes(c.phases));
    assert.strictEqual(typeof c.delayVehHours, 'number');
    assert.strictEqual(typeof c.savedVehHours, 'number');
    assert.strictEqual(typeof c.savedPct, 'number');
    assert.ok(Array.isArray(c.reasons));
    assert.strictEqual(c.reasons.length, 3);
    c.reasons.forEach((r) => assert.strictEqual(typeof r, 'string'));
  });
});

test('optimize() 48h continuous baseline is NOT vacuous: night-window candidate saves >20% and >1000 veh-hours', () => {
  // Regression test for the critical engine bug: durations that are
  // multiples of 24h used to make startHour irrelevant because candidates
  // were modeled as continuous blocks (a 48h continuous block covers every
  // clock hour regardless of start time). Candidates must now be modeled
  // as nightly work windows so a night-shifted schedule genuinely reduces
  // delay relative to the requested (day-start) baseline.
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 48,
  };
  const result = AtharEngine.optimize(input);
  assert.ok(
    result.top3[0].savedPct > 20,
    `expected savedPct > 20, got ${result.top3[0].savedPct}`
  );
  assert.ok(
    result.top3[0].savedVehHours > 1000,
    `expected savedVehHours > 1000, got ${result.top3[0].savedVehHours}`
  );
});

test('optimize() windowed night candidate (startHour 23) beats a continuous day block (startHour 8) for a multi-day duration', () => {
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 48,
  };
  const totalDuration = input.durationHours;
  const nights = Math.ceil(totalDuration / 8); // WORK_WINDOW_HOURS
  const nightWindow = AtharEngine.score({ ...input, startHour: 23, durationHours: 8 });
  const nightWindowedDelay = nightWindow.delayVehHours * nights;
  const dayContinuous = AtharEngine.score({ ...input, startHour: 8, durationHours: totalDuration });
  assert.ok(
    nightWindowedDelay < dayContinuous.delayVehHours,
    `expected windowed night delay(${nightWindowedDelay}) < continuous day delay(${dayContinuous.delayVehHours})`
  );
});

test('optimize() durationHours=6 (< work window) still returns 3 valid candidates with savedVehHours >= 0', () => {
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 6,
  };
  const result = AtharEngine.optimize(input);
  assert.strictEqual(result.top3.length, 3);
  result.top3.forEach((c) => {
    assert.ok(Number.isFinite(c.savedVehHours));
    assert.ok(c.savedVehHours >= 0, `expected savedVehHours >= 0, got ${c.savedVehHours}`);
    assert.ok(Number.isFinite(c.delayVehHours));
  });
});

test('optimize() top3 candidate return shape keys are unchanged', () => {
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 48,
  };
  const result = AtharEngine.optimize(input);
  const expectedKeys = ['label', 'startHour', 'phases', 'delayVehHours', 'savedVehHours', 'savedPct', 'reasons'].sort();
  result.top3.forEach((c) => {
    assert.deepStrictEqual(Object.keys(c).sort(), expectedKeys);
  });
  assert.deepStrictEqual(Object.keys(result.baseline).sort(), ['delayVehHours']);
  assert.deepStrictEqual(Object.keys(result).sort(), ['baseline', 'top3'].sort());
});

// ---------------------------------------------------------------------------
// co2()
// ---------------------------------------------------------------------------

test('co2: fuelL = vehHours*0.9 exactly with defaults', () => {
  const r = AtharEngine.co2(10);
  assert.strictEqual(r.fuelL, 9);
  assert.ok(Math.abs(r.co2Kg - 9 * 2.31) < 1e-9);
});

test('co2(0) => fuelL 0, co2Kg 0', () => {
  const r = AtharEngine.co2(0);
  assert.strictEqual(r.fuelL, 0);
  assert.strictEqual(r.co2Kg, 0);
});

// ---------------------------------------------------------------------------
// calibration loop
// ---------------------------------------------------------------------------

test('calibration: empty store => factor 1, n 0', () => {
  const c = Calib.createCalibration(memStore());
  assert.deepStrictEqual(c.status(), { n: 0, factor: 1 });
});

test('calibration: median of observed/predicted ratios', () => {
  const c = Calib.createCalibration(memStore());
  c.record({ permitId: 'a', predictedVehHours: 100, observedVehHours: 110 });
  c.record({ permitId: 'b', predictedVehHours: 100, observedVehHours: 120 });
  c.record({ permitId: 'c', predictedVehHours: 100, observedVehHours: 130 });
  assert.strictEqual(c.correctionFactor(), 1.2);
  assert.strictEqual(c.status().n, 3);
});

test('calibration: rejects non-positive prediction, persists via store', () => {
  const store = memStore();
  const c = Calib.createCalibration(store);
  assert.strictEqual(c.record({ permitId: 'x', predictedVehHours: 0, observedVehHours: 5 }), false);
  assert.strictEqual(c.status().n, 0);
  c.record({ permitId: 'y', predictedVehHours: 200, observedVehHours: 180 });
  // a fresh instance over the same store sees the persisted record
  const c2 = Calib.createCalibration(store);
  assert.strictEqual(c2.status().n, 1);
  assert.strictEqual(c2.correctionFactor(), 0.9);
});

// ---------------------------------------------------------------------------
// corridor impact budget
// ---------------------------------------------------------------------------

test('corridorBudget: within / near / over verdicts', () => {
  const base = { monthlyBudgetVehHours: 5000, consumedVehHours: 3000 };
  assert.strictEqual(Budget.corridorBudget({ ...base, currentPermitVehHours: 500 }).verdict, 'ضمن الميزانية');
  assert.strictEqual(Budget.corridorBudget({ ...base, currentPermitVehHours: 1500 }).verdict, 'قرب السقف');
  assert.strictEqual(Budget.corridorBudget({ ...base, currentPermitVehHours: 2500 }).verdict, 'تجاوز — يتطلب إعادة جدولة');
});

test('corridorBudget: remaining floors at 0, pct and consumedAfter honest', () => {
  const r = Budget.corridorBudget({ monthlyBudgetVehHours: 5000, consumedVehHours: 4000, currentPermitVehHours: 3000 });
  assert.strictEqual(r.consumedAfter, 7000);
  assert.strictEqual(r.remaining, 0);
  assert.strictEqual(r.pctUsed, 140);
  assert.strictEqual(r.verdict, 'تجاوز — يتطلب إعادة جدولة');
});

// ---------------------------------------------------------------------------
// assumptionsUsed()
// ---------------------------------------------------------------------------

test('assumptionsUsed counts unofficial assumptions per metric', () => {
  assert.strictEqual(AtharEngine.assumptionsUsed('timeValueSAR').length, 7);
  assert.ok(AtharEngine.assumptionsUsed('co2').includes('idleFuelLPerHour'));
  assert.strictEqual(AtharEngine.assumptionsUsed('nope'), null);
});

test('assumptionsUsed returns a copy (caller cannot mutate internal table)', () => {
  const a = AtharEngine.assumptionsUsed('digOnce');
  a.push('x');
  assert.ok(!AtharEngine.assumptionsUsed('digOnce').includes('x'));
});

// ---------------------------------------------------------------------------
// work-zone friction floor
// ---------------------------------------------------------------------------

test('night closure still produces nonzero delay (work-zone friction floor)', () => {
  const r = AtharEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 1, capacityPerLane: 1800,
    freeFlowMin: 6, startHour: 2, durationHours: 4,
  });
  assert.ok(r.delayVehHours > 0, `expected >0, got ${r.delayVehHours}`);
});

test('optimize kills the 99.6% mirage: no candidate saves >=99% and best still has material delay', () => {
  const r = AtharEngine.optimize({
    aadt: 85000, lanes: 4, lanesClosed: 2, capacityPerLane: 1800,
    freeFlowMin: 6, startHour: 8, durationHours: 48,
  });
  r.top3.forEach((c) => assert.ok(c.savedPct < 99, `savedPct ${c.savedPct}`));
  // best schedule still carries real work-zone delay (not the ~0 mirage)
  assert.ok(r.top3[0].delayVehHours >= 100, `best delay ${r.top3[0].delayVehHours}`);
});

// ---------------------------------------------------------------------------
// digOnce()
// ---------------------------------------------------------------------------

test('digOnce(2 permits) saved pct fixed at GAO 25-33% band', () => {
  const r = AtharEngine.digOnce({ trenchKm: 4.2, permitsMerged: 2 });
  assert.strictEqual(r.savedPctLow, 25);
  assert.strictEqual(r.savedPctHigh, 33);
  assert.ok(Math.abs(r.savedLowSAR - r.separateSAR * 0.25) < 1e-6);
  assert.ok(Math.abs(r.savedHighSAR - r.separateSAR * 0.33) < 1e-6);
  assert.ok(Math.abs(r.sharedLowSAR - (r.separateSAR - r.savedHighSAR)) < 1e-6);
  assert.ok(Math.abs(r.sharedHighSAR - (r.separateSAR - r.savedLowSAR)) < 1e-6);
});

test('digOnce() with 1 permit yields zero savings', () => {
  const r = AtharEngine.digOnce({ trenchKm: 4.2, permitsMerged: 1 });
  assert.strictEqual(r.savedLowSAR, 0);
  assert.strictEqual(r.savedHighSAR, 0);
  assert.strictEqual(r.savedPctLow, 0);
  assert.strictEqual(r.savedPctHigh, 0);
});

// ---------------------------------------------------------------------------
// compound()
// ---------------------------------------------------------------------------

test('compound() combines two scores with factor 1.3', () => {
  const a = AtharEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 2, capacityPerLane: 1800,
    freeFlowMin: 6, lengthKm: 4.2, startHour: 8, durationHours: 4,
  });
  const b = AtharEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 1, capacityPerLane: 1800,
    freeFlowMin: 6, lengthKm: 4.2, startHour: 8, durationHours: 4,
  });
  const r = AtharEngine.compound(a, b);
  assert.strictEqual(r.factor, 1.3);
  assert.ok(Math.abs(r.combined - (a.delayVehHours + b.delayVehHours) * 1.3) < 1e-9);
});

test('compound() emits warning string when combined level becomes high', () => {
  const a = AtharEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 3, capacityPerLane: 1800,
    freeFlowMin: 6, lengthKm: 4.2, startHour: 8, durationHours: 4,
  });
  const b = AtharEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 3, capacityPerLane: 1800,
    freeFlowMin: 6, lengthKm: 4.2, startHour: 8, durationHours: 4,
  });
  const r = AtharEngine.compound(a, b);
  assert.strictEqual(typeof r.warning, 'string');
  assert.ok(r.warning.length > 0);
});

test('compound() warning empty string when combined level stays low', () => {
  const a = AtharEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 0, capacityPerLane: 1800,
    freeFlowMin: 6, lengthKm: 4.2, startHour: 8, durationHours: 4,
  });
  const b = AtharEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 0, capacityPerLane: 1800,
    freeFlowMin: 6, lengthKm: 4.2, startHour: 8, durationHours: 4,
  });
  const r = AtharEngine.compound(a, b);
  assert.strictEqual(r.warning, '');
});

// ---------------------------------------------------------------------------
// backTest()
// ---------------------------------------------------------------------------

test('backTest() reports before/after vehicle-hours consistent with score/chosen', () => {
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 4,
  };
  const opt = AtharEngine.optimize(input);
  const chosen = opt.top3[0];
  const bt = AtharEngine.backTest(input, chosen);
  const expectedBefore = AtharEngine.score(input).delayVehHours;
  assert.ok(Math.abs(bt.beforeVehHours - expectedBefore) < 1e-9);
  assert.ok(Math.abs(bt.afterVehHours - chosen.delayVehHours) < 1e-9);
  assert.ok(bt.afterVehHours <= bt.beforeVehHours);
});

// ---------------------------------------------------------------------------
// Range constants (Task 1)
// ---------------------------------------------------------------------------

test('DEFAULTS carries range constants for person-hours / VoT / fuel / transit', () => {
  const d = AtharEngine.DEFAULTS;
  assert.strictEqual(d.occupancyLow, 1.2);
  assert.strictEqual(d.occupancyHigh, 1.6);
  assert.strictEqual(d.wageMonthlySAR, 5800);
  assert.strictEqual(d.workHoursPerMonth, 160);
  assert.strictEqual(d.votShareLow, 0.4);
  assert.strictEqual(d.votShareHigh, 0.7);
  assert.strictEqual(d.idleFuelLPerHourLow, 0.7);
  assert.strictEqual(d.idleFuelLPerHourHigh, 1.1);
  assert.strictEqual(d.busRoutesOnSegment, 3);
  assert.strictEqual(d.busesPerHourPerRoute, 4);
  assert.strictEqual(d.ridersPerBusLow, 15);
  assert.strictEqual(d.ridersPerBusHigh, 40);
});

// ---------------------------------------------------------------------------
// personHours (Task 2)
// ---------------------------------------------------------------------------

test('personHours(100) => 120-160 person-hours with default occupancy band', () => {
  const r = AtharEngine.personHours(100);
  assert.strictEqual(r.lowPersonHours, 120);
  assert.strictEqual(r.highPersonHours, 160);
  assert.strictEqual(r.occLow, 1.2);
  assert.strictEqual(r.occHigh, 1.6);
});

test('personHours(0) => zero range', () => {
  const r = AtharEngine.personHours(0);
  assert.strictEqual(r.lowPersonHours, 0);
  assert.strictEqual(r.highPersonHours, 0);
});

test('personHours honors opts override', () => {
  const r = AtharEngine.personHours(100, { occLow: 1.0, occHigh: 2.0 });
  assert.strictEqual(r.lowPersonHours, 100);
  assert.strictEqual(r.highPersonHours, 200);
});

// ---------------------------------------------------------------------------
// timeValueSAR (Task 3)
// ---------------------------------------------------------------------------

test('timeValueSAR: wageHourly = 5800/160 = 36.25 SAR', () => {
  const r = AtharEngine.timeValueSAR(AtharEngine.personHours(100));
  assert.strictEqual(r.wageHourlySAR, 36.25);
});

test('timeValueSAR(personHours(100)) => low 1740, high 4060 SAR', () => {
  // low  = 120 person-hours * 36.25 * 0.4 = 1740
  // high = 160 person-hours * 36.25 * 0.7 = 4060
  const r = AtharEngine.timeValueSAR(AtharEngine.personHours(100));
  assert.ok(Math.abs(r.lowSAR - 1740) < 1e-9, `lowSAR was ${r.lowSAR}`);
  assert.ok(Math.abs(r.highSAR - 4060) < 1e-9, `highSAR was ${r.highSAR}`);
  assert.strictEqual(r.shareLow, 0.4);
  assert.strictEqual(r.shareHigh, 0.7);
});

test('timeValueSAR of zero person-hours => zero SAR range', () => {
  const r = AtharEngine.timeValueSAR(AtharEngine.personHours(0));
  assert.strictEqual(r.lowSAR, 0);
  assert.strictEqual(r.highSAR, 0);
});

// ---------------------------------------------------------------------------
// co2Range + transitImpact (Task 4)
// ---------------------------------------------------------------------------

test('co2Range(100) => fuel 70-110 L, co2 161.7-254.1 kg', () => {
  const r = AtharEngine.co2Range(100);
  assert.ok(Math.abs(r.lowFuelL - 70) < 1e-9, `lowFuelL was ${r.lowFuelL}`);
  assert.ok(Math.abs(r.highFuelL - 110) < 1e-9, `highFuelL was ${r.highFuelL}`);
  assert.ok(Math.abs(r.lowCo2Kg - 161.7) < 1e-9, `lowCo2Kg was ${r.lowCo2Kg}`);
  assert.ok(Math.abs(r.highCo2Kg - 254.1) < 1e-9, `highCo2Kg was ${r.highCo2Kg}`);
});

test('co2Range(0) => zero everywhere', () => {
  const r = AtharEngine.co2Range(0);
  assert.strictEqual(r.lowFuelL, 0);
  assert.strictEqual(r.highCo2Kg, 0);
});

test('transitImpact: 1 hour with 6-min bus delay => 12 buses, 1.2 bus-hours, 18-48 person-hours', () => {
  const fakeScore = { hourly: [{ hour: 8, demand: 5000, baseT: 6, closedT: 12, delayVehHours: 100 }] };
  const r = AtharEngine.transitImpact(fakeScore);
  // buses = 3 routes * 4 buses/hr = 12; delay/bus = 6 min = 0.1 hr
  // busDelayHours = 12 * 0.1 = 1.2; low = 1.2*15 = 18; high = 1.2*40 = 48
  assert.strictEqual(r.busesAffected, 12);
  assert.ok(Math.abs(r.busDelayHours - 1.2) < 1e-9, `busDelayHours was ${r.busDelayHours}`);
  assert.ok(Math.abs(r.lowPersonHours - 18) < 1e-9);
  assert.ok(Math.abs(r.highPersonHours - 48) < 1e-9);
});

test('transitImpact with no closure delay (closedT == baseT) => zero', () => {
  const fakeScore = { hourly: [{ hour: 3, demand: 400, baseT: 6, closedT: 6, delayVehHours: 0 }] };
  const r = AtharEngine.transitImpact(fakeScore);
  assert.strictEqual(r.busDelayHours, 0);
  assert.strictEqual(r.lowPersonHours, 0);
});

// ---------------------------------------------------------------------------
// wzdx (Task 5)
// ---------------------------------------------------------------------------

test('wzdx returns a WZDx-shaped FeatureCollection with correct dates and impact', () => {
  const fc = AtharEngine.wzdx({
    id: 'athar-demo-001',
    roadName: 'طريق الملك فهد',
    direction: 'northbound',
    lanes: 4,
    lanesClosed: 2,
    startISO: '2026-07-27T22:00:00Z',
    durationHours: 8,
    coordinates: [[46.675, 24.700], [46.680, 24.735]],
  });
  assert.strictEqual(fc.type, 'FeatureCollection');
  assert.strictEqual(fc.features.length, 1);
  const p = fc.features[0].properties;
  assert.strictEqual(p.core_details.event_type, 'work-zone');
  assert.strictEqual(p.core_details.data_source_id, 'athar-prototype');
  assert.deepStrictEqual(p.core_details.road_names, ['طريق الملك فهد']);
  assert.strictEqual(p.core_details.direction, 'northbound');
  assert.strictEqual(p.vehicle_impact, 'some-lanes-closed');
  assert.strictEqual(p.start_date, '2026-07-27T22:00:00.000Z');
  assert.strictEqual(p.end_date, '2026-07-28T06:00:00.000Z'); // +8h
  assert.strictEqual(fc.features[0].geometry.type, 'LineString');
});

test('wzdx vehicle_impact: all lanes closed => all-lanes-closed; zero => all-lanes-open', () => {
  const base = {
    id: 'x', roadName: 'r', direction: 'northbound', lanes: 4,
    startISO: '2026-07-27T22:00:00Z', durationHours: 4,
    coordinates: [[46.6, 24.7], [46.7, 24.8]],
  };
  const closed = AtharEngine.wzdx({ ...base, lanesClosed: 4 });
  assert.strictEqual(closed.features[0].properties.vehicle_impact, 'all-lanes-closed');
  const open = AtharEngine.wzdx({ ...base, lanesClosed: 0 });
  assert.strictEqual(open.features[0].properties.vehicle_impact, 'all-lanes-open');
});

// ---------------------------------------------------------------------------
// predictionError (Task 6)
// ---------------------------------------------------------------------------

test('predictionError(100, 112) => abs 12, pct 12, verdict دقيق', () => {
  const r = AtharEngine.predictionError(100, 112);
  assert.strictEqual(r.absError, 12);
  assert.ok(Math.abs(r.pctError - 12) < 1e-9);
  assert.strictEqual(r.verdict, 'دقيق');
});

test('predictionError(100, 125) => verdict مقبول; (100, 140) => يتطلب إعادة معايرة', () => {
  assert.strictEqual(AtharEngine.predictionError(100, 125).verdict, 'مقبول');
  assert.strictEqual(AtharEngine.predictionError(100, 140).verdict, 'يتطلب إعادة معايرة');
});

test('predictionError guards zero prediction', () => {
  const r = AtharEngine.predictionError(0, 10);
  assert.strictEqual(r.pctError, 100);
  assert.strictEqual(r.verdict, 'يتطلب إعادة معايرة');
});

console.log(`ALL TESTS PASSED (${count})`);
