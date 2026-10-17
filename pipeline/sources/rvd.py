"""Rating and Valuation Department (RVD) series.

Files are legacy .xls workbooks with merged headers. We locate the year/month
columns and the class columns by fixed positions verified against the
published workbooks, then melt to a tidy month x class frame.

Coverage observed (Oct 2026):
    price/rental indices: 1993-01 .. latest
    yields:               1999-01 .. latest
    sales:                2002-01 .. latest
    completions:          1985 .. latest (annual)
"""

from __future__ import annotations

import io
import re
from pathlib import Path
from typing import Any

import pandas as pd

from pipeline.common import HttpClient, path_for

BASE = "https://www.rvd.gov.hk/doc/en/statistics"

FILES = {
    "rents_by_class": f"{BASE}/his_data_1.xls",
    "prices_by_class": f"{BASE}/his_data_2.xls",
    "rental_indices": f"{BASE}/his_data_3.xls",
    "price_indices": f"{BASE}/his_data_4.xls",
    "selected_developments": f"{BASE}/his_data_5.xls",
    "yields": f"{BASE}/his_data_15.xls",
    "sales": f"{BASE}/his_data_16.xls",
    "completions": f"{BASE}/private_domestic.xls",
}

INDEX_COLUMNS = {
    "A": 8,
    "B": 11,
    "C": 14,
    "D": 17,
    "E": 20,
    "A,B&C": 23,
    "D&E": 26,
    "ALL": 29,
}
YIELD_COLUMNS = {"A": 8, "B": 11, "C": 14, "D": 17, "E": 20}
COMPLETION_COLUMNS = {"A": 4, "B": 6, "C": 8, "D": 10, "E": 12, "TOTAL": 14}


def to_number(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "").replace(" ", "")
    text = text.strip("()")
    if not text or text in {"-", "--", "*", "N/A", "n/a"}:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    return float(match.group(0)) if match else None


def to_year(value: Any) -> int | None:
    number = to_number(value)
    if number is None:
        return None
    year = int(number)
    return year if 1900 <= year <= 2100 else None


def to_month(value: Any) -> int | None:
    number = to_number(value)
    if number is None:
        return None
    month = int(number)
    return month if 1 <= month <= 12 else None


def _read(path: Path) -> pd.DataFrame:
    return pd.read_excel(io.BytesIO(path.read_bytes()), sheet_name=0, header=None, engine="xlrd")


def _melt(
    frame: pd.DataFrame,
    columns: dict[str, int],
    *,
    start_row: int,
    label_name: str,
    value_name: str,
) -> pd.DataFrame:
    records: list[dict[str, Any]] = []
    year: int | None = None
    for row in range(start_row, len(frame)):
        candidate_year = to_year(frame.iat[row, 1])
        if candidate_year:
            year = candidate_year
        month = to_month(frame.iat[row, 5])
        if year is None or month is None:
            continue
        for label, column in columns.items():
            value = to_number(frame.iat[row, column])
            if value is None:
                continue
            records.append(
                {
                    "month": f"{year:04d}-{month:02d}",
                    label_name: label,
                    value_name: value,
                }
            )
    result = pd.DataFrame(records)
    if not result.empty:
        result = result.drop_duplicates(["month", label_name], keep="last")
    return result


def fetch_raw(client: HttpClient) -> dict[str, Path]:
    raw_dir = path_for("raw") / "rvd"
    raw_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    for name, url in FILES.items():
        payload = client.get_bytes(url, suffix="xls")
        path = raw_dir / f"{name}.xls"
        if not path.exists() or path.stat().st_size != len(payload):
            path.write_bytes(payload)
        paths[name] = path
    return paths


def parse_indices(path: Path) -> pd.DataFrame:
    frame = _read(path)
    return _melt(
        frame,
        INDEX_COLUMNS,
        start_row=10,
        label_name="property_class",
        value_name="index_value",
    )


def parse_yields(path: Path) -> pd.DataFrame:
    frame = _read(path)
    return _melt(
        frame,
        YIELD_COLUMNS,
        start_row=9,
        label_name="property_class",
        value_name="yield_pct",
    )


def parse_sales(path: Path) -> pd.DataFrame:
    frame = _read(path)
    records: list[dict[str, Any]] = []
    year: int | None = None
    for row in range(8, len(frame)):
        candidate_year = to_year(frame.iat[row, 1])
        if candidate_year:
            year = candidate_year
        month = to_month(frame.iat[row, 5])
        if year is None or month is None:
            continue
        primary_count = to_number(frame.iat[row, 8])
        primary_value = to_number(frame.iat[row, 12])
        secondary_count = to_number(frame.iat[row, 15])
        secondary_value = to_number(frame.iat[row, 19])
        if all(value is None for value in (primary_count, primary_value, secondary_count, secondary_value)):
            continue
        records.append(
            {
                "month": f"{year:04d}-{month:02d}",
                "primary_count": primary_count,
                "primary_value_m": primary_value,
                "secondary_count": secondary_count,
                "secondary_value_m": secondary_value,
                "total_count": (primary_count or 0) + (secondary_count or 0)
                if primary_count is not None or secondary_count is not None
                else None,
                "total_value_m": (primary_value or 0) + (secondary_value or 0)
                if primary_value is not None or secondary_value is not None
                else None,
            }
        )
    return pd.DataFrame(records).drop_duplicates("month", keep="last")


def parse_completions(path: Path) -> pd.DataFrame:
    frame = _read(path)
    records: list[dict[str, Any]] = []
    for row in range(15, len(frame)):
        year = to_year(frame.iat[row, 2])
        if year is None:
            continue
        for label, column in COMPLETION_COLUMNS.items():
            value = to_number(frame.iat[row, column])
            if value is None:
                continue
            records.append({"year": year, "property_class": label, "completions": value})
    return pd.DataFrame(records).drop_duplicates(["year", "property_class"], keep="last")


def run(client: HttpClient) -> dict[str, pd.DataFrame]:
    paths = fetch_raw(client)
    price = parse_indices(paths["price_indices"]).rename(columns={"index_value": "price_index"})
    rent = parse_indices(paths["rental_indices"]).rename(columns={"index_value": "rent_index"})
    indices = price.merge(rent, on=["month", "property_class"], how="outer")

    yields = parse_yields(paths["yields"])
    sales = parse_sales(paths["sales"])
    completions = parse_completions(paths["completions"])

    interim = path_for("interim")
    indices.to_csv(interim / "rvd_indices.csv", index=False, encoding="utf-8")
    yields.to_csv(interim / "rvd_yields.csv", index=False, encoding="utf-8")
    sales.to_csv(interim / "rvd_sales.csv", index=False, encoding="utf-8")
    completions.to_csv(interim / "rvd_completions.csv", index=False, encoding="utf-8")

    print(
        f"RVD: indices {len(indices)} rows "
        f"({indices['month'].min()} .. {indices['month'].max()}); "
        f"yields {len(yields)}; sales {len(sales)}; completions {len(completions)}"
    )
    return {
        "indices": indices,
        "yields": yields,
        "sales": sales,
        "completions": completions,
    }
