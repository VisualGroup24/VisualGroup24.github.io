import { useMemo } from "react";
import Chart from "./Chart";
import { usePca } from "../data/usePca";

export default function PcaScreeLoadings() {
  const { data: pca, error } = usePca();

  const options = useMemo(() => {
    if (!pca) return null;
    const components = pca.explained.map((_, index) => `PC${index + 1}`);
    const cumulative: number[] = [];
    pca.explained.reduce((sum, value) => {
      cumulative.push((sum + value) * 100);
      return sum + value;
    }, 0);

    const screeOption = {
      animationDuration: 300,
      grid: { left: 38, right: 36, top: 20, bottom: 28 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15,23,42,0.92)",
        borderWidth: 0,
        textStyle: { color: "#f8fafc", fontSize: 10 },
      },
      xAxis: {
        type: "category",
        data: components,
        axisLabel: { color: "#64748b", fontSize: 8 },
        axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: "Variance",
          nameTextStyle: { color: "#64748b", fontSize: 8 },
          splitLine: { lineStyle: { color: "rgba(100,116,139,0.14)" } },
          axisLabel: { color: "#64748b", fontSize: 8, formatter: "{value}%" },
        },
        {
          type: "value",
          name: "Cumulative",
          max: 100,
          nameTextStyle: { color: "#64748b", fontSize: 8 },
          splitLine: { show: false },
          axisLabel: { color: "#64748b", fontSize: 8, formatter: "{value}%" },
        },
      ],
      series: [
        {
          type: "bar",
          data: pca.explained.map((value) => Number((value * 100).toFixed(1))),
          itemStyle: { color: "rgba(15,118,110,0.7)", borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 22,
        },
        {
          type: "line",
          yAxisIndex: 1,
          data: cumulative.map((value) => Number(value.toFixed(1))),
          showSymbol: true,
          symbolSize: 3,
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
      grid: { left: 86, right: 8, top: 16, bottom: 24 },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.92)",
        borderWidth: 0,
        textStyle: { color: "#f8fafc", fontSize: 10 },
        formatter: (params: { value: [number, number, number] }) => {
          const [x, y, value] = params.value;
          return `${pca.loadings[y].label} · ${components[x]}: ${value.toFixed(2)}`;
        },
      },
      xAxis: {
        type: "category",
        data: components.slice(0, 3),
        axisLabel: { color: "#64748b", fontSize: 8 },
        axisLine: { lineStyle: { color: "rgba(100,116,139,0.25)" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: pca.loadings.map((row) => row.label),
        axisLabel: { color: "#64748b", fontSize: 8 },
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
          label: {
            show: true,
            fontSize: 7,
            formatter: (params: { value: [number, number, number] }) => params.value[2].toFixed(1),
          },
          itemStyle: { borderColor: "rgba(255,255,255,0.4)", borderWidth: 0.5 },
        },
      ],
    };

    return { screeOption, loadingOption };
  }, [pca]);

  if (error) {
    return <p className="mt-2 text-[11px] text-[var(--text-muted)]">PCA data unavailable.</p>;
  }

  if (!pca || !options) {
    return <p className="mt-2 text-[11px] text-[var(--text-muted)]">Loading PCA charts…</p>;
  }

  return (
    <section className="mt-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        PCA detail
      </h3>
      <div className="mt-2 space-y-3">
        <div>
          <p className="mb-1 text-[10px] font-medium text-[var(--text-muted)]">Scree</p>
          <Chart option={options.screeOption} height={160} />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium text-[var(--text-muted)]">Loadings</p>
          <Chart option={options.loadingOption} height={190} />
        </div>
      </div>
    </section>
  );
}
