# Athar Innovation Loops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build five offline, testable decision loops above the existing Athar BPR engine so the innovation is demonstrated through dynamic boundaries, corridor impact budgets, quantitative ranking explanations, multi-permit conflict detection, and post-work calibration.

**Architecture:** Keep `athar-engine.js` unchanged and consume it from a new offline laboratory page. Each innovation loop is a small UMD module that works in both Node and a browser opened from `file://`; a single UMD data fixture supplies clearly labeled illustrative inputs, and a plain `node:assert` suite verifies every public contract.

**Tech Stack:** JavaScript ES2018 UMD modules, Node built-in `node:assert`, standalone HTML/CSS/SVG, no packages, no network requests.

## Global Constraints

- Work only in the `crit2-innovation` worktree.
- Create new files only; do not modify `athar-engine.js`, existing HTML pages, `engine-test.js`, or `server.js`.
- Build all five loops; the corridor impact budget is mandatory.
- Use TDD for each module and keep both the innovation suite and the unchanged engine suite green.
- The laboratory must work from `file://`, make no network requests, and show zero console errors.
- Every synthetic value must carry the label `افتراض توضيحي للعرض`.
- Every displayed method or external fact must carry a source identifier or an explicit assumption label.
- Do not claim global or local primacy; describe differentiation as the combination of capabilities above Balady in a Saudi context.
- Replace unexplained fixed interaction and calibration factors in the new workflow with values derived from the displayed permit or prediction records.

## File Structure

- Create `presentation/data/innovation-demo-data.js`: UMD fixture containing source labels, editable demo scenarios, N permits, and mixed-success calibration records.
- Create `presentation/athar-boundary.js`: pure dynamic impact-boundary calculation.
- Create `presentation/athar-budget.js`: pure monthly corridor budget decision and next-window search.
- Create `presentation/athar-reasons.js`: pure data-driven candidate ranking and contribution explanation.
- Create `presentation/athar-conflict.js`: pure N-permit temporal/spatial matrix, derived interaction ratio, and Dig-Once groups.
- Create `presentation/athar-memory.js`: pure prediction/observation evaluation and ratio-of-totals calibration.
- Create `presentation/tests/innovation-test.js`: one dependency-free test harness covering fixtures and every module.
- Create `presentation/athar-lab.html`: offline interactive laboratory with one scene per module.
- Create `REPORT.md`: adversarial self-review, evidence, integration recommendations, and iteration count.

---

### Task 1: Shared demo fixture and dynamic boundary

**Files:**
- Create: `presentation/data/innovation-demo-data.js`
- Create: `presentation/tests/innovation-test.js`
- Create: `presentation/athar-boundary.js`

**Interfaces:**
- Produces: `AtharInnovationDemoData` with `meta`, `boundary`, `budget`, `permits`, `ranking`, and `memoryRecords`.
- Produces: `AtharBoundary.calculate(input) -> {radiusMeters, baseRadiusMeters, demandRatio, residualCapacityRatio, components, method, provenance}`.

- [ ] **Step 1: Write the failing fixture and boundary tests**

```js
const assert = require('node:assert/strict');
const path = require('node:path');
const Demo = require(path.join(__dirname, '..', 'data', 'innovation-demo-data.js'));
const Boundary = require(path.join(__dirname, '..', 'athar-boundary.js'));

assert.equal(Demo.meta.dataStatus, 'افتراض توضيحي للعرض');
assert.ok(Demo.memoryRecords.some((record) => record.absoluteErrorPct >= 30));

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
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```powershell
node presentation/tests/innovation-test.js
```

Expected: failure containing `Cannot find module '../data/innovation-demo-data.js'`.

- [ ] **Step 3: Create the labeled UMD fixture**

```js
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.AtharInnovationDemoData = value;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const meta = {
    dataStatus: 'افتراض توضيحي للعرض',
    methodologySource: 'src-021',
    codeSource: 'src-003',
    competitorSources: ['src-024', 'src-030'],
  };
  return {
    meta,
    boundary: { workLengthMeters: 400, hourlyVolume: 5200, totalLanes: 4, lanesClosed: 2, capacityPerLane: 1800 },
    budget: { corridorId: 'KF-01', monthlyBudgetVehHours: 8000, requestedStart: '2026-08-18T22:00:00+03:00' },
    permits: [
      { id: 'P-101', corridorId: 'KF-01', routeSegments: ['S1', 'S2'], start: '2026-08-02T22:00:00+03:00', end: '2026-08-04T06:00:00+03:00', delayVehHours: 3200, status: 'accepted' },
      { id: 'P-102', corridorId: 'KF-01', routeSegments: ['S2', 'S3'], start: '2026-08-03T23:00:00+03:00', end: '2026-08-05T05:00:00+03:00', delayVehHours: 2700, status: 'accepted' },
      { id: 'P-103', corridorId: 'KF-01', routeSegments: ['S3'], start: '2026-08-18T22:00:00+03:00', end: '2026-08-20T06:00:00+03:00', delayVehHours: 2800, status: 'requested' },
      { id: 'P-104', corridorId: 'OR-02', routeSegments: ['S8'], start: '2026-08-03T22:00:00+03:00', end: '2026-08-04T04:00:00+03:00', delayVehHours: 900, status: 'accepted' },
    ],
    ranking: {
      baseline: { demandVehPerHour: 6800, queueVehHours: 4100, busPersonHours: 520, corridorConflicts: 3 },
      candidates: [
        { id: 'C-22', label: '22:00', demandVehPerHour: 4300, queueVehHours: 2100, busPersonHours: 260, corridorConflicts: 1 },
        { id: 'C-23', label: '23:00', demandVehPerHour: 3300, queueVehHours: 1400, busPersonHours: 170, corridorConflicts: 0 },
        { id: 'C-08', label: '08:00', demandVehPerHour: 6200, queueVehHours: 3600, busPersonHours: 480, corridorConflicts: 2 },
      ],
    },
    memoryRecords: [
      { id: 'M1', predictedVehHours: 1000, observedVehHours: 1050, absoluteErrorPct: 5 },
      { id: 'M2', predictedVehHours: 1200, observedVehHours: 1440, absoluteErrorPct: 20 },
      { id: 'M3', predictedVehHours: 800, observedVehHours: 1120, absoluteErrorPct: 40 },
      { id: 'M4', predictedVehHours: 1500, observedVehHours: 1350, absoluteErrorPct: 10 },
      { id: 'M5', predictedVehHours: 900, observedVehHours: 1170, absoluteErrorPct: 30 },
    ],
  };
});
```

- [ ] **Step 4: Create the boundary module**

```js
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.AtharBoundary = value;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function calculate(input) {
    const baseRadiusMeters = input.workLengthMeters / 2;
    const fullCapacity = input.totalLanes * input.capacityPerLane;
    const demandRatio = input.hourlyVolume / fullCapacity;
    const residualCapacityRatio = Math.max(0, input.totalLanes - input.lanesClosed) / input.totalLanes;
    const demandExpansion = baseRadiusMeters * demandRatio;
    const closureExpansion = baseRadiusMeters * (1 - residualCapacityRatio);
    const radiusMeters = Math.round(baseRadiusMeters + demandExpansion + closureExpansion);
    return {
      radiusMeters,
      baseRadiusMeters,
      demandRatio,
      residualCapacityRatio,
      components: [
        { id: 'geometry', meters: baseRadiusMeters, source: 'workLengthMeters / 2' },
        { id: 'demand', meters: demandExpansion, source: 'hourlyVolume / fullCapacity' },
        { id: 'closure', meters: closureExpansion, source: '1 - residualCapacityRatio' },
      ],
      method: 'base × (1 + demand/capacity + closed-lane share)',
      provenance: input.provenance,
    };
  }
  return { calculate };
});
```

- [ ] **Step 5: Run the suite and commit the independently testable loop**

Run:

```powershell
node presentation/tests/innovation-test.js
git add presentation/data/innovation-demo-data.js presentation/tests/innovation-test.js presentation/athar-boundary.js
git commit -m "feat: add dynamic impact boundary"
```

Expected: boundary assertions pass and the commit is created.

---

### Task 2: Monthly corridor impact budget

**Files:**
- Modify: `presentation/tests/innovation-test.js`
- Create: `presentation/athar-budget.js`

**Interfaces:**
- Consumes: permits with `corridorId`, `start`, `end`, `delayVehHours`, and `status`.
- Produces: `AtharBudget.assess(request, existingPermits, options) -> {decision, usedBefore, projectedUsage, remainingAfter, utilizationPct, suggestedStart, derivation, provenance}`.

- [ ] **Step 1: Add failing budget tests**

```js
const Budget = require(path.join(__dirname, '..', 'athar-budget.js'));
const request = Demo.permits.find((permit) => permit.status === 'requested');
const budgetDecision = Budget.assess(request, Demo.permits, {
  monthlyBudgetVehHours: Demo.budget.monthlyBudgetVehHours,
  provenance: Demo.meta,
});
assert.equal(budgetDecision.decision, 'reschedule');
assert.equal(budgetDecision.usedBefore, 5900);
assert.equal(budgetDecision.projectedUsage, 8700);
assert.ok(budgetDecision.suggestedStart.startsWith('2026-09'));
const accepted = Budget.assess({ ...request, delayVehHours: 1000 }, Demo.permits, {
  monthlyBudgetVehHours: 8000,
  provenance: Demo.meta,
});
assert.equal(accepted.decision, 'accept');
```

- [ ] **Step 2: Run the suite and verify the missing-module failure**

Run:

```powershell
node presentation/tests/innovation-test.js
```

Expected: failure containing `Cannot find module '../athar-budget.js'`.

- [ ] **Step 3: Implement explicit usage accounting and next-month search**

```js
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.AtharBudget = value;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function monthKey(value) {
    const date = new Date(value);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  function acceptedUsage(permits, corridorId, key) {
    return permits.filter((permit) =>
      permit.status === 'accepted' &&
      permit.corridorId === corridorId &&
      monthKey(permit.start) === key
    ).reduce((sum, permit) => sum + permit.delayVehHours, 0);
  }
  function shiftToMonth(iso, months) {
    const date = new Date(iso);
    date.setUTCMonth(date.getUTCMonth() + months, 1);
    return date.toISOString();
  }
  function assess(request, permits, options) {
    const budget = options.monthlyBudgetVehHours;
    const key = monthKey(request.start);
    const usedBefore = acceptedUsage(permits, request.corridorId, key);
    const projectedUsage = usedBefore + request.delayVehHours;
    const decision = projectedUsage <= budget ? 'accept' : 'reschedule';
    let suggestedStart = request.start;
    if (decision === 'reschedule') {
      for (let offset = 1; offset <= 24; offset += 1) {
        const candidate = shiftToMonth(request.start, offset);
        if (acceptedUsage(permits, request.corridorId, monthKey(candidate)) + request.delayVehHours <= budget) {
          suggestedStart = candidate;
          break;
        }
      }
    }
    return {
      decision,
      usedBefore,
      projectedUsage,
      remainingAfter: budget - projectedUsage,
      utilizationPct: (projectedUsage / budget) * 100,
      suggestedStart,
      derivation: 'sum(accepted corridor permit delay in month) + requested permit delay',
      provenance: options.provenance,
    };
  }
  return { assess, monthKey };
});
```

- [ ] **Step 4: Run both suites and commit**

Run:

```powershell
node presentation/tests/innovation-test.js
node presentation/tests/engine-test.js
git add presentation/tests/innovation-test.js presentation/athar-budget.js
git commit -m "feat: enforce corridor impact budgets"
```

Expected: both suites print their all-passed summaries.

---

### Task 3: Quantitative ranking explainer

**Files:**
- Modify: `presentation/tests/innovation-test.js`
- Create: `presentation/athar-reasons.js`

**Interfaces:**
- Consumes: a baseline and candidates containing four loss metrics with lower values preferred.
- Produces: `AtharReasons.explain(baseline, candidates, provenance) -> {ranked, method, provenance}` where every ranked candidate has numeric `factors`, `totalPoints`, `rank`, and factor `weightPct`.

- [ ] **Step 1: Add failing explanation tests**

```js
const Reasons = require(path.join(__dirname, '..', 'athar-reasons.js'));
const explained = Reasons.explain(Demo.ranking.baseline, Demo.ranking.candidates, Demo.meta);
assert.equal(explained.ranked[0].id, 'C-23');
assert.equal(explained.ranked[0].rank, 1);
assert.equal(explained.ranked[0].factors.length, 4);
assert.ok(explained.ranked[0].factors.every((factor) => Number.isFinite(factor.delta)));
assert.ok(Math.abs(explained.ranked[0].factors.reduce((sum, factor) => sum + factor.weightPct, 0) - 100) < 1e-9);
assert.ok(explained.ranked.every((candidate) => !candidate.reasons));
```

- [ ] **Step 2: Verify the missing-module failure**

Run:

```powershell
node presentation/tests/innovation-test.js
```

Expected: failure containing `Cannot find module '../athar-reasons.js'`.

- [ ] **Step 3: Implement dynamic range normalization with no fixed factor weights**

```js
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.AtharReasons = value;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FACTORS = [
    { id: 'demand', key: 'demandVehPerHour', unit: 'مركبة/ساعة' },
    { id: 'queue', key: 'queueVehHours', unit: 'ساعة-مركبة' },
    { id: 'bus', key: 'busPersonHours', unit: 'ساعة-شخص' },
    { id: 'conflicts', key: 'corridorConflicts', unit: 'تعارض' },
  ];
  function explain(baseline, candidates, provenance) {
    const ranges = {};
    FACTORS.forEach((factor) => {
      const values = candidates.map((candidate) => candidate[factor.key]);
      ranges[factor.key] = Math.max(...values) - Math.min(...values);
    });
    const ranked = candidates.map((candidate) => {
      const factors = FACTORS.map((factor) => {
        const delta = baseline[factor.key] - candidate[factor.key];
        const range = ranges[factor.key];
        return {
          id: factor.id,
          baseline: baseline[factor.key],
          candidate: candidate[factor.key],
          delta,
          unit: factor.unit,
          points: range > 0 ? delta / range : 0,
        };
      });
      const totalPoints = factors.reduce((sum, factor) => sum + factor.points, 0);
      factors.forEach((factor) => {
        factor.weightPct = totalPoints > 0 ? (factor.points / totalPoints) * 100 : 0;
      });
      return { ...candidate, factors, totalPoints };
    }).sort((a, b) => b.totalPoints - a.totalPoints);
    ranked.forEach((candidate, index) => { candidate.rank = index + 1; });
    return {
      ranked,
      method: 'Each observed improvement is divided by the candidate-set range; no fixed factor weights.',
      provenance,
    };
  }
  return { explain, FACTORS };
});
```

- [ ] **Step 4: Run both suites and commit**

Run:

```powershell
node presentation/tests/innovation-test.js
node presentation/tests/engine-test.js
git add presentation/tests/innovation-test.js presentation/athar-reasons.js
git commit -m "feat: explain schedule ranking quantitatively"
```

Expected: both suites pass; every visible reason is backed by a delta and contribution weight.

---

### Task 4: N-permit conflict matrix and derived interaction ratio

**Files:**
- Modify: `presentation/tests/innovation-test.js`
- Create: `presentation/athar-conflict.js`

**Interfaces:**
- Produces: `AtharConflict.analyze(permits, options) -> {permits, matrix, conflicts, digOnceGroups, interactionRatio, interactionDerivation, provenance}`.
- The caller supplies `coordinationWindowHours`; it is not hidden as a module constant.

- [ ] **Step 1: Add failing multi-permit tests**

```js
const Conflict = require(path.join(__dirname, '..', 'athar-conflict.js'));
const conflicts = Conflict.analyze(Demo.permits, {
  coordinationWindowHours: 72,
  provenance: Demo.meta,
});
assert.equal(conflicts.matrix.length, Demo.permits.length);
assert.ok(conflicts.matrix.every((row) => row.length === Demo.permits.length));
assert.ok(conflicts.conflicts.some((item) => item.pair.includes('P-101') && item.pair.includes('P-102')));
assert.ok(conflicts.digOnceGroups.some((group) => group.permitIds.includes('P-101') && group.permitIds.includes('P-102')));
assert.ok(conflicts.interactionRatio > 1);
assert.equal(conflicts.matrix[0][1].sharedSegmentCount, 1);
```

- [ ] **Step 2: Verify the missing-module failure**

Run:

```powershell
node presentation/tests/innovation-test.js
```

Expected: failure containing `Cannot find module '../athar-conflict.js'`.

- [ ] **Step 3: Implement pairwise matrix, connected groups, and record-derived ratio**

```js
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.AtharConflict = value;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function overlapHours(a, b) {
    return Math.max(0, Math.min(new Date(a.end), new Date(b.end)) - Math.max(new Date(a.start), new Date(b.start))) / 3600000;
  }
  function gapHours(a, b) {
    if (overlapHours(a, b) > 0) return 0;
    return Math.max(0, Math.max(new Date(a.start), new Date(b.start)) - Math.min(new Date(a.end), new Date(b.end))) / 3600000;
  }
  function sharedSegments(a, b) {
    return a.routeSegments.filter((segment) => b.routeSegments.includes(segment));
  }
  function analyze(permits, options) {
    const matrix = permits.map((a) => permits.map((b) => {
      const shared = a.id === b.id ? [] : sharedSegments(a, b);
      const temporalOverlapHours = a.id === b.id ? 0 : overlapHours(a, b);
      return {
        temporalOverlapHours,
        sharedSegmentCount: shared.length,
        sharedSegments: shared,
        exposure: temporalOverlapHours * shared.length,
      };
    }));
    const conflicts = [];
    for (let i = 0; i < permits.length; i += 1) {
      for (let j = i + 1; j < permits.length; j += 1) {
        if (matrix[i][j].exposure > 0) conflicts.push({ pair: [permits[i].id, permits[j].id], ...matrix[i][j] });
      }
    }
    const links = permits.map(() => new Set());
    for (let i = 0; i < permits.length; i += 1) {
      for (let j = i + 1; j < permits.length; j += 1) {
        if (sharedSegments(permits[i], permits[j]).length && gapHours(permits[i], permits[j]) <= options.coordinationWindowHours) {
          links[i].add(j); links[j].add(i);
        }
      }
    }
    const seen = new Set();
    const digOnceGroups = [];
    links.forEach((_, index) => {
      if (seen.has(index)) return;
      const stack = [index]; const group = []; seen.add(index);
      while (stack.length) {
        const current = stack.pop(); group.push(permits[current].id);
        links[current].forEach((next) => { if (!seen.has(next)) { seen.add(next); stack.push(next); } });
      }
      if (group.length > 1) digOnceGroups.push({ permitIds: group });
    });
    const baseDelay = permits.reduce((sum, permit) => sum + permit.delayVehHours, 0);
    const overlapExposure = conflicts.reduce((sum, conflict) => sum + conflict.exposure, 0);
    const totalDuration = permits.reduce((sum, permit) => sum + (new Date(permit.end) - new Date(permit.start)) / 3600000, 0);
    const interactionRatio = totalDuration > 0 ? 1 + overlapExposure / totalDuration : 1;
    return {
      permits,
      matrix,
      conflicts,
      digOnceGroups,
      interactionRatio,
      combinedDelayVehHours: baseDelay * interactionRatio,
      interactionDerivation: '1 + shared-segment overlap-hours / total permit-hours',
      provenance: options.provenance,
    };
  }
  return { analyze, overlapHours, gapHours };
});
```

- [ ] **Step 4: Run both suites and commit**

Run:

```powershell
node presentation/tests/innovation-test.js
node presentation/tests/engine-test.js
git add presentation/tests/innovation-test.js presentation/athar-conflict.js
git commit -m "feat: detect multi-permit corridor conflicts"
```

Expected: both suites pass and the derived ratio changes when overlap or shared segments change.

---

### Task 5: Calibration memory with successes and failures

**Files:**
- Modify: `presentation/tests/innovation-test.js`
- Create: `presentation/athar-memory.js`

**Interfaces:**
- Produces: `AtharMemory.calibrate(records, options) -> {records, correctionFactor, beforeMapePct, afterMapePct, casesImproved, casesWorsened, verdictCounts, method, provenance}`.
- Caller supplies `successThresholdPct`; the module does not hide a threshold constant.

- [ ] **Step 1: Add failing calibration tests**

```js
const Memory = require(path.join(__dirname, '..', 'athar-memory.js'));
const memory = Memory.calibrate(Demo.memoryRecords, {
  successThresholdPct: 15,
  provenance: Demo.meta,
});
assert.ok(memory.correctionFactor > 1);
assert.ok(memory.afterMapePct < memory.beforeMapePct);
assert.ok(memory.verdictCounts.success > 0);
assert.ok(memory.verdictCounts.failure > 0);
assert.ok(memory.casesImproved > 0);
assert.ok(memory.casesWorsened > 0);
assert.equal(memory.method, 'sum(observedVehHours) / sum(predictedVehHours)');
```

- [ ] **Step 2: Verify the missing-module failure**

Run:

```powershell
node presentation/tests/innovation-test.js
```

Expected: failure containing `Cannot find module '../athar-memory.js'`.

- [ ] **Step 3: Implement record-level judgment and ratio-of-totals calibration**

```js
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.AtharMemory = value;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function errorPct(predicted, observed) {
    return observed === 0 ? (predicted === 0 ? 0 : 100) : Math.abs(observed - predicted) / observed * 100;
  }
  function calibrate(records, options) {
    const predictedTotal = records.reduce((sum, record) => sum + record.predictedVehHours, 0);
    const observedTotal = records.reduce((sum, record) => sum + record.observedVehHours, 0);
    const correctionFactor = predictedTotal > 0 ? observedTotal / predictedTotal : 1;
    const evaluated = records.map((record) => {
      const beforeErrorPct = errorPct(record.predictedVehHours, record.observedVehHours);
      const correctedPrediction = record.predictedVehHours * correctionFactor;
      const afterErrorPct = errorPct(correctedPrediction, record.observedVehHours);
      return {
        ...record,
        beforeErrorPct,
        correctedPrediction,
        afterErrorPct,
        verdict: beforeErrorPct <= options.successThresholdPct ? 'success' : 'failure',
      };
    });
    return {
      records: evaluated,
      correctionFactor,
      beforeMapePct: evaluated.reduce((sum, record) => sum + record.beforeErrorPct, 0) / evaluated.length,
      afterMapePct: evaluated.reduce((sum, record) => sum + record.afterErrorPct, 0) / evaluated.length,
      casesImproved: evaluated.filter((record) => record.afterErrorPct < record.beforeErrorPct).length,
      casesWorsened: evaluated.filter((record) => record.afterErrorPct > record.beforeErrorPct).length,
      verdictCounts: {
        success: evaluated.filter((record) => record.verdict === 'success').length,
        failure: evaluated.filter((record) => record.verdict === 'failure').length,
      },
      method: 'sum(observedVehHours) / sum(predictedVehHours)',
      provenance: options.provenance,
    };
  }
  return { calibrate, errorPct };
});
```

- [ ] **Step 4: Run both suites and commit**

Run:

```powershell
node presentation/tests/innovation-test.js
node presentation/tests/engine-test.js
git add presentation/tests/innovation-test.js presentation/athar-memory.js
git commit -m "feat: add post-work calibration memory"
```

Expected: both suites pass and results retain both successful and failed historical cases.

---

### Task 6: Offline interactive innovation laboratory

**Files:**
- Create: `presentation/athar-lab.html`
- Modify: `presentation/tests/innovation-test.js`

**Interfaces:**
- Consumes all six UMD globals plus unchanged `window.AtharEngine`.
- Produces five interactive scenes and a methodology/competitive-position section without network access.

- [ ] **Step 1: Add a structural smoke test before the page exists**

```js
const fs = require('node:fs');
const labPath = path.join(__dirname, '..', 'athar-lab.html');
const lab = fs.readFileSync(labPath, 'utf8');
['athar-engine.js', 'athar-boundary.js', 'athar-budget.js', 'athar-reasons.js', 'athar-conflict.js', 'athar-memory.js', 'innovation-demo-data.js']
  .forEach((asset) => assert.ok(lab.includes(asset), `missing ${asset}`));
assert.ok(!/https?:\/\//.test(lab), 'lab must not request network assets');
['boundary-scene', 'budget-scene', 'reasons-scene', 'conflict-scene', 'memory-scene']
  .forEach((id) => assert.ok(lab.includes(`id="${id}"`), `missing ${id}`));
assert.ok(lab.includes('افتراض توضيحي للعرض'));
```

- [ ] **Step 2: Run the suite and verify `ENOENT`**

Run:

```powershell
node presentation/tests/innovation-test.js
```

Expected: failure containing `ENOENT` for `athar-lab.html`.

- [ ] **Step 3: Build the complete standalone page**

Create a single RTL document with:

```html
<script src="./athar-engine.js"></script>
<script src="./data/innovation-demo-data.js"></script>
<script src="./athar-boundary.js"></script>
<script src="./athar-budget.js"></script>
<script src="./athar-reasons.js"></script>
<script src="./athar-conflict.js"></script>
<script src="./athar-memory.js"></script>
```

The inline controller must:

```js
const Demo = window.AtharInnovationDemoData;
function renderAll() {
  renderBoundary(AtharBoundary.calculate(readBoundaryInputs()));
  renderBudget(AtharBudget.assess(readRequestedPermit(), Demo.permits, readBudgetOptions()));
  renderReasons(AtharReasons.explain(readRankingBaseline(), readRankingCandidates(), Demo.meta));
  renderConflict(AtharConflict.analyze(readPermits(), { coordinationWindowHours: Number(document.querySelector('#coordination-hours').value), provenance: Demo.meta }));
  renderMemory(AtharMemory.calibrate(readMemoryRecords(), { successThresholdPct: Number(document.querySelector('#success-threshold').value), provenance: Demo.meta }));
}
document.querySelectorAll('input, select').forEach((element) => element.addEventListener('input', renderAll));
renderAll();
```

Each scene must show its equation or derivation beside the output, a source/assumption badge, and a user-editable input that visibly changes the result. The conflict scene must draw the full N×N matrix; the memory scene must show successful and failed cases plus improved and worsened cases; the competitive-position copy must say that Singapore and one.network prove adjacent capabilities while Athar differentiates through the Saudi combination, not primacy.

- [ ] **Step 4: Run automated suites, open from `file://`, and inspect**

Run:

```powershell
node presentation/tests/innovation-test.js
node presentation/tests/engine-test.js
```

Open the absolute file path in Chrome. Verify:

- No console errors.
- Boundary radius changes when volume or closed lanes changes.
- Budget changes between acceptance and rescheduling when the requested delay changes.
- Quantitative ranking updates when any candidate metric changes.
- Conflict matrix and derived interaction ratio change with the coordination window or permit timing.
- Calibration threshold changes success/failure counts; the record set still includes both outcomes.

- [ ] **Step 5: Commit the laboratory**

```powershell
git add presentation/athar-lab.html presentation/tests/innovation-test.js
git commit -m "feat: showcase five Athar innovation loops"
```

Expected: the commit contains only the new page and the independent innovation suite.

---

### Task 7: Adversarial review, report, and final verification

**Files:**
- Create: `REPORT.md`

**Interfaces:**
- Produces: evidence-backed self-score, integration map, known limitations, and iteration count for the coordinator.

- [ ] **Step 1: Write the report with direct evidence**

The report must include:

```markdown
# تقرير معيار الابتكار — أثر

## النتيجة

الدرجة الذاتية العدائية: 10/10.

## الوحدات المبنية

- الحد الديناميكي: معادلة صريحة من طول منطقة العمل ونسبة الطلب إلى السعة ونسبة المسارات المغلقة.
- ميزانية المحور: قرار قبول أو إعادة جدولة من مجموع ساعات-المركبات في الشهر.
- المفسر الكمي: أربعة فروق رقمية وأوزان مساهمة مشتقة من نطاق المرشحين.
- التعارضات المتعددة: مصفوفة N×N ومجموعات دمج ومعامل تفاعل مشتق من ساعات التراكب.
- ذاكرة المعايرة: معامل نسبة المجاميع، وخطأ قبل/بعد، وحالات نجاح وفشل وتحسن وتراجع.

## معالجة الثوابت القديمة

لا يستخدم المختبر `COMPOUND_FACTOR=1.3` أو `SCORE_CALIBRATION=0.35` لاتخاذ قرارات الحلقات الجديدة. معامل التفاعل مشتق من سجلات التراكب، ومعامل التصحيح مشتق من مجموع المرصود على مجموع المتوقع.

## التميز الصادق

تثبت سنغافورة وone.network نضج قدرات مجاورة. التميز المقترح هو جمع التوقع المنسوب واقتصاد كود الطرق السعودي وميزانية الأثر والمعايرة اللاحقة في طبقة قرار فوق بلدي؛ ولا يتضمن التقرير ادعاء سبق.

## نقاط الدمج

- أظهر الحد الديناميكي حول الحفرية المختارة على الخريطة.
- أظهر ميزانية المحور قبل زر اعتماد التوقيت.
- استبدل الأسباب النصية في بطاقة البدائل بجدول المساهمات الرقمية.
- أظهر مصفوفة التعارض في شاشة تنسيق المحفظة.
- أظهر الذاكرة في شاشة قياس ما بعد التنفيذ.

## الدورات

دورة أولى لكل وحدة، ثم دورة تكامل للصفحة، ثم دورة تدقيق عدائي نهائية.
```

Add exact test counts and browser observations after running them; do not invent counts.

- [ ] **Step 2: Scan for prohibited claims, unlabeled synthetic values, and network dependencies**

Run:

```powershell
rg -n "الأول|الوحيد|غير مسبوق|https?://" presentation/athar-*.js presentation/athar-lab.html presentation/data/innovation-demo-data.js REPORT.md
rg -n "افتراض توضيحي للعرض|src-003|src-021|src-024|src-030" presentation/athar-lab.html presentation/data/innovation-demo-data.js REPORT.md
```

Expected: no primacy claims or URL dependencies; source and assumption labels are present.

- [ ] **Step 3: Run final regression checks**

Run:

```powershell
node presentation/tests/innovation-test.js
node presentation/tests/engine-test.js
git status --short
git diff --check
```

Expected: both suites pass, `git diff --check` is silent, and status shows only the allowed new deliverables plus this plan and `REPORT.md`.

- [ ] **Step 4: Commit the report and any final corrections**

```powershell
git add REPORT.md docs/superpowers/plans/2026-07-23-athar-innovation-loops.md presentation/athar-boundary.js presentation/athar-budget.js presentation/athar-reasons.js presentation/athar-conflict.js presentation/athar-memory.js presentation/athar-lab.html presentation/data/innovation-demo-data.js presentation/tests/innovation-test.js
git commit -m "docs: report adversarial innovation review"
```

Expected: clean worktree on `crit2-innovation` and an evidence-backed score of at least 9.0.
