# City Impact Portfolio + Owned Map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the weakest judging criterion (الأثر) with a city-wide representative portfolio computed by the real engine, then replace OSM tiles with an owned editable GeoJSON map.

**Architecture:** New pure module `athar-portfolio.js` (UMD, same pattern as `athar-engine.js`) generates 150 seeded representative permits, runs each through `AtharEngine.score()/optimize()`, aggregates totals + range conversions. A standalone RTL dashboard `athar-city-impact.html` renders it offline. Phase 2 swaps Leaflet tile layer for a local `riyadh-roads.geojson` render with editable per-road properties feeding `athar-routing.js`.

**Tech Stack:** Vanilla JS (no deps), Node stdlib for tests (`node file.js` + `assert`), Leaflet (already vendored), existing engine API.

## Global Constraints

- **No git repo** at `C:\Users\wasan\Downloads\Swarm` — skip all commit steps; verification = test runs.
- All work under `C:\Users\wasan\Downloads\Swarm\Baladiyathon\presentation\`.
- Zero external dependencies; pages must work offline by double-clicking the HTML file.
- Every displayed number derives from `buildPortfolio(SEED)` — no hand-written result numbers anywhere.
- Mandatory visible label on all portfolio output: `سيناريو تمثيلي — مدخلات موسومة، حسابات المحرك حقيقية`.
- Fixed seed constant: `20260727`.
- Engine API (verbatim, from `athar-engine.js`):
  - `score({aadt,lanes,lanesClosed,startHour,durationHours}) → {delayVehHours, score, level, hourly}`
  - `optimize(sameInput) → {top3:[{label,startHour,phases,windows,delayVehHours,savedVehHours,savedPct,reasons}], baseline:{delayVehHours,windows}}`
  - `personHours(vehHours) → {lowPersonHours, highPersonHours, occLow, occHigh}`
  - `timeValueSAR(phRange) → {lowSAR, highSAR, ...}`
  - `co2Range(vehHours) → {lowFuelL, highFuelL, lowCo2Kg, highCo2Kg}`
  - `digOnce({trenchKm, permitsMerged}) → {separateSAR, savedLowSAR, savedHighSAR, savedPctLow, savedPctHigh, ...}`
- UMD wrapper identical to engine: `module.exports` under Node, `window.AtharPortfolio` in browser.
- Tests follow house style: plain `node presentation/tests/x-test.js`, `assert`, `ok - <name>` lines, final `ALL ... PASSED (n)`.

---

### Task 1: Seeded permit generator (`athar-portfolio.js` part 1)

**Files:**
- Create: `presentation/athar-portfolio.js`
- Create: `presentation/tests/portfolio-test.js`

**Interfaces:**
- Produces: `AtharPortfolio.SEED` (number, 20260727), `AtharPortfolio.CORRIDORS` (array of 12), `AtharPortfolio.mulberry32(seed) → () => float[0,1)`, `AtharPortfolio.buildPermits(seed) → permit[150]` where permit = `{id, corridorId, corridorClass, aadt, lanes, lanesClosed, startHour, durationHours, startDay}`.

- [ ] **Step 1: Write the failing test**

```js
'use strict';
const assert = require('assert');
const path = require('path');
const Portfolio = require(path.join(__dirname, '..', 'athar-portfolio.js'));

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

console.log(`ALL PORTFOLIO TESTS PASSED (${passed})`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node presentation/tests/portfolio-test.js`
Expected: FAIL — `Cannot find module '.../athar-portfolio.js'`

- [ ] **Step 3: Write minimal implementation**

```js
/**
 * أثر — مولد محفظة المدينة التمثيلية
 * سيناريو تمثيلي: مدخلات موسومة، حسابات المحرك حقيقية.
 * وحدة صرفة بلا DOM وبلا شبكة — نفس نمط athar-engine.js (UMD).
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./athar-engine.js'));
  } else {
    root.AtharPortfolio = factory(root.AtharEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (AtharEngine) {
  'use strict';

  const SEED = 20260727;
  const PERMIT_COUNT = 150;
  const DAYTIME_SHARE = 0.7;
  const LABEL = 'سيناريو تمثيلي — مدخلات موسومة، حسابات المحرك حقيقية';

  // 12 ممراً تمثيلياً بثلاثة أصناف — النطاقات توضيحية موسومة
  const CORRIDORS = [
    { id: 'art_1', nameAr: 'شرياني أ', class: 'arterial', aadtLow: 70000, aadtHigh: 90000, lanes: 4 },
    { id: 'art_2', nameAr: 'شرياني ب', class: 'arterial', aadtLow: 70000, aadtHigh: 90000, lanes: 4 },
    { id: 'art_3', nameAr: 'شرياني ج', class: 'arterial', aadtLow: 70000, aadtHigh: 90000, lanes: 4 },
    { id: 'art_4', nameAr: 'شرياني د', class: 'arterial', aadtLow: 70000, aadtHigh: 90000, lanes: 4 },
    { id: 'maj_1', nameAr: 'رئيسي أ', class: 'major', aadtLow: 35000, aadtHigh: 55000, lanes: 3 },
    { id: 'maj_2', nameAr: 'رئيسي ب', class: 'major', aadtLow: 35000, aadtHigh: 55000, lanes: 3 },
    { id: 'maj_3', nameAr: 'رئيسي ج', class: 'major', aadtLow: 35000, aadtHigh: 55000, lanes: 3 },
    { id: 'maj_4', nameAr: 'رئيسي د', class: 'major', aadtLow: 35000, aadtHigh: 55000, lanes: 3 },
    { id: 'loc_1', nameAr: 'فرعي أ', class: 'local', aadtLow: 10000, aadtHigh: 25000, lanes: 2 },
    { id: 'loc_2', nameAr: 'فرعي ب', class: 'local', aadtLow: 10000, aadtHigh: 25000, lanes: 2 },
    { id: 'loc_3', nameAr: 'فرعي ج', class: 'local', aadtLow: 10000, aadtHigh: 25000, lanes: 2 },
    { id: 'loc_4', nameAr: 'فرعي د', class: 'local', aadtLow: 10000, aadtHigh: 25000, lanes: 2 },
  ];

  function mulberry32(seed) {
    let state = seed >>> 0;
    return function next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function intIn(rand, low, high) {
    return low + Math.floor(rand() * (high - low + 1));
  }

  function buildPermits(seed) {
    const rand = mulberry32(seed);
    const permits = [];
    for (let i = 0; i < PERMIT_COUNT; i += 1) {
      const corridor = CORRIDORS[intIn(rand, 0, CORRIDORS.length - 1)];
      const lanesClosed = intIn(rand, 1, corridor.lanes - 1);
      const daytime = rand() < DAYTIME_SHARE;
      const startHour = daytime ? intIn(rand, 7, 15) : intIn(rand, 16, 23);
      permits.push({
        id: 'p' + String(i + 1).padStart(3, '0'),
        corridorId: corridor.id,
        corridorClass: corridor.class,
        aadt: intIn(rand, corridor.aadtLow, corridor.aadtHigh),
        lanes: corridor.lanes,
        lanesClosed,
        startHour,
        durationHours: intIn(rand, 24, 240),
        startDay: intIn(rand, 0, 364),
      });
    }
    return permits;
  }

  return {
    SEED,
    LABEL,
    CORRIDORS,
    mulberry32,
    buildPermits,
  };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node presentation/tests/portfolio-test.js`
Expected: `ALL PORTFOLIO TESTS PASSED (6)`

---

### Task 2: Portfolio aggregation (`buildPortfolio`)

**Files:**
- Modify: `presentation/athar-portfolio.js` (add `buildPortfolio`, export it)
- Modify: `presentation/tests/portfolio-test.js` (append tests)

**Interfaces:**
- Consumes: Task 1 `buildPermits`, engine `score/optimize/personHours/timeValueSAR/co2Range/digOnce`.
- Produces: `AtharPortfolio.buildPortfolio(seed) → { label, seed, permitCount, totals:{baselineVehHours, optimizedVehHours, savedVehHours, savedPct}, ranges:{personHours:{lowPersonHours,highPersonHours}, timeValue:{lowSAR,highSAR}, co2:{lowCo2Kg,highCo2Kg}}, byClass:{arterial:{baseline,optimized,saved}, major:{...}, local:{...}}, digOnceMerged:{groups, permits, savedLowSAR, savedHighSAR} }`.

- [ ] **Step 1: Append failing tests to `portfolio-test.js`** (before the final `console.log`)

```js
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
  const Engine = require(path.join(__dirname, '..', 'athar-engine.js'));
  const ph = Engine.personHours(p.totals.savedVehHours);
  assert.strictEqual(p.ranges.personHours.lowPersonHours, ph.lowPersonHours);
  const co2 = Engine.co2Range(p.totals.savedVehHours);
  assert.strictEqual(p.ranges.co2.highCo2Kg, co2.highCo2Kg);
});

ok('buildPortfolio: digOnce groups only same-corridor overlaps within 30 days', () => {
  const p = Portfolio.buildPortfolio(Portfolio.SEED);
  assert.ok(p.digOnceMerged.groups >= 1, 'with 150 permits on 12 corridors overlaps must exist');
  assert.ok(p.digOnceMerged.permits >= 2 * p.digOnceMerged.groups);
  assert.ok(p.digOnceMerged.savedHighSAR > p.digOnceMerged.savedLowSAR);
});
```

- [ ] **Step 2: Run test to verify new tests fail**

Run: `node presentation/tests/portfolio-test.js`
Expected: FAIL — `Portfolio.buildPortfolio is not a function`

- [ ] **Step 3: Implement `buildPortfolio` in `athar-portfolio.js`** (before the `return`, and add to exports)

```js
  const DIG_ONCE_WINDOW_DAYS = 30;
  const DIG_ONCE_TRENCH_KM = 1.0; // طول خندق تمثيلي موحد لكل مجموعة دمج

  function buildPortfolio(seed) {
    const permits = buildPermits(seed);
    const byClass = {
      arterial: { baseline: 0, optimized: 0, saved: 0 },
      major: { baseline: 0, optimized: 0, saved: 0 },
      local: { baseline: 0, optimized: 0, saved: 0 },
    };
    let baselineVehHours = 0;
    let optimizedVehHours = 0;

    for (const permit of permits) {
      const input = {
        aadt: permit.aadt,
        lanes: permit.lanes,
        lanesClosed: permit.lanesClosed,
        startHour: permit.startHour,
        durationHours: permit.durationHours,
      };
      const result = AtharEngine.optimize(input);
      const base = result.baseline.delayVehHours;
      const best = result.top3[0].delayVehHours;
      baselineVehHours += base;
      optimizedVehHours += best;
      const bucket = byClass[permit.corridorClass];
      bucket.baseline += base;
      bucket.optimized += best;
      bucket.saved += Math.max(0, base - best);
    }

    const savedVehHours = Math.max(0, baselineVehHours - optimizedVehHours);
    const savedPct = baselineVehHours > 0 ? (100 * savedVehHours) / baselineVehHours : 0;

    // دمج Dig-Once: نفس الممر + تداخل بدء ضمن 30 يوماً
    const byCorridor = new Map();
    for (const permit of permits) {
      if (!byCorridor.has(permit.corridorId)) byCorridor.set(permit.corridorId, []);
      byCorridor.get(permit.corridorId).push(permit);
    }
    let groups = 0;
    let mergedPermits = 0;
    let savedLowSAR = 0;
    let savedHighSAR = 0;
    for (const list of byCorridor.values()) {
      const sorted = list.slice().sort((a, b) => a.startDay - b.startDay);
      let group = [sorted[0]];
      for (let i = 1; i <= sorted.length; i += 1) {
        const current = sorted[i];
        const previous = group[group.length - 1];
        if (current && current.startDay - previous.startDay <= DIG_ONCE_WINDOW_DAYS) {
          group.push(current);
        } else {
          if (group.length >= 2) {
            const digResult = AtharEngine.digOnce({
              trenchKm: DIG_ONCE_TRENCH_KM,
              permitsMerged: group.length,
            });
            groups += 1;
            mergedPermits += group.length;
            savedLowSAR += digResult.savedLowSAR;
            savedHighSAR += digResult.savedHighSAR;
          }
          group = current ? [current] : [];
        }
      }
    }

    const personHoursRange = AtharEngine.personHours(savedVehHours);
    return {
      label: LABEL,
      seed,
      permitCount: permits.length,
      totals: { baselineVehHours, optimizedVehHours, savedVehHours, savedPct },
      ranges: {
        personHours: personHoursRange,
        timeValue: AtharEngine.timeValueSAR(personHoursRange),
        co2: AtharEngine.co2Range(savedVehHours),
      },
      byClass,
      digOnceMerged: { groups, permits: mergedPermits, savedLowSAR, savedHighSAR },
    };
  }
```

Add `buildPortfolio,` to the returned export object.

- [ ] **Step 4: Run full suite**

Run: `node presentation/tests/portfolio-test.js`
Expected: `ALL PORTFOLIO TESTS PASSED (12)`
Also run regression: `node presentation/tests/engine-test.js` → still `ALL TESTS PASSED (62)`.

**Note:** check `timeValueSAR` return field names in `athar-engine.js` (~line 453) before writing the dashboard — test above only pins `personHours`/`co2Range`; mirror actual field names (`lowSAR`/`highSAR` or as defined) everywhere.

---

### Task 3: City impact dashboard `athar-city-impact.html`

**Files:**
- Create: `presentation/athar-city-impact.html`
- Create: `presentation/tests/city-impact-smoke-test.js`

**Interfaces:**
- Consumes: `athar-engine.js`, `athar-portfolio.js` via `<script>` tags (`window.AtharPortfolio.buildPortfolio(AtharPortfolio.SEED)`).
- Produces: standalone page; elements with ids `badge-representative`, `counter-saved-veh-hours`, `card-time-value`, `card-co2`, `card-person-hours`, `card-dig-once`, `chart-by-class`, `section-methodology`.

- [ ] **Step 1: Write failing smoke test** (house pattern: static HTML content checks, like `ui-smoke-test.js`)

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(
  path.join(__dirname, '..', 'athar-city-impact.html'),
  'utf8'
);
const Portfolio = require(path.join(__dirname, '..', 'athar-portfolio.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

ok('page carries the mandatory representative-scenario badge', () => {
  assert.ok(html.includes('id="badge-representative"'));
  assert.ok(html.includes(Portfolio.LABEL));
});

ok('page loads engine then portfolio scripts', () => {
  const engineAt = html.indexOf('athar-engine.js');
  const portfolioAt = html.indexOf('athar-portfolio.js');
  assert.ok(engineAt !== -1 && portfolioAt !== -1 && engineAt < portfolioAt);
});

ok('page has counter, 4 cards, chart, methodology section', () => {
  for (const id of [
    'counter-saved-veh-hours',
    'card-time-value',
    'card-co2',
    'card-person-hours',
    'card-dig-once',
    'chart-by-class',
    'section-methodology',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
});

ok('methodology declares equation, seed and permit count', () => {
  assert.ok(html.includes('تأخير كما قُدم'));
  assert.ok(html.includes(String(Portfolio.SEED)));
  assert.ok(html.includes('150'));
});

ok('no hand-written result numbers: dynamic slots are empty placeholders', () => {
  const counter = html.match(/id="counter-saved-veh-hours"[^>]*>([^<]*)</);
  assert.ok(counter && counter[1].trim().replace('—', '') === '', 'counter must be filled by JS only');
});

ok('page is RTL Arabic and offline (no external hosts)', () => {
  assert.ok(/dir="rtl"/.test(html));
  assert.ok(!/https?:\/\/(?!balady|www\.gov|gao|opendata|shc)/.test(html.replace(/<!--[\s\S]*?-->/g, '')) || !/src="https?:/.test(html));
});

console.log(`ALL CITY IMPACT SMOKE TESTS PASSED (${passed})`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node presentation/tests/city-impact-smoke-test.js`
Expected: FAIL — `ENOENT ... athar-city-impact.html`

- [ ] **Step 3: Build the page**

Structure (copy design tokens — colors, fonts, card styles — from `athar-merged.html`; page must visually match the family):

```html
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>أثر — لوحة أثر المدينة (سيناريو تمثيلي)</title>
<style>/* tokens from athar-merged.html + grid layout for cards */</style>
</head>
<body>
  <div id="badge-representative" class="badge-fixed">سيناريو تمثيلي — مدخلات موسومة، حسابات المحرك حقيقية</div>

  <header><h1>لو شغّلنا «أثر» على محفظة مدينة سنة كاملة</h1>
    <p>150 تصريحاً تمثيلياً · 12 ممراً · حسابات المحرك الحقيقي</p></header>

  <section class="hero">
    <div class="counter-label">ساعات-مركبة موفرة سنوياً (سيناريو تمثيلي)</div>
    <div id="counter-saved-veh-hours" class="counter">—</div>
    <div id="counter-saved-pct" class="counter-sub"></div>
  </section>

  <section class="cards">
    <div class="card" id="card-time-value"><h3>قيمة الوقت (نطاق كود 203)</h3><div class="value"></div></div>
    <div class="card" id="card-person-hours"><h3>ساعات-أشخاص (إشغال 1.2–1.6)</h3><div class="value"></div></div>
    <div class="card" id="card-co2"><h3>CO₂ موفر (فيزيائي فقط)</h3><div class="value"></div></div>
    <div class="card" id="card-dig-once"><h3>تصاريح Dig-Once مدمجة</h3><div class="value"></div></div>
  </section>

  <section><h2>قبل/بعد حسب صنف الممر</h2><svg id="chart-by-class" viewBox="0 0 700 300"></svg></section>

  <section id="section-methodology">
    <h2>كيف حُسب هذا</h2>
    <p>المعادلة: الأثر السنوي = مجموع (تأخير كما قُدم − تأخير الجدول الأمثل) لكل تصريح، مقاسة بمحرك أثر.</p>
    <p>البذرة الثابتة: 20260727 · عدد التصاريح: 150 · المدخلات تمثيلية موسومة، لا تمثل بيانات رسمية.</p>
  </section>

  <script src="athar-engine.js"></script>
  <script src="athar-portfolio.js"></script>
  <script>
    (function () {
      'use strict';
      const p = AtharPortfolio.buildPortfolio(AtharPortfolio.SEED);
      const fmt = (n) => Math.round(n).toLocaleString('ar-SA');
      const fmtRange = (a, b) => fmt(a) + ' – ' + fmt(b);

      // count-up animation for the hero counter (requestAnimationFrame, 1.5s)
      const target = p.totals.savedVehHours;
      const el = document.getElementById('counter-saved-veh-hours');
      const t0 = performance.now();
      function tick(t) {
        const k = Math.min(1, (t - t0) / 1500);
        el.textContent = fmt(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      document.getElementById('counter-saved-pct').textContent =
        'وفر ' + p.totals.savedPct.toFixed(1) + '٪ من تأخير المحفظة كما قُدمت';

      document.querySelector('#card-time-value .value').textContent =
        fmtRange(p.ranges.timeValue.lowSAR, p.ranges.timeValue.highSAR) + ' ﷼';
      document.querySelector('#card-person-hours .value').textContent =
        fmtRange(p.ranges.personHours.lowPersonHours, p.ranges.personHours.highPersonHours) + ' س-ش';
      document.querySelector('#card-co2 .value').textContent =
        fmtRange(p.ranges.co2.lowCo2Kg, p.ranges.co2.highCo2Kg) + ' كجم';
      document.querySelector('#card-dig-once .value').textContent =
        p.digOnceMerged.permits + ' تصريحاً في ' + p.digOnceMerged.groups + ' مجموعة · وفر ' +
        fmtRange(p.digOnceMerged.savedLowSAR, p.digOnceMerged.savedHighSAR) + ' ﷼';

      // grouped bar chart: baseline vs optimized per class (hand-drawn SVG rects)
      const svg = document.getElementById('chart-by-class');
      const classes = [
        ['arterial', 'شرياني'], ['major', 'رئيسي'], ['local', 'فرعي'],
      ];
      const max = Math.max(...classes.map(([k]) => p.byClass[k].baseline));
      classes.forEach(([key, label], i) => {
        const x = 80 + i * 200;
        const bh = 220 * (p.byClass[key].baseline / max);
        const oh = 220 * (p.byClass[key].optimized / max);
        svg.innerHTML +=
          `<rect x="${x}" y="${250 - bh}" width="60" height="${bh}" fill="#b23b3b"></rect>` +
          `<rect x="${x + 70}" y="${250 - oh}" width="60" height="${oh}" fill="#2e7d4f"></rect>` +
          `<text x="${x + 65}" y="275" text-anchor="middle" font-size="14">${label}</text>`;
      });
    })();
  </script>
</body>
</html>
```

(NOTE: verify `timeValueSAR` field names against engine before wiring `card-time-value`; adjust if fields are e.g. `low`/`high`.)

- [ ] **Step 4: Run smoke test + open in browser**

Run: `node presentation/tests/city-impact-smoke-test.js`
Expected: `ALL CITY IMPACT SMOKE TESTS PASSED (6)`
Manual: open `presentation/athar-city-impact.html` in browser — counter animates, no console errors, works offline.

---

### Task 4: Pitch slide + idea card update + integrity test

**Files:**
- Modify: `presentation/athar-pitch.html` (add one slide summarizing the city dashboard, linking `athar-city-impact.html`)
- Modify: `Baladiyathon/بطاقة-الفكرة.md` («الأثر والاستدامة» section)
- Modify: `presentation/tests/pitch-integrity-test.js` (guard the new slide)

**Interfaces:**
- Consumes: `buildPortfolio(SEED)` output (numbers rendered at build time must match — pitch slide loads the same scripts and fills numbers dynamically, same pattern as Task 3, so nothing hardcoded).

- [ ] **Step 1: Add failing integrity assertions** to `pitch-integrity-test.js` (follow its existing style — inspect the file first, append in the same pattern):

```js
// الشريحة الجديدة: أثر المدينة — لا رقم بلا وسم
assert.ok(pitchHtml.includes('athar-city-impact.html'), 'pitch links city impact dashboard');
assert.ok(pitchHtml.includes('سيناريو تمثيلي'), 'city slide carries representative label');
```

- [ ] **Step 2: Run to verify failure**

Run: `node presentation/tests/pitch-integrity-test.js`
Expected: FAIL on the two new assertions.

- [ ] **Step 3: Add the slide to `athar-pitch.html`**

Follow the deck's existing slide markup. Content:

- Title: «الأثر على مستوى المدينة — سيناريو تمثيلي»
- Dynamic numbers (same script pattern: load `athar-engine.js` + `athar-portfolio.js`, fill spans from `buildPortfolio(SEED)`): ساعات-مركبة موفرة (نطاق٪)، ريالات (نطاق)، CO₂ (نطاق)، عدد تصاريح Dig-Once.
- One line: المعادلة + «مدخلات موسومة، حسابات المحرك حقيقية».
- Link/button → `athar-city-impact.html`.
- Vision 2030 line: «يدعم مستهدفات جودة الحياة وكفاءة الإنفاق في رؤية 2030 — عبر تقليل ساعات التأخير وتنسيق الحفر».

- [ ] **Step 4: Update `بطاقة-الفكرة.md` «الأثر والاستدامة»**

Keep the existing honest bullets (no measured field result). Append:

```markdown
- سيناريو تمثيلي لمحفظة مدينة: 150 تصريحاً تمثيلياً على 12 ممراً مُررت عبر محرك أثر الحقيقي
  (بذرة ثابتة 20260727). المعادلة: الأثر = مجموع (تأخير كما قُدم − تأخير الجدول الأمثل).
  النتائج نطاقات لا أرقاماً مفردة، والمدخلات موسومة «تمثيلية» — انظر `presentation/athar-city-impact.html`.
- الربط برؤية 2030: تقليل ساعات التأخير يدعم مؤشر جودة الحياة، ودمج الحفريات (Dig-Once)
  يدعم كفاءة الإنفاق الحكومي.
```

(Numbers themselves stay out of the markdown — the dashboard is the single source; avoids drift.)

- [ ] **Step 5: Run all affected tests**

Run:
```
node presentation/tests/pitch-integrity-test.js
node presentation/tests/city-impact-smoke-test.js
node presentation/tests/portfolio-test.js
node presentation/tests/ui-smoke-test.js
```
Expected: all pass.

---

### Task 5: Owned GeoJSON map (Phase 2)

**Files:**
- Create: `presentation/data/riyadh-roads.geojson`
- Create: `presentation/athar-ownedmap.js`
- Modify: `presentation/athar-prototype.html` (swap tile layer; fallback preserved)
- Create: `presentation/tests/ownedmap-test.js`

**Interfaces:**
- Consumes: Leaflet (vendored), `athar-routing.js` graph-building (inspect `buildGraph()` signature in `athar-routing.js` first).
- Produces: `AtharOwnedMap.load(map, geojson) → {layers, roads[]}`, `AtharOwnedMap.toRoutingSegments(roads) → segments` compatible with `athar-routing.js` input.

- [ ] **Step 1: Extract roads GeoJSON (one-time, needs internet once)**

Overpass query for Olaya bbox (24.66,46.66,24.74,46.72), highways `motorway|trunk|primary|secondary|tertiary`:

```bash
curl -s "https://overpass-api.de/api/interpreter" --data-urlencode 'data=[out:json][timeout:60];(way["highway"~"motorway|trunk|primary|secondary|tertiary"](24.66,46.66,24.74,46.72););out geom;' -o overpass.json
```

Convert to GeoJSON FeatureCollection (small Node script: each way → `LineString`, properties `{osmId, highway, name, lanes: parseInt(tags.lanes)||null, aadt: null}`). Save as `presentation/data/riyadh-roads.geojson`. Add ODbL attribution comment at top of the consuming page: `بيانات الطرق © مساهمو OpenStreetMap — رخصة ODbL`.

- [ ] **Step 2: Write failing test for the module**

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const OwnedMap = require(path.join(__dirname, '..', 'athar-ownedmap.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const geojson = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'data', 'riyadh-roads.geojson'), 'utf8'));

ok('geojson: FeatureCollection of LineStrings with highway class', () => {
  assert.strictEqual(geojson.type, 'FeatureCollection');
  assert.ok(geojson.features.length > 50);
  for (const f of geojson.features.slice(0, 20)) {
    assert.strictEqual(f.geometry.type, 'LineString');
    assert.ok(f.properties.highway);
  }
});

ok('styleFor: returns distinct colors per class, all defined', () => {
  const classes = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
  const colors = new Set(classes.map((c) => OwnedMap.styleFor(c).color));
  assert.ok(colors.size >= 3);
});

ok('toRoutingSegments: converts features to finite-length segments', () => {
  const segments = OwnedMap.toRoutingSegments(geojson.features);
  assert.ok(segments.length > 0);
  for (const s of segments.slice(0, 20)) {
    assert.ok(Number.isFinite(s.lengthKm) && s.lengthKm > 0);
    assert.ok(Array.isArray(s.coords) && s.coords.length >= 2);
    assert.ok(Number.isFinite(s.aadt) && s.aadt > 0, 'defaulted aadt when null');
  }
});

console.log(`ALL OWNED MAP TESTS PASSED (${passed})`);
```

- [ ] **Step 3: Implement `athar-ownedmap.js`** (UMD, no Leaflet dependency in Node paths)

```js
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharOwnedMap = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CLASS_STYLES = {
    motorway: { color: '#8a5a00', weight: 5 },
    trunk: { color: '#a06b1a', weight: 4 },
    primary: { color: '#5a6b8a', weight: 3.5 },
    secondary: { color: '#7d8aa0', weight: 2.5 },
    tertiary: { color: '#9aa4b5', weight: 1.8 },
  };
  const DEFAULT_STYLE = { color: '#b5bcc9', weight: 1.2 };
  // AADT توضيحي افتراضي حسب الصنف — موسوم في لوحة التحرير
  const CLASS_AADT = { motorway: 90000, trunk: 70000, primary: 45000, secondary: 25000, tertiary: 12000 };

  function styleFor(highwayClass) {
    return CLASS_STYLES[highwayClass] || DEFAULT_STYLE;
  }

  function haversineKm(a, b) {
    const R = 6371;
    const dLat = ((b[1] - a[1]) * Math.PI) / 180;
    const dLon = ((b[0] - a[0]) * Math.PI) / 180;
    const lat1 = (a[1] * Math.PI) / 180;
    const lat2 = (b[1] * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function toRoutingSegments(features) {
    return features
      .filter((f) => f.geometry && f.geometry.type === 'LineString')
      .map((f, i) => {
        const coords = f.geometry.coordinates;
        let lengthKm = 0;
        for (let j = 1; j < coords.length; j += 1) lengthKm += haversineKm(coords[j - 1], coords[j]);
        return {
          id: f.properties.osmId || 'seg_' + i,
          name: f.properties.name || f.properties.highway,
          highway: f.properties.highway,
          coords,
          lengthKm: Math.max(lengthKm, 0.01),
          lanes: f.properties.lanes || 2,
          aadt: f.properties.aadt || CLASS_AADT[f.properties.highway] || 10000,
        };
      });
  }

  // load(map, geojson): browser-only — draws L.geoJSON layers with styleFor,
  // binds click → editable side panel (aadt/lanes inputs), returns {layers, roads}
  function load(map, geojson, L) {
    const roads = toRoutingSegments(geojson.features);
    const layer = L.geoJSON(geojson, {
      style: (f) => styleFor(f.properties.highway),
    }).addTo(map);
    return { layers: layer, roads };
  }

  return { styleFor, toRoutingSegments, load, CLASS_AADT };
});
```

- [ ] **Step 4: Run test**

Run: `node presentation/tests/ownedmap-test.js`
Expected: `ALL OWNED MAP TESTS PASSED (3)`

- [ ] **Step 5: Wire into `athar-prototype.html`**

- Replace `L.tileLayer(...)` with: try `fetch('data/riyadh-roads.geojson')` (works under server mode) OR inline `<script src="data/riyadh-roads.geojson.js">` fallback for file:// mode (wrap the JSON as `window.RIYADH_ROADS = {...}` in a sibling `.js` copy generated in Step 1).
- On success: pale solid background (`.leaflet-container{background:#f3f1ec}`), `AtharOwnedMap.load(map, geojson, L)`, click-to-edit panel updates road properties and rebuilds routing graph via existing `athar-routing.js` entry point.
- On failure: keep current embedded network + gray background (existing behavior) — no regression.
- Keep ODbL attribution line in map corner.

- [ ] **Step 6: Full regression**

Run all suites:
```
node presentation/tests/engine-test.js
node presentation/tests/server-test.js
node presentation/tests/portfolio-test.js
node presentation/tests/city-impact-smoke-test.js
node presentation/tests/pitch-integrity-test.js
node presentation/tests/ui-smoke-test.js
node presentation/tests/routing-test.js
```
Expected: all pass. Manual: open prototype offline — map renders from local GeoJSON, roads clickable/editable, no gray-tile failure mode.
