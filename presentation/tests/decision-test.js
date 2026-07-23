'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const Decision = require('../athar-decision.js');

let count = 0;

function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

function completeInput(overrides) {
  return {
    permitId: 'P-1',
    segmentId: 'kf_3',
    startDate: '2026-08-01',
    startHour: 8,
    durationHours: 8,
    lanes: 4,
    lanesClosed: 1,
    aadt: 85000,
    originNodeId: 'kf0',
    destinationNodeId: 'kf5',
    assumptions: [],
    ...(overrides || {}),
  };
}

function fakeDependencies(overrides) {
  const calls = {
    score: 0,
    optimize: 0,
    alternatives: 0,
    predict: 0,
    detect: 0,
    explain: 0,
  };

  const dependencies = {
    engine: {
      score(input) {
        calls.score += 1;
        return {
          impactScore: input.startHour === 8 ? 78 : 31,
          delayVehHours: input.startHour === 8 ? 410 : 155,
        };
      },
      optimize() {
        calls.optimize += 1;
        return [
          { id: 'night', label: 'Night', totalImpact: 31 },
          { id: 'day', label: 'Day', totalImpact: 78 },
        ];
      },
    },
    routing: {
      alternatives(input) {
        calls.alternatives += 1;
        return [
          {
            id: 'r1',
            label: 'Olaya',
            totalMinutes: input.startHour === 8 ? 14 : 10,
          },
          { id: 'r2', label: 'Takhassusi', totalMinutes: 16 },
        ];
      },
    },
    forecast: {
      predict() {
        calls.predict += 1;
        return { p50: 34, p90: 49, calibrated: false };
      },
    },
    reasons: {
      explain() {
        calls.explain += 1;
        return [
          {
            label: 'Peak-hour delay',
            contribution: 47,
            provenance: 'engine.score',
          },
          {
            label: 'Route travel time',
            contribution: 14,
            provenance: 'routing.alternatives',
          },
        ];
      },
    },
    conflict: {
      detect() {
        calls.detect += 1;
        return [{ permitId: 'P-2', overlapHours: 3 }];
      },
    },
  };

  Object.entries(overrides || {}).forEach(([name, value]) => {
    dependencies[name] = value;
  });

  return { dependencies, calls };
}

test('missing decision data blocks the verdict', () => {
  const fixture = fakeDependencies();
  const service = Decision.createDecisionService(fixture.dependencies);
  const result = service.evaluate({ permitId: 'P-1' });

  assert.strictEqual(result.qualityGate.status, 'blocked');
  assert.strictEqual(result.qualityGate.canDecide, false);
  assert.strictEqual(result.verdict, null);
  assert.ok(result.qualityGate.missing.includes('segmentId'));
  assert.strictEqual(fixture.calls.score, 0);
});

test('zero duration blocks the verdict before dependencies run', () => {
  const fixture = fakeDependencies();
  const service = Decision.createDecisionService(fixture.dependencies);
  const result = service.evaluate(completeInput({ durationHours: 0 }));

  assert.strictEqual(result.qualityGate.status, 'blocked');
  assert.ok(
    result.qualityGate.invalid.some(
      (item) => item.field === 'durationHours'
    )
  );
  assert.strictEqual(fixture.calls.score, 0);
});

test('closed lanes above total lanes block the verdict', () => {
  const service = Decision.createDecisionService(
    fakeDependencies().dependencies
  );
  const result = service.evaluate(
    completeInput({ lanes: 2, lanesClosed: 3 })
  );

  assert.strictEqual(result.qualityGate.status, 'blocked');
  assert.ok(
    result.qualityGate.invalid.some((item) => item.field === 'lanesClosed')
  );
});

test('negative traffic volume blocks the verdict', () => {
  const service = Decision.createDecisionService(
    fakeDependencies().dependencies
  );
  const result = service.evaluate(completeInput({ aadt: -1 }));

  assert.strictEqual(result.qualityGate.status, 'blocked');
  assert.ok(result.qualityGate.invalid.some((item) => item.field === 'aadt'));
});

test('invalid calendar date blocks the verdict', () => {
  const service = Decision.createDecisionService(
    fakeDependencies().dependencies
  );
  const result = service.evaluate(
    completeInput({ startDate: '2026-02-30' })
  );

  assert.strictEqual(result.qualityGate.status, 'blocked');
  assert.ok(
    result.qualityGate.invalid.some((item) => item.field === 'startDate')
  );
});

test('assumption without a source blocks the verdict', () => {
  const service = Decision.createDecisionService(
    fakeDependencies().dependencies
  );
  const result = service.evaluate(
    completeInput({
      assumptions: [{ name: 'capacityPerLane', value: 1800 }],
    })
  );

  assert.strictEqual(result.qualityGate.status, 'blocked');
  assert.ok(
    result.qualityGate.invalid.some((item) => item.field === 'assumptions')
  );
});

test('valid declared assumptions produce an assumption-bound decision', () => {
  const service = Decision.createDecisionService(
    fakeDependencies().dependencies
  );
  const result = service.evaluate(
    completeInput({
      assumptions: [
        {
          name: 'capacityPerLane',
          value: 1800,
          source: 'illustrative-demo-assumption',
        },
      ],
    })
  );

  assert.strictEqual(result.qualityGate.status, 'assumption-bound');
  assert.strictEqual(result.qualityGate.canDecide, true);
  assert.ok(result.verdict);
});

test('missing dependency fails at service construction', () => {
  const fixture = fakeDependencies();
  delete fixture.dependencies.routing;

  assert.throws(
    () => Decision.createDecisionService(fixture.dependencies),
    /routing/
  );
});

test('complete input returns the full decision bundle', () => {
  const service = Decision.createDecisionService(
    fakeDependencies().dependencies
  );
  const result = service.evaluate(completeInput());

  assert.strictEqual(result.qualityGate.canDecide, true);
  assert.ok(result.baseline);
  assert.ok(result.scheduleAlternatives.length >= 2);
  assert.ok(result.routeAlternatives.length >= 2);
  assert.ok(result.forecast);
  assert.ok(result.conflicts.length >= 1);
  assert.ok(result.verdict);
  assert.ok(result.evidence.length >= 1);
});

test('changing closure time changes a ranking input', () => {
  const service = Decision.createDecisionService(
    fakeDependencies().dependencies
  );
  const peak = service.evaluate(completeInput({ startHour: 8 }));
  const night = service.evaluate(completeInput({ startHour: 23 }));

  assert.notDeepStrictEqual(peak.baseline, night.baseline);
  assert.notDeepStrictEqual(
    peak.routeAlternatives[0],
    night.routeAlternatives[0]
  );
});

test('evidence contains numeric contributions and provenance', () => {
  const service = Decision.createDecisionService(
    fakeDependencies().dependencies
  );
  const result = service.evaluate(completeInput());

  assert.ok(
    result.evidence.every(
      (item) =>
        typeof item.label === 'string' &&
        Number.isFinite(item.value) &&
        typeof item.provenance === 'string' &&
        item.provenance.length > 0
    )
  );
});

test('empty schedule alternatives block the verdict', () => {
  const fixture = fakeDependencies();
  fixture.dependencies.engine.optimize = () => [];
  const service = Decision.createDecisionService(fixture.dependencies);
  const result = service.evaluate(completeInput());

  assert.strictEqual(result.qualityGate.status, 'blocked');
  assert.strictEqual(result.verdict, null);
  assert.ok(
    result.qualityGate.invalid.some(
      (item) => item.field === 'scheduleAlternatives'
    )
  );
});

test('empty route alternatives block the verdict', () => {
  const fixture = fakeDependencies();
  fixture.dependencies.routing.alternatives = () => [];
  const service = Decision.createDecisionService(fixture.dependencies);
  const result = service.evaluate(completeInput());

  assert.strictEqual(result.qualityGate.status, 'blocked');
  assert.strictEqual(result.verdict, null);
  assert.ok(
    result.qualityGate.invalid.some(
      (item) => item.field === 'routeAlternatives'
    )
  );
});

test('non-numeric explanation blocks the verdict', () => {
  const fixture = fakeDependencies();
  fixture.dependencies.reasons.explain = () => [
    {
      label: 'Opaque reason',
      contribution: 'large',
      provenance: 'unknown',
    },
  ];
  const service = Decision.createDecisionService(fixture.dependencies);
  const result = service.evaluate(completeInput());

  assert.strictEqual(result.qualityGate.status, 'blocked');
  assert.strictEqual(result.verdict, null);
  assert.ok(
    result.qualityGate.invalid.some((item) => item.field === 'evidence')
  );
});

test('duplicate top alternatives are removed by stable identity', () => {
  const fixture = fakeDependencies();
  fixture.dependencies.engine.optimize = () => [
    { id: 'night', label: 'Night', totalImpact: 31 },
    { id: 'night', label: 'Night duplicate', totalImpact: 31 },
    { id: 'day', label: 'Day', totalImpact: 78 },
  ];
  const service = Decision.createDecisionService(fixture.dependencies);
  const result = service.evaluate(completeInput());

  assert.deepStrictEqual(
    result.scheduleAlternatives.map((item) => item.id),
    ['night', 'day']
  );
});

test('conflict changes verdict to conditional', () => {
  const service = Decision.createDecisionService(
    fakeDependencies().dependencies
  );
  const result = service.evaluate(completeInput());

  assert.strictEqual(result.verdict.status, 'conditional');
});

test('no conflict returns a recommended verdict', () => {
  const fixture = fakeDependencies();
  fixture.dependencies.conflict.detect = () => [];
  const service = Decision.createDecisionService(fixture.dependencies);
  const result = service.evaluate(completeInput());

  assert.strictEqual(result.verdict.status, 'recommended');
});

test('owned production files contain no prohibited novelty claims', () => {
  const productionFiles = [
    path.join(__dirname, '..', 'athar-decision.js'),
    path.join(__dirname, '..', 'athar-decision.html'),
  ].filter((filePath) => fs.existsSync(filePath));
  const prohibited = [
    'first' + ' platform',
    'unpre' + 'cedented',
    'AI-' + 'powered',
    'أول' + ' أداة',
    'الأولى' + ' من نوعها',
    'ذكاء' + ' اصطناعي',
  ];

  productionFiles.forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8').toLowerCase();
    prohibited.forEach((claim) => {
      assert.ok(
        !source.includes(claim.toLowerCase()),
        `${path.basename(filePath)} contains prohibited claim: ${claim}`
      );
    });
  });
});

console.log(`ALL DECISION TESTS PASSED (${count})`);
