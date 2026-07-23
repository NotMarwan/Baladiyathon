(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = value;
  } else {
    root.AtharBudget = value;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function monthKey(value) {
    return String(value).slice(0, 7);
  }

  function acceptedUsage(permits, corridorId, key) {
    return permits
      .filter(
        (permit) =>
          permit.status === 'accepted' &&
          permit.corridorId === corridorId &&
          monthKey(permit.start) === key
      )
      .reduce((sum, permit) => sum + permit.delayVehHours, 0);
  }

  function firstHourOfFutureMonth(iso, monthsAhead) {
    const date = new Date(iso);
    date.setUTCMonth(date.getUTCMonth() + monthsAhead, 1);
    return date.toISOString();
  }

  /**
   * Assess one requested permit against the accepted vehicle-hour total for
   * its corridor and calendar month. If it breaches the supplied ceiling,
   * find the earliest following month with enough unspent capacity.
   */
  function assess(request, permits, options) {
    const budget = options.monthlyBudgetVehHours;
    const requestedMonth = monthKey(request.start);
    const usedBefore = acceptedUsage(
      permits,
      request.corridorId,
      requestedMonth
    );
    const projectedUsage = usedBefore + request.delayVehHours;
    const decision = projectedUsage <= budget ? 'accept' : 'reschedule';
    let suggestedStart = request.start;

    if (decision === 'reschedule') {
      const searchMonths = permits.length + 1;
      for (let offset = 1; offset <= searchMonths; offset += 1) {
        const candidate = firstHourOfFutureMonth(request.start, offset);
        const candidateUsage = acceptedUsage(
          permits,
          request.corridorId,
          monthKey(candidate)
        );
        if (candidateUsage + request.delayVehHours <= budget) {
          suggestedStart = candidate;
          break;
        }
      }
    }

    return {
      decision,
      usedBefore,
      projectedUsage,
      remainingAfter: budget - projectedUsage,
      utilizationPct: (projectedUsage / budget) * 100,
      suggestedStart,
      derivation:
        'sum(accepted corridor permit delay in month) + requested permit delay',
      provenance: options.provenance,
    };
  }

  return {
    assess,
    monthKey,
  };
});
