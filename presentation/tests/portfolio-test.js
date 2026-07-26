'use strict';
const assert = require('assert');
const path = require('path');
const Portfolio = require(path.join(__dirname, '..', 'masar-portfolio.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

ok('SEED is the fixed demo seed 20260727', () => {
  assert.strictEqual(Portfolio.SEED, 20260727);
});

ok('mulberry32 is deterministic for the same seed', () => {
  const a = Portfolio.mulberry32(42);
  const b = Portfolio.mulberry32(42);
  for (let i = 0; i < 100; i += 1) assert.strictEqual(a(), b());
});

ok('CORRIDORS: 12 corridors across 3 classes with sane bands', () => {
  assert.strictEqual(Portfolio.CORRIDORS.length, 12);
  const classes = new Set(Portfolio.CORRIDORS.map((c) => c.class));
  assert.deepStrictEqual([...classes].sort(), ['arterial', 'local', 'major']);
  for (const c of Portfolio.CORRIDORS) {
    assert.ok(c.id && c.nameAr, 'corridor has id and Arabic name');
    assert.ok(c.aadtLow > 0 && c.aadtHigh > c.aadtLow);
    assert.ok(Number.isInteger(c.lanes) && c.lanes >= 2);
  }
});

ok('buildPermits(SEED): 150 permits, all valid against engine contract', () => {
  const permits = Portfolio.buildPermits(Portfolio.SEED);
  assert.strictEqual(permits.length, 150);
  for (const p of permits) {
    assert.ok(Number.isFinite(p.aadt) && p.aadt > 0);
    assert.ok(Number.isInteger(p.lanes) && p.lanes > 0);
    assert.ok(Number.isInteger(p.lanesClosed) && p.lanesClosed >= 1 && p.lanesClosed < p.lanes);
    assert.ok(Number.isInteger(p.startHour) && p.startHour >= 0 && p.startHour <= 23);
    assert.ok(Number.isFinite(p.durationHours) && p.durationHours >= 24 && p.durationHours <= 240);
    assert.ok(Number.isInteger(p.startDay) && p.startDay >= 0 && p.startDay < 365);
  }
});

ok('buildPermits is deterministic: same seed => identical JSON', () => {
  const a = JSON.stringify(Portfolio.buildPermits(Portfolio.SEED));
  const b = JSON.stringify(Portfolio.buildPermits(Portfolio.SEED));
  assert.strictEqual(a, b);
});

ok('~70% of permits start in daytime 7-15 (as-submitted realism)', () => {
  const permits = Portfolio.buildPermits(Portfolio.SEED);
  const day = permits.filter((p) => p.startHour >= 7 && p.startHour <= 15).length;
  assert.ok(day / permits.length >= 0.6 && day / permits.length <= 0.8, `got ${day / permits.length}`);
});

ok('buildPortfolio: deterministic totals for the fixed seed', () => {
  const a = Portfolio.buildPortfolio(Portfolio.SEED);
  const b = Portfolio.buildPortfolio(Portfolio.SEED);
  assert.deepStrictEqual(a.totals, b.totals);
  assert.strictEqual(a.permitCount, 150);
  assert.strictEqual(a.seed, Portfolio.SEED);
});

ok('buildPortfolio: baseline >= optimized, savedPct in (0,100), no NaN', () => {
  const p = Portfolio.buildPortfolio(Portfolio.SEED);
  const t = p.totals;
  for (const v of [t.baselineVehHours, t.optimizedVehHours, t.savedVehHours, t.savedPct]) {
    assert.ok(Number.isFinite(v), 'finite');
  }
  assert.ok(t.baselineVehHours >= t.optimizedVehHours);
  assert.ok(Math.abs(t.savedVehHours - (t.baselineVehHours - t.optimizedVehHours)) < 1e-6);
  assert.ok(t.savedPct > 0 && t.savedPct < 100);
});

ok('buildPortfolio: representative label pinned at root', () => {
  const p = Portfolio.buildPortfolio(Portfolio.SEED);
  assert.strictEqual(p.label, Portfolio.LABEL);
});

ok('buildPortfolio: byClass covers 3 classes and sums to totals', () => {
  const p = Portfolio.buildPortfolio(Portfolio.SEED);
  const sumBase = p.byClass.arterial.baseline + p.byClass.major.baseline + p.byClass.local.baseline;
  const sumOpt = p.byClass.arterial.optimized + p.byClass.major.optimized + p.byClass.local.optimized;
  assert.ok(Math.abs(sumBase - p.totals.baselineVehHours) < 1e-6);
  assert.ok(Math.abs(sumOpt - p.totals.optimizedVehHours) < 1e-6);
});

ok('buildPortfolio: ranges come from engine conversions of savedVehHours', () => {
  const p = Portfolio.buildPortfolio(Portfolio.SEED);
  const Engine = require(path.join(__dirname, '..', 'masar-engine.js'));
  const ph = Engine.personHours(p.totals.savedVehHours);
  assert.strictEqual(p.ranges.personHours.lowPersonHours, ph.lowPersonHours);
  const co2 = Engine.co2Range(p.totals.savedVehHours);
  assert.strictEqual(p.ranges.co2.highCo2Kg, co2.highCo2Kg);
  const tv = Engine.timeValueSAR(ph);
  assert.strictEqual(p.ranges.timeValue.lowSAR, tv.lowSAR);
  assert.strictEqual(p.ranges.timeValue.highSAR, tv.highSAR);
});

ok('buildPortfolio: digOnce groups only same-corridor overlaps within 30 days', () => {
  const p = Portfolio.buildPortfolio(Portfolio.SEED);
  assert.ok(p.digOnceMerged.groups >= 1, 'with 150 permits on 12 corridors overlaps must exist');
  assert.ok(p.digOnceMerged.permits >= 2 * p.digOnceMerged.groups);
  // WP-A2: التجميع كمية مادية لا نطاق مالي. المجموعة التي تضمّ n تصريحاً
  // تتجنّب n-1 حفرة، فمجموع الحفر المتجنَّبة = التصاريح المدموجة ناقص عدد
  // المجموعات — علاقة حسابية تُفحص، لا مجرد «الحد الأعلى أكبر من الأدنى».
  assert.strictEqual(p.digOnceMerged.additionalPermitsInGroups,
    p.digOnceMerged.permits - p.digOnceMerged.groups);
  assert.ok(p.digOnceMerged.duplicateTrenchKmEquivalent > 0);
  assert.strictEqual(p.digOnceMerged.avoidedTrenchKm, undefined,
    'الاسم القاطع عاد إلى تجميع المحفظة');
  assert.ok(/تداخل تام/.test(p.digOnceMerged.overlapAssumption),
    'التجميع يعرض طولاً مكافئاً بلا افتراضه');
  assert.strictEqual(p.digOnceMerged.savedHighSAR, undefined,
    'عاد حقل مالي إلى تجميع المحفظة');
  assert.ok(/كلفة الخندق لدى الأمانة/.test(p.digOnceMerged.costNote));
});

console.log(`ALL PORTFOLIO TESTS PASSED (${passed})`);
