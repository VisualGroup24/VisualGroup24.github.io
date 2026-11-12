import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  BoxplotChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
} from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useTheme } from "../state/theme";
import { CHART_FONT } from "../lib/chartOptions";

echarts.use([
  BarChart,
  BoxplotChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

/**
 * Registered themes give every chart the same axis, legend and tooltip chrome
 * without repeating it in each option builder. Both palettes are colour-safe
 * on the light and dark panels.
 */
const LIGHT_THEME = {
  color: ["#0f766e", "#b45309", "#1d4ed8", "#be123c", "#7c3aed", "#0e7490"],
  backgroundColor: "transparent",
  textStyle: { fontFamily: CHART_FONT, fontSize: 10, color: "#334155" },
  legend: {
    textStyle: { color: "#475569", fontSize: 9, fontFamily: CHART_FONT },
    itemWidth: 10,
    itemHeight: 7,
    itemGap: 8,
  },
  tooltip: {
    backgroundColor: "rgba(15,23,42,0.94)",
    borderWidth: 0,
    textStyle: { color: "#f8fafc", fontSize: 10, fontFamily: CHART_FONT },
  },
  categoryAxis: {
    axisLabel: { color: "#64748b", fontSize: 8.5 },
    axisLine: { lineStyle: { color: "rgba(100,116,139,0.35)" } },
    axisTick: { show: false },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLabel: { color: "#64748b", fontSize: 8.5 },
    axisLine: { show: false },
    splitLine: { lineStyle: { color: "rgba(100,116,139,0.16)" } },
  },
};

const DARK_THEME = {
  color: ["#2dd4bf", "#fbbf24", "#60a5fa", "#fb7185", "#a78bfa", "#34d399"],
  backgroundColor: "transparent",
  textStyle: { fontFamily: CHART_FONT, fontSize: 10, color: "#cbd5e1" },
  legend: {
    textStyle: { color: "#94a3b8", fontSize: 9, fontFamily: CHART_FONT },
    itemWidth: 10,
    itemHeight: 7,
    itemGap: 8,
  },
  tooltip: {
    backgroundColor: "rgba(2,6,23,0.95)",
    borderWidth: 0,
    textStyle: { color: "#f1f5f9", fontSize: 10, fontFamily: CHART_FONT },
  },
  categoryAxis: {
    axisLabel: { color: "#94a3b8", fontSize: 8.5 },
    axisLine: { lineStyle: { color: "rgba(148,163,184,0.35)" } },
    axisTick: { show: false },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLabel: { color: "#94a3b8", fontSize: 8.5 },
    axisLine: { show: false },
    splitLine: { lineStyle: { color: "rgba(148,163,184,0.16)" } },
  },
};

echarts.registerTheme("hka-light", LIGHT_THEME);
echarts.registerTheme("hka-dark", DARK_THEME);

type ChartProps = {
  option: Record<string, unknown>;
  /** Use "100%" (the default) inside a panel body; numbers for fixed blocks. */
  height?: number | string;
  className?: string;
  ariaLabel?: string;
  onEvents?: Record<string, (params: unknown) => void>;
};

export default function Chart({
  option,
  height = "100%",
  className,
  ariaLabel,
  onEvents,
}: ChartProps) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const dark = useTheme((state) => state.mode === "dark");

  useEffect(() => {
    if (!container.current) return;
    const chart = echarts.init(container.current, dark ? "hka-dark" : "hka-light", {
      renderer: "canvas",
    });
    instance.current = chart;
    chart.setOption(option);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      instance.current = null;
    };
    // The option is applied by the effect below; re-init only on theme change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  useEffect(() => {
    instance.current?.setOption(option, { notMerge: true });
  }, [option, dark]);

  useEffect(() => {
    const chart = instance.current;
    if (!chart || !onEvents) return;
    const entries = Object.entries(onEvents);
    entries.forEach(([event, handler]) => chart.on(event, handler));
    return () => {
      entries.forEach(([event, handler]) => chart.off(event, handler));
    };
  }, [onEvents, dark]);

  return (
    <div
      ref={container}
      className={["chart-fill", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={ariaLabel ?? "Chart"}
      style={{ width: "100%", height: typeof height === "number" ? `${height}px` : height }}
    />
  );
}
