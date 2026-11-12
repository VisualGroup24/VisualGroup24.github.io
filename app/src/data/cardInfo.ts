export type DataSource = { label: string; url: string };

export type DataNoteEntry = {
  title: string;
  what: string;
  sources: DataSource[];
  processing: string[];
};

const RVD: DataSource = {
  label: "Rating and Valuation Department — property market statistics",
  url: "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
};
const HKMA: DataSource = {
  label: "HKMA — monthly statistical bulletin (mortgage survey, HIBOR, BLR)",
  url: "https://www.hkma.gov.hk/eng/data-publications-and-research/data-and-statistics/monthly-statistical-bulletin/",
};
const CSD: DataSource = {
  label: "C&SD — median household income by district (Table 130-06806)",
  url: "https://www.censtatd.gov.hk/en/web_table.html?id=130-06806",
};
const HAD: DataSource = {
  label: "Home Affairs Department — 18 District Council boundaries",
  url: "https://data.gov.hk/en-data/dataset/hk-had-json1-hong-kong-administrative-boundaries",
};
const GEOHK: DataSource = {
  label: "geohk / census2001 — land-only district geometry",
  url: "https://github.com/hupili/geohk",
};
const SQUAREFOOT: DataSource = {
  label: "Squarefoot (28Hse group) — listings and estate quarterly series",
  url: "https://www.squarefoot.com.hk/",
};
const FED: DataSource = {
  label: "US Federal Reserve — rate-hike cycle",
  url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20220316a.htm",
};

export const DATA_NOTES: Record<string, DataNoteEntry> = {
  "journey-brief": {
    title: "The brief and the rent/buy choice",
    what: "Income, flat size, the tenure path and the tenure-appropriate budget inputs are shared by every stage and mirrored into the URL. The market pulse or the Buy/Rent control in the rail sets the path; that choice switches the district explorer and shortlist between buyer and tenant variants. Until a path is chosen they show the buy variant.",
    sources: [HKMA, CSD],
    processing: [
      "Buyers set deposit, mortgage rate, term and a 40/50/60% DSR cap; tenants set a 30/40/50% rent-to-income cap.",
      "The URL carries tenure=buy or tenure=rent plus any non-default numbers; malformed values are ignored and out-of-range numbers are clamped.",
      "Reset clears the brief, returns to the home page and leaves stages 2 and 3 open on the buy variant. The shortlist is session-only.",
    ],
  },
  "pulse-indices": {
    title: "Price and rent indices",
    what: "RVD private domestic price and rental indices for the selected property class, rebased to 2019 = 100 so both lines share one scale. Nine curated policy and rate events are marked on the timeline.",
    sources: [RVD, FED],
    processing: [
      "Monthly RVD index levels 1993-01 to 2026-08; the published base is 1999 = 100, rebasing to 2019 is presentation only.",
      "Class filter uses the RVD bands A–E, or the published territory-wide ALL index.",
      "Nine curated events (stamp duty, rate cycle, price peak) are drawn from pipeline/data/events.yml; verify each against its cited source.",
    ],
  },
  "pulse-yield-spread": {
    title: "Yield vs effective mortgage rate",
    what: "Gross rental yield for the selected class against two mortgage-rate proxies. The shaded band is the spread — positive when the flat earns more in rent than the loan costs in interest.",
    sources: [RVD, HKMA],
    processing: [
      "Gross yield = 12 × monthly rent/ft² ÷ sale price/ft² from RVD class averages; fees, rates and taxes excluded.",
      "H-plan proxy = 1-month HIBOR + 1.3pp; P-plan proxy = best lending rate − 2.5pp. Both are benchmarks, not quoted bank offers.",
      "“All classes” is the unweighted mean of the five RVD class yields because the source does not publish an aggregate yield.",
    ],
  },
  "pulse-buy-rent": {
    title: "Buy vs rent, same flat",
    what: "The 18-district median monthly rent and mortgage payment for a standard 500 ft² flat, 2001–2025. The crossover marks the most recent year buying became dearer or cheaper than renting.",
    sources: [RVD, CSD, HAD],
    processing: [
      "Rent = district rent/ft² × 500; payment uses a 70% 30-year loan at each year's effective rate proxy.",
      "Median across the 18 districts, so the line describes a typical district rather than a specific one.",
      "Income is the C&SD median household income for the same district-year; the series ends in 2025 while prices run to 2026.",
    ],
  },
  "pulse-decision": {
    title: "Rent or buy? Your call",
    what: "Three signals that summarise the market pulse, then the choice that sets the variants of stages 2 and 3. The signals compare price and rent momentum, the yield against the mortgage proxy, and the monthly cost of buying versus renting your flat size.",
    sources: [RVD, HKMA, CSD, HAD],
    processing: [
      "Momentum = latest year-on-year change in the RVD price and rent indices for the selected class.",
      "Yield spread = latest gross yield − (1-month HIBOR + 1.3pp).",
      "Monthly cost uses the latest 18-district median sale and rent $/ft² at your flat size; the payment uses your deposit, rate and term, not your income.",
      "The signals are descriptive, not advice. Choosing a path does not change the data; it changes which budget and charts stages 2 and 3 show.",
    ],
  },
  "explore-map": {
    title: "District map",
    what: "The selected metric for one quarter on the 18 District Council boundaries. Levels use quantile breaks; price and rent change use a diverging scale centred on zero. Districts outside the budget can be greyed out.",
    sources: [HAD, GEOHK, SQUAREFOOT, RVD],
    processing: [
      "Boundaries are HAD polygons intersected with the land-only census2001 geometry, so sea is excluded; reclamation after 2001 is not shown.",
      "The in-budget toggle greys districts whose price or rent for your flat size exceeds the ceiling or rent cap.",
      "Click a district to select it; click the selected district again to clear.",
    ],
  },
  "explore-ranking": {
    title: "District ranking",
    what: "All 18 districts sorted on the current metric, coloured by region. The selected district and the comparison district are emphasised; clicking sets the comparison.",
    sources: [SQUAREFOOT, RVD],
    processing: [
      "Ranking uses the same quarter and metric as the map, so the two always agree.",
      "Tooltips add the price or rent at your flat size and the income required at your budget settings.",
      "Districts with a suppressed or missing value are excluded rather than ranked last.",
    ],
  },
  "explore-top-estates": {
    title: "Most-traded estates",
    what: "Box plot of the five estates with the most latest-quarter transactions in the selected district (Hong Kong-wide when no district is selected). Each box is the estate's quarterly average sale $/ft² history.",
    sources: [SQUAREFOOT],
    processing: [
      "Estates are ranked by latest-quarter transaction volume from the district panel.",
      "Box = Q1–Q3 of every positive quarterly average sale $/ft² in the estate's chart history; the centre line is the median and whiskers are min–max; n is the number of quarters.",
      "A top estate without a quarterly chart is omitted and the footer states how many of the five are shown; no zeros or imputed distributions are used.",
    ],
  },
  "explore-scatter": {
    title: "Price vs rent",
    what: "District sale $/ft² against rent $/ft² for the selected quarter. Bubbles are transactions; dashed lines mark your buy ceiling and rent cap at your flat size.",
    sources: [SQUAREFOOT, RVD],
    processing: [
      "Both axes are the latest-quarter panel values; rent history before that quarter is modelled from the RVD cycle.",
      "The vertical line is your price ceiling divided by your flat size; the horizontal line is your monthly rent cap divided by it.",
      "In rent mode only the rent-cap line is drawn.",
    ],
  },
  "explore-yield": {
    title: "Gross yield",
    what: "Gross yield of the selected district against the median of the 18 districts since 2018. With no district selected, only the median is drawn.",
    sources: [SQUAREFOOT, RVD],
    processing: [
      "Gross yield = 12 × monthly rent $/ft² ÷ sale price $/ft², before management fees, taxes and vacancy.",
      "The HK line is the median of the 18 district yields each quarter, not a transaction-weighted territory figure.",
      "Estate averages outside HK$5,000–80,000/ft² (sale) or HK$5–300/ft² (rent) are excluded upstream; cells with few estates stay provisional.",
      "A single quarter can spike when the estate mix changes; read it as the panel's composition rather than a clean market-wide yield.",
    ],
  },
  "explore-trend": {
    title: "District trend",
    what: "The selected and comparison districts since 2018 against the territory median for the chosen metric. In rent mode, rent is paired with the rent-to-income ratio of your flat size and income on a right-hand axis.",
    sources: [SQUAREFOOT, RVD],
    processing: [
      "Each quarter is the volume-weighted median estate $/ft² in that district.",
      "The HK line is the median across the 18 district values, not a transaction-weighted territory figure.",
      "Rent history before the latest quarter is modelled; YoY compares the same quarter a year earlier and can swing when the estate mix changes.",
      "Rent-to-income = rent $/ft² × your flat size ÷ your monthly income, for the selected district (HK median when none is selected). The right axis stays 0–100% while every point is below 1 and otherwise scales to the highest ratio.",
      "Bars are green below your rent-to-income cap, amber from the cap to 100% of income, and red above 100%.",
    ],
  },
  "explore-budget-fit": {
    title: "Can I afford this district?",
    what: "All 18 districts sorted by the monthly price or rent of your flat size, against your ceiling or rent cap. Buyers also see the ceiling after a 200 bp rate rise; tenants see the rent cap.",
    sources: [RVD, HKMA, CSD, HAD],
    processing: [
      "Buyer price = district transaction-panel sale $/ft² × your flat size; monthly payment uses your deposit, rate and term.",
      "Rent = district rental-panel rent $/ft² × your flat size; required income = rent ÷ your rent-to-income cap.",
      "Bars are green inside the ceiling, amber within 10% of it and grey outside. Clicking a bar selects that district.",
    ],
  },
  "shortlist-budget-buys": {
    title: "What your budget buys",
    what: "Current listings in the selected district as saleable area against total asking price (buy) or monthly rent (rent). The budget and flat-size lines show what the current snapshot offers at your cap.",
    sources: [SQUAREFOOT],
    processing: [
      "This uses the pipeline's listing-level snapshot (13,431 complete listings) as plain records: area, $/ft², district and tenure.",
      "Total price = area × asking $/ft²; rent rows show monthly rent instead. Axes are clipped at the 99th percentile of area and total cost, with the clipped count stated.",
      "The reachable share is computed before clipping. Asking prices are not transactions; the footer shows the district's median asking premium where class medians exist.",
    ],
  },
  "shortlist-table": {
    title: "Shortlist table",
    what: "The matching estates as rows with price or rent per ft², yield, age, MTR walk and transactions. Sort, click a row to profile it and star it into the shortlist.",
    sources: [SQUAREFOOT],
    processing: [
      "Rows are filtered by the stage filters: age band, MTR walk, minimum transactions and the budget cap.",
      "The shortlist is in-session only and is not serialised into the URL.",
      "Yield values outside 0–15% are flagged by the pipeline and excluded from the best-yield KPI.",
    ],
  },
  "shortlist-profile": {
    title: "Estate profile",
    what: "The selected estate's latest metrics and where it sits in its market. Buyers see the full-history sale quartile range and the district median; tenants see the district's current rent distribution with the estate and rent cap marked.",
    sources: [SQUAREFOOT],
    processing: [
      "Buyer range = the estate's quarterly average sale $/ft²: Q1–Q3 band, median line, min–max whiskers; the marker is its latest transaction $/ft².",
      "Tenant range = p10–p90 of current rental-listing rent $/ft² in the district, with the p25–p75 band, median, this estate and your rent cap.",
      "Distributions with fewer than three listings are not drawn. Cost at your flat size is the estate $/ft² × your flat size.",
    ],
  },
};

export function getDataNote(id: string): DataNoteEntry | null {
  return DATA_NOTES[id] ?? null;
}
