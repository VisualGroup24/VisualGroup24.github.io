import Chart from "./Chart";
import type { EstateLatest } from "../data/types";
import { useEstateQuartiles } from "../data/useEstateQuartiles";
import { fmtPsf } from "../lib/format";

export default function EstateBoxPlot({ estates }: { estates: EstateLatest[] }) {
  const { data, error } = useEstateQuartiles();

  if (error) {
    return <p className="mt-2 text-[11px] text-[var(--text-muted)]">Estate distributions unavailable.</p>;
  }
  if (!data) {
    return <p className="mt-2 text-[11px] text-[var(--text-muted)]">Loading estate distributions…</p>;
  }

  const rows = estates
    .map((estate) => ({ estate, quartile: data[estate.estate_id] }))
    .filter((row) => row.quartile);

  if (!rows.length) {
    return <p className="mt-2 text-[11px] text-[var(--text-muted)]">No quarterly history for these estates.</p>;
  }

  const option = {
    animationDuration: 300,
    grid: { left: 48, right: 10, top: 24, bottom: 58 },
    tooltip: {
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 10 },
      formatter: (params: { dataIndex: number; value: number[] }) => {
        const row = rows[params.dataIndex];
        if (!row) return "";
        const q = row.quartile;
        return `<strong>${row.estate.name}</strong><br/>Median: ${fmtPsf(q.median)}<br/>Q1–Q3: ${fmtPsf(q.q1)}–${fmtPsf(q.q3)}<br/>Min–max: ${fmtPsf(q.min)}–${fmtPsf(q.max)}<br/>n = ${q.n} quarters`;
      },
    },
    xAxis: {
      type: "category",
      data: rows.map((row) => row.estate.name),
      axisLabel: {
        color: "#64748b",
        fontSize: 8,
        interval: 0,
        rotate: 22,
        formatter: (value: string) => (value.length > 16 ? `${value.slice(0, 15)}…` : value),
      },
      axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      name: "Sale $/ft²",
      nameTextStyle: { color: "#64748b", fontSize: 9 },
      splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
      axisLabel: {
        color: "#64748b",
        fontSize: 8,
        formatter: (value: number) => `${Math.round(value / 1000)}k`,
      },
    },
    series: [
      {
        type: "boxplot",
        boxWidth: [8, 22],
        data: rows.map((row) => [
          row.quartile.min,
          row.quartile.q1,
          row.quartile.median,
          row.quartile.q3,
          row.quartile.max,
        ]),
        itemStyle: { color: "rgba(15,118,110,0.18)", borderColor: "#0f766e", borderWidth: 1.5 },
        emphasis: { itemStyle: { borderColor: "#0f172a", borderWidth: 2 } },
      },
    ],
  };

  return (
    <section className="mt-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        Sale $/ft² distribution
      </h3>
      <Chart option={option} height={240} />
      <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">
        Box = interquartile range (Q1–Q3), centre line = median, whiskers = min–max of each estate’s
        quarterly average sale $/ft² across its full chart history.
      </p>
    </section>
  );
}
