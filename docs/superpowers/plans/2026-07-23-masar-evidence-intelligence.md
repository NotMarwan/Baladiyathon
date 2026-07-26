# Masar Evidence Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a source-audited research package that adds genuinely new Saudi and global evidence, competitor intelligence, and measurable impact methods to Masar without repeating the existing corpus.

**Architecture:** Treat the existing Baladiyathon corpus as the deduplication baseline, then collect only primary, official, or peer-reviewed evidence into a normalized ledger. Produce machine-readable JSON/CSV plus concise decision reports that map every recommendation to the six official judging criteria.

**Tech Stack:** Python 3.13, Scrapy, Scrapling, Firecrawl SDK when credentials are available, JSON, CSV, Markdown, Graphify.

## Global Constraints

- Navigation uses the repository `README.md` and Graphify only.
- Obsidian files remain indexed content and are not a navigation layer.
- Research scope is Masar and official Challenge 3 only.
- Every quantitative claim must include a direct source URL, publisher, publication date, access date, geography, unit, and confidence.
- Prefer primary government, standards-body, official product, and peer-reviewed sources.
- Existing claims must be tagged `existing`; new findings must be tagged `new`.
- Illustrative assumptions must never be presented as observed Saudi facts.
- No product implementation changes are authorized in this research phase.
- Scrapers must respect access controls, robots directives, and rate limits.

---

## File Map

- Create: `research/2026-07-23/README.md` — human navigation and executive summary.
- Create: `research/2026-07-23/data/existing-claims.json` — deduplication baseline from the current corpus.
- Create: `research/2026-07-23/data/source-ledger.json` — normalized, source-audited findings.
- Create: `research/2026-07-23/data/competitors.json` — capability-level competitor evidence.
- Create: `research/2026-07-23/data/impact-metrics.json` — metric definitions, formulas, required inputs, and validation methods.
- Create: `research/2026-07-23/reports/evidence-gaps.md` — what Masar still cannot prove.
- Create: `research/2026-07-23/reports/saudi-data-opportunities.md` — local datasets and access paths.
- Create: `research/2026-07-23/reports/competitor-capability-map.md` — capability-by-capability benchmark.
- Create: `research/2026-07-23/reports/impact-measurement-plan.md` — defensible pilot and scale calculations.
- Create: `research/2026-07-23/reports/judging-advantage.md` — evidence mapped to the six judging criteria.
- Create: `research/tools/extract_existing_claims.py` — scan the corpus for URLs and quantitative claims.
- Create: `research/tools/evidence_spider.py` — polite Scrapy crawler for curated targets.
- Create: `research/tools/scrapling_fetch.py` — resilient fetch fallback for dynamic public pages.
- Create: `research/tools/validate_research.py` — schema, deduplication, freshness, and citation checks.
- Create: `research/tests/test_validate_research.py` — regression tests for the research package.

### Task 1: Build the Existing-Claim Baseline

**Files:**

- Create: `research/tools/extract_existing_claims.py`
- Create: `research/2026-07-23/data/existing-claims.json`
- Test: `research/tests/test_validate_research.py`

**Interfaces:**

- Consumes: Markdown, HTML, JavaScript, JSON, and text files under the Baladiyathon root.
- Produces: JSON records with `claimId`, `claimText`, `numbers`, `urls`, `sourceFile`, and `status`.

- [ ] **Step 1: Write the failing baseline test**

```python
from pathlib import Path
import json
import unittest


class ExistingClaimBaselineTests(unittest.TestCase):
    def test_existing_claims_are_source_linked(self):
        path = Path("research/2026-07-23/data/existing-claims.json")
        records = json.loads(path.read_text(encoding="utf-8"))
        self.assertGreater(len(records), 20)
        self.assertTrue(all(record["sourceFile"] for record in records))
        self.assertTrue(any("11.1" in record["claimText"] for record in records))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
python -m unittest research.tests.test_validate_research.ExistingClaimBaselineTests -v
```

Expected: failure because the baseline file does not exist.

- [ ] **Step 3: Implement the corpus extractor**

```python
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "research" / "2026-07-23" / "data" / "existing-claims.json"
TEXT_EXTENSIONS = {".md", ".html", ".js", ".json", ".txt"}
URL_RE = re.compile(r"https?://[^\s<>\]\)\"']+")
NUMBER_RE = re.compile(r"(?<!\w)[+-]?\d[\d,.]*(?:\s?%|\s?[A-Za-z²³₀-₉/-]+)?")


def records() -> list[dict]:
    output = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        if any(part in {"graphify-out", "node_modules", ".git", "research"} for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for paragraph in re.split(r"\n\s*\n", text):
            numbers = NUMBER_RE.findall(paragraph)
            urls = URL_RE.findall(paragraph)
            if not numbers and not urls:
                continue
            cleaned = " ".join(paragraph.split())
            if len(cleaned) < 20:
                continue
            digest = hashlib.sha256(
                f"{path.relative_to(ROOT)}::{cleaned}".encode("utf-8")
            ).hexdigest()[:16]
            output.append(
                {
                    "claimId": f"existing-{digest}",
                    "claimText": cleaned[:1200],
                    "numbers": numbers,
                    "urls": urls,
                    "sourceFile": path.relative_to(ROOT).as_posix(),
                    "status": "existing",
                }
            )
    return output


if __name__ == "__main__":
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(records(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
```

- [ ] **Step 4: Generate and verify the baseline**

```powershell
python research/tools/extract_existing_claims.py
python -m unittest research.tests.test_validate_research.ExistingClaimBaselineTests -v
```

Expected: test passes and the baseline contains more than twenty source-linked records.

### Task 2: Collect Primary Evidence with Polite Multi-Strategy Scraping

**Files:**

- Create: `research/tools/evidence_spider.py`
- Create: `research/tools/scrapling_fetch.py`
- Create: `research/2026-07-23/data/source-ledger.json`

**Interfaces:**

- Consumes: curated public URLs discovered through web search.
- Produces: normalized page evidence with title, publisher, dates, extracted facts, and access status.

- [ ] **Step 1: Implement the Scrapy collector**

```python
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import scrapy


class EvidenceSpider(scrapy.Spider):
    name = "masar_evidence"
    custom_settings = {
        "ROBOTSTXT_OBEY": True,
        "CONCURRENT_REQUESTS": 4,
        "DOWNLOAD_DELAY": 2.0,
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 2.0,
        "AUTOTHROTTLE_MAX_DELAY": 30.0,
        "LOG_LEVEL": "WARNING",
    }

    def __init__(self, targets: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.start_urls = [
            line.strip()
            for line in Path(targets).read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")
        ]

    def parse(self, response):
        title = response.css("title::text").get()
        headings = response.css("h1::text, h2::text, h3::text").getall()
        paragraphs = response.css("main p::text, article p::text, table *::text").getall()
        yield {
            "url": response.url,
            "statusCode": response.status,
            "title": " ".join((title or "").split()),
            "headings": [" ".join(value.split()) for value in headings if value.strip()],
            "text": " ".join(" ".join(value.split()) for value in paragraphs if value.strip())[:50000],
            "accessedAt": datetime.now(timezone.utc).isoformat(),
            "strategy": "scrapy",
        }
```

- [ ] **Step 2: Implement the Scrapling fallback**

```python
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

from scrapling import Fetcher


def fetch(url: str) -> dict:
    response = Fetcher.get(url)
    page = response.adaptor
    return {
        "url": url,
        "statusCode": response.status_code,
        "title": page.css("title::text").get(),
        "headings": page.css("h1::text, h2::text, h3::text").getall(),
        "text": " ".join(page.css("main *::text, article *::text, table *::text").getall())[:50000],
        "accessedAt": datetime.now(timezone.utc).isoformat(),
        "strategy": "scrapling",
    }


if __name__ == "__main__":
    print(json.dumps(fetch(sys.argv[1]), ensure_ascii=False, indent=2))
```

- [ ] **Step 3: Run the curated collection**

```powershell
scrapy runspider research/tools/evidence_spider.py -a targets=research/2026-07-23/targets.txt -O research/2026-07-23/raw/scrapy-pages.json
```

Expected: public pages are collected at no more than one request per two seconds per spider.

- [ ] **Step 4: Record Firecrawl availability honestly**

If `FIRECRAWL_API_KEY` or a self-hosted endpoint is available, use Firecrawl for clean Markdown and PDF extraction. Otherwise record `firecrawlStatus: unavailable_no_credentials` in the research metadata and continue with Scrapy, Scrapling, browser retrieval, and direct official downloads.

### Task 3: Normalize New Findings and Competitor Capabilities

**Files:**

- Create: `research/2026-07-23/data/source-ledger.json`
- Create: `research/2026-07-23/data/competitors.json`
- Create: `research/2026-07-23/reports/competitor-capability-map.md`

**Interfaces:**

- Consumes: raw page captures plus primary-source browser research.
- Produces: deduplicated claims and one record per competitor capability.

- [ ] **Step 1: Normalize source records**

Each source record must use this exact schema:

```json
{
  "sourceId": "src-001",
  "title": "Document or page title",
  "publisher": "Publishing organization",
  "url": "https://example.gov/source",
  "publicationDate": "2025-01-01",
  "accessedDate": "2026-07-23",
  "geography": "Saudi Arabia",
  "sourceType": "official",
  "freshness": "current",
  "claim": "One independently checkable claim",
  "value": 0,
  "unit": "vehicle-hours",
  "status": "new",
  "confidence": "high",
  "supportsCriteria": [1, 4]
}
```

- [ ] **Step 2: Normalize competitor records**

Each competitor record must use this exact schema:

```json
{
  "competitorId": "comp-001",
  "name": "Product or program",
  "country": "Country",
  "operator": "Organization",
  "deploymentType": "government-program",
  "capabilities": {
    "permitWorkflow": true,
    "conflictDetection": true,
    "trafficPrediction": false,
    "scheduleOptimization": false,
    "alternativeRoutes": false,
    "impactMonetization": false,
    "publicMap": true,
    "navigationFeed": true,
    "postImplementationCalibration": false
  },
  "evidenceSourceIds": ["src-001"],
  "masarAdvantage": "Specific capability gap Masar can own",
  "confidence": "high"
}
```

- [ ] **Step 3: Generate the capability report**

The report must separate:

- direct competitors;
- adjacent government permit platforms;
- traffic-modeling tools;
- navigation and work-zone data feeds;
- smart-work-zone safety products;
- Saudi and Gulf precedents.

Every capability cell must cite at least one source ID.

### Task 4: Define a Defensible Impact Measurement System

**Files:**

- Create: `research/2026-07-23/data/impact-metrics.json`
- Create: `research/2026-07-23/reports/impact-measurement-plan.md`

**Interfaces:**

- Consumes: official source values, Masar engine outputs, permit data, traffic counts, and post-work observations.
- Produces: formulas and pilot design that distinguish observed, simulated, projected, and scaled impact.

- [ ] **Step 1: Define metric records**

```json
{
  "metricId": "vehicle-hours-saved",
  "nameAr": "ساعات المركبات الموفرة",
  "formula": "sum(volume_t * (travelTimeBaseline_t - travelTimeOptimized_t))",
  "unit": "vehicle-hour",
  "minimumInputs": ["hourlyVolume", "baselineTravelTime", "optimizedTravelTime"],
  "evidenceLevel": "simulated",
  "validationMethod": "Compare predicted and observed travel times by corridor and hour using MAPE and RMSE",
  "judgeUse": "Expected impact and sustainability",
  "antiClaimRule": "Do not scale nationally until the annual permit count is sourced"
}
```

- [ ] **Step 2: Define four evidence levels**

```text
Level 1 — Demonstrated: calculated live by the working prototype.
Level 2 — Externally validated: supported by a primary or peer-reviewed precedent.
Level 3 — Pilot projection: computed from named Saudi inputs with uncertainty bounds.
Level 4 — Scale scenario: explicitly conditional on sourced annual permit volume.
```

- [ ] **Step 3: Specify the pilot**

The pilot must use at least twenty permits across high-, medium-, and low-impact corridors; run Masar in shadow mode; compare requested versus recommended schedules; collect baseline, during-work, and post-work travel times; publish MAPE, RMSE, vehicle-hours saved, person-hours saved, emissions avoided, processing time, conflict rate, and recommendation acceptance rate.

### Task 5: Validate and Package the Research

**Files:**

- Create: `research/tools/validate_research.py`
- Modify: `research/tests/test_validate_research.py`
- Create: `research/2026-07-23/README.md`
- Create: `research/2026-07-23/reports/evidence-gaps.md`
- Create: `research/2026-07-23/reports/saudi-data-opportunities.md`
- Create: `research/2026-07-23/reports/judging-advantage.md`

**Interfaces:**

- Consumes: all normalized research JSON.
- Produces: a zero-error validation result and concise human reports.

- [ ] **Step 1: Implement validation**

```python
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2] / "research" / "2026-07-23"


def load(name: str):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


def validate() -> list[str]:
    errors = []
    sources = load("source-ledger.json")
    competitors = load("competitors.json")
    source_ids = {record["sourceId"] for record in sources}
    seen_urls = set()
    for record in sources:
        if urlparse(record["url"]).scheme != "https":
            errors.append(f"non-https source: {record['sourceId']}")
        key = (record["url"], record["claim"])
        if key in seen_urls:
            errors.append(f"duplicate source claim: {record['sourceId']}")
        seen_urls.add(key)
        if record["status"] == "new" and not record["publicationDate"]:
            errors.append(f"missing publication date: {record['sourceId']}")
    for competitor in competitors:
        missing = set(competitor["evidenceSourceIds"]) - source_ids
        if missing:
            errors.append(f"missing competitor evidence: {competitor['competitorId']} {sorted(missing)}")
    return errors


if __name__ == "__main__":
    problems = validate()
    if problems:
        raise SystemExit("\n".join(problems))
    print("RESEARCH VALIDATION PASSED")
```

- [ ] **Step 2: Add the final validation test**

```python
from research.tools.validate_research import validate


class ResearchPackageTests(unittest.TestCase):
    def test_research_package_has_no_validation_errors(self):
        self.assertEqual(validate(), [])
```

- [ ] **Step 3: Run all checks**

```powershell
python research/tools/extract_existing_claims.py
python research/tools/validate_research.py
python -m unittest discover -s research/tests -v
```

Expected:

```text
RESEARCH VALIDATION PASSED
OK
```

- [ ] **Step 4: Refresh Graphify after the research package is complete**

```powershell
graphify update
```

Expected: only the newly created research files are indexed; no Obsidian export is generated.

## Self-Review

- Spec coverage: existing data deduplication, current Saudi/global evidence, competitor capabilities, impact measurement, judging criteria, and Graphify navigation are all assigned to explicit tasks.
- Placeholder scan: no `TBD`, `TODO`, “implement later,” or unspecified error-handling steps remain.
- Type consistency: source IDs are strings used identically by the source ledger and competitor records; criterion identifiers are integers from one to six; all dates use ISO format.
- Execution choice: inline execution is selected because the user explicitly requested continuous work without questions.
