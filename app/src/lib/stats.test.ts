import { describe, expect, it } from "vitest";
import { crossCorrelation, linearRegression, median, pctChange, rebase } from "./stats";

describe("stats helpers", () => {
  it("computes median for odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("fits a perfect line", () => {
    const fit = linearRegression([
      [0, 1],
      [1, 3],
      [2, 5],
    ]);
    expect(fit.slope).toBeCloseTo(2);
    expect(fit.intercept).toBeCloseTo(1);
    expect(fit.r2).toBeCloseTo(1);
  });

  it("rebases to 100", () => {
    const rebased = rebase(
      [
        { month: "2019-01", value: 200 },
        { month: "2020-01", value: 220 },
      ],
      "2019-01",
    );
    expect(rebased[0].value).toBe(100);
    expect(rebased[1].value).toBeCloseTo(110);
  });

  it("computes percentage change", () => {
    expect(pctChange(110, 100)).toBeCloseTo(10);
    expect(pctChange(1, 0)).toBeNull();
  });

  it("returns a correlation at zero lag for identical series", () => {
    const rows = Array.from({ length: 24 }, (_, index) => ({
      month: `${2019 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
      value: Math.sin(index / 3),
    }));
    const result = crossCorrelation(rows, rows, 2);
    const zero = result.find((row) => row.lag === 0);
    expect(zero?.correlation).toBeCloseTo(1, 5);
  });
});
