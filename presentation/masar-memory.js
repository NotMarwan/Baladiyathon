(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = value;
  } else {
    root.MasarMemory = value;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function errorPct(predicted, observed) {
    if (predicted === 0) {
      return observed === 0 ? 0 : 100;
    }
    return (Math.abs(observed - predicted) / Math.abs(predicted)) * 100;
  }

  function verdict(error, threshold) {
    return error <= threshold ? 'success' : 'failure';
  }

  /**
   * Recalculate one transparent multiplicative correction from the portfolio's
   * observed/predicted totals. Record-level outcomes stay visible, including
   * cases the aggregate correction makes worse.
   */
  function calibrate(records, options) {
    const predictedTotal = records.reduce(
      (sum, record) => sum + record.predictedVehHours,
      0
    );
    const observedTotal = records.reduce(
      (sum, record) => sum + record.observedVehHours,
      0
    );
    const correctionFactor =
      predictedTotal > 0 ? observedTotal / predictedTotal : 1;

    const evaluated = records.map((record) => {
      const beforeErrorPct = errorPct(
        record.predictedVehHours,
        record.observedVehHours
      );
      const correctedPrediction =
        record.predictedVehHours * correctionFactor;
      const afterErrorPct = errorPct(
        correctedPrediction,
        record.observedVehHours
      );

      return {
        ...record,
        beforeErrorPct,
        correctedPrediction,
        afterErrorPct,
        beforeVerdict: verdict(
          beforeErrorPct,
          options.successThresholdPct
        ),
        afterVerdict: verdict(afterErrorPct, options.successThresholdPct),
        changePctPoints: afterErrorPct - beforeErrorPct,
      };
    });

    const average = (key) =>
      evaluated.reduce((sum, record) => sum + record[key], 0) /
      evaluated.length;
    const countVerdicts = (key) => ({
      success: evaluated.filter((record) => record[key] === 'success').length,
      failure: evaluated.filter((record) => record[key] === 'failure').length,
    });

    return {
      records: evaluated,
      correctionFactor,
      predictedTotal,
      observedTotal,
      beforeMapePct: average('beforeErrorPct'),
      afterMapePct: average('afterErrorPct'),
      casesImproved: evaluated.filter(
        (record) => record.afterErrorPct < record.beforeErrorPct
      ).length,
      casesWorsened: evaluated.filter(
        (record) => record.afterErrorPct > record.beforeErrorPct
      ).length,
      casesUnchanged: evaluated.filter(
        (record) => record.afterErrorPct === record.beforeErrorPct
      ).length,
      verdictCounts: {
        before: countVerdicts('beforeVerdict'),
        after: countVerdicts('afterVerdict'),
      },
      successThresholdPct: options.successThresholdPct,
      method: 'sum(observedVehHours) / sum(predictedVehHours)',
      provenance: options.provenance,
    };
  }

  return {
    calibrate,
    errorPct,
  };
});
