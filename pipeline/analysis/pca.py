"""PCA of listing attributes.

The goal is descriptive: which dimensions carry most of the variation in the
current listing sample, and which attributes are largely redundant. Price per
ft² is kept as a supplementary variable for the biplot colour, not as a PCA
input (it would otherwise dominate the first component by construction).
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from pipeline.common import path_for, utc_now, write_json
from pipeline.sources.squarefoot_parse import estate_mtr_minutes


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


def run() -> dict[str, Any]:
    config_root = Path(__file__).resolve().parents[2]
    raw = config_root / "data" / "raw"
    processed = path_for("processed")
    app_data = path_for("app_data")

    listings = pd.DataFrame(_load_jsonl(raw / "squarefoot" / "listings.jsonl"))
    estates = pd.DataFrame(_load_jsonl(raw / "squarefoot" / "estates.jsonl"))
    if listings.empty:
        print("PCA: no listings")
        return {"n": 0}

    mtr_by_estate = {}
    if not estates.empty:
        estates["mtr_walk_minutes"] = estates.apply(estate_mtr_minutes, axis=1)
        mtr_by_estate = dict(
            zip(estates.get("estate_id", []), estates.get("mtr_walk_minutes", []))
        )

    frame = listings.copy()
    frame["area"] = pd.to_numeric(frame.get("saleable_area_sqft"), errors="coerce")
    frame["price_psf_value"] = pd.to_numeric(frame.get("price_psf"), errors="coerce")
    frame = frame.dropna(subset=["area", "price_psf_value"])
    frame = frame[frame["area"] > 0]

    frame["log_area"] = np.log(frame["area"])
    frame["bedrooms"] = pd.to_numeric(frame.get("bedrooms"), errors="coerce")
    frame["bathrooms"] = pd.to_numeric(frame.get("bathrooms"), errors="coerce")
    frame["floor_level"] = pd.to_numeric(frame.get("floor_ordinal"), errors="coerce")
    frame["building_age"] = pd.to_numeric(frame.get("building_age_years"), errors="coerce")
    frame["mtr_walk"] = frame.get("estate_id", pd.Series(index=frame.index)).map(mtr_by_estate)
    frame["rental"] = (frame.get("listing_type") == "rent").astype(float)

    features = [
        ("log_area", "log saleable area"),
        ("bedrooms", "bedrooms"),
        ("bathrooms", "bathrooms"),
        ("floor_level", "floor level"),
        ("building_age", "building age"),
        ("mtr_walk", "MTR walk (min)"),
        ("rental", "rental listing"),
    ]
    matrix = frame[[key for key, _ in features]].copy()
    for key, _ in features:
        matrix[key] = pd.to_numeric(matrix[key], errors="coerce")
        matrix[key] = matrix[key].replace([np.inf, -np.inf], np.nan)
        if matrix[key].isna().any():
            median = matrix[key].median()
            matrix[key] = matrix[key].fillna(median if pd.notna(median) else 0.0)
    matrix = matrix.dropna()
    if len(matrix) < 20:
        print(f"PCA: only {len(matrix)} complete listings; skipping")
        return {"n": len(matrix)}

    scaler = StandardScaler()
    scaled = scaler.fit_transform(matrix.to_numpy(dtype=float))
    finite_rows = np.isfinite(scaled).all(axis=1)
    if not finite_rows.all():
        matrix = matrix.loc[finite_rows]
        scaled = scaled[finite_rows]
    if len(matrix) < 20:
        print(f"PCA: only {len(matrix)} finite listings; skipping")
        return {"n": len(matrix)}
    model = PCA(n_components=min(4, scaled.shape[1]))
    scores = model.fit_transform(scaled)

    loadings = []
    for index, (key, label) in enumerate(features):
        loadings.append(
            {
                "feature": key,
                "label": label,
                "pc1": round(float(model.components_[0, index]), 3),
                "pc2": round(float(model.components_[1, index]), 3) if model.n_components_ > 1 else 0,
                "pc3": round(float(model.components_[2, index]), 3) if model.n_components_ > 2 else 0,
                "pc4": round(float(model.components_[3, index]), 3) if model.n_components_ > 3 else 0,
            }
        )

    def finite(value: Any, digits: int = 3) -> float | None:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        return round(number, digits) if math.isfinite(number) else None

    score_rows = []
    for position, (_, row) in enumerate(frame.loc[matrix.index].iterrows()):
        pc1 = finite(scores[position, 0])
        pc2 = finite(scores[position, 1]) if scores.shape[1] > 1 else 0.0
        if pc1 is None or pc2 is None:
            continue
        score_rows.append(
            {
                "pc1": pc1,
                "pc2": pc2,
                "district_code": row.get("district_code"),
                "tenure": row.get("listing_type"),
                "price_psf": finite(row["price_psf_value"], 0),
                "area": finite(row["area"], 0),
                "rent": row.get("rental") == 1.0,
            }
        )

    payload = {
        "generated_at": utc_now(),
        "n": int(len(matrix)),
        "features": [label for _, label in features],
        "explained": [round(float(value), 4) for value in model.explained_variance_ratio_],
        "loadings": loadings,
        "scores": score_rows,
    }
    write_json(processed / "pca.json", payload, indent=None)
    (app_data / "pca.json").write_bytes((processed / "pca.json").read_bytes())
    print(f"PCA: {len(matrix)} listings, PC1 {payload['explained'][0]:.1%} of variance")
    return {"n": len(matrix), "explained": payload["explained"]}


if __name__ == "__main__":
    run()
