# Vision 2030 Link + Live Gate WOW Moment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two cold-arbitration gaps: (1) zero Vision 2030 mentions across presentation files despite criterion 4 requiring it; (2) weak WOW moment — turn the evidence gate into a live interactive rejection→decision demo inside the pitch.

**Architecture:** No new slides — pitch-integrity-test.js enforces exactly 8 main slides, fixed story order, 180s total. Vision 2030 goes into the `supervised-ask` slide as a documented qualitative line backed by a new `src-045` ledger entry (official vision2030.gov.sa link, no fabricated numbers). The WOW widget goes into the `decision-path` slide: inline JS using `MasarDecision.validateDecisionInput` (blocked gate with missing fields) then `MasarEngine.score` (quantitative delay in vehicle-hours), driven by two buttons. TDD: extend pitch-integrity-test.js first.

**Tech Stack:** Vanilla JS (UMD modules `masar-engine.js`, `masar-decision.js` already browser-ready), Node built-in test runner style used by existing tests.

## Global Constraints

- Exactly 8 `section.slide.main` slides, `data-story` order fixed: permit-network, current-gap, evidence-boundary, baseline-alternative, decision-path, impact-range, shadow-gate, supervised-ask.
- Slide timings continuous, total exactly 180 seconds.
- Forbidden claims list in tests/pitch-integrity-test.js must not appear (no "أول منصة", no fabricated numbers).
- Every number/claim must link to a source in masar-sources.html or a design-parameter doc.
- Vision 2030 claim must stay QUALITATIVE (quality of life / infrastructure efficiency alignment) — no invented percentages.
- All 185 existing tests must keep passing.

---

### Task 1: Vision 2030 documented line

**Files:**
- Modify: `presentation/masar-sources.html` (append src-045 article after src-044)
- Modify: `presentation/masar-pitch.html` (supervised-ask slide, ~L414-433)
- Test: `presentation/tests/pitch-integrity-test.js`

**Interfaces:**
- Produces: ledger anchor `id="src-045"` linked from pitch as `masar-sources.html#src-045`.

- [ ] **Step 1: Write failing tests** — append to pitch-integrity-test.js before the final count log:

```js
test('pitch links Vision 2030 qualitatively to src-045', () => {
  assert.ok(pitch.includes('رؤية 2030'), 'pitch must mention Vision 2030');
  assert.ok(pitch.includes('masar-sources.html#src-045'), 'must cite src-045');
  assert.ok(!/رؤية 2030[^<]*[0-9٠-٩]+\s*[%٪]/.test(pitch), 'no invented 2030 percentage');
});

test('sources ledger has official Vision 2030 entry', () => {
  assert.ok(sources.includes('id="src-045"'));
  assert.ok(sources.includes('https://www.vision2030.gov.sa'));
});
```

- [ ] **Step 2: Run** `node tests/pitch-integrity-test.js` — expect FAIL on first new test.

- [ ] **Step 3: Implement** — in masar-sources.html after `</article>` of src-044:

```html
    <article id="src-045" data-type="primary">
      <div class="row"><div class="id">src-045</div><div class="type">مصدر أولي رسمي</div></div>
      <h3>رؤية السعودية 2030 — برنامج جودة الحياة</h3>
      <p>الموقع الرسمي لرؤية 2030. يدعم الربط النوعي فقط: تحسين جودة الحياة في المدن وكفاءة الخدمات والبنية التحتية. لا يدعم أي رقم أثر خاص بالمشروع.</p>
      <a href="https://www.vision2030.gov.sa/ar/explore/programs/quality-of-life-program" target="_blank" rel="noopener">المصدر المباشر</a>
    </article>
```

In masar-pitch.html supervised-ask slide, after `.ask-box` div add:

```html
      <p class="vision-line">يخدم هذا المسار هدف <b>رؤية 2030</b> في تحسين جودة الحياة بالمدن وكفاءة البنية التحتية — ربط نوعي بلا أرقام مفترضة.
        <a href="masar-sources.html#src-045">src-045 · المصدر الرسمي</a></p>
```

Append same idea to that slide's speaker-notes text.

- [ ] **Step 4: Run** `node tests/pitch-integrity-test.js` — expect ALL PASS (15).
- [ ] **Step 5: Commit** `git commit -m "feat: documented Vision 2030 qualitative link (src-045)"`

### Task 2: Live gate WOW widget in decision-path slide

**Files:**
- Modify: `presentation/masar-pitch.html` (decision-path slide ~L323-342; script includes near end of body; small CSS block)
- Test: `presentation/tests/pitch-integrity-test.js`

**Interfaces:**
- Consumes: `MasarDecision.validateDecisionInput(input)` → `{status:'blocked'|..., missing:[], canDecide}` ; `MasarEngine.score({aadt,lanes,lanesClosed,startHour,durationHours,...})` → `{delayVehHours,...}` ; `MasarEngine.buildNightWindows(startHour,durationHours,maxNightHours)`.

- [ ] **Step 1: Write failing tests**:

```js
test('pitch embeds live gate demo wired to real engine modules', () => {
  assert.ok(pitch.includes('src="masar-engine.js"'));
  assert.ok(pitch.includes('src="masar-decision.js"'));
  assert.ok(pitch.includes('id="gate-demo"'));
  assert.ok(pitch.includes('id="gate-demo-incomplete"'));
  assert.ok(pitch.includes('id="gate-demo-complete"'));
  assert.ok(pitch.includes('MasarDecision.validateDecisionInput'));
  assert.ok(pitch.includes('MasarEngine.score'));
});
```

- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** — widget markup inside decision-path slide, buttons trigger: incomplete input → red blocked panel listing missing fields from `validateDecisionInput`; complete input → `MasarEngine.score` baseline vs night alternative via `buildNightWindows`, green panel with vehicle-hours delta labeled "حالة توضيحية". Scripts `masar-engine.js` + `masar-decision.js` before `</body>`. Demo data labeled توضيحية (keeps honesty tests green).
- [ ] **Step 4: Run** pitch-integrity + ui-smoke tests — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: live evidence-gate WOW demo in decision-path slide"`

### Task 3: Full verification

- [ ] Run all 9 suites (`for t in tests/*.js; do node $t; done`) — expect 185 + 3 new = 188 total, zero failures.
- [ ] Commit any stragglers; done.
