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
        capacityPerLane: AtharEngine.DEFAULTS.capacityPerLane,
        freeFlowMin: AtharEngine.DEFAULTS.freeFlowMin,
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

    // دمج Dig-Once: نفس الممر + تقارب بدء ضمن 30 يوماً
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

  return {
    SEED,
    LABEL,
    CORRIDORS,
    mulberry32,
    buildPermits,
    buildPortfolio,
  };
});
