import type { AffordabilityRow, MarketEvent, RatePoint, RvdPoint, YieldPoint } from "../data/types";
import { median, pctChange, shiftMonth } from "./stats";

export type SeriesPoint = { month: string; value: number };

export function rvdSeries(
  rows: RvdPoint[],
  propertyClass: string,
  metric: "price" | "rent",
): SeriesPoint[] {
  const field = metric === "price" ? "price_index" : "rent_index";
  return rows
    .filter((row) => row.property_class === propertyClass && row[field] !== null)
    .map((row) => ({ month: row.month, value: Number(row[field]) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Rebase to the 2019 average so price and rent share one index axis. */
export function rebaseSeries(series: SeriesPoint[], baseMonth = "2019-01"): SeriesPoint[] {
  const base =
    series.find((point) => point.month === baseMonth)?.value ??
    series.find((point) => point.month >= baseMonth)?.value ??
    series[0]?.value;
  if (!base) return series;
  return series.map((point) => ({ ...point, value: (point.value / base) * 100 }));
}

export function yoySeries(series: SeriesPoint[]): SeriesPoint[] {
  const map = new Map(series.map((point) => [point.month, point.value]));
  const output: SeriesPoint[] = [];
  series.forEach((point) => {
    const previous = map.get(shiftMonth(point.month, -12));
    const change = previous === undefined ? null : pctChange(point.value, previous);
    if (change !== null) output.push({ month: point.month, value: change });
  });
  return output;
}

export function latestPoint(series: SeriesPoint[]): SeriesPoint | null {
  return series.length ? series[series.length - 1] : null;
}

export function pointAt(series: SeriesPoint[], monthsBack: number): SeriesPoint | null {
  const latest = latestPoint(series);
  if (!latest) return null;
  const target = shiftMonth(latest.month, -monthsBack);
  let candidate: SeriesPoint | null = null;
  series.forEach((point) => {
    if (point.month <= target) candidate = point;
  });
  return candidate;
}

export function ratioSeries(numerator: SeriesPoint[], denominator: SeriesPoint[]): SeriesPoint[] {
  const denominatorMap = new Map(denominator.map((point) => [point.month, point.value]));
  const output: SeriesPoint[] = [];
  numerator.forEach((point) => {
    const divisor = denominatorMap.get(point.month);
    if (!divisor) return;
    output.push({ month: point.month, value: (point.value / divisor) * 100 });
  });
  return output;
}

export function lastMonths(series: SeriesPoint[], months: number): SeriesPoint[] {
  const latest = latestPoint(series);
  if (!latest) return [];
  const start = shiftMonth(latest.month, -months + 1);
  return series.filter((point) => point.month >= start && point.month <= latest.month);
}

/**
 * RVD yields exist for classes A–E only. "All classes" is the unweighted mean
 * of the five class series, matching the way the reference dashboard treats it.
 */
export function yieldSeries(rows: YieldPoint[], propertyClass: string): SeriesPoint[] {
  if (propertyClass !== "ALL") {
    return rows
      .filter((row) => row.property_class === propertyClass && row.yield_pct !== null)
      .map((row) => ({ month: row.month, value: Number(row.yield_pct) }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
  const byMonth = new Map<string, number[]>();
  rows.forEach((row) => {
    if (row.property_class === "ALL" || row.yield_pct === null) return;
    const bucket = byMonth.get(row.month) ?? [];
    bucket.push(Number(row.yield_pct));
    byMonth.set(row.month, bucket);
  });
  return [...byMonth.entries()]
    .map(([month, values]) => ({ month, value: values.reduce((sum, value) => sum + value, 0) / values.length }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export type RateKind = "hibor" | "blr";

/**
 * Effective mortgage rate benchmarks: HIBOR 1M + 1.3pp (the dominant H-plan
 * spread in METHODOLOGY) and BLR − 2.5pp for the P-plan comparison.
 */
export function effectiveRateSeries(rows: RatePoint[], kind: RateKind): SeriesPoint[] {
  return rows
    .map((row) => {
      if (kind === "hibor") {
        return row.hibor_1m === null ? null : { month: row.month, value: row.hibor_1m + 1.3 };
      }
      return row.best_lending_rate === null
        ? null
        : { month: row.month, value: row.best_lending_rate - 2.5 };
    })
    .filter((point): point is SeriesPoint => point !== null)
    .map((point) => ({ month: point.month, value: Number(point.value.toFixed(3)) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export type SpreadPoint = {
  month: string;
  yieldPct: number;
  ratePct: number;
  spread: number;
  /** Lower of the two lines; the band is drawn from here. */
  lower: number;
  /** Absolute gap between the two lines. */
  gap: number;
};

export function spreadSeries(
  yields: SeriesPoint[],
  rates: SeriesPoint[],
  options: { startMonth?: string } = {},
): SpreadPoint[] {
  const rateMap = new Map(rates.map((point) => [point.month, point.value]));
  const output: SpreadPoint[] = [];
  yields.forEach((point) => {
    if (options.startMonth && point.month < options.startMonth) return;
    const rate = rateMap.get(point.month);
    if (rate === undefined) return;
    output.push({
      month: point.month,
      yieldPct: point.value,
      ratePct: rate,
      spread: point.value - rate,
      lower: Math.min(point.value, rate),
      gap: Math.abs(point.value - rate),
    });
  });
  return output;
}

export type BuyRentPoint = { year: number; rent: number; payment: number };

/** 18-district median rent and mortgage payment for the 500 ft² benchmark. */
export function buyVsRentSeries(rows: AffordabilityRow[]): BuyRentPoint[] {
  const byYear = new Map<number, { rent: number[]; payment: number[] }>();
  rows.forEach((row) => {
    const bucket = byYear.get(row.year) ?? { rent: [], payment: [] };
    if (row.rent !== null) bucket.rent.push(row.rent);
    if (row.monthly_payment !== null) bucket.payment.push(row.monthly_payment);
    byYear.set(row.year, bucket);
  });
  return [...byYear.entries()]
    .map(([year, bucket]) => ({
      year,
      rent: median(bucket.rent),
      payment: median(bucket.payment),
    }))
    .filter((point) => point.rent > 0 && point.payment > 0)
    .sort((a, b) => a.year - b.year);
}

/**
 * Most recent year in which buying flipped from cheaper to dearer than renting
 * (or back). Returns the year and the current relationship.
 */
export function latestCrossover(points: BuyRentPoint[]): {
  year: number | null;
  buyAboveRent: boolean;
} {
  let year: number | null = null;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1].payment - points[index - 1].rent;
    const current = points[index].payment - points[index].rent;
    if (Math.sign(previous) !== Math.sign(current)) year = points[index].year;
  }
  const last = points[points.length - 1];
  return { year, buyAboveRent: last ? last.payment > last.rent : false };
}

export function eventMarkers(events: MarketEvent[]): Array<{ month: string; label: string; type: string }> {
  return events
    .map((event) => ({ month: event.date.slice(0, 7), label: event.label, type: event.type }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
