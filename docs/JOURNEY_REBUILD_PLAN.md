# HK Housing Atlas — three-stage journey with a rent/buy choice

> **Complete.** The three-stage revision landed on 2026-11-12, replacing the earlier five-stage layout. This document holds the stage specifications, state model and verification record for future work.
> **Last updated:** 2026-11-13
> **Repo:** `C:\Users\micha\Desktop\dsh\visualProject` (git, branch `main`)
> **App:** React 19 · Vite 8 · Tailwind 4 · ECharts 6 · Leaflet · Zustand · React Router 7

---

## 0. Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Delete stale UI, docs and assets (earlier revision) | **complete** |
| 1 | Shell, 3-step nav, rent/buy choice, URL state, UI primitives | **complete** |
| 2 | Welcome page (`/`) | **complete** |
| 3 | Stage 1 — Market pulse (`/market`) + rent/buy choice | **complete** |
| 4 | Stage 2 — District explorer (`/explore`), buy/rent variants | **complete** |
| 5 | Stage 3 — Shortlist (`/shortlist`) + budget-buys | **complete** |
| 6 | Data notes, Methods, Guide, dark mode, docs, captures | **complete** |

**Current state:** `npm --prefix app run build` passes (TypeScript strict + Vite), `npm --prefix app test` passes 47 tests, and `python -m pytest pipeline/tests -q` passes 14. Every stage and both tenure variants measure exactly 735 px `scrollHeight` at 1360 × 735 with zero console errors. Captures are in `docs/screenshots-v3/`. No file in `pipeline/` or `data/` changed, and no JSON field was added.

### 0.1 What changed from the five-stage revision

- **Home page added at `/`.** The welcome page explains the journey and starts it; it is not a dashboard and has no rail.
- **Market pulse moved to `/market` and now owns the rent/buy choice.** The old `momentum` chart was replaced by a decision panel with three signals and the choice.
- **Five stages became three.** `/budget` merged into `/explore` as the budget-fit chart; `/decide` was folded into `/shortlist` as “what your budget buys” plus the estate profile. `/budget` and `/decide` redirect.
- **Tenure is nullable and selects the variant.** Stages 2/3 stay open and show the buy variant until a path is chosen; both adapt their labels, metrics, KPIs, budgets and profiles.
- **The PCA analysis was removed.** No scree, loadings, biplot, PCA data note or PCA wording remains. The pipeline's listing-level snapshot is reused as plain records for the budget-buys chart and tenant rent distribution.

---

## 1. Routes and the rent/buy choice

| Route | Page | Role |
|---|---|---|
| `/` | Welcome | Explains the three stages and the brief; starts the journey. No rail/stepper. |
| `/market` | Stage 1 · Market pulse | Market analysis + rent/buy choice. |
| `/explore` | Stage 2 · District explorer | District choice under the tenure budget. |
| `/shortlist` | Stage 3 · Shortlist | Estate visit list + what the budget buys. |
| `/methods` | Reference | Definitions, sources, limitations. No rail/stepper; scrolls internally. |

**Redirects:** `/districts`, `/budget`, `/affordability → /explore`; `/decide → /shortlist`; unknown → `/`. Query strings are preserved. `/market` is now a real route, so the old `/market → /` redirect was removed.

**Rent/buy choice:** `tenure` is `"sale" | "rent" | null`, default `null`.

- Stage 1's decision panel has “I'll buy” / “I'll rent” buttons. The rail's Buy/Rent control is available from the first load; choosing in either place sets tenure and switches stages 2 and 3. “Next: find your district” is always available.
- The stepper links to all three stages at all times; there is no lock state.
- Direct `/explore` or `/shortlist` with no tenure renders the buy variant.
- The rail can change the path later; district and shortlist survive.
- Reset clears the brief and returns to `/`; stages remain open on the buy variant.

---

## 2. Welcome page (`/`)

**Purpose:** orient a first-time visitor and explain the journey before asking them to interpret charts.

**Content**

1. Hero: “A Practical Guide for Buyers and Tenants in HK.”, lead, CTA **Start exploring** (`/market` with the brief), and the share QR code at the left.
2. Three journey cards: number, title, a dashboard screenshot (yield vs mortgage, choropleth, what your budget buys), question, one-line description and filter hints, linked by translucent accent arrows that overlap the card edges. All three are always available.
3. Facts strip: 30 years of RVD indices · 18 land-only districts · estate-level history and current listings.
4. Data footline with source attribution and a Methods link.

**Layout:** no rail; `.welcome` max-width 1180, hero + three cards (3 columns) + facts + note; one screen at 1360 × 735, stacks below 900 px, scrolls on mobile.

---

## 3. Stage 1 — Market pulse (`/market`)

**Purpose:** decide whether the market favours transacting now, and whether the user is a tenant or a buyer. The stage is both analysis and the journey fork.

**Questions:** Are prices or rents rising faster? Is gross yield above the effective mortgage rate? For the same flat, is the mortgage payment above or below the rent? How has that gap moved since 2001? Which path fits this market and my brief?

**Filters:** RVD class (All/A–E); window (5y/10y/all 1993–2026); income, flat size, deposit, mortgage rate, loan term, DSR cap in the rail; the path choice.

**Visualisations**

1. **Price and rent indices** — RVD monthly indices, rebased 2019 = 100, class/window filters, nine event markers, inside zoom.
2. **Yield vs effective mortgage rate** — gross yield against HIBOR+1.3 and BLR−2.5 with the shaded spread.
3. **Buy vs rent, same flat** — 18-district median rent and mortgage payment for 500 ft², 2001–2025, last crossover marked (70% loan benchmark).
4. **Rent or buy? Your call** — non-chart decision panel: three signal rows (price vs rent momentum; yield vs mortgage; monthly buy-vs-rent cost for the user's flat size at their deposit/rate/term) and the two choice buttons. Choosing shows the next CTA; footnotes say the signals are descriptive, not advice.

**KPIs (6):** price index + YoY; rent index + YoY; gross yield; yield − mortgage; median payment; median rent.

**Layout:** header 40 / KPI 52 / row1 58% indices · 42% yield spread / row2 58% buy-vs-rent · 42% decision panel.

---

## 4. Stage 2 — District explorer (`/explore`)

**Purpose:** convert the path into a district choice under the budget.

**Shared controls:** district (map/bar/rail), metric, quarter 2018-Q1→2026-Q4, “In budget” toggle, comparison district; rail income/flat size/path and tenure-appropriate budget inputs.

### Buyer variant

**Questions:** Which districts are inside my ceiling? What income is required? What do I give up on price, movement and yield? How does one district compare? Is supply deep enough?

**Filters:** Sale $/ft² · Price YoY · Gross yield; quarter; in-budget only; compare district; income/deposit/rate/term/DSR/flat size.

**Visualisations**

1. **Choropleth** — selected sale metric, quantile breaks (levels) or diverging (YoY), selected outline, greyed when the budget excludes; click to select.
2. **Most-traded estates** — box plot of the five estates with the most latest-quarter transactions in the selected district (Hong Kong-wide when no district is selected). Each box is the estate's quarterly average sale $/ft² history: Q1–Q3 box, median line, min–max whiskers. A top estate without history is omitted and the footer states how many of the five are shown.
3. **Ranking** — 18 sorted bars, region colours, selected/compare emphasis, tooltip with price at flat size and required income; click to compare.
4. **Can I afford to buy here?** — 18 sorted bars of the district median price for the flat size; ceiling line and dashed +200 bp stressed ceiling; reachable/edge/outside colours; click to select.
5. **Gross yield** — the selected district's quarterly gross yield against the median of the 18 districts; the median alone is drawn until a district is selected.
6. **Trend / trade-off** — selected and comparison sale $/ft² since 2018 vs HK median, with a toggle to the **Price vs rent** scatter (bubbles = transactions, buy-ceiling and rent-cap lines).

**KPIs:** HK median sale $/ft²; selected value + rank; comparison; districts within budget (n/18); sale listings; transactions.

### Tenant variant

**Questions:** Which districts can I rent in under my cap? What share of income would rent take? Are rents rising faster than prices? Is the rental market deep enough?

**Filters:** Rent $/ft² · Rent YoY · Gross yield; quarter; in-budget only; compare district; income/RTI cap/flat size.

**Visualisations**

1. **Choropleth** — rent $/ft², rent YoY or yield; greyed outside the rent cap; click to select.
2. **Most-traded estates** — the same transaction-based sale $/ft² box plot, kept as sale-market context beside the rent metrics; it is labelled “quarterly sale $/ft²”.
3. **Ranking** — rent metric ranking with monthly rent at flat size, income required and listing count; click to compare.
4. **Can I afford to rent here?** — 18 sorted bars of district median monthly rent for the flat size against the maximum rent; within-cap/outside colours; click to select.
5. **Trend / trade-off** — selected and comparison rent $/ft² vs HK median (modelled-history caveat) with the same price-vs-rent toggle and rent-cap line. On the rent-level trend, a second right-hand axis plots **rent-to-income** for the brief's flat size and income as colour-coded bars (green below the user's cap, amber up to 100%, red above), 0–100% while the ratio stays below 1; the tooltip reports the ratio for every rent line.

**KPIs:** HK median rent $/ft²; selected value + rank; comparison; districts within cap; rental listings; transactions.

**Layout (both):** header 40 / KPI 52 / row1 38% map · 30% estate boxes · 32% ranking / row2 buyers 36% budget fit · 28% gross yield · 36% trend, tenants 50% budget fit · 50% trend.

---

## 5. Stage 3 — Shortlist (`/shortlist`)

**Purpose:** narrow the district's estates to a visit list and show what the budget buys in current listings. No district → all-Hong Kong fallback with a prompt (no second hard block).

**Shared controls:** district, budget cap (auto or override), age band, MTR band, minimum transactions, sort, shortlist stars, path.

### Buyer variant

**Filters:** district; cap auto/4M/6M/8M/12M/none; age (<10 / 10–19 / 20–39 / 40+); MTR (≤5/≤10/>10); txn ≥1/3/5/10; sort value/yield/age/volume.

**Visualisations**

1. **What your budget buys** — sale listings, area vs total asking price, budget and size lines, reachable share, 99th-percentile clipping; footer adds the district asking premium vs transactions. Spans the full left column.
2. **Shortlist table** — right column, top: 15 rows with estate, district, price $/ft², yield, age, MTR, transactions and star; sort control; click to profile.
3. **Estate profile** — right column, bottom: metrics; full-history sale quartile range with latest and district-median markers; cost at flat size; budget verdict.

**KPIs:** estates matching; median price $/ft²; cheapest; best yield; median age; matching transactions.

### Tenant variant

**Filters:** district; cap auto/HK$10k/15k/20k/none; age; MTR; transactions; sort.

**Visualisations**

1. **What your rent buys** — rental listings, area vs monthly rent, rent-cap and size lines, reachable share, clipping. Spans the full left column.
2. **Shortlist table** — right column, top: rent $/ft², yield, age, MTR, units, transactions, star.
3. **Estate profile** — right column, bottom: metrics; **district rent distribution** from current rental listings (p10–p90 track, p25–p75 band, median, estate marker, rent-cap marker, n); monthly rent at flat size.

**KPIs:** estates matching; median rent $/ft²; cheapest rent; best yield; median age; matching transactions.

**Layout (both):** header 40 / KPI 52 / left column 54% what your budget buys, full height / right column 46% shortlist table above estate profile. The estate value scatter was removed.

---

## 6. State, URL and data flow

| Item | Change |
|---|---|
| `state/journey.ts` | Brief with `tenure: "sale" \| "rent" \| null`, default null; `setTenure`; `reset` clears the path; shortlist in-session; `selectDistrict` click-to-toggle. |
| `lib/filterUrl.ts` | Writes `tenure=buy` for sale and `tenure=rent` for rent; reads `buy`, `sale` and `rent`; omits tenure when null. All numeric keys and clamping unchanged. |
| `state/theme.ts` | Light/dark in Zustand + `localStorage`; applied before first paint. |
| `lib/listings.ts` | Listing selection, reachable share, 99th-percentile clipping, rent-distribution quantiles. 5 unit tests. |
| `data/useListings.ts` | Loads the pipeline's listing-level snapshot as `{district, tenure, price_psf, area}` records. |
| `lib/districtMetrics.ts` | Adds `rent_yoy` and `districtBudgetRows` (per-district monthly price/rent, budget status, required income). |
| `data/cardInfo.ts` | 15 data notes: brief/choice, four pulse notes, six explore notes (incl. most-traded estates), four shortlist notes. No PCA entry. |

Data flow: brief rail → Zustand → selectors → stage charts. The URL mirrors the brief. Listing data is fetched once and cached from `pca.json` as plain listing records; no PCA scores or dimension-reduction output is used.

---

## 7. File map

**New:** `routes/Home.tsx`, `components/TenureChoice.tsx`, `components/EstateBoxPlot.tsx` (reintroduced for stage 2), `lib/listings.ts` (+ test), `data/useListings.ts`.

**Rewritten:** `App.tsx` (home + three stages + redirects), `components/StageNav.tsx` (3 steps), `components/AppShell.tsx` (no rail/stepper on home and Methods), `components/BriefRail.tsx` (nullable path, reset to home), `routes/Pulse.tsx`, `routes/Explore.tsx`, `routes/Shortlist.tsx`, `routes/Methods.tsx`, `components/GuideDrawer.tsx`, `components/DataNote.tsx`, `data/cardInfo.ts`, `lib/filterUrl.ts` (+ tests), `lib/districtMetrics.ts`, `styles.css`, `README.md`, `app/index.html`.

**Deleted:** `routes/Budget.tsx`, `routes/Decide.tsx`, `components/PcaScreeLoadings.tsx`, `components/Checklist.tsx`, `data/usePca.ts`.

**Removed visuals:** pulse momentum, budget stress curve, PTI affordability scatter, asking-vs-transaction chart, district buy-vs-rent chart, decision checklist panel, all PCA output. The six-estate box plot was moved into stage 2 and reduced to the five most-traded estates of the chosen district.

**Unchanged:** `main.tsx`, `vite.config.ts`, data hooks (`useMarket`, `useDistricts`, `useDistrictData`, `useEstateQuartiles`), `lib/{stats,finance,format,colorScale}` + tests, `pipeline/**`, `data/**`.

---

## 8. Edge cases

- **Unchosen tenure:** stages 2/3 render the buy variant; stepper and deep links are never locked; existing income/district query values survive the choice.
- **Legacy URLs:** `/budget`, `/affordability`, `/decide`, `/districts` redirect with query preserved; absent tenure shows the buy variant; `tenure=sale` works.
- **Reset on a stage:** returns to home, clears the path; stages remain open on the buy variant.
- **Path switch:** district/compare/shortlist persist; metrics, KPIs, budgets and profiles swap.
- **No district at stage 3:** all-Hong Kong fallback with a prompt.
- **Zero income/budget:** HK$0 ceiling, all districts outside; no division by zero.
- **Sparse attributes:** null age/MTR excluded from scatters with counts; nulls are not zero.
- **Small tenant samples:** rent distribution needs ≥3 listings and states n.
- **Modelled rent:** tenant trend subtitle/note says pre-latest-quarter history is modelled.
- **Asking vs transactions:** budget-buys footer and data note state the listing sample is asking data.
- **Fit:** all stages and variants use the flex/grid contract; home and Methods scroll naturally.

---

## 9. Tests and verification

**Automated**

```powershell
npm --prefix app run build     # tsc --noEmit + vite build
npm --prefix app test          # 47 Vitest tests, 8 files
python -m pytest pipeline/tests -q   # 14 pipeline tests
```

Unit coverage includes the rent/buy URL round-trip (`tenure=buy|sale|rent`, null omitted), the listing sample (selection, reachability, clipping, rent quantiles), budget maths, series and formatting.

**Puppeteer results**

| Check | Result |
|---|---|
| Fresh `/` | welcome hero, 3 cards with previews, no locked states, no rail/stepper, Start → `/market` |
| Welcome arrows | 43.2 × 210 px at 20% opacity, centred on both card gaps; hidden below 900 px |
| Start + choose Buy | URL gains `tenure=buy`; next CTA `/explore?tenure=buy`; rail shows Buy |
| Buyer stage 2 | title “Where can you afford to buy…”; panels map, most-traded estate boxes, ranking, budget fit, gross yield, price trend; metrics Sale/Price YoY/Yield |
| Most-traded estate boxes | 5 rows at 1360 × 735; Sha Tin shows 5/5 boxes, Southern 4/5 (one top estate has no chart); tooltip states volume, n and period |
| No-tenure `/explore` | renders the buy dashboard with no lock card; choosing Rent switches it to the tenant dashboard with `?tenure=rent` |
| Tenant stage 2 | title “Where can you afford to rent…”; metrics Rent/Rent YoY/Yield |
| Buyer stage 3 | panels what your budget buys (left, full height), shortlist table (right top), estate profile (right bottom) |
| Tenant stage 3 | panels what your rent buys (left, full height), shortlist table, estate profile with district rent distribution (130 listings) |
| Home after choice | chart previews visible; CTA remains Start exploring |
| Redirects | `/budget?district=R → /explore?district=R`, `/decide → /shortlist`, `/affordability → /explore`, `/districts → /explore` |
| Reset | `/`, welcome visible, path not chosen, all cards open |
| Fit | welcome + all stage/tenure variants at 1360 × 735 (735 scrollHeight); 1440 × 900 grows cells; 390 × 844 stacks; dark fits |
| Data notes / guide | rent/buy note opens; guide has 3 steps; no PCA entry |
| Methods | three stages, listing sample; no PCA section |

**Captures:** `docs/screenshots-v3/` — home, market choice, buyer and tenant stages 2 and 3, Methods, dark and mobile.

---

## 10. Assumptions

1. The rent/buy choice lives on the market pulse, not the welcome page; the welcome page only explains and starts the journey.
2. Choosing a path does not auto-navigate; the market analysis updates first. The next CTA is always available.
3. Internal `sale` = buy; the URL exposes `tenure=buy` with `sale` as a legacy alias.
4. Stage 3 is soft-gated on district (all-HK fallback); the tenure choice is never blocking.
5. The listing-level snapshot is reused as plain records while all PCA analysis is removed.
6. `/methods` remains the only long-form reference page; no pipeline or JSON regeneration is involved.
7. The visuals listed as dropped are not required in the new design.

---

## 11. History

The earlier five-stage revision (Phases 0–8, completed 2026-11-11) is superseded. Its routes `/budget` and `/decide` are now redirects; its momentum, stress, PTI, asking-vs-transaction and checklist visuals were folded into the three stages or dropped.
