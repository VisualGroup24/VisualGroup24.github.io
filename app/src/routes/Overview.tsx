import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useDistrictData } from "../data/useDistrictData";
import { useMarket } from "../data/useMarket";
import { fmtPct, fmtPctPlain } from "../lib/format";

const CARDS = [
  {
    to: "/market",
    kicker: "Prices",
    title: "Market Trends",
    question: "How have sale prices and rents moved, and what macro forces coincide with the turns?",
    bullets: [
      "RVD price and rental indices, 1993–2026",
      "Rent–price co-movement and lead–lag",
      "Mortgage rates, volume, income and completions",
      "PCA of listing attributes",
    ],
    color: "teal",
    preview: "market",
  },
  {
    to: "/districts",
    kicker: "Space",
    title: "District Explorer",
    question: "Where is housing most expensive, and are the gaps between districts widening?",
    bullets: [
      "18-district choropleth, sale and rent",
      "District × class heatmap with cross-filter",
      "Estate price history and accessibility",
      "Sale $/ft² by region",
    ],
    color: "amber",
    preview: "districts",
  },
  {
    to: "/affordability",
    kicker: "Households & investors",
    title: "Financing & Affordability",
    question: "What return does housing offer, and who can afford to live where?",
    bullets: [
      "Gross yields by district over time",
      "Yield versus price growth",
      "Price- and rent-to-income rankings",
      "Mortgage and stress-test calculator",
    ],
    color: "blue",
    preview: "affordability",
  },
] as const;

const COLORS: Record<string, string> = {
  teal: "from-teal-50 to-transparent dark:from-teal-950/40",
  amber: "from-amber-50 to-transparent dark:from-amber-950/30",
  blue: "from-blue-50 to-transparent dark:from-blue-950/30",
};

const PREVIEWS: Record<string, string> = {
  market: `${import.meta.env.BASE_URL}previews/market.png`,
  districts: `${import.meta.env.BASE_URL}previews/districts.png`,
  affordability: `${import.meta.env.BASE_URL}previews/affordability.png`,
};

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export default function Overview() {
  const { data: market } = useMarket();
  const { data: district } = useDistrictData();

  const glance = useMemo(() => {
    const rvd = (market?.rvd ?? [])
      .filter((row) => row.property_class === "ALL")
      .sort((a, b) => a.month.localeCompare(b.month));
    const latest = rvd[rvd.length - 1];
    const previous = rvd[rvd.length - 13];
    const base = rvd.find((row) => row.month === "2019-01") ?? rvd[0];
    const priceRaw = latest?.price_index ?? null;
    const rentRaw = latest?.rent_index ?? null;
    const priceIndex =
      priceRaw !== null && base?.price_index ? (priceRaw / base.price_index) * 100 : null;
    const rentIndex =
      rentRaw !== null && base?.rent_index ? (rentRaw / base.rent_index) * 100 : null;
    const priceYoy =
      priceRaw !== null && previous?.price_index
        ? ((priceRaw - previous.price_index) / previous.price_index) * 100
        : null;
    const rentYoy =
      rentRaw !== null && previous?.rent_index
        ? ((rentRaw - previous.rent_index) / previous.rent_index) * 100
        : null;

    const allYields = market?.yields ?? [];
    const latestYieldMonth = allYields.reduce(
      (latestMonth, row) => (row.month > latestMonth ? row.month : latestMonth),
      "",
    );
    const latestYields = allYields.filter(
      (row) => row.month === latestYieldMonth && row.yield_pct !== null,
    );
    const grossYield = latestYields.length
      ? latestYields.reduce((sum, row) => sum + (row.yield_pct ?? 0), 0) / latestYields.length
      : null;

    const latestYear = district?.affordability.length
      ? Math.max(...district.affordability.map((row) => row.year))
      : null;
    const latestAffordability =
      district?.affordability.filter((row) => row.year === latestYear) ?? [];
    const pti = median(latestAffordability.map((row) => row.pti));

    return {
      priceIndex,
      rentIndex,
      priceYoy,
      rentYoy,
      grossYield,
      pti,
      listings: district?.coverage.listings ?? null,
    };
  }, [market, district]);

  return (
    <div className="desktop-dashboard overview-screen space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <img
            src={`${import.meta.env.BASE_URL}qr-visualgroup24.png`}
            alt="QR code for visualgroup24.github.io"
            className="h-20 w-20 shrink-0 rounded-md border border-[var(--border)] bg-white object-contain p-1 sm:h-[100px] sm:w-[100px]"
          />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-800 dark:text-teal-300">
              Hong Kong private housing
            </p>
            <h1 className="mt-1 max-w-4xl text-3xl font-semibold tracking-tight sm:text-5xl">
              A Practical Guide for Buyers and Tenants in HK
            </h1>
          </div>
        </div>
        <div className="overview-meta-chips hidden flex-wrap gap-2 text-[11px] text-[var(--text-muted)] lg:flex">
          {["1993–2026", "18 districts", "Estate-level history", "Sale & rent"].map((chip) => (
            <span key={chip} className="rounded-full border border-[var(--border)] px-2.5 py-1">
              {chip}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.2fr]">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className={`card group flex min-h-0 flex-col bg-linear-to-b ${COLORS[card.color]} p-4 transition hover:-translate-y-0.5 hover:shadow-md`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {card.kicker}
            </span>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{card.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{card.question}</p>
            <ul className="mt-3 space-y-1 text-[11px] text-[var(--text-muted)]">
              {card.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 min-h-[92px] flex-1 overflow-hidden rounded-md border border-[var(--border)] bg-white">
              <img
                src={PREVIEWS[card.preview]}
                alt={`${card.title} chart preview`}
                className="h-full w-full object-cover object-center"
                loading="lazy"
              />
            </div>
            <span className="mt-2 text-xs font-medium text-teal-800 dark:text-teal-300">
              Open dashboard →
            </span>
          </Link>
        ))}

        <div className="card flex flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">At a glance</h2>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Latest official readings</p>
            </div>
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[9px] text-[var(--text-muted)]">
              {market ? "live" : "loading"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              {
                label: "Price index",
                value: glance.priceIndex?.toFixed(1) ?? "—",
                note: glance.priceYoy === null ? "2019 = 100" : `${fmtPct(glance.priceYoy)} YoY`,
              },
              {
                label: "Rent index",
                value: glance.rentIndex?.toFixed(1) ?? "—",
                note: glance.rentYoy === null ? "2019 = 100" : `${fmtPct(glance.rentYoy)} YoY`,
              },
              {
                label: "Gross yield",
                value: glance.grossYield === null ? "—" : fmtPctPlain(glance.grossYield),
                note: "latest quarter",
              },
              {
                label: "Price-to-income",
                value: glance.pti === null ? "—" : `${glance.pti.toFixed(1)}×`,
                note: "median district",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-black/[0.03] p-2 dark:bg-white/[0.04]">
                <p className="text-[9px] uppercase tracking-wide text-[var(--text-muted)]">{item.label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{item.value}</p>
                <p className="text-[9px] text-[var(--text-muted)]">{item.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 border-t border-[var(--border)] pt-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Official indices
            </p>
            <div className="mt-1 space-y-1 text-[10px] text-[var(--text-muted)]">
              <div className="flex justify-between gap-2"><span>District price history</span><span>2018–2026</span></div>
              <div className="flex justify-between gap-2"><span>Income by district</span><span>latest annual</span></div>
              <div className="flex justify-between gap-2"><span>Listings parsed</span><span>{glance.listings?.toLocaleString() ?? "—"}</span></div>
            </div>
          </div>

          <div className="mt-3 border-t border-[var(--border)] pt-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Coverage
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">
              District estimates combine estate-level transaction series. Cells with too few
              observations are suppressed rather than shown as zero.
            </p>
          </div>

          <div className="mt-auto pt-3">
            <Link to="/methods" className="text-[11px] font-medium text-teal-800 underline underline-offset-2 dark:text-teal-300">
              Methods &amp; data →
            </Link>
          </div>
        </div>
      </section>

      <p className="text-[10px] text-[var(--text-muted)]">
        Filters, tenure, district and class are preserved across dashboards and in the URL.
      </p>
    </div>
  );
}
