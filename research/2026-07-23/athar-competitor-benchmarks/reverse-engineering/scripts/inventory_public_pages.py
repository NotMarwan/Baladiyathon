#!/usr/bin/env python
"""Build a restrained structural inventory of official public product pages.

The collector intentionally does not store full page text. It records navigation,
headings, controls, forms, downloadable resources, structured-data types, and a
small set of design signals that are useful for clean-room product analysis.
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import re
import time
from pathlib import Path
from urllib import robotparser
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


USER_AGENT = "AtharPublicResearchBot/1.0 (+public product research; one page per cited URL)"
URL_RE = re.compile(r"https?://[^\s)\]>`]+")
COLOR_RE = re.compile(
    r"(?:#[0-9a-fA-F]{3,8}\b|rgba?\([^)]{3,80}\)|hsla?\([^)]{3,80}\))"
)
FONT_RE = re.compile(r"font-family\s*:\s*([^;}{]+)", re.IGNORECASE)
CSS_VAR_RE = re.compile(r"(--[\w-]+)\s*:\s*([^;}{]{1,160})")
JSONLD_TYPE_RE = re.compile(r'"@type"\s*:\s*"([^"]+)"')

CTA_WORDS = (
    "apply",
    "book",
    "contact",
    "demo",
    "download",
    "explore",
    "get started",
    "learn",
    "login",
    "map",
    "request",
    "search",
    "sign in",
    "sign up",
    "start",
    "trial",
    "view",
    "ابدأ",
    "استكشف",
    "تسجيل",
    "تواصل",
    "تحميل",
    "خريطة",
    "عرض",
    "طلب",
)

CAPABILITY_TERMS = {
    "map": ("map", "mapping", "geospatial", "gis", "خريطة", "جغرافي"),
    "permit": ("permit", "permitting", "licensing", "تصريح", "ترخيص"),
    "workflow": ("workflow", "approval", "review", "سير العمل", "موافقة", "مراجعة"),
    "conflict": ("conflict", "clash", "coordination", "collaboration", "تعارض", "تنسيق"),
    "realtime": ("real-time", "realtime", "live", "لحظي", "مباشر"),
    "forecast": ("forecast", "predict", "prediction", "تنبؤ", "توقع"),
    "simulation": ("simulation", "simulate", "digital twin", "محاكاة", "توأم رقمي"),
    "dashboard": ("dashboard", "analytics", "kpi", "لوحة", "مؤشر"),
    "notification": ("alert", "notification", "warning", "تنبيه", "إشعار"),
    "inspection": ("inspection", "field", "mobile", "فحص", "ميداني"),
    "routing": ("route", "routing", "detour", "closure", "مسار", "تحويلة", "إغلاق"),
    "integration": ("api", "integration", "feed", "standard", "تكامل", "واجهة"),
    "public_portal": ("public portal", "citizen", "community", "customer portal", "بوابة"),
    "documents": ("document", "template", "pdf", "report", "مستند", "تقرير", "نموذج"),
}

DOWNLOAD_EXTENSIONS = (
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".json",
    ".xml",
    ".geojson",
    ".zip",
)


def compact_text(value: str | None, limit: int = 240) -> str:
    return " ".join((value or "").split())[:limit]


def unique_items(items: list, limit: int) -> list:
    seen = set()
    output = []
    for item in items:
        key = json.dumps(item, ensure_ascii=False, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
        if len(output) >= limit:
            break
    return output


def extract_urls(source_text: str) -> list[str]:
    urls = []
    seen = set()
    for match in URL_RE.findall(source_text):
        url = match.rstrip(".,;:")
        if url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


def structural_inventory(html: str, base_url: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    visible_text = compact_text(soup.get_text(" ", strip=True), 250_000).casefold()

    title = compact_text(soup.title.get_text(" ", strip=True) if soup.title else "")
    meta = soup.find("meta", attrs={"name": re.compile("^description$", re.I)})
    description = compact_text(meta.get("content") if meta else "")

    headings = []
    for element in soup.select("h1, h2, h3, h4"):
        text = compact_text(element.get_text(" ", strip=True))
        if text:
            headings.append({"level": element.name, "text": text})

    nav_labels = []
    for element in soup.select("nav a, nav button, header a, header button"):
        text = compact_text(
            element.get("aria-label") or element.get_text(" ", strip=True), 120
        )
        if text:
            nav_labels.append(text)

    ctas = []
    for element in soup.select("a, button"):
        text = compact_text(
            element.get("aria-label")
            or element.get("title")
            or element.get_text(" ", strip=True),
            140,
        )
        if not text or not any(word in text.casefold() for word in CTA_WORDS):
            continue
        href = urljoin(base_url, element.get("href", "")) if element.name == "a" else ""
        ctas.append({"label": text, "href": href or None, "kind": element.name})

    inputs = []
    for element in soup.select("input, select, textarea"):
        element_id = element.get("id")
        label = ""
        if element_id:
            label_node = soup.find("label", attrs={"for": element_id})
            if label_node:
                label = compact_text(label_node.get_text(" ", strip=True), 120)
        inputs.append(
            {
                "tag": element.name,
                "type": element.get("type"),
                "name": element.get("name"),
                "label": label or None,
                "placeholder": compact_text(element.get("placeholder"), 120) or None,
                "ariaLabel": compact_text(element.get("aria-label"), 120) or None,
                "required": element.has_attr("required"),
            }
        )

    forms = []
    for form in soup.find_all("form"):
        forms.append(
            {
                "method": (form.get("method") or "get").lower(),
                "action": urljoin(base_url, form.get("action") or base_url),
                "fieldCount": len(form.select("input, select, textarea")),
                "buttonLabels": unique_items(
                    [
                        compact_text(x.get_text(" ", strip=True), 120)
                        for x in form.select("button, input[type=submit]")
                        if compact_text(
                            x.get("value") or x.get_text(" ", strip=True), 120
                        )
                    ],
                    20,
                ),
            }
        )

    tables = []
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        tables.append(
            {
                "caption": compact_text(
                    table.caption.get_text(" ", strip=True) if table.caption else "", 160
                )
                or None,
                "rowCount": len(rows),
                "maxColumnCount": max(
                    (len(row.find_all(["th", "td"])) for row in rows), default=0
                ),
            }
        )

    images = []
    for image in soup.find_all("img"):
        alt = compact_text(image.get("alt"), 160)
        src = image.get("src") or image.get("data-src") or ""
        if alt or src:
            images.append(
                {
                    "alt": alt or None,
                    "src": urljoin(base_url, src) if src else None,
                }
            )

    downloads = []
    data_candidates = []
    internal_links = 0
    external_links = 0
    base_host = urlparse(base_url).netloc
    for anchor in soup.find_all("a", href=True):
        absolute = urljoin(base_url, anchor["href"])
        parsed = urlparse(absolute)
        label = compact_text(anchor.get_text(" ", strip=True), 160)
        if parsed.netloc == base_host:
            internal_links += 1
        elif parsed.netloc:
            external_links += 1
        lower_path = parsed.path.casefold()
        if lower_path.endswith(DOWNLOAD_EXTENSIONS):
            downloads.append({"label": label or None, "url": absolute})
        if any(
            signal in absolute.casefold()
            for signal in ("api", "feed", "download", ".json", ".xml", ".csv", ".geojson")
        ):
            data_candidates.append({"label": label or None, "url": absolute})

    style_text = "\n".join(
        element.get_text("\n", strip=False) for element in soup.find_all("style")
    )
    colors = collections.Counter(match.group(0) for match in COLOR_RE.finditer(style_text))
    fonts = collections.Counter(
        compact_text(match.group(1), 120) for match in FONT_RE.finditer(style_text)
    )
    variables = collections.Counter(
        (compact_text(name, 80), compact_text(value, 140))
        for name, value in CSS_VAR_RE.findall(style_text)
    )

    structured_types = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        structured_types.extend(JSONLD_TYPE_RE.findall(script.get_text(" ", strip=False)))

    capability_signals = {}
    for capability, terms in CAPABILITY_TERMS.items():
        count = sum(visible_text.count(term.casefold()) for term in terms)
        if count:
            capability_signals[capability] = count

    return {
        "language": (soup.html.get("lang") if soup.html else None),
        "title": title or None,
        "metaDescription": description or None,
        "headings": unique_items(headings, 80),
        "navigationLabels": unique_items(nav_labels, 60),
        "callsToAction": unique_items(ctas, 60),
        "fields": unique_items(inputs, 100),
        "forms": forms[:20],
        "tables": tables[:20],
        "images": unique_items(images, 50),
        "downloads": unique_items(downloads, 50),
        "publicDataCandidates": unique_items(data_candidates, 50),
        "linkCounts": {"internal": internal_links, "external": external_links},
        "structuredDataTypes": sorted(set(structured_types)),
        "designSignals": {
            "colors": [
                {"value": value, "occurrences": count}
                for value, count in colors.most_common(24)
            ],
            "fontFamilies": [
                {"value": value, "occurrences": count}
                for value, count in fonts.most_common(16)
                if value
            ],
            "cssVariables": [
                {"name": pair[0], "value": pair[1], "occurrences": count}
                for pair, count in variables.most_common(30)
            ],
        },
        "capabilitySignals": capability_signals,
    }


class RobotsCache:
    def __init__(self, session: requests.Session):
        self.session = session
        self.cache: dict[str, tuple[bool | None, robotparser.RobotFileParser | None]] = {}

    def allowed(self, url: str) -> tuple[bool | None, str | None]:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin not in self.cache:
            robots_url = urljoin(origin, "/robots.txt")
            try:
                response = self.session.get(robots_url, timeout=12)
                if response.status_code >= 400:
                    self.cache[origin] = (None, None)
                else:
                    parser = robotparser.RobotFileParser()
                    parser.set_url(robots_url)
                    parser.parse(response.text.splitlines())
                    self.cache[origin] = (True, parser)
            except requests.RequestException:
                self.cache[origin] = (None, None)
        status, parser = self.cache[origin]
        if parser is None:
            return None, "robots.txt unavailable; single cited public page only"
        return parser.can_fetch(USER_AGENT, url), None


def fetch_page(
    session: requests.Session, robots: RobotsCache, url: str, source_index: int
) -> dict:
    checked_at = dt.datetime.now(dt.timezone.utc).isoformat()
    allowed, robots_note = robots.allowed(url)
    base = {
        "sourceIndex": source_index,
        "sourceUrl": url,
        "checkedAt": checked_at,
        "robotsAllowed": allowed,
        "robotsNote": robots_note,
    }
    if allowed is False:
        return {**base, "fetchState": "blocked-by-robots"}

    try:
        response = session.get(url, timeout=25, stream=True, allow_redirects=True)
        content_type = response.headers.get("content-type", "").split(";")[0].strip()
        content_length = response.headers.get("content-length")
        result = {
            **base,
            "fetchState": "received",
            "status": response.status_code,
            "finalUrl": response.url,
            "contentType": content_type or None,
            "contentLength": int(content_length) if content_length and content_length.isdigit() else None,
        }
        if response.status_code >= 400:
            return result
        if content_type == "application/pdf" or response.url.casefold().endswith(".pdf"):
            return {**result, "documentKind": "pdf", "inventory": None}

        chunks = []
        total = 0
        for chunk in response.iter_content(chunk_size=64 * 1024):
            if not chunk:
                continue
            chunks.append(chunk)
            total += len(chunk)
            if total >= 3_000_000:
                break
        encoding = response.encoding or "utf-8"
        html = b"".join(chunks).decode(encoding, errors="replace")
        return {
            **result,
            "documentKind": "html",
            "bytesRead": total,
            "inventory": structural_inventory(html, response.url),
        }
    except requests.RequestException as exc:
        return {**base, "fetchState": "error", "error": type(exc).__name__}


def load_existing(path: Path) -> dict:
    if not path.exists():
        return {"generatedAt": None, "method": {}, "pages": []}
    return json.loads(path.read_text(encoding="utf-8"))


def write_output(path: Path, pages_by_url: dict[str, dict], total_sources: int) -> None:
    pages = sorted(pages_by_url.values(), key=lambda item: item["sourceIndex"])
    state_counts = collections.Counter(page.get("fetchState") for page in pages)
    payload = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "method": {
            "scope": "one request per official URL already cited in sources.md",
            "storesFullText": False,
            "storedSignals": [
                "headings",
                "navigation labels",
                "calls to action",
                "fields and forms",
                "table dimensions",
                "download and data links",
                "structured data types",
                "limited design tokens",
                "capability keyword counts",
            ],
            "userAgent": USER_AGENT,
        },
        "coverage": {
            "totalSourceUrls": total_sources,
            "recordedUrls": len(pages),
            "states": dict(sorted(state_counts.items())),
        },
        "pages": pages,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int, default=15)
    parser.add_argument("--delay", type=float, default=2.0)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    urls = extract_urls(args.sources.read_text(encoding="utf-8"))
    selected = list(enumerate(urls))[args.start : args.start + args.limit]
    existing = load_existing(args.output)
    pages_by_url = {item["sourceUrl"]: item for item in existing.get("pages", [])}

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5",
        }
    )
    robots = RobotsCache(session)
    last_request_by_host: dict[str, float] = {}

    for index, url in selected:
        previous = pages_by_url.get(url)
        if previous and not args.force and previous.get("fetchState") == "received":
            print(f"[{index + 1}/{len(urls)}] cached {url}", flush=True)
            continue

        host = urlparse(url).netloc
        since_last = time.monotonic() - last_request_by_host.get(host, 0.0)
        if since_last < args.delay:
            time.sleep(args.delay - since_last)

        print(f"[{index + 1}/{len(urls)}] inspect {url}", flush=True)
        pages_by_url[url] = fetch_page(session, robots, url, index)
        last_request_by_host[host] = time.monotonic()
        write_output(args.output, pages_by_url, len(urls))

    write_output(args.output, pages_by_url, len(urls))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
