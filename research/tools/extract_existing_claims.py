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
    output: list[dict] = []
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
    print(f"Wrote {len(records())} existing claim records")
