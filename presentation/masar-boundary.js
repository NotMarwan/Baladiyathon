(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = value;
  } else {
    root.MasarBoundary = value;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Derive an impact radius from geometry, demand/capacity, and lost capacity.
   * Every term is visible in the returned component list; there is no tuned
   * distance multiplier.
   *
   * @param {object} input
   * @returns {object}
   */
  function calculate(input) {
    const baseRadiusMeters = input.workLengthMeters / 2;
    const fullCapacity = input.totalLanes * input.capacityPerLane;
    const demandRatio = input.hourlyVolume / fullCapacity;
    const residualCapacityRatio =
      Math.max(0, input.totalLanes - input.lanesClosed) / input.totalLanes;
    const demandExpansion = baseRadiusMeters * demandRatio;
    const closureExpansion = baseRadiusMeters * (1 - residualCapacityRatio);
    const components = [
      {
        id: 'geometry',
        label: 'هندسة منطقة العمل',
        meters: baseRadiusMeters,
        source: 'workLengthMeters / 2',
      },
      {
        id: 'demand',
        label: 'تمدد الطلب نسبةً إلى السعة',
        meters: demandExpansion,
        source: 'baseRadiusMeters × hourlyVolume / fullCapacity',
      },
      {
        id: 'closure',
        label: 'تمدد فقد السعة',
        meters: closureExpansion,
        source: 'baseRadiusMeters × closedLaneShare',
      },
    ];

    return {
      radiusMeters: Math.round(
        components.reduce((sum, component) => sum + component.meters, 0)
      ),
      baseRadiusMeters,
      demandRatio,
      residualCapacityRatio,
      components,
      method: 'base × (1 + demand/capacity + closed-lane share)',
      provenance: input.provenance,
    };
  }

  return { calculate };
});
