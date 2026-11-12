/**
 * The shareable brief. Every stage reads this state from the store; the URL
 * mirrors it so a copied link rehydrates the same journey.
 */

export type Tenure = "sale" | "rent";

export type FilterSnapshot = {
  /** null means the user has not yet chosen buy or rent. */
  tenure: Tenure | null;
  selectedDistrict: string | null;
  compareDistrict: string | null;
  propertyClass: string;
  monthlyIncome: number;
  depositPct: number;
  mortgageRate: number;
  flatSize: number;
  loanYears: number;
  dsrCap: number;
  rtiCap: number;
};

export const FILTER_DEFAULTS: FilterSnapshot = {
  tenure: null,
  selectedDistrict: null,
  compareDistrict: null,
  propertyClass: "ALL",
  monthlyIncome: 45_000,
  depositPct: 30,
  mortgageRate: 4.2,
  flatSize: 500,
  loanYears: 30,
  dsrCap: 50,
  rtiCap: 40,
};

const DISTRICT_CODES = new Set("ABCDEFGHJKLMNPQRST".split(""));
const CLASSES = new Set(["ALL", "A", "B", "C", "D", "E"]);

const NUMERIC_BOUNDS: Record<
  string,
  { key: keyof FilterSnapshot; min: number; max: number }
> = {
  income: { key: "monthlyIncome", min: 0, max: 1_000_000 },
  deposit: { key: "depositPct", min: 0, max: 95 },
  rate: { key: "mortgageRate", min: 0, max: 20 },
  size: { key: "flatSize", min: 150, max: 2_000 },
  years: { key: "loanYears", min: 5, max: 40 },
  dsr: { key: "dsrCap", min: 30, max: 70 },
  rti: { key: "rtiCap", min: 20, max: 60 },
};

function trimNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Serialise the brief to a stable query string (including the "?"). */
export function buildFilterSearch(filters: Partial<FilterSnapshot>): string {
  const params = new URLSearchParams();
  if (filters.selectedDistrict && DISTRICT_CODES.has(filters.selectedDistrict)) {
    params.set("district", filters.selectedDistrict);
  }
  // "buy" is the friendly URL value; "sale" is the internal/legacy value.
  if (filters.tenure === "sale") params.set("tenure", "buy");
  if (filters.tenure === "rent") params.set("tenure", "rent");
  if (filters.propertyClass && filters.propertyClass !== "ALL" && CLASSES.has(filters.propertyClass)) {
    params.set("class", filters.propertyClass);
  }
  if (filters.compareDistrict && DISTRICT_CODES.has(filters.compareDistrict)) {
    params.set("compare", filters.compareDistrict);
  }

  const numeric: Array<[string, keyof FilterSnapshot]> = [
    ["income", "monthlyIncome"],
    ["deposit", "depositPct"],
    ["rate", "mortgageRate"],
    ["size", "flatSize"],
    ["years", "loanYears"],
    ["dsr", "dsrCap"],
    ["rti", "rtiCap"],
  ];
  numeric.forEach(([param, key]) => {
    const value = filters[key];
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    if (value === FILTER_DEFAULTS[key]) return;
    params.set(param, trimNumber(value));
  });

  const value = params.toString();
  return value ? `?${value}` : "";
}

/** Read the brief from a query string, validating and clamping every value. */
export function parseFilterSearch(search: string): Partial<FilterSnapshot> {
  const params = new URLSearchParams(search);
  const result: Partial<FilterSnapshot> = {};

  const district = params.get("district");
  if (district && DISTRICT_CODES.has(district)) result.selectedDistrict = district;
  const compare = params.get("compare");
  if (compare && DISTRICT_CODES.has(compare)) result.compareDistrict = compare;
  const tenure = params.get("tenure");
  if (tenure === "rent") result.tenure = "rent";
  if (tenure === "buy" || tenure === "sale") result.tenure = "sale";
  const propertyClass = params.get("class");
  if (propertyClass && CLASSES.has(propertyClass)) result.propertyClass = propertyClass;

  Object.entries(NUMERIC_BOUNDS).forEach(([param, spec]) => {
    const raw = params.get(param);
    if (raw === null || raw.trim() === "") return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const clamped = Math.min(spec.max, Math.max(spec.min, Math.round(value * 100) / 100));
    (result[spec.key] as number) = clamped;
  });

  return result;
}
