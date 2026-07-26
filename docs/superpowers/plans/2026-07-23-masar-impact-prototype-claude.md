# خطة كلود — رفع المعيار 4 (الأثر والاستدامة 7.0→9.0+) والمعيار 5 (جودة النموذج 9.0→9.5+)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** تحويل مخرجات محرك «مسار» من أرقام نقطية بساعات-مركبة إلى نطاقات ساعات-أشخاص وقيمة وقت وانبعاثات وأثر حافلات بمصادر سعودية رسمية، وإضافة تصدير WZDx وبطاقة حالة مقابلة إلى النموذج.

**Architecture:** كل الحسابات الجديدة دوال نقية تُضاف إلى `masar-engine.js` (UMD، بلا DOM/fetch/Date.now في الرياضيات) وتُختبر في `tests/engine-test.js` بنمط node:assert القائم. الواجهة `masar-prototype.html` تستهلك الدوال فقط وتعرضها بشارات مصدر. لا يُلمس أي ملف من ملفات خطة ChatGPT.

**Tech Stack:** Vanilla JS (UMD engine) · node:assert tests · Leaflet (مضمّن محلياً) · بلا أي تبعية جديدة.

## Global Constraints

- **تقسيم الملفات (صارم):** هذه الخطة تعدّل فقط: `presentation/masar-engine.js` · `presentation/masar-prototype.html` · `presentation/tests/engine-test.js`. ممنوع لمس `masar-pitch.html` / `masar-merged.html` / `masar.html` (ملكية ChatGPT).
- **لا مستودع git** في `C:\Users\wasan\Downloads\Swarm` — كل خطوة "Commit" تُستبدل بـ: تشغيل كامل الاختبارات `node presentation/tests/engine-test.js` والتأكد من `ALL TESTS PASSED`. (إن رغب المستخدم لاحقاً: `git init` قراره هو.)
- **قاعدة الوسم:** أي ثابت غير مصدري يحمل تعليق `افتراض توضيحي للعرض` — نفس نمط الملف الحالي.
- **قاعدة النطاق:** ساعات الأشخاص والقيمة والانبعاثات وأثر الحافلات تُعرض **كنطاق (منخفض–مرتفع)** دائماً، أبداً ليس رقماً وحيداً. (بوابة النشر — evidence-gaps.md)
- **قاعدة العزو:** التأخير المعروض = الفرق عن حالة مقابلة بلا إغلاق لنفس الساعة والطلب (baseT vs closedT) — الصياغة تظهر حرفياً في بطاقة الحالة المقابلة.
- **قاعدة الأوفلاين:** كل ميزة جديدة تعمل من `file://` بلا إنترنت وبصفر أخطاء console (تصدير WZDx عبر Blob لا fetch).
- **المصادر الحاكمة (من `research/2026-07-23/data/source-ledger.json`):**
  - `src-003` كود الطرق السعودي 203 — قيمة الوقت كنسبة من الأجر: تنقل فردي 50%، سائق مشارك 60%، راكب 40%، محلي شخصي 50%، بين المدن 70%، عمل 100%. النطاق المستخدم: **0.40–0.70**.
  - `src-017` GASTAT — متوسط الأجر الشهري **5,800 ريال** (الربع الأول 2026).
  - `src-011` طبقات الرياض المفتوحة — مسارات الحافلات (117 مساراً).
  - `src-019` WZDx — صيغة تبادل بيانات منطقة العمل.
  - `src-004` كود 203 — الانبعاثات: **الفيزيائي أولاً، لا تحويل إلى ريال** (سنة أساس الأسعار 2005 قديمة).
- **الاختبارات الحالية 31/31 يجب أن تبقى ناجحة** بعد كل مهمة — أي كسر backward-compat مرفوض (`co2()` و`DEFAULTS` القديمة تبقى كما هي).

## File Structure

| ملف | مسؤوليته في هذه الخطة |
|---|---|
| `presentation/masar-engine.js` | إضافة 6 دوال نقية: `personHours` · `timeValueSAR` · `co2Range` · `transitImpact` · `wzdx` · `predictionError` + ثوابت DEFAULTS جديدة |
| `presentation/tests/engine-test.js` | اختبار لكل دالة قبل تنفيذها (TDD) |
| `presentation/masar-prototype.html` | عرض النطاقات بشارات مصدر + زر تصدير WZDx + بطاقة الحالة المقابلة |

---

### Task 1: ثوابت النطاقات الجديدة في DEFAULTS

**Files:**
- Modify: `presentation/masar-engine.js` (كتلة `DEFAULTS`، السطر ~33)
- Test: `presentation/tests/engine-test.js`

**Interfaces:**
- Produces: `DEFAULTS.occupancyLow=1.2`, `DEFAULTS.occupancyHigh=1.6`, `DEFAULTS.wageMonthlySAR=5800`, `DEFAULTS.workHoursPerMonth=160`, `DEFAULTS.votShareLow=0.4`, `DEFAULTS.votShareHigh=0.7`, `DEFAULTS.idleFuelLPerHourLow=0.7`, `DEFAULTS.idleFuelLPerHourHigh=1.1`, `DEFAULTS.busRoutesOnSegment=3`, `DEFAULTS.busesPerHourPerRoute=4`, `DEFAULTS.ridersPerBusLow=15`, `DEFAULTS.ridersPerBusHigh=40` — تستهلكها المهام 2–5.

- [ ] **Step 1: اختبار فاشل**

يُضاف في نهاية `tests/engine-test.js` قبل سطر الطباعة النهائي:

```js
// ---------------------------------------------------------------------------
// Range constants (Task 1)
// ---------------------------------------------------------------------------

test('DEFAULTS carries range constants for person-hours / VoT / fuel / transit', () => {
  const d = MasarEngine.DEFAULTS;
  assert.strictEqual(d.occupancyLow, 1.2);
  assert.strictEqual(d.occupancyHigh, 1.6);
  assert.strictEqual(d.wageMonthlySAR, 5800);
  assert.strictEqual(d.workHoursPerMonth, 160);
  assert.strictEqual(d.votShareLow, 0.4);
  assert.strictEqual(d.votShareHigh, 0.7);
  assert.strictEqual(d.idleFuelLPerHourLow, 0.7);
  assert.strictEqual(d.idleFuelLPerHourHigh, 1.1);
  assert.strictEqual(d.busRoutesOnSegment, 3);
  assert.strictEqual(d.busesPerHourPerRoute, 4);
  assert.strictEqual(d.ridersPerBusLow, 15);
  assert.strictEqual(d.ridersPerBusHigh, 40);
});
```

- [ ] **Step 2: تشغيل للتأكد من الفشل**

Run: `node presentation/tests/engine-test.js`
Expected: FAIL — `AssertionError ... occupancyLow`

- [ ] **Step 3: التنفيذ**

في `masar-engine.js` داخل كائن `DEFAULTS` بعد سطر `trenchCostPerKmSAR`:

```js
    // --- نطاقات المعيار الرابع (23 يوليو 2026) ---
    occupancyLow: 1.2, // شخص/مركبة — افتراض توضيحي للعرض؛ كود 203 يشترط الإشغال لا عدّ المركبات (src-003) ولا رقم رياض رسمي منشور
    occupancyHigh: 1.6, // شخص/مركبة — الحد الأعلى للنطاق، افتراض توضيحي للعرض
    wageMonthlySAR: 5800, // متوسط الأجر الشهري، GASTAT الربع الأول 2026 (src-017)
    workHoursPerMonth: 160, // ساعة/شهر — افتراض توضيحي للعرض لتحويل الأجر إلى ساعة
    votShareLow: 0.4, // نصيب قيمة الوقت من الأجر — حد الراكب المشارك، كود الطرق 203 (src-003)
    votShareHigh: 0.7, // نصيب قيمة الوقت من الأجر — حد السفر بين المدن، كود الطرق 203 (src-003)
    idleFuelLPerHourLow: 0.7, // لتر/ساعة-مركبة — حد أدنى، افتراض توضيحي للعرض
    idleFuelLPerHourHigh: 1.1, // لتر/ساعة-مركبة — حد أعلى، افتراض توضيحي للعرض
    busRoutesOnSegment: 3, // مسارات حافلات تعبر مقطع العرض — افتراض توضيحي مبني على طبقة المسارات المفتوحة (src-011)
    busesPerHourPerRoute: 4, // حافلة/ساعة/مسار (تواتر 15 دقيقة) — افتراض توضيحي للعرض
    ridersPerBusLow: 15, // راكب/حافلة — حد أدنى، افتراض توضيحي للعرض
    ridersPerBusHigh: 40, // راكب/حافلة — حد أعلى، افتراض توضيحي للعرض
```

- [ ] **Step 4: تشغيل — نجاح**

Run: `node presentation/tests/engine-test.js`
Expected: `ALL TESTS PASSED (32)` — الاختبار القديم `DEFAULTS carries expected demo constants` يبقى ناجحاً لأنه لا يفحص المفاتيح الجديدة.

---

### Task 2: `personHours()` — ساعات الأشخاص كنطاق

**Files:**
- Modify: `presentation/masar-engine.js` (بعد دالة `co2`)
- Test: `presentation/tests/engine-test.js`

**Interfaces:**
- Consumes: `DEFAULTS.occupancyLow/High` (Task 1)
- Produces: `personHours(vehHours, opts?) → {lowPersonHours:number, highPersonHours:number, occLow:number, occHigh:number}` — تستهلكها Task 3 وTask 7.

- [ ] **Step 1: اختبار فاشل**

```js
// ---------------------------------------------------------------------------
// personHours (Task 2)
// ---------------------------------------------------------------------------

test('personHours(100) => 120-160 person-hours with default occupancy band', () => {
  const r = MasarEngine.personHours(100);
  assert.strictEqual(r.lowPersonHours, 120);
  assert.strictEqual(r.highPersonHours, 160);
  assert.strictEqual(r.occLow, 1.2);
  assert.strictEqual(r.occHigh, 1.6);
});

test('personHours(0) => zero range', () => {
  const r = MasarEngine.personHours(0);
  assert.strictEqual(r.lowPersonHours, 0);
  assert.strictEqual(r.highPersonHours, 0);
});

test('personHours honors opts override', () => {
  const r = MasarEngine.personHours(100, { occLow: 1.0, occHigh: 2.0 });
  assert.strictEqual(r.lowPersonHours, 100);
  assert.strictEqual(r.highPersonHours, 200);
});
```

- [ ] **Step 2:** Run: `node presentation/tests/engine-test.js` — Expected: FAIL `personHours is not a function`

- [ ] **Step 3: التنفيذ**

في `masar-engine.js` بعد دالة `co2()`:

```js
  /**
   * Convert vehicle-hours of delay into a person-hours RANGE using an
   * occupancy band. كود الطرق 203 يشترط الإشغال لا عدّ المركبات (src-003).
   * النطاق إلزامي — لا رقم وحيد (بوابة النشر، evidence-gaps 2026-07-23).
   * @param {number} vehHours
   * @param {{occLow?:number, occHigh?:number}} [opts]
   * @returns {{lowPersonHours:number, highPersonHours:number, occLow:number, occHigh:number}}
   */
  function personHours(vehHours, opts) {
    const occLow = (opts && opts.occLow) || DEFAULTS.occupancyLow;
    const occHigh = (opts && opts.occHigh) || DEFAULTS.occupancyHigh;
    return {
      lowPersonHours: vehHours * occLow,
      highPersonHours: vehHours * occHigh,
      occLow,
      occHigh,
    };
  }
```

وفي كائن الإرجاع النهائي (`return { ... }`) إضافة `personHours,` بعد `co2,`.

- [ ] **Step 4:** Run: `node presentation/tests/engine-test.js` — Expected: `ALL TESTS PASSED (35)`

---

### Task 3: `timeValueSAR()` — قيمة الوقت كنطاق ريالي بمعادلة كود 203

**Files:**
- Modify: `presentation/masar-engine.js` (بعد `personHours`)
- Test: `presentation/tests/engine-test.js`

**Interfaces:**
- Consumes: مخرج `personHours()` (Task 2)، `DEFAULTS.wageMonthlySAR/workHoursPerMonth/votShareLow/votShareHigh` (Task 1)
- Produces: `timeValueSAR(phRange, opts?) → {lowSAR:number, highSAR:number, wageHourlySAR:number, shareLow:number, shareHigh:number}` — تستهلكها Task 7.

- [ ] **Step 1: اختبار فاشل**

```js
// ---------------------------------------------------------------------------
// timeValueSAR (Task 3)
// ---------------------------------------------------------------------------

test('timeValueSAR: wageHourly = 5800/160 = 36.25 SAR', () => {
  const r = MasarEngine.timeValueSAR(MasarEngine.personHours(100));
  assert.strictEqual(r.wageHourlySAR, 36.25);
});

test('timeValueSAR(personHours(100)) => low 1740, high 4060 SAR', () => {
  // low  = 120 person-hours * 36.25 * 0.4 = 1740
  // high = 160 person-hours * 36.25 * 0.7 = 4060
  const r = MasarEngine.timeValueSAR(MasarEngine.personHours(100));
  assert.strictEqual(r.lowSAR, 1740);
  assert.strictEqual(r.highSAR, 4060);
  assert.strictEqual(r.shareLow, 0.4);
  assert.strictEqual(r.shareHigh, 0.7);
});

test('timeValueSAR of zero person-hours => zero SAR range', () => {
  const r = MasarEngine.timeValueSAR(MasarEngine.personHours(0));
  assert.strictEqual(r.lowSAR, 0);
  assert.strictEqual(r.highSAR, 0);
});
```

- [ ] **Step 2:** Run — Expected: FAIL `timeValueSAR is not a function`

- [ ] **Step 3: التنفيذ**

```js
  /**
   * Monetize a person-hours range using the Saudi Highway Code 203 formula:
   * value-of-time = share-of-hourly-wage (0.40 راكب → 0.70 بين المدن, src-003)
   * والأجر من GASTAT الربع الأول 2026 (src-017). نطاق دائماً — لا رقم وحيد.
   * @param {{lowPersonHours:number, highPersonHours:number}} phRange
   * @param {{wageMonthlySAR?:number, workHoursPerMonth?:number, shareLow?:number, shareHigh?:number}} [opts]
   * @returns {{lowSAR:number, highSAR:number, wageHourlySAR:number, shareLow:number, shareHigh:number}}
   */
  function timeValueSAR(phRange, opts) {
    const wageMonthly = (opts && opts.wageMonthlySAR) || DEFAULTS.wageMonthlySAR;
    const workHours = (opts && opts.workHoursPerMonth) || DEFAULTS.workHoursPerMonth;
    const shareLow = (opts && opts.shareLow) || DEFAULTS.votShareLow;
    const shareHigh = (opts && opts.shareHigh) || DEFAULTS.votShareHigh;
    const wageHourlySAR = wageMonthly / workHours;
    return {
      lowSAR: phRange.lowPersonHours * wageHourlySAR * shareLow,
      highSAR: phRange.highPersonHours * wageHourlySAR * shareHigh,
      wageHourlySAR,
      shareLow,
      shareHigh,
    };
  }
```

وإضافة `timeValueSAR,` إلى كائن الإرجاع.

- [ ] **Step 4:** Run — Expected: `ALL TESTS PASSED (38)`

---

### Task 4: `co2Range()` + `transitImpact()` — انبعاثات وأثر حافلات كنطاق

**Files:**
- Modify: `presentation/masar-engine.js`
- Test: `presentation/tests/engine-test.js`

**Interfaces:**
- Consumes: `DEFAULTS.idleFuelLPerHourLow/High`, `DEFAULTS.busRoutesOnSegment/busesPerHourPerRoute/ridersPerBusLow/High` (Task 1)، ومخرج `score().hourly` (البنية القائمة: `[{hour, demand, baseT, closedT, delayVehHours}]`)
- Produces:
  - `co2Range(vehHours) → {lowFuelL, highFuelL, lowCo2Kg, highCo2Kg}`
  - `transitImpact(scoreResult, opts?) → {busDelayHours:number, lowPersonHours:number, highPersonHours:number, busesAffected:number}`
  - كلاهما تستهلكه Task 7. **`co2()` القديمة تبقى دون تغيير.**

- [ ] **Step 1: اختبار فاشل**

```js
// ---------------------------------------------------------------------------
// co2Range + transitImpact (Task 4)
// ---------------------------------------------------------------------------

test('co2Range(100) => fuel 70-110 L, co2 161.7-254.1 kg', () => {
  const r = MasarEngine.co2Range(100);
  assert.strictEqual(r.lowFuelL, 70);
  assert.strictEqual(r.highFuelL, 110);
  assert.ok(Math.abs(r.lowCo2Kg - 161.7) < 1e-9, `lowCo2Kg was ${r.lowCo2Kg}`);
  assert.ok(Math.abs(r.highCo2Kg - 254.1) < 1e-9, `highCo2Kg was ${r.highCo2Kg}`);
});

test('co2Range(0) => zero everywhere', () => {
  const r = MasarEngine.co2Range(0);
  assert.strictEqual(r.lowFuelL, 0);
  assert.strictEqual(r.highCo2Kg, 0);
});

test('transitImpact: 1 hour with 6-min bus delay => 12 buses, 1.2 bus-hours, 18-48 person-hours', () => {
  const fakeScore = { hourly: [{ hour: 8, demand: 5000, baseT: 6, closedT: 12, delayVehHours: 100 }] };
  const r = MasarEngine.transitImpact(fakeScore);
  // buses = 3 routes * 4 buses/hr = 12; delay/bus = 6 min = 0.1 hr
  // busDelayHours = 12 * 0.1 = 1.2; low = 1.2*15 = 18; high = 1.2*40 = 48
  assert.strictEqual(r.busesAffected, 12);
  assert.ok(Math.abs(r.busDelayHours - 1.2) < 1e-9, `busDelayHours was ${r.busDelayHours}`);
  assert.ok(Math.abs(r.lowPersonHours - 18) < 1e-9);
  assert.ok(Math.abs(r.highPersonHours - 48) < 1e-9);
});

test('transitImpact with no closure delay (closedT == baseT) => zero', () => {
  const fakeScore = { hourly: [{ hour: 3, demand: 400, baseT: 6, closedT: 6, delayVehHours: 0 }] };
  const r = MasarEngine.transitImpact(fakeScore);
  assert.strictEqual(r.busDelayHours, 0);
  assert.strictEqual(r.lowPersonHours, 0);
});
```

- [ ] **Step 2:** Run — Expected: FAIL `co2Range is not a function`

- [ ] **Step 3: التنفيذ**

بعد دالة `co2()` القائمة (لا تعديل عليها):

```js
  /**
   * Range version of co2(): idle fuel band 0.7–1.1 L/veh-hour (افتراض توضيحي)
   * والانبعاثات الفيزيائية فقط — لا تحويل إلى ريال (سنة أساس أسعار كود 203
   * هي 2005 وتحتاج تحديثاً قبل أي استخدام نقدي، src-004).
   * @param {number} vehHours
   * @returns {{lowFuelL:number, highFuelL:number, lowCo2Kg:number, highCo2Kg:number}}
   */
  function co2Range(vehHours) {
    const lowFuelL = vehHours * DEFAULTS.idleFuelLPerHourLow;
    const highFuelL = vehHours * DEFAULTS.idleFuelLPerHourHigh;
    return {
      lowFuelL,
      highFuelL,
      lowCo2Kg: lowFuelL * DEFAULTS.co2KgPerL,
      highCo2Kg: highFuelL * DEFAULTS.co2KgPerL,
    };
  }

  /**
   * Bus-rider impact range for the closure: for each closure hour, every bus
   * crossing the segment absorbs (closedT - baseT) minutes of delay.
   * عدد المسارات من طبقة الرياض المفتوحة (src-011)؛ الركاب نطاق افتراضي موسوم.
   * @param {{hourly:Array<{baseT:number, closedT:number}>}} scoreResult
   * @param {{routes?:number, busesPerHour?:number, ridersLow?:number, ridersHigh?:number}} [opts]
   * @returns {{busDelayHours:number, lowPersonHours:number, highPersonHours:number, busesAffected:number}}
   */
  function transitImpact(scoreResult, opts) {
    const routes = (opts && opts.routes) || DEFAULTS.busRoutesOnSegment;
    const busesPerHour = (opts && opts.busesPerHour) || DEFAULTS.busesPerHourPerRoute;
    const ridersLow = (opts && opts.ridersLow) || DEFAULTS.ridersPerBusLow;
    const ridersHigh = (opts && opts.ridersHigh) || DEFAULTS.ridersPerBusHigh;

    const busesPerClosureHour = routes * busesPerHour;
    let busDelayHours = 0;
    scoreResult.hourly.forEach(function (h) {
      const delayMinPerBus = Math.max(0, h.closedT - h.baseT);
      busDelayHours += (busesPerClosureHour * delayMinPerBus) / 60;
    });

    return {
      busDelayHours,
      lowPersonHours: busDelayHours * ridersLow,
      highPersonHours: busDelayHours * ridersHigh,
      busesAffected: busesPerClosureHour,
    };
  }
```

وإضافة `co2Range,` و`transitImpact,` إلى كائن الإرجاع.

- [ ] **Step 4:** Run — Expected: `ALL TESTS PASSED (42)`

---

### Task 5: `wzdx()` — تصدير منطقة العمل بصيغة WZDx

**Files:**
- Modify: `presentation/masar-engine.js`
- Test: `presentation/tests/engine-test.js`

**Interfaces:**
- Produces: `wzdx(input) → GeoJSON FeatureCollection` حيث `input = {id:string, roadName:string, direction:string, lanes:number, lanesClosed:number, startISO:string, durationHours:number, coordinates:Array<[number,number]>}` — تستهلكها Task 8 (زر التصدير). دالة نقية: التاريخ من `startISO` الممرر، لا `Date.now()`.

- [ ] **Step 1: اختبار فاشل**

```js
// ---------------------------------------------------------------------------
// wzdx (Task 5)
// ---------------------------------------------------------------------------

test('wzdx returns a WZDx-shaped FeatureCollection with correct dates and impact', () => {
  const fc = MasarEngine.wzdx({
    id: 'masar-demo-001',
    roadName: 'طريق الملك فهد',
    direction: 'northbound',
    lanes: 4,
    lanesClosed: 2,
    startISO: '2026-07-27T22:00:00Z',
    durationHours: 8,
    coordinates: [[46.675, 24.700], [46.680, 24.735]],
  });
  assert.strictEqual(fc.type, 'FeatureCollection');
  assert.strictEqual(fc.features.length, 1);
  const p = fc.features[0].properties;
  assert.strictEqual(p.core_details.event_type, 'work-zone');
  assert.strictEqual(p.core_details.data_source_id, 'masar-prototype');
  assert.deepStrictEqual(p.core_details.road_names, ['طريق الملك فهد']);
  assert.strictEqual(p.core_details.direction, 'northbound');
  assert.strictEqual(p.vehicle_impact, 'some-lanes-closed');
  assert.strictEqual(p.start_date, '2026-07-27T22:00:00.000Z');
  assert.strictEqual(p.end_date, '2026-07-28T06:00:00.000Z'); // +8h
  assert.strictEqual(fc.features[0].geometry.type, 'LineString');
});

test('wzdx vehicle_impact: all lanes closed => all-lanes-closed; zero => all-lanes-open', () => {
  const base = {
    id: 'x', roadName: 'r', direction: 'northbound', lanes: 4,
    startISO: '2026-07-27T22:00:00Z', durationHours: 4,
    coordinates: [[46.6, 24.7], [46.7, 24.8]],
  };
  const closed = MasarEngine.wzdx({ ...base, lanesClosed: 4 });
  assert.strictEqual(closed.features[0].properties.vehicle_impact, 'all-lanes-closed');
  const open = MasarEngine.wzdx({ ...base, lanesClosed: 0 });
  assert.strictEqual(open.features[0].properties.vehicle_impact, 'all-lanes-open');
});
```

- [ ] **Step 2:** Run — Expected: FAIL `wzdx is not a function`

- [ ] **Step 3: التنفيذ**

```js
  /**
   * Build a minimal Work Zone Data Exchange (WZDx v4-style) road_event
   * FeatureCollection for the approved schedule (src-019). Deterministic:
   * dates derive only from input.startISO — no Date.now().
   * @param {{id:string, roadName:string, direction:string, lanes:number,
   *          lanesClosed:number, startISO:string, durationHours:number,
   *          coordinates:Array<Array<number>>}} input
   * @returns {object} GeoJSON FeatureCollection
   */
  function wzdx(input) {
    const start = new Date(input.startISO);
    const end = new Date(start.getTime() + input.durationHours * 3600 * 1000);

    let vehicleImpact;
    if (input.lanesClosed <= 0) vehicleImpact = 'all-lanes-open';
    else if (input.lanesClosed >= input.lanes) vehicleImpact = 'all-lanes-closed';
    else vehicleImpact = 'some-lanes-closed';

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: input.id,
          geometry: {
            type: 'LineString',
            coordinates: input.coordinates,
          },
          properties: {
            core_details: {
              event_type: 'work-zone',
              data_source_id: 'masar-prototype',
              road_names: [input.roadName],
              direction: input.direction,
            },
            start_date: start.toISOString(),
            end_date: end.toISOString(),
            vehicle_impact: vehicleImpact,
            location_method: 'other',
            start_date_accuracy: 'estimated',
            end_date_accuracy: 'estimated',
          },
        },
      ],
    };
  }
```

وإضافة `wzdx,` إلى كائن الإرجاع.

- [ ] **Step 4:** Run — Expected: `ALL TESTS PASSED (44)`

---

### Task 6: `predictionError()` — خطأ التوقع لبطاقة الحالة المقابلة

**Files:**
- Modify: `presentation/masar-engine.js`
- Test: `presentation/tests/engine-test.js`

**Interfaces:**
- Produces: `predictionError(predictedVehHours, observedVehHours) → {absError:number, pctError:number, verdict:string}` — verdict ∈ `'دقيق'` (≤15%) · `'مقبول'` (≤30%) · `'يتطلب إعادة معايرة'` (>30%). تستهلكها Task 9.

- [ ] **Step 1: اختبار فاشل**

```js
// ---------------------------------------------------------------------------
// predictionError (Task 6)
// ---------------------------------------------------------------------------

test('predictionError(100, 112) => abs 12, pct 12, verdict دقيق', () => {
  const r = MasarEngine.predictionError(100, 112);
  assert.strictEqual(r.absError, 12);
  assert.ok(Math.abs(r.pctError - 12) < 1e-9);
  assert.strictEqual(r.verdict, 'دقيق');
});

test('predictionError(100, 125) => verdict مقبول; (100, 140) => يتطلب إعادة معايرة', () => {
  assert.strictEqual(MasarEngine.predictionError(100, 125).verdict, 'مقبول');
  assert.strictEqual(MasarEngine.predictionError(100, 140).verdict, 'يتطلب إعادة معايرة');
});

test('predictionError guards zero prediction', () => {
  const r = MasarEngine.predictionError(0, 10);
  assert.strictEqual(r.pctError, 100);
  assert.strictEqual(r.verdict, 'يتطلب إعادة معايرة');
});
```

- [ ] **Step 2:** Run — Expected: FAIL `predictionError is not a function`

- [ ] **Step 3: التنفيذ**

```js
  /**
   * Post-implementation calibration check: compare predicted vs. observed
   * vehicle-hours. عتبات الحكم افتراض توضيحي للعرض (15% / 30%).
   * @param {number} predictedVehHours
   * @param {number} observedVehHours
   * @returns {{absError:number, pctError:number, verdict:string}}
   */
  function predictionError(predictedVehHours, observedVehHours) {
    const absError = Math.abs(observedVehHours - predictedVehHours);
    const pctError = predictedVehHours > 0
      ? (absError / predictedVehHours) * 100
      : 100;
    let verdict;
    if (pctError <= 15) verdict = 'دقيق';
    else if (pctError <= 30) verdict = 'مقبول';
    else verdict = 'يتطلب إعادة معايرة';
    return { absError, pctError, verdict };
  }
```

وإضافة `predictionError,` إلى كائن الإرجاع.

- [ ] **Step 4:** Run — Expected: `ALL TESTS PASSED (47)`

---

### Task 7: واجهة النطاقات في بطاقة النتيجة

**Files:**
- Modify: `presentation/masar-prototype.html`

**Interfaces:**
- Consumes: `MasarEngine.personHours` · `timeValueSAR` · `co2Range` · `transitImpact` (Tasks 2–4)، `formatArabicNumber()` القائمة، عنصر `#delayVehHours` القائم (السطر ~199)، دالة `renderScore(result)` القائمة (السطر ~692).

- [ ] **Step 1: HTML — بعد السطر الحامل للعنصر `id="delayVehHours"`**

الأصل (anchor):

```html
<div class="impact-detail">ساعات-مركبة مضافة: <b class="num" id="delayVehHours">٠</b></div>
```

يُضاف بعده مباشرة:

```html
<div class="impact-detail">ساعات-أشخاص (نطاق): <b class="num" id="personHoursRange">—</b> <span class="src-badge">إشغال ١٫٢–١٫٦ افتراض · كود الطرق 203</span></div>
<div class="impact-detail">قيمة الوقت (نطاق): <b class="num" id="timeValueRange">—</b> <span class="src-badge">كود 203 (٤٠–٧٠٪ من الأجر) · أجر GASTAT ٥٬٨٠٠ ر/شهر</span></div>
<div class="impact-detail">انبعاثات متجنبة محتملة (نطاق): <b class="num" id="co2RangeLine">—</b> <span class="src-badge">فيزيائي فقط — لا تحويل نقدي (كود 203)</span></div>
<div class="impact-detail">أثر ركاب الحافلات (نطاق): <b class="num" id="transitRangeLine">—</b> <span class="src-badge">١١٧ مساراً — طبقة مفتوحة · ركاب/حافلة افتراض</span></div>
```

- [ ] **Step 2: CSS — داخل وسم `<style>` الرئيسي، في نهايته**

```css
.src-badge{display:inline-block;font-size:.68rem;color:var(--muted, #667);background:var(--ground, #f2f4f6);border:1px solid var(--line, #dde);border-radius:6px;padding:1px 7px;margin-inline-start:6px;vertical-align:middle}
```

- [ ] **Step 3: JS — داخل `renderScore(result)` بعد سطر تعبئة `delayVehHours`**

الأصل (anchor، سطر ~695):

```js
document.getElementById('delayVehHours').textContent = formatArabicNumber(result.delayVehHours);
```

يُضاف بعده:

```js
    var phRange = MasarEngine.personHours(result.delayVehHours);
    var tvRange = MasarEngine.timeValueSAR(phRange);
    var co2R = MasarEngine.co2Range(result.delayVehHours);
    var transitR = MasarEngine.transitImpact(result);
    document.getElementById('personHoursRange').textContent =
      formatArabicNumber(phRange.lowPersonHours) + ' – ' + formatArabicNumber(phRange.highPersonHours) + ' س-ش';
    document.getElementById('timeValueRange').textContent =
      formatArabicNumber(tvRange.lowSAR) + ' – ' + formatArabicNumber(tvRange.highSAR) + ' ريال';
    document.getElementById('co2RangeLine').textContent =
      formatArabicNumber(co2R.lowCo2Kg) + ' – ' + formatArabicNumber(co2R.highCo2Kg) + ' كجم CO₂';
    document.getElementById('transitRangeLine').textContent =
      formatArabicNumber(transitR.lowPersonHours) + ' – ' + formatArabicNumber(transitR.highPersonHours) + ' س-ش (' + formatArabicNumber(transitR.busesAffected) + ' حافلة/ساعة)';
```

- [ ] **Step 4: تحقق متصفح**

1. `node presentation/server.js` ثم فتح `http://localhost:8734/masar-prototype.html` في Browser pane.
2. تشغيل تدفق الديمو حتى ظهور بطاقة النتيجة.
3. `read_page`: الأسطر الأربعة الجديدة ظاهرة بنطاقات (لا `—`).
4. `read_console_messages onlyErrors:true`: صفر أخطاء.
5. إغلاق الخادم وفتح الملف بـ `file://`: نفس الفحص — صفر أخطاء.

Expected: النطاقات تتغير عند تغيير مدخلات التصريح (ليست أرقاماً مزروعة).

---

### Task 8: زر تصدير WZDx (أوفلاين عبر Blob)

**Files:**
- Modify: `presentation/masar-prototype.html`

**Interfaces:**
- Consumes: `MasarEngine.wzdx` (Task 5)، حالة النموذج القائمة `state.lastScoreResult` و`state.selectedCandidate` (المستخدمة سطر ~1049)، إحداثيات مقطع العرض القائمة في كود الخريطة.

- [ ] **Step 1: HTML — بعد كتلة الأسطر المضافة في Task 7**

```html
<button id="wzdxExportBtn" type="button" class="wzdx-btn">⬇ تصدير WZDx (JSON)</button>
<span class="src-badge">صيغة تبادل مناطق العمل الأمريكية — جاهز لأنظمة الملاحة</span>
```

- [ ] **Step 2: CSS**

```css
.wzdx-btn{margin-top:10px;padding:7px 16px;border:1px solid var(--navy, #1d4e77);background:transparent;color:var(--navy, #1d4e77);border-radius:8px;cursor:pointer;font-family:inherit;font-size:.85rem}
.wzdx-btn:hover{background:var(--navy, #1d4e77);color:#fff}
```

- [ ] **Step 3: JS — معالج النقر (بعد تعريف `renderScore` أو في قسم ربط الأحداث القائم)**

```js
  document.getElementById('wzdxExportBtn').addEventListener('click', function () {
    var startHour = state.selectedCandidate ? state.selectedCandidate.startHour : 22;
    var startISO = '2026-07-27T' + String(startHour).padStart(2, '0') + ':00:00Z';
    var fc = MasarEngine.wzdx({
      id: 'masar-demo-001',
      roadName: 'طريق الملك فهد (العليا)',
      direction: 'northbound',
      lanes: MasarEngine.DEFAULTS.lanes,
      lanesClosed: state.lastScoreResult && state.lastScoreResult.score > 0 ? 2 : 0,
      startISO: startISO,
      durationHours: 8,
      coordinates: [[46.675, 24.700], [46.680, 24.735]],
    });
    var blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'masar-wzdx-demo.geojson';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
```

**ملاحظة للمنفذ:** إن كان النموذج يخزن `lanesClosed` الفعلي في `state`، استخدمه بدل الثابت `2` — افحص `state` أولاً بـ grep على `lanesClosed` داخل الملف.

- [ ] **Step 4: تحقق**

1. متصفح: نقر الزر ⇒ تنزيل `masar-wzdx-demo.geojson`.
2. `node -e "const f=require('C:/Users/wasan/Downloads/masar-wzdx-demo.geojson');console.log(f.features[0].properties.vehicle_impact)"` أو فتح الملف يدوياً: `vehicle_impact` صحيح.
3. الفحص بـ `file://` بلا إنترنت: التنزيل يعمل (Blob محلي، لا CDN).
4. صفر أخطاء console.

---

### Task 9: بطاقة الحالة المقابلة وخطأ التوقع في مشهد back-test

**Files:**
- Modify: `presentation/masar-prototype.html`

**Interfaces:**
- Consumes: `MasarEngine.predictionError` (Task 6)، `MasarEngine.backTest` القائمة، عدّاد back-test القائم (grep عن `backTest(` في الملف لتحديد المشهد).

- [ ] **Step 1: HTML — داخل مشهد back-test بعد عنصر العدّاد القائم**

grep أولاً: `backTest` في `masar-prototype.html` لتحديد الحاوية. يُضاف بعد عنصر العدّاد:

```html
<div class="cf-card">
  <h4>الحالة المقابلة — كيف نعزو التأخير؟</h4>
  <p>التأخير المعروض هو <b>الفرق</b> بين زمن الرحلة أثناء الإغلاق وزمنها في حالة مقابلة بلا إغلاق <b>لنفس الساعة ونفس الطلب المروري</b> — لا يُنسب ازدحام المدينة كله إلى الحفرية.</p>
  <div class="impact-detail">التوقع: <b class="num" id="cfPredicted">—</b> س-م · المرصود <span class="src-badge">حالة تركيبية موسومة للعرض</span>: <b class="num" id="cfObserved">—</b> س-م</div>
  <div class="impact-detail">خطأ التوقع: <b class="num" id="cfError">—</b>٪ — الحكم: <b id="cfVerdict">—</b></div>
</div>
```

- [ ] **Step 2: CSS**

```css
.cf-card{margin-top:12px;border:1px dashed var(--navy, #1d4e77);border-radius:10px;padding:12px 16px;background:var(--ground, #f7f9fb)}
.cf-card h4{margin:0 0 6px;font-size:.9rem;color:var(--navy, #1d4e77)}
.cf-card p{margin:0 0 8px;font-size:.8rem;line-height:1.7}
```

- [ ] **Step 3: JS — في الموضع الذي يُحدَّث فيه عدّاد back-test (نفس الدالة)**

```js
    var predicted = state.selectedCandidate
      ? state.selectedCandidate.delayVehHours
      : (state.lastScoreResult ? state.lastScoreResult.delayVehHours : 0);
    // حالة مرصودة تركيبية موسومة للعرض: التوقع + 12% (سيناريو "قريب من الواقع")
    var observed = predicted * 1.12;
    var pe = MasarEngine.predictionError(predicted, observed);
    document.getElementById('cfPredicted').textContent = formatArabicNumber(predicted);
    document.getElementById('cfObserved').textContent = formatArabicNumber(observed);
    document.getElementById('cfError').textContent = formatArabicNumber(pe.pctError);
    document.getElementById('cfVerdict').textContent = pe.verdict;
```

- [ ] **Step 4: تحقق متصفح**

التدفق كاملاً حتى مشهد back-test: البطاقة ظاهرة، الخطأ ~١٢٪، الحكم «دقيق»، الوسم «حالة تركيبية موسومة للعرض» مرئي، صفر أخطاء console في وضعي الخادم وfile://.

---

### Task 10: التحقق النهائي الشامل

**Files:**
- لا تعديل — تحقق فقط. (تحديث `تقييم-صارم-2026-07-23.md` بالدرجات الجديدة اختياري بعد مراجعة المستخدم.)

- [ ] **Step 1:** `node presentation/tests/engine-test.js` ⇒ `ALL TESTS PASSED (47)`
- [ ] **Step 2:** فحص الوسوم: `grep -c "افتراض توضيحي" presentation/masar-engine.js` ⇒ العدد ازداد عن الأصل (كل ثابت جديد موسوم).
- [ ] **Step 3:** فحص الممنوعات: `grep -nE "10,?000|١٠٬٠٠٠|627" presentation/masar-engine.js presentation/masar-prototype.html` ⇒ لا نتائج.
- [ ] **Step 4:** متصفح — التدفق الكامل الستة مشاهد: نطاقات + زر WZDx + بطاقة الحالة المقابلة، مرتان (خادم وfile://)، صفر أخطاء console، لقطة شاشة للمستخدم.
- [ ] **Step 5:** التأكد أن ملفات ChatGPT لم تُلمس: `git status` غير متاح (لا مستودع) — بديل: مقارنة تواريخ التعديل `ls -l presentation/masar-pitch.html presentation/masar-merged.html presentation/masar.html` ⇒ لم تتغير أثناء التنفيذ.

## أثر الخطة على الرُبرِك

| خصم في تقييم 23 يوليو | المهمة التي تغلقه |
|---|---|
| المعيار 4: −1 أرقام نقطية بلا نطاقات | Tasks 2–4 + 7 |
| المعيار 4: −1 لا ساعات أشخاص/قيمة وقت (كود 203) | Tasks 2–3 + 7 |
| المعيار 4: −0.5 لا أثر نقل عام | Task 4 + 7 |
| المعيار 5: −0.5 مشاهد الإلزامي (نطاقات، حافلات، WZDx) | Tasks 7–8 |
| المعيار 5: −0.5 غياب الحالة المقابلة | Task 9 |

المتبقي خارج النطاق (مقبول): −0.5 «يتحسن مع كل تصريح» آلية توضيحية (يحتاج بيانات فعلية)، مسار التحويلة المرسوم (تحسينه يحتاج شبكة توجيه فعلية — لاحق).
