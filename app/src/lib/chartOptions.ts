import { useMemo } from "react";
import { useTheme } from "../state/theme";

export const CHART_FONT = '"Inter", "Noto Sans HK", system-ui, -apple-system, "Segoe UI", sans-serif';

export type ChartTheme = {
  dark: boolean;
  text: string;
  muted: string;
  axisLabel: string;
  axisLine: string;
  borderLine: string;
  splitLine: string;
  tooltipBg: string;
  tooltipFg: string;
  teal: string;
  tealFill: string;
  amber: string;
  amberFill: string;
  rose: string;
  roseFill: string;
  blue: string;
  slate: string;
  /** Rent-to-income bands: below the person's cap, between cap and 100%, over 100%. */
  rtiOk: string;
  rtiWarn: string;
  rtiOver: string;
  island: string;
  kowloon: string;
  nt: string;
  series: string[];
};

export function makeChartTheme(dark: boolean): ChartTheme {
  return dark
    ? {
        dark: true,
        text: "#e2e8f0",
        muted: "#94a3b8",
        axisLabel: "#94a3b8",
        axisLine: "rgba(148,163,184,0.35)",
        borderLine: "rgba(148,163,184,0.4)",
        splitLine: "rgba(148,163,184,0.16)",
        tooltipBg: "rgba(2,6,23,0.95)",
        tooltipFg: "#f1f5f9",
        teal: "#2dd4bf",
        tealFill: "rgba(45,212,191,0.2)",
        amber: "#fbbf24",
        amberFill: "rgba(251,191,36,0.18)",
        rose: "#fb7185",
        roseFill: "rgba(251,113,133,0.18)",
        blue: "#60a5fa",
        slate: "#94a3b8",
        rtiOk: "#34d399",
        rtiWarn: "#fbbf24",
        rtiOver: "#fb7185",
        island: "#60a5fa",
        kowloon: "#fbbf24",
        nt: "#4ade80",
        series: ["#2dd4bf", "#fbbf24", "#60a5fa", "#fb7185", "#a78bfa", "#34d399"],
      }
    : {
        dark: false,
        text: "#0f172a",
        muted: "#64748b",
        axisLabel: "#64748b",
        axisLine: "rgba(100,116,139,0.35)",
        borderLine: "rgba(100,116,139,0.4)",
        splitLine: "rgba(100,116,139,0.16)",
        tooltipBg: "rgba(15,23,42,0.94)",
        tooltipFg: "#f8fafc",
        teal: "#0f766e",
        tealFill: "rgba(15,118,110,0.18)",
        amber: "#b45309",
        amberFill: "rgba(180,83,9,0.16)",
        rose: "#be123c",
        roseFill: "rgba(190,18,60,0.14)",
        blue: "#1d4ed8",
        slate: "#475569",
        rtiOk: "#047857",
        rtiWarn: "#b45309",
        rtiOver: "#be123c",
        island: "#2563eb",
        kowloon: "#d97706",
        nt: "#15803d",
        series: ["#0f766e", "#b45309", "#1d4ed8", "#be123c", "#7c3aed", "#0e7490"],
      };
}

export function useChartTheme(): ChartTheme {
  const mode = useTheme((state) => state.mode);
  return useMemo(() => makeChartTheme(mode === "dark"), [mode]);
}

/** Shared option defaults: tooltip chrome, legend type and text styling. */
export function baseOption(theme: ChartTheme): Record<string, unknown> {
  return {
    animationDuration: 320,
    textStyle: { fontFamily: CHART_FONT, color: theme.text },
    tooltip: {
      backgroundColor: theme.tooltipBg,
      borderWidth: 0,
      padding: [6, 8],
      textStyle: { color: theme.tooltipFg, fontSize: 10, fontFamily: CHART_FONT },
    },
    legend: {
      type: "scroll",
      top: 0,
      left: 0,
      itemWidth: 10,
      itemHeight: 7,
      itemGap: 8,
      textStyle: { color: theme.muted, fontSize: 9, fontFamily: CHART_FONT },
      pageTextStyle: { color: theme.muted },
    },
  };
}

export function gridOf(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { left: 4, right: 8, top: 20, bottom: 4, containLabel: true, ...overrides };
}

export function axisLabelStyle(theme: ChartTheme, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { color: theme.axisLabel, fontSize: 8.5, fontFamily: CHART_FONT, ...overrides };
}

export function splitLineStyle(theme: ChartTheme): Record<string, unknown> {
  return { lineStyle: { color: theme.splitLine } };
}

/** "2026-08" → "Aug 26"; "2026-Q4" → "26Q4". */
export function shortMonth(value: string): string {
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

export function shortQuarter(value: string): string {
  const [year, quarter] = value.split("-Q");
  return `${year.slice(2)}Q${quarter}`;
}

/** Year-only tick labels keep a 400-point monthly axis readable. */
export function yearTick(value: string): string {
  return value.slice(0, 4);
}

export function quarterTick(value: string): string {
  return shortQuarter(value);
}
