(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = value;
  } else {
    root.MasarConflict = value;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function overlapHours(a, b) {
    const overlapMilliseconds = Math.max(
      0,
      Math.min(new Date(a.end), new Date(b.end)) -
        Math.max(new Date(a.start), new Date(b.start))
    );
    return overlapMilliseconds / 3600000;
  }

  function gapHours(a, b) {
    if (overlapHours(a, b) > 0) {
      return 0;
    }
    const gapMilliseconds = Math.max(
      0,
      Math.max(new Date(a.start), new Date(b.start)) -
        Math.min(new Date(a.end), new Date(b.end))
    );
    return gapMilliseconds / 3600000;
  }

  function sharedSegments(a, b) {
    return a.routeSegments.filter((segment) =>
      b.routeSegments.includes(segment)
    );
  }

  /**
   * Analyze every permit pair. The interaction ratio replaces a fixed
   * compounding factor with a value derived from shared-segment overlap-hours
   * divided by the total scheduled permit-hours in the supplied portfolio.
   */
  function analyze(permits, options) {
    const matrix = permits.map((permitA) =>
      permits.map((permitB) => {
        const isDiagonal = permitA.id === permitB.id;
        const shared = isDiagonal ? [] : sharedSegments(permitA, permitB);
        const temporalOverlapHours = isDiagonal
          ? 0
          : overlapHours(permitA, permitB);

        return {
          temporalOverlapHours,
          sharedSegmentCount: shared.length,
          sharedSegments: shared,
          exposure: temporalOverlapHours * shared.length,
        };
      })
    );

    const conflicts = [];
    for (let row = 0; row < permits.length; row += 1) {
      for (let column = row + 1; column < permits.length; column += 1) {
        if (matrix[row][column].exposure > 0) {
          conflicts.push({
            pair: [permits[row].id, permits[column].id],
            ...matrix[row][column],
          });
        }
      }
    }

    const links = permits.map(() => new Set());
    for (let row = 0; row < permits.length; row += 1) {
      for (let column = row + 1; column < permits.length; column += 1) {
        const closeEnough =
          gapHours(permits[row], permits[column]) <=
          options.coordinationWindowHours;
        const samePhysicalWork =
          sharedSegments(permits[row], permits[column]).length > 0;
        if (closeEnough && samePhysicalWork) {
          links[row].add(column);
          links[column].add(row);
        }
      }
    }

    const visited = new Set();
    const digOnceGroups = [];
    links.forEach((_, index) => {
      if (visited.has(index)) {
        return;
      }
      const stack = [index];
      const permitIds = [];
      visited.add(index);

      while (stack.length > 0) {
        const current = stack.pop();
        permitIds.push(permits[current].id);
        links[current].forEach((next) => {
          if (!visited.has(next)) {
            visited.add(next);
            stack.push(next);
          }
        });
      }

      if (permitIds.length > 1) {
        digOnceGroups.push({
          permitIds,
          coordinationWindowHours: options.coordinationWindowHours,
        });
      }
    });

    const baseDelayVehHours = permits.reduce(
      (sum, permit) => sum + permit.delayVehHours,
      0
    );
    const overlapExposureHours = conflicts.reduce(
      (sum, conflict) => sum + conflict.exposure,
      0
    );
    const totalPermitHours = permits.reduce(
      (sum, permit) =>
        sum + (new Date(permit.end) - new Date(permit.start)) / 3600000,
      0
    );
    const interactionRatio =
      totalPermitHours > 0
        ? 1 + overlapExposureHours / totalPermitHours
        : 1;

    return {
      permits,
      matrix,
      conflicts,
      digOnceGroups,
      interactionRatio,
      combinedDelayVehHours: baseDelayVehHours * interactionRatio,
      overlapExposureHours,
      totalPermitHours,
      interactionDerivation:
        '1 + shared-segment overlap-hours / total permit-hours',
      provenance: options.provenance,
    };
  }

  return {
    analyze,
    overlapHours,
    gapHours,
  };
});
