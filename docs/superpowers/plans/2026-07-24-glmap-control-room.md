# GL Map — Own-Built Control Room Map (MapLibre GL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Leaflet map in `masar-prototype.html` with an own-built WebGL map (MapLibre GL JS, vendored, offline) — competition-grade: cinematic camera, native glow, live-editable roads, choreographed red→green.

**Architecture:** New module `masar-glmap.js` owns a hand-written MapLibre style JSON (no tiles, no glyph server — road labels as DOM markers). GeoJSON source = existing `window.RIYADH_ROADS`. Corridor/dig/alternatives/timeline live as GeoJSON sources updated via `setData`/`setPaintProperty`. Leaflet stays as automatic fallback if WebGL/maplibre unavailable. `masar-ownedmap.js` remains untouched (routing conversion + tests depend on it).

**Tech Stack:** MapLibre GL JS v4 (vendored single file + css), vanilla JS, existing engine/routing modules.

## Global Constraints

- Offline after vendoring: zero network at runtime. No glyphs/sprites/tiles — text via HTML markers only.
- `masar-ownedmap.js` and its test MUST keep passing unchanged (`toRoutingSegments` still feeds Dijkstra).
- Functional contract preserved: «حدد موقع الحفر» click-on-corridor, alternatives drawn after selection, red→green choreography on schedule pick, 24h timeline recolor, WZDx/PDF untouched.
- RTL Arabic UI; attribution keeps `بيانات الطرق © مساهمو OpenStreetMap (ODbL)`.
- Design system (from ui-ux-pro-max: Real-Time Monitoring + dark control room): stage `#0a1826→#102535`, motorway amber `#e8a33d` (line-blur glow), primary steel-blue `#7fb3d1`, corridor cyan `#59d6f2`, closed `#e5484d`, unlocked `#34d399`, pulse `2s infinite`.
- All animation compositor-friendly or GPU (paint-property transitions, rAF on line-gradient).
- Reduced-motion: camera jumps instead of flyTo, no pulses.
- No git repo — verification = tests + Playwright offline run.

---

### Task 1: Vendor MapLibre GL

**Files:**
- Create: `presentation/vendor/maplibre-gl.js`
- Create: `presentation/vendor/maplibre-gl.css`

**Steps:**

- [ ] Download (one-time internet):

```bash
curl -sL -A "masar/1.0" -o presentation/vendor/maplibre-gl.js  https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js
curl -sL -A "masar/1.0" -o presentation/vendor/maplibre-gl.css https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css
```

- [ ] Verify: files > 500KB / > 10KB respectively; `node -e "require('fs').readFileSync('presentation/vendor/maplibre-gl.js','utf8').includes('maplibregl')"` prints nothing (no throw).

---

### Task 2: `masar-glmap.js` — style + module (TDD)

**Files:**
- Create: `presentation/masar-glmap.js`
- Create: `presentation/tests/glmap-test.js`

**Interfaces:**
- Produces: `MasarGlMap.buildStyle(geojson) → maplibre style object` (Node-testable, no maplibre needed), `MasarGlMap.init(container, geojson, opts) → {map, api}` (browser), api = `{ setCorridor(coordsList), setCorridorState(idx,'open'|'closed'|'unlocked'), setDigSite(lngLat), setAlternatives(featureCollection), sweepUnlock(idx, done), setPhase('peak'|'day'|'night'), updateRoad(osmId, {aadt,lanes}), onRoadClick(cb) }`.

- [ ] **Failing test** (`glmap-test.js`, house style):

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const GlMap = require(path.join(__dirname, '..', 'masar-glmap.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const geojson = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'data', 'riyadh-roads.geojson'), 'utf8'));

ok('buildStyle: valid style skeleton, version 8, no external URLs', () => {
  const style = GlMap.buildStyle(geojson);
  assert.strictEqual(style.version, 8);
  assert.ok(!('glyphs' in style), 'no glyph server — labels are DOM');
  assert.ok(!('sprite' in style), 'no sprite server');
  const raw = JSON.stringify(style);
  assert.ok(!/https?:\/\//.test(raw), 'style must be fully offline');
});

ok('buildStyle: roads source inline + one line layer per class group + glow', () => {
  const style = GlMap.buildStyle(geojson);
  assert.ok(style.sources.roads && style.sources.roads.type === 'geojson');
  const ids = style.layers.map((l) => l.id);
  for (const id of ['bg', 'roads-glow', 'roads-motorway', 'roads-primary', 'roads-minor']) {
    assert.ok(ids.includes(id), `missing layer ${id}`);
  }
  const glow = style.layers.find((l) => l.id === 'roads-glow');
  assert.ok(glow.paint['line-blur'] >= 3, 'native GPU glow via line-blur');
});

ok('buildStyle: zoom-interpolated widths on motorway layer', () => {
  const style = GlMap.buildStyle(geojson);
  const mw = style.layers.find((l) => l.id === 'roads-motorway');
  const width = mw.paint['line-width'];
  assert.ok(Array.isArray(width) && width[0] === 'interpolate');
});

ok('collectLabelAnchors: one anchor per named major road', () => {
  const anchors = GlMap.collectLabelAnchors(geojson.features);
  assert.ok(anchors.length >= 3 && anchors.length <= 40);
  for (const a of anchors.slice(0, 10)) {
    assert.ok(a.name && Number.isFinite(a.lngLat[0]) && Number.isFinite(a.lngLat[1]));
    assert.ok(['motorway', 'trunk', 'primary'].includes(a.cls));
  }
});

console.log(`ALL GLMAP TESTS PASSED (${passed})`);
```

- [ ] Run → FAIL (module missing). Then implement `masar-glmap.js` (UMD like siblings; `buildStyle`/`collectLabelAnchors` pure; `init` browser-only):

Style essentials (hand-written, the "own map"):

```js
function buildStyle(geojson) {
  return {
    version: 8,
    sources: { roads: { type: 'geojson', data: geojson } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0a1826' } },
      { id: 'roads-glow', type: 'line', source: 'roads',
        filter: ['in', ['get', 'highway'], ['literal', ['motorway', 'trunk']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#e8a33d', 'line-blur': 6, 'line-opacity': 0.55,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 14] } },
      { id: 'roads-minor', type: 'line', source: 'roads',
        filter: ['in', ['get', 'highway'], ['literal', ['secondary', 'tertiary',
          'secondary_link', 'tertiary_link', 'motorway_link', 'trunk_link', 'primary_link']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#3d5468',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 15, 2.2] } },
      { id: 'roads-primary', type: 'line', source: 'roads',
        filter: ['==', ['get', 'highway'], 'primary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#7fb3d1',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.9, 15, 4] } },
      { id: 'roads-motorway', type: 'line', source: 'roads',
        filter: ['in', ['get', 'highway'], ['literal', ['motorway', 'trunk']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['match', ['get', 'highway'], 'motorway', '#e8a33d', '#d18a4a'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.6, 15, 6] } },
    ],
  };
}
```

`init(container, geojson, opts)`:
- `new maplibregl.Map({ container, style: buildStyle(geojson), center: [46.685, 24.70], zoom: 12.6, pitch: 45, bearing: -12, attributionControl: false })` + `AttributionControl` compact with ODbL Arabic.
- Entrance: start `pitch:0, zoom:11.8`, on `load` → `flyTo({ pitch: 45, bearing: -12, zoom: 12.6, duration: 2200 })` (skip under reduced motion).
- Labels: `collectLabelAnchors` (same dedupe as ownedmap) → `maplibregl.Marker({ element: chipDiv })`; chips styled by `masar-map.css` classes (reuse `.masar-road-label`).
- Sources added on load: `corridor`, `corridor-casing`, `dig`, `alternatives`, `sweep` — all geojson, updated via `setData`.
- Corridor layers: casing (dark, width 10) + core (cyan, width 5, `line-emissive-strength` n/a in maplibre → just bright color + slight blur layer). Per-segment state via feature `state` property + `['match', ['get','state'], 'closed', '#e5484d', 'unlocked', '#34d399', '#59d6f2']`.
- Click: `map.on('click', 'corridor-core', ...)` → cb(segmentIndex); cursor pointer on enter/leave.
- `sweepUnlock(idx, done)`: rAF over 1200ms animating `line-gradient` on the sweep layer (`'line-progress'`-based gradient from transparent→#34d399), then sets segment state unlocked, removes sweep. Fallback (gradient needs `lineMetrics:true` on source — set it) — if unavailable, animate `line-width` pulse instead.
- `setPhase(phase)`: `setPaintProperty('roads-glow','line-opacity', peak?0.85:night?0.3:0.55)` + motorway width factor — GPU transitions via `map.setPaintProperty` (maplibre transitions default 300ms; set 800ms).
- `updateRoad(osmId, props)`: mutate feature in a kept copy of geojson, `getSource('roads').setData(copy)`; also return updated copy for routing re-feed.
- Hover tooltip: `mousemove` on road layers → positioned DOM tooltip div (reuse `.masar-hover-tip` styling).
- `onRoadClick(cb)`: click on road layers → cb({osmId, name, highway, aadt, lanes, lngLat}) — the EDITING hook.

- [ ] Run `node presentation/tests/glmap-test.js` → `ALL GLMAP TESTS PASSED (4)`.

---

### Task 3: Host integration with fallback

**Files:**
- Modify: `presentation/masar-prototype.html`

**Steps:**

- [ ] `<head>`: add `<link rel="stylesheet" href="vendor/maplibre-gl.css">`; scripts: `vendor/maplibre-gl.js`, `masar-glmap.js` before page script.
- [ ] Feature-detect: `var useGl = typeof maplibregl !== 'undefined' && maplibregl.supported ? maplibregl.supported() : (typeof maplibregl !== 'undefined');` wrap in try/catch; if false → existing Leaflet path untouched (keep ALL current Leaflet code in an `else` branch — zero deletion).
- [ ] GL path: `var gl = MasarGlMap.init(document.getElementById('map'), RIYADH_ROADS, {...})`; build a thin adapter so existing functions keep their names:
  - `selectClosure(idx)` → `gl.api.setCorridorState(idx,'closed'); gl.api.setDigSite(mid); gl.map.flyTo({center: mid, zoom: 13.4, duration: 900})` — pulsing dig marker = `maplibregl.Marker({element})` with existing `.masar-dig-marker` HTML.
  - `drawComputedRoutes` → build FeatureCollection of alternatives (recommended flagged) → `gl.api.setAlternatives(fc)`; recommended gets dashed animated layer (`line-dasharray` stepped via 150ms interval — maplibre dash animation pattern) .
  - `selectCandidate` → after `renderTimeline()`: `gl.api.sweepUnlock(segIdx)` + camera nudge `flyTo({pitch: 52, duration: 1200})` then back.
  - `renderTimeline` → `gl.api.setCorridorState(...per-hour...)` + `gl.api.setPhase(phase)`.
  - Corridor coords: reuse `CORRIDOR_COORDS` (lat,lng) → convert to [lng,lat].
- [ ] Editing panel (the «قابلة للتعديل» requirement): `gl.api.onRoadClick(seg => ...)` opens a small dark side card inside the map (`.masar-edit-card`, styled in masar-map.css): name, class, inputs for `aadt`/`lanes`, «تطبيق» → `gl.api.updateRoad(...)` + rebuild routing graph from `MasarOwnedMap.toRoutingSegments(updatedFeatures)`; card labels marked «بيانات توضيحية قابلة للتحرير».
- [ ] Keep Leaflet `<script src="vendor/leaflet.js">` etc. — fallback path.

---

### Task 4: Verification

- [ ] All 11 node suites green (10 existing + glmap-test).
- [ ] Playwright script (extend existing `masar_shots.py` pattern): network-blocked file:// run → zero external requests, zero console errors; shots: entrance end-state (pitched 3D view), dig selected, sweep mid, green final, peak/night phases, edit card open.
- [ ] Manual smoke in Browser pane: click corridor → dig; optimize → pick schedule → sweep + camera move; click any road → edit aadt → routes recompute.

---

### Task 5: Deliverable folder update

- [ ] Copy `masar-glmap.js` + new screenshots into `KIMI 3 MAP DESIGN/` sibling folder `GL-UPGRADE/` with a 10-line rationale note (own style JSON, WebGL glow, cinematic camera, live editing).
