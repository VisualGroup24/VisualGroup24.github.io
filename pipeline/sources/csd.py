"""Census and Statistics Department table 130-06806.

Average household size and median monthly household income by District
Council district, annual. The API returns a long table of 1,900 records.
"""

from __future__ import annotations

import pandas as pd

from pipeline.common import HttpClient, path_for

URL = "https://www.censtatd.gov.hk/api/get.php?id=130-06806&lang=en&full_series=1"

VARIABLES = {
    "ADHS": "household_size",
    "MED_DH_INC": "median_income_all",
    "MED_DH_INC_XEI": "median_income_excl_helpers",
    "MED_DH_INC_XEI_XFDH": "median_income",
}


def run(client: HttpClient) -> dict[str, pd.DataFrame]:
    payload = client.get_json(URL, suffix="json")
    rows = payload.get("dataSet", [])
    frame = pd.DataFrame(rows)
    if frame.empty:
        raise RuntimeError("C&SD table 130-06806 returned no rows")

    frame["year"] = pd.to_numeric(frame["period"], errors="coerce").astype("Int64")
    frame["figure"] = pd.to_numeric(frame["figure"], errors="coerce")
    frame["variable"] = frame["sv"].map(VARIABLES)
    frame = frame.dropna(subset=["year", "variable"])

    wide = (
        frame.pivot_table(
            index=["year", "DC", "DCDesc"],
            columns="variable",
            values="figure",
            aggfunc="first",
        )
        .reset_index()
        .rename(columns={"DC": "district_code", "DCDesc": "district_name"})
    )
    wide.columns.name = None
    wide["district_code"] = wide["district_code"].replace("", "HK").fillna("HK")
    wide = wide.sort_values(["year", "district_code"]).reset_index(drop=True)

    interim = path_for("interim")
    wide.to_csv(interim / "csd_income.csv", index=False, encoding="utf-8")

    latest = wide[wide["year"] == wide["year"].max()]
    print(
        f"C&SD: {len(wide)} district-years "
        f"({int(wide['year'].min())} .. {int(wide['year'].max())}); "
        f"{latest['district_code'].nunique()} areas in latest year"
    )
    return {"income": wide}
