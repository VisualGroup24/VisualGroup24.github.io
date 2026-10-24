export type DataInfo = {
  title: string;
  what: string;
  sources: Array<{ label: string; url: string }>;
  processing: string[];
  caveat?: string;
  extra?: "pca";
};

const RVD_PRICE = "https://www.rvd.gov.hk/doc/en/statistics/his_data_4.xls";
const RVD_RENT = "https://www.rvd.gov.hk/doc/en/statistics/his_data_3.xls";
const RVD_YIELD = "https://www.rvd.gov.hk/doc/en/statistics/his_data_15.xls";
const RVD_SALES = "https://www.rvd.gov.hk/doc/en/statistics/his_data_16.xls";
const RVD_COMPLETIONS =
  "https://www.rvd.gov.hk/doc/en/statistics/private_domestic.xls";
const HKMA_HIBOR =
  "https://www.hkma.gov.hk/media/eng/doc/market-data-and-statistics/monthly-statistical-bulletin/T060302.xls";
const HKMA_MORTGAGE =
  "https://www.hkma.gov.hk/media/eng/doc/market-data-and-statistics/monthly-statistical-bulletin/T0307.xlsx";
const CSD_INCOME =
  "https://www.censtatd.gov.hk/api/get.php?id=130-06806&lang=en&full_series=1";
const SQUAREFOOT = "https://www.squarefoot.com.hk/";
const HAD_BOUNDARIES =
  "https://www.had.gov.hk/psi/hong-kong-administrative-boundaries/hksar_18_district_boundary.json";
const GEOHK = "https://github.com/hupili/geohk";

export const CARD_INFO = {
  houseClasses: {
    title: "RVD house classes",
    what: "RVD groups private domestic transactions by saleable area: A is under 40 m² (about 430 ft²), B is 40–<70 m² (about 430–<753 ft²), C is 70–<100 m² (about 753–<1,076 ft²), D is 100–<160 m² (about 1,076–<1,722 ft²), and E is 160 m² or more (about 1,722 ft²+). ALL is the published all-class series.",
    sources: [
      { label: "RVD price index by class", url: RVD_PRICE },
      { label: "RVD rental index by class", url: RVD_RENT },
      { label: "RVD property market statistics", url: "https://www.rvd.gov.hk/en/publications/property_market_statistics.html" },
    ],
    processing: [
      "Class boundaries and class series come from the RVD workbooks; the app filters them by the selected class.",
      "ALL is the published all-class series, not an area-weighted average computed by this app.",
    ],
  },
  marketPriceIndex: {
    title: "Price index",
    what: "The RVD private domestic price index for the selected class, rebased to 2019 = 100. The delta is the 12-month change.",
    sources: [{ label: "RVD price index (his_data_4.xls)", url: RVD_PRICE }],
    processing: [
      "Parse the RVD workbook, keep the selected class, drop non-numeric cells and rebase the index to the 2019 average.",
      "YoY is the latest month divided by the same month one year earlier.",
    ],
  },
  marketRentIndex: {
    title: "Rent index",
    what: "The RVD private domestic rental index for the selected class, rebased to 2019 = 100. The delta is the 12-month change.",
    sources: [{ label: "RVD rental index (his_data_3.xls)", url: RVD_RENT }],
    processing: [
      "Parse the RVD rental workbook, keep the selected class, drop non-numeric cells and rebase to 2019 = 100.",
      "YoY is the latest month divided by the same month one year earlier.",
    ],
  },
  marketPriceRent: {
    title: "Price / rent",
    what: "The price index divided by the rental index for the selected class. It is a relative price measure, not a yield.",
    sources: [
      { label: "RVD price index", url: RVD_PRICE },
      { label: "RVD rental index", url: RVD_RENT },
    ],
    processing: [
      "Both indices are rebased to 2019 = 100 before the ratio is taken.",
      "A value above 1 means prices have risen more than rents since 2019; below 1 means the reverse.",
    ],
  },
  marketYield: {
    title: "Gross yield",
    what: "RVD’s gross rental yield for the selected class: annual rent divided by sale price. For ALL, the app shows the mean of the A–E class yields.",
    sources: [{ label: "RVD market yields (his_data_15.xls)", url: RVD_YIELD }],
    processing: [
      "Read the latest RVD yield workbook row for the selected class.",
      "For ALL, average the latest A–E class yields; the value is gross of costs and vacancy.",
    ],
  },
  marketSales: {
    title: "Monthly ASPs",
    what: "The number of sale transactions in the latest RVD month across primary and secondary residential sales.",
    sources: [{ label: "RVD sale transactions (his_data_16.xls)", url: RVD_SALES }],
    processing: [
      "Parse the RVD monthly sales workbook and take the latest month’s total transaction count.",
      "This is a count of transactions, not the number of units or listings.",
    ],
  },
  marketHibor: {
    title: "HIBOR 1M",
    what: "The monthly average 1-month Hong Kong Interbank Offered Rate, in percent.",
    sources: [{ label: "HKMA 1-month HIBOR (T060302.xls)", url: HKMA_HIBOR }],
    processing: [
      "Parse the HKMA monthly workbook and take the latest monthly fixing average.",
      "The rate is a funding-cost indicator, not a mortgage rate; the affordability calculator uses HIBOR + 1.3 percentage points as a proxy.",
    ],
  },
  marketIndices: {
    title: "Price and rental indices",
    what: "Monthly RVD private domestic price and rental indices for Hong Kong, shown for all classes or a single class A–E. The app rebases the published series to 2019 = 100.",
    sources: [
      { label: "RVD price index (his_data_4.xls)", url: RVD_PRICE },
      { label: "RVD rental index (his_data_3.xls)", url: RVD_RENT },
    ],
    processing: [
      "Parse the RVD legacy workbooks, melt the class columns and drop non-numeric cells.",
      "Join price and rent by month and property class; rebase both series to the 2019 average = 100.",
      "Policy and market events are curated separately and shown as vertical markers.",
    ],
    caveat:
      "The published RVD base is 1999 = 100; rebasing to 2019 only changes presentation. Class ALL is the published all-class series, not a computed average.",
  },
  marketDynamics: {
    title: "Rent–price dynamics",
    what: "The co-movement view plots monthly log changes of the RVD price and rental indices with an OLS fit. The lead/lag view correlates price change at t with rent change at t + lag.",
    sources: [
      { label: "RVD price index", url: RVD_PRICE },
      { label: "RVD rental index", url: RVD_RENT },
    ],
    processing: [
      "Compute month-on-month log changes from the two rebased indices.",
      "Co-movement: scatter the price change against the rent change and fit an OLS line; report R² and slope.",
      "Lead/lag: correlate price change at t with rent change at t + lag for lags −12 to +12 months; the strongest absolute correlation is labelled.",
    ],
    caveat:
      "Positive lags mean rents follow prices in this sample; this is a correlation pattern, not a causal estimate.",
  },
  marketClass: {
    title: "Year-on-year change",
    what: "Year-on-year price and rent growth for the class selected in the dashboard’s Class switch (All, or A–E), from 2018 onwards.",
    sources: [
      { label: "RVD price index", url: RVD_PRICE },
      { label: "RVD rental index", url: RVD_RENT },
    ],
    processing: [
      "Take the selected class series from the top Class switch and compute 12-month percentage changes.",
      "Filter the chart to 2018 onwards so the class cycles are comparable on the mockup’s window.",
    ],
    caveat:
      "Small classes can be thin; the line is the published RVD class index, not a transaction-level average.",
  },
  marketDrivers: {
    title: "What moves with prices?",
    what: "A bivariate view of the all-class RVD price index against one macro factor at a time: mortgage rate, transaction volume, household income or completions.",
    sources: [
      { label: "HKMA 1-month HIBOR", url: HKMA_HIBOR },
      { label: "RVD sale transactions", url: RVD_SALES },
      { label: "RVD completions", url: RVD_COMPLETIONS },
      { label: "C&SD median household income", url: CSD_INCOME },
    ],
    processing: [
      "Align the monthly price index with the selected factor on common months.",
      "Plot the raw points and an OLS fit; report n and R².",
      "Factors are shown one at a time and are not combined into a multivariate model.",
    ],
    caveat:
      "These are associations, not causal effects. The overlapping sample changes with the factor and the selected period.",
  },
  marketPca: {
    title: "Composition: what differentiates listings?",
    what: "A PCA description of current Squarefoot residential listings. It summarises how area, bedrooms, bathrooms, floor, age, MTR walk time and tenure co-vary. Sale $/ft² is used only as a supplementary colour.",
    sources: [
      { label: "Squarefoot listings and estate pages", url: SQUAREFOOT },
    ],
    processing: [
      "Use the 13,431 listings with complete attributes from the current crawl.",
      "Standardise log saleable area, bedrooms, bathrooms, floor-zone ordinal, building age, MTR walking minutes and a rental-listing dummy; median-impute missing numeric values.",
      "Fit PCA and show PC1/PC2 scores with loading vectors. Price per ft² is not a PCA input.",
    ],
    extra: "pca",
    caveat:
      "Descriptive current-sample analysis, not a representative survey or a causal model. MTR walk time is the estate’s stated walking time, not a routed distance.",
  },
  districtPriceKpis: {
    title: "District price KPIs",
    what: "Latest-quarter sale $/ft², rent $/ft², gross yield and price YoY for the selected district, or the median of the 18 district estimates for Hong Kong.",
    sources: [{ label: "Squarefoot estate transaction and rental pages", url: SQUAREFOOT }],
    processing: [
      "Sale and rent are transaction/rental-volume-weighted medians across estates in the latest quarter.",
      "Gross yield = 12 × rent $/ft² ÷ sale $/ft²; price YoY compares the latest quarter with four quarters earlier.",
    ],
  },
  districtCountKpis: {
    title: "District coverage KPIs",
    what: "Current listings, estates with latest-quarter transactions, and latest-quarter transaction count for the selected district or Hong Kong.",
    sources: [{ label: "Squarefoot listings and estate pages", url: SQUAREFOOT }],
    processing: [
      "Listings are the current crawl snapshot (sale and rent combined).",
      "Estates and transactions are counted from the latest-quarter estate panel; districts with too few estates are suppressed.",
    ],
  },
  districtMap: {
    title: "18 districts",
    what: "A choropleth of the 18 HAD districts for the selected metric and latest quarter. Click a district to cross-filter the rest of the dashboard.",
    sources: [
      { label: "HAD 18-district boundaries", url: HAD_BOUNDARIES },
      { label: "geohk land-only geometry", url: GEOHK },
      { label: "Squarefoot estate transaction series", url: SQUAREFOOT },
    ],
    processing: [
      "Intersect HAD district polygons with the census2001 land-only geometry and simplify for the web map.",
      "Join the district panel for the selected metric; districts with too few estates are suppressed and shown grey.",
      "The clicked district is stored in the shared filter state and persists across dashboards.",
    ],
    caveat:
      "The land mask uses a 2001 coastline, so post-2001 reclamation is not represented. Grey means insufficient data, never zero.",
  },
  districtProfile: {
    title: "Hong Kong profile",
    what: "Headline sale $/ft², rent $/ft², gross yield and price YoY for the selected district or Hong Kong overall, plus the six estates with the most transactions in the latest quarter.",
    sources: [
      { label: "Squarefoot estate transaction and rental pages", url: SQUAREFOOT },
    ],
    processing: [
      "District sale and rent are transaction/rental-volume-weighted medians across estates; Hong Kong is the median of the 18 district estimates.",
      "Gross yield = 12 × rent $/ft² ÷ sale $/ft²; price YoY compares the latest quarter with four quarters earlier.",
      "Top estates are ranked by latest-quarter transaction volume; bar height is volume and colour is Sale $/ft².",
    ],
    caveat:
      "Estate-based estimates are not a random sample of the housing stock. The latest quarter may be provisional when fewer than three estates are available.",
  },
  districtHeatmap: {
    title: "District × quarter heatmap",
    what: "Sale $/ft² by district and quarter from 2018 onwards, or current-listing median sale $/ft² by RVD class. Each cell is a district-period estimate; clicking selects the district.",
    sources: [
      { label: "Squarefoot estate transaction series", url: SQUAREFOOT },
    ],
    processing: [
      "For each district-quarter, take the transaction-volume-weighted median of estate average $/ft².",
      "For the class view, aggregate current sale listings by district and RVD class A–E.",
      "Suppress cells with fewer than three estates or too few listings; never fill missing cells with zero.",
    ],
    caveat:
      "Quarterly cells are estate-based and can be provisional. Class medians use asking prices from the current listing snapshot, not transactions.",
  },
  districtScatter: {
    title: "Building age and price",
    what: "Estate-level sale $/ft² against building age or walking time to the nearest MTR station. Bubble area is transaction volume.",
    sources: [
      { label: "Squarefoot estate pages and introductions", url: SQUAREFOOT },
    ],
    processing: [
      "Use latest-quarter estate sale $/ft² and transaction volume.",
      "Building age is the estate’s completion year subtracted from the data date.",
      "MTR walk time is parsed from the estate introduction phrase “about N min(s) walking distance to MTR” and merged by estate.",
    ],
    caveat:
      "MTR time is the estate’s stated walking time, not a routed distance. Only 461 of the 1,337 latest-quarter estates have one, so the MTR view uses a smaller sample.",
  },
  districtRegion: {
    title: "Sale $/ft² by region",
    what: "Quarterly sale $/ft² for Hong Kong Island, Kowloon and the New Territories from 2018 Q1 to 2026 Q4.",
    sources: [
      { label: "Squarefoot estate transaction series", url: SQUAREFOOT },
    ],
    processing: [
      "Assign each district to HK Island, Kowloon or New Territories.",
      "For each region-quarter, compute a transaction-volume-weighted average of district sale $/ft².",
      "Plot one line per region; hover shows the quarter and regional values.",
    ],
    caveat:
      "Derived regional aggregate, not an official RVD regional index. Changes in the district mix can move the regional average.",
  },
  affordabilityRatioKpis: {
    title: "Price- and rent-to-income",
    what: "Price-to-income (PTI) and rent-to-income (RTI) for the selected district or the median of the 18 districts. Both use a standard 500 ft² flat and median household income.",
    sources: [
      { label: "C&SD median household income", url: CSD_INCOME },
      { label: "Squarefoot district price and rent panel", url: SQUAREFOOT },
    ],
    processing: [
      "Price = sale $/ft² × 500; rent = rent $/ft² × 500.",
      "PTI = price ÷ (12 × monthly household income); RTI = monthly rent ÷ monthly household income.",
      "Hong Kong values are medians of the 18 district estimates.",
    ],
  },
  affordabilityMortgageKpis: {
    title: "Mortgage burden and required income",
    what: "Monthly mortgage payment as a share of household income, and the income needed to keep that payment at 50% of income.",
    sources: [
      { label: "C&SD median household income", url: CSD_INCOME },
      { label: "HKMA mortgage survey", url: HKMA_MORTGAGE },
      { label: "HKMA 1-month HIBOR", url: HKMA_HIBOR },
    ],
    processing: [
      "Assume a 500 ft² flat, 70% loan-to-value, 30-year amortisation and a mortgage rate of 1-month HIBOR + 1.3 percentage points.",
      "Mortgage burden = monthly payment ÷ monthly household income; required income = payment ÷ 0.50.",
      "The same assumptions drive the calculator overlay.",
    ],
  },
  affordabilityPriceKpis: {
    title: "Gross yield and median price",
    what: "Latest gross rental yield and median district sale price for the standard flat. Median price is the median of the district price estimates, not the median transaction price.",
    sources: [{ label: "Squarefoot district price and rent panel", url: SQUAREFOOT }],
    processing: [
      "Gross yield = 12 × rent $/ft² ÷ sale $/ft².",
      "Median price = median district sale $/ft² × 500 ft²; for a selected district, the district value is used.",
    ],
  },
  affordabilityTrend: {
    title: "Rent, income and rent burden",
    what: "Monthly rent and median household income for a standard flat, with rent-to-income (RTI) bars. The flat-size slider changes the assumed saleable area; the district selector switches between Hong Kong and a district.",
    sources: [
      { label: "C&SD median household income", url: CSD_INCOME },
      { label: "Squarefoot / RVD district rent panel", url: SQUAREFOOT },
      { label: "RVD rental index", url: RVD_RENT },
    ],
    processing: [
      "Rent = district rent $/ft² × selected flat area; income is annual C&SD median household income, interpolated to months.",
      "RTI = monthly rent ÷ monthly household income; the right axis is normally 0–1.",
      "Historical district rent is modelled as current district rent × RVD rent index / latest RVD rent index; the latest quarter uses observed estate rental statistics.",
    ],
    caveat:
      "Historical district rent is modelled, not observed. Income is household income, not buyer income; the standard flat is a comparison device, not a typical unit.",
  },
  affordabilityRanking: {
    title: "Affordability ranking",
    what: "Districts ranked by price-to-income (PTI) or rent-to-income (RTI) for the latest income year. Click a bar to select the district.",
    sources: [
      { label: "C&SD median household income", url: CSD_INCOME },
      { label: "Squarefoot district price panel", url: SQUAREFOOT },
    ],
    processing: [
      "Use a standard 500 ft² saleable flat for every district.",
      "PTI = (sale $/ft² × 500) ÷ (12 × median monthly household income); RTI = (rent $/ft² × 500) ÷ monthly income.",
      "Rank districts within the income year; rank 1 is least affordable.",
    ],
    caveat:
      "The ranking uses a standard flat and household income, not actual buyer incomes or actual unit sizes. Income is annual and currently ends in 2025.",
  },
  affordabilityYield: {
    title: "Yield over time",
    what: "Gross rental yield for the selected district against the 18-district median, from 2018 onwards.",
    sources: [
      { label: "Squarefoot district rent and sale panel", url: SQUAREFOOT },
      { label: "RVD rental index", url: RVD_RENT },
    ],
    processing: [
      "Gross yield = 12 × rent $/ft² ÷ sale $/ft².",
      "District rent history is modelled from the RVD rental index; the latest quarter uses observed 90-day estate rents.",
      "The median line is the median across the 18 district yields in each quarter.",
    ],
    caveat:
      "Yields are gross: management fees, rates, taxes and vacancy are excluded. Values outside 0–15% are flagged.",
  },
  affordabilityGrowth: {
    title: "Yield vs price growth",
    what: "Districts plotted by three-year sale-price CAGR and current gross yield; bubble area is transaction volume. An OLS line summarises the association.",
    sources: [
      { label: "Squarefoot district price and rent panel", url: SQUAREFOOT },
    ],
    processing: [
      "Compute the three-year CAGR from district sale $/ft² and the latest gross yield.",
      "Size bubbles by latest-quarter transaction volume; colour by region.",
      "Fit an OLS line to the district points and show it as a guide, not a prediction.",
    ],
    caveat:
      "Small or thin districts can be influential. The line is descriptive and is not a causal relationship.",
  },
  affordabilityTenant: {
    title: "Tenant vs buyer",
    what: "Rent-to-income against mortgage burden for the standard flat in each district. Lower-left districts are easier on both renting and buying budgets.",
    sources: [
      { label: "C&SD median household income", url: CSD_INCOME },
      { label: "Squarefoot district rent and sale panel", url: SQUAREFOOT },
      { label: "HKMA mortgage rate survey", url: HKMA_MORTGAGE },
    ],
    processing: [
      "Use a 500 ft² flat, 70% loan-to-value and 30-year amortisation.",
      "Mortgage burden = monthly payment ÷ monthly household income; RTI = monthly rent ÷ monthly income.",
      "The mortgage rate proxy is 1-month HIBOR + 1.3 percentage points; the calculator applies the same assumptions.",
    ],
    caveat:
      "Excludes stamp duty, legal and agency fees, management fees and vacancy. Household income is not buyer income.",
  },
} satisfies Record<string, DataInfo>;
