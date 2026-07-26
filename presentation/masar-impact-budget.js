/**
 * MasarImpactBudget — a cumulative monthly impact budget for a corridor. Each
 * corridor is allotted a ceiling of allowable vehicle-hours of delay per
 * month; every new permit consumes from it. Makes the sustainability story
 * concrete: a corridor can be "full" and force rescheduling.
 *
 * Pure, no globals. UMD export.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarImpactBudget = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NEAR_CAP_PCT = 80;
  const OVER_CAP_PCT = 100;

  /**
   * @param {{monthlyBudgetVehHours:number, consumedVehHours:number, currentPermitVehHours:number}} input
   * @returns {{budget:number, consumedBefore:number, consumedAfter:number,
   *            remaining:number, pctUsed:number, verdict:string}}
   */
  function corridorBudget(input) {
    const budget = input.monthlyBudgetVehHours;
    const consumedBefore = input.consumedVehHours || 0;
    const current = input.currentPermitVehHours || 0;
    const consumedAfter = consumedBefore + current;
    const pctUsed = budget > 0 ? (consumedAfter / budget) * 100 : 100;

    let verdict;
    if (pctUsed < NEAR_CAP_PCT) verdict = 'ضمن الميزانية';
    else if (pctUsed < OVER_CAP_PCT) verdict = 'قرب السقف';
    else verdict = 'تجاوز — يتطلب إعادة جدولة';

    return {
      budget,
      consumedBefore,
      consumedAfter,
      remaining: Math.max(0, budget - consumedAfter),
      pctUsed,
      verdict,
    };
  }

  return { corridorBudget, NEAR_CAP_PCT, OVER_CAP_PCT };
});
