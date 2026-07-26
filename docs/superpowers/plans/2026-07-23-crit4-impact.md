# خطة معيار 4: الأثر المتوقع والاستدامة — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** رفع درجة معيار «الأثر المتوقع والاستدامة» من 4.5 إلى ≥9.0 بإصلاح الخصومات الخمس + تعميقين.

**Architecture:** كل الرياضيات في `presentation/masar-engine.js` (UMD, pure). وحدتان جديدتان `masar-impact-calibration.js` و`masar-impact-budget.js` بنفس نمط UMD. الواجهة `masar-prototype.html` تعرض فقط. الاختبارات في `presentation/tests/engine-test.js` (node, بلا مكتبات).

**Tech Stack:** Vanilla JS (UMD), Node `assert` tests, `file://` browser demo.

## Global Constraints

- فرع git: `crit4-impact` فقط، لا main.
- ممنوع: `masar-pitch.html`, `masar-merged.html`, `masar.html`, كود الخريطة/المسار البديل/الجدول الزمني في prototype، دوال `score/optimize/bprTravelTime` إلا لضرورة المعيار مع توثيق في REPORT.md (المهمة 3 تضطر لتعديل `score` — يوثق).
- كل رقم تركيبي موسوم «افتراض توضيحي للعرض». لا رقم تصاريح سنوي، لا مجاميع وطنية، لا نسبة ازدحام مدينة.
- كل دورة: `node presentation/tests/engine-test.js` كلها تنجح + صفر أخطاء console + فحص الفخاخ الثلاثة + commit.

---

### Task 1: digOnce داخل نطاق GAO 25–33%

**Files:**
- Modify: `presentation/masar-engine.js` (حذف `SHARED_TRENCH_OVERHEAD`, إعادة `digOnce`)
- Modify: `presentation/tests/engine-test.js:409-430`
- Modify: `presentation/masar-prototype.html` (بطاقة Dig-Once تعرض نطاقاً)

**Interfaces:**
- Produces: `digOnce({trenchKm, permitsMerged})` ترجع `{separateSAR, sharedLowSAR, sharedHighSAR, savedLowSAR, savedHighSAR, savedPctLow, savedPctHigh}`. الحقلان القديمان `savedSAR/savedPct` يُحذفان.

- [ ] Step 1: استبدل اختبار digOnce القديم (السطور 409-430) باختبارات النطاق:

```js
test('digOnce(2 permits) saved pct fixed at GAO 25-33% band', () => {
  const r = MasarEngine.digOnce({ trenchKm: 4.2, permitsMerged: 2 });
  assert.strictEqual(r.savedPctLow, 25);
  assert.strictEqual(r.savedPctHigh, 33);
  assert.ok(Math.abs(r.savedLowSAR - r.separateSAR * 0.25) < 1e-6);
  assert.ok(Math.abs(r.savedHighSAR - r.separateSAR * 0.33) < 1e-6);
  assert.ok(Math.abs(r.sharedLowSAR - (r.separateSAR - r.savedHighSAR)) < 1e-6);
});

test('digOnce() with 1 permit yields zero savings', () => {
  const r = MasarEngine.digOnce({ trenchKm: 4.2, permitsMerged: 1 });
  assert.strictEqual(r.savedLowSAR, 0);
  assert.strictEqual(r.savedPctHigh, 0);
});
```

- [ ] Step 2: `node presentation/tests/engine-test.js` — يفشل (حقول غير موجودة).
- [ ] Step 3: في المحرك: احذف `SHARED_TRENCH_OVERHEAD`، أضف:

```js
// GAO dig-once band (Sources Ledger #7): 25-33% saving in dense urban areas.
const DIG_ONCE_SAVED_FRACTION_LOW = 0.25;
const DIG_ONCE_SAVED_FRACTION_HIGH = 0.33;

function digOnce(input) {
  const { trenchKm, permitsMerged } = input;
  const cost = DEFAULTS.trenchCostPerKmSAR;
  const separateSAR = permitsMerged * trenchKm * cost;
  if (permitsMerged <= 1) {
    return { separateSAR, sharedLowSAR: separateSAR, sharedHighSAR: separateSAR,
      savedLowSAR: 0, savedHighSAR: 0, savedPctLow: 0, savedPctHigh: 0 };
  }
  const savedLowSAR = separateSAR * DIG_ONCE_SAVED_FRACTION_LOW;
  const savedHighSAR = separateSAR * DIG_ONCE_SAVED_FRACTION_HIGH;
  return {
    separateSAR,
    sharedLowSAR: separateSAR - savedHighSAR,
    sharedHighSAR: separateSAR - savedLowSAR,
    savedLowSAR, savedHighSAR,
    savedPctLow: DIG_ONCE_SAVED_FRACTION_LOW * 100,
    savedPctHigh: DIG_ONCE_SAVED_FRACTION_HIGH * 100,
  };
}
```

- [ ] Step 4: الواجهة (renderScore): اعرض `savedLowSAR – savedHighSAR ﷼ (25–33٪ GAO)`؛ عند `permitsMerged<=1` اعرض «لا دمج». حدّث `animateCountUp` ليستهدف `savedHighSAR` أو استبدله بنص نطاق ثابت.
- [ ] Step 5: اختبارات تنجح + متصفح بلا أخطاء + commit `fix: derive dig-once savings from GAO 25-33% band, drop reverse-calibrated overhead`.

### Task 2: إصلاح إشارة CO₂

**Files:**
- Modify: `presentation/masar-prototype.html:210,240-241,733-738` + `selectCandidate`

**Interfaces:**
- Consumes: `co2Range(vehHours)` كما هي. `candidate.savedVehHours` من optimize.

- [ ] Step 1: سطر 210: الوسم يصبح «انبعاثات **مضافة** بسبب الإغلاق (نطاق)» — الحساب من `delayVehHours` صحيح، الوسم كان الخطأ.
- [ ] Step 2: بطاقة الخطوة 6 (`co2Num`): احذف الحساب من `renderScore` (السطور 733-738). قبل اختيار جدولة: «— اختر جدولة محسّنة أولاً». في `selectCandidate`: `var savedCo2 = MasarEngine.co2Range(candidate.savedVehHours)` واعرض `lowCo2Kg – highCo2Kg كجم` بوسم «وفر CO₂ من الجدولة المحسّنة (من ساعات-مركبة موفّرة فقط)».
- [ ] Step 3: فحص الفخ (أ): لا وسم «وفر» فوق رقم ضرر في الصفحة كلها. متصفح بلا أخطاء.
- [ ] Step 4: commit `fix: CO2 sign — savings only from savedVehHours; closure emissions labeled as added`.

### Task 3: أرضية احتكاك منطقة العمل (قتل وفر 99.6%)

**Files:**
- Modify: `presentation/masar-engine.js` (`score`) — تعديل موثق في REPORT.md
- Modify: `presentation/tests/engine-test.js`
- Modify: `presentation/masar-prototype.html` (بطاقات optimize: الأرقام المطلقة أولاً)

**Interfaces:**
- Produces: ثابت `WORK_ZONE_FRICTION = 1.10`؛ سلوك `score`: عند `lanesClosed>0`, `closedT = max(bprClosed, baseT*1.10)`.

- [ ] Step 1: اختبارات:

```js
test('night closure still produces nonzero delay (work-zone friction floor)', () => {
  const r = MasarEngine.score({ aadt: 85000, lanes: 4, lanesClosed: 1,
    capacityPerLane: 1800, freeFlowMin: 6, startHour: 2, durationHours: 4 });
  assert.ok(r.delayVehHours > 0, `expected >0, got ${r.delayVehHours}`);
});

test('optimize savings pct stays below 95% (no 99.6% mirage)', () => {
  const r = MasarEngine.optimize({ aadt: 85000, lanes: 4, lanesClosed: 2,
    capacityPerLane: 1800, freeFlowMin: 6, startHour: 8, durationHours: 48 });
  r.top3.forEach((c) => assert.ok(c.savedPct < 95, `savedPct ${c.savedPct}`));
});
```

- [ ] Step 2: تفشل. Step 3: في `score`:

```js
// Work-zone friction: lane shifts/merges slow traffic ~10% even uncongested,
// so night hours never show zero delay (kills the 99.6% saving mirage).
// افتراض توضيحي للعرض.
const WORK_ZONE_FRICTION = 1.10;
// داخل الحلقة:
const closedT = lanesClosed > 0
  ? Math.max(bprTravelTime(freeFlowMin, demand, closedCapacity), baseT * WORK_ZONE_FRICTION)
  : baseT;
```

- [ ] Step 4: أصلح أي اختبار قديم انكسر (قيم مطلقة تغيرت — حدّث التوقعات، لا تخفف الأصول). Step 5: الواجهة: نص البطاقة يصبح «من A إلى B س-م (وفر X س-م، Y٪)» — المطلق أولاً. Step 6: اختبارات + متصفح + commit `fix: work-zone friction floor ends zero night delay and 99%+ savings mirage`.

### Task 4: عدّاد الافتراضات + إكمال جدول الشفافية

**Files:**
- Modify: `presentation/masar-engine.js` (`assumptionsUsed`)
- Modify: `presentation/tests/engine-test.js`
- Modify: `presentation/masar-prototype.html` (شارات + صفوف ASSUMPTIONS)

**Interfaces:**
- Produces: `assumptionsUsed(metric)` ترجع مصفوفة أسماء الافتراضات أو `null` لمقياس مجهول. المقاييس: `'timeValueSAR'|'co2'|'digOnce'|'transitImpact'|'score'`.

- [ ] Step 1: اختبار:

```js
test('assumptionsUsed counts unofficial assumptions per metric', () => {
  assert.strictEqual(MasarEngine.assumptionsUsed('timeValueSAR').length, 7);
  assert.ok(MasarEngine.assumptionsUsed('co2').includes('idleFuelLPerHour'));
  assert.strictEqual(MasarEngine.assumptionsUsed('nope'), null);
});
```

- [ ] Step 2: تنفيذ:

```js
const METRIC_ASSUMPTIONS = {
  score: ['aadt', 'HOURLY_PROFILE', 'lanes', 'capacityPerLane', 'freeFlowMin', 'WORK_ZONE_FRICTION'],
  timeValueSAR: ['aadt', 'HOURLY_PROFILE', 'lanes', 'capacityPerLane', 'freeFlowMin', 'occupancyBand', 'workHoursPerMonth'],
  co2: ['aadt', 'HOURLY_PROFILE', 'lanes', 'capacityPerLane', 'freeFlowMin', 'idleFuelLPerHour'],
  digOnce: ['trenchCostPerKmSAR', 'trenchKm'],
  transitImpact: ['busRoutesOnSegment', 'busesPerHourPerRoute', 'ridersPerBus'],
};
function assumptionsUsed(metric) {
  return Object.prototype.hasOwnProperty.call(METRIC_ASSUMPTIONS, metric)
    ? METRIC_ASSUMPTIONS[metric].slice() : null;
}
```

- [ ] Step 3: الواجهة: شارة `عدد الافتراضات في هذا الرقم: N` بجانب قيمة الوقت وCO₂ وdig-once وأثر الحافلات، مع `title` يسرد الأسماء. Step 4: أضف إلى ASSUMPTIONS صفوف: `COMPOUND_FACTOR 1.3`, `SCORE_CALIBRATION 0.35`, `MIN_CAPACITY_FRACTION 0.25`, `WORK_ZONE_FRICTION 1.10`, نطاق الإشغال 1.2–1.6، أجر 5800 (مصدر)، نصيب 40–70% (مصدر)، وقود 0.7–1.1، حافلات 3×4، ركاب 15–40. Step 5: اختبارات + متصفح + commit `feat: per-metric assumption counter + complete transparency table`.

### Task 5: آلية معايرة فعلية (masar-impact-calibration.js)

**Files:**
- Create: `presentation/masar-impact-calibration.js`
- Modify: `presentation/tests/engine-test.js`, `presentation/masar-prototype.html`

**Interfaces:**
- Produces: UMD `MasarImpactCalibration` = `createCalibration(store)` حيث `store` كائن `{getItem(k), setItem(k,v)}` (localStorage أو Map للاختبار). الكائن الراجع: `record({permitId, predictedVehHours, observedVehHours})`, `records()`, `correctionFactor()` (وسيط observed/predicted، 1 إن فارغ), `status()` → `{n, factor}`.

- [ ] Step 1: اختبارات:

```js
const Calib = require('../masar-impact-calibration.js');
test('calibration: empty store => factor 1, n 0', () => {
  const c = Calib.createCalibration(memStore());
  assert.deepStrictEqual(c.status(), { n: 0, factor: 1 });
});
test('calibration: median of observed/predicted ratios', () => {
  const c = Calib.createCalibration(memStore());
  c.record({ permitId: 'a', predictedVehHours: 100, observedVehHours: 110 });
  c.record({ permitId: 'b', predictedVehHours: 100, observedVehHours: 120 });
  c.record({ permitId: 'c', predictedVehHours: 100, observedVehHours: 130 });
  assert.strictEqual(c.correctionFactor(), 1.2);
  assert.strictEqual(c.status().n, 3);
});
```

مع `memStore = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; }`.

- [ ] Step 2: تنفيذ UMD يخزن JSON تحت مفتاح `masar-backtests-v1`، تجاهل سجل predicted<=0. Step 3: الواجهة: عند التحميل أنشئ من localStorage، ازرع 3 حالات تركيبية موسومة إن فارغ، واعرض على بطاقة التأثير: «التوقع المصحح: X س-م — معايرة من N حالة <span class=src-badge>حالات تركيبية موسومة للعرض</span>»، وفي `selectCandidate` سجّل back-test الحالة المقابلة في المخزن (يكبر N فعلياً). Step 4: اختبارات + متصفح + commit `feat: real calibration loop — back-test log + median correction factor`.

### Task 6: ميزانية مسار تراكمية للمحور (masar-impact-budget.js)

**Files:**
- Create: `presentation/masar-impact-budget.js`
- Modify: `presentation/tests/engine-test.js`, `presentation/masar-prototype.html`

**Interfaces:**
- Produces: UMD `MasarImpactBudget.corridorBudget({monthlyBudgetVehHours, consumedVehHours, currentPermitVehHours})` → `{budget, consumedBefore, consumedAfter, remaining, pctUsed, verdict}`؛ verdict: `'ضمن الميزانية'` إذا pctUsed<80، `'قرب السقف'` <100، `'تجاوز — يتطلب إعادة جدولة'` خلاف ذلك. `remaining` لا يقل عن 0 في العرض لكن `consumedAfter` حقيقي.

- [ ] Step 1: اختبارات:

```js
const Budget = require('../masar-impact-budget.js');
test('corridorBudget: within / near / over verdicts', () => {
  const base = { monthlyBudgetVehHours: 5000, consumedVehHours: 3000 };
  assert.strictEqual(Budget.corridorBudget({ ...base, currentPermitVehHours: 500 }).verdict, 'ضمن الميزانية');
  assert.strictEqual(Budget.corridorBudget({ ...base, currentPermitVehHours: 1500 }).verdict, 'قرب السقف');
  assert.strictEqual(Budget.corridorBudget({ ...base, currentPermitVehHours: 2500 }).verdict, 'تجاوز — يتطلب إعادة جدولة');
});
```

- [ ] Step 2: تنفيذ pure. Step 3: بطاقة جديدة في الخطوة 6: شريط عدّاد (div عرض نسبة) «ميزانية مسار المحور الشهرية: مستهلك A من B س-م — <verdict>» بوسم «ميزانية واستهلاك سابق: افتراض توضيحي للعرض»، تتحدث مع كل recompute (currentPermit = delayVehHours الحالي أو المصحح). Step 4: اختبارات + متصفح + commit `feat: cumulative corridor impact budget with visible meter`.

### Task 7: REPORT.md + التقييم الذاتي العدائي

- [ ] Step 1: شغّل الفحوص كلها + فحص الفخاخ الثلاثة على الصفحة النهائية.
- [ ] Step 2: اكتب `REPORT.md` بجذر الـworktree: التغييرات ملف:سطر، الدرجة بالرُبرِك مع دليل كل بند، ما لم يُصلح، عدد الدورات.
- [ ] Step 3: إن الدرجة <9.0 عد لأفكار التعميق (tornado chart / بطاقة PDF) وكرر.
- [ ] Step 4: commit نهائي `docs: REPORT.md — adversarial self-assessment`.

## Self-Review

- تغطية الخصومات الخمس: 1→Task1 (dig-once) ✓، CO₂→Task2 ✓، 99.6%→Task3 ✓، الافتراضات→Task4 ✓، الاستدامة→Task5 ✓. تعميق: Task6 (+Task5 نفسه آلية).
- الأسماء متسقة: `savedLowSAR/savedHighSAR` (T1 محرك = T1 واجهة)، `assumptionsUsed` (T4)، `createCalibration/status` (T5)، `corridorBudget` (T6).
- لا placeholders — كل خطوة كود فعلي.
