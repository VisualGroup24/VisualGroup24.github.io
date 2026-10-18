"""Shared utilities: configuration, paths, hashing, cached HTTP and JSON IO."""

from __future__ import annotations

import hashlib
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "pipeline" / "config.yaml"


def load_config() -> dict[str, Any]:
    with CONFIG_PATH.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def path_for(key: str, config: dict[str, Any] | None = None) -> Path:
    config = config or load_config()
    path = ROOT / config["paths"][key]
    path.mkdir(parents=True, exist_ok=True)
    return path


def sha1(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _finite(value: Any) -> Any:
    """Recursively replace NaN/Infinity with JSON null."""
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {key: _finite(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_finite(item) for item in value]
    return value


def write_json(path: Path, payload: Any, *, indent: int | None = 2) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(
        _finite(payload),
        ensure_ascii=False,
        indent=indent,
        default=str,
        allow_nan=False,
    )
    path.write_text(text, encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


class HttpClient:
    """Small cached HTTP client with conditional requests and polite retries.

    Cache layout:
        data/raw/http/<sha1(url)>.<suffix>
        data/raw/http/<sha1(url)>.<suffix>.meta.json
    """

    def __init__(
        self,
        config: dict[str, Any] | None = None,
        *,
        delay: float | None = None,
        cache_dir: Path | None = None,
    ) -> None:
        self.config = config or load_config()
        http = self.config["http"]
        self.timeout = int(http["timeout"])
        self.retries = int(http["retries"])
        self.delay = float(http["delay_seconds"] if delay is None else delay)
        self.cache_dir = cache_dir or path_for("raw", self.config) / "http"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": http["user_agent"],
                "Accept-Language": "en,zh-Hant;q=0.8",
            }
        )

    def _cache_paths(self, url: str, suffix: str) -> tuple[Path, Path]:
        key = sha1(url)
        return self.cache_dir / f"{key}.{suffix}", self.cache_dir / f"{key}.{suffix}.meta.json"

    def get_bytes(
        self,
        url: str,
        *,
        suffix: str = "bin",
        refresh: bool = False,
        headers: dict[str, str] | None = None,
    ) -> bytes:
        path, meta_path = self._cache_paths(url, suffix)
        meta: dict[str, Any] = {}
        if meta_path.exists():
            try:
                meta = read_json(meta_path)
            except (json.JSONDecodeError, OSError):
                meta = {}

        if path.exists() and not refresh:
            return path.read_bytes()

        request_headers = dict(headers or {})
        if meta.get("etag"):
            request_headers["If-None-Match"] = meta["etag"]
        if meta.get("last_modified"):
            request_headers["If-Modified-Since"] = meta["last_modified"]

        last_error: Exception | None = None
        for attempt in range(1, self.retries + 1):
            try:
                response = self.session.get(
                    url, timeout=self.timeout, headers=request_headers
                )
                if response.status_code == 304 and path.exists():
                    return path.read_bytes()
                if response.status_code in {429, 500, 502, 503, 504}:
                    retry_after = response.headers.get("Retry-After")
                    wait = float(retry_after) if retry_after and retry_after.isdigit() else attempt * 2
                    time.sleep(min(wait, 30))
                    last_error = requests.HTTPError(
                        f"{response.status_code} for {url}", response=response
                    )
                    continue
                response.raise_for_status()
                payload = response.content
                path.write_bytes(payload)
                write_json(
                    meta_path,
                    {
                        "url": url,
                        "status": response.status_code,
                        "fetched_at": utc_now(),
                        "etag": response.headers.get("ETag"),
                        "last_modified": response.headers.get("Last-Modified"),
                        "sha256": sha256_bytes(payload),
                        "bytes": len(payload),
                    },
                )
                if self.delay:
                    time.sleep(self.delay)
                return payload
            except requests.RequestException as exc:
                last_error = exc
                if attempt < self.retries:
                    time.sleep(attempt * 2)

        raise RuntimeError(f"failed to fetch {url}: {last_error}")

    def get_text(self, url: str, **kwargs: Any) -> str:
        return self.get_bytes(url, **kwargs).decode("utf-8", "replace")

    def get_json(self, url: str, **kwargs: Any) -> Any:
        payload = self.get_bytes(url, **kwargs)
        return json.loads(payload.decode("utf-8-sig"))
