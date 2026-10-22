# HK Housing Atlas

An interactive web app for Hong Kong's private housing market. It combines three decades of official statistics with estate-level transaction history and current listings to answer three questions:

1. **Market Trends** — how have sale prices and rents moved, and what macro forces coincide with the turns?
2. **District Explorer** — where is housing most expensive, and are the gaps between districts widening?
3. **Financing & Affordability** — what return does housing offer, and who can afford to live where?

The app is a static React site backed by a reproducible Python pipeline. It is built from [proposal.docx](proposal.docx) and extends it with a shared filter state, district profiles, a mortgage/stress-test calculator and a tenant-vs-buyer view.

## Quick start (Windows)

```powershell
cd visualProject

# 1. Install Python and Node dependencies
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

# 2. Build official data + analytics + frontend JSON
powershell -File scripts\build-data.ps1

# 3. Optional: refresh the Squarefoot sample (respects robots.txt; ~20 min)
powershell -File scripts\build-data.ps1 -Crawl

# 3b. Optional: full residential crawl (~26,000 pages; about 7-10 hours)
powershell -File scripts\crawl-full.ps1

# 4. Run the app
powershell -File scripts\dev.ps1
# open http://127.0.0.1:5173
```

Production build:

```powershell
npm --prefix app run build
npm --prefix app run preview
```

## Data

| Source | Role | Access |
|---|---|---|
| Rating and Valuation Department (RVD) | Price/rental indices 1993–, yields 1999–, sales 2002–, completions 1985– | [RVD statistics](https://www.rvd.gov.hk/en/publications/property_market_statistics.html) |
| Hong Kong Monetary Authority (HKMA) | Mortgage survey, HIBOR, best lending rate | [HKMA API](https://apidocs.hkma.gov.hk/), bulletin workbooks |
| Census and Statistics Department (C&SD) | Median household income and household size by district, 2001–2025 | [Table 130-06806](https://www.censtatd.gov.hk/en/web_table.html?id=130-06806) |
| Land Registry | Monthly ASP counts and consideration, 2021–2026 | [data.gov.hk](https://data.gov.hk/en-data/dataset/hk-lr-data4-landreg) |
| Home Affairs Department | 18 District Council boundaries, clipped to land-only shapes for the map | [data.gov.hk](https://data.gov.hk/en-data/dataset/hk-had-json1-hong-kong-administrative-boundaries); land clip from [geohk](https://github.com/hupili/geohk) |
| Squarefoot (28Hse group) | Current listings and estate-level quarterly price series | Polite crawl; derived statistics only |

The current build uses the completed full residential crawl: **13,962 listing records**, **12,013 estate pages**, **4,887 estates with quarterly charts**, **4,709 estates with an assigned district** and **13,431 listings** in the PCA. The latest panel quarter contains **1,337 estates** and **7,442 transactions**. One estate URL in the sitemap returns 404 and is logged. Office, shop, carpark and news pages are excluded.

The district polygons are intersected with the **land-only census2001 district geometry** from [geohk](https://github.com/hupili/geohk), so the choropleth excludes sea while keeping the statutory HAD district lines. The coastline vintage is 2001; recent reclamation is not represented.

### Crawl compliance

- Squarefoot's `robots.txt` allows path-based pages and disallows search-query submissions; the crawler only uses path pages and the sitemap.
- One request at a time, 1.0–1.4 s delay, gzip cache, retries with backoff, and a stop on 403/429.
- No login, agent-contact or photo pages. Only property attributes are stored; agent names, phone numbers, photos and descriptions are not.
- Raw HTML is cached under `data/raw/` (git-ignored) and is not redistributed. The app ships derived aggregates and anonymised listing attributes only.
- Confirm Squarefoot's terms for your own use before a large crawl. If bulk crawling is not permitted, use the official data and the aggregate estate fields.

## Pipeline

```powershell
.\.venv\Scripts\python -m pipeline.build --stage official    # RVD, HKMA, C&SD, Land Registry, HAD
.\.venv\Scripts\python -m pipeline.build --stage crawl       # Squarefoot listings + estates
.\.venv\Scripts\python -m pipeline.build --stage analytics   # district panel, affordability, PCA
.\.venv\Scripts\python -m pipeline.build --stage build       # export JSON for the app
.\.venv\Scripts\python -m pipeline.build --stage all         # all of the above
```

Full residential crawl:

```powershell
.\.venv\Scripts\python -m pipeline.full_crawl --delay 1.0
```

It reads the sitemap, normalises every URL to the English locale, and resumes
from `data/raw/squarefoot/listings.jsonl` and `estates.jsonl`. Progress is
written to `full_crawl_progress.json`; failures go to `crawl_errors.jsonl`.
At roughly one request per second the full run takes 7–10 hours. After it
finishes, rebuild the derived data with the analytics and build stages.

Outputs:

```
data/processed/latest/
  market.json          RVD, HKMA, C&SD, Land Registry series + events
  districts.json       district panel, class medians, estate scatter, affordability
  districts.geojson    simplified 18-district boundaries
  pca.json             PCA loadings, variance and scores
  manifest.json        as-of dates, sources, counts
```

The same files are copied to `app/public/data/latest/` for the static app.

## App structure

```
app/src/
  routes/              Overview, Market, Districts, Affordability, Methods
  components/          Chart (ECharts), DistrictMap (Leaflet), Cards, Layout
  data/                typed JSON loaders
  state/filters.ts     shared Zustand filter state
  lib/                 formatting, statistics, mortgage maths
```

- Charts are ECharts; the district map is Leaflet (no WebGL requirement, so it works in headless browsers and older machines).
- Routes are lazy-loaded; the initial bundle is ~267 kB (84 kB gzip), with ECharts and the map split out.
- Shared filters (tenure, district, class) are in Zustand and serialised to the URL, e.g. `/districts?district=M&tenure=rent&class=C`. Navigation between dashboards preserves them, and copied links rehydrate the state.

## Key definitions

- **Sale $/ft²** = price ÷ saleable area. RVD per-m² values are converted at 10.7639 ft²/m².
- **Gross yield** = 12 × monthly rent/ft² ÷ sale price/ft². Management fees and taxes are excluded.
- **Price-to-income** = price of a standard 500 ft² flat ÷ annual median household income.
- **Rent-to-income** = monthly rent of a standard 500 ft² flat ÷ monthly median household income.
- **DSR** = monthly mortgage payment ÷ monthly household income; the calculator defaults to a 50% cap.
- **District sale price** = transaction-volume-weighted median of estate $/ft²; **district rent** = rental-volume-weighted mean of current estate rent $/ft², backcast with the RVD rental index.

More detail: [docs/METHODOLOGY.md](docs/METHODOLOGY.md), [docs/SOURCES.md](docs/SOURCES.md), [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md).

## Limitations

- The crawl is a **current snapshot**; it cannot reconstruct ten years of listings. Long-run series come from RVD and estate quarterly history.
- Rent history before the latest 90-day estate statistics is **modelled** from the RVD rental index, holding district relativities fixed.
- Listing prices are asking prices; transactions are used for trend and yield calculations where available.
- Affordability uses household income, not buyer income, and excludes stamp duty, legal fees, management fees and vacancy costs.
- Relationships shown are associations, not causal estimates. Nothing here is investment advice.
- Cells with fewer than three estates (or fewer than ten transactions) are provisional or suppressed.

## Screenshots

| View | Desktop | Mobile |
|---|---|---|
| Overview | [overview-desktop.png](docs/screenshots/overview-desktop.png) | [overview-mobile.png](docs/screenshots/overview-mobile.png) |
| Market Trends | [market-desktop.png](docs/screenshots/market-desktop.png) | [market-mobile.png](docs/screenshots/market-mobile.png) |
| District Explorer | [districts-desktop.png](docs/screenshots/districts-desktop.png) | [districts-mobile.png](docs/screenshots/districts-mobile.png) |
| District × class heatmap | [districts-class-heatmap.png](docs/screenshots/districts-class-heatmap.png) | — |
| Financing & Affordability | [affordability-desktop.png](docs/screenshots/affordability-desktop.png) | — |
| Methods & data | [methods-desktop.png](docs/screenshots/methods-desktop.png) | — |

## Tests

```powershell
powershell -File scripts\test.ps1
```

- Python: parser contract tests (`pipeline/tests/test_squarefoot_parse.py`) and calculation tests.
- Frontend: TypeScript build; unit tests via Vitest.
- Visual checks: screenshots at 1440×900 and mobile widths are stored in `docs/screenshots/`.

## License / attribution

Code: MIT. Data remains subject to the terms of each provider. RVD, HKMA, C&SD, Land Registry and HAD data are used with attribution. Squarefoot-derived figures are aggregated and are not a substitute for the source listings.