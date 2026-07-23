(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = value;
  } else {
    root.AtharDecision = value;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const REQUIRED_FIELDS = [
    'permitId',
    'segmentId',
    'startDate',
    'startHour',
    'durationHours',
    'lanes',
    'lanesClosed',
    'aadt',
    'originNodeId',
    'destinationNodeId',
  ];

  const DEPENDENCY_METHODS = {
    engine: ['score', 'optimize'],
    routing: ['alternatives'],
    forecast: ['predict'],
    reasons: ['explain'],
    conflict: ['detect'],
  };

  function isMissing(value) {
    return (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    );
  }

  function isPositiveNumber(value) {
    return Number.isFinite(value) && value > 0;
  }

  function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
  }

  function isValidCalendarDate(value) {
    if (typeof value !== 'string') return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  function validateAssumptions(assumptions) {
    if (assumptions === undefined) return [];
    if (!Array.isArray(assumptions)) {
      return [{ field: 'assumptions', reason: 'must-be-array' }];
    }

    const invalid = [];
    assumptions.forEach((item, index) => {
      const hasValue =
        item &&
        Object.prototype.hasOwnProperty.call(item, 'value') &&
        !isMissing(item.value);
      const valid =
        item &&
        typeof item === 'object' &&
        typeof item.name === 'string' &&
        item.name.trim() !== '' &&
        hasValue &&
        typeof item.source === 'string' &&
        item.source.trim() !== '';

      if (!valid) {
        invalid.push({
          field: 'assumptions',
          reason: 'name-value-source-required',
          index,
        });
      }
    });
    return invalid;
  }

  function validateDecisionInput(input) {
    const value =
      input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const missing = REQUIRED_FIELDS.filter((field) =>
      isMissing(value[field])
    );
    const invalid = validateAssumptions(value.assumptions);

    function addInvalid(field, reason) {
      if (!missing.includes(field)) invalid.push({ field, reason });
    }

    if (
      !missing.includes('startDate') &&
      !isValidCalendarDate(value.startDate)
    ) {
      addInvalid('startDate', 'invalid-calendar-date');
    }
    if (
      !missing.includes('startHour') &&
      (!Number.isInteger(value.startHour) ||
        value.startHour < 0 ||
        value.startHour > 23)
    ) {
      addInvalid('startHour', 'integer-between-0-and-23-required');
    }
    if (
      !missing.includes('durationHours') &&
      !isPositiveNumber(value.durationHours)
    ) {
      addInvalid('durationHours', 'positive-number-required');
    }
    if (!missing.includes('lanes') && !isPositiveInteger(value.lanes)) {
      addInvalid('lanes', 'positive-integer-required');
    }
    if (
      !missing.includes('lanesClosed') &&
      (!isPositiveInteger(value.lanesClosed) ||
        (isPositiveInteger(value.lanes) &&
          value.lanesClosed > value.lanes))
    ) {
      addInvalid('lanesClosed', 'integer-within-total-lanes-required');
    }
    if (!missing.includes('aadt') && !isPositiveNumber(value.aadt)) {
      addInvalid('aadt', 'positive-number-required');
    }
    if (
      !missing.includes('originNodeId') &&
      !missing.includes('destinationNodeId') &&
      value.originNodeId === value.destinationNodeId
    ) {
      addInvalid('destinationNodeId', 'must-differ-from-origin');
    }

    const assumptions = Array.isArray(value.assumptions)
      ? value.assumptions.map((item) => ({ ...item }))
      : [];
    const blocked = missing.length > 0 || invalid.length > 0;

    return {
      status: blocked
        ? 'blocked'
        : assumptions.length > 0
          ? 'assumption-bound'
          : 'ready',
      missing,
      invalid,
      assumptions,
      canDecide: !blocked,
    };
  }

  function emptyDecision(qualityGate) {
    return {
      qualityGate,
      baseline: null,
      scheduleAlternatives: [],
      routeAlternatives: [],
      forecast: null,
      conflicts: [],
      verdict: null,
      evidence: [],
    };
  }

  function identityOf(item) {
    if (!item || typeof item !== 'object') return String(item);
    if (!isMissing(item.id)) return `id:${item.id}`;
    if (!isMissing(item.label)) return `label:${item.label}`;
    return JSON.stringify(item);
  }

  function uniqueAlternatives(items) {
    const seen = new Set();
    return items.filter((item) => {
      const identity = identityOf(item);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }

  function normalizeAlternatives(result) {
    return Array.isArray(result) ? uniqueAlternatives(result) : [];
  }

  function normalizeEvidence(items) {
    if (!Array.isArray(items)) {
      return {
        valid: false,
        items: [],
      };
    }

    const valid = items.every(
      (item) =>
        item &&
        typeof item.label === 'string' &&
        item.label.trim() !== '' &&
        typeof item.contribution === 'number' &&
        Number.isFinite(item.contribution) &&
        typeof item.provenance === 'string' &&
        item.provenance.trim() !== ''
    );

    return {
      valid,
      items: valid
        ? items.map((item) => ({
            label: item.label,
            value: item.contribution,
            provenance: item.provenance,
          }))
        : [],
    };
  }

  function selectedIdentity(item) {
    if (!item) return null;
    return !isMissing(item.id) ? item.id : item.label || null;
  }

  function assertDependencies(dependencies) {
    const value = dependencies || {};
    Object.entries(DEPENDENCY_METHODS).forEach(([name, methods]) => {
      if (!value[name]) {
        throw new TypeError(`Missing dependency: ${name}`);
      }
      methods.forEach((method) => {
        if (typeof value[name][method] !== 'function') {
          throw new TypeError(`Missing dependency method: ${name}.${method}`);
        }
      });
    });
    return value;
  }

  function createDecisionService(dependencies) {
    const deps = assertDependencies(dependencies);

    return {
      evaluate(input) {
        const qualityGate = validateDecisionInput(input);
        if (!qualityGate.canDecide) return emptyDecision(qualityGate);

        const baseline = deps.engine.score(input);
        const scheduleAlternatives = normalizeAlternatives(
          deps.engine.optimize(input)
        );
        const routeAlternatives = normalizeAlternatives(
          deps.routing.alternatives(input)
        );
        const predicted = deps.forecast.predict(input);
        const conflictResult = deps.conflict.detect(input);
        const conflicts = Array.isArray(conflictResult)
          ? conflictResult
          : conflictResult && Array.isArray(conflictResult.conflicts)
            ? conflictResult.conflicts
            : [];
        const evidenceResult = normalizeEvidence(
          deps.reasons.explain({
            input,
            baseline,
            scheduleAlternatives,
            routeAlternatives,
            forecast: predicted,
            conflicts,
          })
        );

        const invalid = [];
        if (scheduleAlternatives.length === 0) {
          invalid.push({
            field: 'scheduleAlternatives',
            reason: 'at-least-one-required',
          });
        }
        if (routeAlternatives.length === 0) {
          invalid.push({
            field: 'routeAlternatives',
            reason: 'at-least-one-required',
          });
        }
        if (!predicted || typeof predicted !== 'object') {
          invalid.push({
            field: 'forecast',
            reason: 'forecast-result-required',
          });
        }
        if (!evidenceResult.valid || evidenceResult.items.length === 0) {
          invalid.push({
            field: 'evidence',
            reason: 'numeric-provenance-required',
          });
        }

        if (invalid.length > 0) {
          return {
            qualityGate: {
              ...qualityGate,
              status: 'blocked',
              canDecide: false,
              invalid: qualityGate.invalid.concat(invalid),
            },
            baseline,
            scheduleAlternatives,
            routeAlternatives,
            forecast: predicted || null,
            conflicts,
            verdict: null,
            evidence: evidenceResult.items,
          };
        }

        return {
          qualityGate,
          baseline,
          scheduleAlternatives,
          routeAlternatives,
          forecast: predicted,
          conflicts,
          verdict: {
            status: conflicts.length > 0 ? 'conditional' : 'recommended',
            scheduleId: selectedIdentity(scheduleAlternatives[0]),
            routeId: selectedIdentity(routeAlternatives[0]),
          },
          evidence: evidenceResult.items,
        };
      },
    };
  }

  return {
    REQUIRED_FIELDS,
    createDecisionService,
    validateDecisionInput,
  };
});
