from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import scrapy
from scrapy.http import TextResponse


class EvidenceSpider(scrapy.Spider):
    name = "athar_evidence"
    custom_settings = {
        "ROBOTSTXT_OBEY": True,
        "CONCURRENT_REQUESTS": 4,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
        "DOWNLOAD_DELAY": 2.0,
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 2.0,
        "AUTOTHROTTLE_MAX_DELAY": 30.0,
        "USER_AGENT": "AtharEvidenceResearch/1.0 (+public research; respectful crawler)",
        "LOG_LEVEL": "WARNING",
        "FEED_EXPORT_ENCODING": "utf-8",
    }

    def __init__(self, targets: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.start_urls = [
            line.strip()
            for line in Path(targets).read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")
        ]

    def parse(self, response):
        if not isinstance(response, TextResponse):
            yield {
                "url": response.url,
                "statusCode": response.status,
                "title": None,
                "headings": [],
                "text": "",
                "contentType": response.headers.get("Content-Type", b"").decode(
                    "latin-1"
                ),
                "contentLength": len(response.body),
                "accessedAt": datetime.now(timezone.utc).isoformat(),
                "strategy": "scrapy-binary-metadata",
            }
            return
        title = response.css("title::text").get()
        headings = response.css("h1::text, h2::text, h3::text").getall()
        paragraphs = response.css(
            "main p::text, article p::text, main li::text, article li::text, table *::text"
        ).getall()
        yield {
            "url": response.url,
            "statusCode": response.status,
            "title": " ".join((title or "").split()),
            "headings": [" ".join(value.split()) for value in headings if value.strip()],
            "text": " ".join(
                " ".join(value.split()) for value in paragraphs if value.strip()
            )[:50000],
            "accessedAt": datetime.now(timezone.utc).isoformat(),
            "strategy": "scrapy",
        }
