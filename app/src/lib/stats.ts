export function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function linearRegression(points: Array<[number, number]>): {
  slope: number;
  intercept: number;
  r2: number;
} {
  if (points.length < 2) return { slope: 0, intercept: 0, r2: 0 };
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const xMean = mean(xs);
  const yMean = mean(ys);
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < points.length; index += 1) {
    numerator += (xs[index] - xMean) * (ys[index] - yMean);
    denominator += (xs[index] - xMean) ** 2;
  }
  const slope = denominator ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;
  let ssRes = 0;
  let ssTot = 0;
  for (let index = 0; index < points.length; index += 1) {
    const predicted = intercept + slope * xs[index];
    ssRes += (ys[index] - predicted) ** 2;
    ssTot += (ys[index] - yMean) ** 2;
  }
  return { slope, intercept, r2: ssTot ? 1 - ssRes / ssTot : 0 };
}

export function monthToNumber(month: string): number {
  const [year, m] = month.split("-");
  return Number(year) + (Number(m) - 1) / 12;
}

export function monthToDate(month: string): Date {
  const [year, m] = month.split("-");
  return new Date(Number(year), Number(m) - 1, 1);
}

export function shiftMonth(month: string, months: number): string {
  const date = monthToDate(month);
  date.setMonth(date.getMonth() + months);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function rebase(series: Array<{ month: string; value: number }>, baseMonth: string): Array<{ month: string; value: number }> {
  const base = series.find((point) => point.month === baseMonth)?.value ?? series[0]?.value;
  if (!base) return series;
  return series.map((point) => ({ ...point, value: (point.value / base) * 100 }));
}

export function crossCorrelation(
  left: Array<{ month: string; value: number }>,
  right: Array<{ month: string; value: number }>,
  maxLag = 12,
): Array<{ lag: number; correlation: number }> {
  const leftMap = new Map(left.map((point) => [point.month, point.value]));
  const rightMap = new Map(right.map((point) => [point.month, point.value]));
  const months = left.map((point) => point.month);
  const output: Array<{ lag: number; correlation: number }> = [];

  for (let lag = -maxLag; lag <= maxLag; lag += 1) {
    const pairs: Array<[number, number]> = [];
    months.forEach((month) => {
      const rightMonth = shiftMonth(month, lag);
      const leftValue = leftMap.get(month);
      const rightValue = rightMap.get(rightMonth);
      if (leftValue !== undefined && rightValue !== undefined) {
        pairs.push([leftValue, rightValue]);
      }
    });
    if (pairs.length < 12) {
      output.push({ lag, correlation: 0 });
      continue;
    }
    const xs = pairs.map((pair) => pair[0]);
    const ys = pairs.map((pair) => pair[1]);
    const xMean = mean(xs);
    const yMean = mean(ys);
    let numerator = 0;
    let xDen = 0;
    let yDen = 0;
    pairs.forEach(([x, y]) => {
      numerator += (x - xMean) * (y - yMean);
      xDen += (x - xMean) ** 2;
      yDen += (y - yMean) ** 2;
    });
    output.push({
      lag,
      correlation: xDen && yDen ? numerator / Math.sqrt(xDen * yDen) : 0,
    });
  }
  return output;
}
