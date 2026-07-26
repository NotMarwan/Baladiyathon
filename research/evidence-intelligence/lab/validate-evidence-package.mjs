import fs from "node:fs/promises";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "research/evidence-intelligence");
const lab = path.join(root, "lab");

const requiredMarkdown = [
  "README.md",
  "EVIDENCE-DEMAND-REGISTER.md",
  "EVIDENCE-LADDER.md",
  "SAUDI-DATA-SOURCE-AUDIT.md",
  "ROUTE-EVIDENCE-FEASIBILITY.md",
  "TRAFFIC-PROVIDER-EVIDENCE.md",
  "SCIENTIFIC-EVIDENCE-CARDS.md",
  "GLOBAL-WORK-ZONE-CASEBOOK.md",
  "NEIGHBOURHOOD-DETOUR-EVIDENCE.md",
  "WORK-ZONE-FRICTION-EVIDENCE.md",
  "PARAMETER-TO-EVIDENCE-MATRIX.md",
  "REPRODUCIBLE-EVIDENCE-LAB.md",
  "FIRST-FIELD-CASE-PLAN.md",
  "DATA-ACQUISITION-TARGETS.md",
  "RUBRIC-EVIDENCE-LIFT-MATRIX.md",
  "VISUAL-EVIDENCE-HANDOFF.md",
  "IMPLEMENTATION-CARDS.md",
  "REJECTED-SOURCES.md",
  "SOURCE-LEDGER.md",
  "EXECUTIVE-EVIDENCE-BRIEF.md",
];

const requiredVisuals = [
  "evidence-ladder.svg",
  "before-during-after.svg",
  "counterfactual.svg",
  "assumption-evidence-matrix.svg",
  "route-source-coverage.svg",
  "evidence-card.svg",
];

const failures = [];
const checks = [];
const pass = (name, details = null) => checks.push({ name, passed: true, details });
const fail = (name, details) => {
  failures.push({ name, details });
  checks.push({ name, passed: false, details });
};

for (const file of requiredMarkdown) {
  const filePath = path.join(root, file);
  try {
    const contents = await fs.readFile(filePath, "utf8");
    if (contents.length < 800) {
      fail(`markdown:${file}`, `too short: ${contents.length} characters`);
    } else {
      pass(`markdown:${file}`, `${contents.length} characters`);
    }
    if (/(?:\bTODO\b|\bTBD\b|FIXME|PLACEHOLDER)/i.test(contents)) {
      fail(`markers:${file}`, "contains unresolved marker");
    }
    if (/ط§|ظ„|ظ…|â€”|â€¢|ï‚/.test(contents)) {
      fail(`encoding:${file}`, "contains a common mojibake sequence");
    }
  } catch (error) {
    fail(`markdown:${file}`, error.message);
  }
}

for (const file of requiredVisuals) {
  const filePath = path.join(root, "visuals", file);
  try {
    const stat = await fs.stat(filePath);
    if (stat.size < 1000) fail(`visual:${file}`, `too small: ${stat.size} bytes`);
    else pass(`visual:${file}`, `${stat.size} bytes`);
  } catch (error) {
    fail(`visual:${file}`, error.message);
  }
}

const ladder = await fs.readFile(path.join(root, "EVIDENCE-LADDER.md"), "utf8");
for (const level of ["A", "B", "C", "D", "E", "F"]) {
  if (!ladder.includes(`المستوى ${level}`)) {
    fail(`level:${level}`, "missing exact evidence level");
  } else {
    pass(`level:${level}`);
  }
}

const executive = await fs.readFile(
  path.join(root, "EXECUTIVE-EVIDENCE-BRIEF.md"),
  "utf8"
);
const requiredQuestions = [
  "ما أقوى دليل وجدناه ويمكن استخدامه فوراً؟",
  "ما أقوى دليل محلي محتمل لكنه يحتاج وصولاً؟",
  "ما المعامل الأكثر حاجة إلى تصحيح؟",
  "ما المسار الحالي الذي يمكن ربطه ببيانات فعلية أولاً؟",
  "ما أقصر تجربة ميدانية قابلة للدفاع؟",
  "ما أقوى تحسين ظاهري؟",
  "ما أقوى تحسين باطني؟",
  "ما الذي لا يزال مستحيلاً إثباته؟",
];
for (const question of requiredQuestions) {
  if (!executive.includes(question)) fail(`executive:${question}`, "missing");
  else pass(`executive:${question}`);
}

const ministry = JSON.parse(
  await fs.readFile(path.join(lab, "route-match-results.json"), "utf8")
);
if (
  ministry.findings.routesEvaluated !== 21 ||
  ministry.findings.routesWithCandidateWithin100m !== 0 ||
  ministry.matches.some((row) => row.countersWithin500m !== 0)
) {
  fail("ministry-route-test", ministry.findings);
} else {
  pass("ministry-route-test", {
    routes: 21,
    within100m: 0,
    within500m: 0,
  });
}

const rcrc = JSON.parse(
  await fs.readFile(path.join(lab, "rcrc-intersection-route-match.json"), "utf8")
);
if (
  rcrc.source.recordCount !== 631 ||
  rcrc.findings.evaluatedRoutes !== 21 ||
  rcrc.findings.routesWithIntersectionWithin50m !== 12 ||
  rcrc.findings.routesWithIntersectionWithin100m !== 13
) {
  fail("rcrc-route-test", {
    source: rcrc.source.recordCount,
    findings: rcrc.findings,
  });
} else {
  pass("rcrc-route-test", {
    geocodedRecords: 631,
    routes: 21,
    within50m: 12,
    within100m: 13,
  });
}

const kingFahd = rcrc.findings.workSegments.find(
  (row) => row.groupId === "BLD-2026-0045"
);
if (!kingFahd || kingFahd.nearest.distanceM !== 11) {
  fail("king-fahd-target", kingFahd ?? "missing");
} else {
  pass("king-fahd-target", kingFahd.nearest);
}

const inspection = JSON.parse(
  await fs.readFile(path.join(lab, "official-workbook-inspection.json"), "utf8")
);
const inspectionText = JSON.stringify(inspection);
if (
  !inspectionText.includes("traffic-density-on-roads.xlsx") ||
  !inspectionText.includes("average-speed-on-roads.xlsx") ||
  !inspectionText.includes("traffic-flow-data.xlsx")
) {
  fail("workbook-inspection", "one or more official workbooks missing");
} else {
  pass("workbook-inspection", "three official workbooks present");
}

const sourceLedger = await fs.readFile(path.join(root, "SOURCE-LEDGER.md"), "utf8");
const decisionCount = (sourceLedger.match(/القرار:/g) ?? []).length;
if (decisionCount < 30) fail("source-decisions", `${decisionCount} decisions`);
else pass("source-decisions", `${decisionCount} decisions`);

const report = {
  generatedAt: new Date().toISOString(),
  passed: failures.length === 0,
  requiredMarkdownCount: requiredMarkdown.length,
  requiredVisualCount: requiredVisuals.length,
  checkCount: checks.length,
  failureCount: failures.length,
  failures,
  checks,
};

await fs.writeFile(
  path.join(lab, "validation-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      passed: report.passed,
      requiredMarkdownCount: report.requiredMarkdownCount,
      requiredVisualCount: report.requiredVisualCount,
      checkCount: report.checkCount,
      failureCount: report.failureCount,
      failures,
    },
    null,
    2
  )
);

if (failures.length > 0) process.exitCode = 1;
