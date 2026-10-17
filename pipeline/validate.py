"""Validate the processed JSON before it is shipped to the app."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.common import path_for, utc_now, write_json  # noqa: E402


def main() -> int:
    processed = path_for("processed")
    checks: list[dict[str, object]] = []

    def check(name: str, condition: bool, detail: str) -> None:
        checks.append({"check": name, "ok": bool(condition), "detail": detail})

    required = ["market.json", "districts.json", "districts.geojson", "pca.json", "manifest.json"]
    for name in required:
        path = processed / name
        check(f"file:{name}", path.exists(), f"{path.stat().st_size if path.exists() else 0} bytes")

    market = json.loads((processed / "market.json").read_text(encoding="utf-8"))
    districts = json.loads((processed / "districts.json").read_text(encoding="utf-8"))
    geo = json.loads((processed / "districts.geojson").read_text(encoding="utf-8"))
    pca = json.loads((processed / "pca.json").read_text(encoding="utf-8"))
    manifest = json.loads((processed / "manifest.json").read_text(encoding="utf-8"))

    check("rvd rows", len(market.get("rvd", [])) > 1000, f"{len(market.get('rvd', []))} rows")
    check("rvd latest", bool(market.get("as_of")), str(market.get("as_of")))
    check("18 boundaries", len(geo.get("features", [])) == 18, f"{len(geo.get('features', []))} features")
    check(
        "18 districts in panel",
        len({row.get("district_code") for row in districts.get("panel", [])}) == 18,
        f"{len({row.get('district_code') for row in districts.get('panel', [])})} districts",
    )
    check("panel rows", len(districts.get("panel", [])) > 500, f"{len(districts.get('panel', []))} rows")
    check(
        "affordability rows",
        len(districts.get("affordability", [])) > 100,
        f"{len(districts.get('affordability', []))} rows",
    )
    check("estates", len(districts.get("estates", [])) >= 20, f"{len(districts.get('estates', []))} estates")
    check("pca sample", pca.get("n", 0) >= 20, f"{pca.get('n', 0)} listings")
    check("pca loadings", len(pca.get("loadings", [])) >= 5, f"{len(pca.get('loadings', []))} features")
    check("manifest as_of", bool(manifest.get("as_of")), str(manifest.get("as_of")))

    failures = [check for check in checks if not check["ok"]]
    report = {
        "generated_at": utc_now(),
        "passed": len(checks) - len(failures),
        "failed": len(failures),
        "checks": checks,
    }
    write_json(processed / "qa_report.json", report)

    for check in checks:
        status = "OK " if check["ok"] else "FAIL"
        print(f"[{status}] {check['check']}: {check['detail']}")
    print(f"\n{report['passed']} passed, {report['failed']} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
