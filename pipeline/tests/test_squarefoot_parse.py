"""Unit tests for the Squarefoot parsers.

These use the cached pages from the phase-0 spike. When the cache is absent
(e.g. CI), the tests skip; synthetic fixtures will be added once the contract
is frozen.
"""

from __future__ import annotations

import gzip
from pathlib import Path

import pytest

from pipeline.sources.squarefoot_parse import (
    parse_estate,
    parse_index,
    parse_listing,
    parse_transactions,
)

RAW = Path(__file__).resolve().parents[2] / "data" / "raw" / "spike"


def load(name: str) -> str:
    path = RAW / f"{name}.html.gz"
    if not path.exists():
        pytest.skip(f"missing spike cache: {path}")
    return gzip.decompress(path.read_bytes()).decode("utf-8", "replace")


def test_sale_listing_fields() -> None:
    listing = parse_listing(
        load("buy_wanchai_mountainview"),
        "https://www.squarefoot.com.hk/en/buy/apartment/property-104655",
    )
    assert listing["listing_id"] == "104655"
    assert listing["listing_type"] == "sale"
    assert listing["building_type"] == "apartment"
    assert listing["price"] == pytest.approx(3_980_000)
    assert listing["saleable_area_sqft"] == pytest.approx(245)
    assert listing["gross_area_sqft"] == pytest.approx(342)
    assert listing["price_psf"] == pytest.approx(16_245)
    assert listing["bedrooms"] == 0
    assert listing["bathrooms"] == 1
    assert listing["floor_zone"] == "Low Floor"
    assert listing["floor_ordinal"] == 1
    assert listing["building_age_years"] == pytest.approx(38)
    assert listing["estate_name"] == "Mountain View Mansion"
    assert listing["estate_id"] == "6095"
    assert listing["region_label"] == "HK Island"
    assert listing["address"] == "No.2 Swatow Street"
    assert listing["school_nets"]["school_net_pri"] == "12"
    assert listing["school_nets"]["school_net_sec"] == "HK2"
    assert listing["created_date"] == "2026-10-17"
    assert listing["updated_date"] == "2026-10-17"
    assert listing["lat"] == pytest.approx(22.275412, abs=1e-5)
    assert listing["lon"] == pytest.approx(114.171654, abs=1e-5)


def test_rent_listing_fields() -> None:
    listing = parse_listing(
        load("rent_kennedytown_cadogan"),
        "https://www.squarefoot.com.hk/en/rent/apartment/property-104666",
    )
    assert listing["listing_type"] == "rent"
    assert listing["price"] == pytest.approx(28_000)
    assert listing["saleable_area_sqft"] == pytest.approx(375)
    assert listing["price_psf"] == pytest.approx(74.7, abs=0.1)
    assert listing["bedrooms"] == 1
    assert listing["bathrooms"] == 1
    assert listing["estate_name"] == "Cadogan"
    assert listing["region_label"] == "HK Island"
    assert listing["rent_includes"] == "Gov tax, management fee"


def test_estate_chart_contract() -> None:
    estate = parse_estate(
        load("estate_taikoo_shing"),
        "https://www.squarefoot.com.hk/en/estate/detail/taikoo-shing-1140",
    )
    assert estate["estate_id"] == "1140"
    assert estate["name"] == "TaiKoo Shing"
    assert estate["region_label"] == "HK Island"
    assert estate["total_units"] == 12690
    assert estate["completion_label"] == "December 1976"
    chart = estate["chart"]
    assert len(chart["quarters"]) == 123
    assert chart["quarters"][0] == "1996-04"
    assert chart["quarters"][-1] == "2026-10"
    assert len(chart["series"]["AVG Price"]) == 123
    assert chart["series"]["AVG Price"][0] == pytest.approx(5617)
    assert chart["series"]["AVG Price"][-1] == pytest.approx(17351)
    assert chart["series"]["Volume"][-1] == pytest.approx(55)
    assert estate["rent_stats"]["avg_rent_psf"] == pytest.approx(47.0)
    assert estate["rent_stats"]["yield_pct"] == pytest.approx(3.3)


def test_new_estate_chart_starts_2018() -> None:
    estate = parse_estate(
        load("estate_wings_at_sea"),
        "https://www.squarefoot.com.hk/en/estate/detail/wings-at-sea-23595",
    )
    assert len(estate["chart"]["quarters"]) == 36
    assert estate["chart"]["quarters"][0] == "2018-01"
    assert estate["rent_stats"]["yield_pct"] == pytest.approx(3.6)


def test_index_page_contract() -> None:
    index = parse_index(
        load("buy_index_central"),
        "https://www.squarefoot.com.hk/en/buy/a1/dg2",
    )
    assert index["page"] == 1
    assert index["number_of_items"] == 211
    assert len(index["items"]) == 10
    assert index["has_next"] is True


def test_transaction_page_contract() -> None:
    rows = parse_transactions(
        load("estate_taikoo_tx_sale"),
        "https://www.squarefoot.com.hk/en/estate/detail/taikoo-shing-1140/transaction",
    )
    assert len(rows) == 10
    assert rows[0]["date"] == "2026-10-16"
    assert all(row["price"] and row["price"] > 0 for row in rows)
    assert all(row["area_sqft"] and row["area_sqft"] > 0 for row in rows)
