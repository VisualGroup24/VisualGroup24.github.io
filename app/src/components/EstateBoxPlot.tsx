import Chart from "./Chart";
import type { EstateLatest } from "../data/types";
import { useEstateQuartiles } from "../data/useEstateQuartiles";
import { useChartTheme } from "../lib/chartOptions";
import { fmtPsf } from "../lib/format";

function shortName(name: string): string {
  const cleaned = name.replace(/^See office.*$/i, "Unknown").trim();
  return cleaned.length > 15 ? `${cleaned.slice(0, 14)}…` : cleaned;
}

/**
 * Box plot of the latest-quarter most-traded estates in a district. The box is
 * the estate's quarterly average sale $/ft² history: Q1–Q3 box, median line,
 * min–max whiskers.
 */
export default function EstateBoxPlot({ estates }: { estates: EstateLatest[] }) {
  const { data, error } = useEstateQuartiles();
  const theme = useChartTheme();

  if (error) {
    return <div className="panel-state">Estate distributions unavailable.</div>;
  }
  if (!data) {
    return <div className="panel-state">Loading estate distributions…</div>;
  }

  const rows = estates
    .map((estate) => ({ estate, quartile: data[estate.estate_id] }))
    .filter((row) => row.quartile);

  if (!rows.length) {
    return <div className="panel-state">No quarterly history for these estates.</div>;
  }

  const option = {
    animationDuration: 300,
    grid: { left: 2, right: 4, top: 10, bottom: 2, containLabel: true },
    tooltip: {
      formatter: (params: { dataIndex: number }) => {
        const row = rows[params.dataIndex];
        if (!row) return "";
        const q = row.quartile;
        return `<strong>${row.estate.name}</strong><br/>Median ${fmtPsf(q.median)}<br/>Q1–Q3 ${fmtPsf(q.q1)}–${fmtPsf(q.q3)}<br/>Min–max ${fmtPsf(q.min)}–${fmtPsf(q.max)}<br/>${row.estate.volume} transactions this quarter<br/>${q.n} quarters · ${q.period[0]} → ${q.period[1]}`;
      },
    },
    xAxis: {
      type: "category",
      data: rows.map((row) => shortName(row.estate.name)),
      axisLabel: {
        color: theme.axisLabel,
        fontSize: 7.5,
        interval: 0,
        rotate: 18,
        formatter: (value: string) => value,
      },
    },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: {
        color: theme.axisLabel,
        fontSize: 7.5,
        formatter: (value: number) => `HK$${Math.round(value / 1000)}k`,
      },
      splitLine: { lineStyle: { color: theme.splitLine } },
    },
    series: [
      {
        name: "Sale $/ft²",
        type: "boxplot",
        boxWidth: [5, 16],
        data: rows.map((row) => [
          row.quartile.min,
          row.quartile.q1,
          row.quartile.median,
          row.quartile.q3,
          row.quartile.max,
        ]),
        itemStyle: { color: theme.tealFill, borderColor: theme.teal, borderWidth: 1.2 },
        emphasis: { itemStyle: { borderColor: theme.text, borderWidth: 1.8 } },
      },
    ],
  };

  return <Chart option={option} ariaLabel="Box plot of the district's most-traded estates" />;
}
