import { useMemo, useState } from "react";
import Chart from "../components/Chart";
import DistrictMap from "../components/DistrictMap";
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

export default function Districts() {
  const { data, error, loading } = useDistrictData();
  const { data: geo, loading: geoLoading } = useDistricts();
  const selected = useFilters((state) => state.selectedDistrict);
  const selectDistrict = useFilters((state) => state.selectDistrict);
  const [metric, setMetric] = useState<Metric>("sale_psf");
  const [quarter, setQuarter] = useState<string | null>(null);
  const [scatterMode, setScatterMode] = useState<"age" | "mtr">("age");
  const [heatmapMode, setHeatmapMode] = useState<"quarter" | "class">("quarter");

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

    const startQuarter = heatQuarters[0] ?? quarters[0];
    const rankRows = (q: string) =>
      orderedCodes
        .map((code) => ({ code, value: rowAt(code, q)?.sale_psf ?? null }))
        .filter((row): row is { code: string; value: number } => row.value !== null)
        .sort((a, b) => b.value - a.value)
        .map((row, index) => ({ code: row.code, rank: index + 1 }));
    const startRanks = new Map(rankRows(startQuarter).map((row) => [row.code, row.rank]));
    const endRanks = new Map(rankRows(latestQuarter).map((row) => [row.code, row.rank]));

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
      heatData,
      heatMin,
      heatMax,
      startQuarter,
      latestLabel: latestQuarter,
      startRanks,
      endRanks,
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
    grid: { left: 92, right: 12, top: 12, bottom: 58 },
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
      axisLabel: { color: "#64748b", fontSize: 9 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    visualMap: {
      min: Math.floor(heatMin / 1000) * 1000,
      max: Math.ceil(heatMax / 1000) * 1000,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemWidth: 10,
      itemHeight: 80,
      textStyle: { color: "#64748b", fontSize: 9 },
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
    grid: { left: 40, right: 110, top: 20, bottom: 30 },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 11 },
    },
    xAxis: {
      type: "category",
      data: [view.startQuarter, view.latestQuarter],
      boundaryGap: false,
      axisLabel: { color: "#64748b", fontSize: 10 },
      axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      inverse: true,
      min: 1,
      max: 18,
      interval: 3,
      axisLabel: { color: "#64748b", fontSize: 9, formatter: "#{value}" },
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
    },
    series: view.orderedCodes.map((code) => {
      const active = selected === code;
      return {
        type: "line",
        name: view.districtNames.get(code),
        data: [view.startRanks.get(code) ?? null, view.endRanks.get(code) ?? null],
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
  const classRows = selected
    ? data.classes.filter((row) => row.district_code === selected && row.tenure === "sale")
    : [];
  const affordability = selected
    ? data.affordability.filter((row) => row.district_code === selected).sort((a, b) => a.year - b.year)
    : [];

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard
          label="Sale $/ft²"
          value={fmtPsf(selected ? view.selectedRow?.sale_psf : view.aggregate.sale_psf)}
          note={selectedName ?? "median of districts"}
        />
        <KpiCard
          label="Rent $/ft²"
          value={fmtPsf(selected ? view.selectedRow?.rent_psf : view.aggregate.rent_psf)}
          note={selected ? "modelled latest" : "median of districts"}
          accent="amber"
        />
        <KpiCard
          label="Gross yield"
          value={fmtPctPlain(selected ? view.selectedRow?.yield_pct : view.aggregate.yield_pct)}
          note="12 × rent / price"
          accent="blue"
        />
        <KpiCard
          label="Price YoY"
          value={selected ? fmtPct(view.selectedYoy) : "—"}
          note={selected ? "same district" : "select a district"}
          accent="neutral"
        />
        <KpiCard
          label="Estates"
          value={String(selected ? view.selectedRow?.n_estates ?? 0 : view.aggregate.n_estates)}
          note="in latest quarter"
          accent="neutral"
        />
        <KpiCard
          label="Transactions"
          value={(selected ? view.selectedRow?.volume ?? 0 : view.aggregate.volume).toLocaleString()}
          note="latest quarter"
          accent="neutral"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title={selectedName ? `${selectedName} · ${selectedRegion}` : "18 districts"}
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
          title={isClassHeatmap ? "District × class heatmap" : "District × quarter heatmap"}
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
            height={420}
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
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="Rank slope, 2018 → latest"
          description="Rank by sale $/ft² (1 = most expensive). Lines are coloured by region; the selected district is highlighted."
        >
          <Chart option={slopeOption} height={380} />
        </SectionCard>

        <SectionCard
          title={scatterMode === "age" ? "Building age and price" : "Accessibility and price"}
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
            <Chart option={scatterOption} height={380} />
          ) : (
            <div className="grid h-80 place-items-center text-sm text-[var(--text-muted)]">
              No estates with both a price and an MTR walk time yet.
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title={selectedName ? `Profile · ${selectedName}` : "District profile"}
          description={
            selected
              ? `Coverage: ${view.selectedRow?.n_estates ?? 0} estates and ${view.selectedRow?.volume ?? 0} transactions in the latest quarter.`
              : "Select a district on the map or heatmap to open its profile."
          }
        >
          {selected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Sale $/ft²", fmtPsf(view.selectedRow?.sale_psf)],
                  ["Rent $/ft²", fmtPsf(view.selectedRow?.rent_psf)],
                  ["Yield", fmtPctPlain(view.selectedRow?.yield_pct)],
                  ["Price YoY", fmtPct(view.selectedYoy)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-black/[0.03] p-2 dark:bg-white/[0.04]">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Top estates by volume
                </h3>
                <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
                  {topEstates.map((estate) => (
                    <li key={estate.estate_id} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="truncate">{estate.name}</span>
                      <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                        {fmtPsf(estate.price_psf)} · {estate.volume}
                      </span>
                    </li>
                  ))}
                  {!topEstates.length ? (
                    <li className="py-2 text-[var(--text-muted)]">No estate detail for this district.</li>
                  ) : null}
                </ul>
              </div>

              {classRows.length ? (
                <div>
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

              {affordability.length ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Affordability, latest income year
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Price-to-income {affordability[affordability.length - 1].pti.toFixed(1)}× · rent-to-income{" "}
                    {affordability[affordability.length - 1].rti.toFixed(2)} · rank{" "}
                    #{affordability[affordability.length - 1].rank} of 18
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid h-56 place-items-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)]">
              Click a district on the map or heatmap.
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Coverage note"
          description="District estimates are built bottom-up from estate transaction series. Sparse districts are suppressed rather than shown as zero."
        >
          <ul className="space-y-2 text-sm text-[var(--text-muted)]">
            <li>Estates in panel: {data.coverage.estates.toLocaleString()}</li>
            <li>Listings parsed: {data.coverage.listings.toLocaleString()}</li>
            <li>Districts with panel data: {data.coverage.districts_with_panel}/18</li>
            <li>Latest quarter: {quarterLabel(data.as_of ?? "—")}</li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
            Rent history is modelled from the RVD rental index; the latest quarter uses 90-day estate
            rental statistics. Cells with fewer than three estates are provisional.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
