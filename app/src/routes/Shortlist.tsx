import { useMemo, useState } from "react";
import Chart from "../components/Chart";
import Panel, { Bento } from "../components/Panel";
import StageHeader from "../components/StageHeader";
import { KpiStrip, type StatItem } from "../components/Stat";
import { useDistrictData } from "../data/useDistrictData";
import { useEstateQuartiles } from "../data/useEstateQuartiles";
import { useListings } from "../data/useListings";
import type { EstateLatest } from "../data/types";
import { axisLabelStyle, baseOption, gridOf, useChartTheme } from "../lib/chartOptions";
import { fmtCompact, fmtMoney, fmtPct, fmtPctPlain, fmtPsf } from "../lib/format";
import { maxAffordablePrice, maxRent, type BudgetInput } from "../lib/journey";
import {
  clipListings,
  listingTotal,
  reachableShare,
  rentDistribution,
  selectListings,
} from "../lib/listings";
import { median } from "../lib/stats";
import {
  askingVsTransaction,
  districtLookup,
  filterEstates,
  latestQuarter,
  type EstateFilters,
} from "../lib/districtMetrics";
import { useJourney } from "../state/journey";

type AgeBand = EstateFilters["ageBand"];
type MtrBand = EstateFilters["mtrBand"];
type SortKey = EstateFilters["sort"];

const AGE_OPTIONS: Array<{ value: AgeBand; label: string }> = [
  { value: "any", label: "Age: any" },
  { value: "<10", label: "Age <10" },
  { value: "10-19", label: "Age 10–19" },
  { value: "20-39", label: "Age 20–39" },
  { value: "40+", label: "Age 40+" },
];

const MTR_OPTIONS: Array<{ value: MtrBand; label: string }> = [
  { value: "any", label: "MTR: any" },
  { value: "<=5", label: "MTR ≤5" },
  { value: "<=10", label: "MTR ≤10" },
  { value: ">10", label: "MTR >10" },
];

const VOLUME_OPTIONS = [
  { value: 1, label: "Txn ≥1" },
  { value: 3, label: "Txn ≥3" },
  { value: 5, label: "Txn ≥5" },
  { value: 10, label: "Txn ≥10" },
];

function position(value: number, low: number, high: number): number {
  if (high <= low) return 0;
  return Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100));
}

export default function Shortlist() {
  const districtData = useDistrictData();
  const quartiles = useEstateQuartiles();
  const listings = useListings();
  const brief = useJourney();
  const theme = useChartTheme();

  const [ageBand, setAgeBand] = useState<AgeBand>("any");
  const [mtrBand, setMtrBand] = useState<MtrBand>("any");
  const [minVolume, setMinVolume] = useState(3);
  const [sort, setSort] = useState<SortKey>("volume");
  const [capChoice, setCapChoice] = useState<string>("auto");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isRent = brief.tenure === "rent";
  const budget: BudgetInput = {
    monthlyIncome: brief.monthlyIncome,
    depositPct: brief.depositPct,
    mortgageRate: brief.mortgageRate,
    loanYears: brief.loanYears,
    dsrCap: brief.dsrCap,
  };
  const autoCap = isRent ? maxRent(brief.monthlyIncome, brief.rtiCap) : maxAffordablePrice(budget);
  const capAllowed = isRent
    ? ["auto", "10000", "15000", "20000", "0"]
    : ["auto", "4000000", "6000000", "8000000", "12000000", "0"];
  const effectiveCapChoice = capAllowed.includes(capChoice) ? capChoice : "auto";
  const cap = effectiveCapChoice === "auto" ? autoCap : Number(effectiveCapChoice);

  const lookup = useMemo(
    () => (districtData.data ? districtLookup(districtData.data.districts) : {}),
    [districtData.data],
  );

  const model = useMemo(() => {
    if (!districtData.data) return null;
    const data = districtData.data;
    const filters: EstateFilters = {
      district: brief.selectedDistrict,
      maxPrice: cap,
      flatSize: brief.flatSize,
      ageBand,
      mtrBand,
      minVolume,
      tenure: brief.tenure === "rent" ? "rent" : "sale",
      sort,
    };
    const matched = filterEstates(data.estates, filters);
    const pool = brief.selectedDistrict
      ? data.estates.filter((estate) => estate.district_code === brief.selectedDistrict)
      : data.estates;

    const psfOf = (estate: EstateLatest) => (isRent ? estate.rent_psf : estate.price_psf) ?? 0;
    const values = matched.map(psfOf).filter((value) => value > 0);
    const ages = matched
      .map((estate) => estate.building_age_years)
      .filter((age): age is number => age !== null);
    const totalTransactions = matched.reduce((sum, estate) => sum + estate.volume, 0);
    const cheapest = matched.reduce<EstateLatest | null>(
      (best, estate) => (best === null || psfOf(estate) < psfOf(best) ? estate : best),
      null,
    );
    const bestYield = matched.reduce<EstateLatest | null>(
      (best, estate) =>
        estate.yield_pct !== null &&
        estate.yield_pct > 0 &&
        estate.yield_pct <= 15 &&
        (best === null || estate.yield_pct > (best.yield_pct ?? -1))
          ? estate
          : best,
      null,
    );

    const selected = matched.find((estate) => estate.estate_id === selectedId) ?? matched[0] ?? null;
    const latest = latestQuarter(data.panel);
    const districtRow = data.panel.find(
      (row) => row.quarter === latest && row.district_code === brief.selectedDistrict,
    );

    return {
      matched,
      pool,
      values,
      ages,
      totalTransactions,
      cheapest,
      bestYield,
      selected,
      latest,
      districtRow,
    };
  }, [
    districtData.data,
    brief.selectedDistrict,
    brief.flatSize,
    cap,
    ageBand,
    mtrBand,
    minVolume,
    sort,
    selectedId,
    lookup,
    isRent,
  ]);

  const selected = model?.selected ?? null;
  const selectedQuartile = selected && quartiles.data ? quartiles.data[selected.estate_id] : null;
  const districtMedian = isRent
    ? model?.districtRow?.rent_psf ?? null
    : model?.districtRow?.sale_psf ?? null;
  const selectedPsf = selected ? (isRent ? selected.rent_psf : selected.price_psf) : null;
  const isShortlisted = selected ? brief.shortlist.includes(selected.estate_id) : false;

  const listingModel = useMemo(() => {
    if (!listings.data) return null;
    const selection = selectListings(listings.data, {
      district: brief.selectedDistrict,
      tenure: brief.tenure === "rent" ? "rent" : "sale",
    });
    return {
      selection,
      reach: reachableShare(selection, cap),
      clipped: clipListings(selection),
      distribution: rentDistribution(listings.data, brief.selectedDistrict),
    };
  }, [listings.data, brief.tenure, brief.selectedDistrict, brief.flatSize, cap]);

  const askingPremium = useMemo(() => {
    if (!districtData.data || !brief.selectedDistrict || isRent) return null;
    const rows = askingVsTransaction(
      districtData.data.classes,
      districtData.data.panel,
      brief.selectedDistrict,
      "sale",
    );
    return rows.length ? median(rows.map((row) => row.premium)) : null;
  }, [districtData.data, brief.selectedDistrict, isRent]);

  const budgetBuysOption = useMemo(() => {
    if (!listingModel) return null;
    const base = baseOption(theme);
    const plotted = listingModel.clipped.plotted;
    const within = plotted.filter((record) => cap > 0 && listingTotal(record) <= cap);
    const outside = plotted.filter((record) => !(cap > 0 && listingTotal(record) <= cap));
    const toPoint = (record: (typeof plotted)[number]) => [
      record.area,
      Math.round(listingTotal(record)),
      record.price_psf,
    ];

    return {
      ...base,
      grid: gridOf({ top: 24, bottom: 0, left: 2, right: 8 }),
      legend: { ...(base.legend as object), data: ["Within budget", "Above budget"] },
      tooltip: {
        ...(base.tooltip as object),
        formatter: (params: { value: Array<string | number> }) => {
          const [area, total, psf] = params.value;
          return `${area} ft² · ${fmtPsf(Number(psf))}${isRent ? " rent" : ""}<br/>Total ${fmtMoney(Number(total))}${isRent ? "/month" : ""}`;
        },
      },
      xAxis: {
        type: "value",
        scale: true,
        axisLabel: axisLabelStyle(theme, {
          formatter: (value: number) => `${Math.round(value)} ft²`,
          fontSize: 7.5,
        }),
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: axisLabelStyle(theme, {
          formatter: (value: number) => `HK$${fmtCompact(value)}`,
          fontSize: 7.5,
        }),
      },
      series: [
        {
          name: "Within budget",
          type: "scatter",
          data: within.map(toPoint),
          symbolSize: 4,
          itemStyle: { color: theme.teal, opacity: 0.5 },
          emphasis: { itemStyle: { opacity: 1 } },
        },
        {
          name: "Above budget",
          type: "scatter",
          data: outside.map(toPoint),
          symbolSize: 4,
          itemStyle: { color: theme.dark ? "#475569" : "#cbd5e1", opacity: 0.5 },
          markLine: {
            silent: true,
            symbol: ["none", "none"],
            lineStyle: { color: theme.amber, width: 1, type: "dashed" },
            label: { show: true, fontSize: 7, color: theme.amber, position: "insideEndTop" },
            data: [
              { yAxis: cap, name: "budget", label: { formatter: "budget" } },
              { xAxis: brief.flatSize, name: "size", label: { formatter: "size" } },
            ],
          },
        },
      ],
    };
  }, [listingModel, theme, cap, brief.flatSize, isRent]);

  const kpis: StatItem[] = useMemo(() => {
    const priceLabel = isRent ? "rent" : "price";
    return [
      {
        label: "Estates matching",
        value: model ? String(model.matched.length) : "—",
        delta: brief.selectedDistrict
          ? `${lookup[brief.selectedDistrict]?.name_en ?? brief.selectedDistrict} · ${model?.pool.length ?? 0} in district`
          : "all Hong Kong",
      },
      {
        label: `Median ${priceLabel} $/ft²`,
        value: model && model.values.length ? fmtPsf(median(model.values)) : "—",
        delta: model ? `${model.matched.length} matching estates` : "loading",
      },
      {
        label: `Cheapest ${priceLabel}`,
        value: model?.cheapest
          ? fmtPsf(isRent ? model.cheapest.rent_psf : model.cheapest.price_psf)
          : "—",
        delta: model?.cheapest?.name ?? "No match",
      },
      {
        label: "Best gross yield",
        value:
          model?.bestYield?.yield_pct !== null && model?.bestYield?.yield_pct !== undefined
            ? fmtPctPlain(model.bestYield.yield_pct, 2)
            : "—",
        delta: model?.bestYield?.name ?? "No rent data",
      },
      {
        label: "Median age",
        value: model && model.ages.length ? `${Math.round(median(model.ages))} yrs` : "—",
        delta:
          model && model.ages.length
            ? `${model.ages.length} of ${model.matched.length} state age`
            : "age not stated",
      },
      {
        label: "Matching transactions",
        value: model ? model.totalTransactions.toLocaleString("en-HK") : "—",
        delta: model ? `latest quarter ${model.latest}` : "loading",
      },
    ];
  }, [model, isRent, brief.selectedDistrict, lookup]);

  const districtName = brief.selectedDistrict
    ? lookup[brief.selectedDistrict]?.name_en ?? brief.selectedDistrict
    : "All Hong Kong";

  const capOptions = isRent
    ? [
        { value: "auto", label: `Cap: auto ${fmtMoney(autoCap)}` },
        { value: "10000", label: "Cap: HK$10k" },
        { value: "15000", label: "Cap: HK$15k" },
        { value: "20000", label: "Cap: HK$20k" },
        { value: "0", label: "Cap: none" },
      ]
    : [
        { value: "auto", label: `Cap: auto ${fmtCompact(autoCap)}` },
        { value: "4000000", label: "Cap: 4M" },
        { value: "6000000", label: "Cap: 6M" },
        { value: "8000000", label: "Cap: 8M" },
        { value: "12000000", label: "Cap: 12M" },
        { value: "0", label: "Cap: none" },
      ];

  const distribution = listingModel?.distribution ?? null;
  const costAtSize = (selectedPsf ?? 0) * brief.flatSize;
  const budgetVerdict =
    cap > 0 && costAtSize > 0
      ? costAtSize <= cap
        ? `within your ${isRent ? "rent cap" : "ceiling"}`
        : `above your ${isRent ? "rent cap" : "ceiling"} by ${fmtMoney(costAtSize - cap)}`
      : "set a budget cap";

  return (
    <>
      <StageHeader
        eyebrow="Stage 3 · Shortlist"
        title="Which estates should you see — and what does your budget buy?"
        question={`Narrow ${districtName} to a visit list, then check what your ${isRent ? "rent" : "budget"} buys across current listings.`}
        actions={
          <>
            <select
              className="rail-select filter-select"
              value={ageBand}
              onChange={(event) => setAgeBand(event.target.value as AgeBand)}
              aria-label="Age band"
            >
              {AGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rail-select filter-select"
              value={mtrBand}
              onChange={(event) => setMtrBand(event.target.value as MtrBand)}
              aria-label="MTR walk band"
            >
              {MTR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rail-select filter-select"
              value={minVolume}
              onChange={(event) => setMinVolume(Number(event.target.value))}
              aria-label="Minimum transactions"
            >
              {VOLUME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rail-select filter-select"
              value={effectiveCapChoice}
              onChange={(event) => setCapChoice(event.target.value)}
              aria-label="Budget cap"
            >
              {capOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </>
        }
        next={{ to: "/methods", label: "Methods & data" }}
      />

      <KpiStrip items={kpis} />

      <Bento className="shortlist-bento">
          <Panel
            className="shortlist-buys"
            title={isRent ? "What your rent buys" : "What your budget buys"}
            subtitle={`${districtName} · ${brief.flatSize} ft² · ${listingModel?.clipped.clipped ?? 0} outliers clipped`}
            noteId="shortlist-budget-buys"
            loading={(!listings.data && !listings.error) || districtData.loading}
            error={listings.error}
            empty={!budgetBuysOption || !listingModel?.selection.length}
            emptyMessage="No listings match this district and tenure."
            footer={
              listingModel
                ? `${listingModel.reach.share.toFixed(0)}% of ${listingModel.reach.total} listings in budget${
                    askingPremium === null ? " · current asking snapshot" : ` · asking median ${fmtPct(askingPremium)} vs transactions`
                  }.`
                : "Current listings, not transactions; axes clipped at the 99th percentile."
            }
          >
            {budgetBuysOption ? (
              <Chart option={budgetBuysOption} ariaLabel="Listings by area and total asking price" />
            ) : null}
          </Panel>

          <Panel
            className="shortlist-table"
            title="Shortlist table"
            subtitle={`${Math.min(15, model?.matched.length ?? 0)} rows · click to profile`}
            noteId="shortlist-table"
            actions={
              <select
                className="rail-select filter-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Sort estates"
              >
                <option value="value">Sort: value</option>
                <option value="yield">Sort: yield</option>
                <option value="age">Sort: age</option>
                <option value="volume">Sort: volume</option>
              </select>
            }
            loading={districtData.loading}
            empty={!model?.matched.length}
            emptyMessage="No matching estates."
            padded
            footer={
              model && model.matched.length > 15
                ? `Showing 15 of ${model.matched.length}; narrow the filters or the cap.`
                : "Star an estate to keep it in your shortlist."
            }
          >
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Estate</th>
                    <th>District</th>
                    <th className="num">{isRent ? "Rent/ft²" : "Price/ft²"}</th>
                    <th className="num">Yield</th>
                    <th className="num">Age</th>
                    <th className="num">MTR</th>
                    <th className="num">Txn</th>
                    <th aria-label="Shortlist" />
                  </tr>
                </thead>
                <tbody>
                  {(model?.matched.slice(0, 15) ?? []).map((estate) => (
                    <tr
                      key={estate.estate_id}
                      className={selected?.estate_id === estate.estate_id ? "is-selected" : undefined}
                      onClick={() => setSelectedId(estate.estate_id)}
                    >
                      <td title={estate.name}>{estate.name}</td>
                      <td
                        title={lookup[estate.district_code]?.name_en ?? estate.district_code}
                      >
                        {lookup[estate.district_code]?.name_en ?? estate.district_code}
                      </td>
                      <td
                        className="num"
                        title={fmtPsf(isRent ? estate.rent_psf : estate.price_psf)}
                      >
                        {fmtMoney(isRent ? estate.rent_psf : estate.price_psf)}
                      </td>
                      <td className="num">
                        {estate.yield_pct === null ? "—" : fmtPctPlain(estate.yield_pct, 2)}
                      </td>
                      <td className="num">{estate.building_age_years ?? "—"}</td>
                      <td className="num">{estate.mtr_walk_minutes ?? "—"}</td>
                      <td className="num">{estate.volume}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-icon"
                          aria-label={
                            brief.shortlist.includes(estate.estate_id)
                              ? `Remove ${estate.name} from shortlist`
                              : `Add ${estate.name} to shortlist`
                          }
                          aria-pressed={brief.shortlist.includes(estate.estate_id)}
                          onClick={(event) => {
                            event.stopPropagation();
                            brief.toggleShortlist(estate.estate_id);
                          }}
                        >
                          {brief.shortlist.includes(estate.estate_id) ? "★" : "☆"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!model?.matched.length ? <p className="hint p-2">No estates match these filters.</p> : null}
            </div>
          </Panel>

          <Panel
            className="shortlist-profile"
            title="Estate profile"
            subtitle={
              selected
                ? `${selected.name} · ${lookup[selected.district_code]?.name_en ?? selected.district_code}`
                : "select an estate"
            }
            noteId="shortlist-profile"
            actions={
              selected ? (
                <button
                  type="button"
                  className={isShortlisted ? "btn btn-primary" : "btn"}
                  onClick={() => brief.toggleShortlist(selected.estate_id)}
                  aria-pressed={isShortlisted}
                >
                  {isShortlisted ? "★ Shortlisted" : "☆ Shortlist"}
                </button>
              ) : null
            }
            loading={districtData.loading || (!isRent && !quartiles.data && !quartiles.error)}
            empty={!selected}
            emptyMessage="Click a row to profile an estate."
            padded
            footer={
              isRent
                ? distribution
                  ? `District rent distribution from ${distribution.n} current rental listings.`
                  : "Not enough rental listings for a district distribution."
                : selectedQuartile
                  ? `Quartile history ${selectedQuartile.period[0]} → ${selectedQuartile.period[1]} (${selectedQuartile.n} quarters).`
                  : "No quarterly history for this estate."
            }
          >
            {selected ? (
              <div className="profile">
                <div className="profile-grid">
                  <div className="profile-kv">
                    <span>{isRent ? "Rent" : "Price"} $/ft²</span>
                    <strong>{fmtPsf(selectedPsf)}</strong>
                  </div>
                  <div className="profile-kv">
                    <span>Gross yield</span>
                    <strong>
                      {selected.yield_pct === null ? "—" : fmtPctPlain(selected.yield_pct, 2)}
                    </strong>
                  </div>
                  <div className="profile-kv">
                    <span>Age</span>
                    <strong>
                      {selected.building_age_years === null
                        ? "—"
                        : `${selected.building_age_years} yrs`}
                    </strong>
                  </div>
                  <div className="profile-kv">
                    <span>MTR walk</span>
                    <strong>
                      {selected.mtr_walk_minutes === null
                        ? "—"
                        : `${selected.mtr_walk_minutes} min`}
                    </strong>
                  </div>
                  <div className="profile-kv">
                    <span>Units</span>
                    <strong>{selected.total_units?.toLocaleString("en-HK") ?? "—"}</strong>
                  </div>
                  <div className="profile-kv">
                    <span>Transactions</span>
                    <strong>{selected.volume}</strong>
                  </div>
                </div>

                {!isRent && selectedQuartile && selectedPsf ? (
                  <div>
                    <div className="range-head">
                      <span>Quartile range</span>
                      <span className="muted">district median {fmtPsf(districtMedian)}</span>
                    </div>
                    <div className="range">
                      <div className="range-track" />
                      <div
                        className="range-iqr"
                        style={{
                          left: `${position(selectedQuartile.q1, selectedQuartile.min, selectedQuartile.max)}%`,
                          width: `${position(selectedQuartile.q3, selectedQuartile.min, selectedQuartile.max) - position(selectedQuartile.q1, selectedQuartile.min, selectedQuartile.max)}%`,
                        }}
                      />
                      <div
                        className="range-median"
                        style={{
                          left: `${position(selectedQuartile.median, selectedQuartile.min, selectedQuartile.max)}%`,
                        }}
                      />
                      <div
                        className="range-latest"
                        style={{
                          left: `${position(selectedPsf, selectedQuartile.min, selectedQuartile.max)}%`,
                        }}
                        title={`Latest ${fmtPsf(selectedPsf)}`}
                      />
                      {districtMedian !== null ? (
                        <div
                          className="range-district"
                          style={{
                            left: `${position(
                              Math.min(selectedQuartile.max, Math.max(selectedQuartile.min, districtMedian)),
                              selectedQuartile.min,
                              selectedQuartile.max,
                            )}%`,
                          }}
                          title={`District median ${fmtPsf(districtMedian)}`}
                        />
                      ) : null}
                    </div>
                    <div className="range-labels">
                      <span>{fmtPsf(selectedQuartile.min)}</span>
                      <span>{fmtPsf(selectedQuartile.max)}</span>
                    </div>
                  </div>
                ) : null}

                {isRent && distribution && selectedPsf ? (
                  <div>
                    <div className="range-head">
                      <span>District rent distribution</span>
                      <span className="muted">{distribution.n} rental listings</span>
                    </div>
                    <div className="range">
                      <div className="range-track" />
                      <div
                        className="range-iqr"
                        style={{
                          left: `${position(distribution.p25, distribution.p10, distribution.p90)}%`,
                          width: `${position(distribution.p75, distribution.p10, distribution.p90) - position(distribution.p25, distribution.p10, distribution.p90)}%`,
                        }}
                      />
                      <div
                        className="range-median"
                        style={{
                          left: `${position(distribution.median, distribution.p10, distribution.p90)}%`,
                        }}
                      />
                      <div
                        className="range-latest"
                        style={{
                          left: `${position(
                            Math.min(distribution.p90, Math.max(distribution.p10, selectedPsf)),
                            distribution.p10,
                            distribution.p90,
                          )}%`,
                        }}
                        title={`This estate ${fmtPsf(selectedPsf)}`}
                      />
                      {cap > 0 ? (
                        <div
                          className="range-district"
                          style={{
                            left: `${position(
                              Math.min(distribution.p90, Math.max(distribution.p10, cap / brief.flatSize)),
                              distribution.p10,
                              distribution.p90,
                            )}%`,
                          }}
                          title={`Your cap ${fmtPsf(cap / brief.flatSize)}`}
                        />
                      ) : null}
                    </div>
                    <div className="range-labels">
                      <span>{fmtPsf(distribution.p10)}</span>
                      <span>{fmtPsf(distribution.p90)}</span>
                    </div>
                  </div>
                ) : null}

                <p className="hint">
                  {isRent ? "Monthly rent" : "Price"} at {brief.flatSize} ft² ≈ <b>{fmtMoney(costAtSize)}</b>{" "}
                  — {budgetVerdict}. Latest panel quarter{" "}
                  {latestQuarter(districtData.data?.panel ?? [])}.
                </p>
              </div>
            ) : null}
          </Panel>
      </Bento>
    </>
  );
}
