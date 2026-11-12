import { describe, expect, it } from "vitest";
import type { AffordabilityRow, RatePoint, RvdPoint, YieldPoint } from "../data/types";
import {
  buyVsRentSeries,
  effectiveRateSeries,
  latestCrossover,
  rebaseSeries,
  rvdSeries,
  spreadSeries,
  yoySeries,
  yieldSeries,
} from "./marketSeries";

const RVD: RvdPoint[] = [
  { month: "2019-01", property_class: "ALL", price_index: 200, rent_index: 150 },
  { month: "2018-01", property_class: "ALL", price_index: 100, rent_index: 100 },
  { month: "2020-01", property_class: "ALL", price_index: 220, rent_index: 165 },
  { month: "2020-01", property_class: "A", price_index: 999, rent_index: 999 },
];

const YIELDS: YieldPoint[] = [
  { month: "2020-01", property_class: "A", yield_pct: 2 },
  { month: "2020-01", property_class: "B", yield_pct: 4 },
  { month: "2020-01", property_class: "ALL", yield_pct: 9 },
];

const RATES: RatePoint[] = [
  { month: "2020-01", hibor_1m: 1, hibor_3m: null, best_lending_rate: 5 },
  { month: "2019-12", hibor_1m: null, hibor_3m: null, best_lending_rate: null },
];

function affordability(year: number, district: string, rent: number, payment: number): AffordabilityRow {
  return {
    district_code: district,
    year,
    median_area_sqft: 500,
    price: 5_000_000,
    rent,
    median_income: 30_000,
    pti: 12,
    rti: 0.3,
    mortgage_rate: 4.2,
    monthly_payment: payment,
    mortgage_burden: 0.5,
    required_income: 40_000,
    rank: 1,
  };
}

describe("market series helpers", () => {
  it("filters a class and sorts by month", () => {
    const series = rvdSeries(RVD, "ALL", "price");
    expect(series.map((point) => point.month)).toEqual(["2018-01", "2019-01", "2020-01"]);
    expect(series[2].value).toBe(220);
  });

  it("rebases to the base month", () => {
    const rebased = rebaseSeries(rvdSeries(RVD, "ALL", "price"), "2019-01");
    expect(rebased.find((point) => point.month === "2019-01")?.value).toBe(100);
    expect(rebased.find((point) => point.month === "2020-01")?.value).toBeCloseTo(110);
  });

  it("computes year-on-year change", () => {
    const yoy = yoySeries(rvdSeries(RVD, "ALL", "price"));
    expect(yoy[0]).toEqual({ month: "2019-01", value: 100 });
    expect(yoy.find((point) => point.month === "2020-01")?.value).toBeCloseTo(10);
  });

  it("averages class yields for the all-class series", () => {
    expect(yieldSeries(YIELDS, "ALL")).toEqual([{ month: "2020-01", value: 3 }]);
    expect(yieldSeries(YIELDS, "B")).toEqual([{ month: "2020-01", value: 4 }]);
  });

  it("applies the H-plan and P-plan proxies, skipping nulls", () => {
    expect(effectiveRateSeries(RATES, "hibor")).toEqual([{ month: "2020-01", value: 2.3 }]);
    expect(effectiveRateSeries(RATES, "blr")).toEqual([{ month: "2020-01", value: 2.5 }]);
  });

  it("aligns yield and rate into a spread band", () => {
    const spread = spreadSeries([{ month: "2020-01", value: 4 }], [{ month: "2020-01", value: 3 }]);
    expect(spread[0]).toMatchObject({ yieldPct: 4, ratePct: 3, spread: 1, lower: 3, gap: 1 });
    expect(spread[0].spread).toBeCloseTo(1);
  });

  it("takes the cross-district median for buy vs rent", () => {
    const rows = [
      affordability(2001, "A", 10_000, 20_000),
      affordability(2001, "B", 14_000, 24_000),
      affordability(2002, "A", 11_000, 21_000),
      affordability(2002, "B", 15_000, 25_000),
    ];
    const series = buyVsRentSeries(rows);
    expect(series[0]).toEqual({ year: 2001, rent: 12_000, payment: 22_000 });
  });

  it("finds the latest crossover year", () => {
    const points = [
      { year: 2001, rent: 20_000, payment: 15_000 },
      { year: 2002, rent: 20_000, payment: 25_000 },
      { year: 2003, rent: 20_000, payment: 30_000 },
    ];
    expect(latestCrossover(points)).toEqual({ year: 2002, buyAboveRent: true });
    expect(latestCrossover([{ year: 2001, rent: 1, payment: 2 }])).toEqual({
      year: null,
      buyAboveRent: true,
    });
  });
});
