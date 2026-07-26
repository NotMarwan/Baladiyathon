# Crit1 Challenge — Real Alternative Routing + Honest Forecast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace fake reroute (fixed 0.006° offset) with real graph routing on a local road network, and replace the fixed HOURLY_PROFILE "forecast" with an honest forecast layer with uncertainty bands + CSV calibration path — score ≥9.0 on the adversarial rubric.

**Architecture:** Pure-computation UMD modules (`masar-routing.js`, `masar-forecast.js`) mirroring `masar-engine.js` style (no DOM, Node-testable). Local network file `data/corridor-network.json` (nodes/edges, OSM-digitized, ODbL). UI in `masar-prototype.html` consumes them: computed alternative routes drawn on Leaflet, 3-route comparison cards with BPR travel times, hour×segment congestion heatmap with uncertainty band.

**Tech Stack:** Vanilla JS (ES5-compatible UMD), Leaflet (vendored), Node built-in test runner style (plain asserts like `engine-test.js`).

## Global Constraints

- Works fully offline via `file://` — network JSON embedded as fallback (same pattern as WORKS_FALLBACK). Zero console errors.
- All synthetic data tagged «افتراض توضيحي للعرض». Network tagged ODbL OSM attribution.
- Do NOT touch: `masar-pitch.html`, `masar-merged.html`, `masar.html`, economic functions in `masar-engine.js` (co2/digOnce/personHours/timeValueSAR).
- Own test file: `presentation/tests/routing-test.js`. Run both test files each cycle.
- Commit each task to branch `crit1-challenge`, never main.

---

### Task 1: Corridor network data + routing engine

**Files:**
- Create: `presentation/data/corridor-network.json` — ~24 nodes, ~35 directed-pair edges around King Fahd Rd (Olaya): King Fahd Rd (the 6 corridor nodes), Olaya St (parallel east), Takhasusi St (parallel west), cross streets (Urubah, Tahlia, Makkah, King Abdullah). Each edge: `{id, from, to, name, lengthKm, lanes, capacityPerLane, freeFlowKmh, demandShare}`. Metadata block: source = "digitized from OpenStreetMap © OpenStreetMap contributors — ODbL", tag «هندسة مبسطة — افتراض توضيحي للعرض» for lane/capacity values. POIs array: hospital + school nodes (tagged fixed demo points).
- Create: `presentation/masar-routing.js` — UMD `MasarRouting`:
  - `buildGraph(network)` — adjacency map, bidirectional edges.
  - `edgeTravelTime(edge, hourFraction, aadtScale, closure)` — BPR: `t0 = lengthKm/freeFlowKmh*60`, volume = `demandShare*aadtScale*hourFraction`, capacity reduced by closure `{edgeId, lanesClosed}` with MIN 25% floor.
  - `shortestPath(graph, from, to, hour, closure, penalties)` — Dijkstra on travel-time weights.
  - `alternativeRoutes(network, closedEdgeId, hour, opts)` — returns `{viaClosureMin, alternatives:[{path, edges, travelMin, extraMin, residualCapacity, nearPois}]}`: route 1 = shortest avoiding closed edge; routes 2-3 via penalty method (×1.5 on used edges). `nearPois` = POIs within 250m of route polyline.
- Test: `presentation/tests/routing-test.js` — asserts: graph builds; Dijkstra finds known path; alt route avoids closed edge; travel time increases with closure lanes; alt route changes when different edge closed; peak hour alt slower than night; POI proximity flags hospital route.

**Steps:** write failing tests → run (`node presentation/tests/routing-test.js`, expect FAIL) → implement JSON + routing → run PASS → run `engine-test.js` PASS → commit `feat: real corridor network + Dijkstra/BPR alternative routing`.

### Task 2: Honest forecast module

**Files:**
- Create: `presentation/masar-forecast.js` — UMD `MasarForecast`:
  - `BASE_PROFILE` — reuse engine HOURLY_PROFILE shape, tagged synthetic.
  - `DOW_FACTORS` — 7 weekday factors (KSA weekend Fri/Sat lower), tagged «افتراض توضيحي».
  - `forecast(hour, dow, opts)` → `{demandFraction, low, high, calibrated:boolean}`; uncertainty band ±15% uncalibrated, ±8% calibrated (constants documented as demo assumptions).
  - `calibrateFromCSV(text)` — parse `hour,count` CSV (24 rows), normalize to profile, returns `{profile, sampleCount, errors[]}`; validation: NaN/negative rejected, must cover 24 hours.
  - `forecastGrid(dow, closure, network?)` — 24×N hour×segment matrix of congestion index for heatmap.
- Test: add forecast section to `routing-test.js` (same file — ownership constraint): band low<mid<high; Friday < Tuesday demand; CSV calibration changes profile + narrows band; bad CSV returns errors not crash.

**Steps:** failing tests → implement → PASS both suites → commit `feat: honest forecast layer with uncertainty band + CSV calibration`.

### Task 3: UI — real reroute integration

**Files:**
- Modify: `presentation/masar-prototype.html` — replace `drawReroute` with `drawComputedRoutes(closedEdgeId, hour)`: draws top-3 alternatives (distinct colors/dash), popup per route «+X دقيقة مقابل Y دقيقة عبر الإغلاق»; new card «المسارات البديلة» ranked by travelMin with extraMin, residual capacity %, hospital/school proximity warning, explanation bullets. Corridor segments map to network edge ids (`kf1..kf5`). NETWORK_FALLBACK embedded for file://. TMP print reroute line now names actual computed route streets + minutes. `renderTimeline` hour change re-computes route times.
- Script tags: `masar-routing.js`, `masar-forecast.js`.

**Verify:** browser file:// — zero console errors; changing selected segment changes alt route geometry + times; hour slider changes times. Commit `feat: computed alternative routes in prototype UI`.

### Task 4: UI — forecast heatmap + uncertainty

**Files:**
- Modify: `presentation/masar-prototype.html` — new section «التنبؤ بمستويات الازدحام»: 24×5 CSS-grid heatmap (hour × corridor segment) colored by forecastGrid congestion index; day-of-week select; uncertainty band shown on timeline readout («الطلب: X (نطاق Y–Z)»); honest badge «تنبؤ نموذجي — يُعاير ببيانات المشغل»; `<input type=file>` CSV upload calls `calibrateFromCSV`, on success re-renders + badge flips to «معاير من CSV محمّل (N صف)».

**Verify:** browser — heatmap renders, dow select changes it, CSV upload works, bad CSV shows error message. Commit `feat: congestion forecast heatmap + uncertainty + CSV calibration UI`.

### Task 5: Deepening — queue shockwave on neighbors

**Files:**
- Modify: `presentation/masar-routing.js` — `shockwave(network, closedEdgeId, hour)`: spillover index onto adjacent edges when v/c>1 on closure (excess demand redistributed to alt edges, returns per-edge overflow ratio). Test asserts: peak-hour closure spills to neighbors, night doesn't.
- Modify: `presentation/masar-prototype.html` — adjacent edges tinted by overflow when closure selected.

**Verify:** tests PASS, browser check. Commit `feat: queue spillover onto adjacent network edges`.

### Task 6: REPORT.md + adversarial self-eval loop

- Write `REPORT.md`: file:line changes, rubric self-score with evidence per item, note that `masar.html:112` / `masar-merged.html:167` claims are now backed by code (untouched files, for coordinator), cycles count, what couldn't be done.
- Repeat loop protocol until self-score ≥9.0.
- Commit `docs: REPORT.md adversarial self-evaluation`.

## Self-Review

- Rubric coverage: real network routing (T1/T3), comparative travel time reactive to inputs (T1/T3), forecast uncertainty+calibration (T2/T4), all 4 challenge demands demoable (T3/T4), offline+zero errors (fallback embed), deepening (T5 + POI check in T1). ✓
- Names consistent: `MasarRouting.alternativeRoutes`, `MasarForecast.forecast/calibrateFromCSV/forecastGrid`. ✓
