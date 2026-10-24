"""Pipeline entry point.

Usage:
    py -3.13 pipeline/build.py --stage official
    py -3.13 pipeline/build.py --stage all
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow `python pipeline/build.py` as well as `python -m pipeline.build`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.common import HttpClient, load_config, path_for, read_json, utc_now, write_json  # noqa: E402
from pipeline.sources import csd, geo, hkma, landreg, rvd  # noqa: E402


def run_official(client: HttpClient) -> dict[str, object]:
    """Run each source independently so one blocked endpoint cannot stop the build."""
    steps = [
        ("rvd", "RVD", rvd.run),
        ("hkma", "HKMA", hkma.run),
        ("csd", "C&SD", csd.run),
        ("landreg", "Land Registry", landreg.run),
        ("geo", "HAD boundaries", geo.run),
    ]
    results: dict[str, object] = {}
    failures: list[str] = []
    for key, label, function in steps:
        print(f"\n== {label} ==")
        try:
            results[key] = function(client)
        except Exception as exc:  # noqa: BLE001 - report and continue
            results[key] = None
            failures.append(f"{key}: {exc}")
            print(f"!! {label} failed: {exc}")
    if failures:
        print("\nSource failures:")
        for failure in failures:
            print(f"  - {failure}")
    return results


def run_crawl() -> dict[str, object]:
    from pipeline.sources.squarefoot import SquarefootCrawler

    config = load_config()
    squarefoot = config["squarefoot"]
    crawler = SquarefootCrawler(
        sale_per_district=int(squarefoot["max_listings_per_district"]),
        rent_per_district=max(20, int(squarefoot["max_listings_per_district"]) // 2),
        max_estates=int(squarefoot["max_estates"]),
        max_index_pages=int(squarefoot["max_index_pages"]),
    )
    print("\n== Squarefoot crawl ==")
    return crawler.run()


def run_analytics() -> dict[str, object]:
    from pipeline.analysis import district_panel, estate_quartiles, pca

    print("\n== District panel ==")
    panel = district_panel.run()
    print("\n== PCA ==")
    pca_result = pca.run()
    print("\n== Estate distributions ==")
    estate_quartiles.main()
    return {"district_panel": panel, "pca": pca_result}


def run_build() -> dict[str, object]:
    from pipeline import export

    print("\n== Export ==")
    return export.run()


def write_manifest(stage: str) -> None:
    config = load_config()
    processed = path_for("processed")
    as_of = None
    for name in ("market.json", "districts.json"):
        path = processed / name
        if path.exists():
            try:
                payload = read_json(path)
                if payload.get("as_of"):
                    as_of = max(as_of or "", payload["as_of"])
            except Exception:
                continue
    existing_files = {}
    manifest_path = processed / "manifest.json"
    if manifest_path.exists():
        try:
            existing_files = read_json(manifest_path).get("files", {})
        except Exception:
            existing_files = {}

    manifest = {
        "stage": stage,
        "generated_at": utc_now(),
        "as_of": as_of,
        "files": existing_files,
        "sources": {
            "rvd": "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
            "hkma": "https://www.hkma.gov.hk/eng/data-publications-and-research/data-and-statistics/monthly-statistical-bulletin/",
            "csd": "https://www.censtatd.gov.hk/en/web_table.html?id=130-06806",
            "landreg": "https://data.gov.hk/en-data/dataset/hk-lr-data4-landreg",
            "geo": "https://data.gov.hk/en-data/dataset/hk-had-json1-hong-kong-administrative-boundaries",
        },
    }
    write_json(processed / "manifest.json", manifest)
    print(f"\nWrote {processed / 'manifest.json'}")


def main() -> None:
    parser = argparse.ArgumentParser(description="HK Housing Atlas pipeline")
    parser.add_argument(
        "--stage",
        choices=["official", "crawl", "analytics", "build", "all"],
        default="official",
        help="which stage to run",
    )
    args = parser.parse_args()

    client = HttpClient()
    if args.stage in {"official", "all"}:
        run_official(client)
    if args.stage in {"crawl", "all"}:
        run_crawl()
    if args.stage in {"analytics", "all"}:
        run_analytics()
    if args.stage in {"build", "all"}:
        run_build()
    write_manifest(args.stage)


if __name__ == "__main__":
    main()
