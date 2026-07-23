/**
 * AtharShadowEvaluation
 *
 * Pure evidence gate for a human-supervised shadow pilot. Synthetic cases are
 * counted for transparency but never contribute to measured error, benefit,
 * safety thresholds, or the pass/fail decision.
 *
 * UMD export:
 * - `window.AtharShadowEvaluation` in a browser.
 * - `module.exports` in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharShadowEvaluation = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PROTOCOL_FIELDS = [
    'minMeasuredCases',
    'maxMapePct',
    'minBenefitVehHours',
    'maxTransitBreaches',
    'maxCriticalAccessBreaches',
  ];

  const NUMERIC_CASE_FIELDS = [
    'predictedVehHours',
    'observedVehHours',
    'counterfactualVehHours',
  ];

  const BOOLEAN_CASE_FIELDS = [
    'transitBreach',
    'criticalAccessBreach',
  ];

  function validateShadowCases(cases, protocol) {
    if (!Array.isArray(cases)) {
      return { valid: false, errors: ['cases-must-be-array'] };
    }
    if (!protocol || typeof protocol !== 'object' || Array.isArray(protocol)) {
      return { valid: false, errors: ['protocol-required'] };
    }

    const errors = [];
    PROTOCOL_FIELDS.forEach((field) => {
      if (!Number.isFinite(protocol[field]) || protocol[field] < 0) {
        errors.push(`invalid-protocol-${field}`);
      }
    });

    const seenPermitIds = new Set();
    cases.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(`invalid-case-${index}`);
        return;
      }

      if (typeof item.permitId !== 'string' || item.permitId.trim() === '') {
        errors.push(`missing-permit-${index}`);
      } else if (seenPermitIds.has(item.permitId)) {
        errors.push(`duplicate-permit-${item.permitId}`);
      } else {
        seenPermitIds.add(item.permitId);
      }

      if (!['measured', 'synthetic'].includes(item.kind)) {
        errors.push(`invalid-kind-${index}`);
      }

      NUMERIC_CASE_FIELDS.forEach((field) => {
        if (!Number.isFinite(item[field]) || item[field] < 0) {
          errors.push(`invalid-${field}-${index}`);
        }
      });

      BOOLEAN_CASE_FIELDS.forEach((field) => {
        if (typeof item[field] !== 'boolean') {
          errors.push(`invalid-${field}-${index}`);
        }
      });
    });

    return { valid: errors.length === 0, errors };
  }

  function mean(values) {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function failedValidation(errors) {
    return {
      status: 'fail',
      measuredCases: 0,
      syntheticCases: 0,
      maeVehHours: null,
      mapePct: null,
      signedBiasVehHours: null,
      totalObservedBenefitVehHours: null,
      violations: errors.slice(),
    };
  }

  function evaluateShadowPilot(cases, protocol) {
    const validation = validateShadowCases(cases, protocol);
    if (!validation.valid) {
      return failedValidation(validation.errors);
    }

    const measured = cases.filter((item) => item.kind === 'measured');
    const synthetic = cases.filter((item) => item.kind === 'synthetic');
    const violations = [];

    if (measured.length < protocol.minMeasuredCases) {
      violations.push('insufficient-measured-cases');
    }

    const signedErrors = measured.map(
      (item) => item.predictedVehHours - item.observedVehHours
    );
    const absoluteErrors = signedErrors.map((error) => Math.abs(error));
    const benefits = measured.map(
      (item) => item.counterfactualVehHours - item.observedVehHours
    );

    const percentageErrors = [];
    measured.forEach((item) => {
      if (item.observedVehHours === 0) {
        if (!violations.includes('zero-observed-value')) {
          violations.push('zero-observed-value');
        }
        return;
      }
      percentageErrors.push(
        Math.abs(item.predictedVehHours - item.observedVehHours)
        / Math.abs(item.observedVehHours)
        * 100
      );
    });

    const maeVehHours = mean(absoluteErrors);
    const mapePct = mean(percentageErrors);
    const signedBiasVehHours = mean(signedErrors);
    const totalObservedBenefitVehHours = benefits.length
      ? benefits.reduce((sum, value) => sum + value, 0)
      : null;

    const transitBreaches = measured.filter(
      (item) => item.transitBreach
    ).length;
    const criticalAccessBreaches = measured.filter(
      (item) => item.criticalAccessBreach
    ).length;

    if (mapePct !== null && mapePct > protocol.maxMapePct) {
      violations.push('mape-threshold');
    }
    if (
      totalObservedBenefitVehHours !== null
      && totalObservedBenefitVehHours < protocol.minBenefitVehHours
    ) {
      violations.push('benefit-threshold');
    }
    if (transitBreaches > protocol.maxTransitBreaches) {
      violations.push('transit-breach');
    }
    if (criticalAccessBreaches > protocol.maxCriticalAccessBreaches) {
      violations.push('critical-access-breach');
    }

    const insufficientEvidence = measured.length < protocol.minMeasuredCases;
    const hardSafetyFailure =
      criticalAccessBreaches > protocol.maxCriticalAccessBreaches;

    return {
      status: hardSafetyFailure
        ? 'fail'
        : insufficientEvidence
          ? 'insufficient-evidence'
          : violations.length
            ? 'fail'
            : 'pass',
      measuredCases: measured.length,
      syntheticCases: synthetic.length,
      maeVehHours,
      mapePct,
      signedBiasVehHours,
      totalObservedBenefitVehHours,
      violations,
    };
  }

  return { evaluateShadowPilot, validateShadowCases };
});
