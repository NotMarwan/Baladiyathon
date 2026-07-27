# Authority User Experience Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated “تجربة المستخدم” tab that lets a Saudi Electricity Company coordinator receive a National Water Company permit alert, understand the overlap, request coordination, and inspect the project’s existing capabilities without mutating the core application.

**Architecture:** Add a pure view-model module that adapts the existing city portfolio and coordination summary, then render that model through a dedicated static page, controller, and stylesheet. The shared navigation receives one new entry; the engine, server, reviewer desk, catalog, and source datasets remain unchanged.

**Tech Stack:** Static HTML, CSS custom properties, vanilla JavaScript in UMD modules, local GeoJSON-derived data, Node.js assertion tests.

## Global Constraints

- Work only on branch `codex/user-experience-tab` in the isolated worktree.
- Reuse `presentation/masar-tokens.css`; do not add a design-system dependency.
- Load no external network resource and add no package dependency.
- Treat all portfolio values as representative, not measured outcomes.
- Use the exact representative permit pair `BLD-2026-0076` and `BLD-2026-0077` when present.
- Fall back only to an existing water/electricity pair on one street; never synthesize a missing permit.
- Keep interaction state in page memory; do not call write APIs or local storage.
- Do not modify the engine, server, reviewer desk, catalog, or source data.
- Preserve right-to-left layout, keyboard access, textual chart equivalents, and reduced-motion support.
- Each task ends with focused tests and a commit.

---

## File Structure

Create:

```text
presentation/masar-experience-model.js
presentation/masar-experience.html
presentation/masar-experience.css
presentation/masar-experience.js
presentation/tests/experience-test.js
```

Modify:

```text
presentation/masar-nav.js
presentation/tests/nav-test.js
```

Responsibilities:

- The model file selects traceable records and returns a small immutable page model.
- The page file provides semantic fallback content and stable mount points.
- The controller renders the model and owns ephemeral interaction state.
- The stylesheet owns only this page’s layout, motion, and component appearance.
- The experience test guards data truth, semantic structure, isolation, and wiring.
- The navigation test guards the six-section route and prevents orphan pages.

---

### Task 1: Pure Authority Experience Model

**Files:**

- Create:

```text
presentation/masar-experience-model.js
```

- Create:

```text
presentation/tests/experience-test.js
```

**Interfaces:**

- Consumes:

```text
buildViewModel(portfolio, compliance, options)
```

- Produces:

```text
MasarExperienceModel.buildViewModel
MasarExperienceModel.findScenario
MasarExperienceModel.projectGeometry
MasarExperienceModel.formatNumber
MasarExperienceModel.formatDate
```

- `buildViewModel` returns:

```js
{
  available: Boolean,
  actor: { name: String, shortName: String },
  dataLimit: String,
  summary: {
    permitCount: Number,
    actionCount: Number,
    waitingCount: Number,
    coordinationCount: Number
  },
  scenario: {
    current: Object,
    other: Object,
    notice: Object,
    relation: String,
    before: {
      openings: Number,
      occupiedDays: Number,
      impactVehHours: Number
    },
    proposed: {
      openings: Number,
      occupiedDays: Number,
      impactVehHours: null
    },
    geometry: {
      currentPath: String,
      otherPath: String,
      viewBox: String
    }
  } | null,
  permits: Array,
  capabilities: Array
}
```

- [ ] **Step 1: Write the failing model tests**

Add a test helper that evaluates the two browser data files in an isolated
context, then assert the exact truth contract:

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function browserData(file) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox);
  return sandbox.window;
}

const portfolio = browserData('data/city-portfolio.geojson.js').MASAR_CITY_PORTFOLIO;
const compliance =
  browserData('data/digonce-compliance.js').MASAR_DIGONCE_COMPLIANCE;
const Model = require(path.join(ROOT, 'masar-experience-model.js'));

const model = Model.buildViewModel(portfolio, compliance, {
  currentRef: 'BLD-2026-0077',
  otherRef: 'BLD-2026-0076',
});

assert.strictEqual(model.available, true);
assert.strictEqual(model.actor.name, 'الشركة السعودية للكهرباء');
assert.strictEqual(model.scenario.current.properties.permitRef, 'BLD-2026-0077');
assert.strictEqual(model.scenario.other.properties.permitRef, 'BLD-2026-0076');
assert.strictEqual(model.scenario.other.properties.promoter, 'شركة المياه الوطنية');
assert.strictEqual(model.scenario.current.properties.street,
  model.scenario.other.properties.street);
assert.strictEqual(model.scenario.proposed.impactVehHours, null);
assert.ok(model.dataLimit.includes('مولَّدة'));
assert.ok(model.summary.permitCount > 0);
assert.ok(model.permits.every((item) =>
  item.promoter === 'الشركة السعودية للكهرباء'));
```

Add missing-data assertions:

```js
const missing = Model.buildViewModel(null, null);
assert.strictEqual(missing.available, false);
assert.strictEqual(missing.scenario, null);

const noPair = Model.buildViewModel({ type: 'FeatureCollection', features: [] },
  { notices: {}, permits: {}, dataLimit: 'حد تمثيلي' });
assert.strictEqual(noPair.available, true);
assert.strictEqual(noPair.scenario, null);
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```text
node presentation/tests/experience-test.js
```

Expected result: failure because the model module does not exist.

- [ ] **Step 3: Implement the model module**

Use the repository’s existing UMD pattern. The implementation must:

```js
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarExperienceModel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ELECTRICITY = 'الشركة السعودية للكهرباء';
  var WATER = 'شركة المياه الوطنية';
  var DEFAULT_CURRENT = 'BLD-2026-0077';
  var DEFAULT_OTHER = 'BLD-2026-0076';

  function featuresOf(portfolio) {
    return portfolio && Array.isArray(portfolio.features) ? portfolio.features : [];
  }

  function byRef(features, ref) {
    return features.filter(function (feature) {
      return feature && feature.properties &&
        feature.properties.permitRef === ref;
    })[0] || null;
  }

  function findScenario(features, compliance, options) {
    var current = byRef(features, options.currentRef || DEFAULT_CURRENT);
    var other = byRef(features, options.otherRef || DEFAULT_OTHER);
    if (current && other &&
        current.properties.promoter === ELECTRICITY &&
        other.properties.promoter === WATER &&
        current.properties.street === other.properties.street) {
      return { current: current, other: other };
    }

    var electricity = features.filter(function (feature) {
      return feature.properties && feature.properties.promoter === ELECTRICITY;
    });
    for (var i = 0; i < electricity.length; i += 1) {
      var notice = compliance && compliance.notices &&
        compliance.notices[electricity[i].properties.permitRef];
      var waterNotice = notice && (notice.others || []).filter(function (candidate) {
        return candidate.promoter === WATER;
      })[0];
      if (waterNotice) {
        other = byRef(features, waterNotice.permitRef);
        if (other) return { current: electricity[i], other: other };
      }
    }
    return null;
  }

  function inclusiveDays(start, end) {
    var span = Date.parse(end) - Date.parse(start);
    return Number.isFinite(span) ? Math.max(1, Math.ceil(span / 86400000)) : 0;
  }

  function proposedDays(current, other) {
    var start = Math.min(Date.parse(current.properties.start),
      Date.parse(other.properties.start));
    var end = Math.max(Date.parse(current.properties.end),
      Date.parse(other.properties.end));
    return Math.max(1, Math.ceil((end - start) / 86400000));
  }

  function buildViewModel(portfolio, compliance, options) {
    var features = featuresOf(portfolio);
    var available = Boolean(portfolio && compliance);
    var pair = available ? findScenario(features, compliance, options || {}) : null;
    var electricity = features.filter(function (feature) {
      return feature.properties && feature.properties.promoter === ELECTRICITY;
    });
    return {
      available: available,
      actor: { name: ELECTRICITY, shortName: 'هيئة الكهرباء' },
      dataLimit: compliance && (compliance.portfolioLimit || compliance.dataLimit) || '',
      summary: summaryOf(electricity, compliance),
      scenario: pair ? scenarioOf(pair, compliance) : null,
      permits: permitsOf(electricity, compliance),
      capabilities: capabilities(),
    };
  }

  return {
    buildViewModel: buildViewModel,
    findScenario: findScenario,
    projectGeometry: projectGeometry,
    formatNumber: formatNumber,
    formatDate: formatDate,
  };
});
```

Implement the named helpers without hidden defaults:

- `summaryOf` counts all electricity permits, permits with non-empty notices,
  records whose next action contains approval or coordination, and scheduled
  or deployed records.
- `scenarioOf` reads the notice from the coordination summary, sums the two
  current impact values, sets proposed impact to `null`, and computes the
  union duration.
- `permitsOf` returns at most eight electricity records, prioritizing records
  with coordination notices and then descending current impact. Each returned
  record has one explicit bucket:
  - `action` when its coordination notice contains another work.
  - `scheduled` when its status is `Scheduled` or `Deployed`.
  - `waiting` when its status is `Submitted`, `CompletenessReview`,
    `ImpactScreening`, or `StrategyReview`.
  - `all` for remaining records.
  - `coordinated` is not assigned from source data because the portfolio does
    not prove coordination. The controller may show the active scenario under
    `waiting` after the local request is sent, but it must not relabel it
    coordinated.
- `projectGeometry` normalizes both line strings into a `640 × 260` view box
  with a twenty-four-pixel inset and returns empty paths for unsupported
  geometry.
- `capabilities` returns the ten approved Arabic feature cards from the spec.
- `formatNumber` and `formatDate` use the Arabic Saudi locale with Latin
  digits, matching the rest of the project.

- [ ] **Step 4: Run the focused test and verify success**

Run:

```text
node presentation/tests/experience-test.js
```

Expected result: all model assertions pass.

- [ ] **Step 5: Commit the model**

Run:

```text
git add presentation/masar-experience-model.js presentation/tests/experience-test.js
git commit -m "feat: add authority experience model"
```

---

### Task 2: Semantic Page and Navigation Route

**Files:**

- Create:

```text
presentation/masar-experience.html
```

- Modify:

```text
presentation/masar-nav.js
presentation/tests/nav-test.js
presentation/tests/experience-test.js
```

**Interfaces:**

- Consumes:

```text
MasarExperienceModel
MASAR_CITY_PORTFOLIO
MASAR_DIGONCE_COMPLIANCE
```

- Produces stable mount points:

```text
experienceSummary
experienceAlert
experienceMap
experienceComparison
experienceAutomation
experiencePermits
experienceCapabilities
experienceLive
```

- [ ] **Step 1: Extend the failing source assertions**

Add assertions that require:

```js
const html = fs.readFileSync(path.join(ROOT, 'masar-experience.html'), 'utf8');
const nav = fs.readFileSync(path.join(ROOT, 'masar-nav.js'), 'utf8');

assert.ok(html.includes('lang="ar" dir="rtl"'));
assert.ok(html.includes('بيانات تمثيلية للعرض'));
assert.ok(html.includes('id="experienceAlert"'));
assert.ok(html.includes('id="experienceMap"'));
assert.ok(html.includes('id="experienceComparison"'));
assert.ok(html.includes('id="experienceAutomation"'));
assert.ok(html.includes('id="experiencePermits"'));
assert.ok(html.includes('id="experienceCapabilities"'));
assert.ok(html.includes('aria-live="polite"'));
assert.ok(html.includes('src="data/city-portfolio.geojson.js"'));
assert.ok(html.includes('src="data/digonce-compliance.js"'));
assert.ok(html.includes('src="masar-experience-model.js"'));
assert.ok(html.includes('src="masar-experience.js"'));
assert.ok(!html.includes('/api/'));
assert.ok(nav.includes("file: 'masar-experience.html'"));
assert.ok(nav.includes("label: 'تجربة المستخدم'"));
```

- [ ] **Step 2: Run the two focused tests and verify failure**

Run:

```text
node presentation/tests/experience-test.js
node presentation/tests/nav-test.js
```

Expected result: the experience page is missing and navigation still enforces
five sections.

- [ ] **Step 3: Add the semantic page**

Create a page with no inline script or style. Its body must contain:

```html
<a class="visually-hidden experience-skip" href="#experienceMain">
  تخطَّ إلى محتوى التجربة
</a>
<header class="experience-identity">
  <div>
    <p class="experience-eyebrow">مركز تنسيق الأعمال</p>
    <h1>تجربة الجهة — الشركة السعودية للكهرباء</h1>
  </div>
  <span class="experience-representative">بيانات تمثيلية للعرض</span>
</header>
<p class="visually-hidden" id="experienceLive" role="status"
   aria-live="polite"></p>
<main class="experience-page" id="experienceMain">
  <section class="experience-intro" aria-labelledby="experienceGreeting">
    <div>
      <p class="experience-eyebrow">ملخص اليوم</p>
      <h2 id="experienceGreeting">صباح الخير — لديك فرصة تنسيق تحتاج قرارك.</h2>
      <p>التنبيه أدناه يربط عملين على الشارع نفسه قبل اعتماد الجدول.</p>
    </div>
    <div class="experience-summary" id="experienceSummary"
         aria-label="ملخص محفظة الجهة"></div>
  </section>
  <section class="experience-command" aria-label="حالة التنسيق الرئيسية">
    <article class="experience-panel" id="experienceAlert"></article>
    <figure class="experience-panel experience-map" id="experienceMap"></figure>
    <aside class="experience-panel" id="experienceAction"></aside>
  </section>
  <section class="experience-section" id="experienceComparison"></section>
  <section class="experience-section" id="experienceAutomation"></section>
  <section class="experience-section" id="experiencePermits"></section>
  <section class="experience-section" id="experienceCapabilities"></section>
  <section class="experience-limits" aria-labelledby="experienceLimitsTitle">
    <p class="experience-eyebrow">حدود العرض</p>
    <h2 id="experienceLimitsTitle">قرار بشري على بيانات معلَّمة</h2>
    <ul>
      <li>المحفظة تمثيلية وليست سجل تصاريح رسمياً.</li>
      <li>طلب التنسيق داخل هذه الصفحة لا يرسل إلى جهة خارجية.</li>
      <li>اعتماد النافذة المشتركة يحتاج موافقة الجهتين.</li>
      <li>القياس الميداني مطلوب قبل اعتماد أثر المدينة.</li>
    </ul>
  </section>
</main>
```

Load scripts in this exact deferred order:

```html
<script defer src="masar-nav.js"></script>
<script defer src="data/city-portfolio.geojson.js"></script>
<script defer src="data/digonce-compliance.js"></script>
<script defer src="masar-experience-model.js"></script>
<script defer src="masar-experience.js"></script>
```

- [ ] **Step 4: Add the sixth navigation section**

Insert the route directly after the home page:

```js
{ file: 'masar-experience.html', label: 'تجربة المستخدم' },
```

Update the navigation documentation and mobile overflow comment from five to
six sections. Keep the existing overflow behavior; do not shrink labels below
thirteen pixels.

Update the navigation test:

```js
const MAIN = [
  'masar-home.html',
  'masar-experience.html',
  'masar-map.html',
  'masar-desk.html',
  'masar-overview.html',
  'masar-advanced.html',
];
const MAX_MAIN = 6;
```

Require the new Arabic label in the label assertion and update test names from
five to six.

- [ ] **Step 5: Run the focused tests and verify success**

Run:

```text
node presentation/tests/experience-test.js
node presentation/tests/nav-test.js
node presentation/tests/server-security-test.js
```

Expected result: all three focused suites pass. The security suite proves the
new page has no blocked inline script or style.

- [ ] **Step 6: Commit the route and semantic page**

Run:

```text
git add presentation/masar-experience.html presentation/masar-nav.js presentation/tests/nav-test.js presentation/tests/experience-test.js
git commit -m "feat: add authority experience route"
```

---

### Task 3: Rendering, Interaction, Charts, and Visual System

**Files:**

- Create:

```text
presentation/masar-experience.js
presentation/masar-experience.css
```

- Modify:

```text
presentation/masar-experience.html
presentation/tests/experience-test.js
```

**Interfaces:**

- Consumes:

```text
MasarExperienceModel.buildViewModel
```

- Controller state:

```js
{
  coordination: 'new' | 'sent' | 'deferred',
  permitFilter: 'all' | 'action' | 'waiting' | 'coordinated' | 'scheduled',
  detailsOpen: Boolean
}
```

- Produces:

```text
data-experience-state
data-permit-filter
data-action
```

- [ ] **Step 1: Add failing interaction and style assertions**

Require:

```js
const controller =
  fs.readFileSync(path.join(ROOT, 'masar-experience.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'masar-experience.css'), 'utf8');

assert.ok(controller.includes("coordination: 'new'"));
assert.ok(controller.includes("data-action"));
assert.ok(controller.includes("'request-coordination'"));
assert.ok(controller.includes("'review-details'"));
assert.ok(controller.includes("'defer'"));
assert.ok(controller.includes("'reset'"));
assert.ok(controller.includes('MasarExperienceModel.buildViewModel'));
assert.ok(!controller.includes('fetch('));
assert.ok(!controller.includes('localStorage'));
assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
assert.ok(css.includes('@media (max-width: 768px)'));
assert.ok(css.includes('@media (max-width: 480px)'));
assert.ok(css.includes(':focus-visible'));
assert.ok(css.includes('.experience-command'));
assert.ok(css.includes('.experience-comparison'));
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```text
node presentation/tests/experience-test.js
```

Expected result: controller and stylesheet are missing.

- [ ] **Step 3: Implement the controller**

Use an immediately invoked browser module. It must:

```js
(function () {
  'use strict';

  var state = {
    coordination: 'new',
    permitFilter: 'all',
    detailsOpen: false,
  };

  function source() {
    return window.MasarExperienceModel.buildViewModel(
      window.MASAR_CITY_PORTFOLIO,
      window.MASAR_DIGONCE_COMPLIANCE,
      { currentRef: 'BLD-2026-0077', otherRef: 'BLD-2026-0076' }
    );
  }

  function render() {
    var model = source();
    document.body.setAttribute('data-experience-state', state.coordination);
    renderSummary(model);
    renderAlert(model);
    renderMap(model);
    renderAction(model);
    renderComparison(model);
    renderAutomation(model);
    renderPermits(model);
    renderCapabilities(model);
  }

  function announce(message) {
    document.getElementById('experienceLive').textContent = message;
  }

  function onAction(action) {
    if (action === 'request-coordination') {
      state.coordination = 'sent';
      announce('تم إرسال طلب التنسيق. الحالة الآن بانتظار موافقة شركة المياه الوطنية.');
    } else if (action === 'review-details') {
      state.detailsOpen = !state.detailsOpen;
      announce(state.detailsOpen ? 'فُتحت تفاصيل التصريح.' : 'أُغلقت تفاصيل التصريح.');
    } else if (action === 'defer') {
      state.coordination = 'deferred';
      announce('أُجلت المتابعة وبقي التنبيه ضمن العناصر التي تحتاج إجراءً.');
    } else if (action === 'reset') {
      state.coordination = 'new';
      state.detailsOpen = false;
      announce('أُعيد سيناريو العرض إلى بدايته.');
    }
    render();
  }

  document.addEventListener('click', function (event) {
    var action = event.target.closest('[data-action]');
    if (action) onAction(action.getAttribute('data-action'));
    var filter = event.target.closest('[data-permit-filter]');
    if (filter) {
      state.permitFilter = filter.getAttribute('data-permit-filter');
      renderPermits(source());
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
```

Implement every renderer as a named function in the same file:

- `renderSummary` emits four definition-list metrics.
- `renderAlert` emits entity, street, dates, references, relationship, and a
  persistent representative-data note.
- `renderMap` emits an accessible figure with two SVG paths, a visible
  electricity node, a visible water node, overlap markers, and a `figcaption`.
- `renderAction` emits exactly the three approved actions before coordination,
  a waiting state plus reset after coordination, and a deferred state plus
  request/reset after deferral.
- `renderComparison` emits two metric columns. The proposed impact value is
  always the Arabic text for “not calculated,” never a manufactured number.
- `renderAutomation` emits five ordered steps and changes only step five to
  sent after the coordination action.
- `renderPermits` emits filter buttons and at most eight cards. Empty filters
  show an explicit empty state.
- `renderCapabilities` emits ten compact cards with title, purpose, input, and
  output.

Escape all dataset strings before writing them into markup. Wrap Latin permit
references in bidirectional isolation elements.

- [ ] **Step 4: Implement the stylesheet**

Import no fonts or external files. Use project tokens and define:

- A maximum content width of `1440px`.
- A compact identity bar.
- A three-column command grid at desktop:

```css
grid-template-columns: minmax(280px, .88fr) minmax(380px, 1.35fr) minmax(260px, .77fr);
```

- Two columns below `1100px`.
- One column below `768px`.
- Forty-four-pixel minimum control height.
- A restrained one-time notification pulse.
- SVG path reveal using stroke dash offset.
- Comparison bars transitioning with existing timing tokens.
- A five-step automation line that remains readable without motion.
- Clear focus rings on every button.
- Explicit empty, error, waiting, and representative-data states.
- No horizontal page overflow at `390px`.
- Reduced-motion rules that disable pulse, path reveal, and bar transitions.

Add the stylesheet link after the project tokens:

```html
<link rel="stylesheet" href="masar-tokens.css">
<link rel="stylesheet" href="masar-experience.css">
```

- [ ] **Step 5: Run focused functional tests**

Run:

```text
node presentation/tests/experience-test.js
node presentation/tests/nav-test.js
node presentation/tests/tokens-test.js
node presentation/tests/server-security-test.js
```

Expected result: all focused suites pass.

- [ ] **Step 6: Commit the complete experience**

Run:

```text
git add presentation/masar-experience.html presentation/masar-experience.css presentation/masar-experience.js presentation/tests/experience-test.js
git commit -m "feat: build authority coordination experience"
```

---

### Task 4: Browser Verification and Full Regression Gate

**Files:**

- Modify only if verification exposes a defect:

```text
presentation/masar-experience.html
presentation/masar-experience.css
presentation/masar-experience.js
presentation/masar-experience-model.js
presentation/tests/experience-test.js
presentation/masar-nav.js
presentation/tests/nav-test.js
```

**Interfaces:**

- Consumes the completed page and the existing local server.
- Produces a visually and functionally verified branch with no new regression.

- [ ] **Step 1: Start the isolated server**

Run from the worktree:

```text
node presentation/server.js
```

Expected result:

```text
Masar server listening on http://127.0.0.1:8734
```

If the original workspace already owns that port, stop only the process that
was started for the earlier review, then start the worktree server. Do not
terminate unrelated processes.

- [ ] **Step 2: Verify the desktop experience**

Open:

```text
http://127.0.0.1:8734/masar-experience.html
```

At `1280 × 720`, verify:

- The full navigation is reachable.
- The identity, summary, alert, map, and action are visible in the first screen.
- The exact electricity and water references are displayed.
- No section overlaps and no page-level horizontal overflow exists.
- The representative-data warning is visible without scrolling.
- No console error is present.

- [ ] **Step 3: Verify the interaction**

Activate “طلب نافذة مشتركة” and verify:

- The live status announces success.
- The alert state becomes sent.
- The action panel says it is waiting for National Water Company approval.
- Automation step five becomes active.
- The comparison labels the second state as proposed.
- Reset restores the initial state.

- [ ] **Step 4: Verify responsive layouts**

At widths `768` and `390`, verify:

- Navigation scroll is usable.
- The page has no horizontal overflow.
- Content order is alert, action, map, comparison, automation, permits,
  capabilities.
- Controls remain at least forty-four pixels tall.
- Permit references do not break Arabic text ordering.

- [ ] **Step 5: Run the full regression suite**

Run:

```text
node presentation/tests/run-all.js
```

Expected result: all suites pass. If the known Windows runner termination
recurs only for the server-security suite after its assertions pass, run:

```text
node presentation/tests/server-security-test.js
```

The isolated suite must print:

```text
ALL TESTS PASSED (25)
```

No focused or experience test may fail.

- [ ] **Step 6: Review the final diff**

Run:

```text
git diff HEAD~3 --check
git status --short
git log -4 --oneline
```

Expected result: no whitespace errors and no unexpected file outside the
approved list.

- [ ] **Step 7: Commit verification fixes if any**

If verification required changes, run:

```text
git add presentation/masar-experience.html presentation/masar-experience.css presentation/masar-experience.js presentation/masar-experience-model.js presentation/masar-nav.js presentation/tests/experience-test.js presentation/tests/nav-test.js
git commit -m "fix: refine authority experience verification"
```

If no file changed, do not create an empty commit.
