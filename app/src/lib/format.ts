export const HKD = new Intl.NumberFormat("en-HK", {
  style: "currency",
  currency: "HKD",
  maximumFractionDigits: 0,
});

export const NUM = new Intl.NumberFormat("en-HK", { maximumFractionDigits: 0 });
export const NUM1 = new Intl.NumberFormat("en-HK", { maximumFractionDigits: 1 });
export const NUM2 = new Intl.NumberFormat("en-HK", { maximumFractionDigits: 2 });

export function fmtMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return HKD.format(value);
}

export function fmtCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${NUM2.format(value / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${NUM2.format(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${NUM1.format(value / 1_000)}k`;
  return NUM.format(value);
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function fmtPctPlain(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function fmtPsf(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `HK$${NUM.format(value)}/ft²`;
}

export function fmtRatio(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}×`;
}

export function fmtMonth(month: string | null | undefined): string {
  if (!month) return "—";
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function fmtYear(year: number | null | undefined): string {
  return year ? String(year) : "—";
}
