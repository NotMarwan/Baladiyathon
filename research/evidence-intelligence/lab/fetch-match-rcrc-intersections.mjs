import fs from "node:fs/promises";
import path from "node:path";

const repo = path.resolve(".");
const lab = path.join(repo, "research/evidence-intelligence/lab");
const dataDir = path.join(lab, "official-data");
const routes = JSON.parse(
  await fs.readFile(path.join(repo, "presentation/data/monitored-routes.json"), "utf8")
);

const datasetId = "traffic-intersections-by-main-street-and-cross-street-2024";
const apiBase =
  `https://opendata.rcrc.gov.sa/api/explore/v2.1/catalog/datasets/${datasetId}/records`;

const records = [];
for (let offset = 0; ; offset += 100) {
  const response = await fetch(`${apiBase}?limit=100&offset=${offset}`);
  if (!response.ok) {
    throw new Error(`RCRC API returned ${response.status} at offset ${offset}`);
  }
  const page = await response.json();
  records.push(...page.results);
  if (records.length >= page.total_count || page.results.length === 0) break;
}

const intersections = records
  .filter((row) => row.geo_point_2d)
  .map((row) => ({
    intersectionCode: String(row.trafficinterseccode ?? row.index),
    nameAr: row.trafficintersecar ?? null,
    nameEn: row.trafficintersec ?? null,
    mainStreetAr: row.streetmainar ?? null,
    crossStreetAr: row.streetcrossar ?? null,
    latitude: Number(row.geo_point_2d.lat),
    longitude: Number(row.geo_point_2d.lon),
    comments: row.comments ?? null,
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
  const denominator = dx * dx + dy * dy;
  const t =
    denominator === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((p[0] - p1[0]) * dx + (p[1] - p1[1]) * dy) / denominator
          )
        );
  return Math.hypot(p[0] - (p1[0] + t * dx), p[1] - (p1[1] + t * dy));
};

const pointToLineM = (point, coordinates) => {
  let minimum = Infinity;
  for (let index = 1; index < coordinates.length; index += 1) {
    minimum = Math.min(
      minimum,
      pointToSegmentM(point, coordinates[index - 1], coordinates[index])
    );
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
  }))
);

const matches = routeRows.map((route) => {
  const ranked = intersections
    .map((intersection) => ({
      ...intersection,
      distanceM: pointToLineM(
        [intersection.longitude, intersection.latitude],
        route.geometry.coordinates
      ),
    }))
    .sort((left, right) => left.distanceM - right.distanceM);
  return {
    groupId: route.groupId,
    street: route.street,
    roadClass: route.roadClass,
    routeId: route.routeId,
    role: route.role,
    nearest: {
      intersectionCode: ranked[0].intersectionCode,
      nameAr: ranked[0].nameAr,
      nameEn: ranked[0].nameEn,
      distanceM: Math.round(ranked[0].distanceM),
      latitude: ranked[0].latitude,
      longitude: ranked[0].longitude,
    },
    within50m: ranked
      .filter((row) => row.distanceM <= 50)
      .map((row) => ({
        intersectionCode: row.intersectionCode,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        distanceM: Math.round(row.distanceM),
        latitude: row.latitude,
        longitude: row.longitude,
      })),
    within100m: ranked
      .filter((row) => row.distanceM <= 100)
      .map((row) => ({
        intersectionCode: row.intersectionCode,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        distanceM: Math.round(row.distanceM),
        latitude: row.latitude,
        longitude: row.longitude,
      })),
  };
});

const result = {
  generatedAt: new Date().toISOString(),
  source: {
    publisher: "الهيئة الملكية لمدينة الرياض",
    datasetId,
    api: apiBase,
    recordCount: intersections.length,
    publicApiWorkedWithoutKey: true,
    fields: [
      "intersection code",
      "main street",
      "cross street",
      "point geometry",
      "comments",
    ],
    providesTrafficPerformance: false,
    providesWorkZoneTiming: false,
    purpose:
      "geometry support and field sensor placement only; it is not traffic evidence",
  },
  method: {
    distance: "minimum equirectangular point-to-polyline distance in metres",
    thresholdsM: [50, 100],
    warning:
      "A point near a modeled route supports field planning only. It does not validate route direction, topology, speed, volume, or impact.",
  },
  findings: {
    evaluatedRoutes: matches.length,
    routesWithIntersectionWithin50m: matches.filter(
      (row) => row.within50m.length > 0
    ).length,
    routesWithIntersectionWithin100m: matches.filter(
      (row) => row.within100m.length > 0
    ).length,
    workSegments: matches.filter((row) => row.role === "work-segment"),
  },
  matches,
};

await fs.writeFile(
  path.join(dataDir, "rcrc-traffic-intersections-2025.json"),
  `${JSON.stringify(intersections, null, 2)}\n`,
  "utf8"
);
await fs.writeFile(
  path.join(lab, "rcrc-intersection-route-match.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      sourceRecords: intersections.length,
      evaluatedRoutes: matches.length,
      routesWithIntersectionWithin50m:
        result.findings.routesWithIntersectionWithin50m,
      routesWithIntersectionWithin100m:
        result.findings.routesWithIntersectionWithin100m,
      workSegments: result.findings.workSegments.map((row) => ({
        groupId: row.groupId,
        street: row.street,
        nearest: row.nearest,
        within50m: row.within50m.length,
        within100m: row.within100m.length,
      })),
    },
    null,
    2
  )
);
