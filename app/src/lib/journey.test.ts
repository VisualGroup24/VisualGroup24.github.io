import { describe, expect, it } from "vitest";
import {
  budgetStatus,
  countWithinBudget,
  maxAffordablePrice,
  maxRent,
  paymentForPrice,
  priceAtSize,
  rentToIncome,
  requiredIncomeForPrice,
  rtiAxisBounds,
  rtiBand,
  stressedPriceCeiling,
  withinBudget,
  type BudgetInput,
} from "./journey";

const BASE: BudgetInput = {
  monthlyIncome: 60_000,
  depositPct: 30,
  mortgageRate: 4.2,
  loanYears: 30,
  dsrCap: 50,
};

describe("journey budget maths", () => {
  it("makes the ceiling sit exactly on the DSR cap", () => {
    const ceiling = maxAffordablePrice(BASE);
    expect(ceiling).toBeGreaterThan(7_000_000);
    expect(paymentForPrice(ceiling, BASE)).toBeCloseTo(30_000, 0);
  });

  it("derives required income from the payment and cap", () => {
    const price = 6_000_000;
    const required = requiredIncomeForPrice(price, BASE);
    expect(required).toBeCloseTo(paymentForPrice(price, BASE) / 0.5, 2);
  });

  it("lowers the ceiling when rates are stressed", () => {
    expect(stressedPriceCeiling(BASE)).toBeLessThan(maxAffordablePrice(BASE));
  });

  it("caps rent at the rent-to-income ratio", () => {
    expect(maxRent(45_000, 40)).toBe(18_000);
    expect(maxRent(0, 40)).toBe(0);
  });

  it("computes the rent-to-income ratio from rent and income", () => {
    expect(rentToIncome(22_000, 45_000)).toBeCloseTo(0.4889, 4);
    expect(rentToIncome(0, 45_000)).toBe(0);
    expect(rentToIncome(22_000, 0)).toBeNull();
    expect(rentToIncome(null, 45_000)).toBeNull();
  });

  it("holds the RTI axis at 0–1 until the ratio exceeds 1", () => {
    expect(rtiAxisBounds([0.18, 0.49, 0.92])).toEqual({ min: 0, max: 1 });
    expect(rtiAxisBounds([1])).toEqual({ min: 0, max: 1 });
    expect(rtiAxisBounds([0.4, 1.32])).toEqual({ min: 0, max: 1.4 });
    expect(rtiAxisBounds([])).toEqual({ min: 0, max: 1 });
  });

  it("bands RTI against the cap and 100% of income", () => {
    expect(rtiBand(0.35, 40)).toBe("ok");
    expect(rtiBand(0.4, 40)).toBe("warn");
    expect(rtiBand(0.85, 40)).toBe("warn");
    expect(rtiBand(1, 40)).toBe("warn");
    expect(rtiBand(1.01, 40)).toBe("over");
  });

  it("classifies prices against the ceiling", () => {
    expect(budgetStatus(850_000, 1_000_000)).toBe("inside");
    expect(budgetStatus(950_000, 1_000_000)).toBe("edge");
    expect(budgetStatus(1_100_000, 1_000_000)).toBe("outside");
    expect(budgetStatus(null, 1_000_000)).toBe("outside");
  });

  it("counts reachable prices and prices a flat at size", () => {
    expect(countWithinBudget([500_000, 900_000, null, 1_500_000], 1_000_000)).toBe(2);
    expect(withinBudget(1_000_000, 1_000_000)).toBe(true);
    expect(withinBudget(null, 1_000_000)).toBe(false);
    expect(priceAtSize(15_000, 500)).toBe(7_500_000);
    expect(priceAtSize(null, 500)).toBeNull();
  });
});
