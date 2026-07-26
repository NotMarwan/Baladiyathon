/**
 * MasarForecast — honest congestion-forecast layer. Pure computation, no DOM.
 *
 * The forecast is a declared model, not a claim of live data:
 *   demand fraction = base weekday profile × day-of-week factor
 * Every forecast carries an uncertainty BAND. The band is wide while the model
 * runs on synthetic assumptions and narrows once real operator speed/volume
 * counts are loaded via calibrateFromCSV(). Everything synthetic is tagged
 * «افتراض توضيحي للعرض».
 *
 * UMD export: `window.MasarForecast` in the browser, `module.exports` in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarForecast = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Base weekday distribution (fraction of daily demand per hour, sums to 1).
  // افتراض توضيحي للعرض — shape only, not a measured KSA count.
  var BASE_PROFILE = [
    0.010, 0.007, 0.005, 0.005, 0.007, 0.015,
    0.035, 0.070, 0.080, 0.060, 0.045, 0.045,
    0.048, 0.045, 0.045, 0.048, 0.058, 0.075,
    0.090, 0.070, 0.050, 0.038, 0.028, 0.021
  ];

  // Day-of-week multipliers. KSA working week: Sun–Thu are workdays; the
  // weekend is Fri–Sat, with Friday the quietest morning. Index 0 = Sunday
  // ... 5 = Friday, 6 = Saturday. افتراض توضيحي للعرض.
  var DOW_FACTORS = [1.00, 1.03, 1.05, 1.04, 0.98, 0.70, 0.80];
  var DOW_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  // Relative half-width of the uncertainty band. Wide while uncalibrated,
  // narrow once real counts are loaded. افتراض توضيحي للعرض (demo constants).
  var BAND_UNCALIBRATED = 0.15;
  var BAND_CALIBRATED = 0.08;

  function clampHour(hour) { return ((Math.round(hour) % 24) + 24) % 24; }
  function clampDow(dow) { return ((Math.round(dow) % 7) + 7) % 7; }

  /**
   * Forecast the demand fraction for an hour + day-of-week, with a band.
   * @param {number} hour - 0..23
   * @param {number} dow - 0=Sun .. 6=Sat
   * @param {{profile?:Array<number>, calibrated?:boolean}} [opts]
   * @returns {{demandFraction:number, low:number, high:number, calibrated:boolean,
   *            dowName:string, dowFactor:number}}
   */
  function forecast(hour, dow, opts) {
    opts = opts || {};
    var h = clampHour(hour);
    var d = clampDow(dow);
    var profile = opts.profile || BASE_PROFILE;
    var calibrated = !!opts.calibrated;
    var factor = DOW_FACTORS[d];
    var mid = profile[h] * factor;
    var band = calibrated ? BAND_CALIBRATED : BAND_UNCALIBRATED;
    return {
      demandFraction: mid,
      low: mid * (1 - band),
      high: mid * (1 + band),
      calibrated: calibrated,
      dowName: DOW_NAMES[d],
      dowFactor: factor
    };
  }

  /**
   * Calibrate the profile from a CSV of real hourly counts.
   * Expected format: header line then 24 rows "hour,count" (hour 0..23).
   * @param {string} text
   * @returns {{profile:?Array<number>, sampleCount:number, errors:Array<string>}}
   */
  function calibrateFromCSV(text) {
    var errors = [];
    if (typeof text !== 'string' || text.trim() === '') {
      return { profile: null, sampleCount: 0, errors: ['ملف فارغ'] };
    }

    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    // Drop header if the first cell isn't numeric.
    if (lines.length && isNaN(parseFloat(lines[0].split(',')[0]))) {
      lines = lines.slice(1);
    }

    var counts = new Array(24);
    var seen = {};
    lines.forEach(function (line, idx) {
      var parts = line.split(',');
      var hour = parseInt(parts[0], 10);
      var count = parseFloat(parts[1]);
      if (isNaN(hour) || hour < 0 || hour > 23) {
        errors.push('السطر ' + (idx + 1) + ': ساعة غير صالحة "' + parts[0] + '"');
        return;
      }
      if (isNaN(count) || count < 0) {
        errors.push('السطر ' + (idx + 1) + ': عدد غير صالح "' + parts[1] + '"');
        return;
      }
      counts[hour] = count;
      seen[hour] = true;
    });

    var covered = Object.keys(seen).length;
    if (covered < 24) {
      errors.push('التغطية ناقصة: ' + covered + '/24 ساعة');
    }
    if (errors.length > 0) {
      return { profile: null, sampleCount: covered, errors: errors };
    }

    var total = counts.reduce(function (a, b) { return a + b; }, 0);
    if (total <= 0) {
      return { profile: null, sampleCount: covered, errors: ['مجموع الأعداد صفر'] };
    }
    var profile = counts.map(function (c) { return c / total; });
    return { profile: profile, sampleCount: covered, errors: [] };
  }

  /**
   * Build a 24×segments congestion-index grid for the heatmap. Congestion
   * index = normalized delay contribution per hour/segment, in [0,1], with a
   * band. Uses a closure to boost the affected corridor segments.
   * @param {number} dow
   * @param {?{edgeId:string, lanesClosed:number}} closure
   * @param {object} network - corridor-network.json
   * @param {{profile?:Array<number>, calibrated?:boolean}} [opts]
   * @returns {{segments:Array, hours:Array}}
   */
  function forecastGrid(dow, closure, network, opts) {
    opts = opts || {};
    var corridorEdges = network.corridorEdges;
    var edgeMeta = {};
    network.edges.forEach(function (e) { edgeMeta[e.id] = e; });

    var segments = corridorEdges.map(function (eid) {
      return { id: eid, name: edgeMeta[eid].name };
    });

    // Peak congestion reference for normalization: worst hour × worst-loaded
    // (fully-closed) segment. Keeps the index in [0,1].
    var maxFraction = 0;
    BASE_PROFILE.forEach(function (p) { if (p > maxFraction) maxFraction = p; });

    var hours = [];
    for (var h = 0; h < 24; h += 1) {
      var f = forecast(h, dow, opts);
      var cells = corridorEdges.map(function (eid) {
        var closureBoost = (closure && closure.edgeId === eid)
          ? 1 + 0.6 * (closure.lanesClosed / (edgeMeta[eid].lanes || 4))
          : 1;
        var raw = (f.demandFraction / maxFraction) * closureBoost;
        var mid = Math.max(0, Math.min(1, raw));
        var band = f.calibrated ? BAND_CALIBRATED : BAND_UNCALIBRATED;
        return {
          segId: eid,
          congestion: mid,
          low: Math.max(0, mid * (1 - band)),
          high: Math.min(1, mid * (1 + band))
        };
      });
      hours.push({ hour: h, dowName: f.dowName, cells: cells });
    }

    return { segments: segments, hours: hours };
  }

  return {
    BASE_PROFILE: BASE_PROFILE,
    DOW_FACTORS: DOW_FACTORS,
    DOW_NAMES: DOW_NAMES,
    forecast: forecast,
    calibrateFromCSV: calibrateFromCSV,
    forecastGrid: forecastGrid
  };
});
