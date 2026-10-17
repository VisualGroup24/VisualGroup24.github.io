export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  const months = years * 12;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export function loanFromPayment(payment: number, annualRatePct: number, years: number): number {
  if (payment <= 0 || years <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  const months = years * 12;
  if (monthlyRate === 0) return payment * months;
  return (payment * (1 - Math.pow(1 + monthlyRate, -months))) / monthlyRate;
}

export function stressTest(price: number, downPaymentPct: number, ratePct: number, years: number, extraBp = 200) {
  const loan = price * (1 - downPaymentPct / 100);
  const base = monthlyPayment(loan, ratePct, years);
  const stressed = monthlyPayment(loan, ratePct + extraBp / 100, years);
  return { loan, base, stressed, delta: stressed - base };
}
