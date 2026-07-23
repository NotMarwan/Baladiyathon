/**
 * AtharImpactCalibration — a real, persistable back-test log that turns the
 * "improves with every permit" claim into an actual mechanism instead of a
 * text promise. Each executed permit records predicted vs. observed
 * vehicle-hours; the correction factor is the MEDIAN of observed/predicted
 * ratios across the log, and is re-derived from the log every call.
 *
 * Pure and store-injected: pass localStorage in the browser, or a Map-backed
 * stub in tests. No Date.now(), no globals.
 *
 * UMD export: `window.AtharImpactCalibration` in the browser,
 * `module.exports` in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharImpactCalibration = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'athar-backtests-v1';

  function median(sortedAsc) {
    const n = sortedAsc.length;
    if (n === 0) return 1;
    const mid = Math.floor(n / 2);
    return n % 2 === 1
      ? sortedAsc[mid]
      : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
  }

  /**
   * @param {{getItem:(k:string)=>(string|null), setItem:(k:string,v:string)=>void}} store
   */
  function createCalibration(store) {
    function readAll() {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }

    function records() {
      return readAll().slice();
    }

    /**
     * @param {{permitId:string, predictedVehHours:number, observedVehHours:number}} entry
     * @returns {boolean} true if recorded, false if rejected (invalid prediction)
     */
    function record(entry) {
      if (!entry || !(entry.predictedVehHours > 0)) return false;
      const all = readAll();
      all.push({
        permitId: String(entry.permitId),
        predictedVehHours: entry.predictedVehHours,
        observedVehHours: entry.observedVehHours,
      });
      store.setItem(STORAGE_KEY, JSON.stringify(all));
      return true;
    }

    /**
     * Median observed/predicted ratio across the log. 1 when the log is empty.
     * @returns {number}
     */
    function correctionFactor() {
      const ratios = readAll()
        .filter(function (r) { return r.predictedVehHours > 0; })
        .map(function (r) { return r.observedVehHours / r.predictedVehHours; })
        .sort(function (a, b) { return a - b; });
      return median(ratios);
    }

    function status() {
      return { n: readAll().length, factor: correctionFactor() };
    }

    return { record, records, correctionFactor, status };
  }

  return { createCalibration, STORAGE_KEY };
});
