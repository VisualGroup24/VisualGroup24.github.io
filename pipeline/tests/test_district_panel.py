"""Unit tests for district-panel calculations."""

from __future__ import annotations

import pytest

from pipeline.analysis.district_panel import (
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
