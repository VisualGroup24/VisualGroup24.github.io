import { loanFromPayment, monthlyPayment } from "./finance";

export type BudgetInput = {
  monthlyIncome: number;
  depositPct: number;
  mortgageRate: number;
  loanYears: number;
  dsrCap: number;
};

/** A deposit can cover at most 95% of the price; the rest is the loan. */
export function loanFraction(depositPct: number): number {
  return Math.min(1, Math.max(0.05, 1 - depositPct / 100));
}

export function dsrBudget(monthlyIncome: number, dsrCap: number): number {
  return Math.max(0, monthlyIncome) * (Math.max(0, dsrCap) / 100);
}

/** Loan supportable by the DSR-priced monthly payment at the given rate/term. */
export function maxLoan(input: BudgetInput): number {
  return loanFromPayment(dsrBudget(input.monthlyIncome, input.dsrCap), input.mortgageRate, input.loanYears);
}

/** Hard price ceiling: the largest price whose mortgage fits the DSR cap. */
export function maxAffordablePrice(input: BudgetInput): number {
  return maxLoan(input) / loanFraction(input.depositPct);
}

export function downPayment(price: number, depositPct: number): number {
  return price * (Math.max(0, Math.min(100, depositPct)) / 100);
}

export function paymentForPrice(price: number, input: BudgetInput): number {
  if (price <= 0) return 0;
  return monthlyPayment(price * loanFraction(input.depositPct), input.mortgageRate, input.loanYears);
}

export function dsrForPrice(price: number, input: BudgetInput): number | null {
  if (input.monthlyIncome <= 0) return null;
  return (paymentForPrice(price, input) / input.monthlyIncome) * 100;
}

/** Income that would make this price sit exactly on the DSR cap. */
export function requiredIncomeForPrice(price: number, input: BudgetInput): number {
  const cap = Math.max(1, input.dsrCap) / 100;
  return paymentForPrice(price, input) / cap;
}

export function stressedPriceCeiling(input: BudgetInput, extraBp = 200): number {
  return maxAffordablePrice({ ...input, mortgageRate: input.mortgageRate + extraBp / 100 });
}

export function stressedPayment(price: number, input: BudgetInput, extraBp = 200): number {
  return paymentForPrice(price, { ...input, mortgageRate: input.mortgageRate + extraBp / 100 });
}

export function maxRent(monthlyIncome: number, rtiCap: number): number {
  return Math.max(0, monthlyIncome) * (Math.max(0, rtiCap) / 100);
}

/**
 * Rent-to-income ratio: the monthly rent of the brief's flat as a fraction of
 * monthly household income. 1 means rent would consume the whole income.
 */
export function rentToIncome(
  monthlyRent: number | null | undefined,
  monthlyIncome: number,
): number | null {
  if (monthlyRent === null || monthlyRent === undefined || !Number.isFinite(monthlyRent)) return null;
  if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) return null;
  return monthlyRent / monthlyIncome;
}

/**
 * Where a rent-to-income ratio sits for the user's cap: "ok" below the cap,
 * "warn" from the cap up to 100% of income, "over" above 100%.
 */
export function rtiBand(value: number, rtiCap: number): "ok" | "warn" | "over" {
  if (value > 1) return "over";
  return value < Math.max(0, rtiCap) / 100 ? "ok" : "warn";
}

/**
 * Right-axis bounds for the rent-to-income series. The axis runs 0–1 while every
 * value fits under 100% of income; above that it grows in 10% steps.
 */
export function rtiAxisBounds(values: Array<number | null>): { min: number; max: number } {
  const finite = values.filter(
    (value): value is number => value !== null && Number.isFinite(value) && value > 0,
  );
  const peak = finite.length ? Math.max(...finite) : 0;
  if (peak <= 1) return { min: 0, max: 1 };
  return { min: 0, max: Math.ceil((peak + 0.05) * 10) / 10 };
}

export function priceAtSize(psf: number | null | undefined, flatSize: number): number | null {
  if (psf === null || psf === undefined || !Number.isFinite(psf)) return null;
  return psf * flatSize;
}

export type BudgetStatus = "inside" | "edge" | "outside";

/** Inside the ceiling with 10% headroom, at the edge within 10%, else outside. */
export function budgetStatus(price: number | null, maxPrice: number): BudgetStatus {
  if (price === null || price <= 0 || maxPrice <= 0) return "outside";
  if (price <= maxPrice * 0.9) return "inside";
  if (price <= maxPrice) return "edge";
  return "outside";
}

export function withinBudget(price: number | null, maxPrice: number): boolean {
  return price !== null && price > 0 && maxPrice > 0 && price <= maxPrice;
}

export function countWithinBudget(prices: Array<number | null>, maxPrice: number): number {
  return prices.filter((price) => withinBudget(price, maxPrice)).length;
}

export function medianPrice(prices: Array<number | null>): number | null {
  const values = prices.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
