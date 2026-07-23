(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = value;
  } else {
    root.AtharInnovationDemoData = value;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const meta = {
    dataStatus: 'افتراض توضيحي للعرض',
    methodologySource: 'src-021',
    codeSource: 'src-003',
    competitorSources: ['src-024', 'src-030'],
    note: 'بيانات تركيبية لا تمثل قياساً فعلياً لمدينة الرياض؛ تستبدل ببيانات التصاريح والرصد عند التكامل.',
  };

  return {
    meta,
    boundary: {
      workLengthMeters: 400,
      hourlyVolume: 5200,
      totalLanes: 4,
      lanesClosed: 2,
      capacityPerLane: 1800,
    },
    budget: {
      corridorId: 'KF-01',
      monthlyBudgetVehHours: 8000,
      requestedStart: '2026-08-18T22:00:00+03:00',
    },
    permits: [
      {
        id: 'P-101',
        corridorId: 'KF-01',
        routeSegments: ['S1', 'S2'],
        start: '2026-08-02T22:00:00+03:00',
        end: '2026-08-04T06:00:00+03:00',
        delayVehHours: 3200,
        status: 'accepted',
      },
      {
        id: 'P-102',
        corridorId: 'KF-01',
        routeSegments: ['S2', 'S3'],
        start: '2026-08-03T23:00:00+03:00',
        end: '2026-08-05T05:00:00+03:00',
        delayVehHours: 2700,
        status: 'accepted',
      },
      {
        id: 'P-103',
        corridorId: 'KF-01',
        routeSegments: ['S3'],
        start: '2026-08-18T22:00:00+03:00',
        end: '2026-08-20T06:00:00+03:00',
        delayVehHours: 2800,
        status: 'requested',
      },
      {
        id: 'P-104',
        corridorId: 'OR-02',
        routeSegments: ['S8'],
        start: '2026-08-03T22:00:00+03:00',
        end: '2026-08-04T04:00:00+03:00',
        delayVehHours: 900,
        status: 'accepted',
      },
    ],
    ranking: {
      baseline: {
        demandVehPerHour: 6800,
        queueVehHours: 4100,
        busPersonHours: 520,
        corridorConflicts: 3,
      },
      candidates: [
        {
          id: 'C-22',
          label: '22:00',
          demandVehPerHour: 4300,
          queueVehHours: 2100,
          busPersonHours: 260,
          corridorConflicts: 1,
        },
        {
          id: 'C-23',
          label: '23:00',
          demandVehPerHour: 3300,
          queueVehHours: 1400,
          busPersonHours: 170,
          corridorConflicts: 0,
        },
        {
          id: 'C-08',
          label: '08:00',
          demandVehPerHour: 6200,
          queueVehHours: 3600,
          busPersonHours: 480,
          corridorConflicts: 2,
        },
      ],
    },
    memoryRecords: [
      { id: 'M1', predictedVehHours: 1000, observedVehHours: 1050, absoluteErrorPct: 5 },
      { id: 'M2', predictedVehHours: 1200, observedVehHours: 1440, absoluteErrorPct: 20 },
      { id: 'M3', predictedVehHours: 800, observedVehHours: 1120, absoluteErrorPct: 40 },
      { id: 'M4', predictedVehHours: 1500, observedVehHours: 1350, absoluteErrorPct: 10 },
      { id: 'M5', predictedVehHours: 900, observedVehHours: 1170, absoluteErrorPct: 30 },
    ],
  };
});
