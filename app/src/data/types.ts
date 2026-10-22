export type RvdPoint = {
  month: string;
  property_class: string;
  price_index: number | null;
  rent_index: number | null;
};

export type YieldPoint = {
  month: string;
  property_class: string;
  yield_pct: number | null;
};

export type SalesPoint = {
  month: string;
  primary_count: number | null;
  primary_value_m: number | null;
  secondary_count: number | null;
  secondary_value_m: number | null;
  total_count: number | null;
  total_value_m: number | null;
};

export type CompletionPoint = {
  year: number;
  property_class: string;
  completions: number | null;
};

export type MortgagePoint = {
  month: string;
  outstanding_loans_amt: number | null;
  new_applications: number | null;
  new_loans_approved_amt: number | null;
  new_loans_approved: number | null;
  avg_loan_size: number | null;
  ltv_ratio: number | null;
  hibor_share: number | null;
  blr_share: number | null;
  fixed_share: number | null;
  delinquency_ratio: number | null;
};

export type RatePoint = {
  month: string;
  hibor_1m: number | null;
  hibor_3m: number | null;
  best_lending_rate: number | null;
};

export type IncomePoint = {
  year: number;
  district_code: string;
  district_name: string;
  household_size: number | null;
  median_income: number | null;
  median_income_all: number | null;
  median_income_excl_helpers: number | null;
};

export type LandRegAreaPoint = {
  month: string;
  area: string;
  asp_count: number | null;
};

export type LandRegSummaryPoint = {
  month: string;
  residential_asp: number | null;
  non_residential_asp: number | null;
  primary_sales: number | null;
  secondary_sales: number | null;
};

export type MarketEvent = {
  date: string;
  label: string;
  type: "policy" | "rates" | "market" | string;
  source: string;
};

export type MarketData = {
  as_of: string | null;
  generated_at: string;
  rvd: RvdPoint[];
  yields: YieldPoint[];
  sales: SalesPoint[];
  completions: CompletionPoint[];
  mortgage: MortgagePoint[];
  rates: RatePoint[];
  income: IncomePoint[];
  landreg: {
    area: LandRegAreaPoint[];
    summary: LandRegSummaryPoint[];
  };
  events: MarketEvent[];
};

export type DistrictProperties = {
  district_code: string;
  name_en: string;
  name_zh: string;
  region: string;
  centroid_lon: number;
  centroid_lat: number;
};

export type DistrictFeature = {
  type: "Feature";
  properties: DistrictProperties;
  geometry: { type: string; coordinates: unknown };
};

export type DistrictCollection = {
  type: "FeatureCollection";
  features: DistrictFeature[];
};

export type DistrictPanelRow = {
  district_code: string;
  quarter: string;
  sale_psf: number | null;
  rent_psf: number | null;
  yield_pct: number | null;
  n_estates: number;
  volume: number;
  rent_modelled: boolean;
  region: string;
};

export type DistrictClassRow = {
  district_code: string;
  tenure: "sale" | "rent";
  property_class: string;
  psf: number;
  n: number;
};

export type EstateLatest = {
  estate_id: string;
  name: string;
  district_code: string;
  price_psf: number | null;
  volume: number;
  rent_psf: number | null;
  yield_pct: number | null;
  mtr_walk_minutes: number | null;
  building_age_years: number | null;
  total_units: number | null;
  lat: number | null;
  lon: number | null;
};

export type AffordabilityRow = {
  district_code: string;
  year: number;
  median_area_sqft: number;
  price: number;
  rent: number;
  median_income: number;
  pti: number;
  rti: number;
  mortgage_rate: number;
  monthly_payment: number;
  mortgage_burden: number;
  required_income: number;
  rank: number;
};

export type DistrictListingCount = {
  total: number;
  sale: number;
  rent: number;
};

export type DistrictData = {
  as_of: string | null;
  generated_at: string;
  districts: DistrictProperties[];
  panel: DistrictPanelRow[];
  classes: DistrictClassRow[];
  estates: EstateLatest[];
  affordability: AffordabilityRow[];
  listing_counts?: Record<string, DistrictListingCount>;
  coverage: {
    estates: number;
    listings: number;
    listings_with_district?: number;
    districts_with_panel: number;
  };
};
