"""Home Affairs Department 18 District Council boundaries.

The source JSON is already WGS84 (longitude/latitude). We simplify the polygons
for web delivery and attach canonical district codes, English names and regions
so every other source can join on a stable key.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
from shapely import set_precision
from shapely.geometry import Point, mapping, shape
from shapely.strtree import STRtree

from pipeline.common import HttpClient, path_for, read_json, write_json

URL = "https://www.had.gov.hk/psi/hong-kong-administrative-boundaries/hksar_18_district_boundary.json"

CODE_NAMES = {
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

REGIONS = {
    **{code: "HK Island" for code in "ABCD"},
    **{code: "Kowloon" for code in "EFGHJ"},
    **{code: "New Territories" for code in "KLMNPQRST"},
}


def _simplify(geometry: Any, tolerance: float = 0.00035) -> Any:
    simplified = geometry.simplify(tolerance, preserve_topology=True)
    try:
        simplified = set_precision(simplified, 1e-5)
    except Exception:
        pass
    return simplified


def run(client: HttpClient) -> dict[str, Any]:
    payload = client.get_json(URL, suffix="json")
    features = payload.get("features", [])
    if len(features) != 18:
        raise RuntimeError(f"expected 18 district features, got {len(features)}")

    out_features: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    for feature in features:
        properties = feature.get("properties", {})
        code = str(properties.get("地區號碼") or "").strip()
        if code not in CODE_NAMES:
            raise RuntimeError(f"unknown district code: {code!r}")
        name_en = CODE_NAMES[code]
        name_zh = str(properties.get("地區") or "").strip()
        geometry = shape(feature["geometry"])
        centroid = geometry.representative_point()
        out_features.append(
            {
                "type": "Feature",
                "properties": {
                    "district_code": code,
                    "name_en": name_en,
                    "name_zh": name_zh,
                    "region": REGIONS[code],
                    "centroid_lon": round(centroid.x, 5),
                    "centroid_lat": round(centroid.y, 5),
                },
                "geometry": mapping(_simplify(geometry)),
            }
        )
        rows.append(
            {
                "district_code": code,
                "name_en": name_en,
                "name_zh": name_zh,
                "region": REGIONS[code],
                "centroid_lon": round(centroid.x, 5),
                "centroid_lat": round(centroid.y, 5),
            }
        )

    collection = {"type": "FeatureCollection", "features": out_features}
    interim = path_for("interim")
    processed = path_for("processed")
    write_json(interim / "districts.geojson", collection, indent=None)
    write_json(processed / "districts.geojson", collection, indent=None)
    pd.DataFrame(rows).to_csv(interim / "districts.csv", index=False, encoding="utf-8")

    size_kb = (processed / "districts.geojson").stat().st_size / 1024
    print(f"HAD: 18 districts, simplified GeoJSON {size_kb:.0f} KB")
    return {"geojson": collection, "districts": pd.DataFrame(rows)}


@lru_cache(maxsize=2)
def _district_index(path_str: str) -> tuple[list[dict[str, Any]], list[Any], STRtree]:
    payload = read_json(Path(path_str))
    records: list[dict[str, Any]] = []
    geometries: list[Any] = []
    for feature in payload["features"]:
        properties = feature["properties"]
        records.append(
            {
                "district_code": properties["district_code"],
                "name_en": properties["name_en"],
                "name_zh": properties["name_zh"],
                "region": properties["region"],
            }
        )
        geometries.append(shape(feature["geometry"]))
    return records, geometries, STRtree(geometries)


def district_for_point(lat: float | None, lon: float | None) -> dict[str, Any] | None:
    """Return the district containing a WGS84 point, with a nearest-polygon fallback."""
    if lat is None or lon is None:
        return None
    path = path_for("processed") / "districts.geojson"
    if not path.exists():
        return None
    records, geometries, tree = _district_index(str(path))
    point = Point(lon, lat)
    hits = tree.query(point)
    for index in hits:
        if geometries[int(index)].covers(point):
            return records[int(index)]
    if not geometries:
        return None
    distances = [geometry.distance(point) for geometry in geometries]
    nearest = min(range(len(distances)), key=distances.__getitem__)
    return records[nearest] if distances[nearest] < 0.06 else None
