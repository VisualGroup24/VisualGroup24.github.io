"""Build quarterly Sale $/ft² distributions for the latest estates.

Used by the estate box-and-whisker sidebar on District Explorer. The source is
the `chart` block of each estate record in data/raw/squarefoot/estates.jsonl.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
RAW_ESTATES = ROOT / "data" / "raw" / "squarefoot" / "estates.jsonl"
APP_DISTRICTS = ROOT / "app" / "public" / "data" / "latest" / "districts.json"
OUT_APP = ROOT / "app" / "public" / "data" / "latest" / "estate-quartiles.json"
OUT_PROCESSED = ROOT / "data" / "processed" / "latest" / "estate-quartiles.json"


def main() -> None:
    app = json.loads(APP_DISTRICTS.read_text(encoding="utf-8"))
    latest = {
        estate["estate_id"]: estate
        for estate in app["estates"]
        if estate.get("price_psf") is not None
    }

    output: dict[str, dict[str, object]] = {}
    with RAW_ESTATES.open(encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            estate_id = record.get("estate_id")
            if estate_id not in latest:
                continue
            chart = record.get("chart") or {}
            quarters = chart.get("quarters") or []
            values = (chart.get("series") or {}).get("AVG Price") or []
            pairs = [
                (quarter, value)
                for quarter, value in zip(quarters, values)
                if isinstance(value, (int, float)) and value > 0
            ]
            if len(pairs) < 3:
                continue
            numeric = np.asarray([value for _, value in pairs], dtype=float)
            output[estate_id] = {
                "n": int(numeric.size),
                "min": round(float(np.min(numeric)), 1),
                "q1": round(float(np.percentile(numeric, 25)), 1),
                "median": round(float(np.median(numeric)), 1),
                "q3": round(float(np.percentile(numeric, 75)), 1),
                "max": round(float(np.max(numeric)), 1),
                "period": [pairs[0][0], pairs[-1][0]],
            }

    payload = json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n"
    OUT_APP.write_text(payload, encoding="utf-8")
    OUT_PROCESSED.write_text(payload, encoding="utf-8")
    print(f"Wrote {len(output)} estate distributions to {OUT_APP.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
