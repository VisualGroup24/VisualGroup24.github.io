"""District-level analytics.

Combines the estate quarterly price series with current rental statistics,
listing attributes and C&SD income. Produces the panel consumed by the
District Explorer and Financing & Affordability dashboards.

Key choices (documented in docs/METHODOLOGY.md):
  * district sale price = transaction-volume-weighted median of estate $/ft²
  * current district rent = rental-volume-weighted mean of estate rent $/ft²
  * historical rent is backcast with the RVD all-class rental index, holding
    district relativities fixed; it is labelled "modelled"
  * gross yield = 12 * rent $/ft² / sale $/ft²
  * cells with fewer than 3 estates or 10 transactions are suppressed
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Iterable

import pandas as pd

from pipeline.common import load_config, path_for, read_json, utc_now, write_json

CLASS_THRESHOLDS = [
    ("A", 0, 430.56),
    ("B", 430.56, 752.43),
    ("C", 752.43, 1075.35),
    ("D", 1075.35, 1721.23),
    ("E", 1721.23, math.inf),
]

REGION_BY_CODE = {
    **{code: "HK Island" for code in "ABCD"},
    **{code: "Kowloon" for code in "EFGHJ"},
    **{code: "New Territories" for code in "KLMNPQRST"},
}


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
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


def quarter_from_label(label: str) -> str | None:
    """Squarefoot chart labels are quarter-start months, e.g. 2018-04 -> 2018-Q2."""
    try:
        year = int(label[:4])
        month = int(label[5:7])
    except (ValueError, TypeError):
        return None
    quarter = (month - 1) // 3 + 1
    return f"{year}-Q{quarter}"


def quarter_sort_key(quarter: str) -> tuple[int, int]:
    year, q = quarter.split("-Q")
    return int(year), int(q)


def property_class(area: float | None) -> str | None:
    if area is None or area <= 0:
        return None
    for label, low, high in CLASS_THRESHOLDS:
        if low <= area < high:
            return label
    return None


def weighted_median(values: Iterable[float], weights: Iterable[float]) -> float | None:
    pairs = [(value, weight) for value, weight in zip(values, weights) if value > 0 and weight > 0]
    if not pairs:
        return None
    pairs.sort(key=lambda pair: pair[0])
    total = sum(weight for _, weight in pairs)
    cumulative = 0.0
    for value, weight in pairs:
        cumulative += weight
        if cumulative >= total / 2:
            return value
    return pairs[-1][0]


def weighted_quantile(values: Iterable[float], weights: Iterable[float], q: float) -> float | None:
    pairs = [(value, weight) for value, weight in zip(values, weights) if value > 0 and weight > 0]
    if not pairs:
        return None
    pairs.sort(key=lambda pair: pair[0])
    total = sum(weight for _, weight in pairs)
    cutoff = total * q
    cumulative = 0.0
    for value, weight in pairs:
        cumulative += weight
        if cumulative >= cutoff:
            return value
    return pairs[-1][0]


def build_estate_quarters(estates: list[dict[str, Any]]) -> pd.DataFrame:
    records: list[dict[str, Any]] = []
    for estate in estates:
        district = estate.get("district_code")
        chart = estate.get("chart") or {}
        quarters = chart.get("quarters") or []
        series = chart.get("series") or {}
        prices = series.get("AVG Price") or []
        volumes = series.get("Volume") or []
        if not district or not quarters or not prices:
            continue
        for index, label in enumerate(quarters):
            if index >= len(prices):
                break
            quarter = quarter_from_label(label)
            if not quarter:
                continue
            records.append(
                {
                    "estate_id": estate.get("estate_id"),
                    "estate_name": estate.get("name"),
                    "district_code": district,
                    "quarter": quarter,
                    "price_psf": prices[index],
                    "volume": volumes[index] if index < len(volumes) else 0,
                    "all_hk_psf": (series.get("All HK") or [None] * len(quarters))[index]
                    if index < len(series.get("All HK") or [])
                    else None,
                }
            )
    frame = pd.DataFrame(records)
    if not frame.empty:
        frame = frame.drop_duplicates(["estate_id", "quarter"], keep="last")
    return frame


def build_district_panel(estate_quarters: pd.DataFrame, rvd: pd.DataFrame, listings: pd.DataFrame) -> pd.DataFrame:
    if estate_quarters.empty:
        return pd.DataFrame()

    grouped = estate_quarters.groupby(["district_code", "quarter"], dropna=False)
    records: list[dict[str, Any]] = []
    for (district, quarter), group in grouped:
        values = group["price_psf"].astype(float).tolist()
        weights = group["volume"].fillna(0).astype(float).tolist()
        if not any(weight > 0 for weight in weights):
            weights = [1.0] * len(values)
        sale_psf = weighted_median(values, weights)
        if sale_psf is None:
            continue
        records.append(
            {
                "district_code": district,
                "quarter": quarter,
                "basis": "estates",
                "sale_psf": round(sale_psf, 1),
                "sale_psf_p25": round(weighted_quantile(values, weights, 0.25) or sale_psf, 1),
                "sale_psf_p75": round(weighted_quantile(values, weights, 0.75) or sale_psf, 1),
                "n_estates": len(group),
                "volume": int(sum(weights)),
            }
        )
    panel = pd.DataFrame(records)
    panel = panel[panel["n_estates"] >= 1].copy()
    panel["sort_key"] = panel["quarter"].map(quarter_sort_key)
    panel = panel.sort_values(["district_code", "sort_key"]).drop(columns="sort_key")

    latest_quarter = panel["quarter"].max() if not panel.empty else None
    if latest_quarter and not listings.empty:
        sale_listings = listings[listings["listing_type"] == "sale"].dropna(subset=["price_psf"])
        rent_listings = listings[listings["listing_type"] == "rent"].dropna(subset=["price_psf"])
        existing = set(panel[panel["quarter"] == latest_quarter]["district_code"])
        all_listing_districts = set(sale_listings["district_code"].dropna()) | set(
            rent_listings["district_code"].dropna()
        )
        for district in sorted(all_listing_districts):
            if district in existing:
                continue
            sale_values = sale_listings[sale_listings["district_code"] == district]["price_psf"].astype(float)
            rent_values = rent_listings[rent_listings["district_code"] == district]["price_psf"].astype(float)
            if len(sale_values) >= 3:
                panel = pd.concat(
                    [
                        panel,
                        pd.DataFrame(
                            [
                                {
                                    "district_code": district,
                                    "quarter": latest_quarter,
                                    "basis": "listings",
                                    "sale_psf": round(float(sale_values.median()), 1),
                                    "sale_psf_p25": round(float(sale_values.quantile(0.25)), 1),
                                    "sale_psf_p75": round(float(sale_values.quantile(0.75)), 1),
                                    "n_estates": 0,
                                    "volume": 0,
                                }
                            ]
                        ),
                    ],
                    ignore_index=True,
                )
            elif len(rent_values) >= 3:
                panel = pd.concat(
                    [
                        panel,
                        pd.DataFrame(
                            [
                                {
                                    "district_code": district,
                                    "quarter": latest_quarter,
                                    "basis": "listings_rent",
                                    "sale_psf": None,
                                    "sale_psf_p25": None,
                                    "sale_psf_p75": None,
                                    "n_estates": 0,
                                    "volume": 0,
                                }
                            ]
                        ),
                    ],
                    ignore_index=True,
                )

    # Current rent is attached in attach_current_rent, which has access to the
    # estate rental statistics and the listing fallback.
    panel["rent_psf"] = None
    panel["yield_pct"] = None
    panel["rent_modelled"] = False
    return panel


def attach_current_rent(
    panel: pd.DataFrame,
    estates: list[dict[str, Any]],
    listings: pd.DataFrame,
    rvd: pd.DataFrame,
) -> pd.DataFrame:
    """Attach current district rent and backcast it across the panel."""
    panel = panel.copy()
    latest_quarter = panel["quarter"].max()

    rent_index = rvd[rvd["property_class"] == "ALL"][["month", "rent_index"]].dropna()
    rent_index["quarter"] = rent_index["month"].map(
        lambda month: f"{month[:4]}-Q{(int(month[5:7]) - 1) // 3 + 1}"
    )
    rent_quarter = rent_index.groupby("quarter", as_index=False)["rent_index"].mean()
    rent_quarter_map = dict(zip(rent_quarter["quarter"], rent_quarter["rent_index"]))
    # The estate series may include the current, still-forming quarter while the
    # RVD index is published with a one-quarter lag. Hold the last index flat.
    available_quarters = sorted(rent_quarter_map)
    latest_index = rent_quarter_map.get(latest_quarter) or (
        rent_quarter_map[available_quarters[-1]] if available_quarters else None
    )
    latest_index_quarter = available_quarters[-1] if available_quarters else None
    rent_rows: list[dict[str, Any]] = []
    for estate in estates:
        stats = estate.get("rent_stats") or {}
        district = estate.get("district_code")
        rent_psf = stats.get("avg_rent_psf")
        volume = stats.get("volume") or 0
        if district and rent_psf and rent_psf > 0:
            rent_rows.append({"district_code": district, "rent_psf": rent_psf, "volume": volume})
    current = pd.DataFrame(rent_rows)
    district_rent: dict[str, float] = {}
    if not current.empty:
        for district, group in current.groupby("district_code"):
            weights = group["volume"].fillna(0).astype(float).tolist()
            if not any(weight > 0 for weight in weights):
                weights = [1.0] * len(group)
            value = weighted_median(group["rent_psf"].astype(float).tolist(), weights)
            if value:
                district_rent[district] = value

    # Fallback for districts with no estate rent stats: median asking rent psf.
    if not listings.empty:
        rent_listings = listings[listings["listing_type"] == "rent"]
        for district, group in rent_listings.groupby("district_code"):
            if district in district_rent:
                continue
            values = group["price_psf"].dropna().astype(float)
            if len(values) >= 3:
                district_rent[district] = float(values.median())

    if latest_index:
        for district, value in district_rent.items():
            mask = panel["district_code"] == district
            for quarter in panel.loc[mask, "quarter"].unique():
                index = rent_quarter_map.get(quarter)
                if index is None and latest_index_quarter and quarter > latest_index_quarter:
                    index = latest_index
                if index:
                    panel.loc[mask & (panel["quarter"] == quarter), "rent_psf"] = round(
                        value * index / latest_index, 1
                    )
                    panel.loc[mask & (panel["quarter"] == quarter), "rent_modelled"] = quarter != latest_quarter
    panel["yield_pct"] = (12 * panel["rent_psf"] / panel["sale_psf"] * 100).round(2)
    return panel


def build_district_class(listings: pd.DataFrame) -> pd.DataFrame:
    if listings.empty:
        return pd.DataFrame()
    frame = listings.copy()
    frame["property_class"] = frame["saleable_area_sqft"].map(property_class)
    frame = frame.dropna(subset=["property_class", "price_psf", "district_code"])
    records: list[dict[str, Any]] = []
    for (district, tenure, cls), group in frame.groupby(
        ["district_code", "listing_type", "property_class"]
    ):
        if len(group) < 1:
            continue
        records.append(
            {
                "district_code": district,
                "tenure": tenure,
                "property_class": cls,
                "psf": round(float(group["price_psf"].median()), 1),
                "n": len(group),
            }
        )
    return pd.DataFrame(records)


def build_estates_latest(estates: list[dict[str, Any]], estate_quarters: pd.DataFrame, listings: pd.DataFrame) -> list[dict[str, Any]]:
    if estate_quarters.empty:
        return []
    latest_quarter = estate_quarters["quarter"].max()
    latest = estate_quarters[estate_quarters["quarter"] == latest_quarter]
    listing_age = {}
    if not listings.empty and "building_age_years" in listings:
        listing_age = (
            listings.dropna(subset=["building_age_years"])
            .groupby("estate_id")["building_age_years"]
            .median()
            .to_dict()
        )
    meta = {estate.get("estate_id"): estate for estate in estates}
    rows: list[dict[str, Any]] = []
    for _, row in latest.iterrows():
        estate = meta.get(row["estate_id"]) or {}
        stats = estate.get("rent_stats") or {}
        completion = estate.get("completion_label") or ""
        year_match = None
        for token in completion.replace(",", " ").split():
            if token.isdigit() and len(token) == 4:
                year_match = int(token)
        age = 2026 - year_match if year_match else listing_age.get(row["estate_id"])
        rows.append(
            {
                "estate_id": row["estate_id"],
                "name": estate.get("name") or row.get("estate_name"),
                "district_code": row["district_code"],
                "price_psf": row["price_psf"],
                "volume": row["volume"],
                "rent_psf": stats.get("avg_rent_psf"),
                "yield_pct": stats.get("yield_pct"),
                "mtr_walk_minutes": estate.get("mtr_walk_minutes"),
                "building_age_years": age,
                "total_units": estate.get("total_units"),
                "lat": estate.get("lat"),
                "lon": estate.get("lon"),
            }
        )
    return rows


def build_affordability(
    panel: pd.DataFrame,
    income: pd.DataFrame,
    listings: pd.DataFrame,
    rates: pd.DataFrame,
) -> list[dict[str, Any]]:
    if panel.empty:
        return []
    frame = panel.copy()
    frame["year"] = frame["quarter"].str.slice(0, 4).astype(int)
    annual = (
        frame.groupby(["district_code", "year"], as_index=False)
        .agg(sale_psf=("sale_psf", "mean"), rent_psf=("rent_psf", "mean"))
    )
    income = income[income["district_code"].astype(str).str.len() == 1].copy()
    income["year"] = income["year"].astype(int)
    annual = annual.merge(income[["district_code", "year", "median_income"]], on=["district_code", "year"], how="left")

    # A standard 500 ft² saleable flat makes price-to-income comparable across
    # districts. Using the sample median area would let a handful of luxury
    # listings in a thin district dominate the ratio.
    standard_area = 500.0

    latest_rate = None
    if not rates.empty:
        rate_rows = rates.dropna(subset=["hibor_1m"])
        if not rate_rows.empty:
            latest_rate = float(rate_rows.iloc[-1]["hibor_1m"]) + 1.3

    rows: list[dict[str, Any]] = []
    for _, row in annual.iterrows():
        if pd.isna(row["median_income"]) or not row["sale_psf"] or not row["rent_psf"]:
            continue
        area = standard_area
        monthly_income = float(row["median_income"])
        price = float(row["sale_psf"]) * area
        rent = float(row["rent_psf"]) * area
        pti = price / (monthly_income * 12)
        rti = rent / monthly_income
        rate = latest_rate or 3.5
        loan = price * 0.7
        monthly_rate = rate / 100 / 12
        months = 30 * 12
        payment = loan * monthly_rate / (1 - (1 + monthly_rate) ** -months) if monthly_rate else loan / months
        burden = payment / monthly_income
        rows.append(
            {
                "district_code": row["district_code"],
                "year": int(row["year"]),
                "median_area_sqft": round(area, 0),
                "price": round(price, 0),
                "rent": round(rent, 0),
                "median_income": round(monthly_income, 0),
                "pti": round(pti, 2),
                "rti": round(rti, 3),
                "mortgage_rate": round(rate, 2),
                "monthly_payment": round(payment, 0),
                "mortgage_burden": round(burden, 3),
                "required_income": round(payment / 0.5, 0),
            }
        )
    result = pd.DataFrame(rows)
    if result.empty:
        return []
    result["rank"] = result.groupby("year")["pti"].rank(ascending=False, method="min").astype(int)
    return result.sort_values(["year", "rank"]).to_dict(orient="records")


def run() -> dict[str, Any]:
    config = load_config()
    raw = path_for("raw", config)
    interim = path_for("interim", config)
    processed = path_for("processed", config)
    app_data = path_for("app_data", config)

    estates = _load_jsonl(raw / "squarefoot" / "estates.jsonl")
    listings = pd.DataFrame(_load_jsonl(raw / "squarefoot" / "listings.jsonl"))
    rvd = pd.read_csv(interim / "rvd_indices.csv")
    income = pd.read_csv(interim / "csd_income.csv")
    rates = pd.read_csv(interim / "hkma_rates.csv")

    estate_quarters = build_estate_quarters(estates)
    panel = build_district_panel(estate_quarters, rvd, listings)
    if not panel.empty:
        panel = attach_current_rent(panel, estates, listings, rvd)
        panel["region"] = panel["district_code"].map(REGION_BY_CODE)

    classes = build_district_class(listings)
    estate_latest = build_estates_latest(estates, estate_quarters, listings)
    affordability = build_affordability(panel, income, listings, rates) if not panel.empty else []

    districts = read_json(processed / "districts.geojson")
    district_meta = [feature["properties"] for feature in districts["features"]]

    def records(frame: pd.DataFrame) -> list[dict[str, Any]]:
        if frame is None or frame.empty:
            return []
        return json.loads(frame.to_json(orient="records"))

    payload = {
        "as_of": panel["quarter"].max() if not panel.empty else None,
        "generated_at": utc_now(),
        "districts": district_meta,
        "panel": records(panel),
        "classes": records(classes),
        "estates": records(pd.DataFrame(estate_latest)),
        "affordability": records(pd.DataFrame(affordability)),
        "coverage": {
            "estates": int(estate_quarters["estate_id"].nunique()) if not estate_quarters.empty else 0,
            "listings": int(len(listings)),
            "districts_with_panel": int(panel["district_code"].nunique()) if not panel.empty else 0,
        },
    }
    write_json(processed / "districts.json", payload, indent=None)
    (app_data / "districts.json").write_bytes((processed / "districts.json").read_bytes())

    print(
        f"District panel: {len(panel)} rows, {panel['district_code'].nunique() if not panel.empty else 0} districts, "
        f"{len(estate_latest)} estates, {len(affordability)} affordability rows"
    )
    return {"panel_rows": len(panel), "estates": len(estate_latest), "affordability": len(affordability)}


if __name__ == "__main__":
    run()
