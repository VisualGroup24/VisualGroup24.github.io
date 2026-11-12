import { useMemo, useState } from "react";
import Chart from "../components/Chart";
import DistrictMap from "../components/DistrictMap";
import EstateBoxPlot from "../components/EstateBoxPlot";
import Panel, { Bento, BentoRow } from "../components/Panel";
import Segmented from "../components/Segmented";
import StageHeader from "../components/StageHeader";
import { KpiStrip, type StatItem } from "../components/Stat";
import { useDistrictData } from "../data/useDistrictData";
import { useDistricts } from "../data/useMarket";
import { useEstateQuartiles } from "../data/useEstateQuartiles";
import {
  axisLabelStyle,
  baseOption,
  gridOf,
  quarterTick,
  shortQuarter,
  useChartTheme,
} from "../lib/chartOptions";
import { fmtCompact, fmtMoney, fmtPctPlain, fmtPsf } from "../lib/format";
import { maxAffordablePrice, maxRent, rentToIncome, rtiAxisBounds, rtiBand, type BudgetInput, type BudgetStatus } from "../lib/journey";
import { median } from "../lib/stats";
import {
  METRIC_LABELS,
  districtBudgetRows,
  districtLookup,
  districtSeries,
  formatMetric,
  formatMetricAxis,
  hkMedianSeries,
  latestQuarter,
  metricValues,
  quarterNumber,
  rankValues,
  regionColor,
  rowsAtQuarter,
  transactionTotal,
  type DistrictMetric,
} from "../lib/districtMetrics";
import { useJourney } from "../state/journey";

type RowPoint = {
  code: string;
  name: string;
  region: string;
  sale_psf: number;
  rent_psf: number;
  yield_pct: number | null;
  volume: number;
};

function statusColor(status: BudgetStatus, theme: { teal: string; amber: string; dark: boolean }): string {
  if (status === "inside") return theme.teal;
  if (status === "edge") return theme.amber;
  return theme.dark ? "#475569" : "#cbd5e1";
}

export default function Explore() {
  const districtData = useDistrictData();
  const geo = useDistricts();
  const quartiles = useEstateQuartiles();
  const brief = useJourney();
  const theme = useChartTheme();
  const [metricChoice, setMetricChoice] = useState<DistrictMetric | null>(null);
  const [quarterChoice, setQuarterChoice] = useState<string | null>(null);
  const [onlyBudget, setOnlyBudget] = useState(false);
  const [trendView, setTrendView] = useState<"trend" | "scatter">("trend");

  const isRent = brief.tenure === "rent";
  const metrics: Array<{ value: DistrictMetric; label: string }> = isRent
    ? [
        { value: "rent_psf", label: "Rent" },
        { value: "rent_yoy", label: "Rent YoY" },
        { value: "yield_pct", label: "Yield" },
      ]
    : [
        { value: "sale_psf", label: "Sale" },
        { value: "price_yoy", label: "Price YoY" },
        { value: "yield_pct", label: "Yield" },
      ];
  const metric: DistrictMetric =
    metricChoice && metrics.some((item) => item.value === metricChoice)
      ? metricChoice
      : isRent
        ? "rent_psf"
        : "sale_psf";

  const budget: BudgetInput = {
    monthlyIncome: brief.monthlyIncome,
    depositPct: brief.depositPct,
    mortgageRate: brief.mortgageRate,
    loanYears: brief.loanYears,
    dsrCap: brief.dsrCap,
  };
  const ceiling = isRent ? maxRent(brief.monthlyIncome, brief.rtiCap) : maxAffordablePrice(budget);
  const stressedCeiling = maxAffordablePrice({ ...budget, mortgageRate: brief.mortgageRate + 2 });
  const rentPsfCap = maxRent(brief.monthlyIncome, brief.rtiCap) / brief.flatSize;

  const quarters = useMemo(() => {
    if (!districtData.data) return [];
    return [...new Set(districtData.data.panel.map((row) => row.quarter))]
      .filter((quarter) => quarter >= "2018-Q1")
      .sort((a, b) => quarterNumber(a) - quarterNumber(b));
  }, [districtData.data]);

  const quarter =
    quarterChoice && quarters.includes(quarterChoice)
      ? quarterChoice
      : quarters[quarters.length - 1] ?? "2026-Q4";

  // The five most-traded estates in the chosen district (or Hong Kong-wide when
  // no district is selected), ranked by latest-quarter transaction volume.
  const topEstates = useMemo(() => {
    if (!districtData.data) return [];
    const pool = brief.selectedDistrict
      ? districtData.data.estates.filter(
          (estate) => estate.district_code === brief.selectedDistrict,
        )
      : districtData.data.estates;
    return [...pool]
      .filter((estate) => estate.volume > 0)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);
  }, [districtData.data, brief.selectedDistrict]);

  const boxedEstates = useMemo(
    () => (quartiles.data ? topEstates.filter((estate) => quartiles.data?.[estate.estate_id]) : []),
    [topEstates, quartiles.data],
  );

  const model = useMemo(() => {
    if (!districtData.data) return null;
    const data = districtData.data;
    const lookup = districtLookup(data.districts);
    const values = metricValues(data.panel, quarter, metric);
    const quarterRows = rowsAtQuarter(data.panel, quarter);
    const rowByCode = new Map(quarterRows.map((row) => [row.district_code, row]));
    const budgetRows = districtBudgetRows(quarterRows, lookup, {
      tenure: isRent ? "rent" : "sale",
      flatSize: brief.flatSize,
      ceiling,
      rtiCap: brief.rtiCap,
      budget,
    });
    const withinCodes = new Set(
      budgetRows.filter((row) => row.status !== "outside").map((row) => row.code),
    );
    const countWithin = withinCodes.size;

    const visible: Record<string, number | null> = {};
    Object.entries(values).forEach(([code, value]) => {
      visible[code] = value !== null && (!onlyBudget || withinCodes.has(code)) ? value : null;
    });

    const numericValues = Object.values(values).filter(
      (value): value is number => value !== null && Number.isFinite(value),
    );
    const hkMedian = numericValues.length ? median(numericValues) : null;
    const ranks = rankValues(values, "desc");

    const ranked = Object.entries(visible)
      .filter((entry): entry is [string, number] => entry[1] !== null && Number.isFinite(entry[1]))
      .sort((a, b) => a[1] - b[1])
      .map(([code, value]) => ({
        code,
        name: lookup[code]?.name_en ?? code,
        region: lookup[code]?.region ?? "New Territories",
        value,
      }));

    const points: RowPoint[] = quarterRows
      .filter((row) => row.sale_psf !== null && row.rent_psf !== null)
      .map((row) => ({
        code: row.district_code,
        name: lookup[row.district_code]?.name_en ?? row.district_code,
        region: row.region,
        sale_psf: row.sale_psf ?? 0,
        rent_psf: row.rent_psf ?? 0,
        yield_pct: row.yield_pct,
        volume: row.volume,
      }));

    const selected = brief.selectedDistrict;
    const compare = brief.compareDistrict;
    const selectedSeries = selected ? districtSeries(data.panel, selected, metric) : [];
    const compareSeries = compare ? districtSeries(data.panel, compare, metric) : [];
    const hkSeries = hkMedianSeries(data.panel, metric);
    const selectedYieldSeries = selected ? districtSeries(data.panel, selected, "yield_pct") : [];
    const hkYieldSeries = hkMedianSeries(data.panel, "yield_pct");

    const selectedRow = selected ? rowByCode.get(selected) ?? null : null;
    const selectedValue = selected ? values[selected] ?? null : null;
    const compareValue = compare ? values[compare] ?? null : null;
    const listing = selected ? data.listing_counts?.[selected] ?? { total: 0, sale: 0, rent: 0 } : null;
    const transactions = selectedRow ? selectedRow.volume : transactionTotal(quarterRows);

    return {
      lookup,
      values,
      visible,
      hkMedian,
      ranks,
      ranked,
      points,
      selected,
      compare,
      selectedSeries,
      compareSeries,
      hkSeries,
      selectedYieldSeries,
      hkYieldSeries,
      budgetRows,
      countWithin,
      selectedValue,
      compareValue,
      selectedRow,
      listing,
      transactions,
      filteredOut: Object.values(visible).filter((value) => value === null).length,
      latest: latestQuarter(data.panel),
    };
  }, [
    districtData.data,
    quarter,
    metric,
    onlyBudget,
    brief.selectedDistrict,
    brief.compareDistrict,
    brief.flatSize,
    brief.rtiCap,
    isRent,
    ceiling,
    budget,
  ]);

  const options = useMemo(() => {
    if (!model) return null;
    const base = baseOption(theme);
    const ranked = model.ranked;

    const rankingOption: Record<string, unknown> = {
      ...base,
      grid: gridOf({ top: 4, bottom: 0, left: 2, right: 40 }),
      legend: { ...(base.legend as object), show: false },
      tooltip: {
        ...(base.tooltip as object),
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const row = ranked[params[0]?.dataIndex ?? 0];
          if (!row) return "";
          const budgetRow = model.budgetRows.find((item) => item.code === row.code);
          return `<strong>${row.name}</strong><br/>${METRIC_LABELS[metric]}: ${formatMetric(metric, row.value)}${
            budgetRow
              ? `<br/>${isRent ? "Rent" : "Price"} ${fmtMoney(budgetRow.monthly)}${isRent ? "/mo" : ""}<br/>Requires ${fmtMoney(budgetRow.requiredIncome)}/mo`
              : ""
          }`;
        },
      },
      xAxis: {
        type: "value",
        axisLabel: axisLabelStyle(theme, {
          formatter: (value: number) => formatMetricAxis(metric, value),
          fontSize: 7.5,
        }),
      },
      yAxis: {
        type: "category",
        data: ranked.map((row) => (row.name.length > 15 ? `${row.name.slice(0, 14)}…` : row.name)),
        axisLabel: { color: theme.axisLabel, fontSize: 7.5, interval: 0 },
      },
      series: [
        {
          name: METRIC_LABELS[metric],
          type: "bar",
          data: ranked.map((row) => ({
            value: Number(row.value.toFixed(2)),
            code: row.code,
            itemStyle: {
              color: regionColor(row.region, {
                island: theme.island,
                kowloon: theme.kowloon,
                nt: theme.nt,
              }),
              opacity:
                model.selected && model.selected !== row.code
                  ? 0.55
                  : model.compare === row.code
                    ? 0.8
                    : 1,
              borderColor:
                model.selected === row.code
                  ? theme.text
                  : model.compare === row.code
                    ? theme.amber
                    : "transparent",
              borderWidth: model.selected === row.code || model.compare === row.code ? 1.5 : 0,
              borderRadius: metric === "price_yoy" || metric === "rent_yoy" ? 0 : [0, 2, 2, 0],
            },
          })),
          barMaxWidth: 8,
          markLine:
            metric === "price_yoy" || metric === "rent_yoy"
              ? {
                  silent: true,
                  symbol: ["none", "none"],
                  label: { show: false },
                  lineStyle: { color: theme.muted, width: 1, type: "dashed" },
                  data: [{ xAxis: 0 }],
                }
              : undefined,
        },
      ],
    };

    const scatterOption: Record<string, unknown> = {
      ...base,
      grid: gridOf({ top: 16, bottom: 0, left: 2, right: 12 }),
      legend: { ...(base.legend as object), show: false },
      tooltip: {
        ...(base.tooltip as object),
        formatter: (params: { value: number[] }) => {
          const [salePsf, rentPsf, volume, code, name, yieldPct] = params.value;
          return `<strong>${name}</strong> (${code})<br/>Sale ${fmtPsf(salePsf)} · rent ${fmtPsf(rentPsf)}<br/>Yield ${yieldPct === null || yieldPct === undefined ? "—" : `${Number(yieldPct).toFixed(2)}%`}<br/>${Number(volume).toLocaleString("en-HK")} transactions`;
        },
      },
      xAxis: {
        type: "value",
        scale: true,
        axisLabel: axisLabelStyle(theme, {
          formatter: (value: number) => `HK$${fmtCompact(value)}`,
        }),
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: axisLabelStyle(theme, {
          formatter: (value: number) => `HK$${Math.round(value)}`,
        }),
      },
      series: [
        {
          name: "Districts",
          type: "scatter",
          data: model.points.map((point) => [
            point.sale_psf,
            point.rent_psf,
            point.volume,
            point.code,
            point.name,
            point.yield_pct,
          ]),
          symbolSize: (value: number[]) => Math.max(6, Math.min(26, 6 + Math.log10(1 + value[2]) * 7)),
          itemStyle: {
            color: theme.dark ? "#2dd4bf" : "#0f766e",
            opacity: 0.7,
            borderColor: theme.dark ? "#0b1220" : "#ffffff",
            borderWidth: 1,
          },
          label: {
            show: true,
            position: "right",
            fontSize: 7,
            color: theme.axisLabel,
            formatter: (params: { value: Array<string | number> }) => {
              const [salePsf, , , code] = params.value;
              if (code !== model.selected && code !== model.compare) return "";
              const name = model.lookup[String(code)]?.name_en ?? String(code);
              return `${name} · ${fmtMoney(Number(salePsf) * brief.flatSize)}`;
            },
          },
          emphasis: { itemStyle: { opacity: 1, borderWidth: 2, borderColor: theme.text } },
          markLine: {
            silent: true,
            symbol: ["none", "none"],
            label: { show: true, fontSize: 7, color: theme.amber, position: "insideEndTop" },
            lineStyle: { color: theme.amber, width: 1, type: "dashed" },
            data: isRent
              ? [{ yAxis: rentPsfCap, name: "rent cap" }]
              : [
                  { xAxis: ceiling / brief.flatSize, name: "buy ceiling" },
                  { yAxis: rentPsfCap, name: "rent cap" },
                ],
          },
        },
      ],
    };

    const series: Array<Record<string, unknown>> = [
      {
        name: "HK median",
        type: "line",
        data: model.hkSeries.map((point) => [point.month, Number(point.value.toFixed(2))]),
        showSymbol: false,
        lineStyle: { width: 1.2, color: theme.muted, type: "dashed" },
        itemStyle: { color: theme.muted },
      },
    ];
    if (model.selected) {
      series.push({
        name: model.lookup[model.selected]?.name_en ?? model.selected,
        type: "line",
        data: model.selectedSeries.map((point) => [point.month, Number(point.value.toFixed(2))]),
        showSymbol: false,
        lineStyle: { width: 1.9, color: theme.teal },
        itemStyle: { color: theme.teal },
      });
    }
    if (model.compare) {
      series.push({
        name: model.lookup[model.compare]?.name_en ?? model.compare,
        type: "line",
        data: model.compareSeries.map((point) => [point.month, Number(point.value.toFixed(2))]),
        showSymbol: false,
        lineStyle: { width: 1.6, color: theme.amber },
        itemStyle: { color: theme.amber },
      });
    }

    // In rent mode the trend pairs rent $/ft² with the rent-to-income ratio of
    // the brief's flat size and income, read from a second axis. RTI is a
    // proportional transform of rent, so one line (the selected district, or the
    // HK median when none is selected) is enough; the tooltip shows the ratio
    // for every rent line.
    const rtiSource =
      isRent && metric === "rent_psf"
        ? model.selected && model.selectedSeries.length
          ? model.selectedSeries
          : model.hkSeries
        : [];
    const rtiPoints = rtiSource.flatMap((point) => {
      const value = rentToIncome(point.value * brief.flatSize, brief.monthlyIncome);
      return value === null ? [] : [{ month: point.month, value }];
    });
    const showRti = rtiPoints.length > 0;
    const rtiBounds = rtiAxisBounds(rtiPoints.map((point) => point.value));

    if (showRti) {
      series.push({
        name: "RTI",
        type: "bar",
        yAxisIndex: 1,
        data: rtiPoints.map((point) => {
          const band = rtiBand(point.value, brief.rtiCap);
          return {
            value: [point.month, Number(point.value.toFixed(4))],
            itemStyle: {
              color:
                band === "ok" ? theme.rtiOk : band === "warn" ? theme.rtiWarn : theme.rtiOver,
            },
          };
        }),
        barMaxWidth: 7,
        itemStyle: { opacity: 0.5, borderRadius: [1, 1, 0, 0] },
        z: 1,
      });
    }

    const trendTooltip = showRti
      ? {
          ...(base.tooltip as object),
          trigger: "axis",
          formatter: (params: unknown) => {
            const items = (Array.isArray(params) ? params : [params]) as Array<{
              axisValue?: string;
              seriesName?: string;
              marker?: string;
              value?: unknown;
            }>;
            const month = items[0]?.axisValue ?? "";
            const rows = items
              .filter((item) => item.seriesName !== "RTI")
              .map((item) => {
                const raw = Array.isArray(item.value) ? item.value[1] : item.value;
                const rent = Number(raw);
                const rti = rentToIncome(rent * brief.flatSize, brief.monthlyIncome);
                return `<div>${item.marker ?? ""}${item.seriesName}: ${fmtPsf(rent)}${
                  rti === null ? "" : ` · RTI ${Math.round(rti * 100)}%`
                }</div>`;
              })
              .join("");
            return `<strong>${month}</strong>${rows}`;
          },
        }
      : {
          ...(base.tooltip as object),
          trigger: "axis",
          valueFormatter: (value: number) => formatMetric(metric, Number(value)),
        };

    const rentAxis = {
      type: "value",
      scale: true,
      axisLabel: axisLabelStyle(theme, {
        formatter: (value: number) => formatMetricAxis(metric, value),
      }),
    };

    const rtiAxis = {
      type: "value",
      min: rtiBounds.min,
      max: rtiBounds.max,
      splitLine: { show: false },
      axisLabel: axisLabelStyle(theme, {
        formatter: (value: number) => `${Math.round(value * 100)}%`,
      }),
    };

    const trendOption: Record<string, unknown> = {
      ...base,
      grid: gridOf({ top: 16, bottom: 0, left: 2, right: 8 }),
      legend: {
        ...(base.legend as object),
        data: series.filter((item) => item.name !== "RTI").map((item) => item.name),
      },
      tooltip: trendTooltip,
      xAxis: {
        type: "category",
        data: model.hkSeries.map((point) => point.month),
        boundaryGap: false,
        axisLabel: axisLabelStyle(theme, {
          formatter: quarterTick,
          interval: Math.max(0, Math.floor(model.hkSeries.length / 7)),
        }),
      },
      yAxis: showRti ? [rentAxis, rtiAxis] : rentAxis,
      series,
    };

    const yieldDistrictName = model.selected
      ? model.lookup[model.selected]?.name_en ?? model.selected
      : null;

    const yieldOption: Record<string, unknown> = {
      ...base,
      grid: gridOf({ top: 16, bottom: 0, left: 2, right: 8 }),
      legend: {
        ...(base.legend as object),
        data: yieldDistrictName ? ["HK median", yieldDistrictName] : ["HK median"],
      },
      tooltip: {
        ...(base.tooltip as object),
        trigger: "axis",
        valueFormatter: (value: number) => `${Number(value).toFixed(2)}%`,
      },
      xAxis: {
        type: "category",
        data: model.hkYieldSeries.map((point) => point.month),
        boundaryGap: false,
        axisLabel: axisLabelStyle(theme, {
          formatter: quarterTick,
          interval: Math.max(0, Math.floor(model.hkYieldSeries.length / 4)),
        }),
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: axisLabelStyle(theme, {
          formatter: (value: number) => `${value.toFixed(1)}%`,
        }),
      },
      series: [
        {
          name: "HK median",
          type: "line",
          data: model.hkYieldSeries.map((point) => [point.month, Number(point.value.toFixed(2))]),
          showSymbol: false,
          lineStyle: { width: 1.2, color: theme.muted, type: "dashed" },
          itemStyle: { color: theme.muted },
        },
        ...(yieldDistrictName && model.selectedYieldSeries.length
          ? [
              {
                name: yieldDistrictName,
                type: "line",
                data: model.selectedYieldSeries.map((point) => [
                  point.month,
                  Number(point.value.toFixed(2)),
                ]),
                showSymbol: false,
                lineStyle: { width: 1.9, color: theme.teal },
                itemStyle: { color: theme.teal },
              },
            ]
          : []),
      ],
    };

    const budgetOption: Record<string, unknown> = {
      ...base,
      grid: gridOf({ top: 6, bottom: 0, left: 2, right: 38 }),
      legend: { ...(base.legend as object), show: false },
      tooltip: {
        ...(base.tooltip as object),
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const row = model.budgetRows[params[0]?.dataIndex ?? 0];
          if (!row) return "";
          return `<strong>${row.name}</strong><br/>${isRent ? "Monthly rent" : "Price"} ${fmtMoney(row.monthly)}${isRent ? "/mo" : ""}<br/>${fmtPsf(row.psf)}<br/>Requires ${fmtMoney(row.requiredIncome)}/mo<br/>${
            row.status === "outside"
              ? "Outside your budget"
              : row.status === "edge"
                ? "At the edge of your budget"
                : "Within budget"
          }`;
        },
      },
      xAxis: {
        type: "value",
        splitNumber: 4,
        axisLabel: axisLabelStyle(theme, {
          formatter: (value: number) => `HK$${fmtCompact(value)}`,
          fontSize: 7.5,
        }),
      },
      yAxis: {
        type: "category",
        data: model.budgetRows.map((row) =>
          row.name.length > 16 ? `${row.name.slice(0, 15)}…` : row.name,
        ),
        axisLabel: { color: theme.axisLabel, fontSize: 7.5, interval: 0 },
      },
      series: [
        {
          name: isRent ? "Monthly rent" : "Price",
          type: "bar",
          data: model.budgetRows.map((row) => ({
            value: Math.round(row.monthly),
            code: row.code,
            itemStyle: {
              color: statusColor(row.status, theme),
              borderRadius: [0, 2, 2, 0],
            },
          })),
          barMaxWidth: 9,
          markLine: {
            silent: true,
            symbol: ["none", "none"],
            label: { show: true, position: "insideEndTop", fontSize: 7, color: theme.text },
            lineStyle: { color: theme.text, width: 1.2 },
            data: isRent
              ? [{ xAxis: ceiling, name: "your cap", label: { formatter: "your cap" } }]
              : [
                  {
                    xAxis: ceiling,
                    name: "your ceiling",
                    label: { formatter: "your ceiling" },
                  },
                  {
                    xAxis: stressedCeiling,
                    name: "+200 bp",
                    lineStyle: { color: theme.amber, type: "dashed", width: 1 },
                    label: { color: theme.amber, formatter: "+200 bp" },
                  },
                ],
          },
        },
      ],
    };

    return { rankingOption, scatterOption, trendOption, trendHasRti: showRti, yieldOption, budgetOption };
  }, [
    model,
    theme,
    metric,
    brief.flatSize,
    brief.monthlyIncome,
    brief.rtiCap,
    ceiling,
    stressedCeiling,
    rentPsfCap,
    isRent,
  ]);

  const kpis: StatItem[] = useMemo(() => {
    const selectedName = model?.selected ? model.lookup[model.selected]?.name_en ?? model.selected : null;
    const rank =
      model?.selected && model.selectedValue !== null ? model.ranks[model.selected] ?? null : null;
    const listingCount = model?.listing
      ? isRent
        ? model.listing.rent
        : model.listing.sale
      : null;
    return [
      {
        label: `HK median · ${METRIC_LABELS[metric]}`,
        value:
          model?.hkMedian !== null && model?.hkMedian !== undefined
            ? formatMetric(metric, model.hkMedian)
            : "—",
        delta: `${quarter} · median of ${model?.ranked.length ?? 0} districts`,
      },
      {
        label: "Selected district",
        value:
          model?.selectedValue !== null && model?.selectedValue !== undefined
            ? formatMetric(metric, model.selectedValue)
            : "—",
        delta: selectedName ? `${selectedName} · rank #${rank ?? "—"}` : "Click the map to select",
      },
      {
        label: "Comparison",
        value:
          model?.compareValue !== null && model?.compareValue !== undefined
            ? formatMetric(metric, model.compareValue)
            : "—",
        delta: model?.compare
          ? model.lookup[model.compare]?.name_en ?? model.compare
          : "Click a bar to compare",
      },
      {
        label: "Within budget",
        value: model ? `${model.countWithin}/18` : "—",
        delta: `${isRent ? "rent cap" : "buy ceiling"} ${fmtMoney(ceiling)}`,
        tone: model && model.countWithin >= 9 ? "pos" : model && model.countWithin > 0 ? "warn" : "neg",
      },
      {
        label: isRent ? "Rental listings" : "Sale listings",
        value: listingCount !== null ? listingCount.toLocaleString("en-HK") : "—",
        delta: model?.listing
          ? `${model.listing.total.toLocaleString("en-HK")} total in district`
          : "Select a district",
      },
      {
        label: "Transactions",
        value: model ? model.transactions.toLocaleString("en-HK") : "—",
        delta: model?.selected
          ? `${shortQuarter(quarter)} · selected district`
          : `${shortQuarter(quarter)} · all districts`,
      },
    ];
  }, [model, metric, quarter, ceiling, isRent]);

  const selectedName = model?.selected ? model.lookup[model.selected]?.name_en ?? model.selected : null;
  const boxDistrictName = brief.selectedDistrict
    ? model?.lookup[brief.selectedDistrict]?.name_en ?? brief.selectedDistrict
    : "All Hong Kong";
  const trendTitle = isRent ? "Rent trend" : "Price trend";

  return (
    <>
      <StageHeader
        eyebrow="Stage 2 · District explorer"
        title={
          isRent
            ? "Where can you afford to rent — and what do you give up?"
            : "Where can you afford to buy — and what do you give up?"
        }
        question={
          isRent
            ? "Compare all 18 districts on rent, rent change and yield under your rent cap, then pick an area."
            : "Compare all 18 districts on price, movement and yield under your mortgage ceiling, then pick an area."
        }
        actions={
          <>
            <Segmented<DistrictMetric>
              options={metrics}
              value={metric}
              onChange={setMetricChoice}
              label="Map metric"
              size="sm"
            />
            <select
              className="rail-select filter-select"
              value={quarter}
              onChange={(event) => setQuarterChoice(event.target.value)}
              aria-label="Quarter"
            >
              {quarters.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={onlyBudget ? "btn btn-primary" : "btn"}
              aria-pressed={onlyBudget}
              onClick={() => setOnlyBudget((value) => !value)}
            >
              In budget
            </button>
          </>
        }
        next={{
          to: "/shortlist",
          label: selectedName ? `Next: shortlist in ${selectedName}` : "Next: build your shortlist",
        }}
      />

      <KpiStrip items={kpis} />

      <Bento>
        <BentoRow cols="minmax(0, 38fr) minmax(0, 30fr) minmax(0, 32fr)">
          <Panel
            title={`${METRIC_LABELS[metric]} map`}
            subtitle={`${quarter} · ${onlyBudget ? "within budget only" : "all districts"}`}
            noteId="explore-map"
            loading={districtData.loading || geo.loading}
            error={districtData.error ?? geo.error}
            empty={!districtData.data || !geo.data}
            emptyMessage="District geometry unavailable."
            footer={
              onlyBudget
                ? `${model?.filteredOut ?? 0} districts hidden by your budget. Click to select or clear.`
                : "Land-only 2001 boundaries; click a district to select or clear."
            }
          >
            {geo.data && model ? (
              <DistrictMap
                geojson={geo.data}
                values={model.visible}
                selected={model.selected}
                onSelect={brief.selectDistrict}
                diverging={metric === "price_yoy" || metric === "rent_yoy"}
                formatValue={(value) => formatMetric(metric, value)}
                metricLabel={METRIC_LABELS[metric]}
                height="100%"
              />
            ) : null}
          </Panel>

          <Panel
            title="Most-traded estates"
            subtitle={`${boxDistrictName} · quarterly sale $/ft²`}
            noteId="explore-top-estates"
            loading={districtData.loading || (!quartiles.data && !quartiles.error)}
            empty={!topEstates.length || !boxedEstates.length}
            emptyMessage="No quarterly history for the top estates."
            footer={`Q1–Q3 box · median · min–max · ${boxedEstates.length}/${topEstates.length} shown.`}
          >
            {boxedEstates.length ? <EstateBoxPlot estates={boxedEstates} /> : null}
          </Panel>

          <Panel
            title="Ranking"
            subtitle={METRIC_LABELS[metric]}
            noteId="explore-ranking"
            actions={
              <select
                className="rail-select filter-select"
                value={brief.compareDistrict ?? ""}
                onChange={(event) => brief.setCompareDistrict(event.target.value || null)}
                aria-label="Comparison district"
              >
                <option value="">Compare…</option>
                {[...(districtData.data?.districts ?? [])]
                  .sort((a, b) => a.name_en.localeCompare(b.name_en))
                  .map((district) => (
                    <option key={district.district_code} value={district.district_code}>
                      {district.name_en}
                    </option>
                  ))}
              </select>
            }
            loading={districtData.loading}
            empty={!options || !model?.ranked.length}
            emptyMessage="No districts match."
            footer="Region colours: blue Island · amber Kowloon · green New Territories."
          >
            {options ? (
              <Chart
                option={options.rankingOption}
                ariaLabel="District ranking bars"
                onEvents={{
                  click: (params: unknown) => {
                    const event = params as { data?: { code?: string } };
                    const code = event.data?.code;
                    if (code) brief.setCompareDistrict(brief.compareDistrict === code ? null : code);
                  },
                }}
              />
            ) : null}
          </Panel>
        </BentoRow>

        <BentoRow
          cols={
            isRent
              ? "minmax(0, 50fr) minmax(0, 50fr)"
              : "minmax(0, 36fr) minmax(0, 28fr) minmax(0, 36fr)"
          }
        >
          <Panel
            title={isRent ? "Can I afford to rent here?" : "Can I afford to buy here?"}
            subtitle={`${brief.flatSize} ft² · ${isRent ? `cap ${fmtPctPlain(brief.rtiCap, 0)}` : `ceiling ${fmtMoney(ceiling)}`}`}
            noteId="explore-budget-fit"
            loading={districtData.loading}
            empty={!options || !model?.budgetRows.length}
            emptyMessage="No district panel for this quarter."
            footer={
              isRent
                ? `${model?.countWithin ?? 0} of 18 districts are inside your rent cap. Click a district to select it.`
                : `${model?.countWithin ?? 0} of 18 inside your ceiling at today's rate · dashed = +200 bp · click to select.`
            }
          >
            {options ? (
              <Chart
                option={options.budgetOption}
                ariaLabel="District budget fit"
                onEvents={{
                  click: (params: unknown) => {
                    const event = params as { data?: { code?: string } };
                    if (event.data?.code) brief.setSelectedDistrict(event.data.code);
                  },
                }}
              />
            ) : null}
          </Panel>

          {!isRent ? (
            <Panel
              title="Gross yield"
              subtitle={
                selectedName
                  ? `vs 18-district median · 2018 → ${model?.latest ?? ""}`
                  : `18-district median · 2018 → ${model?.latest ?? ""}`
              }
              noteId="explore-yield"
              loading={districtData.loading}
              empty={!options || !model?.hkYieldSeries.length}
              emptyMessage="No yield history for this district."
              footer={
                selectedName
                  ? "12 × rent/ft² ÷ price/ft² · dashed = 18-district median."
                  : "12 × rent/ft² ÷ price/ft² · select a district to compare."
              }
            >
              {options ? (
                <Chart
                  option={options.yieldOption}
                  ariaLabel="Gross yield versus the 18-district median"
                />
              ) : null}
            </Panel>
          ) : null}

          <Panel
            title={trendView === "trend" ? trendTitle : "Price vs rent"}
            subtitle={
              trendView === "trend"
                ? options?.trendHasRti
                  ? `Rent $/ft² + rent-to-income · 2018 → ${model?.latest ?? ""}`
                  : `${METRIC_LABELS[metric]} · 2018 → ${model?.latest ?? ""}`
                : `${quarter} · ${brief.flatSize} ft² budget lines`
            }
            noteId={trendView === "trend" ? "explore-trend" : "explore-scatter"}
            actions={
              <Segmented<"trend" | "scatter">
                options={[
                  { value: "trend", label: "Trend" },
                  { value: "scatter", label: "Price vs rent" },
                ]}
                value={trendView}
                onChange={setTrendView}
                label="Panel view"
                size="sm"
              />
            }
            loading={districtData.loading}
            empty={!options || (trendView === "trend" ? !model?.hkSeries.length : !model?.points.length)}
            emptyMessage="No district history for this metric."
            footer={
              trendView === "scatter"
                ? "Dashed lines mark your buy ceiling and rent cap at this flat size."
                : options?.trendHasRti
                  ? `Bars (right axis) = ${brief.flatSize} ft² rent ÷ ${fmtMoney(brief.monthlyIncome)}/mo (${selectedName ?? "HK median"}); green under your ${fmtPctPlain(brief.rtiCap, 0)} cap, amber to 100%, red above.`
                  : metric === "price_yoy" || metric === "rent_yoy"
                    ? "YoY compares the same quarter a year earlier; composition changes can create large swings."
                    : selectedName
                      ? `${selectedName}${model?.compare ? ` vs ${model.lookup[model.compare]?.name_en ?? model.compare}` : ""} against the HK median.`
                      : "Select a district on the map to add its line."
            }
          >
            {options ? (
              <Chart
                option={trendView === "trend" ? options.trendOption : options.scatterOption}
                ariaLabel={
                  trendView === "trend"
                    ? options.trendHasRti
                      ? "District rent and rent-to-income trend"
                      : "District trend"
                    : "District price versus rent"
                }
              />
            ) : null}
          </Panel>
        </BentoRow>
      </Bento>
    </>
  );
}
