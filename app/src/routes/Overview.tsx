import { Link } from "react-router-dom";

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
      "Rank changes since 2018",
    ],
    color: "amber",
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
  },
] as const;

const COLORS: Record<string, string> = {
  teal: "from-teal-50 to-transparent dark:from-teal-950/40",
  amber: "from-amber-50 to-transparent dark:from-amber-950/30",
  blue: "from-blue-50 to-transparent dark:from-blue-950/30",
};

export default function Overview() {
  return (
    <div className="space-y-10">
      <section className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800 dark:text-teal-300">
          Hong Kong private housing
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
          What drives sale and rental prices — and where are the disparities?
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
          An interactive reading of three decades of official housing statistics, combined with
          estate-level price history and current listings. Three dashboards separate the questions
          of <strong className="font-medium text-[var(--text)]">time</strong>,{" "}
          <strong className="font-medium text-[var(--text)]">space</strong> and{" "}
          <strong className="font-medium text-[var(--text)]">household affordability</strong>.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
          {["1993–2026", "18 districts", "Estate-level history", "Sale & rent"].map((chip) => (
            <span key={chip} className="rounded-full border border-[var(--border)] px-3 py-1">
              {chip}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className={`card group flex flex-col bg-linear-to-b ${COLORS[card.color]} p-5 transition hover:-translate-y-0.5 hover:shadow-md`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {card.kicker}
            </span>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{card.question}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-[var(--text-muted)]">
              {card.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <span className="mt-5 text-sm font-medium text-teal-800 dark:text-teal-300">
              Open dashboard →
            </span>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5 md:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            How to read the atlas
          </h2>
          <div className="mt-3 grid gap-4 text-sm leading-relaxed text-[var(--text-muted)] sm:grid-cols-2">
            <p>
              <strong className="font-medium text-[var(--text)]">Market Trends</strong> answers the
              time question: long-run indices, rent–price dynamics and the macro backdrop.
            </p>
            <p>
              <strong className="font-medium text-[var(--text)]">District Explorer</strong> answers
              the space question: levels, changes and outliers across the 18 districts.
            </p>
            <p>
              <strong className="font-medium text-[var(--text)]">Financing &amp; Affordability</strong>{" "}
              connects prices and rents to household income and mortgage costs.
            </p>
            <p>
              Filters carry across dashboards, and every chart can be traced back to its source in{" "}
              <Link to="/methods" className="underline underline-offset-2">
                Methods &amp; data
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Coverage
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
            <li>Official indices: 1993–2026</li>
            <li>District price history: 2018–2026</li>
            <li>Income by district: latest annual</li>
            <li>Listings: current snapshot</li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
            District estimates combine estate-level transaction series. Cells with too few
            observations are suppressed rather than shown as zero.
          </p>
        </div>
      </section>
    </div>
  );
}
