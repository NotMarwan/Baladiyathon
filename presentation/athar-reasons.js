(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = value;
  } else {
    root.AtharReasons = value;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FACTORS = [
    {
      id: 'demand',
      key: 'demandVehPerHour',
      label: 'انخفاض الطلب',
      unit: 'مركبة/ساعة',
    },
    {
      id: 'queue',
      key: 'queueVehHours',
      label: 'انخفاض الطابور',
      unit: 'ساعة-مركبة',
    },
    {
      id: 'bus',
      key: 'busPersonHours',
      label: 'انخفاض أثر الحافلات',
      unit: 'ساعة-شخص',
    },
    {
      id: 'conflicts',
      key: 'corridorConflicts',
      label: 'انخفاض تعارضات المحور',
      unit: 'تعارض',
    },
  ];

  /**
   * Rank candidates using self-normalized measured improvements. Each factor's
   * score is the candidate improvement divided by that factor's observed range
   * across the candidate set, so no hidden fixed factor weights are introduced.
   */
  function explain(baseline, candidates, provenance) {
    const ranges = {};

    FACTORS.forEach((factor) => {
      const values = candidates.map((candidate) => candidate[factor.key]);
      ranges[factor.key] = Math.max(...values) - Math.min(...values);
    });

    const ranked = candidates
      .map((candidate) => {
        const factors = FACTORS.map((factor) => {
          const baselineValue = baseline[factor.key];
          const candidateValue = candidate[factor.key];
          const delta = baselineValue - candidateValue;
          const range = ranges[factor.key];

          return {
            id: factor.id,
            label: factor.label,
            baseline: baselineValue,
            candidate: candidateValue,
            delta,
            deltaPct:
              baselineValue !== 0 ? (delta / baselineValue) * 100 : 0,
            unit: factor.unit,
            points: range > 0 ? delta / range : 0,
            normalizationRange: range,
          };
        });
        const totalPoints = factors.reduce(
          (sum, factor) => sum + factor.points,
          0
        );

        factors.forEach((factor) => {
          factor.weightPct =
            totalPoints !== 0 ? (factor.points / totalPoints) * 100 : 0;
        });

        return {
          ...candidate,
          factors,
          totalPoints,
        };
      })
      .sort(
        (a, b) =>
          b.totalPoints - a.totalPoints || String(a.id).localeCompare(String(b.id))
      );

    ranked.forEach((candidate, index) => {
      candidate.rank = index + 1;
    });

    return {
      ranked,
      method:
        'Each measured improvement is divided by its candidate-set range; no fixed factor weights.',
      provenance,
    };
  }

  return {
    explain,
    FACTORS,
  };
});
