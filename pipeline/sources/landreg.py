"""Land Registry monthly statistics (data.gov.hk dataset hk-lr-data4-landreg).

The dataset ships one JSON file per month from 2021 onwards. Each file is a
flat list of descriptions with unit and consideration figures; we extract the
ASP counts by the ten published areas plus the residential/primary/secondary
summary rows.
"""

from __future__ import annotations

import re
from typing import Any

import pandas as pd

from pipeline.common import HttpClient, path_for

PACKAGE_URL = "https://data.gov.hk/en-data/api/3/action/package_show?id=hk-lr-data4-landreg"

AREA_ALIASES = {
    "Hong Kong": "Hong Kong",
    "Kowloon": "Kowloon",
    "Island": "HK Island",
    "North": "North",
    "Sai Kung": "Sai Kung",
    "Shatin": "Sha Tin",
    "Tai Po": "Tai Po",
    "Tsuen Wan": "Tsuen Wan",
    "Tuen Mun": "Tuen Mun",
    "Yuen Long": "Yuen Long",
}

SUMMARY_PATTERNS = {
    "residential_asp": r"Number of ASP for Residential Building Units",
    "non_residential_asp": r"Number of ASP for Non-Residential Building Units",
    "primary_sales": r"Number of Primary Sales for ASP Residential Building Units",
    "secondary_sales": r"Number of Secondary Sales for ASP Residential Building Units",
}


def _to_number(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).replace(",", "").strip()
    if not text or text in {"-", "--"}:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    return float(match.group(0)) if match else None


def _resource_months(client: HttpClient) -> list[tuple[str, str]]:
    payload = client.get_json(PACKAGE_URL, suffix="json")
    resources = payload.get("result", {}).get("resources", [])
    months: dict[str, str] = {}
    for resource in resources:
        url = resource.get("url") or ""
        name = resource.get("name") or ""
        if not url.lower().endswith(".json"):
            continue
        match = re.search(r"/(\d{6})_data\.json", url)
        if not match:
            continue
        month = f"{match.group(1)[:4]}-{match.group(1)[4:]}"
        months[month] = url
    if not months:
        raise RuntimeError("no JSON resources found in Land Registry package")
    return sorted(months.items())


def _parse_month(payload: list[dict[str, Any]], month: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    area_rows: list[dict[str, Any]] = []
    summary: dict[str, Any] = {"month": month}
    for row in payload:
        description = str(row.get("Description") or "")
        units = _to_number(row.get("Units"))
        if units is None:
            continue
        area_match = re.match(r"Number of (.+?) transactions for ASP building units", description)
        if area_match:
            raw_area = area_match.group(1)
            area = AREA_ALIASES.get(raw_area, raw_area)
            area_rows.append({"month": month, "area": area, "asp_count": units})
            continue
        for key, pattern in SUMMARY_PATTERNS.items():
            if re.match(pattern, description):
                summary[key] = units
                break
    return area_rows, summary


def run(client: HttpClient) -> dict[str, pd.DataFrame]:
    months = _resource_months(client)
    area_records: list[dict[str, Any]] = []
    summaries: list[dict[str, Any]] = []
    for month, url in months:
        payload = client.get_json(url, suffix="json")
        if not isinstance(payload, list):
            continue
        rows, summary = _parse_month(payload, month)
        area_records.extend(rows)
        summaries.append(summary)

    area = pd.DataFrame(area_records).drop_duplicates(["month", "area"], keep="last")
    summary_frame = pd.DataFrame(summaries).drop_duplicates("month", keep="last")

    interim = path_for("interim")
    area.to_csv(interim / "landreg_area.csv", index=False, encoding="utf-8")
    summary_frame.to_csv(interim / "landreg_summary.csv", index=False, encoding="utf-8")

    print(
        f"Land Registry: {len(months)} months "
        f"({months[0][0]} .. {months[-1][0]}); "
        f"{len(area)} area rows; {len(summary_frame)} summary rows"
    )
    return {"area": area, "summary": summary_frame}
