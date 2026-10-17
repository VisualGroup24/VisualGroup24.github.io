"""Export processed tables to compact JSON for the static frontend."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
import yaml

from pipeline.common import load_config, path_for, read_json, utc_now, write_json


def _records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    if frame is None or frame.empty:
        return []
    clean = frame.astype(object).where(pd.notna(frame), None)
    return clean.to_dict(orient="records")


def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path) if path.exists() else pd.DataFrame()


def _events() -> list[dict[str, Any]]:
    path = Path(__file__).resolve().parent / "data" / "events.yml"
    with path.open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle)
    return payload.get("events", [])


def export_market(interim: Path, processed: Path) -> dict[str, Any]:
    rvd = _read_csv(interim / "rvd_indices.csv")
    yields = _read_csv(interim / "rvd_yields.csv")
    sales = _read_csv(interim / "rvd_sales.csv")
    completions = _read_csv(interim / "rvd_completions.csv")
    mortgage = _read_csv(interim / "hkma_mortgage.csv")
    rates = _read_csv(interim / "hkma_rates.csv")
    income = _read_csv(interim / "csd_income.csv")
    landreg_area = _read_csv(interim / "landreg_area.csv")
    landreg_summary = _read_csv(interim / "landreg_summary.csv")

    months = [
        str(frame["month"].max())
        for frame in (rvd, mortgage, landreg_summary)
        if not frame.empty and "month" in frame
    ]
    as_of = max(months) if months else None

    payload = {
        "as_of": as_of,
        "generated_at": utc_now(),
        "rvd": _records(rvd),
        "yields": _records(yields),
        "sales": _records(sales),
        "completions": _records(completions),
        "mortgage": _records(mortgage),
        "rates": _records(rates),
        "income": _records(income),
        "landreg": {
            "area": _records(landreg_area),
            "summary": _records(landreg_summary),
        },
        "events": _events(),
    }
    write_json(processed / "market.json", payload, indent=None)
    return {
        "file": "market.json",
        "as_of": as_of,
        "rvd_rows": len(rvd),
        "yield_rows": len(yields),
        "income_rows": len(income),
        "landreg_months": len(landreg_summary),
    }


def export_districts(processed: Path) -> dict[str, Any]:
    source = processed / "districts.geojson"
    payload = read_json(source)
    # Already simplified by the geo stage; copy to the app data directory later.
    return {"file": "districts.geojson", "features": len(payload.get("features", []))}


def run() -> dict[str, Any]:
    config = load_config()
    interim = path_for("interim", config)
    processed = path_for("processed", config)
    app_data = path_for("app_data", config)

    market_summary = export_market(interim, processed)
    district_summary = export_districts(processed)

    for name in ("market.json", "districts.geojson"):
        source = processed / name
        if source.exists():
            (app_data / name).write_bytes(source.read_bytes())

    manifest_path = processed / "manifest.json"
    manifest = read_json(manifest_path) if manifest_path.exists() else {}
    manifest.setdefault("files", {})
    manifest["files"]["market.json"] = market_summary
    manifest["files"]["districts.geojson"] = district_summary
    for name in ("districts.json", "pca.json"):
        path = processed / name
        if path.exists():
            try:
                payload = read_json(path)
                manifest["files"][name] = {
                    "bytes": path.stat().st_size,
                    "rows": len(payload.get("panel", payload.get("scores", []))),
                    "as_of": payload.get("as_of"),
                }
            except Exception:
                continue
    manifest["generated_at"] = utc_now()
    write_json(manifest_path, manifest)

    print(f"Export: market.json + districts.geojson -> {app_data}")
    return {"market": market_summary, "districts": district_summary}


if __name__ == "__main__":
    run()
