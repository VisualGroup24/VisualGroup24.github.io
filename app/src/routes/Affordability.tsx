import { useEffect, useMemo, useState } from "react";
import Chart from "../components/Chart";
import {
  ErrorCard,
  KpiCard,
  LoadingCard,
  SectionCard,
  SegmentedControl,
} from "../components/Cards";
import PageHeader from "../components/PageHeader";
import { useDistrictData } from "../data/useDistrictData";
import type { AffordabilityRow, DistrictPanelRow } from "../data/types";
import { fmtMoney, fmtPct, fmtPctPlain, fmtPsf, fmtRatio } from "../lib/format";
import { loanFromPayment, monthlyPayment, stressTest } from "../lib/finance";
import { median } from "../lib/stats";
import { useFilters } from "../state/filters";

type RankingMetric = "pti" | "rti";
type RatioMetric = "pti" | "rti";

const REGION_COLORS: Record<string, string> = {
  "HK Island": "#2563eb",
  Kowloon: "#d97706",
  "New Territories": "#15803d",
};

function shiftQuarter(quarter: string, delta: number): string {
  const [yearText, qText] = quarter.split("-Q");
  let year = Number(yearText);
  let q = Number(qText) + delta;
  while (q > 4) {
    q -= 4;
    year += 1;
  }
  while (q < 1) {
    q += 4;
    year -= 1;
  }
  return `${year}-Q${q}`;
}

export default function Affordability() {
  const { data, error, loading } = useDistrictData();
  const selected = useFilters((state) => state.selectedDistrict);
  const selectDistrict = useFilters((state) => state.selectDistrict);
  const setSelectedDistrict = useFilters((state) => state.setSelectedDistrict);
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>("pti");
  const [ratioMetric, setRatioMetric] = useState<RatioMetric>("pti");

  const view = useMemo(() => {
    if (!data) return null;
    const affordable = data.affordability;
    if (!affordable.length) return null;
    const years = [...new Set(affordable.map((row) => row.year))].sort();
    const latestYear = years[years.length - 1];
    const startYear = years.includes(2018) ? 2018 : years[0];
    const latestRows = affordable.filter((row) => row.year === latestYear);
    const districtNames = new Map(data.districts.map((district) => [district.district_code, district.name_en]));
    const districtRegions = new Map(data.districts.map((district) => [district.district_code, district.region]));

    const selectedLatest = selected
      ? latestRows.find((row) => row.district_code === selected) ?? null
      : null;
    const selectedRow = selected
      ? affordable.filter((row) => row.district_code === selected).sort((a, b) => a.year - b.year).at(-1) ?? null
      : null;

    const aggregate = {
      pti: median(latestRows.map((row) => row.pti)),
      rti: median(latestRows.map((row) => row.rti)),
      mortgage_burden: median(latestRows.map((row) => row.mortgage_burden)),
      required_income: median(latestRows.map((row) => row.required_income)),
      price: median(latestRows.map((row) => row.price)),
      rent: median(latestRows.map((row) => row.rent)),
      income: median(latestRows.map((row) => row.median_income)),
    };

    const latestPanel = data.panel
      .filter((row) => row.quarter === data.as_of)
      .map((row) => row);
    const selectedPanel = selected
      ? latestPanel.find((row) => row.district_code === selected) ?? null
      : null;
    const yieldLatest = selectedPanel?.yield_pct ?? median(latestPanel.map((row) => row.yield_pct ?? 0).filter(Boolean));

    const rankingRows = latestRows
      .map((row) => ({
        ...row,
        name: districtNames.get(row.district_code) ?? row.district_code,
        region: districtRegions.get(row.district_code) ?? "",
      }))
      .sort((a, b) => (rankingMetric === "pti" ? b.pti - a.pti : b.rti - a.rti));

    const startRows = affordable.filter((row) => row.year === startYear);
    const startMap = new Map(startRows.map((row) => [row.district_code, row]));
    const endMap = new Map(latestRows.map((row) => [row.district_code, row]));
    const slopeDistricts = [...new Set(latestRows.map((row) => row.district_code))].filter(
      (code) => startMap.has(code) && endMap.has(code),
    );

    const yieldByQuarter = new Map<string, number[]>();
    data.panel.forEach((row) => {
      if (row.yield_pct === null) return;
      const values = yieldByQuarter.get(row.quarter) ?? [];
      values.push(row.yield_pct);
      yieldByQuarter.set(row.quarter, values);
    });
    const quarters = [...yieldByQuarter.keys()].filter((q) => q >= "2018-Q1").sort();
    const medianYield = quarters.map((q) => median(yieldByQuarter.get(q) ?? []));

    const growthRows = latestPanel
      .map((row) => {
        const past = data.panel.find(
          (item) => item.district_code === row.district_code && item.quarter === shiftQuarter(row.quarter, -12),
        );
        if (!past?.sale_psf || !row.sale_psf || !row.yield_pct) return null;
        return {
          code: row.district_code,
          name: districtNames.get(row.district_code) ?? row.district_code,
          growth: ((row.sale_psf - past.sale_psf) / past.sale_psf) * 100,
          yield: row.yield_pct,
          volume: row.volume,
          region: districtRegions.get(row.district_code) ?? "",
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return {
      years,
      latestYear,
      startYear,
      latestRows,
      selectedLatest,
      selectedRow,
      aggregate,
      yieldLatest,
      rankingRows,
      startMap,
      endMap,
      slopeDistricts,
      quarters,
      medianYield,
      growthRows,
      districtNames,
      districtRegions,
    };
  }, [data, rankingMetric, selected]);

  const [price, setPrice] = useState(6_000_000);
  const [downPct, setDownPct] = useState(30);
  const [rate, setRate] = useState(4.2);
  const [years, setYears] = useState(30);
  const [income, setIncome] = useState(40_000);
  const [area, setArea] = useState(500);

  useEffect(() => {
    if (!view) return;
    const row = view.selectedLatest;
    const rateRow = row ?? view.latestRows[0];
    setPrice(Math.round((row ? row.price : view.aggregate.price) / 10_000) * 10_000);
    setIncome(Math.round((row ? row.median_income : view.aggregate.income) / 100) * 100);
    if (rateRow) setRate(rateRow.mortgage_rate);
    // Intentionally reset only when the data or selected district changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selected]);

  if (loading) return <LoadingCard height={420} message="Loading affordability panel…" />;
  if (error || !data || !view) {
    return <ErrorCard message={error ?? "No affordability data. Run the district panel first."} />;
  }

  const loan = price * (1 - downPct / 100);
  const payment = monthlyPayment(loan, rate, years);
  const stress = stressTest(price, downPct, rate, years, 200);
  const dsr = income > 0 ? payment / income : 0;
  const requiredIncome = payment / 0.5;
  const maxPrice = income > 0 ? loanFromPayment(income * 0.5, rate, years) / (1 - downPct / 100) : 0;

  const rankingOption = {
    animationDuration: 300,
    grid: { left: 118, right: 44, top: 12, bottom: 32 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 11 },
      valueFormatter: (value: number) => (rankingMetric === "pti" ? value.toFixed(1) : value.toFixed(2)),
    },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
      axisLabel: { color: "#64748b", fontSize: 10 },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: view.rankingRows.map((row) => row.name),
      axisLabel: { color: "#64748b", fontSize: 10 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar",
        data: view.rankingRows.map((row) => ({
          value: rankingMetric === "pti" ? row.pti : row.rti,
          itemStyle: {
            color: REGION_COLORS[row.region] ?? "#0f766e",
            opacity: selected && row.district_code !== selected ? 0.45 : 0.85,
            borderRadius: [0, 3, 3, 0],
          },
        })),
        barMaxWidth: 14,
        label: {
          show: true,
          position: "right",
          fontSize: 10,
          color: "#64748b",
          formatter: (params: { value: number }) =>
            rankingMetric === "pti" ? `${params.value.toFixed(1)}×` : `${params.value.toFixed(2)}`,
        },
      },
    ],
  };

  const yieldOption = {
    animationDuration: 300,
    grid: { left: 46, right: 18, top: 28, bottom: 38 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 11 },
      valueFormatter: (value: number) => `${value.toFixed(2)}%`,
    },
    legend: {
      top: 0,
      right: 0,
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 4,
      textStyle: { color: "#64748b", fontSize: 10 },
    },
    xAxis: {
      type: "category",
      data: view.quarters.map((q) => q.replace("-Q", " Q")),
      boundaryGap: false,
      axisLabel: { color: "#64748b", fontSize: 9, interval: 3 },
      axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
      axisLabel: { color: "#64748b", fontSize: 9, formatter: "{value}%" },
    },
    series: [
      {
        name: selected ? view.districtNames.get(selected) : "HK median",
        type: "line",
        data: selected
          ? view.quarters.map((q) => {
              const row = data.panel.find((item) => item.district_code === selected && item.quarter === q);
              return row?.yield_pct ?? null;
            })
          : view.medianYield,
        showSymbol: false,
        lineStyle: { width: 2, color: "#0f766e" },
        itemStyle: { color: "#0f766e" },
      },
      ...(selected
        ? [
            {
              name: "HK median",
              type: "line" as const,
              data: view.medianYield,
              showSymbol: false,
              lineStyle: { width: 1.2, color: "#b45309", type: "dashed" as const },
              itemStyle: { color: "#b45309" },
            },
          ]
        : []),
    ],
  };

  const growthOption = {
    animationDuration: 300,
    grid: { left: 52, right: 22, top: 24, bottom: 44 },
    tooltip: {
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 11 },
      formatter: (params: { data: { name: string; growth: number; yield: number; volume: number } }) =>
        `<strong>${params.data.name}</strong><br/>3y price CAGR: ${params.data.growth.toFixed(1)}%<br/>Yield: ${params.data.yield.toFixed(2)}%<br/>Volume: ${params.data.volume}`,
    },
    xAxis: {
      type: "value",
      name: "3-year price CAGR (%)",
      nameLocation: "middle",
      nameGap: 28,
      nameTextStyle: { color: "#64748b", fontSize: 10 },
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
      axisLabel: { color: "#64748b", fontSize: 9 },
    },
    yAxis: {
      type: "value",
      name: "Gross yield (%)",
      nameLocation: "middle",
      nameGap: 36,
      nameTextStyle: { color: "#64748b", fontSize: 10 },
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
      axisLabel: { color: "#64748b", fontSize: 9 },
    },
    series: [
      {
        type: "scatter",
        data: view.growthRows.map((row) => ({
          value: [row.growth, row.yield],
          name: row.name,
          growth: row.growth,
          yield: row.yield,
          volume: row.volume,
          itemStyle: {
            color: REGION_COLORS[row.region] ?? "#0f766e",
            opacity: selected && row.code !== selected ? 0.35 : 0.8,
          },
        })),
        symbolSize: (value: number[], params: { data: { volume: number } }) =>
          Math.max(7, Math.min(26, Math.sqrt(params.data.volume || 1) * 1.5)),
        markLine: {
          silent: true,
          symbol: "none",
          label: { show: false },
          lineStyle: { color: "rgba(100,116,139,0.35)", type: "dashed" },
          data: [{ xAxis: 0 }],
        },
      },
    ],
  };

  const slopeOption = {
    animationDuration: 400,
    grid: { left: 46, right: 110, top: 20, bottom: 30 },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 11 },
      formatter: (params: { seriesName: string; value: [number, number] }) =>
        `${params.seriesName}<br/>${view.startYear}: ${params.value[0].toFixed(1)}×<br/>${view.latestYear}: ${params.value[1].toFixed(1)}×`,
    },
    xAxis: {
      type: "category",
      data: [String(view.startYear), String(view.latestYear)],
      boundaryGap: false,
      axisLabel: { color: "#64748b", fontSize: 10 },
      axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#64748b", fontSize: 9, formatter: "{value}×" },
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
    },
    series: view.slopeDistricts.map((code) => {
      const start = view.startMap.get(code)?.pti ?? null;
      const end = view.endMap.get(code)?.pti ?? null;
      const active = selected === code;
      return {
        type: "line",
        name: view.districtNames.get(code),
        data: [start, end],
        showSymbol: true,
        symbolSize: active ? 6 : 3,
        lineStyle: {
          width: active ? 2.5 : 1,
          opacity: active ? 1 : selected ? 0.18 : 0.45,
          color: REGION_COLORS[view.districtRegions.get(code) ?? ""] ?? "#0f766e",
        },
        itemStyle: { color: REGION_COLORS[view.districtRegions.get(code) ?? ""] ?? "#0f766e" },
        endLabel: active
          ? { show: true, formatter: () => view.districtNames.get(code), color: "#0f172a", fontSize: 10 }
          : { show: false },
      };
    }),
  };

  const trendByYear = new Map<number, AffordabilityRow[]>();
  data.affordability.forEach((row) => {
    const rows = trendByYear.get(row.year) ?? [];
    rows.push(row);
    trendByYear.set(row.year, rows);
  });
  const trendValue = (year: number, key: "rent" | "median_income" | "rti") => {
    const rows = (trendByYear.get(year) ?? []).filter(
      (row) => !selected || row.district_code === selected,
    );
    if (!rows.length) return null;
    if (selected) return rows[0][key];
    const values = rows.map((row) => row[key]).filter((value) => Number.isFinite(value));
    return values.length ? median(values) : null;
  };
  const trendYears = view.years;
  const areaScale = area / 500;
  const scaleArea = (value: number | null) => (value === null ? null : value * areaScale);
  const trendRent = trendYears.map((year) => scaleArea(trendValue(year, "rent")));
  const trendIncome = trendYears.map((year) => trendValue(year, "median_income"));
  const trendRti = trendYears.map((year) => scaleArea(trendValue(year, "rti")));
  const maxRti = Math.max(1, ...trendRti.filter((value): value is number => value !== null));
  const rtiAxisMax = Math.ceil(maxRti * 10) / 10;
  const trendOption = {
    animationDuration: 300,
    grid: { left: 64, right: 68, top: 48, bottom: 36 },
    legend: {
      top: 0,
      left: "center",
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 4,
      textStyle: { color: "#64748b", fontSize: 10 },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 11 },
      formatter: (
        params: Array<{ axisValue: string; seriesName: string; value: number | null; marker: string }>,
      ) => {
        if (!params.length) return "";
        const lines = params.map((item) => {
          const value =
            item.value === null || item.value === undefined
              ? "—"
              : item.seriesName === "Rent-to-income"
                ? item.value.toFixed(2)
                : fmtMoney(item.value);
          return `${item.marker}${item.seriesName}: ${value}`;
        });
        return `<strong>${params[0].axisValue}</strong><br/>${lines.join("<br/>")}`;
      },
    },
    xAxis: {
      type: "category",
      data: trendYears,
      boundaryGap: false,
      axisLabel: { color: "#64748b", fontSize: 9, interval: 3 },
      axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: "value",
        name: "HK$ / month",
        nameTextStyle: { color: "#64748b", fontSize: 9 },
        splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 9,
          formatter: (value: number) => `${Math.round(value / 1000)}k`,
        },
      },
      {
        type: "value",
        name: "Rent-to-income",
        position: "right",
        min: 0,
        max: rtiAxisMax,
        splitNumber: 5,
        nameTextStyle: { color: "#64748b", fontSize: 9 },
        splitLine: { show: false },
        axisLabel: {
          color: "#64748b",
          fontSize: 9,
          formatter: (value: number) => value.toFixed(2),
        },
      },
    ],
    series: [
      {
        name: "Rent",
        type: "line",
        yAxisIndex: 0,
        data: trendRent,
        showSymbol: false,
        z: 2,
        lineStyle: { width: 2, color: "#0f766e" },
        itemStyle: { color: "#0f766e" },
      },
      {
        name: "Monthly income",
        type: "line",
        yAxisIndex: 0,
        data: trendIncome,
        showSymbol: false,
        z: 2,
        lineStyle: { width: 2, color: "#b45309" },
        itemStyle: { color: "#b45309" },
      },
      {
        name: "Rent-to-income",
        type: "bar",
        yAxisIndex: 1,
        data: trendRti,
        barMaxWidth: 18,
        z: 1,
        itemStyle: {
          color: "rgba(37,99,235,0.32)",
          borderRadius: [3, 3, 0, 0],
        },
        emphasis: { itemStyle: { color: "rgba(37,99,235,0.55)" } },
      },
    ],
  };

  const buyerRentOption = {
    animationDuration: 300,
    grid: { left: 52, right: 22, top: 24, bottom: 46 },
    tooltip: {
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 11 },
      formatter: (params: { data: { name: string; rti: number; burden: number; rent: number; payment: number } }) =>
        `<strong>${params.data.name}</strong><br/>Rent-to-income: ${params.data.rti.toFixed(2)}<br/>Mortgage burden: ${(params.data.burden * 100).toFixed(0)}%<br/>Rent: ${fmtMoney(params.data.rent)}<br/>Mortgage: ${fmtMoney(params.data.payment)}`,
    },
    xAxis: {
      type: "value",
      name: "Rent-to-income",
      nameLocation: "middle",
      nameGap: 28,
      nameTextStyle: { color: "#64748b", fontSize: 10 },
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
      axisLabel: { color: "#64748b", fontSize: 9 },
    },
    yAxis: {
      type: "value",
      name: "Mortgage burden",
      nameLocation: "middle",
      nameGap: 40,
      nameTextStyle: { color: "#64748b", fontSize: 10 },
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
      axisLabel: { color: "#64748b", fontSize: 9, formatter: (value: number) => `${Math.round(value * 100)}%` },
    },
    series: [
      {
        type: "scatter",
        data: view.latestRows.map((row) => ({
          value: [row.rti, row.mortgage_burden],
          name: view.districtNames.get(row.district_code),
          rti: row.rti,
          burden: row.mortgage_burden,
          rent: row.rent,
          payment: row.monthly_payment,
          itemStyle: {
            color: REGION_COLORS[view.districtRegions.get(row.district_code) ?? ""] ?? "#0f766e",
            opacity: selected && row.district_code !== selected ? 0.3 : 0.8,
          },
        })),
        symbolSize: 9,
      },
    ],
  };

  const selectedName = selected ? view.districtNames.get(selected) : null;
  const selectedRank = view.selectedLatest?.rank;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Households & investors"
        title="Financing & Affordability"
        question="What return does housing offer, and who can afford to live where?"
      >
        <SegmentedControl
          value={ratioMetric}
          options={[
            { value: "pti", label: "Price / income" },
            { value: "rti", label: "Rent / income" },
          ]}
          onChange={setRatioMetric}
        />
        <span className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--text-muted)]">
          Income year {view.latestYear}
        </span>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard
          label={ratioMetric === "pti" ? "Price-to-income" : "Rent-to-income"}
          value={
            ratioMetric === "pti"
              ? fmtRatio(selected ? view.selectedLatest?.pti : view.aggregate.pti)
              : (selected ? view.selectedLatest?.rti : view.aggregate.rti)?.toFixed(2) ?? "—"
          }
          note={selectedName ?? "median of districts"}
        />
        <KpiCard
          label="Gross yield"
          value={fmtPctPlain(view.yieldLatest)}
          note={selectedName ?? "latest quarter"}
          accent="amber"
        />
        <KpiCard
          label="Mortgage burden"
          value={fmtPctPlain((selected ? view.selectedLatest?.mortgage_burden : view.aggregate.mortgage_burden) ? ((selected ? view.selectedLatest?.mortgage_burden ?? 0 : view.aggregate.mortgage_burden) as number) * 100 : null, 0)}
          note="70% LTV, 30 years"
          accent="blue"
        />
        <KpiCard
          label="Required income"
          value={fmtMoney(selected ? view.selectedLatest?.required_income : view.aggregate.required_income)}
          note="at 50% DSR"
          accent="neutral"
        />
        <KpiCard
          label="Median price"
          value={fmtMoney(selected ? view.selectedLatest?.price : view.aggregate.price)}
          note={selectedName ?? "median district"}
          accent="neutral"
        />
        <KpiCard
          label="Rank"
          value={selectedRank ? `#${selectedRank} / 18` : "—"}
          note={selectedRank ? "least affordable" : "select a district"}
          accent="neutral"
        />
      </div>

      <SectionCard
        title="Rent, income and rent burden"
        description={`Monthly rent and median household income (left axis) and rent-to-income as bars (right axis, normally 0–1) for a ${area} ft² flat, ${view.years[0]}–${view.latestYear}.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>Flat size</span>
              <input
                type="range"
                min={200}
                max={800}
                step={10}
                value={area}
                onChange={(event) => setArea(Number(event.target.value))}
                className="w-32 accent-teal-700"
                aria-label="Flat size in square feet"
              />
              <span className="w-14 text-right font-semibold tabular-nums text-[var(--text)]">
                {area} ft²
              </span>
            </label>
            <select
              value={selected ?? ""}
              onChange={(event) => setSelectedDistrict(event.target.value || null)}
              className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs"
              aria-label="District"
            >
              <option value="">All Hong Kong</option>
              {[...data.districts]
                .sort((a, b) => a.name_en.localeCompare(b.name_en))
                .map((district) => (
                  <option key={district.district_code} value={district.district_code}>
                    {district.name_en}
                  </option>
                ))}
            </select>
          </div>
        }
      >
        <Chart option={trendOption} height={380} />
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
          {area} ft² flat.{" "}
          {selected
            ? `${view.districtNames.get(selected)} selected.`
            : "Hong Kong lines are medians of the 18 district estimates."}{" "}
          Rent-to-income = monthly rent ÷ monthly household income.
        </p>
        {rtiAxisMax > 1 ? (
          <p className="mt-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
            Axis extended to {rtiAxisMax.toFixed(1)} so values above 1.0 stay visible at this flat size.
          </p>
        ) : null}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Affordability ranking"
          description={`${ratioMetric === "pti" ? "Price-to-income" : "Rent-to-income"} by district, ${view.latestYear}. Click a bar to select the district.`}
          action={
            <SegmentedControl
              value={rankingMetric}
              options={[
                { value: "pti", label: "PTI" },
                { value: "rti", label: "RTI" },
              ]}
              onChange={setRankingMetric}
            />
          }
        >
          <Chart
            option={rankingOption}
            height={520}
            onEvents={{
              click: (params) => {
                const index = (params as { dataIndex?: number }).dataIndex;
                if (index === undefined) return;
                const row = view.rankingRows[index];
                if (row) selectDistrict(row.district_code);
              },
            }}
          />
        </SectionCard>

        <SectionCard
          title="Yield over time"
          description="Gross yield = 12 × rent $/ft² ÷ sale $/ft². Selected district against the 18-district median."
        >
          <Chart option={yieldOption} height={300} />
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Latest quarter: {data.as_of?.replace("-Q", " Q")} · rent history is modelled from the RVD
            rental index.
          </p>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Yield vs price growth"
          description="Districts in the upper-left combine higher yield with weaker price growth; upper-right is high yield with strong growth. Bubble size is transaction volume."
        >
          <Chart option={growthOption} height={360} />
        </SectionCard>

        <SectionCard
          title="Price-to-income, 2018 → latest"
          description="Each line is a district. A steeper upward line means affordability deteriorated more."
        >
          <Chart option={slopeOption} height={360} />
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title="Mortgage calculator"
          description="Indicative monthly payment and stress test. Excludes stamp duty, legal and management fees."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Property price (HK$)", value: price, set: setPrice, step: 50_000, min: 1_000_000, max: 100_000_000 },
              { label: "Down payment (%)", value: downPct, set: setDownPct, step: 1, min: 0, max: 90 },
              { label: "Mortgage rate (%)", value: rate, set: setRate, step: 0.1, min: 0.5, max: 15 },
              { label: "Tenure (years)", value: years, set: setYears, step: 1, min: 5, max: 40 },
              { label: "Monthly household income (HK$)", value: income, set: setIncome, step: 1_000, min: 5_000, max: 500_000 },
            ].map((field) => (
              <label key={field.label} className="block text-xs">
                <span className="text-[var(--text-muted)]">{field.label}</span>
                <input
                  type="number"
                  value={field.value}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  onChange={(event) => field.set(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm tabular-nums outline-none focus:border-teal-700"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {[
              ["Loan", fmtMoney(loan)],
              ["Monthly payment", fmtMoney(payment)],
              ["DSR", fmtPctPlain(dsr * 100, 0)],
              ["Required income", fmtMoney(requiredIncome)],
              ["Stress test (+2pp)", fmtMoney(stress.base)],
              ["Stressed payment", fmtMoney(stress.stressed)],
              ["Max price at 50% DSR", fmtMoney(maxPrice)],
              ["Down payment", fmtMoney(price - loan)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-black/[0.03] p-2 dark:bg-white/[0.04]">
                <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
            At {rate.toFixed(1)}% over {years} years, a {fmtMoney(price)} flat with{" "}
            {downPct}% down needs about {fmtMoney(requiredIncome)} a month at a 50% DSR cap. The
            +200 bp stress test raises the payment to {fmtMoney(stress.stressed)}.
          </p>
        </SectionCard>

        <SectionCard
          title="Tenant vs buyer"
          description="Rent-to-income against mortgage burden for the median flat. Lower-left districts are easier on both budgets."
        >
          <Chart option={buyerRentOption} height={360} />
          {view.selectedLatest ? (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {[
                ["Median rent", fmtMoney(view.selectedLatest.rent)],
                ["Mortgage payment", fmtMoney(view.selectedLatest.monthly_payment)],
                ["Rent / income", (view.selectedLatest.rti * 100).toFixed(0) + "%"],
                ["Mortgage / income", (view.selectedLatest.mortgage_burden * 100).toFixed(0) + "%"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-black/[0.03] p-2 dark:bg-white/[0.04]">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}
