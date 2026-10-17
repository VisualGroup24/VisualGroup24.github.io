# Methodology

## 1. Coverage

| Dimension | Coverage | Notes |
|---|---|---|
| Territory price/rent indices | 1993-01 – 2026-08 | RVD legacy workbooks |
| Yields | 1999-01 – 2026-08 | RVD class A–E |
| Sales counts | 2002-01 – 2026-08 | RVD primary + secondary |
| Mortgage / rates | 2016-12 – 2026-09 | HKMA workbooks |
| Income | 2001–2025 | C&SD, annual |
| District price panel | 1996-Q1 – 2026-Q4 | Estate charts; app shows 2018+ |
| District rents | latest quarter + modelled history | Estate 90-day stats + RVD rent index |
| Listings | current snapshot | Asking prices |
| PCA | current snapshot | 129 complete listings |

## 2. District price and rent

### Sale price

For each district `d` and quarter `q`, the panel takes the estate-level average transacted $/ft² series from Squarefoot and computes a **transaction-volume-weighted median** across estates:

```
sale_psf(d,q) = weighted_median(estate_psf, weight = estate_volume)
```

The 25th/75th weighted percentiles are exported for the uncertainty band. A quarter is provisional when it contains fewer than three estates; districts with no estate series fall back to the median asking price of current sale listings and are labelled `basis = "listings"`.

### Rent

Current rent comes from each estate's 90-day rental market table: average rent $/ft² and rental volume. The district value is a rental-volume-weighted median. Where no estate rent exists, the median asking rent of current rental listings is used (minimum three listings).

Historical rent is **modelled**:

```
rent_psf(d,q) = rent_psf(d,latest) × RVD_rent_index(q) / RVD_rent_index(latest)
```

This holds each district's rent relativity fixed and imposes the territory-wide RVD cycle. It is a transparent approximation, not observed district rent history. The latest quarter uses the actual 90-day estate statistics.

### Yield

```
gross_yield(d,q) = 12 × rent_psf(d,q) / sale_psf(d,q)
```

Yields are gross: management fees, government rates, taxes and vacancy are excluded. Values outside 0–15% are flagged.

## 3. Affordability

A **standard 500 ft² saleable flat** is used for every district so that price-to-income is comparable and is not driven by a handful of luxury listings in a thin sample.

```
price(d,y)      = sale_psf(d,y) × 500
rent(d,y)       = rent_psf(d,y) × 500
PTI(d,y)        = price(d,y) / (12 × median_monthly_income(d,y))
RTI(d,y)        = rent(d,y) / median_monthly_income(d,y)
```

Mortgage burden uses a 70% loan-to-value ratio, 30-year amortisation and the latest effective mortgage-rate proxy (1-month HIBOR + 1.3 percentage points):

```
M = P × r/12 / (1 − (1 + r/12)^−360)
DSR = M / monthly_income
required_income = M / 0.5
```

The stress test adds 200 basis points. Stamp duty, legal fees, agency fees, management fees and vacancy are excluded. Income is household income, not buyer income.

**Ranking:** districts are ranked by PTI within each income year; rank 1 is least affordable.

## 4. Market analysis

- **Indices** are rebased to 2019 = 100 in the app; the published base is 1999 = 100. Rebasing affects presentation only.
- **Co-movement** uses monthly log changes of the price and rental indices and an OLS fit. The lead–lag chart correlates price change at `t` with rent change at `t + lag`; a positive lag means rents follow prices.
- **Event bands** are curated in `pipeline/data/events.yml` and should be verified against the cited source before publication.
- **Drivers** are bivariate associations (one macro factor at a time), not causal estimates. The chart reports n and R².

## 5. PCA

PCA is descriptive. Inputs are standardised:

- log saleable area
- bedrooms
- bathrooms
- floor-zone ordinal (ground/low = 1, middle = 2, high = 3, top = 4)
- building age
- walking minutes to MTR (from the estate introduction, merged by estate)
- rental-listing dummy

Price per ft² is a supplementary variable for the biplot colour, not an input. Missing numeric values are median-imputed. The scree plot reports variance explained; the loading heatmap shows PC1–PC3; the biplot shows PC1/PC2 scores and loading vectors. A loading arrow indicates the direction in which an attribute increases; arrows pointing together are correlated/redundant.

## 6. Data processing rules

- Currency HKD; area ft² (saleable where available); RVD per-m² values divided by 10.7639.
- RVD legacy `.xls`: locate the `Year`/`Month` columns, melt class columns, strip parentheses/footnote symbols, and drop non-numeric cells.
- HKMA workbooks: month names parsed from the bulletin (full or abbreviated), year forward-filled, effective-date rows collapsed to the last value in each month.
- C&SD: `MED_DH_INC_XEI_XFDH` is used as median household income (excludes external domestic helpers and foreign domestic households); `ADHS` is average household size.
- Land Registry: JSON descriptions mapped to ten published areas; `Units` parsed with commas; `-` treated as missing.
- Squarefoot: listing IDs from the URL; coordinates from `initNearbyMap`; districts assigned by point-in-polygon against HAD boundaries, with the group label and estate link as fallbacks.
- Duplicate listing IDs, estate-quarter rows and district-month rows are removed keeping the latest value.
- Cells with n < 10 or fewer than three estates are suppressed or flagged; they are never shown as zero.
- JSON export uses `allow_nan=False`; pandas `to_json` converts missing numeric values to `null`.

## 7. Limitations

- District price series are estate-based; estates are not a random sample of the housing stock. Volume weighting mitigates but does not remove selection bias.
- Rent history is modelled, not observed. Short-run district rent changes should be read as the RVD cycle applied to current district levels.
- Asking prices exceed transaction prices; trend and yield calculations use transactions where available.
- The listing sample is capped and current; it is not a ten-year panel.
- The PCA sample is small (129 listings); component signs and loadings can change as the crawl expands.
- Affordability uses household income and a standard flat, not actual buyer income or actual unit sizes.
- No causal identification: the drivers panel and event bands are descriptive.
