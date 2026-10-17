"""Hong Kong Monetary Authority series.

The HKMA API rejects deep pagination from this environment (HTTP 405 from the
fronting WAF), so the published bulletin workbooks are used instead. They are
the same tables the API serves and are friendlier to a cached pipeline.

Files:
  T0307.xlsx  residential mortgage survey (monthly)
  T060302.xls HIBOR period averages (monthly)
  T060401.xls HKD interest rates / best lending rate (effective dates)
"""

from __future__ import annotations

import io
from datetime import datetime
from typing import Any

import pandas as pd

from pipeline.common import HttpClient, path_for

BASE = "https://www.hkma.gov.hk/media/eng/doc/market-data-and-statistics/monthly-statistical-bulletin"
FILES = {
    "mortgage": f"{BASE}/T0307.xlsx",
    "hibor": f"{BASE}/T060302.xls",
    "blr": f"{BASE}/T060401.xls",
}


def _number(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "")
    if not text or text in {"-", "--", "N.A.", "N/A", "nan"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _month_number(name: str) -> int | None:
    text = str(name).strip()
    if not text or text.lower() == "nan":
        return None
    for fmt in ("%B", "%b"):
        try:
            return datetime.strptime(text, fmt).month
        except ValueError:
            continue
    return None


def _month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def _read(path_name: str, payload: bytes, sheet: str | int = 0) -> pd.DataFrame:
    return pd.read_excel(io.BytesIO(payload), sheet_name=sheet, header=None)


def parse_mortgage(payload: bytes) -> pd.DataFrame:
    frame = _read("mortgage", payload, "T3.7")
    records: list[dict[str, Any]] = []
    year: int | None = None
    for row in range(16, len(frame)):
        candidate = _number(frame.iat[row, 0])
        if candidate and 1900 <= candidate <= 2100:
            year = int(candidate)
        month = _month_number(frame.iat[row, 1])
        if year is None or month is None:
            continue
        records.append(
            {
                "month": _month_key(year, month),
                "outstanding_loans_amt": _number(frame.iat[row, 3]),
                "new_applications": _number(frame.iat[row, 19]),
                "new_loans_drawn_amt": _number(frame.iat[row, 22]),
                "new_loans_drawn": _number(frame.iat[row, 25]),
                "new_loans_approved_amt": _number(frame.iat[row, 28]),
                "new_loans_approved": _number(frame.iat[row, 31]),
                "avg_loan_size": _number(frame.iat[row, 33]),
                "ltv_ratio": _number(frame.iat[row, 34]),
                "contractual_life_months": _number(frame.iat[row, 35]),
                "hibor_share": _number(frame.iat[row, 50]),
                "blr_share": _number(frame.iat[row, 51]),
                "fixed_share": _number(frame.iat[row, 52]),
                "other_share": _number(frame.iat[row, 53]),
                "delinquency_ratio": _number(frame.iat[row, 13]),
            }
        )
    result = pd.DataFrame(records)
    if not result.empty:
        result = result.drop_duplicates("month", keep="last").sort_values("month")
    return result.reset_index(drop=True)


def parse_hibor(payload: bytes) -> pd.DataFrame:
    frame = _read("hibor", payload, "T6.3.2 (HIBOR Fixing)")
    records: list[dict[str, Any]] = []
    year: int | None = None
    for row in range(11, len(frame)):
        candidate = _number(frame.iat[row, 0])
        if candidate and 1900 <= candidate <= 2100:
            year = int(candidate)
        month = _month_number(frame.iat[row, 1])
        if year is None or month is None:
            continue
        records.append(
            {
                "month": _month_key(year, month),
                "hibor_overnight": _number(frame.iat[row, 4]),
                "hibor_1w": _number(frame.iat[row, 5]),
                "hibor_1m": _number(frame.iat[row, 6]),
                "hibor_3m": _number(frame.iat[row, 7]),
                "hibor_6m": _number(frame.iat[row, 8]),
                "hibor_9m": _number(frame.iat[row, 9]),
                "hibor_12m": _number(frame.iat[row, 10]),
            }
        )
    result = pd.DataFrame(records)
    if not result.empty:
        result = result.drop_duplicates("month", keep="last").sort_values("month")
    return result.reset_index(drop=True)


def parse_blr(payload: bytes) -> pd.DataFrame:
    frame = _read("blr", payload, "T6.4.1")
    records: list[dict[str, Any]] = []
    for row in range(14, len(frame)):
        raw_date = frame.iat[row, 0]
        if pd.isna(raw_date):
            continue
        date = pd.to_datetime(raw_date, errors="coerce")
        if pd.isna(date):
            continue
        records.append(
            {
                "date": date,
                "best_lending_rate": _number(frame.iat[row, 10]),
                "savings_deposit_rate": _number(frame.iat[row, 9]),
            }
        )
    result = pd.DataFrame(records)
    if result.empty:
        return result
    result["month"] = result["date"].dt.strftime("%Y-%m")
    result = result.sort_values("date").groupby("month", as_index=False).last()
    return result[["month", "best_lending_rate", "savings_deposit_rate"]]


def run(client: HttpClient) -> dict[str, pd.DataFrame]:
    payloads = {name: client.get_bytes(url, suffix=url.rsplit(".", 1)[-1]) for name, url in FILES.items()}
    mortgage = parse_mortgage(payloads["mortgage"])
    hibor = parse_hibor(payloads["hibor"])
    blr = parse_blr(payloads["blr"])

    rates = hibor.merge(blr, on="month", how="outer").sort_values("month").reset_index(drop=True)

    interim = path_for("interim")
    mortgage.to_csv(interim / "hkma_mortgage.csv", index=False, encoding="utf-8")
    rates.to_csv(interim / "hkma_rates.csv", index=False, encoding="utf-8")

    print(
        f"HKMA: mortgage {len(mortgage)} rows "
        f"({mortgage['month'].min() if not mortgage.empty else '-'} .. "
        f"{mortgage['month'].max() if not mortgage.empty else '-'}); "
        f"rates {len(rates)} rows"
    )
    return {"mortgage": mortgage, "rates": rates}
