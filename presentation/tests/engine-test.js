'use strict';
/**
 * Plain node:assert test suite for MasarEngine.
 * Run: node presentation/tests/engine-test.js
 * No frameworks. Throws on first failure; prints ALL TESTS PASSED (n) on success.
 */

const assert = require('node:assert');
const path = require('node:path');

const MasarEngine = require(path.join(__dirname, '..', 'masar-engine.js'));
const Calib = require(path.join(__dirname, '..', 'masar-impact-calibration.js'));
const Budget = require(path.join(__dirname, '..', 'masar-impact-budget.js'));

function memStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
  };
}

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

function totalWindowHours(candidate) {
  return candidate.windows.reduce(
    (sum, window) => sum + window.durationHours,
    0
  );
}

// ---------------------------------------------------------------------------
// HOURLY_PROFILE / DEFAULTS basic shape checks
// ---------------------------------------------------------------------------

test('HOURLY_PROFILE has 24 entries summing to ~1.0', () => {
  assert.strictEqual(MasarEngine.HOURLY_PROFILE.length, 24);
  const sum = MasarEngine.HOURLY_PROFILE.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1.0) < 1e-9, `sum was ${sum}`);
});

test('DEFAULTS carries expected demo constants', () => {
  assert.strictEqual(MasarEngine.DEFAULTS.aadt, 85000);
  assert.strictEqual(MasarEngine.DEFAULTS.lanes, 4);
  assert.strictEqual(MasarEngine.DEFAULTS.capacityPerLane, 1800);
  assert.strictEqual(MasarEngine.DEFAULTS.freeFlowMin, 6);
  assert.strictEqual(MasarEngine.DEFAULTS.lengthKm, 4.2);
  assert.strictEqual(MasarEngine.DEFAULTS.valueOfTimeSAR, 45);
  assert.strictEqual(MasarEngine.DEFAULTS.idleFuelLPerHour, 0.9);
  assert.strictEqual(MasarEngine.DEFAULTS.co2KgPerL, 2.31);
  // WP-A2: trenchCostPerKmSAR حُذف. غيابه شرطٌ لا سهو — الفحص الحارس في
  // 'digOnce() reports zero money…' أدناه يمنع عودته.
  assert.strictEqual(MasarEngine.DEFAULTS.trenchCostPerKmSAR, undefined);
});

// ---------------------------------------------------------------------------
// bprTravelTime
// ---------------------------------------------------------------------------

test('bprTravelTime returns freeFlowMin at zero volume', () => {
  const t = MasarEngine.bprTravelTime(6, 0, 7200);
  assert.strictEqual(t, 6);
});

test('bprTravelTime increases with volume/capacity ratio', () => {
  const low = MasarEngine.bprTravelTime(6, 1000, 7200);
  const high = MasarEngine.bprTravelTime(6, 7000, 7200);
  assert.ok(high > low, `expected high(${high}) > low(${low})`);
});

test('bprTravelTime matches BPR formula exactly for a sample point', () => {
  const t0 = 6;
  const v = 3600;
  const c = 7200;
  const expected = t0 * (1 + 0.15 * Math.pow(v / c, 4));
  const actual = MasarEngine.bprTravelTime(t0, v, c);
  assert.ok(Math.abs(actual - expected) < 1e-9);
});

// ---------------------------------------------------------------------------
// score() — numeric sanity from the plan
// ---------------------------------------------------------------------------

test('Night closure (startHour 23) delay < day closure (startHour 8) for same inputs', () => {
  const base = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    durationHours: 4,
  };
  const night = MasarEngine.score({ ...base, startHour: 23 });
  const day = MasarEngine.score({ ...base, startHour: 8 });
  assert.ok(
    night.delayVehHours < day.delayVehHours,
    `night(${night.delayVehHours}) should be < day(${day.delayVehHours})`
  );
});

test('More lanesClosed => more delay, monotonic', () => {
  const base = {
    aadt: 85000,
    lanes: 4,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 4,
  };
  const d0 = MasarEngine.score({ ...base, lanesClosed: 0 }).delayVehHours;
  const d1 = MasarEngine.score({ ...base, lanesClosed: 1 }).delayVehHours;
  const d2 = MasarEngine.score({ ...base, lanesClosed: 2 }).delayVehHours;
  const d3 = MasarEngine.score({ ...base, lanesClosed: 3 }).delayVehHours;
  assert.ok(d0 <= d1, `d0(${d0}) <= d1(${d1})`);
  assert.ok(d1 <= d2, `d1(${d1}) <= d2(${d2})`);
  assert.ok(d2 <= d3, `d2(${d2}) <= d3(${d3})`);
});

test('score() with 0 lanesClosed => delayVehHours = 0, score = 0', () => {
  const r = MasarEngine.score({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 0,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 4,
  });
  assert.strictEqual(r.delayVehHours, 0);
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.level, 'low');
});

test('score() level buckets match the real engine output across severities', () => {
  // يستدعي score() الحقيقية (لا نسخة محلية من المنطق) عبر مدخلات متدرجة
  // الشدة، ويتحقق أن level المُرجَع يطابق حدود score المُرجَع نفسه.
  const bucketOf = (s) => (s < 25 ? 'low' : s < 60 ? 'medium' : 'high');
  const severities = [
    { lanesClosed: 0, startHour: 3, durationHours: 2 },
    { lanesClosed: 1, startHour: 3, durationHours: 4 },
    { lanesClosed: 2, startHour: 8, durationHours: 12 },
    { lanesClosed: 3, startHour: 8, durationHours: 48 },
    { lanesClosed: 4, startHour: 8, durationHours: 72 },
  ];
  const seen = new Set();
  severities.forEach((sv) => {
    const r = MasarEngine.score({
      aadt: 85000, lanes: 4, capacityPerLane: 1800, freeFlowMin: 6,
      lanesClosed: sv.lanesClosed, startHour: sv.startHour, durationHours: sv.durationHours,
    });
    assert.strictEqual(r.level, bucketOf(r.score),
      `level ${r.level} != bucket of score ${r.score} for ${JSON.stringify(sv)}`);
    seen.add(r.level);
  });
  assert.ok(seen.size >= 2, `expected at least 2 distinct levels, saw: ${[...seen]}`);
});

test('score() hourly breakdown length matches durationHours', () => {
  const r = MasarEngine.score({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 6,
  });
  assert.strictEqual(r.hourly.length, 6);
});

// ---------------------------------------------------------------------------
// Edge cases: duration>24h hour wrapping
// ---------------------------------------------------------------------------

test('durationHours > 24 wraps hours correctly (h % 24)', () => {
  const inputBase = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
  };
  const r48 = MasarEngine.score({ ...inputBase, startHour: 8, durationHours: 48 });
  assert.strictEqual(r48.hourly.length, 48);
  // hour 24 into the closure should wrap back to startHour (8) demand-wise
  const hour0 = r48.hourly[0];
  const hour24 = r48.hourly[24];
  assert.ok(Math.abs(hour0.delayVehHours - hour24.delayVehHours) < 1e-9,
    `wrapped hour delay mismatch: ${hour0.delayVehHours} vs ${hour24.delayVehHours}`);
});

test('durationHours = 30 starting at hour 20 wraps past midnight (h%24) with matching profile fractions', () => {
  const r = MasarEngine.score({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 1,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 20,
    durationHours: 30,
  });
  assert.strictEqual(r.hourly.length, 30);
  // hour index 4 => absolute hour 24 => wraps to 0
  assert.strictEqual(r.hourly[4].hour, 0);
  // hour index 29 => absolute hour 49 => wraps to 1
  assert.strictEqual(r.hourly[29].hour, 1);
});

// ---------------------------------------------------------------------------
// Edge cases: lanesClosed == lanes capacity floor
// ---------------------------------------------------------------------------

test('lanesClosed == lanes applies capacity floor (0.25*capacityPerLane), stays finite', () => {
  const r = MasarEngine.score({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 4,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 2,
  });
  assert.ok(Number.isFinite(r.delayVehHours));
  assert.ok(r.delayVehHours > 0);
  assert.ok(Number.isFinite(r.score));
});

/* WP-B1 — انقلب هذا الفحص عن قصد.
 *
 * كان يثبّت أن `lanesClosed > lanes` يُقصَّ إلى أرضية السعة نفسها، أي أن
 * المحرك يقبل «إغلاق ستّ حارات في طريق من أربع» ويعطيه رقماً معقولاً. لكن
 * ذلك ليس إغلاقاً شديداً، بل **خطأ بيانات**، ورقمٌ معقول فوق مُدخل مستحيل هو
 * أخطر من رفضٍ صريح.
 *
 * والأدلّ من ذلك: `server.js` كان يردّ 400 على المُدخل نفسه. فكان المحرك
 * أكثر تساهلاً من واجهته. هذا الفحص يوحّدهما.
 *
 * أرضية السعة تبقى قائمة لحالتها الصحيحة — `lanesClosed === lanes` — وهي
 * مفحوصة في الحزمة أعلاه.
 */
test('lanesClosed > lanes يُرفض ولا يُقصّ — مُدخل مستحيل لا يُعطى رقماً', () => {
  const base = {
    aadt: 85000,
    lanes: 4,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 2,
  };
  assert.ok(Number.isFinite(MasarEngine.score({ ...base, lanesClosed: 4 }).delayVehHours));
  assert.throws(() => MasarEngine.score({ ...base, lanesClosed: 6 }),
    /حارات مغلقة/);
});

/* الصمت عند نقص المُدخل كان يُخرج تأخيراً بمرتبة 1e48 ويبدو ناجحاً. */
test('مُدخل ناقص يرفع خطأً ولا يُخرج رقماً', () => {
  const full = {
    aadt: 85000, lanes: 4, lanesClosed: 1, capacityPerLane: 1800,
    freeFlowMin: 6, startHour: 8, durationHours: 2,
  };
  ['aadt', 'lanes', 'lanesClosed', 'freeFlowMin', 'startHour', 'durationHours']
    .forEach((field) => {
      const broken = { ...full };
      delete broken[field];
      assert.throws(() => MasarEngine.score(broken), new RegExp(field),
        `${field} الناقص لم يُرفض`);
    });
  // السعة لكل حارة معيار (1800) لا قياس موقعيّ — فلها افتراضي معلن.
  const withoutCapacity = { ...full };
  delete withoutCapacity.capacityPerLane;
  assert.strictEqual(
    MasarEngine.score(withoutCapacity).delayVehHours,
    MasarEngine.score(full).delayVehHours,
    'السعة المعيارية الافتراضية لا تطابق الصريحة'
  );
});

// ---------------------------------------------------------------------------
// Edge case: zero lanesClosed => zero delay (duplicate emphasis + multiple hours)
// ---------------------------------------------------------------------------

test('zero lanesClosed => zero delay across multi-hour, multi-day closures', () => {
  const r = MasarEngine.score({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 0,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 5,
    durationHours: 36,
  });
  assert.strictEqual(r.delayVehHours, 0);
  r.hourly.forEach((h) => assert.strictEqual(h.delayVehHours, 0));
});

// ---------------------------------------------------------------------------
// optimize()
// ---------------------------------------------------------------------------

test('buildNightWindows preserves exact requested hours across boundary cases', () => {
  for (const durationHours of [1, 8, 9, 10, 16, 17, 10.5]) {
    const windows = MasarEngine.buildNightWindows(22, durationHours, 8);
    assert.ok(windows.length >= 1);
    assert.ok(windows.every((window) => window.durationHours > 0 && window.durationHours <= 8));
    assert.ok(windows.every((window) => window.startHour === 22));
    assert.deepStrictEqual(
      windows.map((window) => window.dayOffset),
      windows.map((_, index) => index)
    );
    assert.ok(
      Math.abs(windows.reduce((sum, window) => sum + window.durationHours, 0) - durationHours) < 1e-9,
      `window total did not equal ${durationHours}`
    );
  }
});

test('buildNightWindows rejects invalid hours before entering its loop', () => {
  assert.throws(() => MasarEngine.buildNightWindows(24, 8, 8), /startHour/);
  assert.throws(() => MasarEngine.buildNightWindows(22, 0, 8), /durationHours/);
  assert.throws(() => MasarEngine.buildNightWindows(22, Infinity, 8), /durationHours/);
  assert.throws(() => MasarEngine.buildNightWindows(22, 8, 0), /maxNightHours/);
});

test('10-hour night schedule uses one full window and one 2-hour window', () => {
  const result = MasarEngine.optimize({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 1,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    startHour: 22,
    durationHours: 10,
  });
  /* WP-B1 — كان الفحص يبحث عن الجدول المرحلي داخل «أفضل ثلاثة». بعد إضافة
     الأهداف المنازِعة صار جدول عشر ساعات في ليلة واحدة يهزم تقسيمه على
     ليلتين — وهو الجواب الصحيح، لا خلل. الخاصية المقصودة (تقسيم 10 على 8+2)
     خاصية `buildNightWindows`، وبقاء الجدول **مفحوصاً** يُتحقَّق من قائمة
     المرشحين لا من ترتيبها. */
  assert.deepStrictEqual(
    MasarEngine.buildNightWindows(22, 10, 8).map((item) => item.durationHours),
    [8, 2]
  );
  assert.ok(result.rankedLabels.indexOf('22p2w8') !== -1,
    `الجدول المرحلي لم يدخل المنافسة: ${result.rankedLabels.join(' ')}`);
  result.top3.forEach((candidate) => {
    assert.strictEqual(totalWindowHours(candidate), 10);
  });
});

test('baseline and every candidate represent the same requested work hours', () => {
  const result = MasarEngine.optimize({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    startHour: 8,
    durationHours: 17,
  });
  assert.strictEqual(totalWindowHours(result.baseline), 17);
  result.top3.forEach((candidate) => {
    assert.strictEqual(totalWindowHours(candidate), 17);
  });
});

test('phased delay sums active windows only and excludes daytime gaps', () => {
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    startHour: 8,
    durationHours: 10,
  };
  /* الخاصية المقصودة تخصّ الحساب لا الترتيب: تأخير جدول مرحلي = مجموع
     نوافذه النشطة وحدها، والفجوة النهارية لا تُحتسب إغلاقاً. تُفحص على
     الجدول مباشرة كي لا تتعلّق بفوزه. */
  const windows = MasarEngine.buildNightWindows(input.startHour, input.durationHours, 8);
  assert.strictEqual(windows.length, 2, 'المدة المختارة لا تنتج جدولاً مرحلياً');
  const evaluation = MasarEngine.evaluateSchedule(input, windows);
  const expected = windows.reduce((sum, window) => {
    return sum + MasarEngine.score({
      ...input,
      startHour: window.startHour,
      durationHours: window.durationHours,
    }).delayVehHours;
  }, 0);
  assert.ok(Math.abs(evaluation.closureDelayVehHours - expected) < 1e-9);
  /* والفجوة النهارية ليست مجانية أيضاً: الموقع قائم فيها. */
  assert.ok(evaluation.residualDelayVehHours > 0,
    'الفجوة بين النوافذ تُعامل كطريق سليم تماماً');
});

test('top alternatives have distinct window schedules', () => {
  const result = MasarEngine.optimize({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    startHour: 8,
    durationHours: 6,
  });
  const signatures = result.top3.map((candidate) => JSON.stringify(candidate.windows));
  assert.strictEqual(new Set(signatures).size, result.top3.length);
});

test('optimize().top3[0].delayVehHours <= baseline.delayVehHours', () => {
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 4,
  };
  const result = MasarEngine.optimize(input);
  assert.ok(result.top3.length === 3, `expected 3 candidates, got ${result.top3.length}`);
  assert.ok(
    result.top3[0].delayVehHours <= result.baseline.delayVehHours,
    `top3[0](${result.top3[0].delayVehHours}) should be <= baseline(${result.baseline.delayVehHours})`
  );
});

test('optimize() top3 sorted ascending by delayVehHours', () => {
  const result = MasarEngine.optimize({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 4,
  });
  assert.ok(result.top3[0].delayVehHours <= result.top3[1].delayVehHours);
  assert.ok(result.top3[1].delayVehHours <= result.top3[2].delayVehHours);
});

test('optimize() each candidate has label, startHour, phases, reasons[3]', () => {
  const result = MasarEngine.optimize({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 4,
  });
  result.top3.forEach((c) => {
    assert.strictEqual(typeof c.label, 'string');
    assert.strictEqual(typeof c.startHour, 'number');
    assert.ok([1, 2].includes(c.phases));
    assert.strictEqual(typeof c.delayVehHours, 'number');
    assert.strictEqual(typeof c.savedVehHours, 'number');
    assert.strictEqual(typeof c.savedPct, 'number');
    assert.ok(Array.isArray(c.reasons));
    assert.ok(c.reasons.length >= 3, `${c.reasons.length} أسباب فقط`);
    c.reasons.forEach((r) => assert.strictEqual(typeof r, 'string'));
    /* WP-B1: السبب الأول يسمّي الحدّ المرجِّح. توصية بلا حدّ مرجِّح مذكور
       تُقرأ كمخرَج صندوق أسود. */
    assert.ok(/الحدّ المرجِّح|لا حدّ مرجِّح/.test(c.reasons[0]),
      `السبب الأول لا يسمّي الحدّ المرجِّح: ${c.reasons[0]}`);
    /* والمجموع لا يُعرض بلا تفصيله. */
    assert.ok(c.breakdown && typeof c.totalEquivalentVehHours === 'number');
    const sum = c.breakdown.closureDelayVehHours
      + c.breakdown.residualDelayVehHours
      + c.breakdown.sensitivityEquivalent
      + c.breakdown.nightPremiumEquivalent;
    assert.ok(Math.abs(sum - c.totalEquivalentVehHours) < 1e-9,
      'المجموع المكافئ لا يساوي حدوده — حدٌّ خفيّ');
  });
});

test('optimize() 48h continuous baseline is NOT vacuous: night-window candidate saves >20% and >1000 veh-hours', () => {
  // Regression test for the critical engine bug: durations that are
  // multiples of 24h used to make startHour irrelevant because candidates
  // were modeled as continuous blocks (a 48h continuous block covers every
  // clock hour regardless of start time). Candidates must now be modeled
  // as nightly work windows so a night-shifted schedule genuinely reduces
  // delay relative to the requested (day-start) baseline.
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 48,
  };
  const result = MasarEngine.optimize(input);
  assert.ok(
    result.top3[0].savedPct > 20,
    `expected savedPct > 20, got ${result.top3[0].savedPct}`
  );
  assert.ok(
    result.top3[0].savedVehHours > 1000,
    `expected savedVehHours > 1000, got ${result.top3[0].savedVehHours}`
  );
});

test('optimize() windowed night candidate (startHour 23) beats a continuous day block (startHour 8) for a multi-day duration', () => {
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 48,
  };
  const totalDuration = input.durationHours;
  const nights = Math.ceil(totalDuration / 8); // WORK_WINDOW_HOURS
  const nightWindow = MasarEngine.score({ ...input, startHour: 23, durationHours: 8 });
  const nightWindowedDelay = nightWindow.delayVehHours * nights;
  const dayContinuous = MasarEngine.score({ ...input, startHour: 8, durationHours: totalDuration });
  assert.ok(
    nightWindowedDelay < dayContinuous.delayVehHours,
    `expected windowed night delay(${nightWindowedDelay}) < continuous day delay(${dayContinuous.delayVehHours})`
  );
});

test('optimize() durationHours=6 (< work window) still returns 3 valid candidates with savedVehHours >= 0', () => {
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 6,
  };
  const result = MasarEngine.optimize(input);
  assert.strictEqual(result.top3.length, 3);
  result.top3.forEach((c) => {
    assert.ok(Number.isFinite(c.savedVehHours));
    assert.ok(c.savedVehHours >= 0, `expected savedVehHours >= 0, got ${c.savedVehHours}`);
    assert.ok(Number.isFinite(c.delayVehHours));
  });
});

test('optimize() candidate and baseline return windows as the schedule contract', () => {
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 48,
  };
  const result = MasarEngine.optimize(input);
  /* العقد مثبَّت بالضبط لا بـ«يحتوي على»: حقلٌ يُضاف بصمت يغيّر ما تقرؤه
     الواجهات دون أن يسقط فحص. توسّع العقد في WP-B1 عن قصد، فيُحدَّث هنا. */
  const expectedKeys = ['label', 'startHour', 'phases', 'windowHours', 'windows',
    'delayVehHours', 'savedVehHours', 'savedPct', 'breakdown',
    'totalEquivalentVehHours', 'reasons'].sort();
  result.top3.forEach((c) => {
    assert.deepStrictEqual(Object.keys(c).sort(), expectedKeys);
  });
  assert.deepStrictEqual(Object.keys(result.baseline).sort(),
    ['breakdown', 'delayVehHours', 'totalEquivalentVehHours', 'windows']);
  assert.deepStrictEqual(Object.keys(result).sort(),
    ['baseline', 'candidateCount', 'objective', 'rankedLabels',
      'residualSensitivity', 'switchPoints', 'top3'].sort());
});

// ---------------------------------------------------------------------------
// co2()
// ---------------------------------------------------------------------------

test('co2: fuelL = vehHours*0.9 exactly with defaults', () => {
  const r = MasarEngine.co2(10);
  assert.strictEqual(r.fuelL, 9);
  assert.ok(Math.abs(r.co2Kg - 9 * 2.31) < 1e-9);
});

test('co2(0) => fuelL 0, co2Kg 0', () => {
  const r = MasarEngine.co2(0);
  assert.strictEqual(r.fuelL, 0);
  assert.strictEqual(r.co2Kg, 0);
});

// ---------------------------------------------------------------------------
// calibration loop
// ---------------------------------------------------------------------------

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

test('calibration: rejects non-positive prediction, persists via store', () => {
  const store = memStore();
  const c = Calib.createCalibration(store);
  assert.strictEqual(c.record({ permitId: 'x', predictedVehHours: 0, observedVehHours: 5 }), false);
  assert.strictEqual(c.status().n, 0);
  c.record({ permitId: 'y', predictedVehHours: 200, observedVehHours: 180 });
  // a fresh instance over the same store sees the persisted record
  const c2 = Calib.createCalibration(store);
  assert.strictEqual(c2.status().n, 1);
  assert.strictEqual(c2.correctionFactor(), 0.9);
});

// ---------------------------------------------------------------------------
// corridor impact budget
// ---------------------------------------------------------------------------

test('corridorBudget: within / near / over verdicts', () => {
  const base = { monthlyBudgetVehHours: 5000, consumedVehHours: 3000 };
  assert.strictEqual(Budget.corridorBudget({ ...base, currentPermitVehHours: 500 }).verdict, 'ضمن الميزانية');
  assert.strictEqual(Budget.corridorBudget({ ...base, currentPermitVehHours: 1500 }).verdict, 'قرب السقف');
  assert.strictEqual(Budget.corridorBudget({ ...base, currentPermitVehHours: 2500 }).verdict, 'تجاوز — يتطلب إعادة جدولة');
});

test('corridorBudget: remaining floors at 0, pct and consumedAfter honest', () => {
  const r = Budget.corridorBudget({ monthlyBudgetVehHours: 5000, consumedVehHours: 4000, currentPermitVehHours: 3000 });
  assert.strictEqual(r.consumedAfter, 7000);
  assert.strictEqual(r.remaining, 0);
  assert.strictEqual(r.pctUsed, 140);
  assert.strictEqual(r.verdict, 'تجاوز — يتطلب إعادة جدولة');
});

// ---------------------------------------------------------------------------
// assumptionsUsed()
// ---------------------------------------------------------------------------

test('assumptionsUsed counts unofficial assumptions per metric', () => {
  assert.strictEqual(MasarEngine.assumptionsUsed('timeValueSAR').length, 7);
  assert.ok(MasarEngine.assumptionsUsed('co2').includes('idleFuelLPerHour'));
  assert.strictEqual(MasarEngine.assumptionsUsed('nope'), null);
});

test('assumptionsUsed returns a copy (caller cannot mutate internal table)', () => {
  const a = MasarEngine.assumptionsUsed('digOnce');
  a.push('x');
  assert.ok(!MasarEngine.assumptionsUsed('digOnce').includes('x'));
});

// ---------------------------------------------------------------------------
// work-zone friction floor
// ---------------------------------------------------------------------------

test('night closure still produces nonzero delay (work-zone friction floor)', () => {
  const r = MasarEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 1, capacityPerLane: 1800,
    freeFlowMin: 6, startHour: 2, durationHours: 4,
  });
  assert.ok(r.delayVehHours > 0, `expected >0, got ${r.delayVehHours}`);
});

test('optimize kills the 99.6% mirage: no candidate saves >=99% and best still has material delay', () => {
  const r = MasarEngine.optimize({
    aadt: 85000, lanes: 4, lanesClosed: 2, capacityPerLane: 1800,
    freeFlowMin: 6, startHour: 8, durationHours: 48,
  });
  r.top3.forEach((c) => assert.ok(c.savedPct < 99, `savedPct ${c.savedPct}`));
  // best schedule still carries real work-zone delay (not the ~0 mirage)
  assert.ok(r.top3[0].delayVehHours >= 100, `best delay ${r.top3[0].delayVehHours}`);
});

// ---------------------------------------------------------------------------
// digOnce()
// ---------------------------------------------------------------------------

/*
 * WP-A2. كان الفحصان هنا يثبّتان نطاق GAO (25-33%) وضربه في كلفة خندق
 * افتراضية. كانا يختبران المعادلة كما كُتبت، ولم يكونا يسألان إن كان لها حق
 * أن تُكتب: الكلفة افتراض بترتيب الحجم لا تسعيرة، والنطاق يخصّ مدّ الألياف في
 * مدن أمريكية — وسجل مصادر المشروع نفسه يقول إنه لا يدعم تعميماً على حفريات
 * المدن. اختبارٌ يحرس معادلة لا ينبغي أن توجد يجعل الخطأ أصعب إزالة.
 *
 * البديل يقيس ما تقيسه الدالة الآن: كمية مادية مشتقّة من بيانات التصريح
 * وحدها. ثلاثة تصاريح تحفر الكيلومتر نفسه منفصلة = ثلاثة كيلومترات؛ دمجها
 * يجعلها كيلومتراً واحداً. لا تسعيرة ولا مصدر خارجي في المعادلة.
 */

test('digOnce: N grouped permits are N-1 additional permits — a count, not an effect', () => {
  /* عدٌّ لا ادعاء أثر. المجموعة تُبنى بتجاور الشارع والنافذة الزمنية، وقد تكون
     ثلاثة نطاقات مختلفة نُسّقت توقيتاً فقط. القول إن «حفرتين اختفتا» يحتاج
     هندسة النطاقات وتفاصيل التنفيذ، وليست عندنا. */
  const r = MasarEngine.digOnce({ trenchKm: 4.2, permitsMerged: 3 });
  assert.strictEqual(r.permitsMerged, 3);
  assert.strictEqual(r.additionalPermitsInGroups, 2);
  assert.ok(Math.abs(r.separateTrenchKm - 12.6) < 1e-6);
  assert.ok(Math.abs(r.sharedTrenchKm - 4.2) < 1e-6);
});

test('digOnce: the km figure is an equivalent, and carries its assumption', () => {
  /* الادعاء المفترَض: (N-1)×trenchKm يستلزم تداخلاً تاماً بين المسارات.
     التداخل الهندسي غير محسوب، فلا يُسمّى الرقم «طولاً متجنَّباً» قطعياً،
     ولا يخرج من الدالة بلا افتراضه ملتصقاً به. */
  const r = MasarEngine.digOnce({ trenchKm: 4.2, permitsMerged: 3 });
  assert.ok(Math.abs(r.duplicateTrenchKmEquivalent - 8.4) < 1e-6);
  assert.strictEqual(r.avoidedTrenchKm, undefined,
    'الاسم القاطع «طول متجنَّب» عاد — وهو يدّعي هندسةً غير محسوبة');
  assert.ok(/تداخل تام/.test(r.overlapAssumption),
    'الرقم المكافئ خرج بلا افتراضه');
  assert.ok(/غير محسوب/.test(r.overlapAssumption),
    'الافتراض لا يعلن أن التداخل الفعلي غير محسوب');
});

test('digOnce() with 1 permit drops nothing and asserts no overlap assumption', () => {
  const r = MasarEngine.digOnce({ trenchKm: 4.2, permitsMerged: 1 });
  assert.strictEqual(r.duplicateTrenchKmEquivalent, 0);
  assert.strictEqual(r.additionalPermitsInGroups, 0);
  assert.ok(Math.abs(r.sharedTrenchKm - r.separateTrenchKm) < 1e-6);
  assert.strictEqual(r.overlapAssumption, '',
    'بلا دمج لا افتراض تداخل — لا يُعلن افتراض لا يُستعمل');
});

test('digOnce() reports zero money and names who owns the cost input', () => {
  /* الفحص الحارس: أي عودة لرقم مالي داخل المحرك تسقط هنا. */
  const r = MasarEngine.digOnce({ trenchKm: 4.2, permitsMerged: 3 });
  Object.keys(r).forEach((key) => {
    assert.ok(!/SAR|ريال/i.test(key), `digOnce أعاد حقلاً مالياً: ${key}`);
  });
  assert.ok(/كلفة الخندق لدى الأمانة/.test(r.costNote),
    'costNote لا يسمّي من يملك مُدخل الكلفة');
  assert.strictEqual(MasarEngine.DEFAULTS.trenchCostPerKmSAR, undefined,
    'كلفة الخندق الافتراضية عادت إلى DEFAULTS');
  assert.deepStrictEqual(MasarEngine.assumptionsUsed('digOnce'), [],
    'digOnce صار بلا افتراضات توضيحية — القائمة يجب أن تكون فارغة');
});

// ---------------------------------------------------------------------------
// compound()
// ---------------------------------------------------------------------------

test('compound() combines two scores with factor 1.3', () => {
  const a = MasarEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 2, capacityPerLane: 1800,
    freeFlowMin: 6, lengthKm: 4.2, startHour: 8, durationHours: 4,
  });
  const b = MasarEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 1, capacityPerLane: 1800,
    freeFlowMin: 6, lengthKm: 4.2, startHour: 8, durationHours: 4,
  });
  const r = MasarEngine.compound(a, b);
  assert.strictEqual(r.factor, 1.3);
  assert.ok(Math.abs(r.combined - (a.delayVehHours + b.delayVehHours) * 1.3) < 1e-9);
});

test('compound() emits warning string when combined level becomes high', () => {
  const a = MasarEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 3, capacityPerLane: 1800,
    freeFlowMin: 6, lengthKm: 4.2, startHour: 8, durationHours: 4,
  });
  const b = MasarEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 3, capacityPerLane: 1800,
    freeFlowMin: 6, lengthKm: 4.2, startHour: 8, durationHours: 4,
  });
  const r = MasarEngine.compound(a, b);
  assert.strictEqual(typeof r.warning, 'string');
  assert.ok(r.warning.length > 0);
});

test('compound() warning empty string when combined level stays low', () => {
  const a = MasarEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 0, capacityPerLane: 1800,
    freeFlowMin: 6, lengthKm: 4.2, startHour: 8, durationHours: 4,
  });
  const b = MasarEngine.score({
    aadt: 85000, lanes: 4, lanesClosed: 0, capacityPerLane: 1800,
    freeFlowMin: 6, lengthKm: 4.2, startHour: 8, durationHours: 4,
  });
  const r = MasarEngine.compound(a, b);
  assert.strictEqual(r.warning, '');
});

// ---------------------------------------------------------------------------
// backTest()
// ---------------------------------------------------------------------------

test('backTest() reports before/after vehicle-hours consistent with score/chosen', () => {
  const input = {
    aadt: 85000,
    lanes: 4,
    lanesClosed: 2,
    capacityPerLane: 1800,
    freeFlowMin: 6,
    lengthKm: 4.2,
    startHour: 8,
    durationHours: 4,
  };
  const opt = MasarEngine.optimize(input);
  const chosen = opt.top3[0];
  const bt = MasarEngine.backTest(input, chosen);
  const expectedBefore = MasarEngine.score(input).delayVehHours;
  assert.ok(Math.abs(bt.beforeVehHours - expectedBefore) < 1e-9);
  assert.ok(Math.abs(bt.afterVehHours - chosen.delayVehHours) < 1e-9);
  assert.ok(bt.afterVehHours <= bt.beforeVehHours);
});

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
  assert.ok(Math.abs(r.lowSAR - 1740) < 1e-9, `lowSAR was ${r.lowSAR}`);
  assert.ok(Math.abs(r.highSAR - 4060) < 1e-9, `highSAR was ${r.highSAR}`);
  assert.strictEqual(r.shareLow, 0.4);
  assert.strictEqual(r.shareHigh, 0.7);
});

test('timeValueSAR of zero person-hours => zero SAR range', () => {
  const r = MasarEngine.timeValueSAR(MasarEngine.personHours(0));
  assert.strictEqual(r.lowSAR, 0);
  assert.strictEqual(r.highSAR, 0);
});

// ---------------------------------------------------------------------------
// co2Range + transitImpact (Task 4)
// ---------------------------------------------------------------------------

test('co2Range(100) => fuel 70-110 L, co2 161.7-254.1 kg', () => {
  const r = MasarEngine.co2Range(100);
  assert.ok(Math.abs(r.lowFuelL - 70) < 1e-9, `lowFuelL was ${r.lowFuelL}`);
  assert.ok(Math.abs(r.highFuelL - 110) < 1e-9, `highFuelL was ${r.highFuelL}`);
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

test('wzdx emits one closure feature per selected schedule window', () => {
  const windows = [
    { dayOffset: 0, startHour: 22, durationHours: 8 },
    { dayOffset: 1, startHour: 22, durationHours: 2 },
  ];
  const fc = MasarEngine.wzdx({
    id: 'masar-demo-windowed',
    roadName: 'طريق الملك فهد',
    direction: 'northbound',
    lanes: 4,
    lanesClosed: 2,
    startISO: '2026-07-27T22:00:00Z',
    windows,
    coordinates: [[46.675, 24.700], [46.680, 24.735]],
  });
  assert.strictEqual(fc.features.length, windows.length);
  /* WP-WZ1 — كان هنا فحصان على `dayOffset` و`durationHours` داخل
     `properties`. الحقلان ليسا من مواصفة WZDx، وبقاؤهما كان يمنع الحدث من
     مطابقة فرع المخطط. الخاصية المقصودة — نافذة لكل ليلة بمدّتها — تبقى
     مفحوصة أدناه من `start_date` و`end_date`، وهما المصدر الحاكم أصلاً. */
  assert.deepStrictEqual(
    fc.features.map((feature) => (
      (Date.parse(feature.properties.end_date)
        - Date.parse(feature.properties.start_date)) / 3600000
    )),
    [8, 2]
  );
  assert.deepStrictEqual(
    fc.features.map((feature) => feature.properties.start_date),
    ['2026-07-27T22:00:00.000Z', '2026-07-28T22:00:00.000Z']
  );
  assert.deepStrictEqual(
    fc.features.map((feature) => feature.properties.end_date),
    ['2026-07-28T06:00:00.000Z', '2026-07-29T00:00:00.000Z']
  );
  /* مجموع الساعات المصدَّرة يساوي المطلوب — مشتقاً من التواريخ لا من حقل
     غير معياري. الخاصية هي نفسها: لا ساعة تُفقد ولا تُضاف في التصدير. */
  const exportedHours = fc.features.reduce((sum, feature) => (
    sum + (Date.parse(feature.properties.end_date)
      - Date.parse(feature.properties.start_date)) / 3600000
  ), 0);
  assert.strictEqual(exportedHours, 10);
});

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

console.log(`ALL TESTS PASSED (${count})`);
