# Sources and coverage

All sources were accessed in October 2026. Coverage is measured on the files actually downloaded by the pipeline, not on the publisher's headline claim.

| Layer | Publisher | Endpoint / file | Format | Coverage used | Refresh |
|---|---|---|---|---|---|
| Price index | RVD | `https://www.rvd.gov.hk/doc/en/statistics/his_data_4.xls` | XLS | 1993-01 – 2026-08 | Monthly |
| Rental index | RVD | `https://www.rvd.gov.hk/doc/en/statistics/his_data_3.xls` | XLS | 1993-01 – 2026-08 | Monthly |
| Average prices/rents | RVD | `his_data_1.xls`, `his_data_2.xls` | XLS | 1993– | Monthly |
| Market yields | RVD | `https://www.rvd.gov.hk/doc/en/statistics/his_data_15.xls` | XLS | 1999-01 – 2026-08 | Monthly |
| Primary/secondary sales | RVD | `https://www.rvd.gov.hk/doc/en/statistics/his_data_16.xls` | XLS | 2002-01 – 2026-08 | Monthly |
| Completions | RVD | `https://www.rvd.gov.hk/doc/en/statistics/private_domestic.xls` | XLS | 1985–2026 | Annual |
| District completions/stock | RVD | `https://www.rvd.gov.hk/doc/en/hkpr26/HKPR2026_Tables(Excel_TC).zip`; archive at `https://www.rvd.gov.hk/en/publications/hkpr_previous.html` | XLSX in ZIP | 2015–2026 | Annual |
| Mortgage survey | HKMA | `https://www.hkma.gov.hk/media/eng/doc/market-data-and-statistics/monthly-statistical-bulletin/T0307.xlsx` | XLSX | 2016-12 – 2026-08 | Monthly |
| HIBOR fixing | HKMA | `https://www.hkma.gov.hk/media/eng/doc/market-data-and-statistics/monthly-statistical-bulletin/T060302.xls` | XLS | 1996–2026-09 | Monthly |
| Best lending rate | HKMA | `https://www.hkma.gov.hk/media/eng/doc/market-data-and-statistics/monthly-statistical-bulletin/T060401.xls` | XLS | 1971–2026 (effective dates) | As changed |
| Income / household size | C&SD | `https://www.censtatd.gov.hk/api/get.php?id=130-06806&lang=en&full_series=1` | JSON | 2001–2025, 18 districts + HK | Annual |
| ASP counts | Land Registry | dataset `hk-lr-data4-landreg`; files `https://www.landreg.gov.hk/datagovhk/YYYYMM_data.json` | JSON | 2021-01 – 2026-09 | Monthly |
| District boundaries | HAD | `https://www.had.gov.hk/psi/hong-kong-administrative-boundaries/hksar_18_district_boundary.json` | GeoJSON | 18 features | Rare |
| Land-only district geometry | geohk (census2001) | `https://raw.githubusercontent.com/hupili/geohk/master/census2001/dc_land.lowres.geo.json` | GeoJSON | 18 features, low-resolution | Static |
| Estate prices / rent / listings | Squarefoot | `https://www.squarefoot.com.hk/sitemap.xml.gz`; estate and property detail pages | HTML | Current snapshot; estate series from 1996 for older estates | Weekly/monthly |

## Tracked raw snapshot

The full HTTP response cache under `data/raw/http/` is disposable and **not tracked** (about 791 MB of gzip cache). Git tracks a pruned raw snapshot instead:

- `data/raw/squarefoot/` — crawl outputs, summary, groups, sitemap and crawl errors;
- `data/raw/rvd/` — RVD workbooks;
- `data/raw/http/*.xls` / `*.xlsx` — official workbooks decoded from the HTTP cache.

`data/raw/snapshot_manifest.json` records the SHA-256, byte size, line count and, for HTTP-cache workbooks, the source URL. Regenerate it after a crawl with:

```powershell
python pipeline/snapshot_manifest.py
```

The snapshot is about 83 MB across 34 files. Raw HTTP responses, spike pages and intermediate files remain ignored.

## Squarefoot crawl

- `robots.txt` at `https://www.squarefoot.com.hk/robots.txt` allows path pages and disallows `search_words_thing` and `sortBy_by_text` query submissions. The crawler uses only path pages, the sitemap and detail pages.
- Requests are serialised at 1.0–1.4 s, with gzip caching, three retries and a stop on HTTP 403/429.
- The crawler does not fetch agent pages, login, or contact details. It stores property attributes only.
- The current build is the completed full residential crawl: **13,962 listing records**, **12,013 estate pages**, **4,887 estates with quarterly charts** and **4,709 with an assigned district**. One sitemap estate URL returns 404 and is recorded in `data/raw/squarefoot/crawl_errors.jsonl`.
- The sitemap contains 32,427 URLs; the housing subset is 13,959 buy/rent apartment listings and 12,012 estate pages. Office, shop, carpark, new-properties and news URLs are excluded.
- **Before a large crawl**, review Squarefoot's terms of use. If bulk crawling is not permitted for your use, keep the official data and the estate-level aggregates, and do not expand the listing crawl.

## Known coverage gaps

- RVD's current workbooks start in **1993**, not 1979 as the publication page suggests. The app labels 1993–2026.
- HKMA's T0307 workbook starts in **2016-12**; the API has older records but blocked deep pagination from this environment (HTTP 405 from the fronting WAF). The static workbook is the reproducible path.
- Land Registry's published JSON begins in **2021-01** and groups transactions into ten broad areas, not 18 districts.
- C&SD income is annual and currently ends at **2025**; 2026 affordability is therefore a 2025-income calculation against 2026 prices and is labelled accordingly.
- Some districts have no estate with a usable quarterly chart (notably Islands, which appears with a rent-only listing fallback). These are flagged in the panel as `basis = "listings"` / `"listings_rent"`.
- The land-only clip uses **census2001** district geometry. Coastline changes and reclamation after 2001 are not represented; the statutory HAD district lines are preserved inside the land mask.

## Licences and attribution

- RVD, HKMA, C&SD, Land Registry and HAD data are used under the Government's open-data terms with attribution. See [data.gov.hk](https://data.gov.hk/en/terms-and-conditions).
- The land-only district geometry is from [hupili/geohk](https://github.com/hupili/geohk), derived from census2001 data; it is used for research and map clipping. Check the repository's notes before redistribution.
- Squarefoot content remains the property of 28Hse Ltd. The app shows derived statistics and anonymised listing attributes; it does not reproduce photographs, descriptions or agent contact details.
- Code in this repository is MIT licensed.
