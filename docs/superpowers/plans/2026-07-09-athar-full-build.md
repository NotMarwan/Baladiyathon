# Athar Full Build — Implementation Plan (overnight, autonomous)

> **For agentic workers:** Execute your assigned task only. Acceptance checks at the end of each task are the definition of done. Target: every rubric criterion in `معايير-التقييم-الصارمة.md` ≥ 9.5/10.

**Goal:** Ship submission-ready Athar: real computing engine + interactive prototype UI + minimal backend API + 3-min pitch deck + official idea-card text + vault docs.

**Architecture:** Static-first (judge opens one HTML file, everything works offline except map tiles). `athar-engine.js` = pure logic, shared verbatim by browser UI, Node tests, and Node stdlib server. No frameworks, no build step. Leaflet vendored locally (no critical CDN).

**Tech Stack:** Vanilla JS (ES2020), Leaflet 1.9.4 (vendored), Node stdlib (`http`, `assert`) — zero npm dependencies.

## Global Constraints

- NOT a git repo — no git commands.
- No drones, no personal data, NEVER the 627,000 km figure (official ≈ 73,000 km).
- Every real-world number shown in UI/pitch must carry a source already in the Sources Ledger (list below). Demo traffic inputs must be visibly labeled «بيانات توضيحية للعرض» (illustrative demo data).
- −11.1% is cited as *method proof* (Automation in Construction 2009), never promised as KSA outcome.
- Design identity = athar-merged.html tokens, copied verbatim:
  ```css
  :root{
    --ground:#ECEFF2; --surface:#FFFFFF; --ink:#15202B; --muted:#5A6672;
    --faint:#8A929B; --line:#D8DEE4; --navy:#1D4E77; --navy-soft:#E9F1F7;
    --ochre:#A9722B; --ochre-soft:#F4EDE1; --good:#2F7A57; --bad:#B23B32;
    --mono:ui-monospace,"Cascadia Code",Consolas,monospace;
    --sans:"Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,"Noto Sans Arabic",sans-serif;
  }
  ```
  `<html lang="ar" dir="rtl">`, cards: `background:var(--surface);border:1px solid var(--line);border-radius:10px`, engine highlight: `--navy-soft`, good/bad: `--good`/`--bad`.
- All files UTF-8. Arabic UI text, English code identifiers.
- Demo corridor: **طريق الملك فهد، الرياض (مقطع العليا)** — real named corridor; approximate polyline coords acceptable (visual demo), label as demo segment.

## Sources Ledger (only these may be cited)

1. momah.gov.sa/ar/hackathon — challenge text, dates, prizes (30/20/15K SAR)
2. gov.uk/.../new-digital-service-to-minimise-disruptive-roadworks — UK Street Manager
3. publications.parliament.uk/pa/cm5901/cmselect/cmtrans/522/report.html — 2.5M works/year England
4. researchgate.net/publication/237896838 — schedule optimization −11.1% delay (peer-reviewed 2009)
5. iaarc.org/.../ant_colony_optimization.html — ACO+VISUM (ISARC 2011)
6. fhwa.dot.gov/policy/otps/policy_brief_dig_once.pdf — excavation = up to 90% of fiber cost
7. broadbandnow.com/report/dig-once-digital-divide — GAO: dig-once saves 25–33% dense urban
8. balady.gov.sa/en/services/excavation-permits — permits exist; 150 days highways / 300 days main roads
9. balady.gov.sa/en/services/request-multiple-excavation-coordination — coordination exists but NO traffic analysis (the gap)
10. sciencedirect.com/org/science/article/pii/S1556831824000285 — work-zone emissions (peer-reviewed)
11. roadworks.org / one.network — UK public works map precedent

## Engine API (authoritative — UI, tests, server all code against THIS)

File `presentation/athar-engine.js`, UMD-style export (`window.AtharEngine` in browser, `module.exports` in Node):

```js
// All pure functions. No DOM, no fetch, no Date.now dependencies in math.

AtharEngine.HOURLY_PROFILE       // number[24], fractions summing to 1.0 — typical urban weekday distribution (AM peak 7-9, PM peak 16-19)
AtharEngine.DEFAULTS             // {aadt:85000, lanes:4, capacityPerLane:1800, freeFlowMin:6, lengthKm:4.2, valueOfTimeSAR:45, idleFuelLPerHour:0.9, co2KgPerL:2.31, trenchCostPerKmSAR:850000}
                                 // each key documented with a comment: source OR "illustrative demo assumption"

AtharEngine.bprTravelTime(freeFlowMin, volume, capacity) -> minutes
  // t = t0 * (1 + 0.15 * (v/c)^4)  — standard BPR volume-delay function

AtharEngine.score({aadt, lanes, lanesClosed, capacityPerLane, freeFlowMin, lengthKm, startHour, durationHours})
  -> {delayVehHours, score, level, hourly}
  // per affected hour h (wrapping over days if durationHours>24):
  //   demand = aadt * HOURLY_PROFILE[h % 24]
  //   baseline t via bprTravelTime(freeFlowMin, demand, lanes*capacityPerLane)
  //   closed   t via bprTravelTime(freeFlowMin, demand, (lanes-lanesClosed)*capacityPerLane)  (min capacity floor: 0.25*capacityPerLane)
  //   delayVehHours += demand * (closedT - baseT) / 60
  // score = min(100, round(100 * delayVehHours / (aadt * 0.35)))  — normalized 0-100 (0.35 calibration constant, demo assumption)
  // level: score<25 "low" | <60 "medium" | else "high"

AtharEngine.optimize(input) -> {top3: [{label, startHour, phases, delayVehHours, savedVehHours, savedPct, reasons: [string,string,string]}], baseline: {delayVehHours}}
  // candidate grid: startHour in [22,23,0,8,10,13] × phases in [1,2] (phase = duration split across nights)
  // rank by delayVehHours asc; reasons = Arabic strings from factor analysis:
  //   "نافذة خارج الذروة (الطلب أقل بـX%)", "تقسيم على مرحلتين يخفض ذروة التأثير", "تفادي ذروة الصباح 7-9" etc — derived from actual numbers, not canned
  // ties broken toward fewer phases (simpler execution)

AtharEngine.co2(savedVehHours) -> {fuelL, co2Kg}
  // fuelL = savedVehHours * idleFuelLPerHour; co2Kg = fuelL * co2KgPerL (2.31 kg/L gasoline — standard factor, source in comment)

AtharEngine.digOnce({trenchKm, permitsMerged}) -> {separateSAR, sharedSAR, savedSAR, savedPct}
  // separate = permitsMerged * trenchKm * trenchCostPerKmSAR
  // shared = trenchKm * trenchCostPerKmSAR * 1.15 (15% coordination overhead, demo assumption)
  // savedPct must land in GAO's 25-33% band for permitsMerged=2 — calibrate overhead so it does; comment the calibration

AtharEngine.compound(scoreA, scoreB) -> {combined, factor, warning}
  // combined = (scoreA.delayVehHours + scoreB.delayVehHours) * factor, factor = 1.3 (parallel-corridor superposition, demo assumption)
  // warning: Arabic string when factor pushes combined level to "high"

AtharEngine.backTest(input, chosen) -> {beforeVehHours, afterVehHours}
  // before = score(input at requested startHour).delayVehHours ; after = chosen.delayVehHours
```

Numeric sanity (tests assert):
- Night closure (startHour 23) delay < day closure (startHour 8) for same inputs.
- More lanesClosed ⇒ more delay, monotonic.
- optimize().top3[0].delayVehHours ≤ baseline.delayVehHours.
- co2: fuelL = vehHours*0.9 exactly with defaults.
- digOnce(2 permits).savedPct within 25–42.5% (GAO band + calibration head-room).
- score() with 0 lanesClosed ⇒ delayVehHours = 0, score = 0.

---

## Task W1: Engine + tests + backend server + README (one worker, sequential)

**Files:**
- Create: `presentation/athar-engine.js` (~200 lines, the API above, every constant commented with source-or-assumption)
- Create: `presentation/tests/engine-test.js` — plain `node:assert`, no frameworks: `node presentation/tests/engine-test.js` prints `ALL TESTS PASSED (n)` or throws. Cover all sanity assertions above + edge cases (24h+ duration wrap, lanesClosed=lanes floor).
- Create: `presentation/server.js` — Node stdlib only (`http`, `fs`, `path`, `url`). Serves static files from `presentation/` + JSON API:
  - `POST /api/score` → AtharEngine.score(body)
  - `POST /api/optimize` → AtharEngine.optimize(body)
  - `POST /api/digonce` → AtharEngine.digOnce(body)
  - `GET /api/works` → the public-works GeoJSON (read from `presentation/data/works.geojson` — create it: 3 sample permits on Riyadh corridors incl. the King Fahd demo segment, properties: {id, road, status, impactLevel, from, to})
  - Content-Type headers correct, 404 fallback, port 8734, startup line: `أثر backend يعمل على http://localhost:8734`
  - Path traversal guard on static serving (resolve + startsWith check) — security non-negotiable.
- Create: `presentation/README-athar.md` — Arabic quickstart: (أ) الوضع الثابت: افتح athar-prototype.html مباشرة، (ب) وضع الـ API: `node server.js` ثم نفس الصفحة تكتشف الخادم تلقائيًا، (ج) الاختبارات: `node tests/engine-test.js`, (د) بنية الملفات.

**Acceptance:** `node presentation/tests/engine-test.js` → ALL TESTS PASSED. `node -e "const e=require('./presentation/athar-engine.js'); console.log(JSON.stringify(e.optimize(e.DEFAULTS===undefined?{}:Object.assign({lanesClosed:2,startHour:8,durationHours:48},e.DEFAULTS)).top3[0]))"` runs without error. Server starts, `GET /api/works` returns valid GeoJSON (verify with curl or node fetch, then kill process).

## Task W2: Prototype UI (after W1 — codes against the real engine file)

**Files:**
- Create: `presentation/vendor/leaflet.js` + `presentation/vendor/leaflet.css` — download Leaflet 1.9.4 dist from unpkg (curl). Also `vendor/images/marker-icon.png, marker-shadow.png` if referenced.
- Create: `presentation/athar-prototype.html` — self-contained page (inline CSS/JS except vendored leaflet + athar-engine.js via relative `<script src>`), design tokens verbatim, RTL.

**UI = the 7-step demo script, interactive:**
1. Header: eyebrow «بلدياتثون 2026 · التحدي الثالث», title «أثر — النموذج التفاعلي», demo-corridor badge «طريق الملك فهد (مقطع العليا) — بيانات توضيحية للعرض».
2. Leaflet map (King Fahd Rd polyline, ~24.69→24.76 lat along 46.68 lng, navy). Click a segment or button «حدد موقع الحفر» → closure marker + red segment. Tiles: OSM; if tiles fail to load, map background stays gray but polylines/cards all still work (test by blocking network — no JS errors).
3. Permit panel (sliders/inputs): مسارات مغلقة (1–3 من 4)، ساعة البدء، المدة بالساعات، عدد التصاريح المجاورة للدمج. Values feed engine live.
4. Impact card: score 0–100 + level color (--bad red / --good green) + ساعات-مركبة مضافة. Updates on input.
5. Button «حسّن الجدولة» → top-3 cards from `optimize()`: كل بطاقة فيها الجدول + الوفر + «لماذا فاز هذا الجدول» (3 أسباب من المحرك). Choosing one: map segment turns green, reroute polyline (dashed ochre, parallel street), back-test counter animates beforeVehHours → afterVehHours.
6. Cards row: وفر CO₂ (كجم + لتر وقود) from `co2()`, وفر Dig-Once بالريال from `digOnce()`, تنبيه التأثير المركّب from `compound()` when neighbor-permits > 0.
7. Button «أصدر خطة إدارة المرور (PDF)» → opens print-ready Arabic TMP view (hidden section, `window.print()`): بيانات التصريح، الجدول المعتمد، المسار البديل، توقيعات. That IS the PDF (print-to-PDF) — label the button accordingly.
8. Public transparency map section: second small Leaflet map or same-map layer toggle «الخريطة العامة للأعمال» reading `data/works.geojson` — via fetch when served, via inline fallback JSON constant when opened as file:// (detect fetch failure).
9. API mode: on load, try `fetch('/api/works')` with 800ms timeout; if OK show badge «متصل بالخادم — وضع API» and route score/optimize through API; else badge «وضع مستقل — المحرك محلي» and call engine directly. No console errors in either mode.
10. Assumptions card (footer): every demo constant listed with its label (مصدر أو افتراض توضيحي) + sources from Ledger.

**Acceptance:** open file:// directly — zero console errors, all 7 demo steps clickable in order, values change with inputs, night schedule beats day schedule visibly. Then `node server.js` + http://localhost:8734/athar-prototype.html — API badge appears, same behavior. RTL correct, matches design tokens.

## Task W3: Pitch deck + Idea Card (parallel with W1)

**Files:**
- Create: `presentation/athar-pitch.html` — 3-minute deck, ~10 slides, keyboard/click navigation (scroll-snap or arrow keys — inline JS, no libs), same design tokens, RTL. Slides:
  1. أثر — الغلاف (name, tagline from athar-merged header, challenge label)
  2. المشكلة: بلدي يصدر تصاريح حفر دون تحليل الأثر المروري (الفجوة الموثقة — مصدر 9) + 150/300 يومًا مدد التصاريح (مصدر 8)
  3. الحل: درجة أثر قبل الترخيص + جدولة مُثلى + دمج + مسار بديل (المحرك المزدوج SUMO/BPR)
  4. الديمو المباشر: لقطة/إطار من athar-prototype.html + الخطوات السبع مختصرة (رابط للنموذج)
  5. الدليل: −11.1% (مصدر 4)، UK 2.5M أعمال/سنة (مصدر 3)، NYC/Dig-Once 25–33% (مصدر 7)
  6. التفسيرية: بطاقة «لماذا فاز هذا الجدول» (ثقة اللجنة)
  7. الأثر: ساعات-مركبة، CO₂ (مصدر 10)، ريال Dig-Once (مصدر 6) — بوحدات قرار
  8. الشفافية: الخريطة العامة (سابقة UK — مصدر 11)
  9. الجدوى: يعمل على بيانات بلدي الحالية، مفتوح المصدر، بلا بيانات شخصية
  10. الختام: «أثر = الوحدة الثالثة في طبقة ذكاء بلدي» امتثال ← تفتيش ← بنية تحتية
  Every stat slide: source in small footer text. Timer hint per slide in speaker notes comment.
- Create: `بطاقة-الفكرة.md` (repo root) — official submission text: اسم الفكرة، التحدي، وصف المشكلة (≤100 كلمة)، وصف الحل (≤150 كلمة)، الابتكار، الأثر المتوقع، الجدوى، التقنيات، الفريق placeholder، روابط الملفات. Mapped to form-style fields, copy-paste ready, numbers sourced.

**Acceptance:** deck navigates start→end by keyboard, no console errors, every number has visible source, final slide = intelligence layer.

## Task W4 (after W1+W2+W3): strict evaluation → fixes → re-eval
Fresh judge agent scores against `معايير-التقييم-الصارمة.md` by actually opening/running everything. Any criterion < 9.5 → fix list → fix worker → re-judge. Manager (Fable) arbitrates.

## Task W5: Vault + wiring
- `SwarmingObsidian/01 Athar/Prototype.md`, `Engine.md`, `Idea Card.md` — one-paragraph summaries + file links + how to run.
- Link the three from `00 Athar - Home.md` (append section «مخرجات 2026-07-09», don't disturb existing content).
- Append line to `presentation/README-athar.md` if paths changed.

## Out of Scope (ponytail)
- Real SUMO run (video fallback already planned by Agent 3 track; BPR path is the demo).
- npm/build tooling, frameworks, DB. Static + stdlib covers judging.
- Real AADT data (unverifiable) — labeled assumptions instead.
- jsPDF (print-to-PDF native covers TMP).
