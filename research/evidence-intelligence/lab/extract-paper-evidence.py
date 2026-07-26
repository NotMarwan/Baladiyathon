from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path("research/evidence-intelligence/lab").resolve()
PAPERS = ROOT / "papers"

QUERIES = {
    "tti-1161-3-v1.pdf": [
        "before, during, and after construction",
        "travel time",
        "daily traffic volumes",
        "construction period",
        "Table 4",
        "Table 5",
    ],
    "detours-major-construction-project.pdf": [
        "TTI Values Before, During, and After",
        "Percent Changes in TTI Values",
        "local traffic",
        "before construction",
        "during construction",
        "after construction",
    ],
    "delaware-report-265.pdf": [
        "vehicles per hour per lane",
        "vphpl",
        "capacity",
        "Table 4",
        "signalized",
        "lane closure",
    ],
    "missouri-work-zone-flow.pdf": [
        "1072",
        "1194",
        "1404",
        "1295",
        "queue discharge",
        "breakdown flow",
    ],
    "fhwa-measuring-work-zone-mobility.pdf": [
        "baseline period",
        "work zone period",
        "125 percent",
        "underperforming travel time",
        "case study",
        "volume",
    ],
    "dammam-long-term-work-zones.pdf": [
        "201 commercial activities",
        "before and during",
        "average daily sales",
        "average number of daily customers",
        "parking availability",
        "doesn’t look at changes on traffic operation",
    ],
    "tti-1161-3-v3-data.pdf": [
        "travel time",
        "traffic volume",
        "before construction",
        "during construction",
        "after construction",
    ],
}


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def excerpt(text: str, needle: str, radius: int = 1100) -> str:
    plain = normalize(text)
    index = plain.lower().find(needle.lower())
    if index < 0:
        return plain[: radius * 2]
    start = max(0, index - radius)
    end = min(len(plain), index + len(needle) + radius)
    return plain[start:end]


output = {
    "generatedAt": None,
    "method": "pypdf text extraction; page numbers are one-based PDF page indexes",
    "papers": [],
}

for file_name, queries in QUERIES.items():
    file_path = PAPERS / file_name
    reader = PdfReader(str(file_path))
    pages = [page.extract_text() or "" for page in reader.pages]
    paper = {
        "file": file_name,
        "pages": len(pages),
        "metadata": {str(key): str(value) for key, value in (reader.metadata or {}).items()},
        "hits": [],
    }

    for query in queries:
        matched = []
        for page_index, text in enumerate(pages):
            if query.lower() in normalize(text).lower():
                matched.append(
                    {
                        "page": page_index + 1,
                        "query": query,
                        "excerpt": excerpt(text, query),
                    }
                )
            if len(matched) >= 3:
                break
        paper["hits"].extend(matched)

    paper["hitPages"] = sorted({hit["page"] for hit in paper["hits"]})
    output["papers"].append(paper)

(ROOT / "paper-extraction.json").write_text(
    json.dumps(output, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

print(
    json.dumps(
        [
            {
                "file": paper["file"],
                "pages": paper["pages"],
                "hitPages": paper["hitPages"],
                "hitCount": len(paper["hits"]),
            }
            for paper in output["papers"]
        ],
        ensure_ascii=False,
        indent=2,
    )
)
