import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const repo = path.resolve(".");
const lab = path.join(repo, "research/evidence-intelligence/lab");
const dataDir = path.join(lab, "official-data");
const routes = JSON.parse(
  await fs.readFile(path.join(repo, "presentation/data/monitored-routes.json"), "utf8")
);

const sourceUrl =
  "https://mot.gov.sa/documents/7507107/7507109/" +
  "Traffic%2Bdensity%2Bon%2Broads.xlsx/a8c0fb92-e478-5eba-bc50-3435a86e077a" +
  "?download=true&t=1762086812548&version=1.0";

const workbook = await SpreadsheetFile.importXlsx(
  await FileBlob.load(path.join(dataDir, "traffic-density-on-roads.xlsx"))
);
const values = workbook.worksheets.getItemAt(0).getUsedRange(true).values;
const headers = values[0];
const rawRows = values.slice(2).filter((row) => row.some((value) => value !== null));

const excelDate = (serial) => {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Number(serial) * 86400000).toISOString().slice(0, 10);
};

const counters = rawRows.map((row, index) => ({
  counterId: `MOT-${String(index + 1).padStart(2, "0")}`,
  from: excelDate(row[0]),
  to: excelDate(row[1]),
  roadNo: String(row[2]),
  latitude: Number(row[3]),
  longitude: Number(row[4]),
  total24Hour: Number(row[5]),
  totalPeriod: Number(row[6]),
  qualityFlags:
    Number(row[6]) < Number(row[5])
      ? ["period-total-lower-than-24-hour-total"]
      : [],
}));

const toXY = ([lon, lat], lat0) => {
  const x = lon * 111320 * Math.cos((lat0 * Math.PI) / 180);
  const y = lat * 110540;
  return [x, y];
};

const pointToSegmentM = (point, a, b) => {
  const lat0 = point[1];
  const p = toXY(point, lat0);
  const p1 = toXY(a, lat0);
  const p2 = toXY(b, lat0);
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const denom = dx * dx + dy * dy;
  const t = denom === 0
    ? 0
    : Math.max(0, Math.min(1, ((p[0] - p1[0]) * dx + (p[1] - p1[1]) * dy) / denom));
  return Math.hypot(p[0] - (p1[0] + t * dx), p[1] - (p1[1] + t * dy));
};

const pointToLineM = (point, coordinates) => {
  let minimum = Infinity;
  for (let i = 1; i < coordinates.length; i += 1) {
    minimum = Math.min(minimum, pointToSegmentM(point, coordinates[i - 1], coordinates[i]));
  }
  return minimum;
};

const routeRows = routes.groups.flatMap((group) =>
  group.routes.map((route) => ({
    groupId: group.groupId,
    street: group.street,
    roadClass: group.roadClass,
    routeId: route.routeId,
    role: route.role,
    geometry: route.geometry,
    bbox: route.bbox,
    modelLengthM: route.modelLengthM,
  }))
);

const matches = routeRows.map((route) => {
  const ranked = counters
    .map((counter) => ({
      ...counter,
      distanceM: pointToLineM(
        [counter.longitude, counter.latitude],
        route.geometry.coordinates
      ),
    }))
    .sort((a, b) => a.distanceM - b.distanceM);
  const nearest = ranked[0];
  const within100m = ranked.filter((candidate) => candidate.distanceM <= 100);
  const within500m = ranked.filter((candidate) => candidate.distanceM <= 500);
  return {
    groupId: route.groupId,
    street: route.street,
    roadClass: route.roadClass,
    routeId: route.routeId,
    role: route.role,
    nearestCounterId: nearest.counterId,
    nearestRoadNo: nearest.roadNo,
    nearestDistanceM: Math.round(nearest.distanceM),
    countersWithin100m: within100m.length,
    countersWithin500m: within500m.length,
    coveragePct: within100m.length > 0 ? 100 : 0,
    verdict:
      within100m.length > 0
        ? "candidate-spatial-match-needs-road-identity-check"
        : "no-spatial-coverage",
  };
});

const priority = ["BLD-2026-0045", "BLD-2026-0025", "BLD-2026-0063"];
const priorityMatches = priority.map((groupId) => {
  const workSegment = matches.find(
    (row) => row.groupId === groupId && row.role === "work-segment"
  );
  return workSegment;
});

const suspiciousRows = counters.filter((row) => row.qualityFlags.length > 0);
const result = {
  generatedAt: new Date().toISOString(),
  source: {
    publisher: "وزارة النقل والخدمات اللوجستية",
    dataset: "Traffic density on roads",
    url: sourceUrl,
    localFile: "official-data/traffic-density-on-roads.xlsx",
    workbookHeaders: headers,
    recordCount: counters.length,
    period: {
      from: [...new Set(counters.map((row) => row.from))],
      to: [...new Set(counters.map((row) => row.to))],
    },
    fields: [
      "From",
      "To",
      "Road No.",
      "Latitude",
      "Longitude",
      "24 Hour Total",
      "Total",
    ],
    temporalResolution: "annual period with one 24-hour aggregate per station",
    spatialUnit: "point counter station",
    workZoneTiming: false,
    speed: false,
    volume: true,
    geometry: true,
  },
  methodology: {
    distance: "minimum equirectangular point-to-polyline distance in metres",
    candidateThresholdM: 100,
    warning:
      "A spatial hit is only a candidate. Road number, carriageway, direction, bridge/tunnel, and station metadata must still agree.",
  },
  findings: {
    anyCandidateWithin100m: matches.some((row) => row.countersWithin100m > 0),
    routesWithCandidateWithin100m: matches.filter((row) => row.countersWithin100m > 0).length,
    routesEvaluated: matches.length,
    suspiciousRecordCount: suspiciousRows.length,
    priorityMatches,
  },
  counters,
  matches,
  suspiciousRows,
};

const geojson = {
  type: "FeatureCollection",
  name: "mot-counter-route-evidence-overlay",
  source: sourceUrl,
  features: [
    ...routeRows.map((route) => ({
      type: "Feature",
      geometry: route.geometry,
      properties: {
        featureType: "athar-monitored-route",
        groupId: route.groupId,
        street: route.street,
        roadClass: route.roadClass,
        routeId: route.routeId,
        role: route.role,
      },
    })),
    ...counters.map((counter) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [counter.longitude, counter.latitude],
      },
      properties: {
        featureType: "mot-counter",
        counterId: counter.counterId,
        roadNo: counter.roadNo,
        from: counter.from,
        to: counter.to,
        total24Hour: counter.total24Hour,
        totalPeriod: counter.totalPeriod,
        qualityFlags: counter.qualityFlags.join(";"),
      },
    })),
  ],
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csvHeaders = [
  "groupId",
  "street",
  "roadClass",
  "routeId",
  "role",
  "nearestCounterId",
  "nearestRoadNo",
  "nearestDistanceM",
  "countersWithin100m",
  "countersWithin500m",
  "coveragePct",
  "verdict",
];
const csv = [
  csvHeaders.join(","),
  ...matches.map((row) => csvHeaders.map((header) => csvEscape(row[header])).join(",")),
].join("\n");

await fs.writeFile(
  path.join(lab, "route-match-results.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8"
);
await fs.writeFile(path.join(lab, "route-match-results.csv"), `${csv}\n`, "utf8");
await fs.writeFile(
  path.join(lab, "route-source-overlay.geojson"),
  `${JSON.stringify(geojson, null, 2)}\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      sourceRecords: counters.length,
      evaluatedRoutes: matches.length,
      anyCandidateWithin100m: result.findings.anyCandidateWithin100m,
      routesWithCandidateWithin100m: result.findings.routesWithCandidateWithin100m,
      suspiciousRecordCount: result.findings.suspiciousRecordCount,
      priorityMatches,
    },
    null,
    2
  )
);
