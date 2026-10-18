"""Full Squarefoot crawl over the residential sitemap.

Scope is intentionally the *housing* subset of the site:
  * every `/en/estate/detail/...` page (12,012 at the last sitemap count)
  * every `/en/buy/apartment/property-...` and `/en/rent/apartment/property-...`
    page (9,823 + 4,136 at the last sitemap count)

Office, shop, carpark and news pages are out of scope for a private-domestic
housing atlas. The crawler is single-worker, 1.2 s/request by default, resumes
from the JSONL files in `data/raw/squarefoot/`, and never follows search-query
URLs (which robots.txt disallows).

Run:
    py -3.13 -m pipeline.full_crawl --delay 1.2
    py -3.13 -m pipeline.full_crawl --dry-run
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse, urlunparse

from pipeline.common import path_for, write_json
from pipeline.sources.geo import district_for_point
from pipeline.sources.squarefoot import SquarefootCrawler
from pipeline.sources.squarefoot_parse import parse_estate, parse_listing

LISTING_PATTERN = re.compile(r"/(?:en/)?(buy|rent)/apartment/property-(\d+)/?$")
ESTATE_PATTERN = re.compile(r"/(?:en/)?estate/detail/[^/]+-(\d+)/?$")
SITEMAP_URL = "https://www.squarefoot.com.hk/sitemap.xml.gz"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class FullCrawler(SquarefootCrawler):
    def __init__(self, *, delay: float = 1.2) -> None:
        super().__init__(
            sale_per_district=0,
            rent_per_district=0,
            max_estates=0,
            max_index_pages=0,
            refresh=False,
            delay=delay,
        )
        self.sitemap_path = self.root / "sitemap.xml.gz"
        self.errors_path = self.root / "crawl_errors.jsonl"
        self.progress_path = self.root / "full_crawl_progress.json"
        self.started = time.monotonic()
        self.errors = 0

    # ------------------------------------------------------------ sitemap
    def sitemap_urls(self, refresh: bool = False) -> list[str]:
        if self.sitemap_path.exists() and not refresh:
            payload = self.sitemap_path.read_bytes()
        else:
            print("downloading sitemap ...", flush=True)
            response = self.session.get(SITEMAP_URL, timeout=180)
            response.raise_for_status()
            self.sitemap_path.write_bytes(response.content)
            payload = response.content
        text = gzip.decompress(payload).decode("utf-8", "replace")
        return [value.strip() for value in re.findall(r"<loc>([^<]+)</loc>", text)]

    @staticmethod
    def english_url(url: str) -> str:
        """Force the English locale so labels are parseable.

        Sitemap canonical URLs omit `/en/` and render Chinese labels. Adding the
        locale keeps the slug (including Chinese characters) and gives the
        English page used by the parsers.
        """
        parsed = urlparse(url.strip())
        path = parsed.path
        if path.startswith("/en/"):
            return urlunparse(parsed._replace(query="", fragment=""))
        if path == "/en":
            path = "/en/"
        elif not path.startswith("/en/"):
            path = "/en" + (path if path.startswith("/") else "/" + path)
        return urlunparse(parsed._replace(path=path, query="", fragment=""))

    @classmethod
    def split_urls(cls, urls: Iterable[str]) -> tuple[list[str], list[str]]:
        listings: list[str] = []
        estates: list[str] = []
        seen: set[str] = set()
        for raw in urls:
            url = cls.english_url(raw)
            if url in seen:
                continue
            seen.add(url)
            path = urlparse(url).path
            if LISTING_PATTERN.search(path):
                listings.append(url)
            elif ESTATE_PATTERN.search(path):
                estates.append(url)
        return listings, estates

    # ------------------------------------------------------------- state
    def _error(self, url: str, exc: Exception) -> None:
        self.errors += 1
        with self.errors_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"at": _now(), "url": url, "error": str(exc)}) + "\n")

    def _progress(self, **values: Any) -> None:
        payload = {
            "updated_at": _now(),
            "elapsed_seconds": round(time.monotonic() - self.started, 1),
            **values,
        }
        write_json(self.progress_path, payload)
        print(
            f"[{payload['elapsed_seconds'] / 60:.1f} min] "
            + " ".join(f"{key}={value}" for key, value in values.items() if key != "current"),
            flush=True,
        )

    def _existing_ids(self, path: Path, key: str) -> set[str]:
        if not path.exists():
            return set()
        ids: set[str] = set()
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            value = row.get(key)
            if value:
                ids.add(str(value))
        return ids

    # ---------------------------------------------------------- listings
    def crawl_listings_full(self, urls: list[str]) -> dict[str, int]:
        seen = self._existing_ids(self.listings_path, "listing_id")
        print(f"listings: {len(urls)} sitemap URLs, {len(seen)} already parsed", flush=True)
        consecutive = 0
        for index, url in enumerate(urls, 1):
            match = LISTING_PATTERN.search(urlparse(url).path)
            if not match:
                continue
            listing_id = match.group(2)
            if listing_id in seen:
                continue
            try:
                listing = parse_listing(self.fetch(url), url)
                district = district_for_point(listing.get("lat"), listing.get("lon"))
                listing.update(
                    {
                        "snapshot_date": _now()[:10],
                        "fetched_at": _now(),
                        "district_code": district["district_code"] if district else None,
                        "district_name": district["name_en"] if district else None,
                        "region": district["region"] if district else listing.get("region_label"),
                    }
                )
                self._append_jsonl(self.listings_path, listing)
                seen.add(listing_id)
                consecutive = 0
            except Exception as exc:  # noqa: BLE001
                self._error(url, exc)
                consecutive += 1
                if consecutive >= 25:
                    raise RuntimeError("25 consecutive listing failures; stopping") from exc
            if index % 50 == 0:
                self._progress(
                    phase="listings",
                    done=index,
                    total=len(urls),
                    parsed=len(seen),
                    errors=self.errors,
                )
        return {"listings": len(seen), "errors": self.errors}

    # ----------------------------------------------------------- estates
    def crawl_estates_full(self, urls: list[str]) -> dict[str, int]:
        seen = self._existing_ids(self.estates_path, "estate_id")
        print(f"estates: {len(urls)} sitemap URLs, {len(seen)} already parsed", flush=True)

        listing_district: dict[str, str] = {}
        if self.listings_path.exists():
            for line in self.listings_path.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                estate_id = row.get("estate_id")
                district = row.get("district_code")
                if estate_id and district and str(estate_id) not in listing_district:
                    listing_district[str(estate_id)] = district

        consecutive = 0
        for index, url in enumerate(urls, 1):
            match = ESTATE_PATTERN.search(urlparse(url).path)
            if not match:
                continue
            estate_id = match.group(1)
            if estate_id in seen:
                continue
            try:
                estate = parse_estate(self.fetch(url), url)
                district = district_for_point(estate.get("lat"), estate.get("lon"))
                estate.update(
                    {
                        "snapshot_date": _now()[:10],
                        "fetched_at": _now(),
                        "district_code": district["district_code"] if district else listing_district.get(estate_id),
                        "district_name": district["name_en"] if district else None,
                        "region": district["region"] if district else estate.get("region_label"),
                    }
                )
                self._append_jsonl(self.estates_path, estate)
                seen.add(estate_id)
                consecutive = 0
            except Exception as exc:  # noqa: BLE001
                self._error(url, exc)
                consecutive += 1
                if consecutive >= 25:
                    raise RuntimeError("25 consecutive estate failures; stopping") from exc
            if index % 50 == 0:
                self._progress(
                    phase="estates",
                    done=index,
                    total=len(urls),
                    parsed=len(seen),
                    errors=self.errors,
                )
        return {"estates": len(seen), "errors": self.errors}

    # --------------------------------------------------------------- run
    def crawl_full(self) -> dict[str, Any]:
        urls = self.sitemap_urls()
        listings, estates = self.split_urls(urls)
        print(f"sitemap: {len(urls)} URLs -> {len(listings)} listings, {len(estates)} estates", flush=True)
        self._progress(phase="start", total_urls=len(urls), listings_total=len(listings), estates_total=len(estates))

        listing_result = self.crawl_listings_full(listings)
        estate_result = self.crawl_estates_full(estates)
        summary = {
            "generated_at": _now(),
            "sitemap_urls": len(urls),
            "listings_total": len(listings),
            "estates_total": len(estates),
            "listings_parsed": listing_result["listings"],
            "estates_parsed": estate_result["estates"],
            "errors": self.errors,
            "elapsed_seconds": round(time.monotonic() - self.started, 1),
        }
        write_json(self.root / "full_crawl_summary.json", summary)
        return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl the full residential Squarefoot sitemap")
    parser.add_argument("--delay", type=float, default=1.2, help="seconds between requests")
    parser.add_argument("--dry-run", action="store_true", help="only list sitemap counts")
    args = parser.parse_args()

    crawler = FullCrawler(delay=args.delay)
    if args.dry_run:
        listings, estates = crawler.split_urls(crawler.sitemap_urls())
        print(f"listings={len(listings)} estates={len(estates)}")
        return
    crawler.crawl_full()


if __name__ == "__main__":
    main()
