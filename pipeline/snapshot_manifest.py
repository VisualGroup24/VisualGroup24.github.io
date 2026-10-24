"""Write the manifest for the pruned raw-data snapshot tracked by Git.

The full HTTP cache is disposable and ignored. The tracked snapshot is the
Squarefoot crawl output/metadata, the RVD workbooks, and official workbooks
kept in the HTTP cache. Run this after a crawl so the manifest hashes and
counts match the files that are actually committed.

    python pipeline/snapshot_manifest.py
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUTPUT = RAW / "snapshot_manifest.json"

SQUAREFOOT_FILES = [
    "crawl_errors.jsonl",
    "estates.jsonl",
    "full_crawl_progress.json",
    "full_crawl_summary.json",
    "groups.json",
    "listings.jsonl",
    "sitemap.xml.gz",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def line_count(path: Path) -> int:
    with path.open("rb") as handle:
        return sum(1 for _ in handle)


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def size_of(paths: list[Path]) -> dict[str, int]:
    files = [path for path in paths if path.is_file()]
    return {
        "files": len(files),
        "bytes": sum(path.stat().st_size for path in files),
    }


def main() -> None:
    included_paths: list[Path] = []
    included_paths.extend(RAW / "squarefoot" / name for name in SQUAREFOOT_FILES)
    included_paths.extend(sorted((RAW / "rvd").glob("*.xls")))
    included_paths.extend(sorted((RAW / "rvd").glob("*.xlsx")))
    included_paths.extend(sorted((RAW / "http").glob("*.xls")))
    included_paths.extend(sorted((RAW / "http").glob("*.xlsx")))

    included = []
    for path in included_paths:
        if not path.is_file():
            continue
        entry = {
            "path": relative(path),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
        if path.parent == RAW / "http":
            meta = path.with_name(path.name + ".meta.json")
            if meta.is_file():
                entry["source_url"] = json.loads(meta.read_text(encoding="utf-8")).get("url")
        if path.suffix == ".jsonl":
            entry["lines"] = line_count(path)
        included.append(entry)

    summary_path = RAW / "squarefoot" / "full_crawl_summary.json"
    crawl_summary = json.loads(summary_path.read_text(encoding="utf-8")) if summary_path.is_file() else None

    http_gz = list((RAW / "http").glob("*.gz"))
    http_json = list((RAW / "http").glob("*.json"))
    http_meta = list((RAW / "http").glob("*.meta.json"))
    spike = list((RAW / "spike").glob("*"))

    manifest = {
        "snapshot": "pruned-raw",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "description": (
            "Tracked raw snapshot: Squarefoot crawl outputs and metadata, RVD workbooks, "
            "and official workbooks decoded from the HTTP cache. The HTTP response cache, "
            "spike pages and interim files are excluded."
        ),
        "crawl_summary": crawl_summary,
        "included": included,
        "excluded": {
            "http_gzip_cache": size_of(http_gz),
            "http_json_cache": size_of(http_json),
            "http_metadata": size_of(http_meta),
            "spike": size_of(spike),
            "interim": size_of(list((ROOT / "data" / "interim").rglob("*"))),
        },
    }

    OUTPUT.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    total = sum(entry["bytes"] for entry in included)
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(included)} files, {total / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
