import type { AffordabilityRow, DistrictClassRow, DistrictPanelRow, DistrictProperties, DistrictData, EstateLatest } from "../data/types";
import { fmtPct, fmtPctPlain, fmtPsf } from "./format";
import { budgetStatus, requiredIncomeForPrice, type BudgetInput, type BudgetStatus } from "./journey";
import { median } from "./stats";
import type { SeriesPoint } from "./marketSeries";

export type DistrictMetric = "sale_psf" | "rent_psf" | "yield_pct" | "price_yoy" | "rent_yoy";

export const METRIC_LABELS: Record<DistrictMetric, string> = {
  sale_psf: "Sale $/ft²",
  rent_psf: "Rent $/ft²",
  yield_pct: "Gross yield",
  price_yoy: "Price YoY",
  rent_yoy: "Rent YoY",
};

export function quarterNumber(quarter: string): number {
  const [year, q] = quarter.split("-Q");
  return Number(year) * 4 + (Number(q) - 1);
}

export function shiftQuarter(quarter: string, quarters: number): string {
  const index = quarterNumber(quarter) + quarters;
  const year = Math.floor(index / 4);
  const q = (index % 4) + 1;
  return `${year}-Q${q}`;
}

export function latestQuarter(rows: DistrictPanelRow[]): string {
  return rows.reduce((latest, row) => (quarterNumber(row.quarter) > quarterNumber(latest) ? row.quarter : latest), rows[0]?.quarter ?? "2026-Q4");
}

export function rowsAtQuarter(rows: DistrictPanelRow[], quarter: string): DistrictPanelRow[] {
  return rows.filter((row) => row.quarter === quarter);
}

export function latestRows(rows: DistrictPanelRow[]): DistrictPanelRow[] {
  return rowsAtQuarter(rows, latestQuarter(rows));
}

/** Latest roll-up for one district, for the rail and the stage-3 KPIs. */
export function latestRow(rows: DistrictPanelRow[], districtCode: string): DistrictPanelRow | null {
  const latest = latestQuarter(rows);
  return rows.find((row) => row.district_code === districtCode && row.quarter === latest) ?? null;
}

export function metricValue(
  row: DistrictPanelRow | null,
  metric: DistrictMetric,
  previous: DistrictPanelRow | null = null,
): number | null {
  if (!row) return null;
  if (metric === "price_yoy") {
    if (!previous || !row.sale_psf || !previous.sale_psf) return null;
    return (row.sale_psf / previous.sale_psf - 1) * 100;
  }
  if (metric === "rent_yoy") {
    if (!previous || !row.rent_psf || !previous.rent_psf) return null;
    return (row.rent_psf / previous.rent_psf - 1) * 100;
  }
  const value = row[metric];
  return value === null || value === undefined ? null : Number(value);
}

/**
 * Metric values for every district at one quarter. Price YoY is computed
 * against the same quarter a year earlier, not the previous quarter.
 */
export function metricValues(
  rows: DistrictPanelRow[],
  quarter: string,
  metric: DistrictMetric,
): Record<string, number | null> {
  const current = rowsAtQuarter(rows, quarter);
  const previousQuarter = shiftQuarter(quarter, -4);
  const previous = rowsAtQuarter(rows, previousQuarter);
  const previousByCode = new Map(previous.map((row) => [row.district_code, row]));
  const values: Record<string, number | null> = {};
  current.forEach((row) => {
    values[row.district_code] = metricValue(row, metric, previousByCode.get(row.district_code) ?? null);
  });
  return values;
}

export function districtSeries(
  rows: DistrictPanelRow[],
  districtCode: string,
  metric: DistrictMetric,
): SeriesPoint[] {
  const series = rows
    .filter((row) => row.district_code === districtCode && row.quarter >= "2018-Q1")
    .sort((a, b) => quarterNumber(a.quarter) - quarterNumber(b.quarter));
  const byQuarter = new Map(series.map((row) => [row.quarter, row]));
  const output: SeriesPoint[] = [];
  series.forEach((row) => {
    const value = metricValue(row, metric, byQuarter.get(shiftQuarter(row.quarter, -4)) ?? null);
    if (value !== null) output.push({ month: row.quarter, value });
  });
  return output;
}

/** Territory-wide median across the 18 districts for each quarter. */
export function hkMedianSeries(
  rows: DistrictPanelRow[],
  metric: DistrictMetric,
  fromQuarter = "2018-Q1",
): SeriesPoint[] {
  const quarters = [...new Set(rows.map((row) => row.quarter))]
    .filter((quarter) => quarter >= fromQuarter)
    .sort((a, b) => quarterNumber(a) - quarterNumber(b));
  return quarters
    .map((quarter) => {
      const values = Object.values(metricValues(rows, quarter, metric)).filter(
        (value): value is number => value !== null && Number.isFinite(value),
      );
      return values.length ? { month: quarter, value: median(values) } : null;
    })
    .filter((point): point is SeriesPoint => point !== null);
}

export function rankValues(
  values: Record<string, number | null>,
  order: "asc" | "desc" = "asc",
): Record<string, number> {
  const entries = Object.entries(values)
    .filter((entry): entry is [string, number] => entry[1] !== null && Number.isFinite(entry[1]))
    .sort((a, b) => (order === "asc" ? a[1] - b[1] : b[1] - a[1]));
  const ranks: Record<string, number> = {};
  entries.forEach(([code], index) => {
    ranks[code] = index + 1;
  });
  return ranks;
}

export function formatMetric(metric: DistrictMetric, value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (metric === "price_yoy" || metric === "rent_yoy") return fmtPct(value);
  if (metric === "yield_pct") return fmtPctPlain(value, 2);
  return fmtPsf(value);
}

export function formatMetricAxis(metric: DistrictMetric, value: number): string {
  if (metric === "price_yoy" || metric === "rent_yoy") {
    return `${value > 0 ? "+" : ""}${value.toFixed(0)}%`;
  }
  if (metric === "yield_pct") return `${value.toFixed(1)}%`;
  if (metric === "rent_psf") return `HK$${Math.round(value)}`;
  return `HK$${Math.round(value / 1000)}k`;
}

export type DistrictLookup = Record<string, DistrictProperties>;

export function districtLookup(districts: DistrictProperties[]): DistrictLookup {
  return districts.reduce<DistrictLookup>((lookup, district) => {
    lookup[district.district_code] = district;
    return lookup;
  }, {});
}

export function districtName(lookup: DistrictLookup, code: string | null): string {
  if (!code) return "Hong Kong";
  return lookup[code]?.name_en ?? code;
}

export const REGION_ORDER = ["HK Island", "Kowloon", "New Territories"] as const;

export function regionColor(region: string, theme: { island: string; kowloon: string; nt: string }): string {
  if (region === "HK Island") return theme.island;
  if (region === "Kowloon") return theme.kowloon;
  return theme.nt;
}

/** Median listing $/ft² by RVD class vs the transaction panel, for stage 5. */
export type AskingRow = { property_class: string; asking: number; transaction: number; premium: number };

export function askingVsTransaction(
  classes: DistrictClassRow[],
  panel: DistrictPanelRow[],
  districtCode: string,
  flatTenure: "sale" | "rent" = "sale",
): AskingRow[] {
  const latest = latestQuarter(panel);
  const panelRow = panel.find((row) => row.district_code === districtCode && row.quarter === latest);
  const transaction = flatTenure === "sale" ? panelRow?.sale_psf ?? 0 : panelRow?.rent_psf ?? 0;
  return classes
    .filter((row) => row.district_code === districtCode && row.tenure === flatTenure)
    .sort((a, b) => a.property_class.localeCompare(b.property_class))
    .map((row) => ({
      property_class: row.property_class,
      asking: row.psf,
      transaction,
      premium: transaction ? ((row.psf - transaction) / transaction) * 100 : 0,
    }));
}

export function transactionTotal(rows: DistrictPanelRow[]): number {
  return rows.reduce((sum, row) => sum + (row.volume ?? 0), 0);
}

export function listingCount(data: DistrictData | null, code: string | null): { total: number; sale: number; rent: number } {
  if (!data?.listing_counts || !code) return { total: 0, sale: 0, rent: 0 };
  return data.listing_counts[code] ?? { total: 0, sale: 0, rent: 0 };
}

export function budgetPrices(rows: DistrictPanelRow[], flatSize: number): Record<string, number | null> {
  return rows.reduce<Record<string, number | null>>((prices, row) => {
    prices[row.district_code] = row.sale_psf === null ? null : row.sale_psf * flatSize;
    return prices;
  }, {});
}

export type DistrictBudgetRow = {
  code: string;
  name: string;
  region: string;
  psf: number;
  monthly: number;
  status: BudgetStatus;
  requiredIncome: number;
  volume: number;
};

/**
 * Per-district affordability for the budget-fit chart: the monthly price (buy)
 * or rent (rent) of the brief's flat size against the ceiling, sorted cheapest
 * first. Required income uses the same ceiling logic as the rail.
 */
export function districtBudgetRows(
  rows: DistrictPanelRow[],
  lookup: DistrictLookup,
  options: {
    tenure: "sale" | "rent";
    flatSize: number;
    ceiling: number;
    rtiCap: number;
    budget: BudgetInput;
  },
): DistrictBudgetRow[] {
  const isRent = options.tenure === "rent";
  return rows
    .map((row) => {
      const psf = (isRent ? row.rent_psf : row.sale_psf) ?? 0;
      const monthly = psf * options.flatSize;
      return {
        code: row.district_code,
        name: lookup[row.district_code]?.name_en ?? row.district_code,
        region: row.region,
        psf,
        monthly,
        status: budgetStatus(monthly, options.ceiling),
        requiredIncome: isRent
          ? monthly / (Math.max(1, options.rtiCap) / 100)
          : requiredIncomeForPrice(monthly, options.budget),
        volume: row.volume,
      };
    })
    .filter((row) => row.psf > 0)
    .sort((a, b) => a.monthly - b.monthly);
}

export type EstateFilters = {
  district: string | null;
  maxPrice: number;
  flatSize: number;
  ageBand: "any" | "<10" | "10-19" | "20-39" | "40+";
  mtrBand: "any" | "<=5" | "<=10" | ">10";
  minVolume: number;
  tenure: "sale" | "rent";
  sort: "value" | "yield" | "age" | "volume";
};

/**
 * A handful of estate records carry impossible averages (for example a
 * "HK$1,052/ft²" block in Tuen Mun). They are treated as bad records rather
 * than plotted, and the exclusion is stated in the data note.
 */
const PLAUSIBLE_PSF: Record<"sale" | "rent", [number, number]> = {
  sale: [5_000, 80_000],
  rent: [5, 300],
};

function plausiblePsf(psf: number | null, tenure: "sale" | "rent"): boolean {
  if (psf === null) return false;
  const [low, high] = PLAUSIBLE_PSF[tenure];
  return psf >= low && psf <= high;
}

export function filterEstates(estates: EstateLatest[], filters: EstateFilters): EstateLatest[] {
  const filtered = estates.filter((estate) => {
    if (filters.district && estate.district_code !== filters.district) return false;
    if (filters.tenure === "sale") {
      if (!plausiblePsf(estate.price_psf, "sale")) return false;
      if (filters.maxPrice > 0 && (estate.price_psf ?? 0) * filters.flatSize > filters.maxPrice) return false;
    } else {
      if (!plausiblePsf(estate.rent_psf, "rent")) return false;
      if (filters.maxPrice > 0 && (estate.rent_psf ?? 0) * filters.flatSize > filters.maxPrice) return false;
    }
    if (filters.ageBand !== "any") {
      const age = estate.building_age_years;
      if (age === null) return false;
      if (filters.ageBand === "<10" && !(age < 10)) return false;
      if (filters.ageBand === "10-19" && !(age >= 10 && age < 20)) return false;
      if (filters.ageBand === "20-39" && !(age >= 20 && age < 40)) return false;
      if (filters.ageBand === "40+" && !(age >= 40)) return false;
    }
    if (filters.mtrBand !== "any") {
      const mtr = estate.mtr_walk_minutes;
      if (mtr === null) return false;
      if (filters.mtrBand === "<=5" && !(mtr <= 5)) return false;
      if (filters.mtrBand === "<=10" && !(mtr <= 10)) return false;
      if (filters.mtrBand === ">10" && !(mtr > 10)) return false;
    }
    if (estate.volume < filters.minVolume) return false;
    return true;
  });

  const value = (estate: EstateLatest) =>
    filters.tenure === "sale" ? estate.price_psf ?? 0 : estate.rent_psf ?? 0;
  return filtered.sort((a, b) => {
    switch (filters.sort) {
      case "yield":
        return (b.yield_pct ?? -1) - (a.yield_pct ?? -1);
      case "age":
        return (a.building_age_years ?? 999) - (b.building_age_years ?? 999);
      case "volume":
        return b.volume - a.volume;
      default:
        return value(a) - value(b);
    }
  });
}

export function estateCounts(estates: EstateLatest[], filters: EstateFilters): {
  matched: number;
  excluded: number;
} {
  const matched = filterEstates(estates, filters).length;
  const pool = filters.district ? estates.filter((e) => e.district_code === filters.district) : estates;
  return { matched, excluded: Math.max(0, pool.length - matched) };
}

export function affordabilityFor(rows: AffordabilityRow[], district: string | null): AffordabilityRow[] {
  return rows
    .filter((row) => (district ? row.district_code === district : true))
    .sort((a, b) => a.year - b.year);
}

export function medianAffordability(rows: AffordabilityRow[]): AffordabilityRow[] {
  const byYear = new Map<number, AffordabilityRow[]>();
  rows.forEach((row) => {
    const bucket = byYear.get(row.year) ?? [];
    bucket.push(row);
    byYear.set(row.year, bucket);
  });
  return [...byYear.entries()]
    .map(([year, bucket]) => {
      const first = bucket[0];
      return {
        ...first,
        year,
        rent: median(bucket.map((row) => row.rent)),
        monthly_payment: median(bucket.map((row) => row.monthly_payment)),
        price: median(bucket.map((row) => row.price)),
        median_income: median(bucket.map((row) => row.median_income)),
        pti: median(bucket.map((row) => row.pti)),
        rti: median(bucket.map((row) => row.rti)),
      } satisfies AffordabilityRow;
    })
    .sort((a, b) => a.year - b.year);
}

