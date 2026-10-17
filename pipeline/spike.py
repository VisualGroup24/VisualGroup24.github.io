"""Phase 0 feasibility spike for the HK Housing Atlas.

Fetches a small, representative set of Squarefoot pages through the same
politeness/caching pattern the real crawler will use, then extracts the fields
the dashboard depends on. Standard library only: this must run before the
pipeline dependencies are installed.

Usage:
    py -3.13 pipeline/spike.py
    py -3.13 pipeline/spike.py --refresh
"""

from __future__ import annotations

import argparse
import gzip
import html as html_module
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "spike"
RAW.mkdir(parents=True, exist_ok=True)

BASE = "https://www.squarefoot.com.hk"
UA = "HKHousingAtlas/1.0 (academic project; phase-0 spike)"
DELAY_SECONDS = 1.4

PAGES = [
    ("buy_wanchai_mountainview", f"{BASE}/en/buy/apartment/property-104655"),
    ("buy_sheungwan_104236", f"{BASE}/en/buy/apartment/property-104236"),
    ("buy_sheungwan_104601", f"{BASE}/en/buy/apartment/property-104601"),
    ("rent_kennedytown_cadogan", f"{BASE}/en/rent/apartment/property-104666"),
    ("rent_104665", f"{BASE}/en/rent/apartment/property-104665"),
    ("rent_104664", f"{BASE}/en/rent/apartment/property-104664"),
    ("estate_taikoo_shing", f"{BASE}/en/estate/detail/taikoo-shing-1140"),
    ("estate_wings_at_sea", f"{BASE}/en/estate/detail/wings-at-sea-23595"),
    ("estate_cadogan", f"{BASE}/en/estate/detail/cadogan-7648"),
    ("estate_taikoo_tx_sale", f"{BASE}/en/estate/detail/taikoo-shing-1140/transaction"),
    ("estate_taikoo_tx_rent", f"{BASE}/en/estate/detail/taikoo-shing-1140/transaction/rent"),
    ("buy_index_central", f"{BASE}/en/buy/a1/dg2"),
    ("buy_index_central_p2", f"{BASE}/en/buy/a1/dg2/page-2"),
    ("rent_index_kennedy", f"{BASE}/en/rent/a1/dg121"),
    ("buy_index_wanchai", f"{BASE}/en/buy/a1/dg4"),
    ("estate_index", f"{BASE}/en/estate/"),
    ("estate_south_horizons", f"{BASE}/en/estate/detail/south-horizons-350"),
    ("estate_chi_fu", f"{BASE}/en/estate/detail/chi-fu-fa-yuen-240"),
]


def strip_tags(value: str) -> str:
    value = re.sub(r"<script.*?</script>", " ", value, flags=re.S | re.I)
    value = re.sub(r"<style.*?</style>", " ", value, flags=re.S | re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    return html_module.unescape(re.sub(r"\s+", " ", value)).strip()


def fetch(name: str, url: str, refresh: bool) -> tuple[str, bool]:
    path = RAW / f"{name}.html.gz"
    if path.exists() and not refresh:
        return gzip.decompress(path.read_bytes()).decode("utf-8", "replace"), True
    time.sleep(DELAY_SECONDS)
    request = Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    with urlopen(request, timeout=90) as response:
        payload = response.read()
    path.write_bytes(gzip.compress(payload))
    return payload.decode("utf-8", "replace"), False


def table_rows(page: str) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, flags=re.S | re.I):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.S | re.I)
        if len(cells) >= 2:
            rows.append((strip_tags(cells[0]), strip_tags(cells[1])))
    return rows


def parse_listing(html: str) -> dict:
    rows = table_rows(html)
    wanted = {
        "Sell Price",
        "Monthly Rental",
        "Gross Area",
        "Saleable Area",
        "Estate",
        "Floor zone",
        "Room and Bathroom",
        "Kitchen type",
        "Pri School Net",
        "Sec School Net",
        "Address",
        "Created",
        "Updated",
        "Rental Price includes",
    }
    fields = {label: value for label, value in rows if label in wanted}
    coords = re.search(r"initNearbyMap\(([-\d.]+),([-\d.]+)\)", html)
    listing_id = re.search(r"Id#\s*(\d+)", html)
    title = re.search(r"<title>(.*?)</title>", html, flags=re.S | re.I)
    return {
        "title": strip_tags(title.group(1)) if title else None,
        "listing_id": listing_id.group(1) if listing_id else None,
        "fields": fields,
        "lat": float(coords.group(1)) if coords else None,
        "lon": float(coords.group(2)) if coords else None,
    }


def parse_estate(html: str) -> dict:
    eid_match = re.search(r"labels_estate_deal_q_(\d+)", html)
    series: dict = {"estate_chart_id": eid_match.group(1) if eid_match else None}
    if eid_match:
        eid = eid_match.group(1)
        labels = re.findall(
            rf"labels_estate_deal_q_{eid}\.push\('([^']+)'\)", html
        )
        start = html.find(f"const data_estate_deal_q_{eid}")
        block = html[start:] if start >= 0 else ""
        dataset_labels = re.findall(r"label:\s*'([^']+)'", block)
        arrays = re.findall(r"data:\s*\[([^\]]*)\]", block, flags=re.S)
        datasets = []
        for label, raw_array in zip(dataset_labels, arrays):
            values = [
                float(value)
                for value in re.findall(r"-?\d+(?:\.\d+)?", raw_array)
            ]
            datasets.append(
                {
                    "label": label,
                    "n": len(values),
                    "first": values[0] if values else None,
                    "last": values[-1] if values else None,
                }
            )
        series.update(
            {
                "labels_n": len(labels),
                "labels_first": labels[0] if labels else None,
                "labels_last": labels[-1] if labels else None,
                "datasets": datasets,
            }
        )

    rental_index = html.find("Latest Rental Market")
    rental_text = strip_tags(html[rental_index : rental_index + 5000]) if rental_index >= 0 else None
    title = re.search(r"<title>(.*?)</title>", html, flags=re.S | re.I)
    district = re.search(r"<title>[^<]*\| ([^|<]+) \| Squarefoot", html)
    dates = re.findall(r"20\d{2}-\d{2}-\d{2}", html)
    return {
        "title": strip_tags(title.group(1)) if title else None,
        "title_district": district.group(1).strip() if district else None,
        "series": series,
        "rental_text": rental_text,
        "transaction_dates": {"count": len(dates), "first": dates[0] if dates else None, "last": dates[-1] if dates else None},
        "price_trend_text": strip_tags(html[html.find("Latest Property Price Trend") : html.find("Latest Property Price Trend") + 2500])
        if "Latest Property Price Trend" in html
        else None,
    }


def parse_index(html: str) -> dict:
    item_list = re.search(
        r'"@type":"ItemList".*?"numberOfItems":"?(\d+)"?', html, flags=re.S
    )
    return {
        "number_of_items": int(item_list.group(1)) if item_list else None,
        "property_links": len(set(re.findall(r"/en/(?:buy|rent)/apartment/property-(\d+)", html))),
        "estate_links": len(set(re.findall(r"/en/estate/detail/[^\"']+", html))),
        "has_page_2": "/page-2" in html,
        "has_search_form": "searchBoxForm" in html,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()

    report: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "pages": {},
    }
    for name, url in PAGES:
        print(f"fetch {name} ...", flush=True)
        html, cached = fetch(name, url, args.refresh)
        entry = {"url": url, "cached": cached, "bytes": len(html)}

        if "/property-" in url:
            entry.update(parse_listing(html))
        elif "/estate/detail/" in url and "/transaction" not in url:
            entry.update(parse_estate(html))
        elif "/transaction" in url:
            dates = re.findall(r"20\d{2}-\d{2}-\d{2}", html)
            entry.update(
                {
                    "transaction_dates": {
                        "count": len(dates),
                        "first": dates[0] if dates else None,
                        "last": dates[-1] if dates else None,
                    },
                    "land_registry_rows": html.count("Land Registry"),
                    "market_info_rows": html.count("Market Info"),
                }
            )
        else:
            entry.update(parse_index(html))
        report["pages"][name] = entry

    out = RAW / "report.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    for name, entry in report["pages"].items():
        print(f"\n=== {name} ===")
        if "fields" in entry:
            print("title:", entry.get("title"))
            print("id:", entry.get("listing_id"), "coords:", entry.get("lat"), entry.get("lon"))
            for key, value in entry["fields"].items():
                print(f"  {key}: {value[:160]}")
        elif "series" in entry:
            print("title:", entry.get("title"))
            print("series:", json.dumps(entry["series"], ensure_ascii=False)[:800])
            print("rental:", (entry.get("rental_text") or "")[:500])
            print("txn dates:", entry.get("transaction_dates"))
        elif "transaction_dates" in entry:
            print(entry)
        else:
            print(entry)

    print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
