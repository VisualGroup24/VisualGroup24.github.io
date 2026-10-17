"""Polite Squarefoot crawler.

Scope and behaviour:
  * discover district groups from the buy/rent region pages
  * map each group to a HAD district using listing coordinates
  * sample current sale/rent listings per district, parse attributes
  * crawl estate pages for the estates that appear in those listings
  * cache gzipped HTML, resume from JSONL, one request at a time

The crawler never follows search-result query strings (disallowed by robots.txt)
and never fetches login, agent or contact pages.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from pipeline.common import load_config, path_for, write_json
from pipeline.sources.geo import district_for_point
from pipeline.sources.squarefoot_parse import parse_estate, parse_index, parse_listing

REGIONS = [
    ("a1", "HK Island"),
    ("a2", "Kowloon"),
    ("a3", "New Territories"),
    ("a170", "Outlying Islands"),
]

# Squarefoot's district groups are finer than the 18 HAD districts. This
# mapping was reviewed against the group labels and HAD boundaries; coordinate
# assignment is still used as a fallback for any unmapped group.
GROUP_DISTRICT = {
    "dg14": "D", "dg13": "D", "dg12": "C", "dg11": "C", "dg10": "C",
    "dg9": "C", "dg8": "C", "dg124": "C", "dg7": "C", "dg6": "B",
    "dg5": "B", "dg4": "B", "dg3": "A", "dg2": "A", "dg1": "A",
    "dg121": "A",
    "dg115": "G", "dg31": "G", "dg30": "E", "dg120": "E", "dg111": "E",
    "dg110": "E", "dg29": "E", "dg28": "E", "dg109": "S", "dg107": "F",
    "dg106": "F", "dg27": "F", "dg26": "F", "dg119": "F", "dg118": "G",
    "dg25": "G", "dg32": "H", "dg108": "G", "dg116": "G", "dg24": "G",
    "dg23": "H", "dg122": "H", "dg22": "J", "dg21": "J", "dg123": "J",
    "dg20": "J",
    "dg127": "N", "dg51": "S", "dg50": "S", "dg49": "K", "dg114": "K",
    "dg52": "L", "dg48": "L", "dg113": "M", "dg47": "M", "dg112": "N",
    "dg46": "N", "dg45": "P", "dg44": "R", "dg43": "R", "dg41": "Q",
    "dg40": "Q", "dg64": "T", "dg63": "T", "dg117": "T", "dg62": "T",
    "dg61": "T", "dg125": "T", "dg60": "K",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _majority(values: Iterable[str | None]) -> str | None:
    counts: dict[str, int] = {}
    for value in values:
        if value:
            counts[value] = counts.get(value, 0) + 1
    return max(counts, key=counts.get) if counts else None


class SquarefootCrawler:
    def __init__(
        self,
        *,
        sale_per_district: int = 120,
        rent_per_district: int = 80,
        max_estates: int = 1200,
        max_index_pages: int | None = None,
        refresh: bool = False,
        delay: float | None = None,
    ) -> None:
        self.config = load_config()
        squarefoot = self.config["squarefoot"]
        self.base = squarefoot["base_url"].rstrip("/")
        self.sale_target = sale_per_district
        self.rent_target = rent_per_district
        self.max_estates = max_estates
        self.max_index_pages = max_index_pages or int(squarefoot["max_index_pages"])
        self.refresh = refresh
        self.delay = float(squarefoot["delay_seconds"] if delay is None else delay)

        root = path_for("raw") / "squarefoot"
        self.root = root
        self.html_dir = root / "html"
        self.html_dir.mkdir(parents=True, exist_ok=True)
        self.groups_path = root / "groups.json"
        self.listings_path = root / "listings.jsonl"
        self.estates_path = root / "estates.jsonl"
        self.summary_path = root / "crawl_summary.json"

        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": self.config["http"]["user_agent"],
                "Accept-Language": "en,zh-Hant;q=0.8",
            }
        )
        self._last_request = 0.0
        self._seen_urls: set[str] = set()

    # ------------------------------------------------------------------ HTTP
    def _cache_paths(self, url: str) -> tuple[Path, Path]:
        key = hashlib.sha1(url.encode("utf-8")).hexdigest()
        return self.html_dir / f"{key}.html.gz", self.html_dir / f"{key}.meta.json"

    def fetch(self, url: str, *, refresh: bool | None = None) -> str:
        refresh = self.refresh if refresh is None else refresh
        html_path, meta_path = self._cache_paths(url)
        if html_path.exists() and not refresh:
            return gzip.decompress(html_path.read_bytes()).decode("utf-8", "replace")

        wait = self.delay - (time.monotonic() - self._last_request)
        if wait > 0:
            time.sleep(wait)
        last_error: Exception | None = None
        for attempt in range(1, 4):
            try:
                response = self.session.get(url, timeout=90)
                self._last_request = time.monotonic()
                if response.status_code in {403, 429}:
                    raise RuntimeError(f"Squarefoot blocked request ({response.status_code}) for {url}")
                if response.status_code in {500, 502, 503, 504}:
                    time.sleep(attempt * 3)
                    last_error = requests.HTTPError(f"{response.status_code} for {url}", response=response)
                    continue
                response.raise_for_status()
                html_path.write_bytes(gzip.compress(response.content))
                write_json(
                    meta_path,
                    {
                        "url": url,
                        "status": response.status_code,
                        "fetched_at": _now(),
                        "sha256": hashlib.sha256(response.content).hexdigest(),
                        "bytes": len(response.content),
                    },
                )
                return response.text
            except requests.RequestException as exc:
                last_error = exc
                time.sleep(attempt * 2)
        raise RuntimeError(f"failed to fetch {url}: {last_error}")

    # --------------------------------------------------------------- groups
    def discover_groups(self, tenure: str) -> list[dict[str, Any]]:
        groups: dict[str, dict[str, Any]] = {}
        for region_code, region_name in REGIONS:
            url = f"{self.base}/en/{tenure}/{region_code}"
            try:
                html = self.fetch(url)
            except RuntimeError as exc:
                print(f"  ! cannot read {url}: {exc}")
                continue
            pattern = re.compile(
                rf'href=["\'](?:https://www\.squarefoot\.com\.hk)?/en/{tenure}/{region_code}/(dg\d+)["\'][^>]*>(.*?)</a>',
                flags=re.S | re.I,
            )
            for match in pattern.finditer(html):
                code, label_html = match.group(1), match.group(2)
                if code in groups:
                    continue
                label = re.sub(r"<[^>]+>", " ", label_html)
                label = re.sub(r"\s+", " ", label).strip()
                if not label:
                    continue
                groups[code] = {
                    "tenure": tenure,
                    "region_code": region_code,
                    "region_name": region_name,
                    "dg": code,
                    "label": label,
                    "url": f"{self.base}/en/{tenure}/{region_code}/{code}",
                }
        return list(groups.values())

    def map_groups(self) -> dict[str, Any]:
        """Assign each district group to a HAD district using listing coordinates."""
        if self.groups_path.exists() and not self.refresh:
            cached = json.loads(self.groups_path.read_text(encoding="utf-8"))
            if cached.get("groups"):
                return cached

        sale_groups = self.discover_groups("buy")
        rent_groups = self.discover_groups("rent")
        print(f"groups: {len(sale_groups)} buy, {len(rent_groups)} rent")

        all_groups: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()
        for group in sale_groups + rent_groups:
            key = (group["tenure"], group["dg"])
            if key in seen:
                continue
            seen.add(key)
            record = dict(group)
            record.setdefault("district_code", None)
            record.setdefault("district_name", None)
            all_groups.append(record)

        for group in all_groups:
            code = GROUP_DISTRICT.get(group["dg"])
            if code:
                group["district_code"] = code
                group["district_name"] = district_for_point_name(code)
                continue
            if group["district_code"]:
                continue
            tenure = group["tenure"]
            try:
                index = parse_index(
                    self.fetch(group["url"]),
                    group["url"],
                )
            except Exception as exc:  # noqa: BLE001
                print(f"  ! group page failed {group['url']}: {exc}")
                continue
            sample = index["items"][:3]
            districts: list[str | None] = []
            for item in sample:
                try:
                    listing = parse_listing(self.fetch(item), item)
                except Exception as exc:  # noqa: BLE001
                    print(f"  ! listing failed {item}: {exc}")
                    continue
                district = district_for_point(listing.get("lat"), listing.get("lon"))
                if district:
                    districts.append(district["district_code"])
                    break  # one confirmed point is enough for a group
            if districts:
                code = _majority(districts)
                district = district_for_point_name(code)
                group["district_code"] = code
                group["district_name"] = district

        payload = {"generated_at": _now(), "groups": all_groups}
        write_json(self.groups_path, payload)
        mapped = sum(1 for group in all_groups if group["district_code"])
        print(f"mapped {mapped}/{len(all_groups)} groups to districts")
        return payload

    # ------------------------------------------------------------- listings
    def _load_jsonl(self, path: Path) -> list[dict[str, Any]]:
        if not path.exists():
            return []
        rows: list[dict[str, Any]] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return rows

    def _append_jsonl(self, path: Path, row: dict[str, Any]) -> None:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    def _group_pages(self, group: dict[str, Any]) -> Iterable[list[str]]:
        page = 1
        next_url: str | None = group["url"]
        while next_url and page <= self.max_index_pages:
            html = self.fetch(next_url)
            index = parse_index(html, next_url)
            yield index["items"]
            page += 1
            if not index["has_next"]:
                break
            next_url = index["next_url"] or f"{group['url']}/page-{page}"

    def crawl_listings(self) -> dict[str, Any]:
        existing = self._load_jsonl(self.listings_path)
        by_id = {str(row.get("listing_id")): row for row in existing if row.get("listing_id")}
        for row in existing:
            if row.get("url"):
                self._seen_urls.add(row["url"])

        counts: dict[tuple[str, str], int] = {}
        for row in existing:
            key = (row.get("listing_type"), row.get("district_code"))
            counts[key] = counts.get(key, 0) + 1

        groups_payload = self.map_groups()
        groups = [group for group in groups_payload["groups"] if group.get("district_code")]
        # One group may appear for both tenures; keep each tenure separately.
        for tenure, target in (("sale", self.sale_target), ("rent", self.rent_target)):
            tenure_key = "buy" if tenure == "sale" else "rent"
            tenure_groups = [group for group in groups if group["tenure"] == tenure_key]
            by_district: dict[str, list[dict[str, Any]]] = {}
            for group in tenure_groups:
                by_district.setdefault(group["district_code"], []).append(group)

            for district_code, district_groups in sorted(by_district.items()):
                have = counts.get((tenure, district_code), 0)
                if have >= target:
                    continue
                print(f"\n{tenure} {district_code}: {have}/{target}")
                for group in district_groups:
                    if counts.get((tenure, district_code), 0) >= target:
                        break
                    print(f"  group {group['dg']} {group['label']}")
                    for items in self._group_pages(group):
                        for url in items:
                            if counts.get((tenure, district_code), 0) >= target:
                                break
                            if url in self._seen_urls:
                                continue
                            self._seen_urls.add(url)
                            try:
                                listing = parse_listing(self.fetch(url), url)
                            except Exception as exc:  # noqa: BLE001
                                print(f"    ! {url}: {exc}")
                                continue
                            district = district_for_point(listing.get("lat"), listing.get("lon"))
                            code = district["district_code"] if district else group["district_code"]
                            name = district["name_en"] if district else group["district_name"]
                            listing.update(
                                {
                                    "snapshot_date": _now()[:10],
                                    "fetched_at": _now(),
                                    "district_code": code,
                                    "district_name": name,
                                    "region": district["region"] if district else group["region_name"],
                                    "source_group": group["dg"],
                                }
                            )
                            if listing.get("listing_id") and str(listing["listing_id"]) in by_id:
                                continue
                            self._append_jsonl(self.listings_path, listing)
                            if listing.get("listing_id"):
                                by_id[str(listing["listing_id"])] = listing
                            counts[(tenure, code)] = counts.get((tenure, code), 0) + 1
                            if code == district_code:
                                done = counts[(tenure, district_code)]
                                if done % 10 == 0:
                                    print(f"    {done}/{target}")
                        if counts.get((tenure, district_code), 0) >= target:
                            break

        summary = {
            "generated_at": _now(),
            "listings": len(by_id),
            "counts": {f"{tenure}:{code}": count for (tenure, code), count in sorted(counts.items())},
        }
        return summary

    # -------------------------------------------------------------- estates
    def crawl_estates(self) -> dict[str, Any]:
        listings = self._load_jsonl(self.listings_path)
        estate_urls: dict[str, str] = {}
        for listing in listings:
            url = listing.get("estate_url")
            if url:
                estate_urls[url] = listing.get("district_code") or ""

        existing = self._load_jsonl(self.estates_path)
        done = {row.get("estate_id") for row in existing if row.get("estate_id")}
        print(f"\nestates: {len(done)} cached, {len(estate_urls)} candidates")

        count = 0
        for url, district_code in sorted(estate_urls.items()):
            if count >= self.max_estates:
                break
            try:
                estate = parse_estate(self.fetch(url), url)
            except Exception as exc:  # noqa: BLE001
                print(f"  ! estate {url}: {exc}")
                continue
            if estate.get("estate_id") in done:
                continue
            district = district_for_point(estate.get("lat"), estate.get("lon"))
            estate.update(
                {
                    "snapshot_date": _now()[:10],
                    "fetched_at": _now(),
                    "district_code": district["district_code"] if district else district_code,
                    "district_name": district["name_en"] if district else None,
                    "region": district["region"] if district else estate.get("region_label"),
                }
            )
            self._append_jsonl(self.estates_path, estate)
            if estate.get("estate_id"):
                done.add(estate["estate_id"])
            count += 1
            if count % 20 == 0:
                print(f"  estates parsed: {count}")

        return {"generated_at": _now(), "estates": len(done)}

    # ------------------------------------------------------------------ run
    def run(self) -> dict[str, Any]:
        listings = self.crawl_listings()
        estates = self.crawl_estates()
        summary = {
            "generated_at": _now(),
            "listings": listings,
            "estates": estates,
            "targets": {
                "sale_per_district": self.sale_target,
                "rent_per_district": self.rent_target,
                "max_estates": self.max_estates,
            },
        }
        write_json(self.summary_path, summary)
        print("\n" + json.dumps(summary, indent=2)[:2000])
        return summary


def district_for_point_name(code: str | None) -> str | None:
    if not code:
        return None
    mapping = {
        "A": "Central and Western",
        "B": "Wan Chai",
        "C": "Eastern",
        "D": "Southern",
        "E": "Yau Tsim Mong",
        "F": "Sham Shui Po",
        "G": "Kowloon City",
        "H": "Wong Tai Sin",
        "J": "Kwun Tong",
        "K": "Tsuen Wan",
        "L": "Tuen Mun",
        "M": "Yuen Long",
        "N": "North",
        "P": "Tai Po",
        "Q": "Sai Kung",
        "R": "Sha Tin",
        "S": "Kwai Tsing",
        "T": "Islands",
    }
    return mapping.get(code)


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl Squarefoot listings and estates")
    parser.add_argument("--sale-per-district", type=int, default=120)
    parser.add_argument("--rent-per-district", type=int, default=80)
    parser.add_argument("--estates", type=int, default=1200)
    parser.add_argument("--max-index-pages", type=int, default=None)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--delay", type=float, default=None)
    args = parser.parse_args()

    crawler = SquarefootCrawler(
        sale_per_district=args.sale_per_district,
        rent_per_district=args.rent_per_district,
        max_estates=args.estates,
        max_index_pages=args.max_index_pages,
        refresh=args.refresh,
        delay=args.delay,
    )
    crawler.run()


if __name__ == "__main__":
    main()
