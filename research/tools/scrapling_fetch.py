from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from scrapling import Fetcher


def fetch(url: str) -> dict:
    response = Fetcher.get(url)
    page = response
    return {
        "url": url,
        "statusCode": response.status,
        "title": page.css("title::text").get(),
        "headings": page.css("h1::text, h2::text, h3::text").getall(),
        "text": " ".join(
            page.css("main *::text, article *::text, table *::text").getall()
        )[:50000],
        "accessedAt": datetime.now(timezone.utc).isoformat(),
        "strategy": "scrapling",
    }


if __name__ == "__main__":
    payload = json.dumps(fetch(sys.argv[1]), ensure_ascii=False, indent=2)
    if len(sys.argv) == 3:
        Path(sys.argv[2]).write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)
