import PageHeader from "../components/PageHeader";

const SOURCES = [
  {
    name: "Rating and Valuation Department",
    what: "Private domestic price and rental indices, average prices/rents by class, yields, sales and completions.",
    href: "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
  },
  {
    name: "Land Registry",
    what: "Monthly sale and purchase agreement counts, consideration and primary/secondary split.",
    href: "https://data.gov.hk/en-data/dataset/hk-lr-data4-landreg",
  },
  {
    name: "Hong Kong Monetary Authority",
    what: "Residential mortgage survey, HIBOR and best lending rate.",
    href: "https://www.hkma.gov.hk/eng/data-publications-and-research/data-and-statistics/monthly-statistical-bulletin/",
  },
  {
    name: "Census and Statistics Department",
    what: "Median monthly household income and average household size by District Council district.",
    href: "https://www.censtatd.gov.hk/en/web_table.html?id=130-06806",
  },
  {
    name: "Home Affairs Department",
    what: "18 District Council boundary polygons and district codes, clipped to land-only shapes for the map.",
    href: "https://data.gov.hk/en-data/dataset/hk-had-json1-hong-kong-administrative-boundaries",
  },
  {
    name: "geohk / census2001",
    what: "Land-only district geometry used to remove sea from the HAD boundaries. Coastline vintage is 2001.",
    href: "https://github.com/hupili/geohk",
  },
  {
    name: "Squarefoot (28Hse group)",
    what: "Current sale/rent listings and estate-level quarterly price series; derived statistics only.",
    href: "https://www.squarefoot.com.hk/",
  },
];

export default function Methods() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reference"
        title="Methods & data"
        question="Definitions, sources, processing rules and limitations behind every chart."
      />

      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Core definitions
        </h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          {[
            ["$ / ft²", "Price divided by saleable area. RVD per-m² figures are converted at 10.7639 ft² per m²."],
            ["Gross yield", "12 × monthly rent per ft² ÷ sale price per ft². Management fees and taxes are excluded."],
            ["Price-to-income", "Price of a standard 500 ft² flat in a district ÷ annual median household income."],
            ["Rent-to-income", "Monthly rent of a standard 500 ft² flat in a district ÷ monthly median household income."],
            ["DSR", "Monthly mortgage payment ÷ monthly household income; the calculator defaults to a 50% cap."],
            ["Property class", "RVD area bands A–E: <40 m², 40–69.9, 70–99.9, 100–159.9, ≥160 m²."],
          ].map(([term, definition]) => (
            <div key={term}>
              <dt className="font-medium">{term}</dt>
              <dd className="mt-1 text-[var(--text-muted)]">{definition}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Sources
        </h2>
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {SOURCES.map((source) => (
            <li key={source.name} className="grid gap-1 py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
              <a
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline-offset-2 hover:underline"
              >
                {source.name}
              </a>
              <span className="text-sm text-[var(--text-muted)]">{source.what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Limitations
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--text-muted)]">
          <li>
            District price history is aggregated from estate-level transaction series; districts with
            too few estates or transactions are flagged, not filled with zero.
          </li>
          <li>
            Rent history before the current snapshot is modelled from the RVD rental index (or a
            regional rental index), holding district relativities fixed. It is labelled “modelled”.
          </li>
          <li>
            Listing prices are asking prices and sit above transaction prices; transactions are used
            for trend and yield calculations wherever available.
          </li>
          <li>
            Affordability uses household income, not buyer income; stamp duty, legal fees,
            management fees and vacancy costs are excluded.
          </li>
          <li>
            The district map is clipped to a land-only census2001 coastline, so the choropleth has no
            sea but does not show reclamation after 2001.
          </li>
          <li>Relationships shown are associations. Nothing here is a causal estimate or investment advice.</li>
        </ul>
      </section>
    </div>
  );
}
