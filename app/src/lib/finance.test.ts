import { describe, expect, it } from "vitest";
import { loanFromPayment, monthlyPayment, stressTest } from "./finance";

describe("mortgage maths", () => {
  it("matches the standard amortisation formula", () => {
    const payment = monthlyPayment(5_000_000, 4.2, 30);
    expect(payment).toBeCloseTo(24450.86, 1);
  });

  it("handles zero interest", () => {
    expect(monthlyPayment(3_600_000, 0, 30)).toBeCloseTo(10_000, 2);
  });

  it("inverts payment to loan", () => {
    const payment = monthlyPayment(4_000_000, 3.5, 25);
    expect(loanFromPayment(payment, 3.5, 25)).toBeCloseTo(4_000_000, 0);
  });

  it("stress test adds 200 bp", () => {
    const result = stressTest(6_000_000, 30, 4.2, 30, 200);
    expect(result.loan).toBe(4_200_000);
    expect(result.stressed).toBeGreaterThan(result.base);
    expect(result.delta).toBeGreaterThan(0);
  });
});
