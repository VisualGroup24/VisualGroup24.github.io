"""Unit tests for district-panel calculations."""

from __future__ import annotations

import pandas as pd
import pytest

from pipeline.analysis.district_panel import (
    build_district_class,
    build_listing_counts,
    property_class,
    quarter_from_label,
    weighted_median,
    weighted_quantile,
)


def test_quarter_labels_are_quarter_starts() -> None:
    assert quarter_from_label("2018-01") == "2018-Q1"
    assert quarter_from_label("2018-04") == "2018-Q2"
    assert quarter_from_label("2026-10") == "2026-Q4"
    assert quarter_from_label("not-a-date") is None


def test_property_class_thresholds() -> None:
    assert property_class(300) == "A"
    assert property_class(500) == "B"
    assert property_class(800) == "C"
    assert property_class(1200) == "D"
    assert property_class(2000) == "E"
    assert property_class(None) is None


def test_weighted_median_respects_volume() -> None:
    # 10,000 has 1 unit; 20,000 has 9 units -> weighted median is 20,000.
    assert weighted_median([10_000, 20_000], [1, 9]) == 20_000
    assert weighted_median([100, 200, 300], [1, 1, 1]) == 200


def test_weighted_quantile_bounds() -> None:
    values = [10, 20, 30, 40]
    weights = [1, 1, 1, 1]
    assert weighted_quantile(values, weights, 0.25) == pytest.approx(10)
    assert weighted_quantile(values, weights, 0.75) == pytest.approx(30)
    assert weighted_quantile([], [], 0.5) is None


def test_listing_counts_split_by_tenure_and_skip_unassigned() -> None:
    listings = pd.DataFrame(
        [
            {"district_code": "A", "listing_type": "sale"},
            {"district_code": "A", "listing_type": "rent"},
            {"district_code": "A", "listing_type": "rent"},
            {"district_code": "B", "listing_type": "sale"},
            {"district_code": None, "listing_type": "sale"},
        ]
    )
    counts = build_listing_counts(listings)
    assert counts == {
        "A": {"total": 3, "sale": 1, "rent": 2},
        "B": {"total": 1, "sale": 1, "rent": 0},
    }
    assert build_listing_counts(pd.DataFrame()) == {}


def test_class_table_includes_hk_rows_with_unassigned_listings() -> None:
    listings = pd.DataFrame(
        [
            {"district_code": "A", "listing_type": "sale", "saleable_area_sqft": 300, "price_psf": 10_000},
            {"district_code": "A", "listing_type": "sale", "saleable_area_sqft": 500, "price_psf": 20_000},
            {"district_code": None, "listing_type": "sale", "saleable_area_sqft": 600, "price_psf": 30_000},
            {"district_code": "B", "listing_type": "rent", "saleable_area_sqft": 400, "price_psf": 50},
        ]
    )
    table = build_district_class(listings)

    hk_sale = table[(table["district_code"] == "HK") & (table["tenure"] == "sale")]
    by_class = {row["property_class"]: row for _, row in hk_sale.iterrows()}
    assert by_class["A"]["n"] == 1
    assert by_class["B"]["n"] == 2
    assert by_class["B"]["psf"] == pytest.approx(25_000)

    # District rows still exclude the unassigned 600 ft² listing.
    district_a = table[(table["district_code"] == "A") & (table["tenure"] == "sale")]
    assert district_a["n"].sum() == 2

