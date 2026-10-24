import { useMemo, useState } from "react";
import Chart from "../components/Chart";
import DistrictMap from "../components/DistrictMap";
import EstateBoxPlot from "../components/EstateBoxPlot";
import { useDataInfo } from "../components/DataInfo";
import { CARD_INFO } from "../data/cardInfo";
import {
  ErrorCard,
  KpiCard,
  LoadingCard,
  SectionCard,
  SegmentedControl,
} from "../components/Cards";
import PageHeader from "../components/PageHeader";
import { useDistricts } from "../data/useMarket";
import { useDistrictData } from "../data/useDistrictData";
import type { DistrictPanelRow } from "../data/types";
import { fmtPct, fmtPctPlain, fmtPsf } from "../lib/format";
import { median } from "../lib/stats";
import { useFilters } from "../state/filters";

type Metric = "sale_psf" | "rent_psf" | "yield_pct" | "sale_yoy";

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

function quarterLabel(quarter: string): string {
  return quarter.replace("-Q", " Q");
}

function metricValue(row: DistrictPanelRow | undefined, previous: DistrictPanelRow | undefined, metric: Metric): number | null {
  if (!row) return null;
  if (metric === "sale_psf") return row.sale_psf;
  if (metric === "rent_psf") return row.rent_psf;
  if (metric === "yield_pct") return row.yield_pct;
  if (row.sale_psf === null || !previous?.sale_psf) return null;
  return ((row.sale_psf - previous.sale_psf) / previous.sale_psf) * 100;
}

function metricFormat(metric: Metric) {
  if (metric === "yield_pct") return (value: number | null) => fmtPctPlain(value, 1);
  if (metric === "sale_yoy") return (value: number | null) => fmtPct(value, 1);
  return (value: number | null) => fmtPsf(value);
}

/** KPI cards already label the unit as $/ft², so drop the suffix to fit seven columns. */
function fmtKpiPsf(value: number | null | undefined): string {
  const formatted = fmtPsf(value);
  return formatted === "—" ? formatted : formatted.replace("/ft²", "");
}

export default function Districts() {
  const { data, error, loading } = useDistrictData();
  const { data: geo, loading: geoLoading } = useDistricts();
  const selected = useFilters((state) => state.selectedDistrict);
  const selectDistrict = useFilters((state) => state.selectDistrict);
  const [metric, setMetric] = useState<Metric>("sale_psf");
  const [quarter, setQuarter] = useState<string | null>(null);
  const [scatterMode, setScatterMode] = useState<"age" | "mtr">("age");
  const [heatmapMode, setHeatmapMode] = useState<"quarter" | "class">("quarter");
  const { open } = useDataInfo();

  const view = useMemo(() => {
    if (!data) return null;
    const panel = data.panel;
    if (!panel.length) return null;
    const quarters = [...new Set(panel.map((row) => row.quarter))].sort();
    const latestQuarter = data.as_of ?? quarters[quarters.length - 1];
    const activeQuarter = quarter ?? latestQuarter;
    const panelIndex = new Map(panel.map((row) => [`${row.district_code}|${row.quarter}`, row]));
    const districtNames = new Map(data.districts.map((district) => [district.district_code, district.name_en]));
    const districtRegions = new Map(data.districts.map((district) => [district.district_code, district.region]));
    const orderedCodes = data.districts
      .slice()
      .sort((a, b) => `${a.region}-${a.name_en}`.localeCompare(`${b.region}-${b.name_en}`))
      .map((district) => district.district_code);

    const rowAt = (code: string, q: string) => panelIndex.get(`${code}|${q}`);
    const values: Record<string, number | null> = {};
    orderedCodes.forEach((code) => {
      const current = rowAt(code, activeQuarter);
      const previous = rowAt(code, shiftQuarter(activeQuarter, -4));
      values[code] = metricValue(current, previous, metric);
    });

    const latestRows = orderedCodes
      .map((code) => rowAt(code, latestQuarter))
      .filter((row): row is DistrictPanelRow => Boolean(row));
    const aggregate = {
      sale_psf: median(latestRows.map((row) => row.sale_psf ?? 0).filter(Boolean)),
      rent_psf: median(latestRows.map((row) => row.rent_psf ?? 0).filter(Boolean)),
      yield_pct: median(latestRows.map((row) => row.yield_pct ?? 0).filter(Boolean)),
      n_estates: latestRows.reduce((sum, row) => sum + row.n_estates, 0),
      volume: latestRows.reduce((sum, row) => sum + row.volume, 0),
    };

    const selectedRow = selected ? rowAt(selected, latestQuarter) : null;
    const selectedPrevious = selected ? rowAt(selected, shiftQuarter(latestQuarter, -4)) : null;
    const selectedYoy =
      selectedRow?.sale_psf && selectedPrevious?.sale_psf
        ? ((selectedRow.sale_psf - selectedPrevious.sale_psf) / selectedPrevious.sale_psf) * 100
        : null;
    const selectedListings = selected ? (data.listing_counts?.[selected] ?? null) : null;
    const hkYoyValues = orderedCodes
      .map((code) =>
        metricValue(
          rowAt(code, latestQuarter),
          rowAt(code, shiftQuarter(latestQuarter, -4)),
          "sale_yoy",
        ),
      )
      .filter((value): value is number => value !== null);
    const hkYoy = hkYoyValues.length ? median(hkYoyValues) : null;

    const heatQuarters = quarters.filter((q) => q >= "2018-Q1");
    const heatData: Array<[number, number, number]> = [];
    heatQuarters.forEach((q, xIndex) => {
      orderedCodes.forEach((code, yIndex) => {
        const value = rowAt(code, q)?.sale_psf;
        if (value !== null && value !== undefined) heatData.push([xIndex, yIndex, value]);
      });
    });
    const heatValues = heatData.map((item) => item[2]);
    const heatMin = heatValues.length ? Math.min(...heatValues) : 0;
    const heatMax = heatValues.length ? Math.max(...heatValues) : 1;

    const rankRows = (q: string) =>
      orderedCodes
        .map((code) => ({ code, value: rowAt(code, q)?.sale_psf ?? null }))
        .filter((row): row is { code: string; value: number } => row.value !== null)
        .sort((a, b) => b.value - a.value)
        .map((row, index) => ({ code: row.code, rank: index + 1 }));
    const slopeQuarters = heatQuarters.length ? heatQuarters : [latestQuarter];
    const ranksByQuarter = new Map(
      slopeQuarters.map((q) => [
        q,
        new Map(rankRows(q).map((row) => [row.code, row.rank] as const)),
      ]),
    );
    const finalRanks = ranksByQuarter.get(slopeQuarters[slopeQuarters.length - 1]) ?? new Map<string, number>();
    const finalOrder = [...finalRanks.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([code]) => code);

    return {
      panel,
      quarters,
      heatQuarters,
      latestQuarter,
      activeQuarter,
      orderedCodes,
      districtNames,
      districtRegions,
      values,
      aggregate,
      selectedRow,
      selectedYoy,
      selectedListings,
      hkYoy,
      heatData,
      heatMin,
      heatMax,
      slopeQuarters,
      ranksByQuarter,
      finalOrder,
      latestLabel: latestQuarter,
    };
  }, [data, metric, quarter, selected]);

  if (loading || geoLoading) return <LoadingCard height={420} message="Loading district panel…" />;
  if (error || !data || !geo || !view) {
    return <ErrorCard message={error ?? "No district data. Run the Squarefoot crawl and district panel first."} />;
  }

  const selectedName = selected ? view.districtNames.get(selected) : null;
  const selectedRegion = selected ? view.districtRegions.get(selected) : null;
  const CLASS_CODES = ["A", "B", "C", "D", "E"];
  const classHeatData: Array<[number, number, number]> = [];
  view.orderedCodes.forEach((code, yIndex) => {
    CLASS_CODES.forEach((cls, xIndex) => {
      const row = data.classes.find(
        (item) => item.district_code === code && item.tenure === "sale" && item.property_class === cls,
      );
      if (row) classHeatData.push([xIndex, yIndex, row.psf]);
    });
  });
  const classHeatValues = classHeatData.map((item) => item[2]);
  const isClassHeatmap = heatmapMode === "class";
  const heatXLabels = isClassHeatmap
    ? CLASS_CODES.map((code) => `Class ${code}`)
    : view.heatQuarters.map(quarterLabel);
  const heatData = isClassHeatmap ? classHeatData : view.heatData;
  const heatMin = isClassHeatmap
    ? classHeatValues.length
      ? Math.min(...classHeatValues)
      : 0
    : view.heatMin;
  const heatMax = isClassHeatmap
    ? classHeatValues.length
      ? Math.max(...classHeatValues)
      : 1
    : view.heatMax;
  const selectedEstates = data.estates
    .filter((estate) => (selected ? estate.district_code === selected : true))
    .filter((estate) => estate.price_psf !== null);
  const scatterData = selectedEstates
    .filter((estate) =>
      scatterMode === "age" ? estate.building_age_years !== null : estate.mtr_walk_minutes !== null,
    )
    .map((estate) => ({
      value: [
        scatterMode === "age" ? (estate.building_age_years as number) : (estate.mtr_walk_minutes as number),
        estate.price_psf as number,
        estate.volume,
        estate.name,
        estate.district_code,
      ],
      mtr: estate.mtr_walk_minutes,
      age: estate.building_age_years,
      itemStyle: {
        color: REGION_COLORS[view.districtRegions.get(estate.district_code) ?? ""] ?? "#0f766e",
        opacity: selected ? 0.9 : 0.65,
      },
    }));

  const heatmapOption = {
    animation: false,
    grid: { left: 92, right: 60, top: 2, bottom: 22 },
    tooltip: {
      position: "top",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 11 },
      formatter: (params: { value: [number, number, number] }) => {
        const [x, y, value] = params.value;
        const code = view.orderedCodes[y];
        const classRow = isClassHeatmap
          ? data.classes.find(
              (row) =>
                row.district_code === code &&
                row.tenure === "sale" &&
                row.property_class === CLASS_CODES[x],
            )
          : null;
        return `${view.districtNames.get(code)}<br/>${heatXLabels[x]}: ${fmtPsf(value)}${
          classRow ? `<br/>n = ${classRow.n} listings` : ""
        }`;
      },
    },
    xAxis: {
      type: "category",
      data: heatXLabels,
      splitArea: { show: false },
      axisLabel: {
        color: "#64748b",
        fontSize: 9,
        interval: isClassHeatmap ? 0 : 3,
        rotate: 0,
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: view.orderedCodes.map((code) => view.districtNames.get(code)),
      axisLabel: { color: "#64748b", fontSize: 7, interval: 0 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    visualMap: {
      min: Math.floor(heatMin / 1000) * 1000,
      max: Math.ceil(heatMax / 1000) * 1000,
      calculable: false,
      orient: "vertical",
      right: 6,
      top: "middle",
      itemWidth: 8,
      itemHeight: 88,
      text: [`${Math.ceil(heatMax / 1000)}k`, `${Math.floor(heatMin / 1000)}k`],
      textGap: 4,
      textStyle: { color: "#64748b", fontSize: 8 },
      inRange: { color: ["#f0fdfa", "#99f6e4", "#2dd4bf", "#0f766e", "#134e4a"] },
      formatter: (value: number) => `${Math.round(value / 1000)}k`,
    },
    series: [
      {
        type: "heatmap",
        data: heatData,
        itemStyle: { borderColor: "rgba(255,255,255,0.35)", borderWidth: 0.5 },
        emphasis: { itemStyle: { borderColor: "#0f172a", borderWidth: 1 } },
      },
    ],
  };

  const slopeOption = {
    animationDuration: 400,
    grid: { left: 42, right: 126, top: 20, bottom: 30 },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 11 },
      formatter: (params: { seriesName?: string; value?: number | null; dataIndex: number }) => {
        if (params.value === null || params.value === undefined) return "";
        const quarter = view.slopeQuarters[params.dataIndex];
        return `<strong>${params.seriesName}</strong><br/>${quarterLabel(quarter)} · rank #${params.value}`;
      },
    },
    xAxis: {
      type: "category",
      data: view.slopeQuarters.map(quarterLabel),
      boundaryGap: false,
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        interval: (index: number) => index % 4 === 0,
        hideOverlap: true,
        formatter: (value: string) => value.split(" ")[0],
      },
      axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: "value",
        inverse: true,
        min: 1,
        max: 18,
        interval: 3,
        axisLabel: { color: "#64748b", fontSize: 9, formatter: "#{value}" },
        splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
      },
      {
        type: "value",
        position: "right",
        inverse: true,
        min: 1,
        max: 18,
        interval: 1,
        axisLine: { show: true, lineStyle: { color: "rgba(100,116,139,0.25)" } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          margin: 8,
          formatter: (value: number) => {
            const code = view.finalOrder[value - 1];
            const name = code ? view.districtNames.get(code) : "";
            if (!name) return "";
            return code === selected ? `{active|${name}}` : `{normal|${name}}`;
          },
          rich: {
            active: { color: "#0f172a", fontSize: 9, fontWeight: 600 },
            normal: { color: "#64748b", fontSize: 9 },
          },
        },
      },
    ],
    series: view.orderedCodes.map((code) => {
      const active = selected === code;
      return {
        type: "line",
        name: view.districtNames.get(code),
        data: view.slopeQuarters.map((quarter) => view.ranksByQuarter.get(quarter)?.get(code) ?? null),
        showSymbol: active,
        symbolSize: active ? 6 : 3,
        z: active ? 3 : 2,
        lineStyle: {
          width: active ? 2.5 : 1,
          opacity: active ? 1 : selected ? 0.15 : 0.35,
          color: REGION_COLORS[view.districtRegions.get(code) ?? ""] ?? "#0f766e",
        },
        itemStyle: { color: REGION_COLORS[view.districtRegions.get(code) ?? ""] ?? "#0f766e" },
        emphasis: { focus: "series" },
      };
    }),
  };

  const scatterOption = {
    animationDuration: 300,
    grid: { left: 56, right: 24, top: 24, bottom: 48 },
    tooltip: {
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 11 },
      formatter: (params: {
        value: [number, number, number, string, string];
        data: { mtr: number | null; age: number | null };
      }) =>
        `<strong>${params.value[3]}</strong><br/>${
          scatterMode === "age" ? "Building age" : "MTR walk"
        }: ${params.value[0]} ${scatterMode === "age" ? "years" : "min"}<br/>${
          scatterMode === "age" && params.data.mtr !== null ? `MTR walk: ${params.data.mtr} min<br/>` : ""
        }${fmtPsf(params.value[1])}<br/>Volume: ${params.value[2]}`,
    },
    xAxis: {
      type: "value",
      name: scatterMode === "age" ? "Building age (years)" : "Walk to MTR (minutes)",
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: { color: "#64748b", fontSize: 10 },
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
      axisLabel: { color: "#64748b", fontSize: 10 },
    },
    yAxis: {
      type: "value",
      name: "Sale $/ft²",
      nameLocation: "middle",
      nameGap: 40,
      nameTextStyle: { color: "#64748b", fontSize: 10 },
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
      axisLabel: { color: "#64748b", fontSize: 10 },
    },
    series: [
      {
        type: "scatter",
        data: scatterData,
        symbolSize: (value: number[]) => Math.max(5, Math.min(26, Math.sqrt(value[2] || 1) * 1.6)),
        emphasis: { scale: 1.4 },
      },
    ],
  };

  const topEstates = selectedEstates
    .slice()
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6);
  const psfValues = topEstates
    .map((estate) => estate.price_psf)
    .filter((value): value is number => value !== null);
  const psfMin = psfValues.length ? Math.min(...psfValues) : 0;
  const psfMax = psfValues.length ? Math.max(...psfValues) : 1;
  const estateColor = (psf: number | null) => {
    const t = psf === null || psfMax === psfMin ? 0.5 : (psf - psfMin) / (psfMax - psfMin);
    return `hsl(174 55% ${82 - t * 47}%)`;
  };
  const estateBarOption = {
    animationDuration: 300,
    grid: { left: 38, right: 8, top: 16, bottom: 48 },
    tooltip: {
      trigger: "item",
      confine: true,
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 11 },
      formatter: (params: { dataIndex: number }) => {
        const estate = topEstates[params.dataIndex];
        if (!estate) return "";
        return `<strong>${estate.name}</strong><br/>${view.districtNames.get(estate.district_code) ?? ""}<br/>Volume: ${estate.volume}<br/>Sale $/ft²: ${fmtPsf(estate.price_psf)}`;
      },
    },
    xAxis: {
      type: "category",
      data: topEstates.map((estate) => estate.name),
      axisLabel: {
        color: "#64748b",
        fontSize: 8,
        interval: 0,
        rotate: 24,
        formatter: (value: string) => (value.length > 16 ? `${value.slice(0, 15)}…` : value),
      },
      axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      name: "Transactions",
      nameTextStyle: { color: "#64748b", fontSize: 8 },
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
      axisLabel: { color: "#64748b", fontSize: 8 },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 28,
        data: topEstates.map((estate) => ({
          value: estate.volume,
          itemStyle: { color: estateColor(estate.price_psf), borderRadius: [3, 3, 0, 0] },
        })),
        emphasis: { disabled: true },
      },
    ],
  };

  const regionByCode = new Map(data.districts.map((district) => [district.district_code, district.region]));
  const regionNames = ["HK Island", "Kowloon", "New Territories"];
  const regionQuarters = [...new Set(data.panel.filter((row) => row.quarter >= "2018-Q1").map((row) => row.quarter))].sort();
  const regionSeries = regionNames.map((region) =>
    regionQuarters.map((quarter) => {
      const rows = data.panel.filter(
        (row) =>
          row.quarter === quarter &&
          row.sale_psf !== null &&
          regionByCode.get(row.district_code) === region,
      );
      const volume = rows.reduce((sum, row) => sum + row.volume, 0);
      return volume
        ? rows.reduce((sum, row) => sum + (row.sale_psf ?? 0) * row.volume, 0) / volume
        : null;
    }),
  );
  const regionTrendOption = {
    animationDuration: 300,
    grid: { left: 42, right: 10, top: 24, bottom: 28 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 11 },
      valueFormatter: (value: number) => fmtPsf(value),
    },
    legend: {
      top: 0,
      right: 0,
      icon: "roundRect",
      itemWidth: 9,
      itemHeight: 3,
      textStyle: { color: "#64748b", fontSize: 8 },
    },
    xAxis: {
      type: "category",
      data: regionQuarters.map(quarterLabel),
      boundaryGap: false,
      axisLabel: { color: "#64748b", fontSize: 8, interval: 7 },
      axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
      axisLabel: {
        color: "#64748b",
        fontSize: 8,
        formatter: (value: number) => `${Math.round(value / 1000)}k`,
      },
    },
    series: regionNames.map((region, index) => ({
      name: region,
      type: "line",
      data: regionSeries[index],
      showSymbol: false,
      lineStyle: { width: 2, color: REGION_COLORS[region] ?? "#0f766e" },
      itemStyle: { color: REGION_COLORS[region] ?? "#0f766e" },
    })),
  };
  const classRows = data.classes.filter(
    (row) => row.district_code === (selected ?? "HK") && row.tenure === "sale",
  );
  const affordability = selected
    ? data.affordability.filter((row) => row.district_code === selected).sort((a, b) => a.year - b.year)
    : [];
  const latestIncomeYear = data.affordability.length
    ? Math.max(...data.affordability.map((row) => row.year))
    : null;
  const hkAffordability =
    latestIncomeYear === null
      ? []
      : data.affordability.filter((row) => row.year === latestIncomeYear);

  const profileSale = selected ? view.selectedRow?.sale_psf : view.aggregate.sale_psf;
  const profileRent = selected ? view.selectedRow?.rent_psf : view.aggregate.rent_psf;
  const profileYield = selected ? view.selectedRow?.yield_pct : view.aggregate.yield_pct;
  const profileYoy = selected ? view.selectedYoy : view.hkYoy;
  const profileEstates = selected ? view.selectedRow?.n_estates ?? 0 : view.aggregate.n_estates;
  const profileVolume = selected ? view.selectedRow?.volume ?? 0 : view.aggregate.volume;

  return (
    <div className="desktop-dashboard space-y-6">
      <PageHeader
        eyebrow="Space"
        title="District Explorer"
        question="Where is housing most expensive, and are the gaps between districts widening?"
      >
        <SegmentedControl
          value={metric}
          options={[
            { value: "sale_psf", label: "Sale $/ft²" },
            { value: "rent_psf", label: "Rent $/ft²" },
            { value: "yield_pct", label: "Yield" },
            { value: "sale_yoy", label: "Price YoY" },
          ]}
          onChange={setMetric}
        />
        <select
          value={view.activeQuarter}
          onChange={(event) => setQuarter(event.target.value)}
          className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs"
          aria-label="Quarter"
        >
          {view.quarters
            .filter((q) => q >= "2018-Q1")
            .slice()
            .reverse()
            .map((q) => (
              <option key={q} value={q}>
                {quarterLabel(q)}
              </option>
            ))}
        </select>
      </PageHeader>

      <div className="kpi-grid grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard
          label="Sale $/ft²"
          info={CARD_INFO.districtPriceKpis}
          value={fmtKpiPsf(selected ? view.selectedRow?.sale_psf : view.aggregate.sale_psf)}
          note={selectedName ?? "median of districts"}
        />
        <KpiCard
          label="Rent $/ft²"
          info={CARD_INFO.districtPriceKpis}
          value={fmtKpiPsf(selected ? view.selectedRow?.rent_psf : view.aggregate.rent_psf)}
          note={selected ? "modelled latest" : "median of districts"}
          accent="amber"
        />
        <KpiCard
          label="Gross yield"
          info={CARD_INFO.districtPriceKpis}
          value={fmtPctPlain(selected ? view.selectedRow?.yield_pct : view.aggregate.yield_pct)}
          note="12 × rent / price"
          accent="blue"
        />
        <KpiCard
          label="Price YoY"
          info={CARD_INFO.districtPriceKpis}
          value={fmtPct(selected ? view.selectedYoy : view.hkYoy)}
          note={selected ? "same district" : "median of districts"}
          accent="neutral"
        />
        <KpiCard
          label="Listings"
          info={CARD_INFO.districtCountKpis}
          value={
            selected
              ? (view.selectedListings?.total.toLocaleString() ?? "—")
              : data.coverage.listings.toLocaleString()
          }
          note={
            selected && view.selectedListings
              ? `${view.selectedListings.sale.toLocaleString()} sale · ${view.selectedListings.rent.toLocaleString()} rent`
              : "current · sale + rent"
          }
          accent="neutral"
        />
        <KpiCard
          label="Estates"
          info={CARD_INFO.districtCountKpis}
          value={String(selected ? view.selectedRow?.n_estates ?? 0 : view.aggregate.n_estates)}
          note="in latest quarter"
          accent="neutral"
        />
        <KpiCard
          label="Transactions"
          info={CARD_INFO.districtCountKpis}
          value={(selected ? view.selectedRow?.volume ?? 0 : view.aggregate.volume).toLocaleString()}
          note="latest quarter"
          accent="neutral"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title={selectedName ? `${selectedName} · ${selectedRegion}` : "18 districts"}
          info={CARD_INFO.districtMap}
          description={`${metric === "sale_psf" ? "Sale price" : metric === "rent_psf" ? "Rent" : metric === "yield_pct" ? "Gross yield" : "Year-on-year price change"} in ${quarterLabel(view.activeQuarter)}. Click a district to cross-filter.`}
          action={
            selected ? (
              <button
                type="button"
                onClick={() => selectDistrict(selected)}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Clear selection ✕
              </button>
            ) : null
          }
        >
          <DistrictMap
            geojson={geo}
            values={view.values}
            selected={selected}
            onSelect={selectDistrict}
            diverging={metric === "sale_yoy"}
            formatValue={metricFormat(metric)}
            height={220}
            metricLabel={
              metric === "sale_psf"
                ? "Sale $/ft²"
                : metric === "rent_psf"
                  ? "Rent $/ft²"
                  : metric === "yield_pct"
                    ? "Gross yield"
                    : "Price YoY"
            }
          />
        </SectionCard>

        <SectionCard
          title={selectedName ? `Profile · ${selectedName}` : "Hong Kong profile"}
          info={CARD_INFO.districtProfile}
          description={`Coverage: ${profileEstates.toLocaleString()} estates and ${profileVolume.toLocaleString()} transactions in the latest quarter.`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Sale $/ft²", fmtPsf(profileSale)],
                ["Rent $/ft²", fmtPsf(profileRent)],
                ["Yield", fmtPctPlain(profileYield)],
                ["Price YoY", fmtPct(profileYoy)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-black/[0.03] p-2 dark:bg-white/[0.04]">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            {!selected ? (
              <p className="short-hide text-[10px] leading-relaxed text-[var(--text-muted)]">
                Headline Hong Kong figures are medians of the 18 district estimates; yields are gross.
              </p>
            ) : null}

            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                <button
                  type="button"
                  onClick={() => open(CARD_INFO.estateBox, <EstateBoxPlot estates={topEstates} />)}
                  aria-label="Open data note: Top estates by volume"
                  aria-haspopup="dialog"
                  className="group inline-flex items-center gap-1 rounded-sm hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 dark:hover:text-teal-300"
                >
                  <span className="underline decoration-transparent underline-offset-2 transition group-hover:decoration-current">
                    Top estates by volume
                  </span>
                  <span
                    aria-hidden="true"
                    className="grid h-3.5 w-3.5 place-items-center rounded-full border border-current text-[8px] font-semibold leading-none opacity-50 transition group-hover:opacity-100"
                  >
                    i
                  </span>
                </button>
              </h3>
              {topEstates.length ? (
                <Chart option={estateBarOption} height="var(--estate-chart-h, 160px)" />
              ) : (
                <div className="py-2 text-xs text-[var(--text-muted)]">No estate detail yet.</div>
              )}
              <p className="short-hide text-[9px] text-[var(--text-muted)]">
                Bar height = transactions · colour = Sale $/ft² · hover for details
              </p>
            </div>

            {classRows.length ? (
              <div className="profile-classes">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Sale $/ft² by class
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {classRows.map((row) => (
                    <span key={row.property_class} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs">
                      Class {row.property_class}: {fmtPsf(row.psf)}{" "}
                      <span className="text-[var(--text-muted)]">(n={row.n})</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {selected && affordability.length ? (
              <div className="short-hide">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Affordability, latest income year
                </h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Price-to-income {affordability[affordability.length - 1].pti.toFixed(1)}× · rent-to-income{" "}
                  {affordability[affordability.length - 1].rti.toFixed(2)} · rank{" "}
                  #{affordability[affordability.length - 1].rank} of 18
                </p>
              </div>
            ) : !selected && hkAffordability.length ? (
              <div className="short-hide">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Affordability, latest income year
                </h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Price-to-income {median(hkAffordability.map((row) => row.pti)).toFixed(1)}× · rent-to-income{" "}
                  {median(hkAffordability.map((row) => row.rti)).toFixed(2)} · median of 18 districts
                </p>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[5fr_4fr_3fr]">
        <SectionCard
          title={isClassHeatmap ? "District × class heatmap" : "District × quarter heatmap"}
          info={CARD_INFO.districtHeatmap}
          description={
            isClassHeatmap
              ? "Median sale $/ft² of current listings by RVD class (A–E). Click a cell to select the district."
              : "Sale $/ft² by district and quarter, 2018 onwards. Click a cell to select the district."
          }
          action={
            <SegmentedControl
              value={heatmapMode}
              options={[
                { value: "quarter", label: "Time" },
                { value: "class", label: "Class" },
              ]}
              onChange={setHeatmapMode}
            />
          }
        >
          <Chart
            option={heatmapOption}
            height="var(--heatmap-h, 180px)"
            onEvents={{
              click: (params) => {
                const value = (params as { value?: [number, number, number] }).value;
                if (!value) return;
                const code = view.orderedCodes[value[1]];
                if (code) selectDistrict(code);
              },
            }}
          />
        </SectionCard>

        <SectionCard
          title={scatterMode === "age" ? "Building age and price" : "Accessibility and price"}
          info={CARD_INFO.districtScatter}
          description={
            scatterMode === "age"
              ? "Estate-level sale $/ft² against building age; bubble size is transaction volume. MTR walk time is shown in the tooltip."
              : "Estate-level sale $/ft² against walking time to the nearest MTR station; bubble size is transaction volume."
          }
          action={
            <SegmentedControl
              value={scatterMode}
              options={[
                { value: "age", label: "Age" },
                { value: "mtr", label: "MTR" },
              ]}
              onChange={setScatterMode}
            />
          }
        >
          {scatterData.length ? (
            <Chart option={scatterOption} height={180} />
          ) : (
            <div className="grid h-[190px] place-items-center text-sm text-[var(--text-muted)]">
              No estates with both a price and an MTR walk time yet.
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Sale $/ft² by region"
          info={CARD_INFO.districtRegion}
          description="Volume-weighted district average, 2018 Q1–2026 Q4."
        >
          <Chart option={regionTrendOption} height={180} />
        </SectionCard>
      </div>

      <SectionCard
        className="coverage-card"
        title="Coverage note"
        description="District estimates are built bottom-up from estate transaction series. Sparse districts are suppressed rather than shown as zero."
      >
        <ul className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-[var(--text-muted)]">
          <li>Estates in panel: {data.coverage.estates.toLocaleString()}</li>
          <li>Listings parsed: {data.coverage.listings.toLocaleString()}</li>
          {data.coverage.listings_with_district !== undefined ? (
            <li>Listings with a district: {data.coverage.listings_with_district.toLocaleString()}</li>
          ) : null}
          <li>Districts with panel data: {data.coverage.districts_with_panel}/18</li>
          <li>Latest quarter: {quarterLabel(data.as_of ?? "—")}</li>
        </ul>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-[var(--text-muted)]">
          Rent history is modelled from the RVD rental index; the latest quarter uses 90-day estate
          rental statistics. Cells with fewer than three estates are provisional.
        </p>
      </SectionCard>
    </div>
  );
}
