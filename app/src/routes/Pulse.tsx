import { useMemo, useState } from "react";
import Chart from "../components/Chart";
import Panel, { Bento, BentoRow } from "../components/Panel";
import Segmented from "../components/Segmented";
import StageHeader from "../components/StageHeader";
import { KpiStrip, type StatItem } from "../components/Stat";
import TenureChoice from "../components/TenureChoice";
import { useDistrictData } from "../data/useDistrictData";
import { useMarket } from "../data/useMarket";
import {
  axisLabelStyle,
  baseOption,
  gridOf,
  shortMonth,
  useChartTheme,
  yearTick,
} from "../lib/chartOptions";
import { latestRows } from "../lib/districtMetrics";
import { fmtCompact, fmtMoney, fmtPct, fmtPctPlain } from "../lib/format";
import { paymentForPrice, type BudgetInput } from "../lib/journey";
import { median, shiftMonth } from "../lib/stats";
import {
  buyVsRentSeries,
  effectiveRateSeries,
  eventMarkers,
  latestCrossover,
  latestPoint,
  rebaseSeries,
  rvdSeries,
  spreadSeries,
  yoySeries,
  yieldSeries,
  type BuyRentPoint,
  type SeriesPoint,
} from "../lib/marketSeries";
import { useJourney } from "../state/journey";

const WINDOWS = [
  { value: "5y", label: "5y" },
  { value: "10y", label: "10y" },
  { value: "all", label: "All" },
] as const;

const CLASSES = [
  { value: "ALL", label: "All" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "D", label: "D" },
  { value: "E", label: "E" },
];

type WindowKey = (typeof WINDOWS)[number]["value"];
type SignalTone = "pos" | "warn" | "neg" | "neutral";

type Signal = { icon: string; title: string; detail: string; tone: SignalTone };

function labelInterval(length: number, ticks: number): number {
  return Math.max(0, Math.floor(length / ticks));
}

function valueMap(series: SeriesPoint[]): Map<string, number> {
  return new Map(series.map((point) => [point.month, point.value]));
}

export default function Pulse() {
  const market = useMarket();
  const districts = useDistrictData();
  const propertyClass = useJourney((state) => state.propertyClass);
  const setPropertyClass = useJourney((state) => state.setPropertyClass);
  const tenure = useJourney((state) => state.tenure);
  const monthlyIncome = useJourney((state) => state.monthlyIncome);
  const depositPct = useJourney((state) => state.depositPct);
  const mortgageRate = useJourney((state) => state.mortgageRate);
  const loanYears = useJourney((state) => state.loanYears);
  const dsrCap = useJourney((state) => state.dsrCap);
  const flatSize = useJourney((state) => state.flatSize);
  const theme = useChartTheme();
  const [windowKey, setWindowKey] = useState<WindowKey>("10y");

  const budget: BudgetInput = {
    monthlyIncome,
    depositPct,
    mortgageRate,
    loanYears,
    dsrCap,
  };

  const model = useMemo(() => {
    if (!market.data) return null;
    const data = market.data;

    const price = rvdSeries(data.rvd, propertyClass, "price");
    const rent = rvdSeries(data.rvd, propertyClass, "rent");
    const priceRebasedAll = rebaseSeries(price);
    const rentRebasedAll = rebaseSeries(rent);
    const latest = latestPoint(priceRebasedAll) ?? latestPoint(rentRebasedAll);
    if (!latest) return null;

    const windowMonths = windowKey === "5y" ? 60 : windowKey === "10y" ? 120 : null;
    const startMonth = windowMonths ? shiftMonth(latest.month, -(windowMonths - 1)) : null;
    const inWindow = (point: SeriesPoint) => !startMonth || point.month >= startMonth;

    const priceWindow = priceRebasedAll.filter(inWindow);
    const rentWindow = rentRebasedAll.filter(inWindow);
    const rentByMonth = valueMap(rentWindow);
    const months = priceWindow.map((point) => point.month);

    const priceYoy = valueMap(yoySeries(price));
    const rentYoy = valueMap(yoySeries(rent));
    const latestPrice = latestPoint(priceRebasedAll);
    const latestRent = latestPoint(rentRebasedAll);

    const yields = yieldSeries(data.yields, propertyClass);
    const hplan = effectiveRateSeries(data.rates, "hibor");
    const pplan = effectiveRateSeries(data.rates, "blr");
    const pplanByMonth = valueMap(pplan);
    const spread = spreadSeries(yields, hplan);
    const latestSpread = spread.length ? spread[spread.length - 1] : null;
    const latestYield = latestPoint(yields);

    const events = eventMarkers(data.events).filter(
      (event) => (!startMonth || event.month >= startMonth) && event.month <= latest.month,
    );

    const buyRent: BuyRentPoint[] = districts.data ? buyVsRentSeries(districts.data.affordability) : [];
    const crossover = latestCrossover(buyRent);
    const latestYear = buyRent.length ? buyRent[buyRent.length - 1] : null;

    // The personal signal uses the current district medians at the user's size.
    const panelRows = districts.data ? latestRows(districts.data.panel) : [];
    const salePsf = median(
      panelRows.map((row) => row.sale_psf).filter((value): value is number => value !== null),
    );
    const rentPsf = median(
      panelRows.map((row) => row.rent_psf).filter((value): value is number => value !== null),
    );
    const userPrice = salePsf ? salePsf * flatSize : 0;
    const userPayment = userPrice > 0 ? paymentForPrice(userPrice, budget) : 0;
    const userRent = rentPsf ? rentPsf * flatSize : 0;
    const gap = userPayment > 0 && userRent > 0 ? userPayment - userRent : null;
    const latestQuarter = districts.data?.as_of ?? null;

    const priceYoyValue = latestPrice ? priceYoy.get(latestPrice.month) ?? null : null;
    const rentYoyValue = latestRent ? rentYoy.get(latestRent.month) ?? null : null;

    const signals: Signal[] = [
      {
        icon: "↗",
        title:
          priceYoyValue === null || rentYoyValue === null
            ? "Momentum unavailable"
            : rentYoyValue > priceYoyValue
              ? "Rents are rising faster than prices"
              : "Prices are rising faster than rents",
        detail:
          priceYoyValue === null || rentYoyValue === null
            ? "No recent index changes."
            : `Price ${fmtPct(priceYoyValue)} vs rent ${fmtPct(rentYoyValue)} year on year.`,
        tone:
          priceYoyValue === null || rentYoyValue === null
            ? "neutral"
            : rentYoyValue > priceYoyValue
              ? "warn"
              : "pos",
      },
      {
        icon: "%",
        title:
          latestSpread === null
            ? "Yield spread unavailable"
            : latestSpread.spread >= 0
              ? "Yield covers the H-plan proxy"
              : "Borrowing costs more than the yield",
        detail: latestSpread
          ? `Gross yield ${fmtPctPlain(latestSpread.yieldPct, 2)} against ${fmtPctPlain(latestSpread.ratePct, 2)} effective.`
          : "No yield or rate history for this class.",
        tone: latestSpread === null ? "neutral" : latestSpread.spread >= 0 ? "pos" : "neg",
      },
      {
        icon: "$",
        title:
          gap === null
            ? "Monthly cost comparison unavailable"
            : gap > 0
              ? "Buying costs more per month"
              : "Renting costs more per month",
        detail:
          gap === null
            ? "District medians or income are missing."
            : `${fmtMoney(userPayment)} buy vs ${fmtMoney(userRent)} rent for ${flatSize} ft²${latestQuarter ? ` · ${latestQuarter}` : ""}.`,
        tone: gap === null ? "neutral" : gap > 0 ? "warn" : "pos",
      },
    ];

    return {
      latest,
      months,
      priceWindow,
      rentWindow,
      rentByMonth,
      priceYoy,
      rentYoy,
      latestPrice,
      latestRent,
      latestYield,
      spread,
      latestSpread,
      pplanByMonth,
      events,
      buyRent,
      crossover,
      latestYear,
      startMonth,
      endMonth: latest.month,
      signals,
      latestQuarter,
    };
  }, [
    market.data,
    districts.data,
    propertyClass,
    windowKey,
    flatSize,
    monthlyIncome,
    depositPct,
    mortgageRate,
    loanYears,
    dsrCap,
  ]);

  const options = useMemo(() => {
    if (!model) return null;
    const base = baseOption(theme);
    const { months, priceWindow, rentByMonth, spread, pplanByMonth, events, buyRent, crossover } = model;

    const priceOption: Record<string, unknown> = {
      ...base,
      grid: gridOf({ top: 18, bottom: 0, left: 2, right: 8 }),
      legend: { ...(base.legend as object), data: ["Price index", "Rent index"] },
      tooltip: {
        ...(base.tooltip as object),
        trigger: "axis",
        valueFormatter: (value: number) => (value === null ? "—" : Number(value).toFixed(1)),
      },
      xAxis: {
        type: "category",
        data: months,
        boundaryGap: false,
        axisLabel: axisLabelStyle(theme, {
          formatter: yearTick,
          interval: labelInterval(months.length, 9),
        }),
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { color: theme.axisLabel, fontSize: 8, formatter: (value: number) => `${Math.round(value)}` },
      },
      dataZoom: [
        {
          type: "inside",
          start: 0,
          end: 100,
          zoomOnMouseWheel: false,
          moveOnMouseWheel: false,
          moveOnMouseMove: true,
        },
      ],
      series: [
        {
          name: "Price index",
          type: "line",
          data: priceWindow.map((point) => Number(point.value.toFixed(1))),
          showSymbol: false,
          lineStyle: { width: 1.8, color: theme.teal },
          itemStyle: { color: theme.teal },
          markLine: {
            silent: true,
            symbol: ["none", "none"],
            lineStyle: { color: theme.borderLine, width: 1, type: "dashed" },
            label: {
              show: true,
              position: "insideEndTop",
              rotate: 90,
              fontSize: 7,
              color: theme.muted,
              distance: 2,
              formatter: (params: { name?: string }) => {
                const name = params.name ?? "";
                return name.length > 20 ? `${name.slice(0, 19)}…` : name;
              },
            },
            data: events.map((event) => ({ name: event.label, xAxis: event.month })),
          },
        },
        {
          name: "Rent index",
          type: "line",
          data: months.map((month) => {
            const value = rentByMonth.get(month);
            return value === undefined ? null : Number(value.toFixed(1));
          }),
          showSymbol: false,
          connectNulls: true,
          lineStyle: { width: 1.5, color: theme.amber },
          itemStyle: { color: theme.amber },
        },
      ],
    };

    const yieldOption: Record<string, unknown> = {
      ...base,
      grid: gridOf({ top: 18, bottom: 0, left: 2, right: 8 }),
      legend: { ...(base.legend as object), data: ["Gross yield", "H-plan rate", "P-plan rate"] },
      tooltip: {
        ...(base.tooltip as object),
        trigger: "axis",
        valueFormatter: (value: number) => `${Number(value).toFixed(2)}%`,
      },
      xAxis: {
        type: "category",
        data: spread.map((point) => point.month),
        boundaryGap: false,
        axisLabel: axisLabelStyle(theme, { formatter: yearTick, interval: labelInterval(spread.length, 8) }),
      },
      yAxis: {
        type: "value",
        axisLabel: { color: theme.axisLabel, fontSize: 8, formatter: (value: number) => `${value.toFixed(1)}` },
      },
      series: [
        {
          name: "range-low",
          type: "line",
          stack: "spread-band",
          data: spread.map((point) => Number(point.lower.toFixed(2))),
          showSymbol: false,
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
          silent: true,
          tooltip: { show: false },
        },
        {
          name: "range-gap",
          type: "line",
          stack: "spread-band",
          data: spread.map((point) => Number(point.gap.toFixed(2))),
          showSymbol: false,
          lineStyle: { opacity: 0 },
          areaStyle: { color: theme.amberFill, opacity: 0.7 },
          silent: true,
          tooltip: { show: false },
        },
        {
          name: "Gross yield",
          type: "line",
          data: spread.map((point) => Number(point.yieldPct.toFixed(2))),
          showSymbol: false,
          lineStyle: { width: 1.8, color: theme.teal },
          itemStyle: { color: theme.teal },
        },
        {
          name: "H-plan rate",
          type: "line",
          data: spread.map((point) => Number(point.ratePct.toFixed(2))),
          showSymbol: false,
          lineStyle: { width: 1.4, color: theme.rose },
          itemStyle: { color: theme.rose },
        },
        {
          name: "P-plan rate",
          type: "line",
          data: spread.map((point) => pplanByMonth.get(point.month) ?? null),
          showSymbol: false,
          connectNulls: true,
          lineStyle: { width: 1.1, color: theme.slate, type: "dashed" },
          itemStyle: { color: theme.slate },
        },
      ],
    };

    const buyRentOption: Record<string, unknown> = {
      ...base,
      grid: gridOf({ top: 18, bottom: 0, left: 2, right: 10 }),
      legend: { ...(base.legend as object), data: ["Monthly rent", "Mortgage payment"] },
      tooltip: {
        ...(base.tooltip as object),
        trigger: "axis",
        valueFormatter: (value: number) => fmtMoney(Number(value)),
      },
      xAxis: {
        type: "category",
        data: buyRent.map((point) => String(point.year)),
        boundaryGap: false,
        axisLabel: axisLabelStyle(theme, { interval: labelInterval(buyRent.length, 8) }),
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: theme.axisLabel,
          fontSize: 8,
          formatter: (value: number) => `HK$${fmtCompact(value)}`,
        },
      },
      series: [
        {
          name: "Monthly rent",
          type: "line",
          data: buyRent.map((point) => Math.round(point.rent)),
          showSymbol: false,
          lineStyle: { width: 1.7, color: theme.teal },
          itemStyle: { color: theme.teal },
          areaStyle: { color: theme.tealFill, opacity: 0.35 },
        },
        {
          name: "Mortgage payment",
          type: "line",
          data: buyRent.map((point) => Math.round(point.payment)),
          showSymbol: false,
          lineStyle: { width: 1.7, color: theme.rose },
          itemStyle: { color: theme.rose },
          markLine: crossover.year
            ? {
                silent: true,
                symbol: ["none", "none"],
                lineStyle: { color: theme.amber, width: 1, type: "dashed" },
                label: {
                  show: true,
                  position: "insideEndTop",
                  fontSize: 7.5,
                  color: theme.amber,
                  formatter: `crossover ${crossover.year}`,
                },
                data: [{ xAxis: String(crossover.year) }],
              }
            : undefined,
        },
      ],
    };

    return { priceOption, yieldOption, buyRentOption };
  }, [model, theme]);

  const kpis: StatItem[] = useMemo(() => {
    if (!model) {
      return Array.from({ length: 6 }, () => ({ label: "…", value: "—", delta: "Loading" }));
    }
    const { latestPrice, latestRent, priceYoy, rentYoy, latestYield, latestSpread, latestYear } = model;
    const priceYoyValue = latestPrice ? priceYoy.get(latestPrice.month) ?? null : null;
    const rentYoyValue = latestRent ? rentYoy.get(latestRent.month) ?? null : null;
    const monthLabel = latestPrice ? shortMonth(latestPrice.month) : "";

    return [
      {
        label: "Price index",
        value: latestPrice ? latestPrice.value.toFixed(1) : "—",
        delta:
          priceYoyValue === null ? `2019 = 100 · ${monthLabel}` : `YoY ${fmtPct(priceYoyValue)} · ${monthLabel}`,
        tone: priceYoyValue === null ? "neutral" : priceYoyValue >= 0 ? "pos" : "neg",
      },
      {
        label: "Rent index",
        value: latestRent ? latestRent.value.toFixed(1) : "—",
        delta: rentYoyValue === null ? "2019 = 100" : `YoY ${fmtPct(rentYoyValue)}`,
        tone: rentYoyValue === null ? "neutral" : rentYoyValue >= 0 ? "pos" : "neg",
      },
      {
        label: "Gross yield",
        value: latestYield ? fmtPctPlain(latestYield.value, 2) : "—",
        delta: `${propertyClass === "ALL" ? "mean A–E" : `class ${propertyClass}`} · ${latestYield ? shortMonth(latestYield.month) : ""}`,
      },
      {
        label: "Yield − mortgage",
        value: latestSpread ? fmtPct(latestSpread.spread, 2) : "—",
        delta: latestSpread
          ? `yield ${fmtPctPlain(latestSpread.yieldPct, 2)} vs ${fmtPctPlain(latestSpread.ratePct, 2)}`
          : "H-plan proxy",
        tone: latestSpread ? (latestSpread.spread >= 0 ? "pos" : "neg") : "neutral",
      },
      {
        label: "Median payment",
        value: latestYear ? fmtMoney(latestYear.payment) : "—",
        delta: latestYear ? `500 ft² · ${latestYear.year} (income year)` : "18-district median",
      },
      {
        label: "Median rent",
        value: latestYear ? fmtMoney(latestYear.rent) : "—",
        delta: latestYear ? `500 ft² · ${latestYear.year}` : "18-district median",
      },
    ] satisfies StatItem[];
  }, [model, propertyClass]);

  const loading = market.loading || districts.loading;
  const error = market.error ?? districts.error;
  const startLabel = model?.startMonth ? shortMonth(model.startMonth) : "1993";
  const endLabel = model?.endMonth ? shortMonth(model.endMonth) : "";

  return (
    <>
      <StageHeader
        eyebrow="Stage 1 · Market pulse"
        title="Should you move now — and is it a buyer's or tenant's market?"
        question="Prices and rents against each other, yields against mortgage rates, and the buy-versus-rent gap for the same flat. Choose a path to set the later stages."
        actions={
          <>
            <Segmented<WindowKey>
              options={WINDOWS.map((item) => ({ value: item.value, label: item.label }))}
              value={windowKey}
              onChange={setWindowKey}
              label="Index window"
              size="sm"
            />
            <Segmented<string>
              options={CLASSES}
              value={propertyClass}
              onChange={setPropertyClass}
              label="RVD property class"
              size="sm"
            />
          </>
        }
        next={{ to: "/explore", label: "Next: find your district" }}
      />

      <KpiStrip items={kpis} />

      <Bento>
        <BentoRow cols="minmax(0, 58fr) minmax(0, 42fr)">
          <Panel
            title="Price and rent indices"
            subtitle={`${startLabel} – ${endLabel} · 2019 = 100`}
            noteId="pulse-indices"
            loading={market.loading}
            error={market.error}
            empty={!options}
            emptyMessage="No RVD series for this class."
            footer={`${model?.events.length ?? 0} policy and rate events marked; drag to zoom.`}
          >
            {options ? <Chart option={options.priceOption} ariaLabel="RVD price and rent indices" /> : null}
          </Panel>

          <Panel
            title="Yield vs effective mortgage rate"
            subtitle="Gross yield · HIBOR+1.3 · BLR−2.5"
            noteId="pulse-yield-spread"
            loading={market.loading}
            empty={!options || !model?.spread.length}
            emptyMessage="No yield history for this class."
            footer="Shaded band = gap between the yield and the H-plan proxy."
          >
            {options ? <Chart option={options.yieldOption} ariaLabel="Yield versus mortgage rate" /> : null}
          </Panel>
        </BentoRow>

        <BentoRow cols="minmax(0, 58fr) minmax(0, 42fr)">
          <Panel
            title="Buy vs rent, same flat"
            subtitle="18-district median · 500 ft² · 2001–2025"
            noteId="pulse-buy-rent"
            loading={loading}
            empty={!options || !model?.buyRent.length}
            emptyMessage="Affordability series unavailable."
            footer={
              model?.crossover.year
                ? `Last crossover ${model.crossover.year} on the standard 70% loan benchmark; the decision panel uses the latest quarter at your settings.`
                : "Median monthly rent and mortgage payment for a standard 500 ft² flat."
            }
          >
            {options ? <Chart option={options.buyRentOption} ariaLabel="Buy versus rent monthly cost" /> : null}
          </Panel>

          <Panel
            title="Rent or buy? Your call"
            subtitle="three signals then choose"
            noteId="pulse-decision"
            loading={loading}
            error={error}
            empty={!model}
            emptyMessage="Waiting for the market series."
            padded
            footer="Descriptive signals, not advice. Monthly cost uses the latest district medians at your flat size."
          >
            {model ? (
              <div className="decision">
                {model.signals.map((signal) => (
                  <div className={`signal ${signal.tone}`} key={signal.title}>
                    <span className="signal-icon" aria-hidden="true">
                      {signal.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="signal-title">{signal.title}</p>
                      <p className="signal-detail">{signal.detail}</p>
                    </div>
                  </div>
                ))}
                <div className="decision-choice">
                  <TenureChoice compact />
                </div>
                <p className="decision-foot">
                  {tenure
                    ? `Continuing as a ${tenure === "rent" ? "tenant" : "buyer"}. Your brief updates stages 2 and 3.`
                    : "Buy is shown in stages 2 and 3 until you choose a path."}
                </p>
              </div>
            ) : null}
          </Panel>
        </BentoRow>
      </Bento>
    </>
  );
}
