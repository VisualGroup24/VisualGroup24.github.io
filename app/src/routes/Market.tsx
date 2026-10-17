import { useMemo, useState } from "react";
import Chart from "../components/Chart";
import {
  ErrorCard,
  KpiCard,
  LoadingCard,
  SectionCard,
  SegmentedControl,
} from "../components/Cards";
import PageHeader from "../components/PageHeader";
import { useMarket } from "../data/useMarket";
import { usePca } from "../data/usePca";
import type { MarketData, MarketEvent } from "../data/types";
import { fmtMonth, fmtPct, fmtPctPlain } from "../lib/format";
import {
  crossCorrelation,
  linearRegression,
  mean,
  monthToNumber,
  pctChange,
  rebase,
  shiftMonth,
} from "../lib/stats";
import { useFilters } from "../state/filters";

const CLASSES = ["ALL", "A", "B", "C", "D", "E"] as const;
const COLORS = {
  price: "#0f766e",
  rent: "#b45309",
  muted: "#94a3b8",
  grid: "rgba(100,116,139,0.18)",
  ink: "#334155",
};

type Factor = "hibor" | "volume" | "income" | "completions";

function seriesFor(data: MarketData, cls: string) {
  return data.rvd
    .filter(
      (row) =>
        row.property_class === cls &&
        row.price_index !== null &&
        row.rent_index !== null,
    )
    .sort((a, b) => a.month.localeCompare(b.month));
}

function yoySeries(
  rows: Array<{ month: string; value: number }>,
): Array<{ month: string; value: number }> {
  const map = new Map(rows.map((row) => [row.month, row.value]));
  return rows
    .map((row) => {
      const previous = map.get(shiftMonth(row.month, -12));
      if (previous === undefined || !previous) return null;
      return { month: row.month, value: ((row.value - previous) / previous) * 100 };
    })
    .filter((row): row is { month: string; value: number } => row !== null);
}

function changes(rows: Array<{ month: string; value: number }>) {
  const output: Array<{ month: string; value: number }> = [];
  for (let index = 1; index < rows.length; index += 1) {
    if (shiftMonth(rows[index - 1].month, 1) !== rows[index].month) continue;
    output.push({
      month: rows[index].month,
      value: (Math.log(rows[index].value) - Math.log(rows[index - 1].value)) * 100,
    });
  }
  return output;
}

function eventMarkLines(events: MarketEvent[], months: string[]) {
  const available = new Set(months);
  return events
    .map((event) => ({ month: event.date.slice(0, 7), label: event.label }))
    .filter((event) => available.has(event.month))
    .map((event) => ({
      xAxis: event.month,
      name: event.label,
      lineStyle: { color: "rgba(71,85,105,0.45)", type: "dashed", width: 1 },
      label: { show: false },
    }));
}

function baseOptions(months: string[]) {
  return {
    animationDuration: 400,
    grid: { left: 54, right: 58, top: 36, bottom: 56 },
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 12 },
      axisPointer: { type: "cross" as const, label: { backgroundColor: "#334155" } },
    },
    legend: {
      top: 0,
      right: 0,
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 4,
      textStyle: { color: "#64748b", fontSize: 11 },
    },
    xAxis: {
      type: "category" as const,
      data: months,
      boundaryGap: false,
      axisLine: { lineStyle: { color: COLORS.grid } },
      axisTick: { show: false },
      axisLabel: {
        color: COLORS.muted,
        fontSize: 10,
        formatter: (value: string) => value.slice(0, 4),
      },
    },
    yAxis: {
      type: "value" as const,
      scale: true,
      splitLine: { lineStyle: { color: COLORS.grid } },
      axisLabel: { color: COLORS.muted, fontSize: 10 },
    },
  };
}

function FactorStats({
  factor,
  stats,
}: {
  factor: Factor;
  stats: { n: number; r2: number; slope: number; xLabel: string; period: string };
}) {
  const labels: Record<Factor, string> = {
    hibor: "1-month HIBOR",
    volume: "ASP transactions",
    income: "Household income",
    completions: "Completions",
  };
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      <div className="rounded-lg bg-black/[0.03] p-2 dark:bg-white/[0.04]">
        <p className="text-[var(--text-muted)]">Factor</p>
        <p className="mt-0.5 font-medium">{labels[factor]}</p>
      </div>
      <div className="rounded-lg bg-black/[0.03] p-2 dark:bg-white/[0.04]">
        <p className="text-[var(--text-muted)]">Observations</p>
        <p className="mt-0.5 font-medium tabular-nums">{stats.n}</p>
      </div>
      <div className="rounded-lg bg-black/[0.03] p-2 dark:bg-white/[0.04]">
        <p className="text-[var(--text-muted)]">R²</p>
        <p className="mt-0.5 font-medium tabular-nums">{stats.r2.toFixed(2)}</p>
      </div>
      <div className="rounded-lg bg-black/[0.03] p-2 dark:bg-white/[0.04]">
        <p className="text-[var(--text-muted)]">Period</p>
        <p className="mt-0.5 font-medium tabular-nums">{stats.period}</p>
      </div>
    </div>
  );
}

export default function Market() {
  const { data, error, loading } = useMarket();
  const { data: pca } = usePca();
  const propertyClass = useFilters((state) => state.propertyClass);
  const setPropertyClass = useFilters((state) => state.setPropertyClass);
  const [factor, setFactor] = useState<Factor>("hibor");

  const view = useMemo(() => {
    if (!data) return null;
    const cls = propertyClass === "ALL" ? "ALL" : propertyClass;
    const rows = seriesFor(data, cls);
    if (!rows.length) return null;

    const months = rows.map((row) => row.month);
    const baseMonth = months.includes("2019-01") ? "2019-01" : rows[0].month;
    const price = rebase(
      rows.map((row) => ({ month: row.month, value: row.price_index as number })),
      baseMonth,
    );
    const rent = rebase(
      rows.map((row) => ({ month: row.month, value: row.rent_index as number })),
      baseMonth,
    );

    const latest = rows[rows.length - 1];
    const previous = rows.find((row) => row.month === shiftMonth(latest.month, -12));
    const latestPrice = price[price.length - 1].value;
    const latestRent = rent[rent.length - 1].value;
    const yoyPrice = previous ? pctChange(latest.price_index as number, previous.price_index as number) : null;
    const yoyRent = previous ? pctChange(latest.rent_index as number, previous.rent_index as number) : null;

    const yieldRows = data.yields.filter((row) => row.property_class === cls && row.yield_pct !== null);
    let yieldLatest: number | null = null;
    if (cls === "ALL") {
      const byMonth = new Map<string, number[]>();
      data.yields.forEach((row) => {
        if (row.property_class === "ALL" || row.yield_pct === null) return;
        const values = byMonth.get(row.month) ?? [];
        values.push(row.yield_pct);
        byMonth.set(row.month, values);
      });
      const monthsWithYield = [...byMonth.keys()].sort();
      const lastMonth = monthsWithYield[monthsWithYield.length - 1];
      yieldLatest = lastMonth ? mean(byMonth.get(lastMonth) ?? []) : null;
    } else if (yieldRows.length) {
      yieldLatest = yieldRows[yieldRows.length - 1].yield_pct as number;
    }

    const priceChanges = changes(price);
    const rentChanges = changes(rent);
    const lag = crossCorrelation(priceChanges, rentChanges, 12);

    const scatter = priceChanges
      .map((point) => {
        const rentPoint = rentChanges.find((item) => item.month === point.month);
        return rentPoint
          ? { x: point.value, y: rentPoint.value, year: point.month.slice(0, 4) }
          : null;
      })
      .filter((point): point is { x: number; y: number; year: string } => point !== null);
    const scatterFit = linearRegression(scatter.map((point) => [point.x, point.y]));

    const smallMultiples = (["A", "B", "C", "D", "E"] as const).map((code) => {
      const classRows = seriesFor(data, code);
      return {
        code,
        price: yoySeries(classRows.map((row) => ({ month: row.month, value: row.price_index as number }))),
        rent: yoySeries(classRows.map((row) => ({ month: row.month, value: row.rent_index as number }))),
      };
    });

    return {
      cls,
      rows,
      months,
      price,
      rent,
      latest,
      latestPrice,
      latestRent,
      yoyPrice,
      yoyRent,
      yieldLatest,
      priceChanges,
      rentChanges,
      lag,
      scatter,
      scatterFit,
      smallMultiples,
    };
  }, [data, propertyClass]);

  const latestSales = useMemo(() => {
    if (!data) return null;
    return [...data.sales].filter((row) => row.total_count !== null).at(-1) ?? null;
  }, [data]);

  const driver = useMemo(() => {
    if (!data) return null;
    const priceAll = seriesFor(data, "ALL").map((row) => ({
      month: row.month,
      value: row.price_index as number,
    }));
    const priceByMonth = new Map(priceAll.map((row) => [row.month, row.value]));
    const priceByYear = new Map<number, number[]>();
    priceAll.forEach((row) => {
      const year = Number(row.month.slice(0, 4));
      const values = priceByYear.get(year) ?? [];
      values.push(row.value);
      priceByYear.set(year, values);
    });

    if (factor === "hibor" || factor === "volume") {
      const rows =
        factor === "hibor"
          ? data.rates
              .filter((row) => row.hibor_1m !== null)
              .map((row) => ({ key: row.month, value: row.hibor_1m as number }))
          : data.sales
              .filter((row) => row.total_count !== null)
              .map((row) => ({ key: row.month, value: row.total_count as number }));
      const points = rows
        .map((row) => {
          const price = priceByMonth.get(row.key);
          return price !== undefined ? [row.value, price] as [number, number] : null;
        })
        .filter((point): point is [number, number] => point !== null);
      const fit = linearRegression(points);
      return {
        points,
        fit,
        n: points.length,
        r2: fit.r2,
        xLabel: factor === "hibor" ? "1-month HIBOR (%)" : "ASP transactions per month",
        yLabel: "Price index (1999 = 100)",
        period: points.length ? "latest" : "—",
        unit: factor === "hibor" ? "%" : "count",
      };
    }

    const annual =
      factor === "income"
        ? data.income
            .filter((row) => (row.district_code === "HK" || row.district_name === "Total") && row.median_income !== null)
            .map((row) => ({ year: row.year, value: row.median_income as number }))
        : data.completions
            .filter((row) => row.property_class === "TOTAL" && row.completions !== null)
            .map((row) => ({ year: row.year, value: row.completions as number }));

    const points = annual
      .map((row) => {
        const prices = priceByYear.get(row.year);
        if (!prices || !prices.length) return null;
        return [row.value, mean(prices)] as [number, number];
      })
      .filter((point): point is [number, number] => point !== null);
    const fit = linearRegression(points);
    return {
      points,
      fit,
      n: points.length,
      r2: fit.r2,
      xLabel: factor === "income" ? "Median monthly household income (HK$)" : "Completions (units, annual)",
      yLabel: "Price index (annual average, 1999 = 100)",
      period: annual.length ? `${annual[0].year}–${annual[annual.length - 1].year}` : "—",
      unit: factor === "income" ? "HKD" : "units",
    };
  }, [data, factor]);

  const pcaView = useMemo(() => {
    if (!pca) return null;
    const components = pca.explained.map((_, index) => `PC${index + 1}`);
    const cumulative: number[] = [];
    pca.explained.reduce((sum, value) => {
      cumulative.push((sum + value) * 100);
      return sum + value;
    }, 0);

    const screeOption = {
      animationDuration: 300,
      grid: { left: 44, right: 44, top: 24, bottom: 30 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15,23,42,0.92)",
        borderWidth: 0,
        textStyle: { color: "#f8fafc", fontSize: 11 },
      },
      xAxis: {
        type: "category",
        data: components,
        axisLabel: { color: "#64748b", fontSize: 10 },
        axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: "Variance",
          nameTextStyle: { color: "#64748b", fontSize: 9 },
          splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
          axisLabel: { color: "#64748b", fontSize: 9, formatter: "{value}%" },
        },
        {
          type: "value",
          name: "Cumulative",
          max: 100,
          nameTextStyle: { color: "#64748b", fontSize: 9 },
          splitLine: { show: false },
          axisLabel: { color: "#64748b", fontSize: 9, formatter: "{value}%" },
        },
      ],
      series: [
        {
          type: "bar",
          data: pca.explained.map((value) => Number((value * 100).toFixed(1))),
          itemStyle: { color: "rgba(15,118,110,0.7)", borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 28,
        },
        {
          type: "line",
          yAxisIndex: 1,
          data: cumulative.map((value) => Number(value.toFixed(1))),
          showSymbol: true,
          symbolSize: 4,
          lineStyle: { color: "#b45309", width: 1.5 },
          itemStyle: { color: "#b45309" },
        },
      ],
    };

    const loadingData: Array<[number, number, number]> = [];
    pca.loadings.forEach((row, yIndex) => {
      [row.pc1, row.pc2, row.pc3].forEach((value, xIndex) => {
        loadingData.push([xIndex, yIndex, value]);
      });
    });
    const loadingOption = {
      animation: false,
      grid: { left: 108, right: 12, top: 20, bottom: 26 },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.92)",
        borderWidth: 0,
        textStyle: { color: "#f8fafc", fontSize: 11 },
        formatter: (params: { value: [number, number, number] }) => {
          const [x, y, value] = params.value;
          return `${pca.loadings[y].label} · ${components[x]}: ${value.toFixed(2)}`;
        },
      },
      xAxis: {
        type: "category",
        data: components.slice(0, 3),
        axisLabel: { color: "#64748b", fontSize: 10 },
        axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: pca.loadings.map((row) => row.label),
        axisLabel: { color: "#64748b", fontSize: 9 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      visualMap: {
        show: false,
        min: -1,
        max: 1,
        inRange: { color: ["#b91c1c", "#f8fafc", "#0f766e"] },
      },
      series: [
        {
          type: "heatmap",
          data: loadingData,
          label: { show: true, fontSize: 8, formatter: (params: { value: [number, number, number] }) => params.value[2].toFixed(1) },
          itemStyle: { borderColor: "rgba(255,255,255,0.4)", borderWidth: 0.5 },
        },
      ],
    };

    const maxScore = Math.max(...pca.scores.flatMap((row) => [Math.abs(row.pc1), Math.abs(row.pc2)]), 1);
    const maxLoading = Math.max(
      ...pca.loadings.flatMap((row) => [Math.abs(row.pc1), Math.abs(row.pc2)]),
      0.1,
    );
    const vectorScale = (maxScore * 0.65) / maxLoading;

    const biplotOption = {
      animationDuration: 300,
      grid: { left: 44, right: 32, top: 24, bottom: 36 },
      legend: {
        top: 0,
        right: 0,
        icon: "roundRect",
        itemWidth: 10,
        itemHeight: 4,
        textStyle: { color: "#64748b", fontSize: 10 },
        data: ["Sale", "Rent"],
      },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.92)",
        borderWidth: 0,
        textStyle: { color: "#f8fafc", fontSize: 11 },
        formatter: (params: { data: { district_code?: string; area?: number; price_psf?: number } }) =>
          `${params.data.district_code ?? ""}<br/>Area: ${params.data.area ?? "—"} ft²<br/>${params.data.price_psf ? `HK$${Math.round(params.data.price_psf).toLocaleString()}/ft²` : ""}`,
      },
      xAxis: {
        type: "value",
        name: `PC1 (${(pca.explained[0] * 100).toFixed(0)}%)`,
        nameLocation: "middle",
        nameGap: 24,
        nameTextStyle: { color: "#64748b", fontSize: 9 },
        splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
        axisLabel: { color: "#64748b", fontSize: 9 },
      },
      yAxis: {
        type: "value",
        name: `PC2 (${(pca.explained[1] * 100).toFixed(0)}%)`,
        nameLocation: "middle",
        nameGap: 32,
        nameTextStyle: { color: "#64748b", fontSize: 9 },
        splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
        axisLabel: { color: "#64748b", fontSize: 9 },
      },
      series: [
        {
          name: "Sale",
          type: "scatter",
          data: pca.scores
            .filter((row) => row.tenure === "sale")
            .map((row) => ({
              value: [row.pc1, row.pc2],
              district_code: row.district_code,
              area: row.area,
              price_psf: row.price_psf,
            })),
          symbolSize: 6,
          itemStyle: { color: "rgba(15,118,110,0.7)" },
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            lineStyle: { color: "rgba(100,116,139,0.3)", type: "dashed" },
            data: [{ xAxis: 0 }, { yAxis: 0 }],
          },
        },
        {
          name: "Rent",
          type: "scatter",
          data: pca.scores
            .filter((row) => row.tenure === "rent")
            .map((row) => ({
              value: [row.pc1, row.pc2],
              district_code: row.district_code,
              area: row.area,
              price_psf: row.price_psf,
            })),
          symbolSize: 6,
          itemStyle: { color: "rgba(180,83,9,0.65)" },
        },
        ...pca.loadings.map((row) => ({
          name: row.label,
          type: "line",
          data: [
            [0, 0],
            [row.pc1 * vectorScale, row.pc2 * vectorScale],
          ],
          symbol: ["none", "arrow"],
          symbolSize: 6,
          lineStyle: { width: 1, color: "rgba(51,65,85,0.7)" },
          itemStyle: { color: "#64748b" },
          label: {
            show: true,
            position: "end",
            formatter: row.label,
            fontSize: 8,
            color: "#64748b",
          },
          tooltip: { show: false },
        })),
      ],
    };

    return { screeOption, loadingOption, biplotOption };
  }, [pca]);

  if (loading) return <LoadingCard height={420} message="Loading RVD, HKMA and C&SD series…" />;
  if (error || !data || !view) return <ErrorCard message={error ?? "No market data found."} />;

  const heroOption = {
    ...baseOptions(view.months),
    xAxis: {
      ...baseOptions(view.months).xAxis,
      axisLabel: {
        color: COLORS.muted,
        fontSize: 10,
        interval: 60,
        formatter: (value: string) => value.slice(0, 4),
      },
    },
    yAxis: [
      {
        ...baseOptions(view.months).yAxis,
        splitLine: { lineStyle: { color: COLORS.grid } },
      },
      {
        ...baseOptions(view.months).yAxis,
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Price index",
        type: "line",
        data: view.price.map((point) => point.value),
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 2, color: COLORS.price },
        itemStyle: { color: COLORS.price },
        markLine: {
          silent: false,
          symbol: "none",
          animation: false,
          data: eventMarkLines(data.events, view.months),
        },
      },
      {
        name: "Rent index",
        type: "line",
        yAxisIndex: 1,
        data: view.rent.map((point) => point.value),
        showSymbol: false,
        lineStyle: { width: 2, color: COLORS.rent },
        itemStyle: { color: COLORS.rent },
      },
    ],
    dataZoom: [
      { type: "inside", start: 0, end: 100 },
      { type: "slider", height: 18, bottom: 8, borderColor: "transparent", fillerColor: "rgba(15,118,110,0.12)", handleStyle: { color: "#0f766e" } },
    ],
  };

  const scatterOption = {
    animationDuration: 300,
    grid: { left: 50, right: 20, top: 24, bottom: 46 },
    tooltip: {
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 12 },
      formatter: (params: { data: [number, number, string] }) =>
        `${params.data[2]}<br/>price Δ ${params.data[0].toFixed(2)}%<br/>rent Δ ${params.data[1].toFixed(2)}%`,
    },
    xAxis: {
      type: "value",
      name: "Monthly price change (%)",
      nameLocation: "middle",
      nameGap: 28,
      nameTextStyle: { color: COLORS.muted, fontSize: 10 },
      splitLine: { lineStyle: { color: COLORS.grid } },
      axisLabel: { color: COLORS.muted, fontSize: 10 },
    },
    yAxis: {
      type: "value",
      name: "Monthly rent change (%)",
      nameLocation: "middle",
      nameGap: 34,
      nameTextStyle: { color: COLORS.muted, fontSize: 10 },
      splitLine: { lineStyle: { color: COLORS.grid } },
      axisLabel: { color: COLORS.muted, fontSize: 10 },
    },
    visualMap: {
      show: false,
      seriesIndex: 0,
      min: 1993,
      max: 2026,
      dimension: 2,
      inRange: { color: ["#99f6e4", "#0f766e", "#134e4a"] },
    },
    series: [
      {
        type: "scatter",
        data: view.scatter.map((point) => [point.x, point.y, Number(point.year)]),
        symbolSize: 7,
        itemStyle: { opacity: 0.65 },
      },
      {
        type: "line",
        data: (() => {
          const xs = view.scatter.map((point) => point.x);
          const min = Math.min(...xs);
          const max = Math.max(...xs);
          return [
            [min, view.scatterFit.intercept + view.scatterFit.slope * min],
            [max, view.scatterFit.intercept + view.scatterFit.slope * max],
          ];
        })(),
        showSymbol: false,
        lineStyle: { color: "#b45309", width: 2 },
        itemStyle: { color: "#b45309" },
        tooltip: { show: false },
      },
    ],
  };

  const lagOption = {
    animationDuration: 300,
    grid: { left: 44, right: 16, top: 20, bottom: 36 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 12 },
    },
    xAxis: {
      type: "category",
      data: view.lag.map((point) => String(point.lag)),
      name: "Lag (months)",
      nameLocation: "middle",
      nameGap: 24,
      nameTextStyle: { color: COLORS.muted, fontSize: 10 },
      axisLabel: { color: COLORS.muted, fontSize: 10 },
      axisLine: { lineStyle: { color: COLORS.grid } },
    },
    yAxis: {
      type: "value",
      min: -1,
      max: 1,
      splitLine: { lineStyle: { color: COLORS.grid } },
      axisLabel: { color: COLORS.muted, fontSize: 10 },
    },
    series: [
      {
        type: "bar",
        data: view.lag.map((point) => ({
          value: point.correlation,
          itemStyle: {
            color:
              point.correlation === Math.max(...view.lag.map((item) => item.correlation))
                ? "#b45309"
                : "rgba(15,118,110,0.55)",
            borderRadius: [2, 2, 0, 0],
          },
        })),
        barMaxWidth: 12,
      },
    ],
  };

  const driverOption = driver
    ? {
        animationDuration: 300,
        grid: { left: 56, right: 24, top: 24, bottom: 52 },
        tooltip: {
          backgroundColor: "rgba(15,23,42,0.92)",
          borderWidth: 0,
          textStyle: { color: "#f8fafc", fontSize: 12 },
          formatter: (params: { data: [number, number] }) =>
            `${driver.xLabel}: ${driver.unit === "%" ? params.data[0].toFixed(2) : params.data[0].toLocaleString()}<br/>${driver.yLabel}: ${params.data[1].toFixed(1)}`,
        },
        xAxis: {
          type: "value",
          name: driver.xLabel,
          nameLocation: "middle",
          nameGap: 32,
          nameTextStyle: { color: COLORS.muted, fontSize: 10 },
          splitLine: { lineStyle: { color: COLORS.grid } },
          axisLabel: {
            color: COLORS.muted,
            fontSize: 10,
            formatter: (value: number) => (driver.unit === "%" ? value.toFixed(1) : value.toLocaleString()),
          },
        },
        yAxis: {
          type: "value",
          name: driver.yLabel,
          nameLocation: "middle",
          nameGap: 40,
          nameTextStyle: { color: COLORS.muted, fontSize: 10 },
          splitLine: { lineStyle: { color: COLORS.grid } },
          axisLabel: { color: COLORS.muted, fontSize: 10 },
        },
        series: [
          {
            type: "scatter",
            data: driver.points,
            symbolSize: 7,
            itemStyle: { color: "rgba(15,118,110,0.6)" },
          },
          {
            type: "line",
            data: (() => {
              const xs = driver.points.map((point) => point[0]);
              const min = Math.min(...xs);
              const max = Math.max(...xs);
              return [
                [min, driver.fit.intercept + driver.fit.slope * min],
                [max, driver.fit.intercept + driver.fit.slope * max],
              ];
            })(),
            showSymbol: false,
            lineStyle: { color: "#b45309", width: 2 },
            itemStyle: { color: "#b45309" },
            tooltip: { show: false },
          },
        ],
      }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Prices"
        title="Market Trends"
        question="How have sale prices and rents moved, and what macro forces coincide with the turns?"
      >
        <SegmentedControl
          label="Class"
          value={propertyClass}
          options={CLASSES.map((value) => ({ value, label: value === "ALL" ? "All" : value }))}
          onChange={setPropertyClass}
        />
        <span className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--text-muted)]">
          {fmtMonth(view.latest.month)} · 2019 = 100
        </span>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard label="Price index" value={view.latestPrice.toFixed(1)} delta={fmtPct(view.yoyPrice)} note="YoY" />
        <KpiCard label="Rent index" value={view.latestRent.toFixed(1)} delta={fmtPct(view.yoyRent)} note="YoY" />
        <KpiCard
          label="Price / rent"
          value={(view.latestPrice / view.latestRent).toFixed(2)}
          note="index ratio"
          accent="amber"
        />
        <KpiCard label="Gross yield" value={fmtPctPlain(view.yieldLatest)} note="RVD, class" accent="blue" />
        <KpiCard
          label="Monthly ASPs"
          value={latestSales?.total_count ? latestSales.total_count.toLocaleString() : "—"}
          note={latestSales ? `RVD · ${fmtMonth(latestSales.month)}` : "residential"}
          accent="neutral"
        />
        <KpiCard
          label="HIBOR 1M"
          value={
            data.rates.length
              ? `${(data.rates[data.rates.length - 1].hibor_1m ?? 0).toFixed(2)}%`
              : "—"
          }
          note="monthly average"
          accent="neutral"
        />
      </div>

      <SectionCard
        title="Price and rental indices"
        description={`RVD private domestic indices for class ${view.cls === "ALL" ? "all classes" : view.cls}, rebased to 2019 = 100. Dashed verticals mark policy and market events.`}
        action={
          <span className="text-[11px] text-[var(--text-muted)]">
            {view.months[0]} – {view.months[view.months.length - 1]}
          </span>
        }
      >
        <Chart option={heroOption} height={420} />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
          {data.events.map((event) => (
            <span key={`${event.date}-${event.label}`}>
              <span className="mr-1 inline-block h-2 w-[2px] bg-slate-400 align-middle" />
              {event.date.slice(0, 4)} · {event.label}
            </span>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Rent–price co-movement"
          description="Monthly log changes of the price and rental indices. Points are coloured by year; the line is an OLS fit."
        >
          <Chart option={scatterOption} height={320} />
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--text-muted)]">
            <span>R² = {view.scatterFit.r2.toFixed(2)}</span>
            <span>slope = {view.scatterFit.slope.toFixed(2)}</span>
            <span>n = {view.scatter.length}</span>
          </div>
        </SectionCard>

        <SectionCard
          title="Lead or lag?"
          description="Correlation between price change at t and rent change at t + lag. Positive lags mean rents follow prices."
        >
          <Chart option={lagOption} height={320} />
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Strongest correlation at lag{" "}
            <strong className="text-[var(--text)]">
              {view.lag.reduce((best, point) => (Math.abs(point.correlation) > Math.abs(best.correlation) ? point : best)).lag}
            </strong>{" "}
            months.
          </p>
        </SectionCard>
      </div>

      <SectionCard
        title="Year-on-year change by class"
        description="Price and rent growth for classes A–E. Small multiples make class-specific cycles comparable."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {view.smallMultiples.map((panel) => {
            const months = panel.price.map((point) => point.month);
            const priceMap = new Map(panel.price.map((point) => [point.month, point.value]));
            const rentMap = new Map(panel.rent.map((point) => [point.month, point.value]));
            const option = {
              animationDuration: 300,
              grid: { left: 40, right: 12, top: 22, bottom: 28 },
              tooltip: {
                trigger: "axis",
                backgroundColor: "rgba(15,23,42,0.92)",
                borderWidth: 0,
                textStyle: { color: "#f8fafc", fontSize: 11 },
                valueFormatter: (value: number) => `${value.toFixed(1)}%`,
              },
              title: {
                text: `Class ${panel.code}`,
                left: 0,
                top: 0,
                textStyle: { fontSize: 11, fontWeight: 600, color: "#64748b" },
              },
              xAxis: {
                type: "category",
                data: months,
                boundaryGap: false,
                axisLabel: { color: COLORS.muted, fontSize: 9, formatter: (value: string) => value.slice(0, 4) },
                axisLine: { lineStyle: { color: COLORS.grid } },
                axisTick: { show: false },
              },
              yAxis: {
                type: "value",
                splitLine: { lineStyle: { color: COLORS.grid } },
                axisLabel: { color: COLORS.muted, fontSize: 9, formatter: "{value}%" },
              },
              series: [
                {
                  type: "line",
                  name: "Price YoY",
                  data: months.map((month) => priceMap.get(month) ?? null),
                  showSymbol: false,
                  lineStyle: { width: 1.5, color: COLORS.price },
                  itemStyle: { color: COLORS.price },
                },
                {
                  type: "line",
                  name: "Rent YoY",
                  data: months.map((month) => rentMap.get(month) ?? null),
                  showSymbol: false,
                  lineStyle: { width: 1.5, color: COLORS.rent },
                  itemStyle: { color: COLORS.rent },
                },
              ],
            };
            return <Chart key={panel.code} option={option} height={170} />;
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="What moves with prices?"
        description="Bivariate association between the class-ALL price index and one macro factor at a time. Association, not causation."
        action={
          <SegmentedControl
            value={factor}
            options={[
              { value: "hibor", label: "Rate" },
              { value: "volume", label: "Volume" },
              { value: "income", label: "Income" },
              { value: "completions", label: "Completions" },
            ]}
            onChange={setFactor}
          />
        }
      >
        {driverOption && driver ? (
          <>
            <Chart option={driverOption} height={340} />
            <FactorStats
              factor={factor}
              stats={{ n: driver.n, r2: driver.r2, slope: driver.fit.slope, xLabel: driver.xLabel, period: driver.period }}
            />
          </>
        ) : (
          <div className="grid h-60 place-items-center text-sm text-[var(--text-muted)]">No overlapping data.</div>
        )}
      </SectionCard>

      <SectionCard
        title="Composition: what differentiates listings?"
        description={
          pca
            ? `PCA of ${pca.n} current listings on area, bedrooms, bathrooms, floor, age, MTR walk time and tenure. Price per ft² is shown as a supplementary colour, not a PCA input.`
            : "PCA of listing attributes (area, bedrooms, floor, age, MTR walk time). Available once the listing crawl has run."
        }
      >
        {pcaView && pca ? (
          <>
            <div className="grid gap-4 xl:grid-cols-3">
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Scree
                </h3>
                <Chart option={pcaView.screeOption} height={260} />
              </div>
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Loadings
                </h3>
                <Chart option={pcaView.loadingOption} height={260} />
              </div>
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Biplot
                </h3>
                <Chart option={pcaView.biplotOption} height={260} />
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
              PC1 and PC2 together explain{" "}
              {((pca.explained[0] + pca.explained[1]) * 100).toFixed(0)}% of the variation. Arrows
              point in the direction of each attribute; attributes pointing the same way are
              largely redundant. This is a description of the current sample, not a causal model.
            </p>
          </>
        ) : (
          <div className="grid h-36 place-items-center rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)]">
            PCA — awaiting crawl
          </div>
        )}
      </SectionCard>
    </div>
  );
}
