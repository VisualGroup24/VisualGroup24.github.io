# Data dictionary

Processed files live in `data/processed/latest/` and are copied to `app/public/data/latest/`.

## `market.json`

| Field | Type | Meaning |
|---|---|---|
| `as_of` | string | Latest month across RVD/land registry inputs |
| `rvd[]` | array | `month`, `property_class` (A, B, C, D, E, A,B&C, D&E, ALL), `price_index`, `rent_index` |
| `yields[]` | array | `month`, `property_class`, `yield_pct` |
| `sales[]` | array | `month`, `primary_count`, `primary_value_m`, `secondary_count`, `secondary_value_m`, `total_count`, `total_value_m` |
| `completions[]` | array | `year`, `property_class`, `completions` |
| `mortgage[]` | array | monthly HKMA mortgage survey fields (`ltv_ratio`, `avg_loan_size`, `new_loans_approved`, pricing shares, delinquency) |
| `rates[]` | array | `month`, `hibor_1m`, `hibor_3m`, `best_lending_rate`, `savings_deposit_rate` |
| `income[]` | array | `year`, `district_code` (A–T, `HK`), `district_name`, `household_size`, `median_income`, `median_income_all`, `median_income_excl_helpers` |
| `landreg.area[]` | array | `month`, `area` (ten published areas), `asp_count` |
| `landreg.summary[]` | array | `month`, `residential_asp`, `non_residential_asp`, `primary_sales`, `secondary_sales` |
| `events[]` | array | `date`, `label`, `type`, `source` |

## `districts.geojson`

Feature properties:

| Field | Meaning |
|---|---|
| `district_code` | A–T code used by HAD and C&SD |
| `name_en`, `name_zh` | District names |
| `region` | HK Island, Kowloon, New Territories |
| `centroid_lon`, `centroid_lat` | Representative point for labels |

## `districts.json`

| Field | Meaning |
|---|---|
| `as_of` | Latest estate quarter (`YYYY-Qn`) |
| `panel[]` | `district_code`, `quarter`, `basis` (`estates` / `listings` / `listings_rent`), `sale_psf`, `sale_psf_p25`, `sale_psf_p75`, `rent_psf`, `yield_pct`, `n_estates`, `volume`, `rent_modelled`, `region` |
| `classes[]` | `district_code`, `tenure`, `property_class`, `psf`, `n` — current listing medians by RVD area class |
| `estates[]` | `estate_id`, `name`, `district_code`, `price_psf`, `volume`, `rent_psf`, `yield_pct`, `mtr_walk_minutes`, `building_age_years`, `total_units`, `lat`, `lon` |
| `affordability[]` | `district_code`, `year`, `median_area_sqft` (standard 500), `price`, `rent`, `median_income`, `pti`, `rti`, `mortgage_rate`, `monthly_payment`, `mortgage_burden`, `required_income`, `rank` |
| `coverage` | `estates`, `listings`, `districts_with_panel` |

## `pca.json`

| Field | Meaning |
|---|---|
| `n` | Complete listings used |
| `features` | Human-readable feature labels |
| `explained` | Variance-explained ratio per component |
| `loadings[]` | `feature`, `label`, `pc1`…`pc4` |
| `scores[]` | `pc1`, `pc2`, `district_code`, `tenure`, `price_psf`, `area`, `rent` |

## `manifest.json`

`stage`, `generated_at`, `as_of`, `files` (per-file counts), `sources` (canonical URLs).

## Interim tables (`data/interim/`)

| File | Grain | Fields |
|---|---|---|
| `rvd_indices.csv` | month × class | `month`, `property_class`, `price_index`, `rent_index` |
| `rvd_yields.csv` | month × class | `month`, `property_class`, `yield_pct` |
| `rvd_sales.csv` | month | primary/secondary counts and values |
| `rvd_completions.csv` | year × class | `year`, `property_class`, `completions` |
| `hkma_mortgage.csv` | month | mortgage survey fields |
| `hkma_rates.csv` | month | HIBOR and BLR |
| `csd_income.csv` | year × district | income and household size |
| `landreg_area.csv` | month × area | ASP counts |
| `landreg_summary.csv` | month | residential / primary / secondary |
| `districts.csv` | district | codes, names, region, centroid |

## Raw caches (git-ignored)

- `data/raw/http/` — cached official files and metadata (URL, status, ETag, SHA-256).
- `data/raw/rvd/` — RVD workbooks.
- `data/raw/squarefoot/html/` — gzipped Squarefoot pages with `*.meta.json`.
- `data/raw/squarefoot/listings.jsonl` — parsed listing snapshots.
- `data/raw/squarefoot/estates.jsonl` — parsed estate metadata, chart series and rental stats.
- `data/raw/squarefoot/groups.json` — district-group → HAD district mapping.
- `data/raw/spike/` — phase-0 feasibility captures and `report.json`.
