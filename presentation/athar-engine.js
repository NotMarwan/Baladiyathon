/**
 * AtharEngine — pure computation core for the "Athar" (أثر) road-works impact
 * prototype. No DOM, no fetch, no Date.now() dependencies in the math.
 * Shared verbatim by the browser UI, the Node test suite, and the Node
 * stdlib backend server.
 *
 * UMD export: `window.AtharEngine` in the browser, `module.exports` in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------

  // Typical urban weekday traffic distribution (fractions of daily AADT per
  // hour, 24 values summing to 1.0). AM peak ~7-9, PM peak ~16-19.
  // افتراض توضيحي للعرض (illustrative demo assumption — shape only, not a
  // measured KSA count).
  const HOURLY_PROFILE = [
    0.010, 0.007, 0.005, 0.005, 0.007, 0.015, // 0-5
    0.035, 0.070, 0.080, 0.060, 0.045, 0.045, // 6-11
    0.048, 0.045, 0.045, 0.048, 0.058, 0.075, // 12-17
    0.090, 0.070, 0.050, 0.038, 0.028, 0.021, // 18-23
  ]; // per-mille integers / 1000, sums exactly to 1.000; shape only — افتراض توضيحي للعرض

  const DEFAULTS = {
    aadt: 85000, // افتراض توضيحي للعرض — illustrative demo AADT for the King Fahd Rd (Olaya) segment; real AADT unverifiable (see Out of Scope)
    lanes: 4, // افتراض توضيحي للعرض — typical arterial lane count for the demo corridor
    capacityPerLane: 1800, // veh/hr/lane — standard HCM-style saturation flow assumption, افتراض توضيحي للعرض
    freeFlowMin: 6, // minutes — free-flow travel time across the demo segment length, افتراض توضيحي للعرض
    lengthKm: 4.2, // km — approximate King Fahd Rd (Olaya) demo segment length, افتراض توضيحي للعرض
    valueOfTimeSAR: 45, // SAR/veh-hour — افتراض توضيحي للعرض (demo value-of-time for narrative use only)
    idleFuelLPerHour: 0.9, // L/vehicle-hour idling — افتراض توضيحي للعرض, order-of-magnitude idle consumption
    co2KgPerL: 2.31, // kg CO2 per liter gasoline — standard emissions factor, see sciencedirect.com/org/science/article/pii/S1556831824000285 (Sources Ledger #10)
    trenchCostPerKmSAR: 850000, // SAR/km trenching cost — افتراض توضيحي للعرض, order-of-magnitude figure for narrative use
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
  };

  // GAO dig-once savings band for dense urban areas (Sources Ledger #7):
  // sharing a trench across merged permits saves 25-33% of the separate-dig
  // cost. Reported as a range, verbatim from the source — no reverse
  // calibration to a target test value.
  const DIG_ONCE_SAVED_FRACTION_LOW = 0.25;
  const DIG_ONCE_SAVED_FRACTION_HIGH = 0.33;

  // Parallel-corridor superposition factor used by compound(): when two
  // nearby permits are active at once, their combined delay is modelled as
  // slightly worse than the arithmetic sum (interaction effects).
  // افتراض توضيحي للعرض (demo assumption).
  const COMPOUND_FACTOR = 1.3;

  // Normalization constant for score(): score = 100 * delayVehHours / (aadt * SCORE_CALIBRATION)
  // افتراض توضيحي للعرض (demo calibration constant, not sourced).
  // مُصمَّم لإعادة المعايرة الدورية من نتائج back-test المسجّلة (ساعات-مركبة
  // مقيسة قبل/بعد لكل تصريح منفَّذ).
  const SCORE_CALIBRATION = 0.35;

  // Minimum capacity floor fraction applied when lanesClosed >= lanes, so the
  // BPR function never divides by (near) zero. افتراض توضيحي للعرض.
  const MIN_CAPACITY_FRACTION = 0.25;

  // Work-zone friction: lane shifts, tapers and merges slow traffic through an
  // active closure even when demand is far below capacity (e.g. empty night
  // hours). Modeled as a floor: the closed travel time is at least 10% above
  // free-flow-hour baseline. This stops the BPR^4 term from collapsing night
  // delay to ~0, which otherwise produced a physically impossible ~99.6%
  // "saving" that contradicts the cited −11.1% scheduling study (Ledger #5).
  // افتراض توضيحي للعرض.
  const WORK_ZONE_FRICTION = 1.10;

  // Candidate scheduling grid used by optimize().
  const CANDIDATE_START_HOURS = [22, 23, 0, 8, 10, 13];
  const CANDIDATE_PHASES = [1, 2];

  // Standard nightly work-window length (hours) used to model phases=2
  // candidates as real-world night-work schedules: the road stays open to
  // traffic during the day and the closure is only active for a short
  // window each night, repeated over multiple nights until the requested
  // total durationHours is completed. افتراض توضيحي — نافذة عمل ليلية قياسية.
  const WORK_WINDOW_HOURS = 8;

  // ---------------------------------------------------------------------
  // Core math
  // ---------------------------------------------------------------------

  /**
   * Split requested work into explicit nightly closure windows without
   * rounding a partial final night up to a full window.
   * @param {number} startHour integer clock hour, 0..23
   * @param {number} durationHours positive finite work duration
   * @param {number} maxNightHours positive finite maximum per night
   * @returns {Array<{dayOffset:number,startHour:number,durationHours:number}>}
   */
  function buildNightWindows(startHour, durationHours, maxNightHours) {
    if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
      throw new RangeError('startHour must be an integer between 0 and 23');
    }
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      throw new RangeError('durationHours must be a positive finite number');
    }
    if (!Number.isFinite(maxNightHours) || maxNightHours <= 0 || maxNightHours > 24) {
      throw new RangeError('maxNightHours must be a positive finite number up to 24');
    }

    const windows = [];
    let remaining = durationHours;
    let dayOffset = 0;
    while (remaining > 0) {
      const duration = Math.min(maxNightHours, remaining);
      windows.push({ dayOffset, startHour, durationHours: duration });
      remaining -= duration;
      dayOffset += 1;
    }
    return windows;
  }

  /**
   * Standard BPR (Bureau of Public Roads) volume-delay function.
   * t = t0 * (1 + 0.15 * (v/c)^4)
   * @param {number} freeFlowMin - free-flow travel time (minutes)
   * @param {number} volume - demand volume (veh/hr)
   * @param {number} capacity - available capacity (veh/hr)
   * @returns {number} travel time in minutes
   */
  function bprTravelTime(freeFlowMin, volume, capacity) {
    const safeCapacity = capacity > 0 ? capacity : 1e-9;
    const ratio = volume / safeCapacity;
    return freeFlowMin * (1 + 0.15 * Math.pow(ratio, 4));
  }

  /**
   * Score the traffic impact of a lane closure over its duration.
   * @param {object} input
   * @returns {{delayVehHours:number, score:number, level:string, hourly:Array}}
   */
  function score(input) {
    const {
      aadt,
      lanes,
      lanesClosed,
      capacityPerLane,
      freeFlowMin,
      startHour,
      durationHours,
    } = input;

    const fullCapacity = lanes * capacityPerLane;
    const minCapacity = MIN_CAPACITY_FRACTION * capacityPerLane;
    const openLanes = Math.max(0, lanes - lanesClosed);
    const closedCapacityRaw = openLanes * capacityPerLane;
    const closedCapacity = Math.max(closedCapacityRaw, minCapacity);

    let delayVehHours = 0;
    const hourly = [];

    for (let elapsed = 0; elapsed < durationHours;) {
      const hourOffset = Math.floor(elapsed);
      const segmentDuration = Math.min(1, durationHours - elapsed);
      const hour = (startHour + hourOffset) % 24;
      const demand = aadt * HOURLY_PROFILE[hour];

      const baseT = bprTravelTime(freeFlowMin, demand, fullCapacity);
      const closedT = lanesClosed > 0
        ? Math.max(
            bprTravelTime(freeFlowMin, demand, closedCapacity),
            baseT * WORK_ZONE_FRICTION,
          )
        : baseT;

      const fullHourDelayVehHours = lanesClosed > 0
        ? (demand * (closedT - baseT)) / 60
        : 0;
      const hourDelayVehHours = fullHourDelayVehHours * segmentDuration;

      delayVehHours += hourDelayVehHours;
      hourly.push({
        hour,
        durationHours: segmentDuration,
        demand,
        baseT,
        closedT,
        delayVehHours: hourDelayVehHours,
      });
      elapsed += segmentDuration;
    }

    const rawScore = (100 * delayVehHours) / (aadt * SCORE_CALIBRATION);
    const clampedScore = Math.min(100, Math.round(rawScore));
    const finalScore = lanesClosed > 0 ? clampedScore : 0;

    let level;
    if (finalScore < 25) level = 'low';
    else if (finalScore < 60) level = 'medium';
    else level = 'high';

    return {
      delayVehHours,
      score: finalScore,
      level,
      hourly,
    };
  }

  /**
   * Find the best scheduling windows for a planned closure.
   * @param {object} input - same shape as score(), startHour/durationHours are the requested baseline.
   * @returns {{top3: Array, baseline: {delayVehHours:number}}}
   */
  function optimize(input) {
    const totalDuration = input.durationHours;
    const baselineWindows = buildNightWindows(
      input.startHour,
      totalDuration,
      WORK_WINDOW_HOURS
    );
    const baselineResult = scoreWindows(input, baselineWindows);

    const candidates = [];
    const scheduleSignatures = new Set();

    function addCandidate(startHour, phases, windows) {
      const signature = JSON.stringify(windows);
      if (scheduleSignatures.has(signature)) return;
      scheduleSignatures.add(signature);
      candidates.push({
        startHour,
        phases,
        windows,
        delayVehHours: scoreWindows(input, windows).delayVehHours,
      });
    }

    CANDIDATE_START_HOURS.forEach((startHour) => {
      CANDIDATE_PHASES.forEach((phases) => {
        if (phases === 1) {
          // Continuous block starting at the candidate's clock hour — the
          // closure runs uninterrupted for the full requested duration.
          addCandidate(startHour, phases, [{
            dayOffset: 0,
            startHour,
            durationHours: totalDuration,
          }]);
          return;
        }

        // phases === 2: windowed work schedule. Each actual window is scored
        // independently, so the open daytime gap is never counted as closure.
        addCandidate(
          startHour,
          phases,
          buildNightWindows(startHour, totalDuration, WORK_WINDOW_HOURS)
        );
      });
    });

    candidates.sort((a, b) => {
      if (a.delayVehHours !== b.delayVehHours) return a.delayVehHours - b.delayVehHours;
      return a.phases - b.phases; // ties broken toward fewer phases (simpler execution)
    });

    const top3 = candidates.slice(0, 3).map((candidate) => {
      const savedVehHours = Math.max(0, baselineResult.delayVehHours - candidate.delayVehHours);
      const savedPct = baselineResult.delayVehHours > 0
        ? (savedVehHours / baselineResult.delayVehHours) * 100
        : 0;

      const reasons = buildReasons(input, candidate, baselineResult);

      return {
        label: formatLabel(candidate.startHour, candidate.phases, candidate.windows),
        startHour: candidate.startHour,
        phases: candidate.phases,
        windows: candidate.windows.map((window) => ({ ...window })),
        delayVehHours: candidate.delayVehHours,
        savedVehHours,
        savedPct,
        reasons,
      };
    });

    return {
      top3,
      baseline: {
        delayVehHours: baselineResult.delayVehHours,
        windows: baselineWindows.map((window) => ({ ...window })),
      },
    };
  }

  function scoreWindows(input, windows) {
    return {
      delayVehHours: windows.reduce((sum, window) => {
        const result = score({
          ...input,
          startHour: window.startHour,
          durationHours: window.durationHours,
        });
        return sum + result.delayVehHours;
      }, 0),
    };
  }

  function formatLabel(startHour, phases, windows) {
    const hourLabel = String(startHour).padStart(2, '0') + ':00';
    if (phases === 1 || windows.length <= 1) {
      return `كتلة متواصلة تبدأ ${hourLabel}`;
    }
    const durations = windows.map((window) => window.durationHours).join(' + ');
    return `عمل ليلي على ${windows.length} ليالٍ (${durations} س، تبدأ ${hourLabel})`;
  }

  function buildReasons(input, candidate, baselineResult) {
    const reasons = [];

    const candidateDemandFraction = HOURLY_PROFILE[candidate.startHour % 24];
    const baselineDemandFraction = HOURLY_PROFILE[input.startHour % 24];
    if (baselineDemandFraction > 0) {
      const reductionPct = Math.round(
        (1 - candidateDemandFraction / baselineDemandFraction) * 100
      );
      if (reductionPct > 0) {
        reasons.push(`نافذة خارج الذروة (الطلب أقل بـ${reductionPct}%)`);
      } else {
        reasons.push('نافذة زمنية بطلب مروري مماثل أو أعلى');
      }
    } else {
      reasons.push('نافذة خارج ساعات الذروة المعروفة');
    }

    const isWindowed = candidate.phases === 2 && candidate.windows.length > 1;
    if (isWindowed) {
      reasons.push('الطريق مفتوح بالكامل خارج نافذة العمل الليلية');
    } else if (candidate.phases === 2) {
      reasons.push('تقسيم على مرحلتين يخفض ذروة التأثير لكل ليلة');
    } else {
      reasons.push('تنفيذ في مرحلة واحدة يبسّط التنسيق الميداني');
    }

    const isMorningPeakAvoided = candidate.startHour < 7 || candidate.startHour >= 9;
    if (isMorningPeakAvoided) {
      reasons.push('تفادي ذروة الصباح 7-9');
    } else {
      reasons.push('يتقاطع جزئيًا مع ذروة الصباح 7-9');
    }

    return reasons;
  }

  /**
   * Convert saved vehicle-hours into idle fuel burn and CO2 emissions.
   * @param {number} savedVehHours
   * @returns {{fuelL:number, co2Kg:number}}
   */
  function co2(savedVehHours) {
    const fuelL = savedVehHours * DEFAULTS.idleFuelLPerHour;
    const co2Kg = fuelL * DEFAULTS.co2KgPerL;
    return { fuelL, co2Kg };
  }

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

  /**
   * Compare trenching cost for separately-dug vs. shared (dig-once) permits.
   * Savings reported as the GAO 25-33% band (Sources Ledger #7). Single
   * permit => no merge => zero saving.
   * @param {{trenchKm:number, permitsMerged:number}} input
   * @returns {{separateSAR:number, sharedLowSAR:number, sharedHighSAR:number,
   *            savedLowSAR:number, savedHighSAR:number, savedPctLow:number,
   *            savedPctHigh:number}}
   */
  function digOnce(input) {
    const { trenchKm, permitsMerged } = input;
    const cost = DEFAULTS.trenchCostPerKmSAR;
    const separateSAR = permitsMerged * trenchKm * cost;

    if (permitsMerged <= 1) {
      return {
        separateSAR,
        sharedLowSAR: separateSAR,
        sharedHighSAR: separateSAR,
        savedLowSAR: 0,
        savedHighSAR: 0,
        savedPctLow: 0,
        savedPctHigh: 0,
      };
    }

    const savedLowSAR = separateSAR * DIG_ONCE_SAVED_FRACTION_LOW;
    const savedHighSAR = separateSAR * DIG_ONCE_SAVED_FRACTION_HIGH;
    return {
      separateSAR,
      sharedLowSAR: separateSAR - savedHighSAR,
      sharedHighSAR: separateSAR - savedLowSAR,
      savedLowSAR,
      savedHighSAR,
      savedPctLow: DIG_ONCE_SAVED_FRACTION_LOW * 100,
      savedPctHigh: DIG_ONCE_SAVED_FRACTION_HIGH * 100,
    };
  }

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
    const baseStart = new Date(input.startISO);
    const windows = Array.isArray(input.windows) && input.windows.length > 0
      ? input.windows
      : [{
          dayOffset: 0,
          startHour: baseStart.getUTCHours(),
          durationHours: input.durationHours,
        }];

    let vehicleImpact;
    if (input.lanesClosed <= 0) vehicleImpact = 'all-lanes-open';
    else if (input.lanesClosed >= input.lanes) vehicleImpact = 'all-lanes-closed';
    else vehicleImpact = 'some-lanes-closed';

    return {
      type: 'FeatureCollection',
      features: windows.map((window, index) => {
        const start = new Date(baseStart.getTime());
        start.setUTCDate(baseStart.getUTCDate() + window.dayOffset);
        start.setUTCHours(window.startHour, 0, 0, 0);
        const end = new Date(start.getTime() + window.durationHours * 3600 * 1000);
        return {
          type: 'Feature',
          id: windows.length === 1 ? input.id : `${input.id}-window-${index + 1}`,
          geometry: {
            type: 'LineString',
            coordinates: input.coordinates,
          },
          properties: {
            core_details: {
              event_type: 'work-zone',
              // The producing surface names itself. A file exported from the
              // reviewer desk that identifies as the prototype misattributes
              // its own provenance in a format built for exchange.
              data_source_id: input.dataSourceId || 'athar-prototype',
              road_names: [input.roadName],
              direction: input.direction,
            },
            start_date: start.toISOString(),
            end_date: end.toISOString(),
            dayOffset: window.dayOffset,
            durationHours: window.durationHours,
            vehicle_impact: vehicleImpact,
            location_method: 'other',
            start_date_accuracy: 'estimated',
            end_date_accuracy: 'estimated',
          },
        };
      }),
    };
  }

  /**
   * Superpose two nearby active permits' impact.
   * @param {{delayVehHours:number, score:number, level:string}} scoreA
   * @param {{delayVehHours:number, score:number, level:string}} scoreB
   * @returns {{combined:number, factor:number, warning:string}}
   */
  function compound(scoreA, scoreB) {
    const factor = COMPOUND_FACTOR;
    const combined = (scoreA.delayVehHours + scoreB.delayVehHours) * factor;

    const combinedAadtRef = Math.max(
      scoreA.delayVehHours > 0 ? scoreA.delayVehHours : 0,
      scoreB.delayVehHours > 0 ? scoreB.delayVehHours : 0
    );
    // Reuse the same level thresholds as score() by approximating a combined
    // score proportionally (both scores were computed against the same aadt
    // scale, so we compare against the worse of the two normalized scores
    // scaled by the compounding factor).
    const worseScore = Math.max(scoreA.score, scoreB.score);
    const combinedScoreEstimate = Math.min(100, Math.round(worseScore * factor));
    const combinedLevel = combinedScoreEstimate < 25
      ? 'low'
      : combinedScoreEstimate < 60
        ? 'medium'
        : 'high';

    const warning = combinedLevel === 'high'
      ? 'تنبيه: التأثير المركّب لتصريحين متجاورين يرفع مستوى الخطورة إلى "مرتفع"'
      : '';

    void combinedAadtRef; // reserved for future refinement, kept pure/no side effects

    return { combined, factor, warning };
  }

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

  // Which unofficial demo assumptions feed each headline number. Used by the
  // UI to print "عدد الافتراضات في هذا الرقم: N" on the card itself, turning
  // assumption stacking into visible transparency instead of a hidden weakness.
  const METRIC_ASSUMPTIONS = {
    score: ['aadt', 'HOURLY_PROFILE', 'lanes', 'capacityPerLane', 'freeFlowMin', 'WORK_ZONE_FRICTION'],
    timeValueSAR: ['aadt', 'HOURLY_PROFILE', 'lanes', 'capacityPerLane', 'freeFlowMin', 'occupancyBand', 'workHoursPerMonth'],
    co2: ['aadt', 'HOURLY_PROFILE', 'lanes', 'capacityPerLane', 'freeFlowMin', 'idleFuelLPerHour'],
    digOnce: ['trenchCostPerKmSAR', 'trenchKm'],
    transitImpact: ['busRoutesOnSegment', 'busesPerHourPerRoute', 'ridersPerBus'],
  };

  /**
   * List the unofficial demo assumptions a given headline metric depends on.
   * @param {string} metric one of score|timeValueSAR|co2|digOnce|transitImpact
   * @returns {string[]|null} copy of the assumption names, or null if unknown
   */
  function assumptionsUsed(metric) {
    return Object.prototype.hasOwnProperty.call(METRIC_ASSUMPTIONS, metric)
      ? METRIC_ASSUMPTIONS[metric].slice()
      : null;
  }

  /**
   * Compare the requested schedule's delay against a chosen optimized schedule.
   * @param {object} input - same shape as score(), at the originally requested startHour/durationHours.
   * @param {{delayVehHours:number}} chosen - a candidate from optimize().top3
   * @returns {{beforeVehHours:number, afterVehHours:number}}
   */
  function backTest(input, chosen) {
    const before = scoreWindows(
      input,
      buildNightWindows(input.startHour, input.durationHours, WORK_WINDOW_HOURS)
    );
    return {
      beforeVehHours: before.delayVehHours,
      afterVehHours: chosen.delayVehHours,
    };
  }

  return {
    HOURLY_PROFILE,
    DEFAULTS,
    WORK_WINDOW_HOURS,
    buildNightWindows,
    // ثوابت المعايرة غير المصدرية — مُصدَّرة كي يعرضها جدول الشفافية في الواجهة
    CALIBRATION: {
      SCORE_CALIBRATION,
      WORK_ZONE_FRICTION,
      COMPOUND_FACTOR,
      MIN_CAPACITY_FRACTION,
    },
    bprTravelTime,
    score,
    optimize,
    co2,
    personHours,
    timeValueSAR,
    co2Range,
    transitImpact,
    wzdx,
    predictionError,
    digOnce,
    compound,
    backTest,
    assumptionsUsed,
  };
});
