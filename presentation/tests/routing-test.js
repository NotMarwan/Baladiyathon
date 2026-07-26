/**
 * Tests for MasarRouting (network + Dijkstra/BPR alternative routing)
 * and MasarForecast (honest forecast layer). Run: node presentation/tests/routing-test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const MasarRouting = require('../masar-routing.js');
const MasarForecast = require('../masar-forecast.js');

const network = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'corridor-network.json'), 'utf8')
);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  PASS  ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL  ' + name);
    console.error('        ' + err.message);
  }
}

// ---------------------------------------------------------------- network
test('network has metadata with OSM/ODbL attribution and demo tag', () => {
  assert.ok(network.metadata, 'metadata missing');
  assert.ok(/OpenStreetMap/.test(network.metadata.source), 'OSM attribution missing');
  assert.ok(/ODbL/.test(network.metadata.license), 'ODbL license missing');
  assert.ok(/افتراض توضيحي/.test(network.metadata.note), 'demo-assumption tag missing');
});

test('network has corridor edges kf_1..kf_5 and parallel streets', () => {
  const ids = network.edges.map((e) => e.id);
  for (let i = 1; i <= 5; i += 1) assert.ok(ids.includes('kf_' + i), 'missing kf_' + i);
  assert.ok(ids.some((id) => id.indexOf('ol_') === 0), 'no Olaya edges');
  assert.ok(ids.some((id) => id.indexOf('tk_') === 0), 'no Takhasusi edges');
});

test('network has tagged POIs (hospital + school)', () => {
  assert.ok(Array.isArray(network.pois) && network.pois.length >= 2);
  const kinds = network.pois.map((p) => p.kind);
  assert.ok(kinds.includes('hospital'));
  assert.ok(kinds.includes('school'));
  network.pois.forEach((p) => assert.ok(/افتراض توضيحي/.test(p.note), 'POI missing demo tag'));
});

// ---------------------------------------------------------------- graph
test('buildGraph builds adjacency with computed lengths', () => {
  const graph = MasarRouting.buildGraph(network);
  assert.ok(graph.adj.kf0 && graph.adj.kf0.length >= 2, 'kf0 adjacency missing');
  const e = graph.edgeById.kf_1;
  assert.ok(e.lengthKm > 0.5 && e.lengthKm < 5, 'kf_1 length implausible: ' + e.lengthKm);
});

test('edgeTravelTime grows with closure lanes', () => {
  const graph = MasarRouting.buildGraph(network);
  const e = graph.edgeById.kf_3;
  const hourFraction = 0.08; // peak-like
  const t0 = MasarRouting.edgeTravelTime(e, hourFraction, network.metadata.aadtScale, null);
  const t2 = MasarRouting.edgeTravelTime(e, hourFraction, network.metadata.aadtScale, { edgeId: 'kf_3', lanesClosed: 2 });
  const t3 = MasarRouting.edgeTravelTime(e, hourFraction, network.metadata.aadtScale, { edgeId: 'kf_3', lanesClosed: 3 });
  assert.ok(t2 > t0, 'closure must slow edge');
  assert.ok(t3 > t2, 'more lanes closed must be slower');
});

test('shortestPath finds corridor path kf0->kf5 without closure', () => {
  const graph = MasarRouting.buildGraph(network);
  const r = MasarRouting.shortestPath(graph, 'kf0', 'kf5', 8, null, {});
  assert.ok(r, 'no path found');
  assert.ok(r.path.includes('kf0') && r.path.includes('kf5'));
  assert.ok(r.travelMin > 0);
});

// ---------------------------------------------------------------- alternatives
test('alternativeRoutes avoids the closed edge entirely', () => {
  const res = MasarRouting.alternativeRoutes(network, 'kf_3', 8, { lanesClosed: 2 });
  assert.ok(res.alternatives.length >= 1, 'no alternatives');
  res.alternatives.forEach((alt) => {
    assert.ok(!alt.edges.includes('kf_3'), 'alternative uses closed edge');
  });
});

test('alternativeRoutes returns comparative travel times (viaClosure vs alt)', () => {
  const res = MasarRouting.alternativeRoutes(network, 'kf_3', 8, { lanesClosed: 3 });
  assert.ok(res.viaClosureMin > 0);
  const best = res.alternatives[0];
  assert.ok(best.travelMin > 0);
  assert.ok(typeof best.extraMin === 'number');
  assert.ok(typeof best.residualCapacityPct === 'number');
});

test('alternativeRoutes loads diverted demand onto every route before reporting capacity', () => {
  const res = MasarRouting.alternativeRoutes(network, 'kf_3', 8, { lanesClosed: 2 });
  assert.ok(res.divertedVehiclesPerHour > 0);
  res.alternatives.forEach((route) => {
    assert.ok(route.loadedVolumePerHour >= route.baseVolumePerHour);
    assert.ok(
      route.residualCapacityAfterDiversion
      <= route.residualCapacityBeforeDiversion
    );
    assert.ok(route.travelTimeAfterDiversion >= route.freeFlowMinutes);
    assert.ok(route.volumeCapacityRatioAfterDiversion >= route.volumeCapacityRatioBeforeDiversion);
    assert.strictEqual(route.travelMin, route.travelTimeAfterDiversion);
  });
});

test('diverted demand is conserved across route allocation shares', () => {
  const res = MasarRouting.alternativeRoutes(network, 'kf_3', 8, { lanesClosed: 2 });
  const assigned = res.alternatives.reduce(
    (sum, route) => sum + route.assignedDivertedVehiclesPerHour,
    0
  );
  const shareTotal = res.alternatives.reduce(
    (sum, route) => sum + route.diversionShare,
    0
  );
  assert.ok(Math.abs(assigned - res.divertedVehiclesPerHour) < 1e-6);
  assert.ok(Math.abs(shareTotal - 1) < 1e-9);
});

test('route that overloads only after diversion is marked not recommended', () => {
  const res = MasarRouting.alternativeRoutes(network, 'kf_3', 8, { lanesClosed: 2 });
  const overloaded = res.alternatives.find((route) =>
    route.volumeCapacityRatioBeforeDiversion < 1
    && route.volumeCapacityRatioAfterDiversion >= 1
  );
  assert.ok(overloaded, 'expected a route to cross capacity after diversion');
  assert.strictEqual(overloaded.recommended, false);
  assert.strictEqual(overloaded.recommendationReason, 'capacity-exceeded-after-diversion');
});

test('alternative route geometry changes when a different edge is closed', () => {
  const a = MasarRouting.alternativeRoutes(network, 'kf_1', 8, { lanesClosed: 2 });
  const b = MasarRouting.alternativeRoutes(network, 'kf_5', 8, { lanesClosed: 2 });
  assert.notDeepStrictEqual(a.alternatives[0].path, b.alternatives[0].path, 'same path for different closures');
});

test('peak-hour alternative is slower than night alternative', () => {
  const peak = MasarRouting.alternativeRoutes(network, 'kf_3', 8, { lanesClosed: 2 });
  const night = MasarRouting.alternativeRoutes(network, 'kf_3', 3, { lanesClosed: 2 });
  assert.ok(peak.alternatives[0].travelMin > night.alternatives[0].travelMin);
});

test('alternatives are distinct and ranked by travel time', () => {
  const res = MasarRouting.alternativeRoutes(network, 'kf_3', 8, { lanesClosed: 2 });
  for (let i = 1; i < res.alternatives.length; i += 1) {
    assert.ok(res.alternatives[i].travelMin >= res.alternatives[i - 1].travelMin, 'not sorted');
    assert.notDeepStrictEqual(res.alternatives[i].path, res.alternatives[i - 1].path, 'duplicate path');
  }
});

test('POI proximity flags routes passing near hospital/school', () => {
  const res = MasarRouting.alternativeRoutes(network, 'kf_3', 8, { lanesClosed: 2 });
  const anyFlag = res.alternatives.some((alt) => alt.nearPois.length > 0);
  assert.ok(anyFlag, 'no alternative flagged any POI — check POI placement');
  res.alternatives.forEach((alt) => {
    alt.nearPois.forEach((p) => assert.ok(p.name && p.kind, 'POI flag malformed'));
  });
});

// ---------------------------------------------------------------- shockwave
test('shockwave: peak closure spills onto adjacent edges, night does not', () => {
  const peak = MasarRouting.shockwave(network, 'kf_3', 8, { lanesClosed: 3 });
  const night = MasarRouting.shockwave(network, 'kf_3', 3, { lanesClosed: 3 });
  const peakTotal = Object.keys(peak.overflow).length;
  assert.ok(peak.excessVehPerHour > 0, 'peak closure should overflow');
  assert.ok(peakTotal > 0, 'no adjacent edges received overflow');
  assert.ok(night.excessVehPerHour === 0 || night.excessVehPerHour < peak.excessVehPerHour * 0.2,
    'night should not meaningfully overflow');
});

// ---------------------------------------------------------------- forecast
test('forecast returns band low < mid < high', () => {
  const f = MasarForecast.forecast(8, 2);
  assert.ok(f.low < f.demandFraction && f.demandFraction < f.high);
  assert.strictEqual(f.calibrated, false);
});

test('KSA weekend (Friday) demand lower than Tuesday', () => {
  const fri = MasarForecast.forecast(8, 5); // 5 = Friday
  const tue = MasarForecast.forecast(8, 2);
  assert.ok(fri.demandFraction < tue.demandFraction);
});

test('CSV calibration changes profile and narrows uncertainty band', () => {
  let csv = 'hour,count\n';
  for (let h = 0; h < 24; h += 1) csv += h + ',' + (100 + h * 10) + '\n';
  const cal = MasarForecast.calibrateFromCSV(csv);
  assert.strictEqual(cal.errors.length, 0, 'valid CSV rejected: ' + cal.errors.join(';'));
  assert.strictEqual(cal.profile.length, 24);
  const sum = cal.profile.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'profile must normalize to 1');

  const before = MasarForecast.forecast(8, 2);
  const after = MasarForecast.forecast(8, 2, { profile: cal.profile, calibrated: true });
  assert.strictEqual(after.calibrated, true);
  const bandBefore = (before.high - before.low) / before.demandFraction;
  const bandAfter = (after.high - after.low) / after.demandFraction;
  assert.ok(bandAfter < bandBefore, 'calibrated band must be narrower');
});

test('bad CSV returns errors, does not crash', () => {
  const bad = MasarForecast.calibrateFromCSV('hour,count\n1,abc\n2,-5\n');
  assert.ok(bad.errors.length > 0);
  assert.strictEqual(bad.profile, null);
});

test('forecastGrid returns 24 x segments matrix with congestion in [0,1]', () => {
  const grid = MasarForecast.forecastGrid(2, { edgeId: 'kf_3', lanesClosed: 2 }, network);
  assert.strictEqual(grid.hours.length, 24);
  assert.ok(grid.segments.length >= 5);
  grid.hours.forEach((row) => {
    row.cells.forEach((c) => {
      assert.ok(c.congestion >= 0 && c.congestion <= 1, 'congestion out of range: ' + c.congestion);
      assert.ok(c.low <= c.congestion && c.congestion <= c.high, 'band must bracket value');
    });
  });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
