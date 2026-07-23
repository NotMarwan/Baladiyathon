from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2] / "research" / "2026-07-23"
REQUIRED_REPORTS = {
    "competitor-capability-map.md",
    "evidence-gaps.md",
    "impact-measurement-plan.md",
    "judging-advantage.md",
    "saudi-data-opportunities.md",
}


def load(name: str):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


def validate() -> list[str]:
    errors: list[str] = []
    sources = load("source-ledger.json")
    competitors = load("competitors.json")
    metrics = load("impact-metrics.json")
    source_ids = {record["sourceId"] for record in sources}
    if len(source_ids) != len(sources):
        errors.append("duplicate sourceId")
    seen_claims: set[tuple[str, str]] = set()
    for record in sources:
        if urlparse(record["url"]).scheme != "https":
            errors.append(f"non-https source: {record['sourceId']}")
        key = (record["url"], record["claim"])
        if key in seen_claims:
            errors.append(f"duplicate source claim: {record['sourceId']}")
        seen_claims.add(key)
        if record["status"] == "new" and not record["publicationDate"]:
            errors.append(f"missing publication date: {record['sourceId']}")
        if not record.get("supportsCriteria"):
            errors.append(f"missing judging criterion: {record['sourceId']}")
        if record.get("confidence") not in {"high", "medium-high", "medium", "low"}:
            errors.append(f"invalid confidence: {record['sourceId']}")
        if not record.get("limitations"):
            errors.append(f"missing limitation: {record['sourceId']}")
    competitor_ids = [competitor["competitorId"] for competitor in competitors]
    if len(competitor_ids) != len(set(competitor_ids)):
        errors.append("duplicate competitorId")
    for competitor in competitors:
        missing = set(competitor["evidenceSourceIds"]) - source_ids
        if missing:
            errors.append(
                f"missing competitor evidence: {competitor['competitorId']} {sorted(missing)}"
            )
    metric_ids = [metric["metricId"] for metric in metrics]
    if len(metric_ids) != len(set(metric_ids)):
        errors.append("duplicate metricId")
    for metric in metrics:
        missing = set(metric["dataSourceIds"]) - source_ids
        if missing:
            errors.append(
                f"missing metric evidence: {metric['metricId']} {sorted(missing)}"
            )
        for field in (
            "formula",
            "minimumInputs",
            "validationMethod",
            "uncertainty",
            "antiClaimRule",
        ):
            if not metric.get(field):
                errors.append(f"missing metric field: {metric['metricId']} {field}")
    metadata = json.loads(
        (ROOT / "research-metadata.json").read_text(encoding="utf-8")
    )
    counts = metadata["counts"]
    if counts["newEvidenceRecords"] != len(sources):
        errors.append("metadata source count mismatch")
    if counts["competitors"] != len(competitors):
        errors.append("metadata competitor count mismatch")
    if counts["impactMetrics"] != len(metrics):
        errors.append("metadata metric count mismatch")
    report_names = {path.name for path in (ROOT / "reports").glob("*.md")}
    missing_reports = REQUIRED_REPORTS - report_names
    if missing_reports:
        errors.append(f"missing reports: {sorted(missing_reports)}")
    return errors


if __name__ == "__main__":
    problems = validate()
    if problems:
        raise SystemExit("\n".join(problems))
    print("RESEARCH VALIDATION PASSED")
